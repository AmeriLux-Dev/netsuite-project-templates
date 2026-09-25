#!/usr/bin/env node
/**
 * Worked-example check for the react-app template. Every file block in the scaffold's how-to-use/ is written into
 * that installed scaffold, in the order the examples build on one another, and the result must pass what a project
 * must pass: `npm run generate`, the route tree generator, typecheck, `npm run lint` (ESLint and the structure
 * check), the tests and the build. An example therefore cannot drift from the packages, the snippets or the lint
 * rules without this check failing.
 *
 * The examples and the snippets are read from the scaffold (how-to-use/ and .vscode/netsuite-project.code-snippets):
 * the template's react-app copies as the CLI rendered them. The template's own copies carry {{#if}} blocks and
 * tokens, and the snippet file is not JSON until it is rendered. Every listed example must be there, so the
 * scaffold must have both packages on (netsuite-api and netsuite-repository): with either off, the examples and
 * snippets built on it are left out.
 *
 * A file block is a fenced TypeScript block cut into files by banners:
 *
 *   // ──────────────────────────────────────────────
 *   // api/src/jobs/closeOldOrders/map.ts     what the file is for, over
 *   //                                        as many lines as it takes
 *   // ──────────────────────────────────────────────
 *
 * The first word after the `//` is the file's path from the project root; everything up to the next banner, or
 * the end of the block, is the file. A block without banners is an illustration and is not checked.
 *
 * A path that does not exist yet is written as the block has it. A path that exists (a file of the scaffold, one
 * `npm run add:jobs` wrote, or one an earlier example wrote) is merged into, statement by statement, the way an
 * example's banner says it "adds" to a file: its imports join the file's imports; a const whose object literal the
 * file already has (netsuite.ts `jobs`, a controller's `defineEndpoints({...})`) gains the block's properties, a
 * property of the same name replacing the file's; any other declaration of the same name replaces the file's; a
 * new declaration goes above the first statement the block touched, or at the end when it touched none. A path an
 * example lists under `shown` is output the developer does not write (generated files, what add:jobs wrote): it is
 * not written, only compared with what is there, line by line in order, comments and blank lines aside.
 *
 * Every example with file blocks must be listed below, so an example cannot be added without being checked.
 *
 *   node scripts/checkHowToUse.mjs --project <dir>          # an installed scaffold (the e2e passes its own)
 *   node scripts/checkHowToUse.mjs --project <dir> --keep   # leave the files in place for inspection
 *
 * The files the check writes are removed afterwards (edited files restored, the generated modules refreshed, the
 * build output it added deleted), so the scaffold is left as it was found.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { expandSnippet } from './snippetExpansion.mjs';

const isWindows = process.platform === 'win32';

// ── the examples, in the order they build on one another ─────────────────────────────────────────────────────────

/**
 * `before` runs ahead of the example's blocks (a setup step the example assumes, with the files it creates, so the
 * restore takes them away again); `objects` writes what the example describes but does not show, the way a
 * developer would, from a snippet (`file` + `values`) or by hand (`edit`: `find` replaced by `replace`); `shown`
 * lists the blocks that are compared rather than written. Paths and values may carry {{prefix}}, {{appName}} and
 * {{appTitle}}, rendered from the scaffold's netsuite.ts.
 */
