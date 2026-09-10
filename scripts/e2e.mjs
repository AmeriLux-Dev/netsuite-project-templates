#!/usr/bin/env node
/**
 * End-to-end check of the react-app template: scaffold DemoApp into the OS temp directory with the
 * CLI, install, generate, typecheck, lint, test, build, add a controller, build again, and assert
 * the File Cabinet output is exactly what the CLI README promises.
 *
 * The scratch project lives outside the repository on purpose: nested inside it, its tests would
 * resolve a second copy of vitest from a parent node_modules.
 *
 *   node scripts/e2e.mjs --cli ../create-netsuite-project   # a CLI checkout (its dist/index.js must be built) or the entry file itself
 *   node scripts/e2e.mjs                                     # the published CLI, through npx create-netsuite-project@latest
 *   node scripts/e2e.mjs --keep                              # leave the scratch project in place for inspection
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
console.log(`Scratch project: ${projectDir}`);
console.log(`CLI: ${cliCommand.join(' ')}`);

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

run('npm', ['install', '--no-audit', '--no-fund'], projectDir);
run('npm', ['run', 'generate'], projectDir);
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'lint'], projectDir);
run('npm', ['test'], projectDir);
run('npm', ['run', 'build'], projectDir);

const fileCabinet = path.join(projectDir, 'netsuite', 'FileCabinet', 'SuiteScripts', 'DemoApp');
assertEqual(listFiles(fileCabinet), [
    'api/controllers/customers/customersController.js',
    'api/host/homeController.js',
    'api/host/host.js',
    'client/app.js',
], 'File Cabinet output after first build');
for (const apiFile of listFiles(path.join(fileCabinet, 'api'))) assertBanner(path.join(fileCabinet, 'api', apiFile));

// Each side's build must leave the other's output alone.
const clientBundleBefore = statSync(path.join(fileCabinet, 'client', 'app.js')).mtimeMs;
run('npm', ['run', 'build', '-w', 'api'], projectDir);
assertEqual(statSync(path.join(fileCabinet, 'client', 'app.js')).mtimeMs, clientBundleBefore, 'api build leaves client/app.js untouched');
const homeBefore = statSync(path.join(fileCabinet, 'api', 'host', 'homeController.js')).mtimeMs;
run('npm', ['run', 'build', '-w', 'client'], projectDir);
assertEqual(statSync(path.join(fileCabinet, 'api', 'host', 'homeController.js')).mtimeMs, homeBefore, 'client build leaves api/ untouched');

// add controller through the CLI, then the new restlet must show up in the bundle set.
runCli(['add', 'controller', 'orders', '--methods', 'get,post'], projectDir);
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'lint'], projectDir);
run('npm', ['run', 'build', '-w', 'api'], projectDir);
assertEqual(listFiles(path.join(fileCabinet, 'api')), [
    'controllers/customers/customersController.js',
    'controllers/orders/ordersController.js',
    'host/homeController.js',
    'host/host.js',
], 'api output after add controller');
assertEqual(existsSync(path.join(projectDir, 'api', 'src', 'controllers', 'orders', 'endpoints', 'postOrders.ts')), true, 'orders endpoints written');

// A suitelet-backed controller shares the endpoint shape and must build and typecheck the same way.
runCli(['add', 'controller', 'reports', '--suitelet'], projectDir);
run('npm', ['run', 'typecheck'], projectDir);
run('npm', ['run', 'build', '-w', 'api'], projectDir);
assertEqual(existsSync(path.join(fileCabinet, 'api', 'controllers', 'reports', 'reportsController.js')), true, 'suitelet controller built');
assertEqual(/@NScriptType Suitelet/.test(readFileSync(path.join(fileCabinet, 'api', 'controllers', 'reports', 'reportsController.js'), 'utf8').slice(0, 200)), true, 'suitelet banner');
assertEqual(existsSync(path.join(projectDir, 'netsuite', 'Objects', 'customscript_demo_orders.xml')), true, 'orders SDF object written');
assertEqual(readFileSync(path.join(projectDir, 'common', 'netsuite.ts'), 'utf8').includes("orders: { kind: 'restlet', scriptId: 'customscript_demo_orders'"), true, 'scripts.orders registered');
assertEqual(readFileSync(path.join(projectDir, 'common', 'netsuite.ts'), 'utf8').includes("reports: { kind: 'suitelet', scriptId: 'customscript_demo_reports'"), true, 'scripts.reports registered as suitelet');

// The deploy script must refuse while the example controller is present, without touching NetSuite.
mkdirSync(path.join(projectDir, 'netsuite'), { recursive: true });
const projectJsonPath = path.join(projectDir, 'project.json');
writeFileSync(projectJsonPath, JSON.stringify({ defaultAuthId: 'placeholder' }));
const deployAttempt = spawnSync('node', ['scripts/deploy.mjs'], { cwd: projectDir, encoding: 'utf8', shell: isWindows });
assertEqual(deployAttempt.status, 1, 'deploy refuses while the example is present');
assertEqual(/Refusing to deploy/.test(deployAttempt.stderr), true, 'deploy names the example files');
rmSync(projectJsonPath);

const leftoverTokens = listFiles(projectDir)
    .filter((file) => !file.startsWith('node_modules/') && !file.startsWith('netsuite/FileCabinet/'))
    .filter((file) => /\.(ts|tsx|js|cjs|mjs|json|md|xml|css|html|example)$/.test(file) || file === '.gitignore' || file === '.npmrc')
    .filter((file) => readFileSync(path.join(projectDir, file), 'utf8').includes('{{'));
assertEqual(leftoverTokens, [], 'no template tokens left behind');

if (!keep) rmSync(projectDir, { recursive: true, force: true });
console.log('\nEnd-to-end scaffold check passed.');
