#!/usr/bin/env node
/**
 * Structure check for {{appTitle}}, run by `npm run lint` after ESLint: the pieces of every script
 * agree with each other, so a controller added by hand (or by an agent) is complete before it is
 * deployed. ESLint sees one file at a time; this script sees the set.
 *
 * For every entry of `scripts` in common/netsuite.ts:
 *   - the script id and deployment id share the prefix and the name, and fit NetSuite's 40-character cap
 *   - netsuite/Objects/<scriptId>.xml exists, is a <restlet> or <suitelet> matching `kind`, declares the
 *     deployment, and points at a source file under api/src whose @NScriptType header matches `kind`
 *   - a controller (api/src/controllers/<name>Controller.ts) exports <name>Endpoints = defineEndpoints({ ... }),
 *     the type <Name>Endpoints, and the entry point of its kind (`post` for a Restlet, `onRequest` for a Suitelet)
 * (The browser client is generated: `npm run generate` writes client/src/api/index.gen.ts from the controllers and
 * fails on a controller it cannot read. TypeScript checks the rest: a client call that names an endpoint the
 * controller lacks does not compile.)
 * And the other way round: every controller file, every SDF script object and every server-side @NScriptType
 * file belongs to an entry of `scripts` (a ClientScript attached to a form has no script record).
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

/** `app.prefix`, `app.fileCabinet.folder` and every `scripts` entry, read from common/netsuite.ts as text. */
function readScriptRegistry() {
    const source = readProjectFile('common/netsuite.ts');
    const prefix = source.match(/^\s*prefix:\s*'([^']*)'/m)?.[1];
    const folder = source.match(/^\s*folder:\s*'([^']*)'/m)?.[1];
    const scriptsBlock = source.match(/export const scripts = \{([\s\S]*?)\n\} as const/)?.[1];
    if (!prefix || !folder || scriptsBlock === undefined) {
        report('common/netsuite.ts: could not read app.prefix, app.fileCabinet.folder and the scripts object.');
        return { prefix: prefix ?? '', folder: folder ?? '', entries: [] };
    }
    const entryPattern = /^\s*([A-Za-z][A-Za-z0-9]*):\s*\{\s*kind:\s*'([a-z]+)',\s*scriptId:\s*'([^']*)',\s*deployId:\s*'([^']*)'/gm;
    const entries = [];
    for (const match of scriptsBlock.matchAll(entryPattern)) {
        entries.push({ name: match[1], kind: match[2], scriptId: match[3], deployId: match[4] });
    }
    return { prefix, folder, entries };
}

function checkScriptIds(entry, prefix) {
    const where = `scripts.${entry.name}`;
    for (const [label, id] of [['scriptId', entry.scriptId], ['deployId', entry.deployId]]) {
        if (id.length > SCRIPT_ID_MAX_LENGTH) report(`${where}: ${label} "${id}" is ${id.length} characters; NetSuite caps script ids at ${SCRIPT_ID_MAX_LENGTH}.`);
    }
    const scriptSuffix = entry.scriptId.startsWith(`customscript_${prefix}_`) ? entry.scriptId.slice(`customscript_${prefix}_`.length) : undefined;
    const deploySuffix = entry.deployId.startsWith(`customdeploy_${prefix}_`) ? entry.deployId.slice(`customdeploy_${prefix}_`.length) : undefined;
    if (scriptSuffix === undefined) report(`${where}: scriptId "${entry.scriptId}" must start with customscript_${prefix}_.`);
    if (deploySuffix === undefined) report(`${where}: deployId "${entry.deployId}" must start with customdeploy_${prefix}_.`);
    if (scriptSuffix !== undefined && deploySuffix !== undefined && scriptSuffix !== deploySuffix) {
        report(`${where}: scriptId and deployId end differently ("${scriptSuffix}" vs "${deploySuffix}"); they name the same script.`);
    }
    if (scriptSuffix !== undefined && !/^[a-z][a-z0-9_]*$/.test(scriptSuffix)) {
        report(`${where}: the id suffix "${scriptSuffix}" must be lowercase letters, digits and underscores.`);
    }
}

/** Reads the SDF object of a scripts entry and returns the api/src path of its source file, or undefined. */
function checkScriptObject(entry, folder) {
    const objectPath = `netsuite/Objects/${entry.scriptId}.xml`;
    if (!projectFileExists(objectPath)) {
        report(`scripts.${entry.name}: ${objectPath} is missing; every script needs its SDF object.`);
        return undefined;
    }
    const xml = readProjectFile(objectPath);
    if (!['restlet', 'suitelet'].includes(entry.kind)) {
        report(`scripts.${entry.name}: kind "${entry.kind}" is not restlet or suitelet.`);
    } else if (!new RegExp(`^\\s*<${entry.kind}\\s+scriptid="${entry.scriptId}"`).test(xml)) {
        report(`${objectPath}: must open with <${entry.kind} scriptid="${entry.scriptId}"> to match kind "${entry.kind}" on scripts.${entry.name}.`);
    }
    if (!xml.includes(`<scriptdeployment scriptid="${entry.deployId}">`)) {
        report(`${objectPath}: declares no <scriptdeployment scriptid="${entry.deployId}">.`);
    }
    const scriptFile = xml.match(/<scriptfile>\[([^\]]*)\]<\/scriptfile>/)?.[1];
    const expectedPrefix = `/SuiteScripts/${folder}/api/`;
    if (!scriptFile || !scriptFile.startsWith(expectedPrefix) || !scriptFile.endsWith('.js')) {
        report(`${objectPath}: <scriptfile> must be a bundle under ${expectedPrefix} (found "${scriptFile ?? ''}").`);
        return undefined;
    }
    return `api/src/${scriptFile.slice(expectedPrefix.length, -'.js'.length)}.ts`;
}

