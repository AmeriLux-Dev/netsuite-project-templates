#!/usr/bin/env node
/**
 * PostToolUse hook (wired in .claude/settings.json): checks the file Claude Code just wrote, so a broken rule is
 * reported at the edit that caused it. Exit code 2 hands the problems back to Claude; anything else lets the session
 * carry on. `npm run lint` holds a person to the standards; this holds the agent to them, with two parts:
 *
 * - ESLint over the file, as `npm run lint` would run it. Two rules are left to `npm run lint`, because a change
 *   written one file or one edit at a time passes through them on its way to being right: an import of a file not
 *   written yet, and an import added before the code that uses it. The structure check is left to it too, for the
 *   same reason: a script's pieces are separate files.
 * - The standards CLAUDE.md and .claude/rules/ state for the agent that ESLint does not check, one function each
 *   below. A project that drops one deletes its function and its line in `agentStandards`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const lintedExtensions = /\.(ts|tsx|js|cjs|mjs)$/;
const rulesLeftToLint = new Set(['import-x/no-unresolved', '@typescript-eslint/no-unused-vars']);

/** An endpoint writes its response, and the arguments it hands a service, out field by field. */
function checkFieldByFieldWire(typescript, sourceFile, report) {
    visitNodes(typescript, sourceFile, (node) => {
        if (typescript.isSpreadAssignment(node)) report(node, 'An endpoint names every field it passes on. A spread carries whatever the service type or the request gains later.');
    });
}

/** A service imports each repository as a namespace, so its removeSalesOrder can call the repository's without a clash. */
function checkRepositoryNamespaceImports(typescript, sourceFile, report) {
    for (const statement of sourceFile.statements) {
        if (!typescript.isImportDeclaration(statement) || !/\/repositories\//.test(statement.moduleSpecifier.text)) continue;
        const importClause = statement.importClause;
        if (!importClause || importClause.isTypeOnly) continue;
        const namedValues = importClause.namedBindings && typescript.isNamedImports(importClause.namedBindings)
            ? importClause.namedBindings.elements.filter((element) => !element.isTypeOnly)
            : [];
        if (importClause.name || namedValues.length > 0) {
            report(statement, "Import a repository as a namespace: import * as salesOrdersRepository from '../repositories/salesOrdersRepository'. Its types may be imported by name with import type.");
        }
    }
}

{{#if netsuiteRepository}}
/** A model is evaluated by `npm run generate` outside NetSuite, and a specification is query vocabulary: neither touches N/*. */
function checkNoNetsuiteModules(typescript, sourceFile, report) {
    for (const statement of sourceFile.statements) {
        if (typescript.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith('N/')) {
            report(statement, 'Only a repository touches NetSuite (N/*). npm run generate evaluates the models outside NetSuite, where N/* does not exist.');
        }
    }
}

{{/if}}
/** Every test runs. */
function checkNoFocusedOrSkippedTests(typescript, sourceFile, report) {
    visitNodes(typescript, sourceFile, (node) => {
        if (typescript.isPropertyAccessExpression(node) && typescript.isIdentifier(node.expression)
            && /^(describe|it|test)$/.test(node.expression.text) && /^(only|skip)$/.test(node.name.text)) {
            report(node, 'Every test runs: no .only and no .skip. Delete a test that no longer applies.');
        }
    });
}

const agentStandards = [
    { folders: ['api/src/controllers/'], check: checkFieldByFieldWire },
    { folders: ['api/src/services/'], check: checkRepositoryNamespaceImports },
{{#if netsuiteRepository}}
    { folders: ['api/src/models/', 'api/src/specifications/'], check: checkNoNetsuiteModules },
{{/if}}
    { folders: ['api/__tests__/', 'client/__tests__/'], check: checkNoFocusedOrSkippedTests },
];

function visitNodes(typescript, node, visit) {
    visit(node);
    typescript.forEachChild(node, (child) => visitNodes(typescript, child, visit));
}

async function readLintProblems(absolutePath, relativePath) {
    let ESLint;
    try {
        ({ ESLint } = await import('eslint'));
    } catch {
        return []; // not installed yet: `npm install` comes first
    }
    const eslint = new ESLint({ cwd: projectRoot });
    if (await eslint.isPathIgnored(absolutePath)) return [];
    const [lintResult] = await eslint.lintFiles([absolutePath]);
    return lintResult.messages
        .filter((lintMessage) => lintMessage.severity === 2 && !rulesLeftToLint.has(lintMessage.ruleId))
        .map((lintMessage) => `  ${relativePath}:${lintMessage.line}:${lintMessage.column}  ${lintMessage.message}${lintMessage.ruleId ? `  (${lintMessage.ruleId})` : ''}`);
}

async function readStandardProblems(absolutePath, relativePath) {
    const standards = agentStandards.filter((standard) => standard.folders.some((folder) => relativePath.startsWith(folder)));
    if (standards.length === 0 || !/\.tsx?$/.test(relativePath)) return [];
    let typescript;
    try {
        typescript = (await import('typescript')).default;
    } catch {
        return [];
    }
    const scriptKind = relativePath.endsWith('.tsx') ? typescript.ScriptKind.TSX : typescript.ScriptKind.TS;
    const sourceFile = typescript.createSourceFile(absolutePath, readFileSync(absolutePath, 'utf8'), typescript.ScriptTarget.Latest, true, scriptKind);
    const problems = [];
    const report = (node, message) => {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        problems.push(`  ${relativePath}:${line + 1}:${character + 1}  ${message}`);
    };
    for (const standard of standards) standard.check(typescript, sourceFile, report);
    return problems;
}

const hookInput = JSON.parse(readFileSync(0, 'utf8'));
const writtenPath = hookInput.tool_input?.file_path;
if (typeof writtenPath !== 'string' || !lintedExtensions.test(writtenPath)) process.exit(0);
const absolutePath = path.resolve(projectRoot, writtenPath);
const relativePath = path.relative(projectRoot, absolutePath).split(path.sep).join('/');
if (relativePath.startsWith('../') || path.isAbsolute(relativePath)) process.exit(0);

const problems = [...await readLintProblems(absolutePath, relativePath), ...await readStandardProblems(absolutePath, relativePath)];
if (problems.length === 0) process.exit(0);
process.stderr.write(`${relativePath} breaks the project's standards:\n${problems.join('\n')}\n`);
process.exit(2);
