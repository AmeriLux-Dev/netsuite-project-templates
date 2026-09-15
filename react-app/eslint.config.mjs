import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Id standards: a record's type and field ids are declared on its model (api/src/models); a script's ids in its
// controller's script declaration; ids no model or controller owns live in netsuite.ts. A NetSuite id written
// anywhere else is a string id scattered through a script. custpage_ ids are form-local field names on a Suitelet
// form, not account objects, so they are not checked.
const netsuiteIdPattern = '/^(custbody|custcol|custrecord|custentity|custitem|custevent|custform|custlist|custsublist|customscript|customdeploy|customsearch)_/i';
const netsuiteIdMessage = 'NetSuite ids live on the model that owns them (api/src/models), in the controller that declares the script, or in netsuite.ts. Import the constant.';
const netsuiteIdOutsideNetsuiteTs = [
    { selector: `Literal[value=${netsuiteIdPattern}]`, message: netsuiteIdMessage },
    { selector: `TemplateElement[value.raw=${netsuiteIdPattern}]`, message: netsuiteIdMessage },
];

// Logging standards: the developer writes the title and the details. The wrapper supplies everything else.
const logCall = 'CallExpression[callee.object.name="log"][callee.property.name=/^(debug|audit|error|emergency)$/]';
const gluedString = ':matches(TemplateLiteral, BinaryExpression[operator="+"])';
const titleMessage = 'A log title is the same three or four words every time. Ids go in details.';
const detailsMessage = 'Details is an object with the ids that matter, never a string glued together.';
const logEntryShape = [
    { selector: `${logCall} > ${gluedString}.arguments:first-child`, message: titleMessage },
    { selector: `${logCall} > ObjectExpression.arguments:first-child > Property[key.name="title"] > ${gluedString}.value`, message: titleMessage },
    { selector: `${logCall} > ${gluedString}.arguments:nth-child(2)`, message: detailsMessage },
    { selector: `${logCall} > ObjectExpression.arguments:first-child > Property[key.name="details"] > ${gluedString}.value`, message: detailsMessage },
];

