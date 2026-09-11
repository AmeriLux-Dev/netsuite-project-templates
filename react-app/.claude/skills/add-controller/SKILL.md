---
name: add-controller
description: Add a controller to this project (a Restlet or Suitelet script with named endpoints, its contract, DTOs, SDF object, scripts entry and, when the browser calls it, a client API module) so that npm run lint's structure check passes. Use when asked to add, create or scaffold a controller, restlet, suitelet, endpoint group or API for a record.
---

# Add a controller

A controller is one deployed script serving named endpoints: `user` with `roles`, or `orders` with `list`, `byId`, `create`. The step-by-step recipe with the shape of every file is HOW-TO-USE.md, "Adding a controller"; read it, and read the shipped `user` controller (and `userRoles` for a Suitelet) before writing. This skill is the checklist and the rules.

Ask for, or infer from the request: the controller name (camelCase, no `Controller` suffix: `orders`, `salesOrders`), each endpoint's name and HTTP method (`list:GET`, `byId:GET`, `create:POST`, `update:PUT`, `remove:DELETE`), the transport (Restlet by default; Suitelet when the caller is a NetSuite page, or when the script must run as another role and is called server-side), and what each endpoint takes and returns.

## Rules that cannot bend

- The script id is `customscript_{{prefix}}_<snake_name>` and the deployment id `customdeploy_{{prefix}}_<snake_name>`, both at most 40 characters. `<snake_name>` is the controller name in snake_case (`salesOrders` gives `sales_orders`). They are written once, in `common/netsuite.ts`; everywhere else imports `scripts.<name>`.
- Endpoints speak DTOs from `common/dto/<name>.ts`, never entity types or records. The service maps entities to DTOs.
- A contract is declared once, in `common/types/<name>.ts`, one entry per line. Endpoint names in the contract, files under `endpoints/`, and the handlers bound in `endpoints/index.ts` are the same set.
- Endpoint names are camelCase and never `index` or `endpoint`.
- A service never imports `N/*`; reading the session, a script parameter or another script is a repository function.
- Nothing under `api/src/repositories/generated/`, `common/types/models.gen.ts` or `netsuite/FileCabinet/` is edited.

## Checklist

| # | File | Reference |
|---|---|---|
| 1 | `common/netsuite.ts`: the `scripts.<name>` line above the `@netsuite-project:scripts` marker | `scripts.user` |
| 2 | `common/dto/<name>.ts`: one request and one response type per endpoint, picked from `common/types/models.gen.ts` | `common/dto/user.ts` |
| 3 | `common/types/<name>.ts`: `<Name>Endpoints` and `<name>Contract = defineContract<...>({ ... })` | `common/types/user.ts` |
| 4 | `api/src/controllers/<name>/endpoints/<endpoint>.ts`: one `Endpoint<Request, Response>` per endpoint, calling a service | `endpoints/roles.ts` |
| 5 | `api/src/controllers/<name>/endpoints/index.ts`: `defineEndpoints(<name>Contract, { ... })` | `endpoints/index.ts` |
| 6 | `api/src/controllers/<name>/<name>Controller.ts`: the `@NScriptType` header and `defineRestlet` (exporting the methods the contract uses) or `defineSuitelet` | `userController.ts`, `userRolesController.ts` |
| 7 | `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: copy the user (Restlet) or userRoles (Suitelet) object; change ids, names and the script file path | both objects under `netsuite/Objects/` |
| 8 | `client/src/api/<name>Api.ts`: `createApiClient(scripts.<name>, <name>Contract)`, only when the browser calls the controller; then a hook under `client/src/hooks/` and a test | `userApi.ts`, `useActiveUserRoles.ts` |

Behind the endpoints: the service, repository functions and specifications follow HOW-TO-USE.md, "Adding a model and its data access". A new service or repository function starts with a failing test under `api/__tests__/`. A helper script that must run as another role follows "Calling another script from the server".

## Finish

1. `npm run generate` if a model was added or changed.
2. `npm run typecheck`, `npm run lint`, `npm test`. Lint runs the structure check; fix what it names rather than working around it.
3. Say which endpoints exist and what remains unimplemented. Deploying (`npm run deploy`) is the person's call.
