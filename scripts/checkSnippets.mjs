#!/usr/bin/env node
/**
 * Snippet check for the react-app template. Every snippet in react-app/.vscode/netsuite-project.code-snippets writes
 * a whole file with every option it offers, and is expanded the way VS Code would expand it (the file name in,
 * every tab stop filled with a sample value, nothing deleted) into an installed scaffold as one coherent addition:
 * an `orders` Restlet and an `orderTotals` Suitelet, the `SalesOrder` model, specification, repositories and
 * service behind them, their tests, a hook, a mutation, a page and a route, a job and two events. Then
 * `npm run generate`, the route tree generator, `npm run typecheck` (tsc in every workspace, tests included) and the
 * structure check run over the result. ESLint is not run: the check proves that the snippets compile and fit
 * together, which is what a stale snippet breaks first.
 *
 * Every snippet must have a step in the scenario below; a snippet without one fails the check, so a snippet
 * cannot be added without saying what it is supposed to produce.
 *
 *   node scripts/checkSnippets.mjs --project <dir>              # an installed scaffold (the e2e passes its own)
 *   node scripts/checkSnippets.mjs --project <dir> --keep       # leave the expanded files in place for inspection
 *   node scripts/checkSnippets.mjs --project <dir> --snippets <file>
 *                                                               # default: react-app/.vscode/netsuite-project.code-snippets
 *
 * The files the check writes are removed afterwards (edited files restored, the generated modules refreshed),
 * so the scaffold is left as it was found.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandSnippet } from './snippetExpansion.mjs';

const templatesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

// ── the scenario: what a developer would type ─────────────────────────────────────────────────────────────────────

/**
 * One coherent addition to the scaffold, built from every snippet. Every snippet writes a whole file, and a `file`
 * step expands one into a new file (its name is what VS Code derives the names from), keeping everything it offers:
 * the check proves the full page compiles as written, and a developer deletes what the file does not need. An
 * `edit` step is what the developer would write by hand (a job's ids in netsuite.ts, the service functions a job
 * calls). A `run` step runs one of the project's npm scripts, for a setup step the snippets assume has happened
 * (`add:jobs`); what it creates is named in `creates`, so the restore takes those files away again. Paths and values
 * may carry the template tokens {{prefix}}, {{appName}} and {{appTitle}}; they are rendered from the scaffold's
 * netsuite.ts. The defaults line up across the chain (model, specifications, repository, service, controller, tests),
 * so most steps give only what the file name cannot say.
 */
