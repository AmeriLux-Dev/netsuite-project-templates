# How to use this project

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](./README.md) says what the application is for and who owns it; this file says how the project is laid out.

The application has two halves: a frontend (React, runs in the browser) in `client/`, and a backend (SuiteScript, runs in NetSuite) in `api/`. NetSuite serves the frontend from a Suitelet, and the frontend calls the backend scripts over HTTP. The two halves share no source: the frontend's whole view of the backend is generated from the backend's controllers by `npm run generate`.

## Layout

Every entry links to its section.

<pre>
<a href="#api">api/</a>
  <a href="#srccontrollers">src/controllers/</a>
  <a href="#srcjobs">src/jobs/</a>
  <a href="#srcevents">src/events/</a>
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

There are four kinds of deployed script, one file each: a controller (an API the frontend calls), a job (background work), a user event (logic on a record being saved) and a client event (logic on a record page in the browser). A file becomes a script only when its leading JSDoc carries `@NScriptType`; everything else is bundled into the scripts that import it.

### src/controllers/

One file per deployed script, `<name>Controller.ts`.

The file holds the request and response shapes, one function per endpoint, and the Restlet or Suitelet entry point that serves them. The entry point declares the script's id and deployment id (`defineEndpoints`, `defineRestlet`, `defineSuitelet` from `@amerilux/netsuite-api/server`).

