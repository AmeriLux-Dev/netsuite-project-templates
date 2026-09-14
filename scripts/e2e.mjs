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
const netsuiteApiTarball = resolveNetsuiteApiTarball(process.argv);
console.log(`Scratch project: ${projectDir}`);
console.log(`CLI: ${cliCommand.join(' ')}`);
if (netsuiteApiTarball) console.log(`@amerilux/netsuite-api: ${netsuiteApiTarball}`);

/** `--netsuite-api <path>` names a packed tarball of @amerilux/netsuite-api to install instead of the registry version. */
function resolveNetsuiteApiTarball(argv) {
    const flagIndex = argv.indexOf('--netsuite-api');
    if (flagIndex === -1) return undefined;
    const tarballPath = argv[flagIndex + 1];
    if (!tarballPath || tarballPath.startsWith('--') || !tarballPath.endsWith('.tgz')) {
        console.error('--netsuite-api needs the path of a .tgz from `npm pack` in the netsuite-api checkout.');
        process.exit(1);
    }
    const resolvedPath = path.resolve(tarballPath);
    if (!existsSync(resolvedPath)) {
        console.error(`Tarball not found at ${resolvedPath}.`);
        process.exit(1);
    }
    return resolvedPath;
}

/** Points every workspace that depends on @amerilux/netsuite-api at the tarball, so npm install never asks the registry for it. */
function useNetsuiteApiTarball(directory, tarballPath) {
    const specifier = `file:${tarballPath.split(path.sep).join('/')}`;
    for (const workspace of ['api', 'client']) {
        const manifestPath = path.join(directory, workspace, 'package.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        if (manifest.dependencies?.['@amerilux/netsuite-api'] === undefined) continue;
        manifest.dependencies['@amerilux/netsuite-api'] = specifier;
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
    '--probity', '--yes', '--no-install', '--no-git',
], templatesRoot);
assertEqual(existsSync(path.join(projectDir, 'probity.config.ts')), true, '--probity emits probity.config.ts');
assertEqual(JSON.parse(readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8')).hooks !== undefined, true, '--probity wires the Claude Code hook');

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
assertEqual(existsSync(path.join(plainDir, 'template.json')), false, 'template manifest is not copied');
rmSync(plainDir, { recursive: true, force: true });

if (netsuiteApiTarball) useNetsuiteApiTarball(projectDir, netsuiteApiTarball);
run('npm', ['install', '--no-audit', '--no-fund'], projectDir);
run('npm', ['run', 'generate'], projectDir);
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'types', 'models.gen.ts')), true, 'generate writes the entity types into api/src/types');
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'repositories', 'generated', 'context.gen.ts')), true, 'generate writes the context into api');
const clientIndex = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'index.gen.ts'), 'utf8');
assertEqual(clientIndex.includes("export * as user from './user.gen';") && clientIndex.includes("export * as userRoles from './userRoles.gen';"), true, 'generate re-exports every controller module from the client index');
const userModule = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'user.gen.ts'), 'utf8');
assertEqual(/export const api = createApiClient<Endpoints>\(\{ kind: 'restlet', scriptId: 'customscript_demo_user', deployId: 'customdeploy_demo_user' \}\);/.test(userModule), true, 'generate writes the user client from the controller\'s declaration');
assertEqual(userModule.includes("import type { RoleSummary } from './userRoles.gen';"), true, 'generate imports a sibling controller\'s type from its module');
const userRolesModule = readFileSync(path.join(projectDir, 'client', 'src', 'api', 'userRoles.gen.ts'), 'utf8');
assertEqual(userRolesModule.includes('createApiClient'), false, 'generate writes no client for the server-only userRoles Suitelet');
assertEqual(userRolesModule.includes('export interface EmployeeRole {'), true, 'generate copies the entity type the controller names into its module');
assertEqual(readFileSync(path.join(projectDir, 'client', 'src', 'app.gen.ts'), 'utf8').includes('export const app = {'), true, 'generate copies netsuite.ts into client/src/app.gen.ts');
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
    .filter((file) => /\.(ts|tsx|js|cjs|mjs|json|md|xml|css|html|example)$/.test(file) || file === '.gitignore' || file === '.npmrc')
    .filter((file) => readFileSync(path.join(projectDir, file), 'utf8').includes('{{'));
assertEqual(leftoverTokens, [], 'no template tokens left behind');

if (!keep) rmSync(projectDir, { recursive: true, force: true });
console.log('\nEnd-to-end scaffold check passed.');
