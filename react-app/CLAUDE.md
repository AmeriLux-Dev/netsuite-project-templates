# {{appTitle}}

Suitelet-hosted React application for NetSuite, scaffolded by create-netsuite-project (`react-app` template). `api/` is SuiteScript{{#if netsuiteApi}},{{/if}}{{#unless netsuiteApi}} and{{/unless}} `client/` is React{{#if netsuiteApi}}, and the client's whole view of the backend is generated from the controllers{{/if}}. `how-to-use/` explains the layout (`folder-structure.md`) and the names (`naming.md`){{#if codeGeneration}}, and writes one feature end to end per part: {{#if netsuiteRepository}}`repositories/model-and-repository.md`{{/if}}{{#if bothNetsuitePackages}}, {{/if}}{{#if netsuiteApi}}`controllers/restlet-controller.md`, `controllers/suitelet-controller.md`, `jobs/map-reduce-job.md`{{/if}}{{/if}}. `README.md` belongs to the application's owners.

## Commands

| Command | Use it for |
|---|---|
{{#if codeGeneration}}
| `npm run generate` | After changing {{#if netsuiteRepository}}a model{{/if}}{{#if bothNetsuitePackages}}, {{/if}}{{#if netsuiteApi}}a controller or a job{{/if}}. Every root command runs it first; a workspace script run directly (`-w api`) assumes it has run. |
{{/if}}
| `npm run typecheck`, `npm run lint`, `npm test` | All three before a commit. `lint` is ESLint, then `scripts/checkStructure.mjs`: each script's source, ids and SDF object agree. |
| `npm run build` | Client (Vite) then API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/`. |
| `npm run dev` | Vite on port 3000 and the local restlet proxy on port 4000. Needs `client/.env`. |
{{#if netsuiteApi}}
| `npm run add:jobs` | Once per project, before the first Map/Reduce job. |
{{/if}}
| `npm run deploy` (File Cabinet files), `npm run deploy:full` (full SDF deploy) | Only when the person asked for it, after `npm test`. |

## Layout

- `api/src/` is flat per layer and the file name carries the layer (`userController.ts`, `userService.ts`, `activeUserRepository.ts`). A request goes endpoint → service → repository{{#if netsuiteRepository}} → specification{{/if}}.
  - `controllers/<name>Controller.ts`: one deployed Restlet or Suitelet{{#if netsuiteApi}}, with its wire shapes, its endpoints and its script declaration{{/if}}.
  - {{#if netsuiteApi}}`jobs/<name>/`: one Map/Reduce job per folder. {{/if}}`events/user/`, `events/client/`: self-contained record scripts, deployed by hand.
  - `services/` decide, one per domain: a record type with everything that exists only as part of it (`salesOrderService` holds the lines; there is no `salesOrderLineService`), or an outside party (`carrierService` chooses between one repository per carrier). `repositories/` are the only code that touches NetSuite{{#if netsuiteRepository}}; `specifications/` are query filters for repositories; `models/` are the `@RecordType` classes{{/if}}.
  - `lib/`: plain helpers any layer may call, named for what they hold (`errors.ts`). They import only other `lib/` files; code that needs a record is a service, and a business rule stays in its domain's service.
  - `_host/`: the Suitelet that serves the app. Boilerplate; add nothing to it.
- `client/src/`: `routes/` render `pages/`, pages call `hooks/`, hooks call {{#if netsuiteApi}}the generated `api/`{{/if}}{{#unless netsuiteApi}}the backend{{/unless}}. The client never imports from `api/`.
- `netsuite.ts` at the root: `app`{{#if netsuiteApi}}, every job's ids,{{/if}} and {{#if codeGeneration}}any id no {{#if netsuiteRepository}}model{{/if}}{{#if bothNetsuitePackages}} or {{/if}}{{#if netsuiteApi}}controller{{/if}} owns{{/if}}{{#unless codeGeneration}}every NetSuite id outside the event files{{/unless}}. Exported constants and types, no imports: both halves bundle it.
- `netsuite/Objects/`: the SDF script records of the controllers{{#if netsuiteApi}} and jobs{{/if}}. Tests: `api/__tests__/`, `client/__tests__/`.
{{#if userRolesExample}}
- The `user` controller and its `UserRolesPage` are the live reference; the `userRoles` Suitelet is the pattern for a script that runs as another role.
{{/if}}

## Standards

- **Ids are written once.** {{#if netsuiteRepository}}A record's type and field ids on its model; {{/if}}{{#if netsuiteApi}}{{#if netsuiteRepository}}a{{/if}}{{#unless netsuiteRepository}}A{{/unless}} controller's script ids in its declaration; a job's in `netsuite.ts` under `jobs`; {{/if}}{{#if codeGeneration}}an{{/if}}{{#unless codeGeneration}}An{{/unless}} event's at the top of its file; anything else in `netsuite.ts`. Script ids are `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`.
- **Generated, never edited:** {{#if netsuiteRepository}}`api/src/repositories/generated/`, `api/src/types/models.gen.ts`, {{/if}}{{#if netsuiteApi}}`api/src/scripts.gen.ts`, `client/src/api/`, {{/if}}`client/src/routeTree.gen.ts`, `netsuite/FileCabinet/`. Change the source, then {{#if codeGeneration}}`npm run generate` or {{/if}}`npm run build`.
- **Naming.** A function name gets more specific as its responsibility narrows (`update` → `updateTransaction` → `updateTransactionShippingAddress`); a variable name gets more specific as its visibility widens (`transaction` → `vendorBillTransaction` → `vendorBillTransactionTemplate`). Never abbreviate. A function that produces a type is `build<Type>`, never `to<Type>`. The names per layer are in `how-to-use/naming.md`.
- **Packages** go in the workspace that imports them: `npm install -w api <package>` (or `-w client`), never a bare install at the root.
- **Secrets and account selection are a person's:** never write `project.json`, `client/.env`, keys or certificates, or an account value under Vite's `VITE_` prefix (Vite inlines it into the uploaded bundle). Add a new variable to `client/.env.example`.
- **The tooling holds the rest.** `npm run lint` enforces what each layer may import, where ids and logs go, what a service exports and declared dependencies; the structure check ties each script to its ids and SDF object{{#if netsuiteApi}}; `npm run generate` rejects a controller or job it cannot read{{/if}}. Their messages name the fix: fix the cause, never work around it. A project that has outgrown a template convention deletes it (its commented block in `eslint.config.mjs`, or the structure check and its call in the `lint` script) and updates the docs and snippets that describe it.
- **Folder rules** in `.claude/rules/` load when you read a file in their folder. Before creating a file in a folder you have not read, read an existing file there or its rule{{#if codeGeneration}}; before adding {{#if netsuiteRepository}}a model{{/if}}{{#if bothNetsuitePackages}}, {{/if}}{{#if netsuiteApi}}a controller or a job{{/if}}, read its example in `how-to-use/`{{/if}}. Bringing an existing project's code into this one follows the `convert-project` skill.

## Guardrails

After every write, `.claude/hooks/checkWrittenFile.mjs` reports what `npm run lint` would fail on in that file, and the standards the folder rules state that ESLint does not check: responses written field by field, repositories imported as namespaces, {{#if netsuiteRepository}}no `N/*` in models or specifications, {{/if}}no focused or skipped tests.
{{#if probity}}
Probity (`probity.config.ts`, wired in `.claude/settings.json`) blocks destructive commands, commits without tests and typecheck, deploys without tests and writes that break the standards above, and wants a failing test first in controllers, {{#if netsuiteApi}}job stages, {{/if}}services, `lib/`, repositories and client hooks. Its judge sees tool calls and their output, not prose: before a refactor (no existing assertion changes), run the affected test file, and run it again after; before a behaviour change, run the new or changed test and let it fail.
{{/if}}
{{#unless probity}}
`.claude/hooks/guardrails.mjs` blocks recursive force deletes, `--no-verify`, a force push without `--force-with-lease`, and writes to generated output, secret files or a test beside its source; it asks the person before a deploy.
{{/unless}}
When a block fires, fix the cause rather than working around it.
