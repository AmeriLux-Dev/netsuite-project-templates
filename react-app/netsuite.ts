// The application's names and the ids no controller or model owns. A controller declares its own
// script and deployment ids (in its defineRestlet or defineSuitelet call); a model declares its record
// and field ids. What is left, the names, the File Cabinet paths, and anything reached without a
// controller or a model (script parameters, saved searches, list values), lives here.
//
// `npm run generate` copies this file into client/src/api/index.gen.ts verbatim, so it holds exported
// constants and types only: no imports, nothing that runs.

/** The application's names and File Cabinet layout; the host Suitelet and the client both read it. */
export const app = {
    name: '{{appName}}',
    title: '{{appTitle}}',
    prefix: '{{prefix}}',
    fileCabinet: {
        /** Top-level folder under /SuiteScripts holding both bundles. */
        folder: '{{appName}}',
        clientFolder: 'client',
        clientBundle: 'app.js',
        /** Module path of the client script attached to the Suitelet form. */
        hostScriptPath: '/SuiteScripts/{{appName}}/api/_host/host.js',
    },
    rootElementId: 'react-root',
} as const;
