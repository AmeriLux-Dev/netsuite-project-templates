// Single home for NetSuite magic strings. No N/* imports: the client bundles this file too.

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
        hostScriptPath: '/SuiteScripts/{{appName}}/api/host/host.js',
    },
    rootElementId: 'react-root',
} as const;

/** Record types and field ids, one flat map. A custom field follows the same pattern: customerExampleFlag: 'custentity_{{prefix}}_example'. */
export const netsuite = {
    customer: 'customer',
    customerCompanyName: 'companyname',
    customerEmail: 'email',
} as const satisfies Record<string, string>;

/** How a script is reached over HTTP; the client builds the URL from it. */
export type ScriptKind = 'restlet' | 'suitelet';

export interface ScriptRef {
    kind: ScriptKind;
    scriptId: string;
    deployId: string;
}

/** Every script this application deploys. `kind` must match the controller's @NScriptType and its SDF object. */
export const scripts = {
    home: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_home', deployId: 'customdeploy_{{prefix}}_home' },
    customers: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_customers', deployId: 'customdeploy_{{prefix}}_customers' },
    // @netsuite-project:scripts
} as const satisfies Record<string, ScriptRef>;
