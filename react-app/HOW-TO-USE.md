# How to use this project

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](./README.md) says what the application is for and who owns it; this file says how the project is laid out.

The application has two halves: a frontend (React, runs in the browser) in `client/`, and a backend (SuiteScript, runs in NetSuite) in `api/`. NetSuite serves the frontend from a Suitelet, and the frontend calls the backend scripts over HTTP. The two halves share no source: the frontend's whole view of the backend is generated from the backend's controllers by `npm run generate`.

## Layout

Every entry links to its section.

<pre>
<a href="#api">api/</a>
  <a href="#srccontrollers">src/controllers/</a>
  <a href="#srcservices">src/services/</a>
  <a href="#srcrepositories">src/repositories/</a>
  <a href="#srcspecifications">src/specifications/</a>
  <a href="#srcmodels">src/models/</a>
  <a href="#srctypes">src/types/</a>
  <a href="#srcscriptsgents">src/scripts.gen.ts</a>
  <a href="#src_host">src/_host/</a>
  <a href="#__tests__">__tests__/</a>
  <a href="#netsuite-wrapperconfigjs">netsuite-wrapper.config.js</a>
<a href="#client">client/</a>
  <a href="#srcroutes">src/routes/</a>
  <a href="#srcpages">src/pages/</a>
  <a href="#srchooks">src/hooks/</a>
  <a href="#srcapi">src/api/</a>
  <a href="#srccomponents">src/components/</a>
  <a href="#srcstyles">src/styles/</a>
  <a href="#__tests__-1">__tests__/</a>
  <a href="#serverts">server.ts</a>
  <a href="#envexample">.env.example</a>
<a href="#netsuite">netsuite/</a>
  <a href="#objects">Objects/</a>
  <a href="#filecabinet">FileCabinet/</a>
  <a href="#manifestxml-and-deployxml">manifest.xml</a>
  <a href="#manifestxml-and-deployxml">deploy.xml</a>
