#!/usr/bin/env node
/**
 * Structure check for {{appTitle}}, run by `npm run lint` after ESLint: the pieces of every script
 * agree with each other, so a controller added by hand (or by an agent) is complete before it is
 * deployed. ESLint sees one file at a time; this script sees the set.
 *
 * For every controller (api/src/controllers/<name>Controller.ts):
 *   - it exports <name>Endpoints = defineEndpoints({ ... }), the type <Name>Endpoints, and the entry point of its
 *     kind (`post = defineRestlet(...)` for a Restlet, `onRequest = defineSuitelet(...)` for a Suitelet) whose
 *     declaration says name: '<name>' and ids that share the prefix and the name and fit NetSuite's 40-character cap
 *   - netsuite/Objects/<scriptId>.xml exists, is a <restlet> or <suitelet> matching the entry point, declares the
 *     deployment, and points at api/controllers/<name>Controller.js
 * For every job (api/src/jobs/<name>.ts):
 *   - its defineJob declaration names a script whose ids share the prefix and the name, end in _mr, and fit the cap
 *   - netsuite/Objects/<scriptId>.xml is a <mapreducescript> declaring every deployment the job may run on and every
 *     script parameter it reads, and points at api/jobs/<name>.js
 *
 * And the other way round: every SDF script object points at an existing source whose @NScriptType matches, and
 * every server-side @NScriptType file has an object (a ClientScript attached to a form has no script record).
 * Events are the exception: their script records are created in NetSuite by hand, so api/src/events is checked for
 * its file names and script types only.
 * (`npm run generate` reads the same declarations to write the clients and fails on one it cannot read; TypeScript
 * checks the rest: a client call that names an endpoint the controller lacks does not compile.)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_ID_MAX_LENGTH = 40;
const problems = [];

function report(message) {
    problems.push(message);
}

function readProjectFile(relativePath) {
    return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

function projectFileExists(relativePath) {
    return existsSync(path.join(projectRoot, relativePath));
}

function listFilesRecursively(relativeDirectory) {
    const directory = path.join(projectRoot, relativeDirectory);
    if (!existsSync(directory)) return [];
    const files = [];
    for (const entry of readdirSync(directory)) {
        const relativePath = `${relativeDirectory}/${entry}`;
        if (statSync(path.join(projectRoot, relativePath)).isDirectory()) files.push(...listFilesRecursively(relativePath));
        else files.push(relativePath);
    }
    return files;
}

/** The leading JSDoc block NetSuite reads, or an empty string when the file has none. */
function readScriptHeader(source) {
    const match = source.match(/^\s*(\/\*[\s\S]*?\*\/)/);
    return match ? match[1] : '';
}

function readDeclaredScriptType(source) {
    return readScriptHeader(source).match(/@NScriptType\s+(\w+)/)?.[1];
}

/** `app.prefix` and `app.fileCabinet.folder`, read from netsuite.ts as text. */
function readAppNames() {
    const source = readProjectFile('netsuite.ts');
    const prefix = source.match(/^\s*prefix:\s*'([^']*)'/m)?.[1];
    const folder = source.match(/^\s*folder:\s*'([^']*)'/m)?.[1];
    if (!prefix || !folder) report('netsuite.ts: could not read app.prefix and app.fileCabinet.folder.');
    return { prefix: prefix ?? '', folder: folder ?? '' };
}

const KIND_BY_DEFINE = { defineRestlet: 'restlet', defineSuitelet: 'suitelet' };
const ENTRY_POINT_BY_KIND = { restlet: 'post', suitelet: 'onRequest' };
const HEADER_BY_KIND = { restlet: 'Restlet', suitelet: 'Suitelet' };

