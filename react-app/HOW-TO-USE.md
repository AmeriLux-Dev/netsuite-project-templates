# How to use this project

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](./README.md) says what the application is for and who owns it; this file says how to work on it.

## Why this shape

- **A Suitelet hosts a React single-page app.** NetSuite serves the page and the session; the bundle is one file in the File Cabinet, found by folder and file name, never by internal id.
- **One script per controller, no router.** Each controller is a folder under `api/src/controllers/`: transport-agnostic handlers under `endpoints/` and one file with an `@NScriptType` header that serves them as a Restlet or a Suitelet. Endpoints are the controller's actions, as in ASP.NET: named, each with its own HTTP method, chosen by the `endpoint` parameter of the call, so a controller can have as many GETs as it needs. Switching transport is a change to that file, its SDF object and the `kind` in `scripts`; the endpoints and the client do not change. Permissions, logging and log filtering stay per script.
- **Every NetSuite magic string has one home.** A record's type and field ids are declared on its model in `common/model/`, which is what the repository package reads; script ids and any id no model owns live in `common/netsuite.ts`. The client calls restlets through the `scripts` registry, so ids are typed and change in one place.
- **Three kinds of shared type, each in its own folder.** `common/model/` declares records; `npm run generate` turns them into entity types in `common/types/models.gen.ts`, which both sides may import; `common/dto/` holds what goes over the wire, picked from the entity types; `common/types/<controller>.ts` holds the contract that gives each endpoint its method. An endpoint sees DTOs only; the service maps entities to them.
- **Typed data access** through `@amerilux/netsuite-repository` (decorated models, generated context) and instrumented `N/*` calls through `@amerilux/netsuite-wrapper`.

## Prerequisites

- Node 22 or newer
- Java 17 or newer (the SuiteCloud CLI needs it)
- A NetSuite role that can deploy SDF projects; run `npx suitecloud account:setup` once per account

## Setup

```sh
npm install
npx suitecloud account:setup   # pick or create an authentication id; writes the gitignored project.json
cp client/.env.example client/.env
npm run dev
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite dev server on port 3000 plus the local restlet proxy on port 4000 |
| `npm run build` | Builds the client (Vite) and then the API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/` |
| `npm run deploy` | Build, then `suitecloud project:adddependencies` and `project:deploy`; refuses while example code is present |
| `npm run deploy:files` | Build, then upload only the File Cabinet files (fast path after a UI change); same guard |
| `npm run generate` | Regenerate the repository context, field paths and `common/types/models.gen.ts` from `common/model/` (build, test, typecheck and dev run it first) |
| `npm test` | Vitest in every workspace |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint over the whole repository, then the structure check (`scripts/checkStructure.mjs`) |

## Layout

```
common/                 Shared by api and client; compiles without NetSuite types
  model/                Decorated record models: each declares its record type and field ids (server-side only)
  dto/                  Request and response shapes of each controller's endpoints: the wire, picked from the entity types
  types/                api.ts (envelope, defineContract), one contract per controller, models.gen.ts (generated entity types)
  netsuite.ts           App names, script ids, and ids no model owns
api/                    SuiteScript, bundled by webpack into one AMD file per script
  src/controllers/      One folder per controller: <name>Controller.ts (Restlet or Suitelet) + endpoints/
  src/host/             The Suitelet that serves the SPA and its client script
  src/services/         Decisions: interpret the request, call repositories, shape the reply
  src/repositories/     Query and write functions over dbContext (generated/ is produced, gitignored)
  src/specifications/   Query predicates, one module per record type
  src/lib/              endpoint, defineRestlet, defineSuitelet, ApiError, File Cabinet helpers
  test/stubs/N/         vi.fn shells for N/* modules
  __tests__/            Vitest specs
client/                 React 19, TanStack Router (file-based, hash history), TanStack Query, Tailwind 4
  src/routes/           One file per route; __root.tsx is the layout (routeTree.gen.ts is generated)
  src/api/              apiClient (createApiClient) and one typed module per controller
  src/pages/            One component per page; a page calls hooks, never the api modules
  src/hooks/            TanStack Query hooks, the only callers of src/api
  server.ts             Local dev proxy that signs OAuth 2.0 requests to the sandbox
netsuite/               The SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
scripts/                deploy.mjs, buildInfo.cjs, checkStructure.mjs (run by npm run lint)
README.md               Purpose, owners, dependencies, deployment, support and decisions of this application
CLAUDE.md               Project brief for Claude Code
.claude/skills/         add-controller: the recipe an agent follows to add a controller
{{#if probity}}
probity.config.ts       Agent guardrails (hooked up in .claude/settings.json)
{{/if}}
```

## Build output

```
netsuite/FileCabinet/SuiteScripts/{{appName}}/
  client/app.js                      the SPA (Vite, IIFE, CSS injected by JS)
  api/host/homeController.js         the Suitelet
  api/host/host.js                   client script attached to the Suitelet form
  api/controllers/customers/customersController.js
```

