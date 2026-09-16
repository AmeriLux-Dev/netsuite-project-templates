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
 *   node scripts/e2e.mjs --netsuite-api ../netsuite-api/amerilux-netsuite-api-0.1.0.tgz
 *                                                            # install @amerilux/netsuite-api from a packed tarball (npm pack in its checkout)
 *                                                            # instead of the registry, to check the template against an unpublished version
 *   node scripts/e2e.mjs --netsuite-wrapper ../netsuite-wrapper/amerilux-netsuite-wrapper-0.4.0.tgz
 *                                                            # the same for @amerilux/netsuite-wrapper
 *
 * The main scaffold is built with --performance-tracker so the wrapper's instrumentation, telemetry
 * bootstrap and entry wrapping run through a real webpack build; the plain variant checks the flag off.
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
assertEqual(JSON.parse(readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8')).hooks !== undefined, true, '--probity wires the Claude Code hook');
assertEqual(JSON.parse(readFileSync(path.join(projectDir, '.netsuite-project.json'), 'utf8')).features, { performanceTracker: true, probity: true }, 'features recorded with both flags on');
const wrapperConfigSource = readFileSync(path.join(projectDir, 'api', 'netsuite-wrapper.config.js'), 'utf8');
assertEqual(wrapperConfigSource.includes("integration: 'performance-tracker'") && wrapperConfigSource.includes("scopeKey: 'app:demo-app'") && wrapperConfigSource.includes('instrumentation: true'), true, '--performance-tracker renders the wrapper config with the app scope key');
assertEqual(wrapperConfigSource.includes('telemetryBootstrap: false'), false, '--performance-tracker drops the telemetry-off branch');

// The default (no Probity) variant must render cleanly too; it is checked without an install.
const plainDir = path.join(e2eRoot, 'PlainApp');
if (existsSync(plainDir)) rmSync(plainDir, { recursive: true, force: true });
runCli([
    plainDir,
    '--local-template', templateDir,
    '--prefix', 'plain', '--author', 'ci', '--yes', '--no-install', '--no-git',
], templatesRoot);
assertEqual(existsSync(path.join(plainDir, 'probity.config.ts')), false, 'default scaffold has no probity.config.ts');
const plainSettings = JSON.parse(readFileSync(path.join(plainDir, '.claude', 'settings.json'), 'utf8'));
assertEqual(plainSettings.hooks, undefined, 'default scaffold has no hook');
assertEqual(JSON.parse(readFileSync(path.join(plainDir, 'package.json'), 'utf8')).devDependencies['@nizos/probity'], undefined, 'default scaffold does not depend on probity');
assertEqual(JSON.parse(readFileSync(path.join(plainDir, '.netsuite-project.json'), 'utf8')).features, { performanceTracker: false, probity: false }, 'features recorded');
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
assertEqual(/export const api = createApiClient<Endpoints>\(\{ kind: 'restlet', scriptId: 'customscript_demo_user', deployId: 'customdeploy_demo_user' \}\);/.test(userModule), true, 'generate writes the user client from the controller\'s declaration');
assertEqual(userModule.includes("export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;") && userModule.includes('export interface EmployeeRole {'), true, 'generate copies the service type the controller names, and the entity type it is built on, into its module');
const userRolesModule = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'userRoles.gen.ts'), 'utf8');
assertEqual(userRolesModule.includes('createApiClient'), false, 'generate writes no client for the server-only userRoles Suitelet');
assertEqual(userRolesModule.includes('export interface EmployeeRole {'), true, 'generate copies the entity type the controller names into its module');
assertEqual(existsSync(path.join(projectDir, 'client', 'src', 'app.gen.ts')), false, 'generate writes no copy of netsuite.ts; the client imports the root file directly');
assertEqual(readdirSync(path.join(projectDir, 'client', 'src', 'api')).sort(), ['index.gen.ts', 'user.gen.ts', 'userRoles.gen.ts'], 'the client api directory holds the controller modules and the index only');
const scriptsModule = readFileSync(path.join(projectDir, 'api', 'src', 'scripts.gen.ts'), 'utf8');
assertEqual(scriptsModule.includes("userRoles: { kind: 'suitelet', scriptId: 'customscript_demo_user_roles', deployId: 'customdeploy_demo_user_roles', browser: false },"), true, 'generate writes the scripts map into api/src');
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'lint'], projectDir);
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
    .filter((file) => /\.(ts|tsx|js|cjs|mjs|json|md|xml|css|html|example|code-snippets)$/.test(file) || file === '.gitignore' || file === '.npmrc')
    .filter((file) => readFileSync(path.join(projectDir, file), 'utf8').includes('{{'));
assertEqual(leftoverTokens, [], 'no template tokens left behind');

if (!keep) rmSync(projectDir, { recursive: true, force: true });
console.log('\nEnd-to-end scaffold check passed.');