/** The script a controller declares in its defineRestlet or defineSuitelet call, read from the source as text. */
function readController(controllerPath) {
    const name = path.basename(controllerPath, '.ts').replace(/Controller$/, '');
    const endpointsTypeName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Endpoints`;
    const source = readProjectFile(controllerPath);
    if (!source.includes(`export const ${name}Endpoints = defineEndpoints(`)) {
        report(`${controllerPath}: must export ${name}Endpoints = defineEndpoints({ ... }), as api/src/controllers/userController.ts does.`);
    }
    if (!source.includes(`export type ${endpointsTypeName} = typeof ${name}Endpoints;`)) {
        report(`${controllerPath}: must export type ${endpointsTypeName} = typeof ${name}Endpoints; server code that calls the controller is built from it.`);
    }
    // The declaration, the endpoints and, optionally, the options object (authorize) after them.
    const entryPoint = source.match(/^export const (\w+) = (defineRestlet|defineSuitelet)\(\s*\{([\s\S]*?)\}\s*,\s*(\w+)\s*(?:,\s*\{[\s\S]*?\}\s*)?\)/m);
    if (!entryPoint) {
        report(`${controllerPath}: must end with \`export const post = defineRestlet({ name, scriptId, deployId }, ${name}Endpoints);\` or \`export const onRequest = defineSuitelet(...)\`; options such as authorize may follow the endpoints.`);
        return undefined;
    }
    const [, exportName, defineFunction, declaration, endpointsArgument] = entryPoint;
    const kind = KIND_BY_DEFINE[defineFunction];
    if (exportName !== ENTRY_POINT_BY_KIND[kind]) report(`${controllerPath}: a ${HEADER_BY_KIND[kind]} exports \`${ENTRY_POINT_BY_KIND[kind]}\`, not \`${exportName}\`.`);
    if (endpointsArgument !== `${name}Endpoints`) report(`${controllerPath}: ${defineFunction} must be passed ${name}Endpoints.`);
    const declaredType = readDeclaredScriptType(source);
    if (declaredType !== HEADER_BY_KIND[kind]) report(`${controllerPath}: @NScriptType must be ${HEADER_BY_KIND[kind]} to match ${defineFunction} (found "${declaredType ?? 'none'}").`);
    const declaredName = declaration.match(/\bname:\s*'([^']*)'/)?.[1];
    const scriptId = declaration.match(/\bscriptId:\s*'([^']*)'/)?.[1];
    const deployId = declaration.match(/\bdeployId:\s*'([^']*)'/)?.[1];
    if (declaredName !== name) report(`${controllerPath}: the declaration must say name: '${name}' (the file name without Controller; found "${declaredName ?? ''}").`);
    if (scriptId === undefined || deployId === undefined) {
        report(`${controllerPath}: the declaration needs scriptId and deployId as string literals.`);
        return undefined;
    }
    return { name, controllerPath, kind, scriptId, deployId };
}

function checkScriptIds(controller, prefix) {
    const where = controller.controllerPath;
    for (const [label, id] of [['scriptId', controller.scriptId], ['deployId', controller.deployId]]) {
        if (id.length > SCRIPT_ID_MAX_LENGTH) report(`${where}: ${label} "${id}" is ${id.length} characters; NetSuite caps script ids at ${SCRIPT_ID_MAX_LENGTH}.`);
    }
    const scriptSuffix = controller.scriptId.startsWith(`customscript_${prefix}_`) ? controller.scriptId.slice(`customscript_${prefix}_`.length) : undefined;
    const deploySuffix = controller.deployId.startsWith(`customdeploy_${prefix}_`) ? controller.deployId.slice(`customdeploy_${prefix}_`.length) : undefined;
    if (scriptSuffix === undefined) report(`${where}: scriptId "${controller.scriptId}" must start with customscript_${prefix}_.`);
    if (deploySuffix === undefined) report(`${where}: deployId "${controller.deployId}" must start with customdeploy_${prefix}_.`);
    if (scriptSuffix !== undefined && deploySuffix !== undefined && scriptSuffix !== deploySuffix) {
        report(`${where}: scriptId and deployId end differently ("${scriptSuffix}" vs "${deploySuffix}"); they name the same script.`);
    }
    if (scriptSuffix !== undefined && !/^[a-z][a-z0-9_]*$/.test(scriptSuffix)) {
        report(`${where}: the id suffix "${scriptSuffix}" must be lowercase letters, digits and underscores.`);
    }
}

