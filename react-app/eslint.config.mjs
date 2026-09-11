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
// An endpoint speaks the wire shapes in common/dto; the service maps entities to them.
const entityTypeImports = [{ group: ['common/types/models.gen', '**/common/types/models.gen'], message: 'An endpoint takes and returns DTOs from common/dto. The service maps entities to them.' }];
// A controller's contract is declared once, in common/types/<controller>.ts, next to its endpoint types.
const contractDeclarationImports = [{ group: ['common/types/api', '**/types/api'], importNames: ['defineContract'], message: 'A contract is declared once, in common/types/<controller>.ts. Import the contract, not defineContract.' }];
// common/ runs on both sides of the wire.
const commonSideImports = [
    { group: ['N/*'], message: 'NetSuite modules belong in api/.' },
    { group: ['react', 'react-dom', 'react-dom/*'], message: 'React belongs in client/.' },
];

export default defineConfig([
    globalIgnores([
        '**/node_modules/**',
        'netsuite/FileCabinet/**',
        'api/src/repositories/generated/**',
        'common/types/models.gen.ts',
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
            // Path aliases (common/*, @/*, N/*) live in the workspace tsconfigs, not at the root.
            'import-x/resolver': {
                typescript: {
                    project: ['api/tsconfig.json', 'api/tsconfig.test.json', 'client/tsconfig.json', 'client/tsconfig.node.json', 'common/tsconfig.json'],
                    noWarnOnMultipleProjects: true,
                },
            },
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
        // sets. Client pages and routes call hooks, hooks call client/src/api. Client and api share code through common/ only.
        files: ['api/src/**/*.ts', 'client/src/**/*.{ts,tsx}', 'common/**/*.ts'],
        rules: {
            'import-x/no-restricted-paths': ['error', {
                zones: [
                    { target: './api/src/controllers', from: ['./api/src/repositories', './api/src/specifications', './common/model'], message: 'An endpoint never queries. Call a service.' },
                    { target: './api/src/services', from: './api/src/controllers', message: 'A service does not know about the wire.' },
                    { target: './api/src/services', from: ['./api/src/specifications', './common/model'], message: 'A service decides; the repository queries.' },
                    { target: './api/src/repositories', from: ['./api/src/services', './api/src/controllers'], message: 'A repository never decides.' },
                    { target: './api/src/specifications', from: ['./api/src/services', './api/src/controllers'], message: 'A specification is query vocabulary; it knows nothing above the repository.' },
                    { target: './api/src/specifications', from: './api/src/repositories', except: ['./generated'], message: 'A specification uses the generated fields, never a repository function.' },
                    { target: './api/src/lib', from: ['./api/src/controllers', './api/src/services', './api/src/repositories', './api/src/specifications', './common/model'], message: 'lib/ is transport plumbing; it depends on nothing above it.' },
                    { target: './client', from: './common/model', message: 'Models are server-side. The client uses common/dto and the generated types in common/types/models.gen.ts.' },
                    { target: './common/model', from: ['./common/dto', './common/types'], message: 'A model declares a record; it knows nothing about the wire.' },
                    { target: './common/dto', from: './common/model', message: 'A DTO picks from the generated types in common/types/models.gen.ts, never from a model class.' },
                    { target: ['./client/src/pages', './client/src/routes', './client/src/components'], from: './client/src/api', message: 'A component never fetches. Use a hook.' },
                    { target: './client/src/hooks', from: ['./client/src/pages', './client/src/routes', './client/src/components'], message: 'A hook does not render.' },
                    { target: './client/src/api', from: ['./client/src/hooks', './client/src/pages', './client/src/routes', './client/src/components'], message: 'client/src/api only talks to endpoints.' },
                    { target: './client', from: './api', message: 'Client and API share code through common/ only.' },
                    { target: './api', from: './client', message: 'Client and API share code through common/ only.' },
                    { target: './common', from: ['./api', './client'], message: 'common/ depends on nothing project-specific.' },
                ],
            }],
        },
    },
    {
        files: ['client/src/**/*.{ts,tsx}'],
        languageOptions: { globals: { ...globals.browser } },
        plugins: { 'react-hooks': reactHooks },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            'no-restricted-globals': ['error', { name: 'fetch', message: 'fetch lives in client/src/api. Call a typed api function.' }],
            'no-restricted-imports': ['error', { patterns: [...contractDeclarationImports] }],
        },
    },
    {
        files: ['client/src/api/**/*.{ts,tsx}'],
        rules: { 'no-restricted-globals': 'off' },
    },
    {
        files: ['api/src/**/*.ts'],
        // SuiteScript's own globals plus the build-time constants webpack defines.
        languageOptions: { globals: { define: 'readonly', __APP_VERSION__: 'readonly', __BUILD_ID__: 'readonly' } },
        rules: {
            'no-console': 'error', // invisible in NetSuite; the wrapper's log is the only signal path
            'no-restricted-syntax': ['error', ...netsuiteIdOutsideNetsuiteTs, ...logEntryShape],
            'no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...contractDeclarationImports] }],
        },
    },
    {
        files: ['api/src/controllers/**/*.ts'],
        rules: { 'no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...recordAccessImports, ...entityTypeImports, ...contractDeclarationImports] }] },
    },
    {
        files: ['api/src/services/**/*.ts'],
        rules: { 'no-restricted-imports': ['error', { patterns: [...alertingImports, ...sharedPackageImports, ...recordAccessImports, ...contractDeclarationImports] }] },
    },
    {
        // The data-access layers inside api/: Specification in specifications, the context in repositories.
        // Models live in common/model and import the package's decorators; common/ is not restricted from it.
        files: ['api/src/specifications/**/*.ts', 'api/src/repositories/**/*.ts'],
        rules: { 'no-restricted-imports': ['error', { patterns: [...alertingImports] }] },
    },
    {
        files: ['common/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', { patterns: [...commonSideImports] }],
            'no-restricted-globals': ['error', 'window', 'document'],
        },
    },
    {
        // Contracts are declared in common/types; the wire shapes and the models never declare one.
        files: ['common/dto/**/*.ts', 'common/model/**/*.ts'],
        rules: { 'no-restricted-imports': ['error', { patterns: [...commonSideImports, ...contractDeclarationImports] }] },
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
