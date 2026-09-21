# how-to-use/ review

`react-app/HOW-TO-USE.md` became `react-app/how-to-use/folder-structure.md`. The sections of it that are not about
the architecture are pulled out below, word for word, for you to decide on. This file is at the repository root, so
it is never scaffolded; delete it once each section has a home or is dropped.

What went where:

| Old section | Now |
|---|---|
| Layout and every folder section | `how-to-use/folder-structure.md` |
| Adding a controller | `how-to-use/controllers/restlet-controller.md` (Steps, generator rules, variations) |
| Adding a job | `how-to-use/jobs/map-reduce-job.md` (Steps, Following a run, variations) |
| Naming | `how-to-use/naming.md` (two rows added: job types, job start) |
| Adding an event | below, section 1 |
| Removing a rule you have outgrown | below, section 2 |

## 1. Adding an event

Pulled because events are deliberately outside the layers. `folder-structure.md` keeps its `src/events/` section
(what the folder is, that there is no SDF object, the snippets) but no longer links to this recipe. CLAUDE.md's
"Adding a script" no longer names it either.

> ## Adding an event
>
> An event is logic that belongs to a NetSuite record rather than to this application: a user event when a record is saved, a client event on a record page in the browser. Events are self-contained, and they are the one kind of script whose record you create in NetSuite yourself.
>
> 1. **The file**, named for what it fires on: `api/src/events/user/<subject>.ts` (the `nspUserEvent` snippet) or `api/src/events/client/<subject>.ts` (`nspClientEvent`).
>     ```typescript
>     /**
>      * @NApiVersion 2.1
>      * @NScriptType UserEventScript
>      * @NModuleScope SameAccount
>      */
>     import * as log from 'N/log';
>     import type { EntryPoints } from 'N/types';
>     import { listOpenOrdersForCustomer } from '../../repositories/salesOrdersRepository';
>
>     /** The ids this event works with, written here because the event is its own. */
>     const fields = {
>         memo: 'memo',
>     } as const;
>
>     export const beforeSubmit: EntryPoints.UserEvent.beforeSubmit = (context: EntryPoints.UserEvent.beforeSubmitContext): void => {
>         if (context.type !== context.UserEventType.CREATE && context.type !== context.UserEventType.EDIT) return;
>         try {
>             const open = listOpenOrdersForCustomer(Number(context.newRecord.getValue({ fieldId: 'entity' })));
>             context.newRecord.setValue({ fieldId: fields.memo, value: String(open.length) + ' open orders' });
>         } catch (error) {
>             log.error('event failed', { record: context.newRecord.type, id: context.newRecord.id, message: error instanceof Error ? error.message : String(error) });
>         }
>     };
>     ```
>     A user event works the record its context carries and logs with `N/log`; anything else in NetSuite it reaches through a repository function, so the call is tracked like any other and can be tested. It catches what it throws and logs it: an event that fails should not stop someone saving a record, unless refusing the save is the point of the event. A client event is the other way round: it runs in the browser, so it calls `N/*` itself and logs with `console`, and nothing of this application belongs in it.
> 2. **`npm run build`** puts the file in the File Cabinet at `/SuiteScripts/{{appName}}/api/events/user/<subject>.js`, and `npm run deploy` uploads it.
> 3. **Create the script record in NetSuite**: Customization › Scripting › Scripts › New, select the uploaded file, then add a deployment per record type, with the execution contexts and the audience it should run for. A client event is either deployed the same way or attached to a form from a user event's `beforeLoad` (`context.form.clientScriptModulePath`).
>
> There is no SDF object for an event and no entry in the structure check beyond the file name and the script type: what an event is deployed to lives in the account, where whoever deploys it can see it. Ids the event uses are written at the top of the file.

## 2. Removing a rule you have outgrown

Pulled because it is about the lint setup, not the layers. It was the documented way out of a template convention,
so two references to it were rewritten to stand on their own: CLAUDE.md's "Outgrown rules" bullet (it still says to
delete a rule rather than work around it) and the failure message of `scripts/checkStructure.mjs` (it still says how
to remove the check). If it should ship again, `how-to-use/outgrown-rules.md` beside `naming.md` would be its place,
and both references can point there.

> ## Removing a rule you have outgrown
>
> `npm run lint` checks two kinds of rule. ESLint's recommended rules are about the language. Everything else is a convention of this template: the structure check in `scripts/checkStructure.mjs` (a controller's declaration, exports and SDF object agree) and each commented block of `eslint.config.mjs` (the layers, the id and log rules, the dependency guard, the entry each side imports). A convention is there so that the shipped pieces, the generated code and the snippets keep fitting together. When this project moves past one, delete the rule rather than working around it; nothing else depends on it.
>
> - The structure check: delete `scripts/checkStructure.mjs` and drop `&& node scripts/checkStructure.mjs` from the `lint` script in `package.json`. The ESLint override that names the file then matches nothing, which is fine. Update the "Adding a controller" steps above, `CLAUDE.md` and the snippets in `.vscode/` to whatever the new layout is.
> - An ESLint convention: delete its block in `eslint.config.mjs` (the comment above each block says what it enforces) and the constants at the top of the file that only that block used.
>
> The check and the ESLint blocks are run only by `npm run lint`; `npm run build` and `npm run deploy` do not depend on them.

## 3. Left in folder-structure.md, but not architecture

These sit inside folder sections, so they stayed; say if they should come out too.

- `node_modules/`: how to update the AmeriLux packages (`npm run update:amerilux`) and what to do about `ETARGET`.
- `.vscode/`: how `settings.json` orders the suggest list, and dismissing an AI inline suggestion.
- `netsuite-wrapper.config.js`: `@ptrk-ignore-arguments`, and that the scope's mode is set in the PerformanceTracker app.

## 4. Decided while writing the examples

- **`authorize` reads the session through a service**, not "through a repository function" as the old text said:
  lint forbids a controller importing a repository ("An endpoint never queries. Call a service.").
- **Your jobs example's page called `orders.api.closeOld(...)` directly.** Lint rejects that ("A component never
  fetches. Use a hook."), so the example gained a `useCloseOldOrders` mutation hook.
- **A sales rep can be empty**, so the job's items and tallies carry `salesRepId: number | null`, and the rep id rides
  in the map stage's value instead of being parsed back out of the key.
- **The escape-hatch variation** now shows `summarize` written by hand with `closeJobRun`. The old one had
  getInputData answer `[]` when `isRestarted`, which would drop the work on a restart, and used `toItem`, which the
  naming rule replaces with `build<Type>`.
- **The test in the jobs example** mocks `ordersService`; as written it called `vi.mocked(closeOrder)` without a
  `vi.mock`, so it could not have run.
- **Field ids** used by the examples (sales order, transaction line, customer) were checked against the account's
  SuiteQL metadata; the customer balance is queried as `balancesearch`, which the `Customer` model shows as a split
  field.
- **`scripts/checkSnippets.mjs`** left the generated repository files of its models behind (`netsuite-repository
  generate` never deletes one), which failed any typecheck run after it; its restore now removes them.
