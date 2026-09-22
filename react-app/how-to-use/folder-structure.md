# Folder structure

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](../README.md) says what the application is for and who owns it; this folder says how to use the project. This file lays out the folders. Each part of the backend that has machinery of its own has a worked example beside it, one feature written end to end in the order it runs:

- [repositories/model-and-repository.md](repositories/model-and-repository.md): a record, from its model to the repository functions that read and write it
- [controllers/restlet-controller.md](controllers/restlet-controller.md): an API the frontend calls, from the controller to the page
- [controllers/suitelet-controller.md](controllers/suitelet-controller.md): a Suitelet that runs as another role, called from the server and from the browser
- [jobs/map-reduce-job.md](jobs/map-reduce-job.md): a Map/Reduce job, from the page that starts it to the result it leaves behind

[naming.md](naming.md) says how types and functions are named in each layer. The examples build on one another in that order, all around sales orders, and the template repository compiles, lints and tests them before every release.

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
<a href="#how-to-use">how-to-use/</a>
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

`npm run generate` runs once, from the root, before every root command (dev, build, typecheck, test); nothing else triggers it. It writes `src/repositories/generated/` and `src/types/models.gen.ts` from the models, then reads the controllers and the jobs and writes `src/scripts.gen.ts` and the client's generated files. A workspace script run directly (`npm run typecheck -w api`, `npm run build -w api`) assumes it has run.

Every folder is flat, and the file name carries the layer: `userController.ts`, `userService.ts`, `activeUserRepository.ts`, `employeeRolesSpecifications.ts`. Services and repositories are named after what they handle, not after a controller.

There are four kinds of deployed script, one file each: a controller (an API the frontend calls), a job (background work), a user event (logic on a record being saved) and a client event (logic on a record page in the browser). A file becomes a script only when its leading JSDoc carries `@NScriptType`; everything else is bundled into the scripts that import it.

### src/controllers/

One file per deployed script, `<name>Controller.ts`.

The file holds the request and response shapes, one function per endpoint, and the Restlet or Suitelet entry point that serves them. The entry point declares the script's id and deployment id (`defineEndpoints`, `defineRestlet`, `defineSuitelet` from `@amerilux/netsuite-api/server`).

[controllers/restlet-controller.md](controllers/restlet-controller.md) adds one step by step; [controllers/suitelet-controller.md](controllers/suitelet-controller.md) covers a Suitelet that runs as another role, `authorize` and document downloads.

### src/jobs/

One folder per Map/Reduce script, and the folder is everything about that job. There is no `api/src/jobs` at all until `npm run add:jobs` has been run.

```
api/src/jobs/closeOldOrders/
  closeOldOrders.ts    the script NetSuite loads: which stages there are, and nothing else
  contract.ts          every shape the run carries: what it is started with, what the stages hand each other, the result
  getInputData.ts      what the work is
  map.ts               what one item does
  reduce.ts            what everything written under one key comes to
  summarize.ts         what the run leaves behind
  start.ts             how a run is started, for a controller to call
```

A job is background work: NetSuite runs it in stages, and it answers nothing to whoever started it. What stands in for an answer is a **run**: a row in this application's own run record. Starting a job writes the run and hands back its id; the stages read the run's input from it and write the result to it; a page follows the run by that id until it ends.

Each stage is NetSuite's own entry point, in a file of its own name, built by the builder of that stage (`jobMap`, from the jobRunRepository `npm run add:jobs` writes), which handles the run and the JSON between the stages. The shapes the run carries are all in `contract.ts`, and every stage imports its types from there, so the chain reads in one place and two stages naming the same value name the one declaration. The job's ids are in `netsuite.ts`, under `jobs`, beside its SDF object.

A job's folder is a service's peer: it calls services and repositories, and touches no `N/*` beyond the context types, no model, specification or controller. Nothing below it may import it; only a controller reaches in, for the `start<Name>` its `start.ts` declares.

[jobs/map-reduce-job.md](jobs/map-reduce-job.md) writes one end to end.

### src/events/

Logic that belongs to a NetSuite record rather than to this application. Two folders, one file per script, named for what it fires on (`salesOrder.ts`):

- `user/` runs on the server when a record is saved (`@NScriptType UserEventScript`)
- `client/` runs in the browser on a record page (`@NScriptType ClientScript`)

Events are self-contained, and deliberately outside the layers. A user event works the record its context carries, logs with `N/log`, and reaches anything else in NetSuite through a repository function, so that call is tracked like any other. A client event is a page script: it calls `N/*` itself, logs with `console`, and is built without the wrapper telemetry, the same way the host script is.

The ids an event uses are written at the top of the event file, because that file is the only place they are needed.

