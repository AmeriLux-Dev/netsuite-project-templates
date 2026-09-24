#!/usr/bin/env node
/**
 * End-to-end check of the react-app template: scaffold DemoApp into the OS temp directory with the
 * CLI, install, generate, typecheck, lint (ESLint plus the structure check), test, build, and assert
 * the File Cabinet output is exactly what the CLI README promises.
 *
 * The scratch project lives outside the repository on purpose: nested inside it, its tests would
 * resolve a second copy of vitest from a parent node_modules.
 *
 *   node scripts/e2e.mjs --cli ../create-netsuite-project   # a CLI checkout (its dist/index.js must be built) or the entry file itself
 *   node scripts/e2e.mjs                                     # the published CLI, through npx create-netsuite-project@latest
 *   node scripts/e2e.mjs --keep                              # leave the scratch project in place for inspection
 *                                                            # (then: node scripts/checkSnippets.mjs --project <it> --keep to look at the expanded snippets)
 *   node scripts/e2e.mjs --netsuite-api ../netsuite-api/amerilux-netsuite-api-0.1.0.tgz
 *                                                            # install @amerilux/netsuite-api from a packed tarball (npm pack in its checkout)
 *                                                            # instead of the registry, to check the template against an unpublished version
 *   node scripts/e2e.mjs --netsuite-wrapper ../netsuite-wrapper/amerilux-netsuite-wrapper-0.4.0.tgz
 *   node scripts/e2e.mjs --netsuite-repository ../netsuite-repository/amerilux-netsuite-repository-1.2.1.tgz
 *                                                            # the same for @amerilux/netsuite-wrapper and @amerilux/netsuite-repository
 *
 * The main scaffold is built with --performance-tracker so the wrapper's instrumentation, telemetry
 * bootstrap and entry wrapping run through a real webpack build; the plain variant checks the flag off.
 * Three more scaffolds leave out netsuite-api, netsuite-repository or both, and must install, typecheck, lint,
 * test and build with nothing of the left-out package in them.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templatesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(templatesRoot, 'react-app');
const e2eRoot = path.join(os.tmpdir(), 'create-netsuite-project-e2e');
const projectDir = path.join(e2eRoot, 'DemoApp');
const keep = process.argv.includes('--keep');
const isWindows = process.platform === 'win32';
const cliCommand = resolveCliCommand(process.argv);
const packageTarballs = {
    '@amerilux/netsuite-api': resolvePackageTarball(process.argv, '--netsuite-api', 'netsuite-api'),
    '@amerilux/netsuite-repository': resolvePackageTarball(process.argv, '--netsuite-repository', 'netsuite-repository'),
    '@amerilux/netsuite-wrapper': resolvePackageTarball(process.argv, '--netsuite-wrapper', 'netsuite-wrapper'),
};
console.log(`Scratch project: ${projectDir}`);
console.log(`CLI: ${cliCommand.join(' ')}`);
for (const [packageName, tarballPath] of Object.entries(packageTarballs)) {
    if (tarballPath) console.log(`${packageName}: ${tarballPath}`);
}

/** `<flag> <path>` names a packed tarball of a package to install instead of the registry version. */
function resolvePackageTarball(argv, flag, checkoutName) {
    const flagIndex = argv.indexOf(flag);
    if (flagIndex === -1) return undefined;
    const tarballPath = argv[flagIndex + 1];
    if (!tarballPath || tarballPath.startsWith('--') || !tarballPath.endsWith('.tgz')) {
        console.error(`${flag} needs the path of a .tgz from \`npm pack\` in the ${checkoutName} checkout.`);
        process.exit(1);
    }
    const resolvedPath = path.resolve(tarballPath);
    if (!existsSync(resolvedPath)) {
        console.error(`Tarball not found at ${resolvedPath}.`);
        process.exit(1);
    }
    return resolvedPath;
}