/** Reads an SDF script object and returns its kind, deployment ids, parameter ids and the api/src path of its source file. */
function readScriptObject(objectPath) {
    const xml = readProjectFile(objectPath);
    const opening = xml.match(/^\s*<(restlet|suitelet|\w+)\s+scriptid="([^"]*)"/);
    const deployIds = Array.from(xml.matchAll(/<scriptdeployment scriptid="([^"]*)">/g), (match) => match[1]);
    const parameterIds = Array.from(xml.matchAll(/<scriptcustomfield\s+scriptid="([^"]*)"/g), (match) => match[1]);
    const scriptFile = xml.match(/<scriptfile>\[([^\]]*)\]<\/scriptfile>/)?.[1];
    return { objectPath, kind: opening?.[1], scriptId: opening?.[2], deployIds, parameterIds, scriptFile };
}

function checkControllerObject(controller, folder) {
    const objectPath = `netsuite/Objects/${controller.scriptId}.xml`;
    if (!projectFileExists(objectPath)) {
        report(`${controller.controllerPath}: ${objectPath} is missing; every script needs its SDF object (copy the user or userRoles one).`);
        return;
    }
    const object = readScriptObject(objectPath);
    if (object.kind !== controller.kind || object.scriptId !== controller.scriptId) {
        report(`${objectPath}: must open with <${controller.kind} scriptid="${controller.scriptId}"> to match ${controller.controllerPath}.`);
    }
    if (!object.deployIds.includes(controller.deployId)) report(`${objectPath}: declares no <scriptdeployment scriptid="${controller.deployId}">.`);
    const expectedScriptFile = `/SuiteScripts/${folder}/api/controllers/${controller.name}Controller.js`;
    if (object.scriptFile !== expectedScriptFile) report(`${objectPath}: <scriptfile> must be [${expectedScriptFile}] (found "${object.scriptFile ?? ''}").`);
}

/**
 * The job a file declares in its defineJob call, read from the source as text. The generator reads the
 * same call with a real parser and fails first on anything malformed; what is checked here is only
 * what it cannot see: the ids against the SDF object.
 */
function readJob(jobPath) {
    const name = path.basename(jobPath, '.ts');
    const source = readProjectFile(jobPath);
    const declaration = source.match(/=\s*defineJob\(\s*\{([\s\S]*?)\}\s*,/)?.[1];
    if (!declaration) {
        report(`${jobPath}: must declare its script with \`export const { getInputData, map, summarize } = defineJob({ ... }, { ... })\`; see HOW-TO-USE.md ("Adding a job").`);
        return undefined;
    }
    const declaredType = readDeclaredScriptType(source);
    if (declaredType !== 'MapReduceScript') report(`${jobPath}: @NScriptType must be MapReduceScript (found "${declaredType ?? 'none'}").`);
    const scriptId = declaration.match(/\bscriptId:\s*'([^']*)'/)?.[1];
    const runParameter = declaration.match(/\brunParameter:\s*'([^']*)'/)?.[1];
    const deployments = Array.from(declaration.match(/\bdeployments:\s*\[([^\]]*)\]/)?.[1]?.matchAll(/'([^']*)'/g) ?? [], (match) => match[1]);
    const parameters = Array.from(declaration.matchAll(/\bid:\s*'(custscript_[^']*)'/g), (match) => match[1]);
    if (scriptId === undefined || runParameter === undefined || deployments.length === 0) {
        report(`${jobPath}: the job declaration needs scriptId, runParameter and a non-empty deployments array, all as string literals.`);
        return undefined;
    }
    return { name, jobPath, scriptId, deployments, runParameter, parameters };
}