const scenario = [
    // The record behind everything, with every decorator. Its reference points at the scaffold's own EmployeeRole,
    // so the scenario needs no second record; an abstract base beside it.
    { snippet: 'nspModel', file: 'api/src/models/SalesOrder.ts', values: { 1: 'EmployeeRole', 7: 'roleId', 8: 'roleName', 9: 'one sales order' } },
    { snippet: 'nspModelBase', file: 'api/src/models/TransactionBase.ts' },

    // Its query vocabulary and its repository over dbContext, every builder and every set method; a repository over a
    // NetSuite module.
    { snippet: 'nspSpecification', file: 'api/src/specifications/salesOrdersSpecifications.ts', values: { 2: 'sales orders' } },
    { snippet: 'nspRepository', file: 'api/src/repositories/salesOrdersRepository.ts', values: { 5: 'sales orders' } },
    { snippet: 'nspRepositoryModule', file: 'api/src/repositories/currentScriptRepository.ts', values: { 2: 'the running script', 3: 'CurrentScript', 4: 'id', 5: 'string', 6: 'readCurrentScript', 7: 'script', 8: 'getCurrentScript()', 9: 'script.id' } },

    // The service both controllers call.
    { snippet: 'nspService', file: 'api/src/services/ordersService.ts', values: { 1: 'SalesOrder', 5: 'sales orders' } },

    // The orders Restlet, every kind of endpoint and authorize.
    { snippet: 'nspControllerRestlet', file: 'api/src/controllers/ordersController.ts', values: { 2: 'SalesOrder', 5: 'a customer\'s sales orders' } },
    { snippet: 'nspObjectRestlet', file: 'netsuite/Objects/customscript_{{prefix}}_orders.xml', values: { 1: 'Orders', 2: 'Lists a customer\'s sales orders' } },

    // The orderTotals Suitelet, with a file download, read by a repository through its Suitelet client.
    { snippet: 'nspControllerSuitelet', file: 'api/src/controllers/orderTotalsController.ts', values: { 1: 'orders', 2: 'SalesOrder', 5: 'order totals per customer' } },
    { snippet: 'nspObjectSuitelet', file: 'netsuite/Objects/customscript_{{prefix}}_order_totals.xml', values: { 1: 'Order Totals', 2: 'Totals per customer' } },
    { snippet: 'nspRepositorySuitelet', file: 'api/src/repositories/orderTotalsRepository.ts', values: { 1: 'ByCustomerResponse', 4: 'Order totals', 5: 'listOrderTotalsForCustomer', 6: 'customerId', 8: 'orderTotals', 9: 'byCustomer' } },

    // Tests, one per layer.
    { snippet: 'nspTestController', file: 'api/__tests__/controllers/ordersController.test.ts', values: { 2: 'SalesOrder' } },
    { snippet: 'nspTestService', file: 'api/__tests__/services/ordersService.test.ts', values: { 1: 'SalesOrder' } },
    { snippet: 'nspTestRepository', file: 'api/__tests__/repositories/salesOrdersRepository.test.ts' },
    { snippet: 'nspTestRepositorySuitelet', file: 'api/__tests__/repositories/orderTotalsRepository.test.ts', values: { 2: 'byCustomer', 3: 'listOrderTotalsForCustomer', 4: 'customerId', 5: 'orderTotals', 6: '[{ id: 1, customerId: 7, memo: null }]' } },
    { snippet: 'nspTestHook', file: 'client/__tests__/ordersQuery.test.ts', values: { 2: 'byCustomer', 3: '{ customerId: 7, orders: [] }', 4: 'ordersByCustomer', 6: '{ customerId: 7 }' } },

    // The client: a query hook, a mutation, a page and its route.
    { snippet: 'nspHookQuery', file: 'client/src/hooks/useOrdersByCustomer.ts', values: { 1: 'orders', 2: 'byCustomer', 3: 'customerId', 5: 'Every sales order of the customer' } },
    { snippet: 'nspHookMutation', file: 'client/src/hooks/useCreateOrder.ts', values: { 1: 'orders', 2: 'create', 3: 'Creates a sales order' } },
    { snippet: 'nspPage', file: 'client/src/pages/OrdersPage.tsx', values: { 1: 'useOrdersByCustomer', 2: 'useCreateOrder', 3: 'customerId', 5: "{ customerId, memo: '' }", 6: 'Orders', 7: 'The customer\'s sales orders' } },
    { snippet: 'nspRoute', file: 'client/src/routes/orders.$customerId.tsx' },

    // Jobs: the run machinery a project adds once, then a job, its object, and the file that starts it.
    {
        run: 'add:jobs',
        creates: [
            'netsuite/Objects/customrecord_{{prefix}}_job_run.xml',
            'netsuite/Objects/customscript_{{prefix}}_job_cleanup_mr.xml',
            'netsuite/Objects/customscript_{{prefix}}_job_runs.xml',
            'api/src/jobs/jobRunCleanup/jobRunCleanup.ts',
            'api/src/jobs/jobRunCleanup/contract.ts',
            'api/src/jobs/jobRunCleanup/getInputData.ts',
            'api/src/jobs/jobRunCleanup/map.ts',
            'api/src/jobs/jobRunCleanup/summarize.ts',
            'api/src/repositories/jobRunRepository.ts',
            'api/src/services/jobRunService.ts',
            'api/src/controllers/jobRunsController.ts',
            'client/src/hooks/useJobRun.ts',
            'netsuite-api.config.json',
        ],
    },
    // What the job's stages call. The shapes on either end of a run are the job's own, declared in the stage
    // that names them, so the service holds only the work.
    {
        edit: 'api/src/services/ordersService.ts',
        find: "export type SalesOrderSummary = Pick<SalesOrder, 'id' | 'customerId' | 'memo'>;",
        replace: [
            "export type SalesOrderSummary = Pick<SalesOrder, 'id' | 'customerId' | 'memo'>;",
            '',
            '/** The ids of the orders old enough to close. */',
            'export function listOldOrderIds(olderThanDays: number): number[] {',
            '    return olderThanDays > 0 ? [] : [];',
            '}',
            '',
            '/** Closes one order, and says whether it went. */',
            'export function closeOrder(orderId: number): boolean {',
            "    if (orderId <= 0) throw new Error('An order id is a positive number.');",
            '    return true;',
            '}',
        ].join('\n'),
    },
    // A job's ids are written by hand in netsuite.ts, beside the cleanup job add:jobs put there.
    {
        edit: 'netsuite.ts',
        find: '    jobRunCleanup: {',
        replace: [
            '    closeOldOrders: {',
            "        name: 'closeOldOrders',",
            "        scriptId: 'customscript_{{prefix}}_close_old_orders_mr',",
            "        deployments: ['customdeploy_{{prefix}}_close_old_orders_mr'],",
            "        runParameter: 'custscript_{{prefix}}_close_old_orders_run',",
            '    },',
            '    jobRunCleanup: {',
        ].join('\n'),
    },
    { snippet: 'nspJob', file: 'api/src/jobs/closeOldOrders/closeOldOrders.ts', values: { 1: 'closes sales orders older than a cutoff' } },
    // Every shape the run carries, in one file the stages all import from.
    {
        snippet: 'nspJobContract',
        file: 'api/src/jobs/closeOldOrders/contract.ts',
        values: {
            1: 'CloseOldOrdersRequest',
            2: 'olderThanDays',
            3: 'number',
            4: 'CloseOldOrdersItem',
            5: 'orderId',
            6: 'CloseOldOrdersOutcome',
            7: 'closed',
            8: 'CloseOldOrdersTally',
            9: 'handled',
            10: 'CloseOldOrdersResult',
            11: 'tallies',
        },
    },
    {
        snippet: 'nspJobGetInputData',
        file: 'api/src/jobs/closeOldOrders/getInputData.ts',
        values: { 1: 'listOldOrderIds', 2: 'services', 3: 'orders', 4: 'Service', 5: 'CloseOldOrdersItem', 6: 'CloseOldOrdersRequest', 7: 'The ids of the orders old enough to close', 8: 'closeOldOrders', 9: 'olderThanDays', 10: 'orderId' },
    },
    {
        snippet: 'nspJobMap',
        file: 'api/src/jobs/closeOldOrders/map.ts',
        values: { 1: 'closeOrder', 2: 'services', 3: 'orders', 4: 'Service', 5: 'CloseOldOrdersItem', 6: 'CloseOldOrdersOutcome', 7: 'Closes one order', 8: 'closeOldOrders', 9: 'orderId', 10: 'closed' },
    },
    // A reduce gathers what map wrote under one key, so what it writes is what summarize then reads.
    {
        snippet: 'nspJobReduce',
        file: 'api/src/jobs/closeOldOrders/reduce.ts',
        values: { 1: 'CloseOldOrdersOutcome', 2: 'CloseOldOrdersTally', 3: 'How many orders of one key were handled', 4: 'closeOldOrders', 5: 'outcomes', 6: 'handled' },
    },
    {
        snippet: 'nspJobSummarize',
        file: 'api/src/jobs/closeOldOrders/summarize.ts',
        values: { 1: 'CloseOldOrdersResult', 2: 'CloseOldOrdersTally', 3: 'closeOldOrders', 4: 'tallies', 5: 'handled' },
    },
    { snippet: 'nspObjectMapReduce', file: 'netsuite/Objects/customscript_{{prefix}}_close_old_orders_mr.xml', values: { 1: 'Close Old Orders', 2: 'Closes sales orders older than a cutoff' } },
    {
        snippet: 'nspJobStart',
        file: 'api/src/jobs/closeOldOrders/start.ts',
        values: { 1: 'CloseOldOrdersRequest', 2: 'ClosingOldOrders', 3: 'olderThanDays', 4: 'number', 5: 'closeOldOrders' },
    },

    // Events: self-contained SuiteScript, with no SDF object of their own.
    {
        snippet: 'nspUserEvent',
        file: 'api/src/events/user/salesOrder.ts',
        values: { 1: 'Sales Order', 2: 'memo', 3: 'memo', 4: 'countSalesOrdersByCustomer', 5: 'salesOrders', 6: 'Stamps the memo when a sales order is saved' },
    },
    { snippet: 'nspClientEvent', file: 'api/src/events/client/salesOrder.ts', values: { 1: 'sales order', 2: 'quantity', 3: 'quantity', 4: 'Checks the quantities on the lines' } },
];