// Alerting strategy: no script sends its own alert. Rules over the span stream do, and recipients come from the README owners.
const alertingImports = [{ group: ['N/email'], message: 'No script sends its own alert. Alert rules read the span stream.' }];
// Dependency governance: the shared package is imported by the data-access layers only (models, specifications, repositories).
const sharedPackageImports = [{ group: ['@amerilux/netsuite-repository', '@amerilux/netsuite-repository/*'], message: 'Only api/src/models, api/src/specifications and api/src/repositories import the shared repository package.' }];
// An endpoint never queries, a service never loads a record, and neither creates the context: a repository function does.
const recordAccessImports = [
    { group: ['N/record', 'N/query', 'N/search'], message: 'Endpoints parse and reply, services decide. Only a repository touches records.' },
    { group: ['**/repositories/generated/context.gen'], message: 'The context stays inside api/src/repositories. Call a repository function instead.' },
];
// The request and response shapes live in controllers/<name>Controller.ts. The layers below take them as types
// only: a service or repository that imported a controller's value would be pulling a deployed script into itself.
const wireShapeImports = [
    { group: ['**/controllers/**', '!**/controllers/*Controller'], message: 'Below a controller, only controllers/<name>Controller.ts is visible, and only its types.' },
    { group: ['**/controllers/*Controller'], allowTypeImports: true, message: 'The wire shapes come from controllers/<name>Controller.ts as types (import type); nothing below a controller imports its code.' },
];
// The api package has one entry per side: api/ imports its server entry, client/ its client entry. The client never
// imports from api/: `npm run generate` writes one module per controller (its types and its client) under
// client/src/api/, re-exported by index.gen.ts; a hook imports @/api/index.gen. Both sides import netsuite.ts directly.
const apiPackageServerSide = [
    { group: ['@amerilux/netsuite-api/client', '@amerilux/netsuite-api/testing'], message: 'api/ imports @amerilux/netsuite-api/server. The client entry is for client/, the testing entry for vitest configs.' },
];
const apiPackageClientSide = [
    { group: ['@amerilux/netsuite-api/server', '@amerilux/netsuite-api/testing'], message: 'client/ imports @amerilux/netsuite-api/client. The server entry runs in NetSuite.' },
    { group: ['api/**'], message: 'The client never imports from api/. Its types and clients are in the generated @/api/index.gen.' },
];
// netsuite.ts is the one file both api/ and client/ import, so it holds only what SuiteScript and the browser bundle alike: exported constants and types.
const appFileShape = [
    { selector: 'ImportDeclaration', message: 'netsuite.ts imports nothing; both api/ and client/ import it, so it holds only what either side can bundle.' },
    { selector: 'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ObjectExpression.init', message: 'Every export in netsuite.ts ends with `as const`, so ids are literal types.' },
];
// Dependency guard: npm workspaces hoist every package into the root node_modules, so an import of a package this
// workspace never declared still resolves. The rule checks each import (type imports included) against the workspace's
// own package.json. Add a package with `npm install -w <workspace> <package>`.
const onlyDeclaredDependencies = (workspaceDir) => ({
    'import-x/no-extraneous-dependencies': ['error', { includeTypes: true, packageDir: [`${import.meta.dirname}/${workspaceDir}`] }],
});
export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        'netsuite/FileCabinet/**',
        'api/src/repositories/generated/**',
        'api/src/types/models.gen.ts',
        'api/src/scripts.gen.ts',
        'client/src/api/**',
        'client/src/routeTree.gen.ts',
        '**/dist/**',
        '**/coverage/**',
    ]),
    js.configs.recommended,
    ...tseslint.configs.recommended,
    importX.flatConfigs.recommended,
    importX.flatConfigs.typescript,
    {
        settings: {
            // Path aliases (@/* in client/, N/* in api/) live in the workspace tsconfigs, not at the root.
            'import-x/resolver': {
                typescript: {
                    project: ['api/tsconfig.json', 'api/tsconfig.test.json', 'client/tsconfig.json', 'client/tsconfig.node.json'],
                    noWarnOnMultipleProjects: true,
                },
            },
            // @/* points into this repository, not into node_modules, so the dependency guard skips it.
            'import-x/internal-regex': '^@/',
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            'import-x/no-cycle': 'error',
            // CommonJS packages (dotenv, express) and the lint plugins themselves trip these; TypeScript already checks the names.
            'import-x/default': 'off',
            'import-x/no-named-as-default': 'off',
            'import-x/no-named-as-default-member': 'off',
            'no-restricted-syntax': ['error', ...netsuiteIdOutsideNetsuiteTs],
        },
    },
    {
        // Tests need literal ids to stand in for real ones; a model declares its own record and field ids; the
        // structure check names the id prefixes it verifies. (A controller declares its script ids too: see its block.)
        files: ['**/__tests__/**', 'api/src/models/**', 'scripts/checkStructure.mjs'],
        rules: { 'no-restricted-syntax': 'off' },
    },
    {
        files: ['**/*.{js,cjs,mjs}', 'client/server.ts', 'scripts/**'],
        languageOptions: { globals: { ...globals.node } },
    },
    {
        // Build configuration is CommonJS on purpose: webpack and the SuiteCloud CLI load it with require().
        files: ['**/*.{js,cjs}'],
        rules: { '@typescript-eslint/no-require-imports': 'off' },
    },
    {
        // Layers. Endpoint calls service, service calls repository, repository composes specifications over the generated
        // sets. Client pages and routes call hooks, hooks call the generated client module. The client's whole view of
        // the api is that generated module.
        files: ['api/src/**/*.ts', 'client/src/**/*.{ts,tsx}'],
        rules: {
            'import-x/no-restricted-paths': ['error', {
                zones: [
                    { target: './api/src/controllers', from: ['./api/src/repositories', './api/src/specifications', './api/src/models'], message: 'An endpoint never queries. Call a service.' },
                    { target: './api/src/services', from: ['./api/src/specifications', './api/src/models'], message: 'A service decides; the repository queries.' },
                    { target: './api/src/repositories', from: './api/src/services', message: 'A repository never decides.' },
                    { target: './api/src/specifications', from: ['./api/src/services', './api/src/controllers'], message: 'A specification is query vocabulary; it knows nothing above the repository.' },
                    { target: './api/src/specifications', from: './api/src/repositories', except: ['./generated'], message: 'A specification uses the generated fields, never a repository function.' },
                    { target: './api/src/models', from: ['./api/src/types', './api/src/controllers', './api/src/services', './api/src/repositories', './api/src/specifications'], message: 'A model declares a record; it knows nothing about the wire or the layers above it.' },
                    { target: ['./client/src/pages', './client/src/routes', './client/src/components'], from: './client/src/api', message: 'A component never fetches. Use a hook.' },
                    { target: './client/src/hooks', from: ['./client/src/pages', './client/src/routes', './client/src/components'], message: 'A hook does not render.' },
                    { target: './client', from: './api', message: 'The client never imports from api/; its view of the backend is the generated client module.' },
                    { target: './api', from: './client', message: 'The api never imports from client/.' },
                ],
            }],
        },
    },
    { files: ['api/**'], rules: onlyDeclaredDependencies('api') },
    { files: ['client/**'], rules: onlyDeclaredDependencies('client') },
    { files: ['scripts/**', 'eslint.config.mjs', 'probity.config.ts', 'netsuite.ts'], rules: onlyDeclaredDependencies('.') },
    {
        files: ['client/src/**/*.{ts,tsx}'],
        languageOptions: { globals: { ...globals.browser } },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-restricted-globals': ['error', { name: 'fetch', message: 'fetch lives in @amerilux/netsuite-api/client. Call a function of the generated @/api/index.gen.' }],
            '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...apiPackageClientSide] }],
        },
    },
    {
        files: ['api/src/**/*.ts'],
        // SuiteScript's own globals plus the build-time constants webpack defines.
        languageOptions: { globals: { define: 'readonly', __APP_VERSION__: 'readonly', __BUILD_ID__: 'readonly' } },
        rules: {
            'no-console': 'error', // invisible in NetSuite; the wrapper's log is the only signal path
            'no-restricted-syntax': ['error', ...netsuiteIdOutsideNetsuiteTs, ...logEntryShape],
            '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...apiPackageServerSide] }],
        },
    },
    {
        // An endpoint speaks the shapes declared next to it (an entity type, a Pick of one, or a composition) and calls a
        // service. A controller declares its own script ids, so the id rule does not apply to it; the log rules still do.
        files: ['api/src/controllers/**/*.ts'],
        rules: {
            'no-restricted-syntax': ['error', ...logEntryShape],
            '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...apiPackageServerSide, ...recordAccessImports] }],
        },
    },
    {
        files: ['api/src/services/**/*.ts'],
        rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...apiPackageServerSide, ...recordAccessImports, ...wireShapeImports] }] },
    },
    {
        // The data-access layers inside api/: Specification in specifications, the context in repositories, the
        // package's decorators in models.
        files: ['api/src/models/**/*.ts', 'api/src/specifications/**/*.ts', 'api/src/repositories/**/*.ts'],
        rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...apiPackageServerSide, ...wireShapeImports] }] },
    },
    {
        // The app file: names and ids, imported by both api/ and client/.
        files: ['netsuite.ts'],
        rules: {
            'no-restricted-syntax': ['error', ...appFileShape],
            'no-restricted-globals': ['error', 'window', 'document'],
            '@typescript-eslint/naming-convention': ['error',
                { selector: 'variable', modifiers: ['exported'], format: ['camelCase'] },
                { selector: 'objectLiteralProperty', format: ['camelCase'] },
            ],
        },
    },
]);