Events have no SDF object here: **you create their script record and deployments in NetSuite**, pointing at the built file (`/SuiteScripts/{{appName}}/api/events/user/<name>.js`). `npm run deploy` uploads the file; nothing creates the record. The `nspUserEvent` and `nspClientEvent` snippets emit the file.

### src/services/

One file per subject, `<subject>Service.ts`.

The decisions: plain arguments in (an id, a filter, the fields of a create), repository functions called by their domain names, a type the service declares itself out. A service never names a controller, so any controller can call it and shape its own reply. What it exports starts with `get`, `create`, `update` or `remove` (`is` or `has` for a yes-or-no check); a `build<Type>` stays inside it. Each repository is imported as a namespace (`salesOrdersRepository.findSalesOrder(id)`), so a service function can share a name with the repository function it calls ([naming.md](naming.md)).

### src/repositories/

One file per subject, `<subject>Repository.ts`.

The only code that touches NetSuite: records, queries, the session, other scripts.

`generated/` is written by `npm run generate`. [repositories/model-and-repository.md](repositories/model-and-repository.md) walks from a model to its repository functions.

### src/specifications/

One file per record type, `<record>Specifications.ts`.

Reusable query filters, used by repositories.

### src/models/

One class per NetSuite record type: its record type id and the field ids the app uses. A native record type is named through `NetsuiteRecordType` from `@amerilux/netsuite-repository` (`@RecordType(NetsuiteRecordType.SALES_ORDER)`), a custom record by its id (`@RecordType('customrecord_{{prefix}}_x')`). A model imports nothing from `N/*`: `npm run generate` evaluates it outside NetSuite.

Written once, here; `npm run generate` reads them.

### src/types/

`models.gen.ts` is generated from the models: one entity type per model, what the controllers' shapes pick from.

`build.d.ts` declares the build-time constants.

### src/scripts.gen.ts

Generated from the declarations: `scripts` (every controller's script by controller name) and, once `npm run add:jobs` has run, `jobRuns` (the run record's ids, read from `netsuite-api.config.json`).

A repository passes a `scripts` entry to `createSuiteletClient`, and `jobRuns` is what the run store is built from. A job's own ids are not here: they are in `netsuite.ts`, and a job's `start.ts` passes its entry to `startJobRun`.

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

One `<name>.gen.ts` per controller: its request and response types, the entity types it names and, for a controller the browser calls, its client `api`: one function per endpoint, each calling the package's `callEndpoint` with the controller's script. One `<name>Job.gen.ts` per job: the type of the result its runs leave behind.

`index.gen.ts` re-exports each under the controller's name: `user.api.roles()`, `user.RolesResponse`; and the jobs under `jobs`: `jobs.closeOldOrders.Result`.

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

One XML file per script record and its deployments: every controller and job, and the run record once `npm run add:jobs` has run. Never an event.

### FileCabinet/

Build output: the bundled frontend and backend files. Never edited.

### manifest.xml and deploy.xml

The SDF manifest and what to deploy.

## Root files

### how-to-use/

This file, [naming.md](naming.md), and one folder of worked examples per part of the backend that has machinery of its own (`repositories/`, `controllers/`, `jobs/`). The examples are the full code of one feature, so they are the place to copy from; the snippets in `.vscode/` emit the same shapes one file at a time.

### netsuite.ts

The application's names (`app`), the ids of every job (`jobs`), and any id no controller or model owns: script parameters, saved searches, list values.

Imported by both `api/` and `client/` (a page or component imports it by relative path), so it holds exported constants and types only, no imports.

### netsuite-api.config.json

Where `netsuite-api generate` reads the controllers and the jobs, and writes the generated files.

The values are the defaults; the file is there to document them. A project with jobs also has a `jobRuns` block naming the run record it deployed (`npm run add:jobs` writes it): the record's id, what its field ids start with, and any field this application added to it.

### scripts/

Node scripts run by npm: `deploy.mjs`, `buildInfo.cjs`, `checkStructure.mjs` (run by `npm run lint`) and `addJobs.mjs` (`npm run add:jobs`).

### .vscode/

`netsuite-project.code-snippets`: VS Code snippets that each write one whole file in the shape this project expects, with every option that file can take: a model with every decorator, a repository with every read and write, a controller with every kind of endpoint and `authorize`, a client event with every entry point. Keep what the file needs and delete the rest. In a new file type the prefix and accept the completion, then tab through the placeholders. Names and ids are derived from the file name wherever the layout fixes them.

`settings.json`: puts snippets first in the suggest list and keeps the list closed while you tab through placeholders. An inline suggestion from an AI completion extension is a separate channel: press Escape to dismiss it, or Ctrl+Space to open the suggest list explicitly.