/** Points every workspace that depends on the package at the tarball, so npm install never asks the registry for it. */
function usePackageTarball(directory, packageName, tarballPath) {
    const specifier = `file:${tarballPath.split(path.sep).join('/')}`;
    for (const workspace of ['api', 'client']) {
        const manifestPath = path.join(directory, workspace, 'package.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.dependencies?.[packageName] === undefined) continue;
        manifest.dependencies[packageName] = specifier;
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    }
}

/** `--cli <path>` names a CLI checkout (dist/index.js must be built) or the entry file itself; without it the published CLI runs through npx. */
function resolveCliCommand(argv) {
    const flagIndex = argv.indexOf('--cli');
    if (flagIndex === -1) return ['npx', '--yes', 'create-netsuite-project@latest'];
    const cliPath = argv[flagIndex + 1];
    if (!cliPath || cliPath.startsWith('--')) {
        console.error('--cli needs a path: a CLI checkout or its dist/index.js.');
        process.exit(1);
    }
    const resolvedPath = path.resolve(cliPath);
    const entryFile = existsSync(resolvedPath) && statSync(resolvedPath).isDirectory() ? path.join(resolvedPath, 'dist', 'index.js') : resolvedPath;
    if (!existsSync(entryFile)) {
        console.error(`CLI entry not found at ${entryFile}. Run npm run build in the CLI checkout first.`);
        process.exit(1);
    }
    return ['node', entryFile];
}

/** With shell:true (needed for npm's .cmd shim on Windows) arguments with spaces must be quoted by hand. */
function quoteForShell(argument) {
    return isWindows && /\s/.test(argument) ? `"${argument}"` : argument;
}

function run(command, args, cwd) {
    console.log(`\n> ${command} ${args.join(' ')}   (in ${path.relative(templatesRoot, cwd) || '.'})`);
    const result = spawnSync(command, args.map(quoteForShell), { cwd, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) {
        console.error(`\nFAILED: ${command} ${args.join(' ')} (exit ${result.status})`);
        process.exit(result.status ?? 1);
    }
}

function runCli(args, cwd) {
    const [command, ...leadingArguments] = cliCommand;
    run(command, [...leadingArguments, ...args], cwd);
}

function listFiles(directory, prefix = '') {
    const files = [];
    for (const entry of readdirSync(directory)) {
        const fullPath = path.join(directory, entry);
        const relativePath = prefix ? `${prefix}/${entry}` : entry;
        if (statSync(fullPath).isDirectory()) files.push(...listFiles(fullPath, relativePath));
        else files.push(relativePath);
    }
    return files.sort();
}

function assertEqual(actual, expected, label) {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        console.error(`\nASSERTION FAILED: ${label}\n  expected ${expectedText}\n  actual   ${actualText}`);
        process.exit(1);
    }
    console.log(`ok: ${label}`);
}

function assertBanner(filePath) {
    const source = readFileSync(filePath, 'utf8');
    if (!source.startsWith('/**') || !/@NApiVersion 2\.1/.test(source.slice(0, 200)) || !/@NScriptType/.test(source.slice(0, 200))) {
        console.error(`\nASSERTION FAILED: ${filePath} does not start with the NetSuite JSDoc banner`);
        process.exit(1);
    }
    // Scripts with N/* dependencies emit define([...deps], ...); a dependency-free script emits define(() => ...).
    if (!/^define\(/m.test(source)) {
        console.error(`\nASSERTION FAILED: ${filePath} is not an AMD module`);
        process.exit(1);
    }
    console.log(`ok: banner and define(...) in ${path.basename(filePath)}`);
}

if (existsSync(projectDir)) rmSync(projectDir, { recursive: true, force: true });
mkdirSync(e2eRoot, { recursive: true });

runCli([
    projectDir,
    '--local-template', templateDir,
    '--prefix', 'demo', '--author', 'ci', '--description', 'End-to-end scaffold check',
    '--probity', '--performance-tracker', '--yes', '--no-install', '--no-git',
], templatesRoot);
assertEqual(existsSync(path.join(projectDir, 'probity.config.ts')), true, '--probity emits probity.config.ts');
const probitySettings = JSON.parse(readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8'));
assertEqual(probitySettings.hooks.PreToolUse[0].hooks[0].command, 'npx @nizos/probity --agent claude-code', '--probity wires Probity as the Claude Code guardrail');
assertEqual(probitySettings.hooks.PostToolUse[0].hooks[0].command, 'node .claude/hooks/checkWrittenFile.mjs', 'every scaffold checks each file Claude writes');
assertEqual(existsSync(path.join(projectDir, '.claude', 'hooks', 'guardrails.mjs')), false, '--probity leaves out the guardrails hook Probity replaces');
assertEqual(readdirSync(path.join(projectDir, '.claude', 'rules')).sort(), ['api.md', 'client.md', 'controllers.md', 'data-access.md', 'events.md', 'jobs.md', 'lib.md', 'services.md', 'tests.md'], 'the folder rules Claude Code loads per folder are scaffolded');
assertEqual(/^---\r?\nname: convert-project\r?\n/.test(readFileSync(path.join(projectDir, '.claude', 'skills', 'convert-project', 'SKILL.md'), 'utf8')), true, 'the convert-project skill is scaffolded');
assertEqual(JSON.parse(readFileSync(path.join(projectDir, '.netsuite-project.json'), 'utf8')).features, { performanceTracker: true, probity: true, netsuiteApi: true, netsuiteRepository: true }, 'features recorded with both flags on');
const wrapperConfigSource = readFileSync(path.join(projectDir, 'api', 'netsuite-wrapper.config.js'), 'utf8');
assertEqual(wrapperConfigSource.includes("integration: 'performance-tracker'") && wrapperConfigSource.includes("scopeKey: 'app:demo-app'") && wrapperConfigSource.includes('instrumentation: true'), true, '--performance-tracker renders the wrapper config with the app scope key');
assertEqual(wrapperConfigSource.includes('telemetryBootstrap: false'), false, '--performance-tracker drops the telemetry-off branch');

// The default (no Probity) variant must render cleanly too; it is checked without an install.
const plainDir = path.join(e2eRoot, 'PlainApp');
if (existsSync(plainDir)) rmSync(plainDir, { recursive: true, force: true });
runCli([
    plainDir,
    '--local-template', templateDir,
    '--prefix', 'plain', '--author', 'ci', '--yes', '--no-install', '--no-git', '--jobs',
], templatesRoot);
// --jobs runs the project's own add:jobs, which needs no dependencies: the run record, the cleanup job and what a page follows a run with.
assertEqual(existsSync(path.join(plainDir, 'netsuite', 'Objects', 'customrecord_plain_job_run.xml')), true, '--jobs writes the run record object with the project prefix');
assertEqual(existsSync(path.join(plainDir, 'api', 'src', 'jobs', 'jobRunCleanup', 'jobRunCleanup.ts')), true, '--jobs writes the cleanup job in its own folder');
assertEqual(existsSync(path.join(plainDir, 'client', 'src', 'hooks', 'useJobRun.ts')), true, '--jobs writes the hook a page follows a run with');
assertEqual(JSON.parse(readFileSync(path.join(plainDir, 'netsuite-api.config.json'), 'utf8')).jobRuns, { recordType: 'customrecord_plain_job_run', fieldPrefix: 'custrecord_plain_jr', extraFields: {} }, '--jobs names the run record in the generator config');
assertEqual(existsSync(path.join(plainDir, 'probity.config.ts')), false, 'default scaffold has no probity.config.ts');
const plainSettings = JSON.parse(readFileSync(path.join(plainDir, '.claude', 'settings.json'), 'utf8'));
assertEqual(plainSettings.hooks.PreToolUse[0].hooks[0].command, 'node .claude/hooks/guardrails.mjs', 'default scaffold wires the guardrails hook in place of Probity');
assertEqual(plainSettings.hooks.PostToolUse[0].hooks[0].command, 'node .claude/hooks/checkWrittenFile.mjs', 'default scaffold checks each file Claude writes');
// The guardrails hook needs no install: it reads the tool call in front of it and answers.
const askGuardrails = (toolInput) => {
    const hookRun = spawnSync('node', ['.claude/hooks/guardrails.mjs'], { cwd: plainDir, input: JSON.stringify({ tool_input: toolInput }), encoding: 'utf8' });
    return hookRun.stdout ? JSON.parse(hookRun.stdout).hookSpecificOutput.permissionDecision : `allow (exit ${hookRun.status})`;
};
assertEqual(askGuardrails({ file_path: path.join(plainDir, 'client', 'src', 'api', 'user.gen.ts'), content: '' }), 'deny', 'guardrails refuses a write to generated output');
assertEqual(askGuardrails({ file_path: path.join(plainDir, 'api', 'src', 'services', 'user.test.ts'), content: '' }), 'deny', 'guardrails refuses a test beside its source');
assertEqual(askGuardrails({ command: 'git push --force origin main' }), 'deny', 'guardrails refuses a force push without lease');
assertEqual(askGuardrails({ command: 'npm run deploy' }), 'ask', 'guardrails asks the person before a deploy');
assertEqual(askGuardrails({ file_path: path.join(plainDir, 'api', 'src', 'services', 'userService.ts'), content: 'export {};' }), 'allow (exit 0)', 'guardrails lets an ordinary write through');
assertEqual(JSON.parse(readFileSync(path.join(plainDir, 'package.json'), 'utf8')).devDependencies['@nizos/probity'], undefined, 'default scaffold does not depend on probity');
assertEqual(JSON.parse(readFileSync(path.join(plainDir, '.netsuite-project.json'), 'utf8')).features, { performanceTracker: false, probity: false, netsuiteApi: true, netsuiteRepository: true }, 'features recorded, both packages on by default');
const plainWrapperConfigSource = readFileSync(path.join(plainDir, 'api', 'netsuite-wrapper.config.js'), 'utf8');
assertEqual(plainWrapperConfigSource.includes('telemetryBootstrap: false') && !plainWrapperConfigSource.includes("scopeKey: 'app:"), true, 'default scaffold renders the wrapper config with telemetry off');
assertEqual(existsSync(path.join(plainDir, 'template.json')), false, 'template manifest is not copied');
rmSync(plainDir, { recursive: true, force: true });

for (const [packageName, tarballPath] of Object.entries(packageTarballs)) {
    if (tarballPath) usePackageTarball(projectDir, packageName, tarballPath);
}
run('npm', ['install', '--no-audit', '--no-fund'], projectDir);
run('npm', ['run', 'generate'], projectDir);
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'types', 'models.gen.ts')), true, 'generate writes the entity types into api/src/types');
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'repositories', 'generated', 'context.gen.ts')), true, 'generate writes the context into api');
const clientIndex = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'index.gen.ts'), 'utf8');
assertEqual(clientIndex.includes("export * as user from './user.gen';") && clientIndex.includes("export * as userRoles from './userRoles.gen';"), true, 'generate re-exports every controller module from the client index');
const userModule = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'user.gen.ts'), 'utf8');
assertEqual(userModule.includes("const userScriptRef: ScriptRef = { kind: 'restlet', scriptId: 'customscript_demo_user', deployId: 'customdeploy_demo_user' };"), true, 'generate writes the user script from the controller\'s declaration');
assertEqual(userModule.includes("    roles: (options?: ApiCallOptions): Promise<RolesResponse> => callEndpoint<RolesResponse>(userScriptRef, 'roles', {}, options),"), true, 'generate writes one client function per endpoint, calling callEndpoint with the user script');
assertEqual(userModule.includes("export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;") && userModule.includes('export interface EmployeeRole {'), true, 'generate copies the service type the controller names, and the entity type it is built on, into its module');
const userRolesModule = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'userRoles.gen.ts'), 'utf8');
assertEqual(userRolesModule.includes('export const api'), false, 'generate writes no client for the server-only userRoles Suitelet');
assertEqual(userRolesModule.includes('export interface EmployeeRole {'), true, 'generate copies the entity type the controller names into its module');
assertEqual(existsSync(path.join(projectDir, 'client', 'src', 'app.gen.ts')), false, 'generate writes no copy of netsuite.ts; the client imports the root file directly');
assertEqual(readdirSync(path.join(projectDir, 'client', 'src', 'api')).sort(), ['index.gen.ts', 'user.gen.ts', 'userRoles.gen.ts'], 'the client api directory holds the controller modules and the index only');
const scriptsModule = readFileSync(path.join(projectDir, 'api', 'src', 'scripts.gen.ts'), 'utf8');
assertEqual(scriptsModule.includes("userRoles: { kind: 'suitelet', scriptId: 'customscript_demo_user_roles', deployId: 'customdeploy_demo_user_roles', browser: false },"), true, 'generate writes the scripts map into api/src');
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'lint'], projectDir);
// The hook that checks each file Claude writes: silent on a file that meets the standards, and naming both an
// ESLint rule and an agent standard in one that breaks them.
const checkWrittenFile = (relativePath) => spawnSync('node', ['.claude/hooks/checkWrittenFile.mjs'], { cwd: projectDir, input: JSON.stringify({ tool_input: { file_path: path.join(projectDir, relativePath) } }), encoding: 'utf8' });
assertEqual(checkWrittenFile('api/src/services/userService.ts').status, 0, 'checkWrittenFile passes a service that meets the standards');
const strayServicePath = path.join(projectDir, 'api', 'src', 'services', 'strayService.ts');
writeFileSync(strayServicePath, "import * as record from 'N/record';\nimport { readActiveUser } from '../repositories/activeUserRepository';\n\nexport function getStray(): unknown {\n    return [record, readActiveUser];\n}\n");
const strayCheck = checkWrittenFile('api/src/services/strayService.ts');
rmSync(strayServicePath);
assertEqual(strayCheck.status, 2, 'checkWrittenFile hands the problems back to Claude');
assertEqual([/Only a repository touches NetSuite/.test(strayCheck.stderr), /Import a repository as a namespace/.test(strayCheck.stderr)], [true, true], 'checkWrittenFile reports the ESLint rule and the agent standard');
// lib/ is imported by every layer, so it imports nothing of NetSuite or of this application.
assertEqual(checkWrittenFile('api/src/lib/errors.ts').status, 0, 'checkWrittenFile passes a lib file that imports nothing');
const strayLibPath = path.join(projectDir, 'api', 'src', 'lib', 'strayHelpers.ts');
writeFileSync(strayLibPath, "import * as runtime from 'N/runtime';\nimport { readActiveUser } from '../repositories/activeUserRepository';\nimport { app } from '../../../netsuite';\n\nexport function describeStray(): unknown {\n    return [runtime, readActiveUser, app];\n}\n");
const strayLibCheck = checkWrittenFile('api/src/lib/strayHelpers.ts');
rmSync(strayLibPath);
assertEqual(
    [/lib\/ never touches NetSuite/.test(strayLibCheck.stderr), /lib\/ imports only other lib\/ files/.test(strayLibCheck.stderr), /lib\/ knows nothing of this application/.test(strayLibCheck.stderr)],
    [true, true, true],
    'ESLint keeps lib/ off NetSuite, the layers and netsuite.ts',
);
run('npm', ['test'], projectDir);
run('npm', ['run', 'build'], projectDir);