See [Adding a controller](#adding-a-controller) for the full shape of the file.

### src/jobs/

One file per Map/Reduce script, `<name>.ts`. There is no such folder until `npm run add:jobs` has been run (see [Adding a job](#adding-a-job)).

A job is background work: NetSuite runs it in stages, and it answers nothing to whoever started it. What stands in for an answer is a **run**: a row in this application's own run record. Starting a job writes the run and hands back its id; the stages read the run's input from it and write the result to it; a page follows the run by that id until it ends.

The file declares its stages and its script in one call (`defineJob` from `@amerilux/netsuite-api/server`):

- `getInputData` takes the run's input and answers the work as an array
- `map` does one item of it, and `job.write(key, value)` hands a value to the next stage
- `reduce` gathers the values written under one key
- `summarize` says what the run came to; its return value becomes the run's result

A job is layered like a controller: a stage calls a service with plain arguments and touches no `N/*` and no repository. The input and result shapes belong to the service, so the service that starts a run and the stages that do the work speak the same types.

Export the stages the job has, and always `summarize`: that is where the run is closed.

Many jobs answer nothing, because the records they write are the point. Such a job declares no `summarize` and still exports it, and the wrapper closes the run for it; one that wants a last word without a result (a notification when the run ends) declares `summarize` with a `void` return. Either way the run's result is `null`, and a page follows `status`, the progress fields and `errors` instead.

A run carries two kinds of progress, because NetSuite reports them that way. `stagePercentComplete` is how far the
**stage being worked** has got, so it counts to 100 in the map stage and starts again in the reduce stage;
`itemsProcessed` and `itemsTotal` are that stage’s own row counts, which only go up. Say the counts out loud and
keep the percent for the bar. The counts come from the task alone, so they are null once the run has ended or its task id
has been purged; a finished run reads 100 percent and has its result, which is the better thing to show by then.

### src/events/

Logic that belongs to a NetSuite record rather than to this application. Two folders, one file per script, named for what it fires on (`salesOrder.ts`):

- `user/` runs on the server when a record is saved (`@NScriptType UserEventScript`)
- `client/` runs in the browser on a record page (`@NScriptType ClientScript`)

Events are self-contained, and deliberately outside the layers. A user event works the record its context carries, logs with `N/log`, and reaches anything else in NetSuite through a repository function, so that call is tracked like any other. A client event is a page script: it calls `N/*` itself, logs with `console`, and is built without the wrapper telemetry, the same way the host script is.

The ids an event uses are written at the top of the event file, because that file is the only place they are needed.

Events have no SDF object here: **you create their script record and deployments in NetSuite**, pointing at the built file (`/SuiteScripts/{{appName}}/api/events/user/<name>.js`). `npm run deploy` uploads the file; nothing creates the record. See [Adding an event](#adding-an-event).

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

Generated from the declarations: `scripts` (every controller's script by controller name), `jobs` (every job, once the project has any) and `jobRuns` (the run record's ids, read from `netsuite-api.config.json`).

A repository passes a `scripts` entry to `createSuiteletClient`, and a service passes a `jobs` entry to `startJobRun`; `jobRuns` is what a job's declaration hands to `defineJob`.

### src/_host/

The Suitelet that serves the frontend page, and its client script. Boilerplate: the underscore marks the folder you do not add to.

The client script (`host.ts`) runs in the browser, so it is compiled with the DOM library (`tsconfig.browser.json`, which covers `src/events/client` too) and built without the wrapper's telemetry bootstrap and instrumentation (`webpack.config.js`). The rest of `src/` has no `window` or `document`.

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

Where `netsuite-api generate` reads the controllers and the jobs, and writes the generated files.

The values are the defaults; the file is there to document them. A project with jobs also has a `jobRuns` block naming the run record it deployed (`npm run add:jobs` writes it): the record's id, what its field ids start with, and any field this application added to it.

### scripts/

Node scripts run by npm: `deploy.mjs`, `buildInfo.cjs`, `checkStructure.mjs` (run by `npm run lint`) and `addJobs.mjs` (`npm run add:jobs`).

### .vscode/

`netsuite-project.code-snippets`: VS Code snippets that emit each layer's file in the shape this project expects. In a new file type the prefix and accept the completion, then tab through the placeholders. Names and ids are derived from the file name wherever the layout fixes them.

`settings.json`: puts snippets first in the suggest list and keeps the list closed while you tab through placeholders. An inline suggestion from an AI completion extension is a separate channel: press Escape to dismiss it, or Ctrl+Space to open the suggest list explicitly.

| Prefix | File |
|---|---|
| `nspControllerRestlet`, `nspControllerSuitelet` | `api/src/controllers/<name>Controller.ts` |
| `nspControllerShapes`, `nspControllerEndpoint` | one more endpoint: its request and response shapes above `defineEndpoints`, the handler inside it |
| `nspControllerParse`, `nspControllerAuthorize` | a guard for an id that comes off the wire; the `authorize` option after the endpoints |
| `nspJob` | `api/src/jobs/<name>.ts`: a Map/Reduce job as stages, with its script declaration |
| `nspJobReduce`, `nspJobParameter` | one more stage: a reduce that gathers what map wrote; one more typed script parameter on the declaration |
| `nspServiceJobStart` | one more function in a service: starts a job and answers the run id a page follows |
| `nspServiceJobStart` | one more function in a service: starts a job and answers the run id |
| `nspUserEvent`, `nspClientEvent` | `api/src/events/user/<subject>.ts`, `api/src/events/client/<subject>.ts`: self-contained SuiteScript |
| `nspService` | `api/src/services/<subject>Service.ts`, with its `build<Model>Summary` function |
| `nspRepository`, `nspRepositoryCreate`, `nspRepositoryUpdate` | `api/src/repositories/<set>Repository.ts` over `dbContext`; one more create or update through `withTracking()` |
| `nspRepositorySuitelet` | `api/src/repositories/<name>Repository.ts` calling another controller of this application through its Suitelet client |
| `nspRepositoryModule` | `api/src/repositories/<source>Repository.ts` reading a NetSuite module (`N/runtime`, `N/file`) |
| `nspSpecification` | `api/src/specifications/<set>Specifications.ts` |
| `nspModel`, `nspHelpModel`, `nspModelSubrecordClass`, `nspModelBase` | `api/src/models/<Record>.ts`: a record (a native type through `NetsuiteRecordType`, a custom record by its id string); the same with every decorator once and a comment on each, to trim down; a subrecord class (no `@RecordType` unless it has a table of its own); an abstract base. A sublist line is a record like any other: `nspModel` with `nspModelInternalId` and `nspModelParentId` |
| `nspModelField`, `nspModelFieldText`, `nspModelFieldSelect`, `nspModelFieldSplit`, `nspModelReadOnly`, `nspModelInternalId`, `nspModelParentId`, `nspModelReference`, `nspModelSubrecord`, `nspModelSublist`, `nspModelTransform`, `nspModelNotMapped`, `nspModelSetFirst`, `nspModelExcludeFromDefaultSelect` | one more property on a model, one snippet per decorator; type `nspModel` to see every option |
| `nspRepositoryLog` | a log line in the shape the lint rule accepts (repositories and `_host`) |
| `nspNetsuiteIds` | one more `as const` export in `netsuite.ts` |
| `nspTestController`, `nspTestService`, `nspTestRepository`, `nspTestRepositorySuitelet` | `api/__tests__/<layer>/<name>.test.ts`, each against a fake of the layer below |
| `nspTestHook` | `client/__tests__/<controller>Query.test.ts` |
| `nspHookQuery`, `nspHookQueryWith`, `nspHookMutation` | `client/src/hooks/use<Name>.ts`: a query for an endpoint without a request, one with a request, a mutation |
| `nspPage`, `nspRoute` (TSX) | `client/src/pages/<Name>Page.tsx`, `client/src/routes/<segment>.tsx` |
| `nspObjectRestlet`, `nspObjectSuitelet`, `nspObjectMapReduce` (XML) | `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`; the Map/Reduce one carries the job's parameters and its deployment |

A prefix is `nsp`, the folder the file belongs in, then what the snippet emits. Typing `nspRepository` lists everything a repository can take. A `nspHelp<Folder>` snippet is a reference rather than a starting point: it shows every option there is (`nspHelpModel` emits a model with every decorator once, each commented) for you to trim down. The names that used to be shorter still work as aliases (`nspRepo`, `nspSpec`, `nspHook`, `nspLog`, `nspSdfRestlet`). A file snippet's description ends with the snippet that comes next in the recipe, so a chain can be followed from the suggest list. The template repository checks every snippet before a release: expanded together into a fresh scaffold, the set must generate, typecheck and pass the structure check.

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

Workspace root: the `workspaces` list (api, client) and the npm scripts (dev, generate, typecheck, lint, test, build, deploy, update:amerilux).

### node_modules/

The only install. npm workspaces hoist every workspace's packages here, so one `npm install` at the root installs everything.

Add a package to the workspace that uses it: `npm install -w api <package>`. `npm run lint` fails when a workspace imports a package its own `package.json` does not declare.

Updating packages: `npm update` at the root moves every workspace to the newest version inside its range. The AmeriLux packages (`@amerilux/netsuite-api`, `@amerilux/netsuite-repository`, `@amerilux/netsuite-wrapper`) are still 0.x, so a caret range only floats across patch releases and a new minor is outside it; `npm run update:amerilux` installs the latest of all three into the workspaces that use them and rewrites the pins. A package used by both workspaces (`@amerilux/netsuite-api`) must carry the same range in both `package.json` files, or npm installs two copies.

If `npm install` fails with `ETARGET` (`No matching version found`), a pin names a version the registry does not have; nothing was installed. Fix the pin, then run `npm install` again from the root. Do not install into one workspace by hand: that leaves the other workspace and the lockfile behind.

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
2. `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: the script record and its deployment. The `nspObjectRestlet` or `nspObjectSuitelet` snippet fills it from the file name; or copy the `user` (Restlet) or `userRoles` (Suitelet) object and change the ids (to the ones the declaration says), names and the script file path (`api/controllers/<name>Controller.js`).
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
    Then a hook under `client/src/hooks/` (the `nspHookQueryWith` snippet; `nspHookQuery` for an endpoint without a request, `nspHookMutation` for a write) imports `{ user }` from `@/api/index.gen` and calls it: `user.api.roles()` for an endpoint without a request, `orders.api.byId({ id })` for one with. The second argument carries the abort signal: `user.api.roles(undefined, { signal })`. A shape is named through the same namespace: `user.RolesResponse`. A failed call needs no handling in the hook or the page: `main.tsx` gives `configureApiClient` the `reportApiError` handler, and the AppShell's banner shows what it reports. A page that shows the failure in place instead reads the query's `isError`, and its hook passes `{ handleError: false }` as the call's second argument. The client never imports from `api/`; the generated modules are its whole view of the backend.

Behind the controller: a service under `api/src/services/` (`<subject>Service.ts`, the `nspService` snippet) that decides, repository functions under `api/src/repositories/` (`<subject>Repository.ts`, the `nspRepository` snippet) that read and write, and for a new record type a model under `api/src/models/` (the `nspModel` snippet, or `nspHelpModel` to start from every decorator and trim; then `npm run generate`) with its `<record>Specifications.ts` (the `nspSpecification` snippet). The service takes plain arguments and returns a type it declares (`RoleSummary`, produced by `buildRoleSummary`); the controller imports that type to build its response shape, and nothing in a service imports from a controller, so a second controller can call the same service and shape its own reply. The shipped `userRoles` chain (`userRolesController.ts`, `userRolesService.ts`, `employeeRolesRepository.ts`, `employeeRolesSpecifications.ts`, `api/src/models/EmployeeRole.ts`) is the reference. Each layer has a test snippet (`nspTestController`, `nspTestService`, `nspTestRepository`, `nspTestRepositorySuitelet`, `nspTestHook`): the file name picks the names, and the mocks are already in the shape the shipped tests use.

A script that calls another controller of this application from the server (the `user` restlet calling the `userRoles` Suitelet) builds the same kind of client in a repository: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `@amerilux/netsuite-api/server`, with `scripts` from `api/src/scripts.gen.ts` and the type imported from the controller file.

`npm run lint` names any piece that is missing or disagrees with the others; `npm run generate` names a controller it cannot turn into a client; `npm run typecheck` catches a client call that names an endpoint the controller lacks.

## Adding a job

A job is one deployed Map/Reduce script: background work, started from the application or on a schedule. It answers nothing to whoever started it, so every run is a row in this application's run record, and that row is what a page follows.

If the project has no `api/src/jobs` folder yet, run **`npm run add:jobs`** once. It adds the run record and its SDF object, the cleanup script that clears old runs daily, the repository and service that read a run, the `jobRuns` controller a page polls (its `status` and `mine` endpoints), the `useJobRun` hook that polls it and picks a run up again after a refresh, and the `jobRuns` block in `netsuite-api.config.json`. It adds nothing that is already there, so running it again is safe.

Then, in order:

1. **The service** (`api/src/services/<subject>Service.ts`): the shapes on either end of a run and the functions the stages call. They belong to the service because the service that starts a run and the stages that do the work both need them.
    ```typescript
    /** What a run of the closeOldOrders job is asked to do. */
    export interface CloseOldOrdersRequest {
        olderThanDays: number;
    }

    /** What such a run leaves behind. */
    export interface CloseOldOrdersResult {
        closed: number;
    }
    ```
2. **`api/src/jobs/<name>.ts`**: the whole job in one file (the `nspJob` snippet). The NetSuite header, then the stages and the script declaration in one `defineJob` call.
    ```typescript
    /**
     * @NApiVersion 2.1
     * @NScriptType MapReduceScript
     * @NModuleScope SameAccount
     */
    import { defineJob } from '@amerilux/netsuite-api/server';
    import type { JobSummary } from '@amerilux/netsuite-api/server';
    import { jobRuns } from '../scripts.gen';
    import { closeOrder, listOldOrderIds, type CloseOldOrdersRequest, type CloseOldOrdersResult } from '../services/ordersService';

    export const { getInputData, map, summarize } = defineJob({
        name: 'closeOldOrders',
        scriptId: 'customscript_{{prefix}}_close_old_orders_mr',
        deployments: ['customdeploy_{{prefix}}_close_old_orders_mr'],
        runParameter: 'custscript_{{prefix}}_close_old_orders_run',
        parameters: { batchSize: { id: 'custscript_{{prefix}}_batch_size', type: 'integer' } },
        runs: jobRuns,
    }, {
        getInputData: (input: CloseOldOrdersRequest): number[] => listOldOrderIds(input.olderThanDays),
        map: (orderId: number, job): void => {
            closeOrder(orderId);
            job.write(String(orderId), 1);
        },
        summarize: (summary: JobSummary<number>): CloseOldOrdersResult => ({ closed: summary.output.length }),
    });
    ```
    `getInputData`'s first parameter is the run's input and `summarize`'s return type is its result: `npm run generate` reads the shapes from those two annotations, the way it reads an endpoint's request and response. The values carried between stages are JSON, so a stage says what it expects (`values: number[]` on a reduce stage, `JobSummary<Total>` on summarize) and the wrapper hands them back that way. A stage calls a service with plain arguments; `N/*` and repositories are as out of bounds here as in a controller.

    Export the stages the job has, and `summarize` always: it is where the run is closed, and a job without it would leave every run of it looking unfinished. A stage exported but not declared throws when NetSuite calls it — except `summarize`, which the wrapper closes the run with when the job declares none of its own. That is how a job that answers nothing is written:
    ```typescript
    export const { getInputData, map, summarize } = defineJob({ /* … */ }, {
        getInputData: (input: ResendFailedRequest): number[] => listFailedOrderIds(input.since),
        map: (orderId: number): void => resendOrder(orderId),
    });
    ```
    Its run's result is `null`, and the page follows `status`, the progress fields and `errors`. A job that wants a last word without a result — a notification once the run ends — declares `summarize` with a `void` return instead.

    The declaration creates nothing. `deployments` is how many runs of the job can overlap, because NetSuite runs one instance of a deployment at a time: add a second deployment (the same id plus `_2`) for a job two people may start at once. `runParameter` is the script parameter the run id arrives in, and `parameters` are the job's own, typed for the stages and read from the deployment.
3. **`netsuite/Objects/customscript_{{prefix}}_<snake_name>_mr.xml`**: the script record, its parameters and its deployments (the `nspObjectMapReduce` snippet). Every deployment the declaration lists and every parameter it names must be here; `npm run lint` says so otherwise. A job that runs on a schedule carries a `<recurrence>` on its deployment, as the cleanup script does: the schedule belongs in SDF, because a deploy overwrites the deployment record and would drop one entered in the account.
4. **`npm run generate`**: `api/src/scripts.gen.ts` gets the job under `jobs`, and `client/src/api/<name>Job.gen.ts` gets the run's `Input` and `Result` types, reached as `jobs.<name>` from `@/api/index.gen`. Nothing callable is generated for a job: a page starts one through a controller.
5. **Starting it.** The service decides and builds the run's input (the `nspServiceJobStart` snippet); `startJobRun`, in the repository `npm run add:jobs` wrote, submits the task. An endpoint hands the run id to the page:
    ```typescript
    // api/src/services/ordersService.ts
    import { startJobRun } from '../repositories/jobRunRepository';
    import { jobs } from '../scripts.gen';

    /** Starts a run and answers its id; the page follows the run by that id. */
    export function startClosingOldOrders(olderThanDays: number): string {
        return startJobRun(jobs.closeOldOrders, { olderThanDays } satisfies CloseOldOrdersRequest);
    }

    // api/src/controllers/ordersController.ts
    closeOld: (request: CloseOldRequest): CloseOldResponse => ({ runId: startClosingOldOrders(request.olderThanDays) }),
    ```
    The input is built in the service because a repository never names a service's type: `startJobRun` takes the job and the input as they come, and `satisfies` checks the shape where it is written.
    When every deployment of the job is already running, starting it answers **409** and no run is written, because nothing started; the page can say so and offer to try again.
6. **Following it.** The page passes the job's name and the run id to `useJobRun`, naming the job's result type:
    ```typescript
    const { run, isRunning, isMissing, result } = useJobRun<jobs.closeOldOrders.Result>({ job: 'closeOldOrders', runId });
    // run?.status, run?.stage, run?.errors, result?.closed
    // `${run?.itemsProcessed ?? 0} of ${run?.itemsTotal ?? 0}` — the rows this stage has done
    ```
    `stagePercentComplete` is the **stage's** progress and not the run's: it reaches 100 in the map stage and
    starts again in the reduce stage. `itemsProcessed` and `itemsTotal` are that stage's row counts, which only
    go up, so they are the honest thing to put in front of someone. The counts come from the task alone and are null
    once the run has ended; by then it reads 100 percent and has its result.

    **A refresh loses the run id, not the run.** The run records who started it, so a page called with no
    run id asks the `mine` endpoint for the caller's own runs of that job and picks up the one still going;
    `resume: 'latest'` takes the newest run whether it ended or not, for a page that should show the last
    result again, and `resume: 'none'` turns that off. Keep the run id in the URL as well (`?run=812`) and a
    reload comes back to the same run even when the caller has several going.

    Coming back to a run that has **already finished** needs nothing special: the record still holds the
    result, so the first ask answers `complete` with it and the hook never starts polling. A run that is
    gone — cleaned up after its retention days, or never the caller's — is not an error either: `isMissing`
    says so, the error banner is not involved, and the page can drop the stale id and offer to start again.
    It polls every two seconds and stops by itself when the run is complete or failed. A run that dies before it writes anything is `failed`, not silence: reading a run asks NetSuite about the task as well, so a task it gave up on, or one that finished without writing a result, comes back as a failure with a reason. `run.errors` carries everything that went wrong in the run, one entry per failed key.
7. **Tests.** A job is tested through its stages: `mapContextFor`, `reduceContextFor` and `summarizeContextFor` from `@amerilux/netsuite-api/testing` build the contexts NetSuite would pass, and `written` on the first two says what the stage handed to the stage after it.

Run records are not history: the cleanup job removes them after the number of days on its deployment's `Retention Days` parameter (7 by default). Change it in NetSuite; no deploy needed.

## Adding an event

An event is logic that belongs to a NetSuite record rather than to this application: a user event when a record is saved, a client event on a record page in the browser. Events are self-contained, and they are the one kind of script whose record you create in NetSuite yourself.

1. **The file**, named for what it fires on: `api/src/events/user/<subject>.ts` (the `nspUserEvent` snippet) or `api/src/events/client/<subject>.ts` (`nspClientEvent`).
    ```typescript
    /**
     * @NApiVersion 2.1
     * @NScriptType UserEventScript
     * @NModuleScope SameAccount
     */
    import * as log from 'N/log';
    import type { EntryPoints } from 'N/types';
    import { listOpenOrdersForCustomer } from '../../repositories/salesOrdersRepository';

    /** The ids this event works with, written here because the event is its own. */
    const fields = {
        memo: 'memo',
    } as const;

    export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (context: EntryPoints.UserEvent.beforeSubmitContext): void => {
        if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) return;
        try {
            const open = listOpenOrdersForCustomer(Number(context.newRecord.getValue({ fieldId: 'entity' })));
            context.newRecord.setValue({ fieldId: fields.memo, value: String(open.length) + ' open orders' });
        } catch (error) {
            log.error('event failed', { record: context.newRecord.type, id: context.newRecord.id, message: error instanceof Error ? error.message : String(error) });
        }
    };
    ```
    A user event works the record its context carries and logs with `N/log`; anything else in NetSuite it reaches through a repository function, so the call is tracked like any other and can be tested. It catches what it throws and logs it: an event that fails should not stop someone saving a record, unless refusing the save is the point of the event. A client event is the other way round: it runs in the browser, so it calls `N/*` itself and logs with `console`, and nothing of this application belongs in it.
2. **`npm run build`** puts the file in the File Cabinet at `/SuiteScripts/{{appName}}/api/events/user/<subject>.js`, and `npm run deploy` uploads it.
3. **Create the script record in NetSuite**: Customization › Scripting › Scripts › New, select the uploaded file, then add a deployment per record type, with the execution contexts and the audience it should run for. A client event is either deployed the same way or attached to a form from a user event's `beforeLoad` (`context.form.clientScriptModulePath`).

There is no SDF object for an event and no entry in the structure check beyond the file name and the script type: what an event is deployed to lives in the account, where whoever deploys it can see it. Ids the event uses are written at the top of the file.

## Naming

Two rules from `CLAUDE.md`, applied to this layout: a function name gets more specific as its responsibility narrows, a variable name gets more specific as its visibility widens, and nothing is abbreviated. The snippets emit these names from the file name wherever the layout fixes them.

**A type is named for what it is, by layer.**

| Layer | Type | Example |
|---|---|---|
| Model | the record, singular; its set on `dbContext` is the plural in camelCase | `EmployeeRole`, `dbContext.employeeRoles` |
| Generated | the entity type and its create and patch shapes | `EmployeeRole`, `EmployeeRoleCreate`, `EmployeeRolePatch` |
| Repository | a type of its own only for what no model declares | `ActiveUser` |
| Service | what it hands up: a `Pick` of an entity type is `<Model>Summary`; a composition is named for what it composes | `RoleSummary`, `ActiveUserRoles` |
| Controller | the wire, one pair per endpoint, no controller prefix | `ByEmployeeRequest`, `ByEmployeeResponse` |

**A function is named for what it does, with a verb.** A function that produces a value of a type is `build<Type>`: `buildRoleSummary(role)` says what comes out, its parameter says what goes in, and it sits next to the type it builds. When a second source for the same type appears, the source joins the name (`buildRoleSummaryFromRole`). `to<Type>` is not used: that name belongs to the type, and a function's name is a verb.

| Layer | Verb | Example |
|---|---|---|
| Repository | `list`, `find`, `read`, `create`, `update`, `remove`, then the set and the filter | `listEmployeeRolesByEmployee`, `readActiveUser`, `createSalesOrder` |
| Service | the decision, in the domain's words | `getRolesByEmployee`, `approveOldestPendingSalesOrder` |
| Endpoint | the operation, short; the controller scopes it | `list`, `byId`, `byEmployee`, `create` |
| Specification | the condition, as a predicate | `forEmployee`, `pendingFulfillment` |
| Guard | `parse<Field>` | `parseEmployeeId` |
| Hook | `use<What>`, with `<what>QueryKey` and `<what>QueryOptions` beside it; a mutation is `use<Verb><What>` | `useActiveUserRoles`, `useCreateOrder` |

## Removing a rule you have outgrown

`npm run lint` checks two kinds of rule. ESLint's recommended rules are about the language. Everything else is a convention of this template: the structure check in `scripts/checkStructure.mjs` (a controller's declaration, exports and SDF object agree) and each commented block of `eslint.config.mjs` (the layers, the id and log rules, the dependency guard, the entry each side imports). A convention is there so that the shipped pieces, the generated code and the snippets keep fitting together. When this project moves past one, delete the rule rather than working around it; nothing else depends on it.

- The structure check: delete `scripts/checkStructure.mjs` and drop `&& node scripts/checkStructure.mjs` from the `lint` script in `package.json`. The ESLint override that names the file then matches nothing, which is fine. Update the "Adding a controller" steps above, `CLAUDE.md` and the snippets in `.vscode/` to whatever the new layout is.
- An ESLint convention: delete its block in `eslint.config.mjs` (the comment above each block says what it enforces) and the constants at the top of the file that only that block used.

The check and the ESLint blocks are run only by `npm run lint`; `npm run build` and `npm run deploy` do not depend on them.
