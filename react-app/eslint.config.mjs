import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Id standards: a record's type and field ids are declared on its model (common/model); ids no model owns
// live in common/netsuite.ts. A NetSuite id written anywhere else is a string id scattered through a script.
// custpage_ ids are form-local field names on a Suitelet form, not account objects, so they are not checked.
const netsuiteIdPattern = '/^(custbody|custcol|custrecord|custentity|custitem|custevent|custform|custlist|custsublist|customscript|customdeploy|customsearch)_/i';
const netsuiteIdMessage = 'NetSuite ids live on the model that owns them (common/model) or in common/netsuite.ts. Import the constant.';
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
const sharedPackageImports = [{ group: ['@amerilux/netsuite-repository', '@amerilux/netsuite-repository/*'], message: 'Only common/model, api/src/specifications and api/src/repositories import the shared repository package.' }];
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
// The api package has one entry per side: api/ imports its server entry, client/ its client entry, common/ the wire
// types at its root. The client never imports from api/: `npm run generate` writes every controller's types and
// clients into client/src/api/index.gen.ts, and that module is what hooks import.
const apiPackageServerSide = [
    { group: ['@amerilux/netsuite-api/client', '@amerilux/netsuite-api/testing'], message: 'api/ imports @amerilux/netsuite-api/server. The client entry is for client/, the testing entry for vitest configs.' },
];
const apiPackageClientSide = [
    { group: ['@amerilux/netsuite-api/server', '@amerilux/netsuite-api/testing'], message: 'client/ imports @amerilux/netsuite-api/client. The server entry runs in NetSuite.' },
    { group: ['api/**'], message: 'The client never imports from api/. Its types and clients are in the generated @/api/index.gen.' },
];
// Dependency guard: npm workspaces hoist every package into the root node_modules, so an import of a package this
// workspace never declared still resolves. The rule checks each import (type imports included) against the workspace's
// own package.json. Add a package with `npm install -w <workspace> <package>`.
const onlyDeclaredDependencies = (workspaceDir) => ({
    'import-x/no-extraneous-dependencies': ['error', { includeTypes: true, packageDir: [`${import.meta.dirname}/${workspaceDir}`] }],
});
// common/ runs on both sides of the wire.
const commonSideImports = [
    { group: ['N/*'], message: 'NetSuite modules belong in api/.' },
    { group: ['react', 'react-dom', 'react-dom/*'], message: 'React belongs in client/.' },
    { group: ['@amerilux/netsuite-api/*'], message: 'common/ imports the wire types from @amerilux/netsuite-api (the root) only; the server and client entries belong to api/ and client/.' },
];

export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        'netsuite/FileCabinet/**',
        'api/src/repositories/generated/**',
        'common/types/models.gen.ts',
        'client/src/api/index.gen.ts',
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
            // Path aliases (common/*, @/*, and N/* in api/) live in the workspace tsconfigs, not at the root.
            'import-x/resolver': {
                typescript: {
                    project: ['api/tsconfig.json', 'api/tsconfig.test.json', 'client/tsconfig.json', 'client/tsconfig.node.json', 'common/tsconfig.json'],
                    noWarnOnMultipleProjects: true,
                },
            },
            // common/* and @/* point into this repository, not into node_modules, so the dependency guard skips them.
            'import-x/internal-regex': '^(common|@)/',
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
        // Stubs and tests need literal ids to stand in for real ones; a model declares its own record and field ids;
        // the structure check names the id prefixes it verifies.
        files: ['**/__tests__/**', '**/test/**', 'common/model/**', 'scripts/checkStructure.mjs'],
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
        // sets. Client pages and routes call hooks, hooks call the generated client module. Client and api share code through common/ only.
        files: ['api/src/**/*.ts', 'client/src/**/*.{ts,tsx}', 'common/**/*.ts'],
        rules: {
            'import-x/no-restricted-paths': ['error', {
                zones: [
                    { target: './api/src/controllers', from: ['./api/src/repositories', './api/src/specifications', './common/model'], message: 'An endpoint never queries. Call a service.' },
                    { target: './api/src/services', from: ['./api/src/specifications', './common/model'], message: 'A service decides; the repository queries.' },
                    { target: './api/src/repositories', from: './api/src/services', message: 'A repository never decides.' },
                    { target: './api/src/specifications', from: ['./api/src/services', './api/src/controllers'], message: 'A specification is query vocabulary; it knows nothing above the repository.' },
                    { target: './api/src/specifications', from: './api/src/repositories', except: ['./generated'], message: 'A specification uses the generated fields, never a repository function.' },
                    { target: './client', from: './common/model', message: 'Models are server-side. The client uses the generated types in client/src/api/index.gen.ts and common/types/models.gen.ts.' },
                    { target: './common/model', from: './common/types', message: 'A model declares a record; it knows nothing about the wire.' },
                    { target: ['./client/src/pages', './client/src/routes', './client/src/components'], from: './client/src/api', message: 'A component never fetches. Use a hook.' },
                    { target: './client/src/hooks', from: ['./client/src/pages', './client/src/routes', './client/src/components'], message: 'A hook does not render.' },
                    { target: './client', from: './api', message: 'Client and API share code through common/ and the generated client module only.' },
                    { target: './api', from: './client', message: 'Client and API share code through common/ only.' },
                    { target: './common', from: ['./api', './client'], message: 'common/ depends on nothing project-specific.' },
                ],
            }],
        },
    },
    { files: ['api/**'], rules: onlyDeclaredDependencies('api') },
    { files: ['client/**'], rules: onlyDeclaredDependencies('client') },
    { files: ['common/**'], rules: onlyDeclaredDependencies('common') },
    { files: ['scripts/**', 'eslint.config.mjs', 'probity.config.ts'], rules: onlyDeclaredDependencies('.') },
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
        // An endpoint speaks the shapes declared next to it (an entity type, a Pick of one, or a composition) and calls a service.
        files: ['api/src/controllers/**/*.ts'],
        rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...apiPackageServerSide, ...recordAccessImports] }] },
    },
    {
        files: ['api/src/services/**/*.ts'],
        rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...apiPackageServerSide, ...recordAccessImports, ...wireShapeImports] }] },
    },
    {
        // The data-access layers inside api/: Specification in specifications, the context in repositories.
        // Models live in common/model and import the package's decorators; common/ is not restricted from it.
        files: ['api/src/specifications/**/*.ts', 'api/src/repositories/**/*.ts'],
        rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...alertingImports, ...apiPackageServerSide, ...wireShapeImports] }] },
    },
    {
        files: ['common/**/*.ts'],
        rules: {
            '@typescript-eslint/no-restricted-imports': ['error', { patterns: [...commonSideImports] }],
            'no-restricted-globals': ['error', 'window', 'document'],
        },
    },
    {
        files: ['common/netsuite.ts'],
        rules: {
            'no-restricted-syntax': ['error', {
                selector: 'Program > ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ObjectExpression.init',
                message: 'Every export in common/netsuite.ts ends with `as const`, so ids are literal types.',
            }],
            '@typescript-eslint/naming-convention': ['error',
                { selector: 'variable', modifiers: ['exported'], format: ['camelCase'] },
                { selector: 'objectLiteralProperty', format: ['camelCase'] },
            ],
        },
    },
]);