const fileCabinet = path.join(projectDir, 'netsuite', 'FileCabinet', 'SuiteScripts', 'DemoApp');
assertEqual(listFiles(fileCabinet), [
    'api/_host/homeController.js',
    'api/_host/host.js',
    'api/controllers/userController.js',
    'api/controllers/userRolesController.js',
    'client/app.js',
], 'File Cabinet output after first build');
for (const apiFile of listFiles(path.join(fileCabinet, 'api'))) assertBanner(path.join(fileCabinet, 'api', apiFile));

// With the tracker on, the built Restlet must be a tracked entry (its defineRestlet result wrapped),
// carry the app scope key, register the record exporter from the bootstrap, and capture arguments.
const builtUserController = readFileSync(path.join(fileCabinet, 'api', 'controllers', 'userController.js'), 'utf8');
assertEqual(builtUserController.includes('wrapTrackedScriptEntryFunction'), true, 'built controller wraps its defineRestlet entry as a tracked entry');
assertEqual(builtUserController.includes('scopeKey: "app:demo-app"'), true, 'built controller carries the scope key from netsuite-wrapper.config.js');
assertEqual(builtUserController.includes('createNetSuiteRecordExporter'), true, 'built controller registers the record exporter');
assertEqual(builtUserController.includes('createHttpsExporter('), false, 'built controller registers no HTTPS exporter until one is configured');
assertEqual(builtUserController.includes('parameterNames:'), true, 'built controller captures function parameter names');