// ── running it ───────────────────────────────────────────────────────────────────────────────────────────────────

function readFlag(flag) {
    const index = process.argv.indexOf(flag);
    return index === -1 ? undefined : process.argv[index + 1];
}

const projectDir = readFlag('--project') && path.resolve(readFlag('--project'));
const snippetsPath = path.resolve(readFlag('--snippets') ?? path.join(templatesRoot, 'react-app', '.vscode', 'netsuite-project.code-snippets'));
const keep = process.argv.includes('--keep');
if (!projectDir || !existsSync(path.join(projectDir, 'netsuite.ts')) || !existsSync(path.join(projectDir, 'node_modules'))) {
    console.error('--project must name an installed scaffold of the react-app template (netsuite.ts and node_modules present).');
    process.exit(1);
}

/** The template tokens the snippet file carries, rendered from the scaffold as the CLI rendered them. */
function readTemplateTokens() {
    const source = readFileSync(path.join(projectDir, 'netsuite.ts'), 'utf8');
    const read = (property) => source.match(new RegExp(`^\\s*${property}:\\s*'([^']*)'`, 'm'))?.[1];
    const tokens = { prefix: read('prefix'), appName: read('folder'), appTitle: read('title') };
    for (const [name, value] of Object.entries(tokens)) {
        if (!value) throw new Error(`Could not read ${name} from ${projectDir}/netsuite.ts.`);
    }
    return tokens;
}

