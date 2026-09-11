# {{appTitle}}

Suitelet-hosted React application for NetSuite, scaffolded by create-netsuite-project (`react-app` template). `HOW-TO-USE.md` has the longer explanation of commands and layout; `README.md` records the purpose, owners, dependencies, deployment, support and decisions of this application and is written by the people who own it.

## Commands

| Command | Use it for |
|---|---|
| `npm run generate` | Regenerate `api/src/repositories/generated/` from the decorated models. Run after touching `common/models/`. |
| `npm run typecheck` | `tsc --noEmit` in every workspace (runs generate first). |
| `npm run lint` | ESLint over the repository. |
| `npm test` | Vitest in `api/` and `client/`. |
| `npm run build` | Client (Vite) then API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/`. |
| `npm run dev` | Vite on port 3000 plus the local restlet proxy on port 4000. Needs `client/.env`. |
| `npm run add:controller -- <name> [--endpoints list:get,byId:get,create:post] [--suitelet]` | New controller folder with one file per endpoint, its contract, SDF object, shared types, client API, `scripts.<name>` entry. Use it instead of hand-writing script ids. |
| `npm run deploy` / `npm run deploy:files` | Deploy to the account in `project.json`. Only when the person asked for it. |

Before a commit: `npm run typecheck`, `npm run lint`, `npm test`.

## Where things live

- `common/` is shared by api and client. `common/models/` holds the `@RecordType` classes: a model is the declaration of a record, so its type and field ids are written on it and nowhere else; `npm run generate` reads them. `common/netsuite.ts` holds `app` (the application's names and File Cabinet files), `scripts` with every script and deployment id, and any id no model owns (script parameters, saved searches, list values). Keep the `// @netsuite-project:scripts` marker inside `scripts`. The client never imports a model.
- The `customers` controller, page and API module are the scaffold's example, marked `@netsuite-project:example`; `npm run deploy` refuses while they exist. Replace or delete them rather than building on them.
- `api/src/controllers/<name>/`: one folder per controller. `endpoints/` holds one transport-agnostic function per endpoint, named like an ASP.NET action (`list`, `byId`, `create`) in a file of the same name, each with the HTTP method the contract in `common/types/<name>.ts` gives it (`Endpoint<Request, Response>`, bound in `endpoints/index.ts` by `defineEndpoints(contract, handlers)`). The caller names the endpoint with the `endpoint` parameter: a query parameter on GET, a body property otherwise. `<name>Controller.ts` is the only transport-specific file and serves them through `defineRestlet` or `defineSuitelet` from `api/src/lib/`, which supply the envelope, error mapping and timing. A file becomes a deployed script only when its leading JSDoc carries `@NScriptType`; everything else under `api/src/` is bundled into the scripts that import it. Endpoints stay thin: call a service, return its result. Switching transport touches the controller file, its SDF object and `kind` on the `scripts` entry, nothing else.
- `api/src/services/`: decisions. A service interprets the request, calls repository functions by their domain names, and shapes the reply. It never imports `N/*`, `repositories/generated/context.gen` or the repository package; model types from `repositories/generated/<Model>.gen` are fine.
- `api/src/repositories/`: data access. Functions read through `dbContext.<set>` from `generated/context.gen` (no tracking) and write through `dbContext.withTracking()`, kept in a local and finished before returning. A flow that reads and writes several records under one change tracker is a single repository function. `generated/` is produced by `npm run generate` and holds the models' types, fields and the context.
- `api/src/specifications/`: query vocabulary, one module per record type of `Specification` builders. Imported by repositories only.
- `api/src/host/`: the Suitelet that serves the SPA and its client script. The bundle is found by folder and file name, never by internal id.
- `client/src/routes/`: file-based routing (TanStack Router, hash history); `routeTree.gen.ts` is produced by the Vite plugin. Pages live under `client/src/pages/`, hooks under `client/src/hooks/`, one API module per controller under `client/src/api/`, each `createApiClient(scripts.<name>, <name>Contract)`: one typed function per endpoint (`customersApi.byId({ id })`), the URL picked from the script's `kind`. A page calls a hook; only a hook calls `client/src/api`.
- `netsuite/`: the SDF project. `Objects/*.xml` are script records; `FileCabinet/` is build output.
- Tests live in `api/__tests__/` and `client/__tests__/`; `N/*` and the wrapper's module entry points resolve to `api/test/stubs/N/`. Test hooks, API modules, services, repositories and the transport wrappers, not UI markup. Each layer is tested against a fake of the layer below it: a repository test mocks the generated `dbContext` with a fake carrying the sets it reads, a service test mocks the repository module.

## Conventions

- **Naming.** A function name gets more specific as its responsibility narrows (`update` → `updateTransaction` → `updateTransactionShippingAddress`). A variable name gets more specific as its visibility widens (`transaction` inside a function, `vendorBillTransaction` at file scope, `vendorBillTransactionTemplate` globally). Never abbreviate.
- **SuiteScript constraints.** Server handlers are synchronous. Emitted code targets ES2019, so optional chaining and nullish coalescing are downlevelled by TypeScript. `N/*` calls are rewritten to the wrapper at build time; do not add a custom externals function to `api/webpack.config.js`.
- **Script ids** are `customscript_{{prefix}}_<name>` / `customdeploy_{{prefix}}_<name>`, at most 40 characters.
- **Layers.** Endpoint calls service, service calls repository, repository composes specifications. `npm run lint` enforces the imports each layer may make; a violation names the layer that should do the work instead.
- **Logging.** A log title is the same short phrase every time (`endpoint completed`); the controller, method and record ids go in the details object. Never glue ids into a title or a details string, and never `console.log` in `api/`.
{{#unless probity}}

## Rules

- Tests go under a `__tests__/` folder, never next to source, and are never focused or skipped.
- `common/` never imports `N/*`; it is bundled into the client too.
- NetSuite identifiers are declared on the model that owns them (`common/models/`) or in `common/netsuite.ts`, never written as string literals in `api/src/` or `client/src/`.
- Never edit generated output: `api/src/repositories/generated/`, `client/src/routeTree.gen.ts`, `netsuite/FileCabinet/`.
- Never write secrets or account selection: no `project.json`, `client/.env`, keys or certificates, and nothing account-specific under the Vite client prefix (Vite inlines it into the uploaded bundle). Update `.env.example` instead.
- Run `npm test` and `npm run typecheck` before a commit, and `npm test` before any deploy. Deploying is a human action: do not run `npm run deploy` or `suitecloud` uploads unless asked.
- No recursive force deletes, no `--no-verify`, no force push without `--force-with-lease`.
{{/unless}}
{{#if probity}}

## Guardrails

Probity (`probity.config.ts`, hooked into Claude Code through `.claude/settings.json`) enforces the rules of this repository mechanically and blocks: destructive commands, commits without tests and typecheck, deploys without tests, `N/*` imports in `common/`, NetSuite ids as string literals outside `common/netsuite.ts`, writes to generated output or secret files, colocated or focused tests. It also requires a failing test first for services, repositories, the transport wrappers in `api/src/lib/`, client API modules and hooks. When a block fires, fix the cause rather than working around it.
{{/if}}