// Each side's build must leave the other's output alone.
const clientBundleBefore = statSync(path.join(fileCabinet, 'client', 'app.js')).mtimeMs;
run('npm', ['run', 'build', '-w', 'api'], projectDir);
assertEqual(statSync(path.join(fileCabinet, 'client', 'app.js')).mtimeMs, clientBundleBefore, 'api build leaves client/app.js untouched');
const homeBefore = statSync(path.join(fileCabinet, 'api', '_host', 'homeController.js')).mtimeMs;
run('npm', ['run', 'build', '-w', 'client'], projectDir);
assertEqual(statSync(path.join(fileCabinet, 'api', '_host', 'homeController.js')).mtimeMs, homeBefore, 'client build leaves api/ untouched');

// The deploy script must stop before building or touching NetSuite when no account is selected.
const deployAttempt = spawnSync('node', ['scripts/deploy.mjs'], { cwd: projectDir, encoding: 'utf8', shell: isWindows });
assertEqual(deployAttempt.status, 1, 'deploy refuses without project.json');
assertEqual(/No project.json/.test(deployAttempt.stderr), true, 'deploy names the missing account selection');

const leftoverTokens = listFiles(projectDir)
    .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('netsuite/FileCabinet/'))
    .filter((file) => /\.(ts|tsx|mts|js|cjs|mjs|json|md|xml|css|html|example|code-snippets)$/.test(file) || file === '.gitignore' || file === '.npmrc')
    .filter((file) => readFileSync(path.join(projectDir, file), 'utf8').includes('{{'));