const examples = [
    {
        path: 'repositories/model-and-repository.md',
        shown: ['api/src/types/models.gen.ts'],
    },
    {
        path: 'controllers/restlet-controller.md',
        objects: [
            { snippet: 'nspObjectRestlet', file: 'netsuite/Objects/customscript_{{prefix}}_orders.xml', values: { 1: 'Orders', 2: 'A customer\'s sales orders' } },
        ],
        shown: ['client/src/api/orders.gen.ts'],
    },
    {
        path: 'controllers/suitelet-controller.md',
        objects: [
            { snippet: 'nspObjectSuitelet', file: 'netsuite/Objects/customscript_{{prefix}}_customer_credit.xml', values: { 1: 'Customer Credit', 2: 'A customer\'s credit, read as Administrator' } },
            // The export runs as the caller: the example deletes the snippet's run-as line.
            { snippet: 'nspObjectSuitelet', file: 'netsuite/Objects/customscript_{{prefix}}_order_exports.xml', values: { 1: 'Order Exports', 2: 'A customer\'s sales orders as a CSV file', 3: '' } },
        ],
    },
    {
        path: 'jobs/map-reduce-job.md',
        before: [
            {
                run: 'add:jobs',
                creates: [
                    'netsuite.ts',
                    'netsuite-api.config.json',
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
                    'client/src/hooks/jobRuns/useJobRunsMine.ts',
                    'client/src/hooks/jobRuns/useJobRun.ts',
                ],
            },
        ],
        objects: [
            { snippet: 'nspObjectMapReduce', file: 'netsuite/Objects/customscript_{{prefix}}_close_old_orders_mr.xml', values: { 1: 'Close Old Orders', 2: 'Closes the sales orders nobody has touched for long enough' } },
            // The example gives the job a second deployment, so two runs can overlap.
            {
                edit: 'netsuite/Objects/customscript_{{prefix}}_close_old_orders_mr.xml',
                find: '  </scriptdeployments>',
                replace: [
                    '    <scriptdeployment scriptid="customdeploy_{{prefix}}_close_old_orders_mr_2">',
                    '      <isdeployed>T</isdeployed>',
                    '      <loglevel>DEBUG</loglevel>',
                    '      <status>NOTSCHEDULED</status>',
                    '      <title>Close Old Orders 2</title>',
                    '    </scriptdeployment>',
                    '  </scriptdeployments>',
                ].join('\n'),
            },
        ],
        shown: ['api/src/repositories/jobRunRepository.ts'],
    },
];

// ── reading an example ───────────────────────────────────────────────────────────────────────────────────────────

const BANNER_RULE = /^\/\/ ─{20,}\s*$/;

/** The file blocks of one example: `{ path, content }` in the order they appear. */
function readFileBlocks(markdown, label) {
    const blocks = [];
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
        if (!/^```(typescript|ts|tsx)\s*$/.test(lines[index])) continue;
        const fence = [];
        for (index += 1; index < lines.length && !/^```\s*$/.test(lines[index]); index += 1) fence.push(lines[index]);
        blocks.push(...cutAtBanners(fence, label));
    }
    return blocks;
}

function cutAtBanners(fence, label) {
    const files = [];
    let current;
    for (let index = 0; index < fence.length; index += 1) {
        if (BANNER_RULE.test(fence[index])) {
            const bannerLines = [];
            let end = index + 1;
            while (end < fence.length && !BANNER_RULE.test(fence[end])) bannerLines.push(fence[end++]);
            if (end === fence.length || bannerLines.length === 0 || !bannerLines.every((line) => line.startsWith('//'))) {
                throw new Error(`${label}: a banner rule without its closing rule, or with something other than comments inside.`);
            }
            const filePath = bannerLines[0].replace(/^\/\/\s*/, '').split(/\s+/)[0];
            current = { path: filePath, lines: [] };
            files.push(current);
            index = end;
            continue;
        }
        if (current) current.lines.push(fence[index]);
    }
    return files.map((file) => ({ path: file.path, content: `${file.lines.join('\n').replace(/^\n+|\s+$/g, '')}\n` }));
}

// ── merging a block into a file that is already there ────────────────────────────────────────────────────────────

let typescript;

function parseSource(text, filePath) {
    const kind = filePath.endsWith('.tsx') ? typescript.ScriptKind.TSX : typescript.ScriptKind.TS;
    return typescript.createSourceFile(filePath, text, typescript.ScriptTarget.Latest, true, kind);
}