function checkScriptSource(entry, sourcePath) {
    if (!projectFileExists(sourcePath)) {
        report(`scripts.${entry.name}: ${sourcePath} is missing, but netsuite/Objects/${entry.scriptId}.xml points at it.`);
        return;
    }
    const header = readScriptHeader(readProjectFile(sourcePath));
    const declaredKind = header.match(/@NScriptType\s+(\w+)/)?.[1]?.toLowerCase();
    if (declaredKind !== entry.kind) {
        report(`${sourcePath}: @NScriptType must be ${entry.kind === 'restlet' ? 'Restlet' : 'Suitelet'} to match kind "${entry.kind}" on scripts.${entry.name} (found "${declaredKind ?? 'none'}").`);
    }
}

const ENTRY_POINT_BY_KIND = { restlet: 'export const post = defineRestlet(', suitelet: 'export const onRequest = defineSuitelet(' };

function checkController(entry, sourcePath) {
    const name = entry.name;
    const controllerPath = `api/src/controllers/${name}Controller.ts`;
    const endpointsTypeName = `${name.charAt(0).toUpperCase()}${name.slice(1)}Endpoints`;
    if (sourcePath !== controllerPath) {
        report(`scripts.${name}: a controller's script file is ${controllerPath} (the object points at ${sourcePath}).`);
        return;
    }
    const controllerSource = readProjectFile(controllerPath);
    if (!controllerSource.includes(`export const ${name}Endpoints = defineEndpoints(`)) {
        report(`${controllerPath}: must export ${name}Endpoints = defineEndpoints({ ... }), as api/src/controllers/userController.ts does.`);
    }
    if (!controllerSource.includes(`export type ${endpointsTypeName} = typeof ${name}Endpoints;`)) {
        report(`${controllerPath}: must export type ${endpointsTypeName} = typeof ${name}Endpoints; the clients are built from it.`);
    }
    const entryPoint = ENTRY_POINT_BY_KIND[entry.kind];
    if (entryPoint && !controllerSource.includes(entryPoint)) {
        report(`${controllerPath}: must end with \`${entryPoint}'${name}', ${name}Endpoints);\` to match kind "${entry.kind}" on scripts.${name}.`);
    }
}

function checkNothingIsOrphaned(entries, sourcePathsByEntry) {
    const entryNames = new Set(entries.map((entry) => entry.name));
    for (const controllerFile of listFilesRecursively('api/src/controllers')) {
        const name = path.basename(controllerFile, '.ts').replace(/Controller$/, '');
        if (!controllerFile.endsWith('Controller.ts') || !entryNames.has(name)) report(`${controllerFile} has no scripts.${name} entry in common/netsuite.ts (a controller is named <name>Controller.ts after its entry).`);
    }
    const scriptIds = new Set(entries.map((entry) => entry.scriptId));
    for (const objectFile of listFilesRecursively('netsuite/Objects')) {
        const baseName = path.basename(objectFile, '.xml');
        if (baseName.startsWith('customscript_') && !scriptIds.has(baseName)) report(`${objectFile} belongs to no scripts entry in common/netsuite.ts.`);
    }
    const referencedSources = new Set(sourcePathsByEntry.values());
    for (const sourceFile of listFilesRecursively('api/src')) {
        if (!sourceFile.endsWith('.ts') || sourceFile.endsWith('.d.ts') || sourceFile.includes('/__tests__/') || sourceFile.includes('/repositories/generated/')) continue;
        const declaredKind = readScriptHeader(readProjectFile(sourceFile)).match(/@NScriptType\s+(\w+)/)?.[1];
        // A client script attached to a Suitelet form (api/src/_host/host.ts) has no script record of its own.
        if (!declaredKind || declaredKind === 'ClientScript') continue;
        if (!referencedSources.has(sourceFile)) report(`${sourceFile} carries @NScriptType but no SDF object under netsuite/Objects points at it; add a scripts entry and its object.`);
    }
}

const registry = readScriptRegistry();
const sourcePathsByEntry = new Map();
for (const entry of registry.entries) {
    checkScriptIds(entry, registry.prefix);
    const sourcePath = checkScriptObject(entry, registry.folder);
    if (!sourcePath) continue;
    sourcePathsByEntry.set(entry.name, sourcePath);
    checkScriptSource(entry, sourcePath);
    if (sourcePath.startsWith('api/src/controllers/')) checkController(entry, sourcePath);
}
checkNothingIsOrphaned(registry.entries, sourcePathsByEntry);

if (problems.length > 0) {
    console.error(`Structure check found ${problems.length} problem(s):`);
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nHOW-TO-USE.md ("Adding a controller") lists every piece a script needs.');
    process.exit(1);
}
const controllerCount = [...sourcePathsByEntry.values()].filter((sourcePath) => sourcePath.startsWith('api/src/controllers/')).length;
console.log(`Structure check passed: ${registry.entries.length} script(s), ${controllerCount} controller(s).`);