assertEqual(leftoverTokens, [], 'no template tokens left behind');

// Jobs are opt-in: a scaffold has none until `npm run add:jobs`, which adds the run record, the script that
// clears old runs, and what a page follows a run with. It must be safe to run twice, and what it adds must
// generate, lint and build like anything else.
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'jobs')), false, 'a scaffold without --jobs has no jobs folder');
run('npm', ['run', 'add:jobs'], projectDir);
assertEqual(existsSync(path.join(projectDir, 'netsuite', 'Objects', 'customrecord_demo_job_run.xml')), true, 'add:jobs writes the run record object');
assertEqual(JSON.parse(readFileSync(path.join(projectDir, 'netsuite-api.config.json'), 'utf8')).jobRuns.recordType, 'customrecord_demo_job_run', 'add:jobs names the run record in the generator config');
const addJobsAgain = spawnSync('npm', ['run', 'add:jobs'], { cwd: projectDir, encoding: 'utf8', shell: isWindows });
assertEqual(/already set up/.test(addJobsAgain.stdout), true, 'add:jobs run a second time adds nothing');
run('npm', ['run', 'generate'], projectDir);
const scriptsModuleWithJobs = readFileSync(path.join(projectDir, 'api', 'src', 'scripts.gen.ts'), 'utf8');
// A job's own ids are written by hand in netsuite.ts, so the generated scripts map carries the run record and no job.
assertEqual(scriptsModuleWithJobs.includes('customscript_demo_job_cleanup_mr'), false, 'the scripts map carries no job ids');
assertEqual(scriptsModuleWithJobs.includes("recordType: 'customrecord_demo_job_run',"), true, 'generate writes the run record ids next to the scripts');
const netsuiteModuleWithJobs = readFileSync(path.join(projectDir, 'netsuite.ts'), 'utf8');
assertEqual(netsuiteModuleWithJobs.includes("scriptId: 'customscript_demo_job_cleanup_mr',"), true, 'add:jobs writes the cleanup job\'s ids into netsuite.ts');
assertEqual(netsuiteModuleWithJobs.includes("runParameter: 'custscript_demo_job_cleanup_run',"), true, 'a job\'s run parameter is written with its ids');
assertEqual(readFileSync(path.join(projectDir, 'client', 'src', 'api', 'jobs.gen.ts'), 'utf8').includes("export * as jobRunCleanup from './jobRunCleanupJob.gen';"), true, 'generate re-exports every job module under jobs');
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'lint'], projectDir);
run('npm', ['run', 'build', '-w', 'api'], projectDir);
assertEqual(existsSync(path.join(fileCabinet, 'api', 'jobs', 'jobRunCleanup', 'jobRunCleanup.js')), true, 'the cleanup job is built into the File Cabinet');
assertBanner(path.join(fileCabinet, 'api', 'jobs', 'jobRunCleanup', 'jobRunCleanup.js'));

