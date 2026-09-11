// The application's names and the ids no model owns. No N/* imports: the client bundles this file too.
// A record's type and field ids are declared on its model in common/model/; this file is for the
// rest: script ids for the client, and anything reached without a model (script parameters, saved
// searches, list values).

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
    user: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' },
    /** Runs as Administrator so it can read role assignments; called by the user restlet through api/src/_lib/suiteletClient.ts, not by the browser. */
    userRoles: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_user_roles', deployId: 'customdeploy_{{prefix}}_user_roles' },
    // @netsuite-project:scripts
} as const satisfies Record<string, ScriptRef>;
