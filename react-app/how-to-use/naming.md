# Naming

Two rules from `CLAUDE.md`, applied to the layers of [folder-structure.md](folder-structure.md): a function name gets more specific as its responsibility narrows, a variable name gets more specific as its visibility widens, and nothing is abbreviated. The snippets emit these names from the file name wherever the layout fixes them{{#if codeGeneration}}, and the worked examples beside this file follow them throughout{{/if}}.

**A file is named for what it holds.** A service for its domain, singular, the way NetSuite names the record type: `salesOrderService`, `fulfillmentService`, `customerService`, or the outside party, `carrierService`. Never for a part of the record (`salesOrderLineService`), a page, a job or a step. A repository for its record type, plural, or its outside system: `salesOrdersRepository`, `activeUserRepository`. When several providers do one operation, each provider's repository is named for the provider (`fedExRepository`, `upsRepository`), and the file that declares the shape they share for the domain (`carrierRepository.ts`, declaring `CarrierRepository`).

**A type is named for what it is, by layer.**

| Layer | Type | Example |
|---|---|---|
{{#if netsuiteRepository}}
| Model | the record, singular; its set on `dbContext` is the plural in camelCase | `EmployeeRole`, `dbContext.employeeRoles` |
| Generated | the entity type and its create and patch shapes | `EmployeeRole`, `EmployeeRoleCreate`, `EmployeeRolePatch` |
{{/if}}
| Repository | {{#if netsuiteRepository}}a type of its own only for what no model declares{{/if}}{{#unless netsuiteRepository}}a type of its own for what it returns{{/unless}}; the shape several providers share is `<Domain>Repository` | `ActiveUser`, `CarrierRepository` |
| Service | what it hands up: a `Pick` of {{#if netsuiteRepository}}an entity type is `<Model>Summary`{{/if}}{{#unless netsuiteRepository}}a repository's type is `<Type>Summary`{{/unless}}; a composition is named for what it composes | `RoleSummary`, `ActiveUserRoles` |
{{#if netsuiteApi}}
| Controller | the wire, one pair per endpoint, no controller prefix | `ByEmployeeRequest`, `ByEmployeeResponse` |
| Job | in the job's `contract.ts`: the run's input, one piece of the work, and the result, prefixed with the job's name; what a stage writes, named for what it is | `CloseOldOrdersRequest`, `CloseOldOrdersItem`, `CloseOldOrdersResult`, `RepTally` |
{{/if}}

**A function is named for what it does, with a verb.** A function that produces a value of a type is `build<Type>`: `buildRoleSummary(role)` says what comes out, its parameter says what goes in, and it sits next to the type it builds. When a second source for the same type appears, the source joins the name (`buildRoleSummaryFromRole`). `to<Type>` is not used: that name belongs to the type, and a function's name is a verb. In a service a builder is not exported: it is tested through the functions that answer with what it builds.

**What a service exports starts with `get`, `create`, `update` or `remove`**, or `is` or `has` for a yes-or-no check, and `npm run lint` fails on any other exported name in `api/src/services/`. The rest of the name says which data and which part of it (`updateOrderMemo`, not `changeOrderMemo`; `updateOrderClosed`, not `closeOrder`). Three of those verbs are a repository's too, so a service imports each repository as a namespace (`import * as salesOrdersRepository from '../repositories/salesOrdersRepository'`), and its `removeSalesOrder` can call `salesOrdersRepository.removeSalesOrder` without the two names meeting.

| Layer | Verb | Example |
|---|---|---|
| Repository | `list`, `find`, `read`, `create`, `update`, `remove`, then the set and the filter | `listEmployeeRolesByEmployee`, `readActiveUser`, `createSalesOrder` |
| Service | `get`, `create`, `update`, `remove`, then the data; `is` or `has` for a check | `getRolesByEmployee`, `updateOrderMemo`, `isSalesRepOfCustomer` |
{{#if netsuiteApi}}
| Endpoint | read with the controller in front of it, so it never repeats it: what the call answers, or how its rows are chosen; a verb when the call changes something | `roles`, `labels`, `list`, `byId`, `byEmployee`, `create`, `approve` |
{{/if}}
{{#if netsuiteRepository}}
| Specification | the condition, as a predicate | `forEmployee`, `pendingFulfillment` |
{{/if}}
| Guard | `parse<Field>` | `parseEmployeeId` |
| Hook | `use<What>`, with `<what>QueryKey` and `<what>QueryOptions` beside it; a mutation is `use<Verb><What>` | `useActiveUserRoles`, `useCreateOrder` |
{{#if netsuiteApi}}
| Job start | `start<Doing what>`, in `start.ts` | `startClosingOldOrders` |
{{/if}}
| Lib | what it does to its input; no fixed verb, and the file is named for what it holds | `describeErrorMessage` in `errors.ts` |
