# {{appTitle}}

Suitelet-hosted React application for NetSuite, scaffolded by create-netsuite-project (`react-app` template). `api/` is SuiteScript, `client/` is React, and the client's whole view of the backend is generated from the controllers. `how-to-use/` explains the layout (`folder-structure.md`) and the names (`naming.md`), and writes one feature end to end per part: `repositories/model-and-repository.md`, `controllers/restlet-controller.md`, `controllers/suitelet-controller.md`, `jobs/map-reduce-job.md`. `README.md` belongs to the application's owners.

## Commands

| Command | Use it for |
|---|---|
| `npm run generate` | After changing a model, a controller or a job. Every root command runs it first; a workspace script run directly (`-w api`) assumes it has run. |
| `npm run typecheck`, `npm run lint`, `npm test` | All three before a commit. `lint` is ESLint, then `scripts/checkStructure.mjs`: each script's source, ids and SDF object agree. |
| `npm run build` | Client (Vite) then API (webpack) into `netsuite/FileCabinet/SuiteScripts/{{appName}}/`. |
| `npm run dev` | Vite on port 3000 and the local restlet proxy on port 4000. Needs `client/.env`. |
| `npm run add:jobs` | Once per project, before the first Map/Reduce job. |
| `npm run deploy`, `npm run deploy:files` | Only when the person asked for it, after `npm test`. |

## Layout

- `api/src/` is flat per layer and the file name carries the layer (`userController.ts`, `userService.ts`, `activeUserRepository.ts`). A request goes endpoint → service → repository → specification.
  - `controllers/<name>Controller.ts`: one deployed Restlet or Suitelet, with its wire shapes, its endpoints and its script declaration.
  - `jobs/<name>/`: one Map/Reduce job per folder. `events/user/`, `events/client/`: self-contained record scripts, deployed by hand.
  - `services/` decide; `repositories/` are the only code that touches NetSuite; `specifications/` are query filters for repositories; `models/` are the `@RecordType` classes.
  - `_host/`: the Suitelet that serves the app. Boilerplate; add nothing to it.
- `client/src/`: `routes/` render `pages/`, pages call `hooks/`, hooks call the generated `api/`. The client never imports from `api/`.
- `netsuite.ts` at the root: `app`, every job's ids, and any id no model or controller owns. Exported constants and types, no imports: both halves bundle it.
- `netsuite/Objects/`: the SDF script records of the controllers and jobs. Tests: `api/__tests__/`, `client/__tests__/`.
- The `user` controller and its `UserRolesPage` are the live reference; the `userRoles` Suitelet is the pattern for a script that runs as another role.

## Standards

- **Ids are written once.** A record's type and field ids on its model; a controller's script ids in its declaration; a job's in `netsuite.ts` under `jobs`; an event's at the top of its file; anything else in `netsuite.ts`. Script ids are `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`.
- **Generated, never edited:** `api/src/repositories/generated/`, `api/src/types/models.gen.ts`, `api/src/scripts.gen.ts`, `client/src/api/`, `client/src/routeTree.gen.ts`, `netsuite/FileCabinet/`. Change the source, then `npm run generate` or `npm run build`.
- **Naming.** A function name gets more specific as its responsibility narrows (`update` → `updateTransaction` → `updateTransactionShippingAddress`); a variable name gets more specific as its visibility widens (`transaction` → `vendorBillTransaction` → `vendorBillTransactionTemplate`). Never abbreviate. A function that produces a type is `build<Type>`, never `to<Type>`. The names per layer are in `how-to-use/naming.md`.
- **Packages** go in the workspace that imports them: `npm install -w api <package>` (or `-w client`), never a bare install at the root.
- **Secrets and account selection are a person's:** never write `project.json`, `client/.env`, keys or certificates, or an account value under Vite's `VITE_` prefix (Vite inlines it into the uploaded bundle). Add a new variable to `client/.env.example`.
- **The tooling holds the rest.** `npm run lint` enforces what each layer may import, where ids and logs go, what a service exports and declared dependencies; the structure check ties each script to its ids and SDF object; `npm run generate` rejects a controller or job it cannot read. Their messages name the fix: fix the cause, never work around it. A project that has outgrown a template convention deletes it (its commented block in `eslint.config.mjs`, or the structure check and its call in the `lint` script) and updates the docs and snippets that describe it.
- **Folder rules** in `.claude/rules/` load when you read a file in their folder. Before creating a file in a folder you have not read, read an existing file there or its rule; before adding a model, a controller or a job, read its example in `how-to-use/`.

## Guardrails

After every write, `.claude/hooks/checkWrittenFile.mjs` reports what `npm run lint` would fail on in that file, and the standards the folder rules state that ESLint does not check: responses written field by field, repositories imported as namespaces, no `N/*` in models or specifications, no focused or skipped tests.
{{#if probity}}
Probity (`probity.config.ts`, wired in `.claude/settings.json`) blocks destructive commands, commits without tests and typecheck, deploys without tests and writes that break the standards above, and wants a failing test first in controllers, job stages, services, repositories and client hooks. Its judge sees tool calls and their output, not prose: before a refactor (no existing assertion changes), run the affected test file, and run it again after; before a behaviour change, run the new or changed test and let it fail.
{{/if}}
{{#unless probity}}
`.claude/hooks/guardrails.mjs` blocks recursive force deletes, `--no-verify`, a force push without `--force-with-lease`, and writes to generated output, secret files or a test beside its source; it asks the person before a deploy.
{{/unless}}
When a block fires, fix the cause rather than working around it.