const templateTokens = readTemplateTokens();
const renderTokens = (text) => text.replace(/\{\{(prefix|appName|appTitle)\}\}/g, (_, token) => templateTokens[token]);

const snippets = JSON.parse(readFileSync(snippetsPath, 'utf8').replace(/^﻿/, ''));
const snippetNames = Object.keys(snippets);
const scenarioSnippets = new Set(scenario.filter((step) => step.snippet).map((step) => step.snippet));
const uncovered = snippetNames.filter((name) => !scenarioSnippets.has(name));
const unknown = [...scenarioSnippets].filter((name) => !snippetNames.includes(name));
if (uncovered.length > 0 || unknown.length > 0) {
    if (uncovered.length > 0) console.error(`Snippets without a step in scripts/checkSnippets.mjs: ${uncovered.join(', ')}. Add a step so the check covers them.`);
    if (unknown.length > 0) console.error(`Steps naming snippets that do not exist: ${unknown.join(', ')}.`);
    process.exit(1);
}

/** Original contents of every file the scenario touches (undefined when the file did not exist), for the restore. */
const originals = new Map();
const routeTreePath = path.join(projectDir, 'client', 'src', 'routeTree.gen.ts');
// `netsuite-repository generate` writes a file per model and never deletes one, so the restore removes those the
// scenario's models caused; left behind, they name types models.gen.ts no longer has.
const repositoryGeneratedDir = path.join(projectDir, 'api', 'src', 'repositories', 'generated');
const repositoryGeneratedBefore = new Set(existsSync(repositoryGeneratedDir) ? readdirSync(repositoryGeneratedDir) : []);

function rememberOriginal(relativePath) {
    const absolutePath = path.join(projectDir, relativePath);
    if (!originals.has(relativePath)) originals.set(relativePath, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined);
}

function readProjectFile(relativePath) {
    return readFileSync(path.join(projectDir, relativePath), 'utf8');
}