/** A job's ids: the prefix and the name they share, the _mr suffix, and NetSuite's 40-character cap. */
function checkJobIds(job, prefix) {
    const where = job.jobPath;
    const ids = [['scriptId', job.scriptId, `customscript_${prefix}_`], ['runParameter', job.runParameter, `custscript_${prefix}_`], ...job.deployments.map((deployment) => ['deployment', deployment, `customdeploy_${prefix}_`])];
    for (const [label, id, expectedPrefix] of ids) {
        if (id.length > SCRIPT_ID_MAX_LENGTH) report(`${where}: ${label} "${id}" is ${id.length} characters; NetSuite caps ids at ${SCRIPT_ID_MAX_LENGTH}.`);
        if (!id.startsWith(expectedPrefix)) report(`${where}: ${label} "${id}" must start with ${expectedPrefix}.`);
        else if (!/^[a-z][a-z0-9_]*$/.test(id.slice(expectedPrefix.length))) report(`${where}: the id suffix of "${id}" must be lowercase letters, digits and underscores.`);
    }
    const scriptSuffix = job.scriptId.startsWith(`customscript_${prefix}_`) ? job.scriptId.slice(`customscript_${prefix}_`.length) : undefined;
    if (scriptSuffix !== undefined && !scriptSuffix.endsWith('_mr')) {
        report(`${where}: scriptId "${job.scriptId}" must end with _mr; a job is a Map/Reduce script and the suffix says so in NetSuite's script list.`);
    }
    for (const deployment of job.deployments) {
        const deploySuffix = deployment.startsWith(`customdeploy_${prefix}_`) ? deployment.slice(`customdeploy_${prefix}_`.length) : undefined;
        if (scriptSuffix !== undefined && deploySuffix !== undefined && !deploySuffix.startsWith(scriptSuffix)) {
            report(`${where}: deployment "${deployment}" does not share the script's name ("${scriptSuffix}"); a second deployment of the same job is that name plus _2, _3.`);
        }
    }
}

function checkJobObject(job, folder) {
    const objectPath = `netsuite/Objects/${job.scriptId}.xml`;
    if (!projectFileExists(objectPath)) {
        report(`${job.jobPath}: ${objectPath} is missing; every job needs its SDF object (the nspObjectMapReduce snippet writes one).`);
        return;
    }
    const object = readScriptObject(objectPath);
    if (object.kind !== 'mapreducescript' || object.scriptId !== job.scriptId) {
        report(`${objectPath}: must open with <mapreducescript scriptid="${job.scriptId}"> to match ${job.jobPath}.`);
    }
    for (const deployment of job.deployments) {
        if (!object.deployIds.includes(deployment)) report(`${objectPath}: declares no <scriptdeployment scriptid="${deployment}">; the job's declaration says it may run there.`);
    }
    for (const parameter of [job.runParameter, ...job.parameters]) {
        if (!object.parameterIds.includes(parameter)) report(`${objectPath}: declares no <scriptcustomfield scriptid="${parameter}">; the job reads that parameter.`);
    }
    const expectedScriptFile = `/SuiteScripts/${folder}/api/jobs/${job.name}.js`;
    if (object.scriptFile !== expectedScriptFile) report(`${objectPath}: <scriptfile> must be [${expectedScriptFile}] (found "${object.scriptFile ?? ''}").`);
}

/** Every object points at an existing source of the matching type, and every server-side script source has an object. */
function checkObjectsAndSources(folder) {
    const expectedPrefix = `/SuiteScripts/${folder}/api/`;
    const referencedSources = new Set();
    for (const objectPath of listFilesRecursively('netsuite/Objects')) {
        if (!path.basename(objectPath).startsWith('customscript_')) continue;
        const object = readScriptObject(objectPath);
        if (!object.scriptFile || !object.scriptFile.startsWith(expectedPrefix) || !object.scriptFile.endsWith('.js')) {
            report(`${objectPath}: <scriptfile> must be a bundle under ${expectedPrefix} (found "${object.scriptFile ?? ''}").`);
            continue;
        }
        const sourcePath = `api/src/${object.scriptFile.slice(expectedPrefix.length, -'.js'.length)}.ts`;
        referencedSources.add(sourcePath);
        if (!projectFileExists(sourcePath)) {
            report(`${objectPath}: points at ${sourcePath}, which does not exist.`);
            continue;
        }
        const declaredType = readDeclaredScriptType(readProjectFile(sourcePath))?.toLowerCase();
        if (object.kind && declaredType !== object.kind) report(`${sourcePath}: @NScriptType must be ${object.kind} to match <${object.kind}> in ${objectPath} (found "${declaredType ?? 'none'}").`);
    }
    for (const sourceFile of listFilesRecursively('api/src')) {
        if (!sourceFile.endsWith('.ts') || sourceFile.endsWith('.d.ts') || sourceFile.includes('/repositories/generated/')) continue;
        // Events are deployed by hand: the developer creates their script record and its deployments in NetSuite,
        // so nothing under api/src/events is expected to have an SDF object here.
        if (sourceFile.startsWith('api/src/events/')) continue;
        const declaredType = readDeclaredScriptType(readProjectFile(sourceFile));
        // A client script attached to a Suitelet form (api/src/_host/host.ts) has no script record of its own.
        if (!declaredType || declaredType === 'ClientScript') continue;
        if (!referencedSources.has(sourceFile)) report(`${sourceFile} carries @NScriptType but no SDF object under netsuite/Objects points at it; add the object.`);
    }
}