function declaredName(statement) {
    const ts = typescript;
    if (ts.isVariableStatement(statement) && statement.declarationList.declarations.length === 1) {
        const name = statement.declarationList.declarations[0].name;
        return ts.isIdentifier(name) ? name.text : undefined;
    }
    if ((ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)
        || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) return statement.name.text;
    return undefined;
}

/** The object literal a const is initialized with: directly, through `as const` or `satisfies`, or as a call's first argument. */
function initializerObject(statement) {
    const ts = typescript;
    if (!ts.isVariableStatement(statement)) return undefined;
    let expression = statement.declarationList.declarations[0]?.initializer;
    while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression;
    if (expression && ts.isCallExpression(expression)) expression = expression.arguments[0];
    return expression && ts.isObjectLiteralExpression(expression) ? expression : undefined;
}

function propertyName(property) {
    const name = property.name;
    return name && (typescript.isIdentifier(name) || typescript.isStringLiteral(name)) ? name.text : undefined;
}

/** A node's text with the comments above it, without the blank lines before them. */
function textWithComments(node, source) {
    return source.text.slice(node.getFullStart(), node.end).replace(/^\s*\n/, '');
}

function mergeIntoFile(existingText, blockText, filePath) {
    const ts = typescript;
    const existing = parseSource(existingText, filePath);
    const addition = parseSource(blockText, filePath);
    // Each edit replaces [start, end); at the same position, the higher order lands first in the text.
    const edits = [];

    const existingImports = existing.statements.filter(ts.isImportDeclaration);
    const newImports = [];
    for (const statement of addition.statements.filter(ts.isImportDeclaration)) {
        const bindings = statement.importClause?.namedBindings;
        const match = existingImports.find((candidate) => candidate.moduleSpecifier.text === statement.moduleSpecifier.text
            && Boolean(candidate.importClause?.isTypeOnly) === Boolean(statement.importClause?.isTypeOnly)
            && candidate.importClause?.namedBindings && ts.isNamedImports(candidate.importClause.namedBindings));
        if (match && bindings && ts.isNamedImports(bindings)) {
            const elements = match.importClause.namedBindings.elements;
            const present = new Set(elements.map((element) => element.getText(existing)));
            const missing = bindings.elements.map((element) => element.getText(addition)).filter((text) => !present.has(text));
            if (missing.length > 0) edits.push({ start: elements[elements.length - 1].end, end: elements[elements.length - 1].end, text: `, ${missing.join(', ')}`, order: 0 });
        } else if (!existingImports.some((candidate) => candidate.getText(existing) === statement.getText(addition))) {
            newImports.push(statement.getText(addition));
        }
    }
    if (newImports.length > 0) {
        const lastImport = existingImports[existingImports.length - 1];
        const position = lastImport ? lastImport.end : 0;
        edits.push({ start: position, end: position, text: lastImport ? `\n${newImports.join('\n')}` : `${newImports.join('\n')}\n\n`, order: 2 });
    }

    const existingByName = new Map(existing.statements.map((statement) => [declaredName(statement), statement]).filter(([name]) => name));
    const newStatements = [];
    let firstTouched;
    for (const statement of addition.statements) {
        if (ts.isImportDeclaration(statement)) continue;
        const name = declaredName(statement);
        const target = name ? existingByName.get(name) : undefined;
        if (!target) {
            newStatements.push(textWithComments(statement, addition));
            continue;
        }
        if (!firstTouched || target.pos < firstTouched.pos) firstTouched = target;
        const targetObject = initializerObject(target);
        const additionObject = initializerObject(statement);
        if (!targetObject || !additionObject) {
            edits.push({ start: target.getStart(existing), end: target.end, text: statement.getText(addition), order: 0 });
            continue;
        }
        const appended = [];
        for (const property of additionObject.properties) {
            const replaced = targetObject.properties.find((candidate) => propertyName(candidate) === propertyName(property));
            if (replaced) edits.push({ start: replaced.getStart(existing), end: replaced.end, text: property.getText(addition), order: 0 });
            else appended.push(textWithComments(property, addition));
        }
        if (appended.length === 0) continue;
        const properties = targetObject.properties;
        if (properties.length === 0) {
            const position = targetObject.getStart(existing) + 1;
            edits.push({ start: position, end: position, text: `\n${appended.join(',\n')},\n`, order: 0 });
        } else {
            const last = properties[properties.length - 1];
            const position = properties.hasTrailingComma ? existingText.indexOf(',', last.end) + 1 : last.end;
            edits.push({ start: position, end: position, text: `${properties.hasTrailingComma ? '' : ','}\n${appended.join(',\n')}${properties.hasTrailingComma ? ',' : ''}`, order: 0 });
        }
    }
    if (newStatements.length > 0) {
        if (firstTouched) edits.push({ start: firstTouched.getFullStart(), end: firstTouched.getFullStart(), text: `\n\n${newStatements.join('\n\n')}`, order: 1 });
        else edits.push({ start: existingText.replace(/\s+$/, '').length, end: existingText.length, text: `\n\n${newStatements.join('\n\n')}\n`, order: 1 });
    }

    let merged = existingText;
    for (const edit of edits.sort((left, right) => right.start - left.start || left.order - right.order)) {
        merged = merged.slice(0, edit.start) + edit.text + merged.slice(edit.end);
    }
    return merged;
}