// Every VS Code snippet, expanded into this scaffold as one coherent addition, must generate, typecheck and pass
// the structure check (scripts/checkSnippets.mjs); the check restores the scaffold afterwards.
run('node', [path.join(templatesRoot, 'scripts', 'checkSnippets.mjs'), '--project', projectDir], templatesRoot);

// Every worked example under react-app/how-to-use/, written into this scaffold in the order they build on one another,
// must generate, typecheck, lint, test and build (scripts/checkHowToUse.mjs); the check restores the scaffold afterwards.
run('node', [path.join(templatesRoot, 'scripts', 'checkHowToUse.mjs'), '--project', projectDir], templatesRoot);

// Either package can be left out. The project keeps the folders and the host page, and loses everything built on the
// package: the example (which needs both), its generator, its config, its lint rules, its docs and its snippets. Each
// variant must still install, typecheck, lint, test and build, and no file may still name the package it left out.
const withoutPackagesVariants = [
    { name: 'NoApiApp', flags: ['--no-netsuite-api'], netsuiteApi: false, netsuiteRepository: true, generate: 'npm run generate -w api' },
    { name: 'NoRepositoryApp', flags: ['--no-netsuite-repository'], netsuiteApi: true, netsuiteRepository: false, generate: 'netsuite-api generate' },
    { name: 'NoPackagesApp', flags: ['--no-netsuite-api', '--no-netsuite-repository'], netsuiteApi: false, netsuiteRepository: false, generate: undefined },
];
const jobsWithoutApi = spawnSync(cliCommand[0], [...cliCommand.slice(1), path.join(e2eRoot, 'JobsWithoutApiApp'), '--local-template', templateDir, '--prefix', 'nojobs', '--author', 'ci', '--no-netsuite-api', '--jobs', '--yes', '--no-install', '--no-git'].map(quoteForShell), { cwd: templatesRoot, encoding: 'utf8', shell: isWindows });
assertEqual([jobsWithoutApi.status, existsSync(path.join(e2eRoot, 'JobsWithoutApiApp'))], [1, false], '--jobs with --no-netsuite-api is refused before anything is written');
for (const variant of withoutPackagesVariants) {
    const variantDir = path.join(e2eRoot, variant.name);
    if (existsSync(variantDir)) rmSync(variantDir, { recursive: true, force: true });
    runCli([variantDir, '--local-template', templateDir, '--prefix', 'bare', '--author', 'ci', ...variant.flags, '--yes', '--no-install', '--no-git'], templatesRoot);
    const variantFileExists = (relativePath) => existsSync(path.join(variantDir, relativePath));
    const label = variant.name;
    assertEqual(JSON.parse(readFileSync(path.join(variantDir, '.netsuite-project.json'), 'utf8')).features, { performanceTracker: false, probity: false, netsuiteApi: variant.netsuiteApi, netsuiteRepository: variant.netsuiteRepository }, `${label}: features recorded`);
    assertEqual(['api/src/controllers/userController.ts', 'api/src/services/userService.ts', 'client/src/pages/UserRolesPage.tsx', 'netsuite/Objects/customscript_bare_user.xml'].map(variantFileExists), [false, false, false, false], `${label}: the user/userRoles example is left out`);
    assertEqual(['api/src/controllers/.gitkeep', 'api/src/services/.gitkeep', 'api/src/repositories/.gitkeep', 'client/src/hooks/.gitkeep', 'client/src/pages/.gitkeep'].map(variantFileExists), [true, true, true, true, true], `${label}: the layer folders are kept`);
    assertEqual(['netsuite-api.config.json', 'scripts/addJobs.mjs', 'client/src/hooks/useApiErrors.ts', 'how-to-use/controllers', '.claude/rules/controllers.md'].map(variantFileExists), Array(5).fill(variant.netsuiteApi), `${label}: what netsuite-api brings is there only with it`);
    assertEqual(variantFileExists('api/src/_host/fileCabinet.ts'), !variant.netsuiteApi, `${label}: the host page finds the bundle with a File Cabinet lookup of its own only without netsuite-api`);
    assertEqual(['api/netsuite-repository.config.json', 'api/src/models/.gitkeep', 'api/src/specifications/.gitkeep', 'how-to-use/repositories'].map(variantFileExists), Array(4).fill(variant.netsuiteRepository), `${label}: what netsuite-repository brings is there only with it`);
    const variantManifest = JSON.parse(readFileSync(path.join(variantDir, 'package.json'), 'utf8'));
    assertEqual(variantManifest.scripts.generate, variant.generate, `${label}: npm run generate runs only the generators of the packages it has`);
    assertEqual(variantManifest.scripts['add:jobs'] !== undefined, variant.netsuiteApi, `${label}: add:jobs only with netsuite-api`);
    const variantDependencies = { ...JSON.parse(readFileSync(path.join(variantDir, 'api', 'package.json'), 'utf8')).dependencies, ...JSON.parse(readFileSync(path.join(variantDir, 'client', 'package.json'), 'utf8')).dependencies };
    assertEqual([variantDependencies['@amerilux/netsuite-api'] !== undefined, variantDependencies['@amerilux/netsuite-repository'] !== undefined], [variant.netsuiteApi, variant.netsuiteRepository], `${label}: depends on the packages it has only`);
    const leftOutPackageNames = [...(variant.netsuiteApi ? [] : ['netsuite-api']), ...(variant.netsuiteRepository ? [] : ['netsuite-repository'])];
    const filesNamingLeftOutPackages = listFiles(variantDir).filter((file) => leftOutPackageNames.some((packageName) => readFileSync(path.join(variantDir, file), 'utf8').includes(packageName)));
    assertEqual(filesNamingLeftOutPackages, [], `${label}: no file names ${leftOutPackageNames.join(' or ')}`);
    for (const [packageName, tarballPath] of Object.entries(packageTarballs)) {
        if (tarballPath) usePackageTarball(variantDir, packageName, tarballPath);
    }
    run('npm', ['install', '--no-audit', '--no-fund'], variantDir);
    if (variant.generate) run('npm', ['run', 'generate'], variantDir);
    run('npm', ['run', 'typecheck'], variantDir);
    run('npm', ['run', 'lint'], variantDir);
    run('npm', ['test'], variantDir);
    run('npm', ['run', 'build'], variantDir);
    assertEqual(listFiles(path.join(variantDir, 'netsuite', 'FileCabinet', 'SuiteScripts', variant.name)), ['api/_host/homeController.js', 'api/_host/host.js', 'client/app.js'], `${label}: File Cabinet output is the host page and the client bundle`);
    if (!keep) rmSync(variantDir, { recursive: true, force: true });
}

if (!keep) rmSync(projectDir, { recursive: true, force: true });
console.log('\nEnd-to-end scaffold check passed.');
