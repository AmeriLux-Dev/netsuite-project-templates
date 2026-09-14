---
name: add-controller
description: Add a controller to this project (a Restlet or Suitelet script with named endpoints and their request and response shapes, its SDF object and scripts entry; the browser client is generated) so that npm run lint's structure check passes. Use when asked to add, create or scaffold a controller, restlet, suitelet, endpoint group or API for a record.
---

# Add a controller

A controller is one deployed script serving named endpoints: `user` with `roles`, or `orders` with `list`, `byId`, `create`. The step-by-step recipe with the shape of every file is HOW-TO-USE.md, "Adding a controller"; read it, and read the shipped `user` controller (and `userRoles` for a Suitelet) before writing. This skill is the checklist and the rules.

Ask for, or infer from the request: the controller name (camelCase, no `Controller` suffix: `orders`, `salesOrders`), each endpoint's name (`list`, `byId`, `create`, `update`, `remove`), the transport (Restlet by default; Suitelet when the caller is a NetSuite page, or when the script must run as another role and is called server-side), and what each endpoint takes and returns. Every call is a POST naming the endpoint in its body; there is no HTTP method to choose.

## Rules that cannot bend

- The script id is `customscript_{{prefix}}_<snake_name>` and the deployment id `customdeploy_{{prefix}}_<snake_name>`, both at most 40 characters. `<snake_name>` is the controller name in snake_case (`salesOrders` gives `sales_orders`). They are written once, in `common/netsuite.ts`; everywhere else imports `scripts.<name>`. A script only server code calls says `browser: false` there.
- A controller is one file, `api/src/controllers/<name>Controller.ts`, in this order: the `@NScriptType` header, the request and response shapes, `<name>Endpoints = defineEndpoints({ ... })`, `type <Name>Endpoints = typeof <name>Endpoints`, and the entry point (`export const post = defineRestlet('<name>', <name>Endpoints)` or `export const onRequest = defineSuitelet(...)`). `defineEndpoints`, `defineRestlet`, `defineSuitelet` and `ApiError` come from `@amerilux/netsuite-api/server`.
- The shapes are an entity type from `common/types/models.gen.ts`, a `Pick` of one, or a composition of several. Never a record or a model class. The service maps entities to them. Every type in the controller file is exported, and a type is imported into it only from `common/` or from another controller: `npm run generate` copies these types into `client/src/api/index.gen.ts` as written and fails on anything it cannot carry.
- Every handler is written inline and annotates its parameter (the request) and its return type (the response); a handler with no parameter takes no request. Endpoint names are camelCase and never `endpoint`. Type names are unique across controllers.
- Services and repositories take the shapes from the controller file with `import type`. The client never imports from `api/`: it imports the generated `@/api/index.gen`, which holds every controller's types and one typed client per browser-facing controller.
- Files are named after their layer: `<subject>Service.ts`, `<subject>Repository.ts`, `<record>Specifications.ts`, with tests of the same name under `api/__tests__/<layer>/`. A service or repository is named after what it handles, not after the controller that calls it. Nothing is added under `api/src/_host/` or `client/src/api/`.
- A service never imports `N/*`; reading the session, a script parameter or another script is a repository function.
- Nothing under `api/src/repositories/generated/`, `common/types/models.gen.ts`, `client/src/api/index.gen.ts` or `netsuite/FileCabinet/` is edited.

## Checklist

| # | File | Reference |
|---|---|---|
| 1 | `common/netsuite.ts`: the `scripts.<name>` line above the `@netsuite-project:scripts` marker (`browser: false` when only server code calls it) | `scripts.user`, `scripts.userRoles` |
| 2 | `api/src/controllers/<name>Controller.ts`: header, shapes, `<name>Endpoints = defineEndpoints({ ... })` with one handler per endpoint calling a service, `type <Name>Endpoints`, and `post` (Restlet) or `onRequest` (Suitelet) | `userController.ts` (Restlet), `userRolesController.ts` (Suitelet) |
| 3 | `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: copy the user (Restlet) or userRoles (Suitelet) object; change ids, names and the script file path (`api/controllers/<name>Controller.js`) | both objects under `netsuite/Objects/` |
| 4 | `npm run generate`: rewrites `client/src/api/index.gen.ts` with the new controller's types and, unless `browser: false`, its client `<name>Api`; then a hook under `client/src/hooks/` calling it, and a test | `useActiveUserRoles.ts`, `client/__tests__/userQuery.test.ts` |

Behind the controller: a service under `api/src/services/`, repository functions under `api/src/repositories/` and, for a new record type, a model under `common/model/` (then `npm run generate`) with its specifications; the shipped `userRoles` chain (`userRolesService.ts`, `employeeRolesRepository.ts`, `employeeRolesSpecifications.ts`, `common/model/EmployeeRole.ts`) is the reference. A new service or repository function starts with a failing test under `api/__tests__/`. A helper script that must run as another role follows `userRoles`: a Suitelet whose deployment carries `<runasrole>`, marked `browser: false` in `scripts`, called from a repository through `createSuiteletClient<...>(scripts.<name>)` from `@amerilux/netsuite-api/server`.

## Finish

1. `npm run generate` (the client module, and the repository files if a model was added or changed).
2. `npm run typecheck`, `npm run lint`, `npm test`. Lint runs the structure check; fix what it names rather than working around it.
3. Say which endpoints exist and what remains unimplemented. Deploying (`npm run deploy`) is the person's call.