Building the client empties only `client/`; building the API empties only `api/`.

## Deploy

The customers controller, its SDF object and the customers page are scaffold examples, marked with `@netsuite-project:example`. `npm run deploy` and `npm run deploy:files` refuse to run while any marked file is present, so the example never ends up in a File Cabinet. Replace it with your own controller (see [Adding a controller](#adding-a-controller)) or delete it. Deleting means every file of the example, its tests included, and then pointing the `/` route at your own page:

- `api/src/controllers/customers/`, `api/src/services/customers.ts`, `api/src/repositories/customers.ts`, `api/src/specifications/customers.ts`
- `api/__tests__/services/customers.test.ts`, `api/__tests__/repositories/customers.test.ts`
- `netsuite/Objects/customscript_{{prefix}}_customers.xml` and the `customers` entry in `scripts` (`common/netsuite.ts`)
- `common/types/customers.ts`, `common/dto/customers.ts`, and `common/model/Customer.ts` unless your own code reads customers
- `client/src/pages/CustomersPage.tsx`, `client/src/hooks/useCustomers.ts`, `client/src/api/customersApi.ts`, `client/__tests__/customersQuery.test.ts`
- `client/src/routes/index.tsx` imports `CustomersPage`; give it your own component

`--allow-example` overrides the guard for a throwaway sandbox.

`npm run deploy` needs a `project.json` with the authentication id to use. `npx suitecloud account:setup` writes it. The Suitelet appears under Customization › Scripting › Scripts as **{{appTitle}} Home**.

The client bundle URL carries `?v=<version>-<buildId>`, so a new deploy is picked up without a manual version bump.

## Adding a controller

A controller is one deployed script serving named endpoints, as in ASP.NET: `orders` with `list`, `byId`, `create`. Eight pieces make one; `npm run lint` runs `scripts/checkStructure.mjs`, which fails until every piece exists and they agree, so the structure holds whether a person or an agent writes it. With Claude Code, the `add-controller` skill (`.claude/skills/add-controller/SKILL.md`) walks through the same list with the shape of each file; the `customers` controller is the reference.

| # | File | Holds |
|---|---|---|
| 1 | `common/netsuite.ts` | `scripts.orders = { kind, scriptId: 'customscript_{{prefix}}_orders', deployId: 'customdeploy_{{prefix}}_orders' }`, above the `@netsuite-project:scripts` marker. The only place an id is written. |
| 2 | `common/dto/orders.ts` | One request and one response type per endpoint, picked from the entity types in `common/types/models.gen.ts`. GET parameters arrive as strings. |
| 3 | `common/types/orders.ts` | `OrdersEndpoints` (request and response per endpoint) and `ordersContract = defineContract<OrdersEndpoints>({ list: { method: 'GET' }, ... })`, one entry per line. |
| 4 | `api/src/controllers/orders/endpoints/<endpoint>.ts` | One `Endpoint<Request, Response>` per endpoint, named like an ASP.NET action, calling a service. |
| 5 | `api/src/controllers/orders/endpoints/index.ts` | `defineEndpoints(ordersContract, { list, byId, create })`. |
| 6 | `api/src/controllers/orders/ordersController.ts` | The `@NScriptType` header and `defineRestlet('orders', ordersEndpoints)` (exporting the methods the contract uses) or `defineSuitelet`. |
| 7 | `netsuite/Objects/customscript_{{prefix}}_orders.xml` | The SDF `<restlet>` or `<suitelet>` object, named after the script id, pointing at `/SuiteScripts/{{appName}}/api/controllers/orders/ordersController.js` and declaring the deployment. Copy the customers (Restlet) or home (Suitelet) object. |
| 8 | `client/src/api/ordersApi.ts` | `createApiClient(scripts.orders, ordersContract)`: one typed function per endpoint. A hook under `client/src/hooks/` calls it; pages call the hook. |

Services, repository functions and specifications behind the endpoints follow the customers example and start with a failing test under `api/__tests__/`. Script ids are capped at 40 characters: `customscript_` takes 13, so `{{prefix}}_<snake_name>` must fit in 27.

What the structure check enforces, beyond the files existing: script and deployment ids share the prefix and the name; the SDF object's root element and the source file's `@NScriptType` match `kind`; the contract's endpoint names, the files under `endpoints/` and the handlers bound in `index.ts` are the same set; every controller folder, SDF script object and `@NScriptType` file belongs to a `scripts` entry. ESLint adds the import rules: endpoints never import entity types or query, `defineContract` is only called under `common/types/`, and a model never imports the wire.

### Switching a controller between Restlet and Suitelet

1. In `<name>Controller.ts`, change `@NScriptType` and swap `defineRestlet` for `defineSuitelet` (or back).
2. Replace the SDF object in `netsuite/Objects/` with the other element type (`<restlet>` or `<suitelet>`).
3. Set `kind` on `scripts.<name>` in `common/netsuite.ts`. The client reads it to build the URL, so `client/src/api/<name>Api.ts` does not change.

## Adding a page

Routes are files under `client/src/routes/`: `orders.tsx` serves `#/orders`, `orders.$orderId.tsx` serves `#/orders/:orderId`, and `__root.tsx` is the layout around all of them. Export a `Route` built with `createFileRoute` and point its `component` at a page under `src/pages/`; the page's data comes from a hook under `src/hooks/`. The Vite plugin regenerates `src/routeTree.gen.ts` on `npm run dev` and `npm run build`; commit that file but never edit it.

## Adding a model

1. Add a decorated class under `common/model/` (see `Customer.ts`). Its record type and field ids are written on the decorators; nothing goes in `common/netsuite.ts`.
2. `npm run generate` writes the entity type to `common/types/models.gen.ts` (shared with the client, type-only) and the config and field paths to `api/src/repositories/generated/<Model>.gen.ts`, and refreshes `context.gen.ts`. Both are gitignored; every script that needs them runs generate first.
3. Add its query vocabulary under `api/src/specifications/`, the query functions under `api/src/repositories/` (reads through `dbContext.<set>`, writes through `dbContext.withTracking()`), and the decisions under `api/src/services/`. Endpoints call services and stay thin.

{{#if performanceTracker}}
## PerformanceTracker

`api/netsuite-wrapper.config.js` enables the `performance-tracker` telemetry integration, so every wrapped `N/record`, `N/query`, `N/search`, `N/https` and `N/task` call writes an execution span to the PerformanceTracker custom record. The PerformanceTracker bundle must be installed in the target account. Set `telemetryBootstrap: false` and `instrumentation: false` to turn it off.

{{/if}}
## Local dev proxy

`client/server.ts` forwards `/api/restlet` to the sandbox restlet domain and `/api/suitelet` to the application domain, both with an OAuth 2.0 client-credentials token. It reads `client/.env` (gitignored); `client/.env.example` lists the values. The private key stays outside the repository. Nothing account-specific is exposed to Vite, so nothing account-specific ends up in the uploaded bundle.

## Testing

- `api/__tests__/` and `client/__tests__/` hold the Vitest specs; tests are never colocated with source.
- `N/*` modules and the wrapper's module entry points resolve to `api/test/stubs/N/`.
- Repository functions read through the generated `dbContext`, so a test mocks it with a fake carrying the record sets it needs. Service tests mock the repository module.
- UI markup is not unit-tested; hooks and API modules are.

## Working with an AI coding agent

- `CLAUDE.md` is the project brief Claude Code reads on every session: commands, layout and the rules below.
- `.claude/settings.json` pre-approves the read-only npm scripts (generate, typecheck, lint, build, test).
{{#if probity}}
- `probity.config.ts` turns the mechanical rules into guardrails through [Probity](https://github.com/nizos/probity): no destructive commands, tests and typecheck before a commit, no `N/*` in `common/`, no writes to generated output or secrets, tests only under `__tests__/`, no focused tests, and test-first for services, repositories, the transport wrappers in `api/src/lib/`, client API modules and hooks. `.claude/settings.json` wires it into Claude Code's `PreToolUse` hook; the same config works for Codex and Copilot CLI (see Probity's setup guide).
- Remove the `enforceTdd` block from `probity.config.ts` if test-first enforcement is not wanted; the rest stays useful on its own.
{{/if}}
{{#unless probity}}
- This project was scaffolded without [Probity](https://github.com/nizos/probity) guardrails. To add them later: `npm install -D @nizos/probity`, create `probity.config.ts`, and add its `PreToolUse` hook to `.claude/settings.json` as described in Probity's setup guide. Scaffolding with `--probity` produces a ready-made config.
{{/unless}}

## Conventions

- Function names get more specific as their scope narrows; variable names get more specific as their visibility widens. Never abbreviate.
- `common/` never imports `N/*`.
- Script ids: `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`, at most 40 characters.
- Endpoints are transport-agnostic functions under `controllers/<name>/endpoints/`, one file per endpoint named like an ASP.NET action; the contract in `common/types/<name>.ts` gives each its method, and a Restlet controller exports only the HTTP methods its endpoints use.
- Layers: endpoint calls service, service calls repository, repository composes specifications. Only `model/`, `specifications/` and `repositories/` import `@amerilux/netsuite-repository`; only a repository touches records. Endpoints speak DTOs; services map entities to them. `npm run lint` enforces the boundaries and the structure of every controller.
- Log titles are constant phrases; controller, method and ids go in the details object.
- Secrets never enter the repository: no account ids, auth ids, `project.json`, `.env` or key files.