<a href="#netsuitets">netsuite.ts</a>
<a href="#netsuite-apiconfigjson">netsuite-api.config.json</a>
<a href="#scripts">scripts/</a>
<a href="#vscode">.vscode/</a>
<a href="#claude">.claude/</a>
<a href="#readmemd">README.md</a>
<a href="#claudemd">CLAUDE.md</a>
{{#if probity}}
<a href="#probityconfigts">probity.config.ts</a>
{{/if}}
<a href="#packagejson">package.json</a>
<a href="#node_modules">node_modules/</a>
</pre>

## api/

The backend. Webpack bundles it into one JavaScript file per deployed script.

`npm run generate` runs once, from the root, before every root command (dev, build, typecheck, test); nothing else triggers it. It writes `src/repositories/generated/` and `src/types/models.gen.ts` from the models, then reads the controllers and writes `src/scripts.gen.ts` and the client's generated files. A workspace script run directly (`npm run typecheck -w api`, `npm run build -w api`) assumes it has run.

Every folder is flat, and the file name carries the layer: `userController.ts`, `userService.ts`, `activeUserRepository.ts`, `employeeRolesSpecifications.ts`. Services and repositories are named after what they handle, not after a controller.

### src/controllers/

One file per deployed script, `<name>Controller.ts`.

The file holds the request and response shapes, one function per endpoint, and the Restlet or Suitelet entry point that serves them. The entry point declares the script's id and deployment id (`defineEndpoints`, `defineRestlet`, `defineSuitelet` from `@amerilux/netsuite-api/server`).

See [Adding a controller](#adding-a-controller) for the full shape of the file.

### src/services/

One file per subject, `<subject>Service.ts`.

The decisions: read the request, call repository functions, shape the reply.

### src/repositories/

One file per subject, `<subject>Repository.ts`.

The only code that touches NetSuite: records, queries, the session, other scripts.

`generated/` is written by `npm run generate`.

### src/specifications/

One file per record type, `<record>Specifications.ts`.

Reusable query filters, used by repositories.

### src/models/

One class per NetSuite record type: its record type id and the field ids the app uses. A native record type is named through `NetsuiteRecordType` from `@amerilux/netsuite-repository` (`@RecordType(NetsuiteRecordType.SALES_ORDER)`), a custom record by its id (`@RecordType('customrecord_x')`). A model imports nothing from `N/*`: `npm run generate` evaluates it outside NetSuite.

Written once, here; `npm run generate` reads them.

### src/types/

`models.gen.ts` is generated from the models: one entity type per model, what the controllers' shapes pick from.

`build.d.ts` declares the build-time constants.

### src/scripts.gen.ts

Generated from the controllers' declarations: every script by controller name.

This is what a repository passes to `createSuiteletClient`.

### src/_host/

The Suitelet that serves the frontend page, and its client script. Boilerplate: the underscore marks the folder you do not add to.

The client script (`host.ts`) runs in the browser, so it is the one file compiled with the DOM library (`tsconfig.host.json`) and the one script built without the wrapper's telemetry bootstrap and instrumentation (`webpack.config.js`). The rest of `src/` has no `window` or `document`.

### __tests__/

Unit tests for the backend.

The `N/*` modules resolve to the stubs `@amerilux/netsuite-api/testing` ships (see `vitest.config.mts`).

### netsuite-wrapper.config.js

Telemetry for the backend, read by `webpack.config.js`. It sets:

- the PerformanceTracker scope key every script runs under
- where each run's spans and log lines go: the PerformanceTracker records, and optionally an external log system over HTTPS
- whether functions are instrumented

With telemetry on, every log line carries the run id, the function, its arguments and the call chain without any change to the call. Put `@ptrk-ignore-arguments` above a function whose arguments must not be captured.

The scope's mode (off, boundary, diagnostic) is set in the PerformanceTracker app, not here.

## client/

The frontend: React 19, TanStack Router, TanStack Query, Tailwind 4. Vite builds it into one file.

### src/routes/

One file per URL (`#/orders`); `__root.tsx` is the layout around every page.

`routeTree.gen.ts` is generated.

### src/pages/

One component per route: what is on screen.

A page calls hooks, never the API directly.

### src/hooks/

Fetching and caching, one hook per endpoint. The only code that calls `src/api/index.gen.ts`.

`useApiErrors.ts` keeps the failures the generated clients report (`main.tsx` hands its `reportApiError` to `configureApiClient`), for the banner.

### src/api/

Generated by `npm run generate`, never edited, nothing else lives here.

One `<name>.gen.ts` per controller: its request and response types, the entity types it names, its `Endpoints` type and, for a controller the browser calls, its client `api`.

`index.gen.ts` re-exports each under the controller's name: `user.api.roles()`, `user.RolesResponse`.

### src/components/

Shared UI pieces: the AppShell header and outlet, and the `ApiErrorBanner` that shows every reported API failure until it is dismissed.

### src/styles/

Tailwind entry point and global CSS.

### __tests__/

Unit tests for hooks.

### server.ts

Local development proxy: signs requests to your sandbox so `npm run dev` works without a NetSuite session.

Limitation: it can only reach Restlets. NetSuite accepts an OAuth 2.0 token for Restlets and REST web services, not for Suitelets, so a Suitelet controller the browser calls (`browser` not `false`) works deployed but not under `npm run dev`. Test it in the account.

### .env.example

The values `server.ts` needs; copy to `.env` (gitignored).

## netsuite/

The SDF project that suitecloud deploys.

### Objects/

One XML file per script record and its deployment.

### FileCabinet/

Build output: the bundled frontend and backend files. Never edited.

### manifest.xml and deploy.xml

The SDF manifest and what to deploy.

## Root files

### netsuite.ts

The application's names (`app`) and any id no controller or model owns: script parameters, saved searches, list values.

Imported by both `api/` and `client/` (a page or component imports it by relative path), so it holds exported constants and types only, no imports.

### netsuite-api.config.json

Where `netsuite-api generate` reads the controllers and writes the generated files.

The values are the defaults; the file is there to document them.

### scripts/

Node scripts run by npm: `deploy.mjs`, `buildInfo.cjs`, `checkStructure.mjs` (run by `npm run lint`).

### .vscode/

`netsuite-project.code-snippets`: VS Code snippets that emit each layer's file in the shape this project expects. In a new file type the prefix and accept the completion, then tab through the placeholders. Names and ids are derived from the file name wherever the layout fixes them.

`settings.json`: puts snippets first in the suggest list and keeps the list closed while you tab through placeholders. An inline suggestion from an AI completion extension is a separate channel: press Escape to dismiss it, or Ctrl+Space to open the suggest list explicitly.

| Prefix | File |
|---|---|
| `nspControllerRestlet`, `nspControllerSuitelet` | `api/src/controllers/<name>Controller.ts` |
| `nspEndpoint` | one more endpoint inside `defineEndpoints` |
| `nspService` | `api/src/services/<subject>Service.ts` |
| `nspRepo` | `api/src/repositories/<subject>Repository.ts` |
| `nspSpec` | `api/src/specifications/<record>Specifications.ts` |
| `nspModel`, `nspField` | `api/src/models/<Record>.ts` (a native record type through `NetsuiteRecordType`, a custom record by its id string); one more field |
| `nspHook` | `client/src/hooks/use<Name>.ts` |
| `nspSdfRestlet`, `nspSdfSuitelet` (XML) | `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml` |

### .claude/

Claude Code settings.

### README.md

Purpose, owners, dependencies, deployment, support and decisions of this application.

### CLAUDE.md

Project brief for Claude Code.

{{#if probity}}
### probity.config.ts

Agent guardrails, hooked up in `.claude/settings.json`.

{{/if}}
### package.json

Workspace root: the `workspaces` list (api, client) and the npm scripts (dev, generate, typecheck, lint, test, build, deploy).

### node_modules/

The only install. npm workspaces hoist every workspace's packages here, so one `npm install` at the root installs everything.

Add a package to the workspace that uses it: `npm install -w api <package>`. `npm run lint` fails when a workspace imports a package its own `package.json` does not declare.

## Adding a controller

A controller is one deployed script (a Restlet or a Suitelet) with named endpoints. Every call is a POST whose JSON body carries the request plus an `endpoint` property naming the endpoint; the operation is the endpoint's name (`list`, `byId`, `create`, `update`, `remove`). The shipped `user` controller is the reference; the `nspControllerRestlet` and `nspControllerSuitelet` snippets (`.vscode/`) emit the same shape from the file name. Create these in order:

1. `api/src/controllers/<name>Controller.ts`: the whole controller in one file. The NetSuite header first, then the request and response shapes, then one function per endpoint, then the entry point with the script declaration. A handler's parameter is its request and its return value its response; a handler with no parameter takes no request. Shapes are the wire, not the record: an entity type from `api/src/types/models.gen.ts`, a type a service returns, a `Pick` of one, or a composition of several.
    ```typescript
    /**
     * @NApiVersion 2.1
     * @NScriptType Suitelet
     * @NModuleScope SameAccount
     */
    import { ApiError, defineEndpoints, defineSuitelet } from '@amerilux/netsuite-api/server';
    import { getRolesByEmployee, type RoleSummary } from '../services/userRolesService';

    export interface ByEmployeeRequest {
        employeeId: number;
    }

    export interface ByEmployeeResponse {
        employeeId: number;
        roles: RoleSummary[];
    }

    /** The wire promises a number; a caller that sends something else gets a 400, not a query for NaN. */
    function parseEmployeeId(requested: number | string | undefined): number {
        const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : requested;
        if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) {
            throw ApiError.badRequest('employeeId must be a positive whole number.', { employeeId: requested });
        }
        return parsed;
    }

    export const userRolesEndpoints = defineEndpoints({
        byEmployee: (request: ByEmployeeRequest): ByEmployeeResponse => {
            const employeeId = parseEmployeeId(request.employeeId);
            return { employeeId, roles: getRolesByEmployee(employeeId) };
        },
    });

    export type UserRolesEndpoints = typeof userRolesEndpoints;

    export const onRequest = defineSuitelet({
        name: 'userRoles',
        scriptId: 'customscript_{{prefix}}_user_roles',
        deployId: 'customdeploy_{{prefix}}_user_roles',
        browser: false,
    }, userRolesEndpoints);
    ```
    A Restlet ends with `export const post = defineRestlet({ ... }, userEndpoints);` instead, and its header says `@NScriptType Restlet`. That last statement, the header and the SDF object are the only transport-specific pieces. An endpoint is the only code that knows the wire: it unpacks the request, calls a service with plain arguments, and shapes the response from what the service returns. A check on what came off the wire (an id sent as a string) lives in the controller, as `parseEmployeeId` does; the service takes a number and trusts it.

    The declaration is the controller's own statement of the script it is deployed as. It creates nothing: the controller builds and tests before the record exists. The ids are `customscript_{{prefix}}_<snake_name>` and `customdeploy_{{prefix}}_<snake_name>`, at most 40 characters, and can be changed to whatever the record and deployment are called in NetSuite; the generated client follows. `browser: false` marks a script only server code calls: its types are generated, its client is not.

    Two options ride on the define call after the endpoints. `authorize: ({ endpoint, request }) => void` runs before every handler; throw `ApiError.forbidden()` to reject a call (read the session through a repository function). And a Suitelet handler may return `rawResponse({ contentType, body, fileName })` or `rawResponse({ file, inline })` with `RawResponse` (from `@amerilux/netsuite-api/server`) as its return type: the answer is written as a document instead of the envelope, and the generated client resolves that endpoint to a `Blob`. A Restlet cannot answer that way.

    `npm run generate` reads this file as source to write the client, so these are rules, each an error with a message when broken: every handler is written inline with both types annotated; every type in the file is exported; a type is imported only from `../types/models.gen`, from a service under `../services/` (copied into the generated module together with the entity types it is built on) or from another controller; the declaration is an object literal with literal ids whose `name` is the file name without `Controller`; script ids are unique across controllers; no wire shape is named `Endpoints`. A shape's name carries no controller prefix (`ByEmployeeRequest`, not `UserRolesByEmployeeRequest`): the generated module is scoped by controller already.
2. `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: the script record and its deployment. The `nspSdfRestlet` or `nspSdfSuitelet` snippet fills it from the file name; or copy the `user` (Restlet) or `userRoles` (Suitelet) object and change the ids (to the ones the declaration says), names and the script file path (`api/controllers/<name>Controller.js`).
3. `npm run generate`: rewrites the generated files. `client/src/api/<name>.gen.ts` gets the controller's types, the entity types they name, its `Endpoints` type and, unless `browser: false`, its client `api`; `client/src/api/index.gen.ts` re-exports the module as `<name>`; `api/src/scripts.gen.ts` gets its script:
    ```typescript
    // client/src/api/user.gen.ts
    export type Endpoints = {
        /** The caller and every role assigned to them. Takes no request; the session says who is calling. */
        roles: () => RolesResponse;
    };

    export const api = createApiClient<Endpoints>({ kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' });

    // client/src/api/index.gen.ts
    export * as user from './user.gen';
    ```
    Then a hook under `client/src/hooks/` (the `nspHook` snippet) imports `{ user }` from `@/api/index.gen` and calls it: `user.api.roles()` for an endpoint without a request, `orders.api.byId({ id })` for one with. The second argument carries the abort signal: `user.api.roles(undefined, { signal })`. A shape is named through the same namespace: `user.RolesResponse`. A failed call needs no handling in the hook or the page: `main.tsx` gives `configureApiClient` the `reportApiError` handler, and the AppShell's banner shows what it reports. A page that shows the failure in place instead reads the query's `isError`, and its hook passes `{ handleError: false }` as the call's second argument. The client never imports from `api/`; the generated modules are its whole view of the backend.

Behind the controller: a service under `api/src/services/` (`<subject>Service.ts`, the `nspService` snippet) that decides, repository functions under `api/src/repositories/` (`<subject>Repository.ts`, the `nspRepo` snippet) that read and write, and for a new record type a model under `api/src/models/` (the `nspModel` snippet, then `npm run generate`) with its `<record>Specifications.ts` (the `nspSpec` snippet). The service takes plain arguments and returns a type it declares (`RoleSummary`); the controller imports that type to build its response shape, and nothing in a service imports from a controller, so a second controller can call the same service and shape its own reply. The shipped `userRoles` chain (`userRolesController.ts`, `userRolesService.ts`, `employeeRolesRepository.ts`, `employeeRolesSpecifications.ts`, `api/src/models/EmployeeRole.ts`) is the reference.

A script that calls another controller of this application from the server (the `user` restlet calling the `userRoles` Suitelet) builds the same kind of client in a repository: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `@amerilux/netsuite-api/server`, with `scripts` from `api/src/scripts.gen.ts` and the type imported from the controller file.

`npm run lint` names any piece that is missing or disagrees with the others; `npm run generate` names a controller it cannot turn into a client; `npm run typecheck` catches a client call that names an endpoint the controller lacks.

## Removing a rule you have outgrown

`npm run lint` checks two kinds of rule. ESLint's recommended rules are about the language. Everything else is a convention of this template: the structure check in `scripts/checkStructure.mjs` (a controller's declaration, exports and SDF object agree) and each commented block of `eslint.config.mjs` (the layers, the id and log rules, the dependency guard, the entry each side imports). A convention is there so that the shipped pieces, the generated code and the snippets keep fitting together. When this project moves past one, delete the rule rather than working around it; nothing else depends on it.

- The structure check: delete `scripts/checkStructure.mjs` and drop `&& node scripts/checkStructure.mjs` from the `lint` script in `package.json`. The ESLint override that names the file then matches nothing, which is fine. Update the "Adding a controller" steps above, `CLAUDE.md` and the snippets in `.vscode/` to whatever the new layout is.
- An ESLint convention: delete its block in `eslint.config.mjs` (the comment above each block says what it enforces) and the constants at the top of the file that only that block used.

The check and the ESLint blocks are run only by `npm run lint`; `npm run build` and `npm run deploy` do not depend on them.