| Prefix | File |
|---|---|
| `nspControllerRestlet`, `nspControllerSuitelet` | `api/src/controllers/<name>Controller.ts`: a filtered list, `byId`, `create`, `update` and `remove`, a guard for what comes off the wire, `authorize`; the Suitelet adds a CSV download and `browser: false` to uncomment |
| `nspJob` | `api/src/jobs/<name>/<name>.ts`: the file NetSuite loads, the header and all four stages it exports |
| `nspJobGetInputData`, `nspJobMap`, `nspJobReduce`, `nspJobSummarize` | one stage file each, with the shapes on that stage's own boundary |
| `nspJobStart` | `api/src/jobs/<name>/start.ts`: starts a run and answers the id a page follows |
| `nspUserEvent`, `nspClientEvent` | `api/src/events/user/<subject>.ts`, `api/src/events/client/<subject>.ts`: self-contained SuiteScript with every entry point of its kind |
| `nspService` | `api/src/services/<subject>Service.ts`: `<Model>Summary` and the `build<Model>Summary` it maps with, a list, a single read, a create, an update, a removal and a permission check |
| `nspRepository` | `api/src/repositories/<set>Repository.ts` over `dbContext`: every read the set offers, every write through `withTracking()`, several records saved at once |
| `nspRepositorySuitelet` | `api/src/repositories/<name>Repository.ts` calling another controller of this application through its Suitelet client |
| `nspRepositoryModule` | `api/src/repositories/<source>Repository.ts` reading a NetSuite module (`N/runtime`, `N/file`) |
| `nspSpecification` | `api/src/specifications/<set>Specifications.ts`: one builder per kind of condition, `include`, an order and a page |
| `nspModel`, `nspModelBase` | `api/src/models/<Record>.ts`: a record with every decorator and option, commented, and a subrecord class and a sublist line class in the same file (a line usually moves to a file of its own); an abstract base a record class extends |
| `nspTestController`, `nspTestService`, `nspTestRepository`, `nspTestRepositorySuitelet` | `api/__tests__/<layer>/<name>.test.ts`, each against a fake of the layer below, one `describe` per function the matching snippet writes |
| `nspTestHook` | `client/__tests__/<controller>Query.test.ts` |
| `nspHookQuery`, `nspHookMutation` | `client/src/hooks/use<Name>.ts`: a query with its key and options (drop the argument for an endpoint without a request), a mutation |
| `nspPage`, `nspRoute` (TSX) | `client/src/pages/<Name>Page.tsx`, `client/src/routes/<segment>.tsx` |
| `nspObjectRestlet`, `nspObjectSuitelet`, `nspObjectMapReduce` (XML) | `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`; the Map/Reduce one carries the job's run parameter and its deployment |

A prefix is `nsp`, the folder the file belongs in, then what the snippet emits. No snippet adds lines to a file that exists already: a job's ids go in `netsuite.ts` by hand, as [jobs/map-reduce-job.md](jobs/map-reduce-job.md) shows. The names that used to be shorter still work as aliases (`nspRepo`, `nspSpec`, `nspHook`, `nspHookWith`, `nspMutation`, `nspSdfRestlet`). A file snippet's description ends with the snippet that comes next in the recipe, so a chain can be followed from the suggest list. The template repository checks every snippet before a release: expanded together into a fresh scaffold with nothing deleted, the set must generate, typecheck and pass the structure check.

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

Workspace root: the `workspaces` list (api, client) and the npm scripts (dev, generate, typecheck, lint, test, build, deploy, add:jobs, update:amerilux).

### node_modules/

The only install. npm workspaces hoist every workspace's packages here, so one `npm install` at the root installs everything.

Add a package to the workspace that uses it: `npm install -w api <package>`. `npm run lint` fails when a workspace imports a package its own `package.json` does not declare.

Updating packages: `npm update` at the root moves every workspace to the newest version inside its range. The AmeriLux packages (`@amerilux/netsuite-api`, `@amerilux/netsuite-repository`, `@amerilux/netsuite-wrapper`) are still 0.x, so a caret range only floats across patch releases and a new minor is outside it; `npm run update:amerilux` installs the latest of all three into the workspaces that use them and rewrites the pins. A package used by both workspaces (`@amerilux/netsuite-api`) must carry the same range in both `package.json` files, or npm installs two copies.

If `npm install` fails with `ETARGET` (`No matching version found`), a pin names a version the registry does not have; nothing was installed. Fix the pin, then run `npm install` again from the root. Do not install into one workspace by hand: that leaves the other workspace and the lockfile behind.
