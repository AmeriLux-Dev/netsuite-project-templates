import { basename } from 'node:path';
import {
    defineConfig,
    enforceTdd,
    forbidCommandPattern,
    forbidContentPattern,
    requireCommand,
    type Rule,
} from '@nizos/probity';

/*
 * Guardrails for AI coding agents working in this repository (Claude Code, Codex, Copilot CLI).
 * Wired through the PreToolUse hook in .claude/settings.json. See CLAUDE.md and .claude/rules/ for the rules in prose.
 *
 * Hard rules block an action; advisory rules pass with feedback. Keep advisory rules rare, or the
 * agent learns to ignore every warning. Anything needing judgement belongs in enforceTdd's
 * instructions, not in a regex.
 */

const toPosixPath = (filePath: string) => filePath.replace(/\\/g, '/');

/* Blocks every write in the block it is scoped to. */
const forbidAnyWrite = (reason: string): Rule => (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    return { kind: 'violation', reason };
};

/* Tests belong in __tests__/, never beside the source they cover. */
const forbidColocatedTests: Rule = (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    const filePath = toPosixPath(action.path);
    if (/(^|\/)__tests__\//.test(filePath)) return { kind: 'pass' };
    if (!/\.(test|spec)\.[cm]?[jt]sx?$/.test(basename(filePath))) return { kind: 'pass' };
    return {
        kind: 'violation',
        reason: 'Tests live under a __tests__/ folder (api/__tests__, client/__tests__), never next to source files.',
    };
};

const warnIfContent = (match: RegExp, message: string): Rule => (action) => {
    if (action.kind !== 'write') return { kind: 'pass' };
    if (!match.test(action.content)) return { kind: 'pass' };
    return {
        kind: 'pass',
        reason: `Advisory: ${message} If intentional, say why in your summary; do not stop work to ask.`,
    };
};

const warnWeakAssertions = warnIfContent(
    /toBeTruthy\(\)|toBe\(true\)/,
    'Weak assertion (toBeTruthy / toBe(true)). Prefer a precise expectation on the actual value.',
);

const warnTypeEscapes = warnIfContent(
    /\bas\s+any\b|:\s*any\b|@ts-ignore|@ts-nocheck/,
    'Type-safety escape hatch (any / @ts-ignore). Fix the underlying type instead.',
);

/* Components are thin shells; behaviour lives in .ts hooks, services and repositories, which stay enforced. */
const enforceTddExceptComponents = (options: Parameters<typeof enforceTdd>[0]): Rule => {
    const rule = enforceTdd(options);
    return async (action, context) => {
        if (action.kind === 'write' && /\.tsx$/.test(action.path)) return { kind: 'pass' };
        return rule(action, context);
    };
};

export default defineConfig({
    rules: [
        /* Command safety */
        forbidCommandPattern({
            match: /\brm\s+-(rf|fr)\b/,
            reason: 'Avoid recursive force deletes. Delete specific paths deliberately.',
        }),
        forbidCommandPattern({
            match: /Remove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i,
            reason: 'Avoid recursive force deletes. Delete specific paths deliberately.',
        }),
        forbidCommandPattern({
            match: /git\s+commit\b[^\n]*--no-verify/,
            reason: 'Do not bypass git hooks.',
        }),
        forbidCommandPattern({
            match: /git\s+push\s+--force(?!-with-lease)\b/,
            reason: 'Use --force-with-lease.',
        }),

        /* Verification before commit and before anything reaches a NetSuite account */
        requireCommand({
            before: { kind: 'command', match: /git\s+commit\b/ },
            command: /(npm|pnpm|yarn|bun)(\s+run)?\s+test\b|\bvitest\b/,
            after: { kind: 'write' },
            reason: 'Run npm test before committing.',
        }),
        requireCommand({
            before: { kind: 'command', match: /git\s+commit\b/ },
            command: /(npm|pnpm|yarn|bun)\s+run\s+(build|typecheck)\b|\btsc\b/,
            after: { kind: 'write' },
            reason: 'Run npm run typecheck (or build) before committing.',
        }),
        requireCommand({
            before: { kind: 'command', match: /npm\s+run\s+deploy\b|suitecloud\s+(project:deploy|file:upload)\b/ },
            command: /(npm|pnpm|yarn|bun)(\s+run)?\s+test\b|\bvitest\b/,
            after: { kind: 'write' },
            reason: 'Run npm test before deploying to NetSuite, and only deploy when the person asked for it.',
        }),

        /* Generated and account-specific files are never written by an agent */
        {
            files: ['netsuite/FileCabinet/**', {{#if netsuiteRepository}}'api/src/repositories/generated/**', 'api/src/types/models.gen.ts', {{/if}}{{#if netsuiteApi}}'api/src/scripts.gen.ts', 'client/src/api/**', {{/if}}'client/src/routeTree.gen.ts'],
            rules: [forbidAnyWrite('Generated output. Change the source ({{#if netsuiteRepository}}models, {{/if}}{{#if netsuiteApi}}controllers, {{/if}}routes, bundles) and run {{#if codeGeneration}}npm run generate or {{/if}}npm run build instead.')],
        },
        {
            files: ['project.json', 'client/.env', '**/*.pem', '**/*.p12', '**/*.key', '**/*.pfx'],
            rules: [forbidAnyWrite('Account selection and secrets are entered by a person, never written by the agent. Update .env.example if a new variable is needed.')],
        },

        /* Source code */
        {
            files: ['netsuite.ts'],
            rules: [
                forbidContentPattern({
                    match: /^\s*import\s/m,
                    reason: 'netsuite.ts is bundled by both api/ and client/; it holds exported constants and types only, with no imports.',
                }),
            ],
        },
        {
            files: ['api/src/**', 'client/src/**', 'netsuite.ts'],
            rules: [
                forbidColocatedTests,
                forbidContentPattern({
                    match: /VITE_[A-Z0-9_]*(ACCOUNT|CLIENT_ID|CERTIFICATE|KEY|SECRET|TOKEN)/,
                    reason: 'Vite inlines VITE_-prefixed variables into the uploaded bundle. Account data stays in client/.env, read only by server.ts.',
                }),
                warnTypeEscapes,
            ],
        },
        {
{{#if bothNetsuitePackages}}
            // A model declares its record and field ids and a controller its script ids; nowhere else writes one.
{{/if}}
{{#unless bothNetsuitePackages}}
            // NetSuite ids are declared {{#if netsuiteRepository}}on their models and {{/if}}{{#if netsuiteApi}}in their controllers and {{/if}}in netsuite.ts; nowhere else writes one.
{{/unless}}
            files: [{{#unless netsuiteApi}}'api/src/controllers/**', {{/unless}}'api/src/services/**', 'api/src/lib/**', 'api/src/repositories/**', {{#if netsuiteRepository}}'api/src/specifications/**', {{/if}}'api/src/_host/**', 'client/src/**'],
            rules: [
                forbidContentPattern({
                    match: /['"`](customscript|customdeploy|customrecord|customlist|custentity|custbody|custitem|custrecord)_[a-z0-9_]+['"`]/,
                    reason: 'NetSuite identifiers are declared {{#if netsuiteRepository}}on the model that owns them (api/src/models), {{/if}}{{#if netsuiteApi}}in the controller that declares the script, {{/if}}{{#if codeGeneration}}or {{/if}}in netsuite.ts; import them from there.',
                }),
            ],
        },

        /* Test-first for the pure logic the tests are designed around: controllers, job stages, services, lib, repositories, and client hooks. */
        {
            files: ['api/src/controllers/**', 'api/src/jobs/**', 'api/src/services/**', 'api/src/lib/**', 'api/src/repositories/**', 'client/src/hooks/**'],
            rules: [
                enforceTddExceptComponents({
                    instructions: (defaults) => `${defaults}

### Project standards

- Behaviour change (new or changed outputs, validation, side-effects, error handling): write or extend a test in the matching __tests__/ folder, see it fail, then implement the minimum.
- Refactor with unchanged behaviour, configuration, documentation, generated files and .gitignore changes need no new test.
- Test observable behaviour through the public surface: {{#if codeGeneration}}inputs to outputs, calls made to {{#if netsuiteRepository}}the record sets{{#if netsuiteApi}} or {{/if}}{{/if}}{{#if netsuiteApi}}the typed api client, envelope status and error{{/if}}{{/if}}{{#unless codeGeneration}}inputs to outputs and the calls made to the layer below{{/unless}}. Never assert on DOM structure, CSS classes or internal state.
- {{#if netsuiteRepository}}Repository functions use the generated dbContext; tests mock it with a fake whose sets record the specifications applied to them. {{/if}}Service tests mock the repository module. A lib function is called with plain values; nothing is mocked.
- Prefer extending an existing test file over a duplicate; prefer the lowest level that proves the behaviour.

### Refactor or behaviour: how to decide

Most writes here land on existing code, so decide by this procedure, in order:

1. Would any existing assertion under __tests__/ have to change for the pending write to be correct, or does the write need an assertion that does not exist yet? If yes, it is a behaviour change: the red comes first. If no, and the affected tests have been observed passing in this session, it is a refactor.
2. Refactors in this codebase look like: a check moving between layers with its test moving alongside (a wire check leaving a service for its controller); a service or repository function split into two with the same outputs; a DTO field renamed across the controller and the client; a repository function extracted from a query that already exists elsewhere; a hook's query options lifted out for reuse.
3. Behaviour changes look like: a new endpoint; a new field on a response or a request; a new branch, default, sort order or validation in a service; {{#if netsuiteRepository}}a new specification predicate; {{/if}}a changed error status or message; a new call to the record sets or to another script.
4. Existing behaviour being changed on purpose: the assertion changes first and is seen failing, then the code. Existing code with no test being refactored: a pinning test that passes as things stand comes first, then the refactor under it.
5. A refactor is only a refactor while its tests were seen green in the recent session. A test run is the evidence; prose about intent is not. If the window shows neither a red nor a green for the files touched, ask for the tests to be run rather than guessing from the diff.`,
                }),
            ],
        },

        /* Test files */
        {
            files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
            rules: [
                forbidContentPattern({
                    match: /\b(describe|it|test)\.(only|skip)\s*\(/,
                    reason: 'No focused or skipped tests.',
                }),
                warnWeakAssertions,
            ],
        },
    ],
});