function writeProjectFile(relativePath, content) {
    const absolutePath = path.join(projectDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
}

function expandStep(step, fileNameBase) {
    const snippet = snippets[step.snippet];
    const values = Object.fromEntries(Object.entries(step.values ?? {}).map(([index, value]) => [index, renderTokens(String(value))]));
    return expandSnippet(renderTokens(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body), { fileNameBase, values });
}

function applyStep(step) {
    if (step.run) {
        // Everything the script writes is remembered first, so the restore takes it away again.
        for (const created of step.creates) rememberOriginal(renderTokens(created));
        run('npm', ['run', step.run], projectDir);
        return `npm run ${step.run}`;
    }
    if (step.edit) {
        const relativePath = renderTokens(step.edit);
        rememberOriginal(relativePath);
        const source = readProjectFile(relativePath);
        const find = renderTokens(step.find);
        if (!source.includes(find)) throw new Error(`${relativePath}: expected to find ${JSON.stringify(find)} to edit.`);
        writeProjectFile(relativePath, source.replace(find, renderTokens(step.replace).replace(/\n/g, source.includes('\r\n') ? '\r\n' : '\n')));
        return `edited ${relativePath}`;
    }
    if (step.file) {
        const relativePath = renderTokens(step.file);
        if (existsSync(path.join(projectDir, relativePath))) throw new Error(`${relativePath} already exists; the scenario only writes new files.`);
        rememberOriginal(relativePath);
        const fileNameBase = path.basename(relativePath, path.extname(relativePath));
        writeProjectFile(relativePath, expandStep(step, fileNameBase));
        return `${step.snippet} -> ${relativePath}`;
    }
    throw new Error(`A step names neither file, edit nor run: ${JSON.stringify(step)}. Every snippet writes a whole file.`);
}

/** With shell:true (needed for npm's .cmd shim on Windows) arguments with spaces must be quoted by hand. */
function quoteForShell(argument) {
    return isWindows && /\s/.test(argument) ? `"${argument}"` : argument;
}

function run(command, args, cwd) {
    console.log(`\n> ${command} ${args.join(' ')}   (in ${path.relative(projectDir, cwd) || 'project'})`);
    const result = spawnSync(command, args.map(quoteForShell), { cwd, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status}).`);
}

/** Rewrites client/src/routeTree.gen.ts from client/src/routes, as the Vite plugin does on dev and build. */
function regenerateRouteTree() {
    const script = [
        "const { Generator, getConfig } = require('@tanstack/router-generator');",
        "const config = getConfig({ target: 'react', autoCodeSplitting: false, routesDirectory: 'src/routes', generatedRouteTree: 'src/routeTree.gen.ts', quoteStyle: 'single', semicolons: true }, process.cwd());",
        'new Generator({ config, root: process.cwd() }).run().catch((error) => { console.error(error); process.exit(1); });',
    ].join(' ');
    const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(projectDir, 'client'), stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Route tree generation failed.');
}

function restore() {
    const emptiedDirectories = new Set();
    for (const [relativePath, original] of originals) {
        const absolutePath = path.join(projectDir, relativePath);
        if (original === undefined) {
            rmSync(absolutePath, { force: true });
            emptiedDirectories.add(path.dirname(absolutePath));
        } else writeFileSync(absolutePath, original);
    }
    // A folder the scenario made goes with its files: an empty job folder is a job with no job in it, which
    // `npm run generate` reports, so leaving one behind would fail the check on its way out.
    for (const directory of [...emptiedDirectories].sort((left, right) => right.length - left.length)) {
        if (existsSync(directory) && readdirSync(directory).length === 0) rmSync(directory, { recursive: true, force: true });
    }
    if ([...originals.keys()].some((relativePath) => relativePath.startsWith('client/src/routes/')) && existsSync(routeTreePath)) regenerateRouteTree();
    run('npm', ['run', 'generate'], projectDir);
    for (const generatedFile of existsSync(repositoryGeneratedDir) ? readdirSync(repositoryGeneratedDir) : []) {
        if (!repositoryGeneratedBefore.has(generatedFile)) rmSync(path.join(repositoryGeneratedDir, generatedFile), { force: true });
    }
}

console.log(`Snippets: ${snippetsPath} (${snippetNames.length})`);
console.log(`Project:  ${projectDir} (prefix ${templateTokens.prefix}, folder ${templateTokens.appName})`);
let failed = false;
try {
    rememberOriginal('client/src/routeTree.gen.ts');
    for (const step of scenario) console.log(`  ${applyStep(step)}`);
    run('npm', ['run', 'generate'], projectDir);
    regenerateRouteTree();
    run('npm', ['run', 'typecheck', '--workspaces'], projectDir);
    run('node', ['scripts/checkStructure.mjs'], projectDir);
    console.log(`\nSnippet check passed: ${snippetNames.length} snippets expanded, generated, typechecked and structure-checked.`);
} catch (error) {
    failed = true;
    console.error(`\nSNIPPET CHECK FAILED: ${error.message}`);
    if (!keep) console.error('Re-run with --keep to leave the expanded files in the project for inspection.');
} finally {
    if (keep) console.log('\n--keep: the expanded files are left in the project; run `npm run generate` after removing them.');
    else restore();
}
process.exit(failed ? 1 : 0);