// ── comparing a shown block with the file ────────────────────────────────────────────────────────────────────────

const isCommentOrBlank = (line) => line === '' || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*');

/** The first line of the block (comments and blank lines aside) that the file does not have after the previous one. */
function findMissingLine(blockText, fileText) {
    const fileLines = fileText.replace(/\r\n/g, '\n').split('\n').map((line) => line.trim());
    let position = 0;
    for (const line of blockText.split('\n').map((text) => text.trim())) {
        if (isCommentOrBlank(line)) continue;
        const found = fileLines.indexOf(line, position);
        if (found === -1) return line;
        position = found + 1;
    }
    return undefined;
}

// ── running it ───────────────────────────────────────────────────────────────────────────────────────────────────

function readFlag(flag) {
    const index = process.argv.indexOf(flag);
    return index === -1 ? undefined : process.argv[index + 1];
}

const projectDir = readFlag('--project') && path.resolve(readFlag('--project'));
const keep = process.argv.includes('--keep');
if (!projectDir || !existsSync(path.join(projectDir, 'netsuite.ts')) || !existsSync(path.join(projectDir, 'node_modules'))) {
    console.error('--project must name an installed scaffold of the react-app template (netsuite.ts and node_modules present).');
    process.exit(1);
}
// The scaffold's copies, which the CLI rendered: the template's own carry {{#if}} blocks.
const howToUseRoot = path.join(projectDir, 'how-to-use');
const snippetsPath = path.join(projectDir, '.vscode', 'netsuite-project.code-snippets');
for (const required of [howToUseRoot, snippetsPath]) {
    if (!existsSync(required)) {
        console.error(`The scaffold has no ${path.relative(projectDir, required)}.`);
        process.exit(1);
    }
}
typescript = createRequire(path.join(projectDir, 'package.json'))('typescript');

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

/** Every example under how-to-use/ with a file block must be listed, and every listed one must exist. */
function checkExamplesListed() {
    const found = [];
    (function walk(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(entryPath);
            else if (entry.name.endsWith('.md') && readFileBlocks(readFileSync(entryPath, 'utf8'), entry.name).length > 0) {
                found.push(path.relative(howToUseRoot, entryPath).split(path.sep).join('/'));
            }
        }
    })(howToUseRoot);
    const listed = examples.map((example) => example.path);
    const unlisted = found.filter((examplePath) => !listed.includes(examplePath));
    const missing = listed.filter((examplePath) => !existsSync(path.join(howToUseRoot, examplePath)));
    if (unlisted.length > 0) throw new Error(`Examples with file blocks not listed in scripts/checkHowToUse.mjs: ${unlisted.join(', ')}.`);
    if (missing.length > 0) throw new Error(`Listed examples that do not exist under ${howToUseRoot}: ${missing.join(', ')} (a scaffold with netsuite-api or netsuite-repository off leaves out the examples built on it).`);
}

