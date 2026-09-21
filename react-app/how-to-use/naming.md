# Naming

Two rules from `CLAUDE.md`, applied to the layers of [folder-structure.md](folder-structure.md): a function name gets more specific as its responsibility narrows, a variable name gets more specific as its visibility widens, and nothing is abbreviated. The snippets emit these names from the file name wherever the layout fixes them, and the worked examples beside this file follow them throughout.

**A type is named for what it is, by layer.**

| Layer | Type | Example |
|---|---|---|
| Model | the record, singular; its set on `dbContext` is the plural in camelCase | `EmployeeRole`, `dbContext.employeeRoles` |
| Generated | the entity type and its create and patch shapes | `EmployeeRole`, `EmployeeRoleCreate`, `EmployeeRolePatch` |
| Repository | a type of its own only for what no model declares | `ActiveUser` |
| Service | what it hands up: a `Pick` of an entity type is `<Model>Summary`; a composition is named for what it composes | `RoleSummary`, `ActiveUserRoles` |
| Controller | the wire, one pair per endpoint, no controller prefix | `ByEmployeeRequest`, `ByEmployeeResponse` |
| Job | in the job's `contract.ts`: the run's input, one piece of the work, and the result, prefixed with the job's name; what a stage writes, named for what it is | `CloseOldOrdersRequest`, `CloseOldOrdersItem`, `CloseOldOrdersResult`, `RepTally` |

**A function is named for what it does, with a verb.** A function that produces a value of a type is `build<Type>`: `buildRoleSummary(role)` says what comes out, its parameter says what goes in, and it sits next to the type it builds. When a second source for the same type appears, the source joins the name (`buildRoleSummaryFromRole`). `to<Type>` is not used: that name belongs to the type, and a function's name is a verb.

| Layer | Verb | Example |
|---|---|---|
| Repository | `list`, `find`, `read`, `create`, `update`, `remove`, then the set and the filter | `listEmployeeRolesByEmployee`, `readActiveUser`, `createSalesOrder` |
| Service | the decision, in the domain's words | `getRolesByEmployee`, `approveOldestPendingSalesOrder` |
| Endpoint | the operation, short; the controller scopes it | `list`, `byId`, `byEmployee`, `create` |
| Specification | the condition, as a predicate | `forEmployee`, `pendingFulfillment` |
| Guard | `parse<Field>` | `parseEmployeeId` |
| Hook | `use<What>`, with `<what>QueryKey` and `<what>QueryOptions` beside it; a mutation is `use<Verb><What>` | `useActiveUserRoles`, `useCreateOrder` |
| Job start | `start<Doing what>`, in `start.ts` | `startClosingOldOrders` |
