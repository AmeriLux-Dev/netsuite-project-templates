#!/usr/bin/env node
/**
 * PreToolUse hook (wired in .claude/settings.json) for a project scaffolded without Probity: the hard rules of this
 * repository, checked before Claude Code runs a command or writes a file. A denial names the rule it enforces.
 * It reads only the tool call in front of it, so what needs the session's history (tests run before a commit)
 * stays in CLAUDE.md and `npm run lint`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const commandRules = [
    { match: /\brm\s+-(rf|fr)\b/, decision: 'deny', reason: 'Avoid recursive force deletes. Delete specific paths deliberately.' },
    { match: /Remove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i, decision: 'deny', reason: 'Avoid recursive force deletes. Delete specific paths deliberately.' },
    { match: /git\s+commit\b[^\n]*--no-verify/, decision: 'deny', reason: 'Do not bypass git hooks.' },
    { match: /git\s+push\b[^\n]*\s(-f|--force)(?=\s|$)/, decision: 'deny', reason: 'Use --force-with-lease.' },
    { match: /npm\s+run\s+deploy\b|suitecloud\s+(project:deploy|file:upload)\b/, decision: 'ask', reason: 'Deploying reaches a NetSuite account: only when the person asked for it, and after npm test.' },
];

const generatedPaths = ['netsuite/FileCabinet/', {{#if netsuiteRepository}}'api/src/repositories/generated/', 'api/src/types/models.gen.ts', {{/if}}{{#if netsuiteApi}}'api/src/scripts.gen.ts', 'client/src/api/', {{/if}}'client/src/routeTree.gen.ts'];
const secretPaths = ['project.json', 'client/.env'];
const secretExtensions = /\.(pem|p12|key|pfx)$/;
const colocatedTest = /^(api|client)\/src\/.*\.(test|spec)\.[cm]?[jt]sx?$/;
const viteSecretName = /VITE_[A-Z0-9_]*(ACCOUNT|CLIENT_ID|CERTIFICATE|KEY|SECRET|TOKEN)/;

function answer(decision, reason) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason } }));
    process.exit(0);
}

function checkCommand(command) {
    for (const rule of commandRules) {
        if (rule.match.test(command)) answer(rule.decision, rule.reason);
    }
}

/** The text a write puts into the file: the whole file for Write, the replacement for Edit and MultiEdit. */
function readWrittenText(toolInput) {
    if (typeof toolInput.content === 'string') return toolInput.content;
    if (typeof toolInput.new_string === 'string') return toolInput.new_string;
    if (Array.isArray(toolInput.edits)) return toolInput.edits.map((edit) => edit.new_string ?? '').join('\n');
    return '';
}

function checkWrite(toolInput) {
    const writtenPath = toolInput.file_path ?? toolInput.notebook_path;
    if (typeof writtenPath !== 'string') return;
    const relativePath = path.relative(projectRoot, path.resolve(projectRoot, writtenPath)).split(path.sep).join('/');
    if (relativePath.startsWith('../')) return;
    if (generatedPaths.some((generatedPath) => relativePath === generatedPath || relativePath.startsWith(generatedPath))) {
        answer('deny', 'Generated output. Change the source ({{#if netsuiteRepository}}models, {{/if}}{{#if netsuiteApi}}controllers, jobs, {{/if}}routes) and run {{#if codeGeneration}}npm run generate or {{/if}}npm run build instead.');
    }
    if (secretPaths.includes(relativePath) || secretExtensions.test(relativePath)) {
        answer('deny', 'Account selection and secrets are entered by a person, never written by the agent. Update client/.env.example if a new variable is needed.');
    }
    if (colocatedTest.test(relativePath)) {
        answer('deny', 'Tests live under a __tests__/ folder (api/__tests__, client/__tests__), never next to source files.');
    }
    if (/^(api\/src|client\/src)\/|^netsuite\.ts$/.test(relativePath) && viteSecretName.test(readWrittenText(toolInput))) {
        answer('deny', 'Vite inlines VITE_-prefixed variables into the uploaded bundle. Account data stays in client/.env, read only by server.ts.');
    }
}

const hookInput = JSON.parse(readFileSync(0, 'utf8'));
const toolInput = hookInput.tool_input ?? {};
if (typeof toolInput.command === 'string') checkCommand(toolInput.command);
else checkWrite(toolInput);
process.exit(0);