const originals = new Map();
const fileCabinetDir = path.join(projectDir, 'netsuite', 'FileCabinet');
// `netsuite-repository generate` writes a file per model and never deletes one; the restore removes those the
// examples' models caused, as it removes the build output they caused.
const repositoryGeneratedDir = path.join(projectDir, 'api', 'src', 'repositories', 'generated');

function rememberOriginal(relativePath) {
    const absolutePath = path.join(projectDir, relativePath);
    if (!originals.has(relativePath)) originals.set(relativePath, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : undefined);
}

function writeProjectFile(relativePath, content) {
    const absolutePath = path.join(projectDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
}

function listFiles(directory) {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    });
}

function quoteForShell(argument) {
    return isWindows && /\s/.test(argument) ? `"${argument}"` : argument;
}

function run(command, args) {
    console.log(`\n> ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args.map(quoteForShell), { cwd: projectDir, stdio: 'inherit', shell: isWindows });
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed (exit ${result.status}).`);
}

function regenerateRouteTree() {
    const script = [
        "const { Generator, getConfig } = require('@tanstack/router-generator');",
        "const config = getConfig({ target: 'react', autoCodeSplitting: false, routesDirectory: 'src/routes', generatedRouteTree: 'src/routeTree.gen.ts', quoteStyle: 'single', semicolons: true }, process.cwd());",
        'new Generator({ config, root: process.cwd() }).run().catch((error) => { console.error(error); process.exit(1); });',
    ].join(' ');
    const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(projectDir, 'client'), stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Route tree generation failed.');
}

function applyObject(step) {
    const relativePath = renderTokens(step.file ?? step.edit);
    rememberOriginal(relativePath);
    if (step.edit) {
        const source = readFileSync(path.join(projectDir, relativePath), 'utf8');
        const find = renderTokens(step.find);
        if (!source.includes(find)) throw new Error(`${relativePath}: expected to find ${JSON.stringify(find)} to edit.`);
        writeProjectFile(relativePath, source.replace(find, renderTokens(step.replace)));
        return `edited ${relativePath}`;
    }
    const snippet = snippets[step.snippet];
    if (!snippet) throw new Error(`No snippet named ${step.snippet}.`);
    const values = Object.fromEntries(Object.entries(step.values ?? {}).map(([index, value]) => [index, renderTokens(String(value))]));
    const body = renderTokens(Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body);
    writeProjectFile(relativePath, expandSnippet(body, { fileNameBase: path.basename(relativePath, path.extname(relativePath)), values }));
    return `${step.snippet} -> ${relativePath}`;
}

function restore(filesBefore) {
    const emptiedDirectories = new Set();
    for (const [relativePath, original] of originals) {
        const absolutePath = path.join(projectDir, relativePath);
        if (original === undefined) {
            rmSync(absolutePath, { force: true });
            emptiedDirectories.add(path.dirname(absolutePath));
        } else writeFileSync(absolutePath, original);
    }
    for (const builtFile of [...listFiles(fileCabinetDir), ...listFiles(repositoryGeneratedDir)]) {
        if (!filesBefore.has(builtFile)) {
            rmSync(builtFile, { force: true });
            emptiedDirectories.add(path.dirname(builtFile));
        }
    }
    // An empty folder goes with its files: an empty job folder is a job with no job in it, which generate reports.
    for (const directory of [...emptiedDirectories].sort((left, right) => right.length - left.length)) {
        let current = directory;
        while (current.startsWith(projectDir) && current !== projectDir && existsSync(current) && statSync(current).isDirectory() && readdirSync(current).length === 0) {
            rmSync(current, { recursive: true, force: true });
            current = path.dirname(current);
        }
    }
    regenerateRouteTree();
    run('npm', ['run', 'generate']);
}