/**
 * Events: named for what they fire on, and carrying the script type NetSuite reads. They are self-contained
 * SuiteScript with no SDF object, so there is nothing else here to hold them to.
 */
function checkEvents() {
    let count = 0;
    for (const [folder, expectedType] of [['api/src/events/user', 'UserEventScript'], ['api/src/events/client', 'ClientScript']]) {
        for (const eventFile of listFilesRecursively(folder)) {
            if (!/^[a-z][A-Za-z0-9]*\.ts$/.test(path.basename(eventFile))) {
                report(`${eventFile}: an event file is named <subject>.ts, with <subject> in camelCase; nothing else lives in ${folder}.`);
                continue;
            }
            count += 1;
            const declaredType = readDeclaredScriptType(readProjectFile(eventFile));
            if (declaredType !== expectedType) report(`${eventFile}: @NScriptType must be ${expectedType} (found "${declaredType ?? 'none'}").`);
        }
    }
    return count;
}

const app = readAppNames();
const controllers = [];
for (const controllerFile of listFilesRecursively('api/src/controllers')) {
    if (!/^[a-z][A-Za-z0-9]*Controller\.ts$/.test(path.basename(controllerFile))) {
        report(`${controllerFile}: a controller file is named <name>Controller.ts, with <name> in camelCase; nothing else lives in api/src/controllers.`);
        continue;
    }
    const controller = readController(controllerFile);
    if (!controller) continue;
    controllers.push(controller);
    checkScriptIds(controller, app.prefix);
    checkControllerObject(controller, app.folder);
}
const jobs = [];
for (const jobFile of listFilesRecursively('api/src/jobs')) {
    if (!/^[a-z][A-Za-z0-9]*\.ts$/.test(path.basename(jobFile))) {
        report(`${jobFile}: a job file is named <name>.ts, with <name> in camelCase; nothing else lives in api/src/jobs.`);
        continue;
    }
    const job = readJob(jobFile);
    if (!job) continue;
    jobs.push(job);
    checkJobIds(job, app.prefix);
    checkJobObject(job, app.folder);
}
// Every script id in the account is one script: a controller's, a job's, or one of a job's deployments.
const scriptOwners = new Map();
const deployOwners = new Map();
const claim = (owners, id, where, label) => {
    const owner = owners.get(id);
    if (owner) report(`${where}: ${label} "${id}" is also declared by ${owner}.`);
    else owners.set(id, where);
};
for (const controller of controllers) {
    claim(scriptOwners, controller.scriptId, controller.controllerPath, 'scriptId');
    claim(deployOwners, controller.deployId, controller.controllerPath, 'deployId');
}
for (const job of jobs) {
    claim(scriptOwners, job.scriptId, job.jobPath, 'scriptId');
    for (const deployment of job.deployments) claim(deployOwners, deployment, job.jobPath, 'deployment');
}
const eventCount = checkEvents();
checkObjectsAndSources(app.folder);

if (problems.length > 0) {
    console.error(`Structure check found ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nHOW-TO-USE.md ("Adding a controller", "Adding a job") lists every piece a script needs.');
    console.error('If this project no longer follows the template\'s controller layout, remove this check: delete scripts/checkStructure.mjs');
    console.error('and drop `&& node scripts/checkStructure.mjs` from the lint script in package.json (HOW-TO-USE.md, "Removing a rule you have outgrown").');
    process.exit(1);
}
console.log(`Structure check passed: ${controllers.length} controller(s), ${jobs.length} job(s), ${eventCount} event(s).`);