// --through <example> stops after that example, for writing one: the examples after it are not needed yet.
const through = readFlag('--through');
const throughIndex = through ? examples.findIndex((example) => example.path === through) : examples.length - 1;
if (throughIndex === -1) {
    console.error(`--through names no listed example: ${through}.`);
    process.exit(1);
}
const examplesToRun = examples.slice(0, throughIndex + 1);

console.log(`Examples: ${howToUseRoot} (${examplesToRun.length} of ${examples.length})`);
console.log(`Project:  ${projectDir} (prefix ${templateTokens.prefix}, folder ${templateTokens.appName})`);
const filesBefore = new Set([...listFiles(fileCabinetDir), ...listFiles(repositoryGeneratedDir)]);
const shownBlocks = [];
let failed = false;
try {
    if (!through) checkExamplesListed();
    rememberOriginal('client/src/routeTree.gen.ts');
    for (const example of examplesToRun) {
        console.log(`\n${example.path}`);
        for (const step of example.before ?? []) {
            for (const created of step.creates) rememberOriginal(renderTokens(created));
            run('npm', ['run', step.run]);
        }
        const shown = new Set((example.shown ?? []).map(renderTokens));
        const blocks = readFileBlocks(readFileSync(path.join(howToUseRoot, example.path), 'utf8'), example.path);
        const seen = new Set();
        for (const block of blocks) {
            const relativePath = renderTokens(block.path);
            const content = renderTokens(block.content);
            if (shown.has(relativePath)) {
                shownBlocks.push({ example: example.path, path: relativePath, content });
                seen.add(relativePath);
                console.log(`  shown   ${relativePath}`);
                continue;
            }
            rememberOriginal(relativePath);
            const absolutePath = path.join(projectDir, relativePath);
            if (existsSync(absolutePath)) {
                writeProjectFile(relativePath, mergeIntoFile(readFileSync(absolutePath, 'utf8'), content, relativePath));
                console.log(`  merged  ${relativePath}`);
            } else {
                writeProjectFile(relativePath, content);
                console.log(`  wrote   ${relativePath}`);
            }
        }
        const unseen = [...shown].filter((shownPath) => !seen.has(shownPath));
        if (unseen.length > 0) throw new Error(`${example.path}: listed as shown but has no block: ${unseen.join(', ')}.`);
        for (const step of example.objects ?? []) console.log(`  ${applyObject(step)}`);
    }
    run('npm', ['run', 'generate']);
    for (const block of shownBlocks) {
        const absolutePath = path.join(projectDir, block.path);
        if (!existsSync(absolutePath)) throw new Error(`${block.example}: shows ${block.path}, which does not exist.`);
        const missing = findMissingLine(block.content, readFileSync(absolutePath, 'utf8'));
        if (missing !== undefined) throw new Error(`${block.example}: shows ${block.path} with a line the file does not have (or not in that order): ${missing}`);
    }
    regenerateRouteTree();
    run('npm', ['run', 'typecheck', '--workspaces']);
    run('npm', ['run', 'lint']);
    run('npm', ['test', '--workspaces', '--if-present']);
    run('npm', ['run', 'build']);
    console.log(`\nHow-to-use check passed: ${examplesToRun.length} examples written, generated, typechecked, linted, tested and built.`);
} catch (error) {
    failed = true;
    console.error(`\nHOW-TO-USE CHECK FAILED: ${error.message}`);
    if (!keep) console.error('Re-run with --keep to leave the example files in the project for inspection.');
} finally {
    if (keep) console.log('\n--keep: the example files are left in the project; restore it by scaffolding again.');
    else restore(filesBefore);
}
process.exit(failed ? 1 : 0);
