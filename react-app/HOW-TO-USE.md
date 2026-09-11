# How to use this project

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](./README.md) says what the application is for and who owns it; this file says how to work on it. The second half is a set of step-by-step recipes for everything that takes more than one file to add.

## Why this shape

- **A Suitelet hosts a React single-page app.** NetSuite serves the page and the session; the bundle is one file in the File Cabinet, found by folder and file name, never by internal id.
- **One script per controller, no router.** Each controller is a folder under `api/src/controllers/`: transport-agnostic handlers under `endpoints/` and one file with an `@NScriptType` header that serves them as a Restlet or a Suitelet. Endpoints are the controller's actions, as in ASP.NET: named, each with its own HTTP method, chosen by the `endpoint` parameter of the call, so a controller can have as many GETs as it needs. Switching transport is a change to that file, its SDF object and the `kind` in `scripts`; the endpoints and the client do not change. Permissions, logging and log filtering stay per script.
- **Every NetSuite magic string has one home.** A record's type and field ids are declared on its model in `common/model/`, which is what the repository package reads; script ids and any id no model owns live in `common/netsuite.ts`. The client calls scripts through the `scripts` registry, so ids are typed and change in one place.
- **Three kinds of shared type, each in its own folder.** `common/model/` declares records; `npm run generate` turns them into entity types in `common/types/models.gen.ts`, which both sides may import; `common/dto/` holds what goes over the wire, picked from the entity types; `common/types/<controller>.ts` holds the contract that gives each endpoint its method. An endpoint sees DTOs only; the service maps entities to them.
- **Typed data access** through `@amerilux/netsuite-repository` (decorated models, generated context) and instrumented `N/*` calls through `@amerilux/netsuite-wrapper`.
- **The structure is checked, not just described.** `npm run lint` runs ESLint (which layer may import what) and then `scripts/checkStructure.mjs` (every script's pieces exist and agree), so the recipes below hold whether a person or an agent follows them.

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
| `npm run deploy` | Build, then `suitecloud project:adddependencies` and `project:deploy` |
| `npm run deploy:files` | Build, then upload only the File Cabinet files (fast path after a UI change) |
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
  src/repositories/     Query and write functions over dbContext, session reads, calls to helper scripts (generated/ is produced, gitignored)
  src/specifications/   Query predicates, one module per record type
  src/lib/              endpoint, defineRestlet, defineSuitelet, suiteletClient, ApiError, File Cabinet helpers
  test/stubs/N/         vi.fn shells for N/* modules
  __tests__/            Vitest specs
client/                 React 19, TanStack Router (file-based, hash history), TanStack Query, Tailwind 4
  src/routes/           One file per route; __root.tsx is the layout (routeTree.gen.ts is generated)
  src/api/              apiClient (createApiClient) and one typed module per controller the browser calls
  src/pages/            One component per page; a page calls hooks, never the api modules
  src/hooks/            TanStack Query hooks, the only callers of src/api
  server.ts             Local dev proxy that signs OAuth 2.0 requests to the sandbox
netsuite/               The SDF project: manifest, deploy.xml, Objects/, FileCabinet/ (build output)
scripts/                deploy.mjs, buildInfo.cjs, checkStructure.mjs (run by npm run lint)
README.md               Purpose, owners, dependencies, deployment, support and decisions of this application
CLAUDE.md               Project brief for Claude Code
.claude/skills/         add-controller: the checklist an agent follows to add a controller
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
  api/controllers/user/userController.js             GET roles: the caller and every role assigned to them
  api/controllers/userRoles/userRolesController.js   helper Suitelet, runs as Administrator, called by the user restlet
```

Building the client empties only `client/`; building the API empties only `api/`.

## Deploy

`npm run deploy` needs a `project.json` with the authentication id to use. `npx suitecloud account:setup` writes it. The Suitelet appears under Customization › Scripting › Scripts as **{{appTitle}} Home**.

The client bundle URL carries `?v=<version>-<buildId>`, so a new deploy is picked up without a manual version bump.

## The starting point

The project ships with one feature, small enough to read in a sitting and shaped the way every feature should be:

- `user`, a Restlet controller with one endpoint, `roles` (GET): the caller and every role assigned to them, whichever role they logged in with. `UserRolesPage` on the `/` route shows it.
- `userRoles`, a Suitelet controller with one endpoint, `byEmployee` (GET `employeeId`). The role a Restlet caller logged in with cannot read role assignments, so this script is deployed to run as Administrator and the `user` restlet calls it server-side. It reads the `EmployeeRole` model (`employeerolesforsearch`) through a specification and a repository, like any other data.

Every recipe below is worked on these files. Build on them or replace them.

## Adding a controller

A controller is one deployed script serving named endpoints, as in ASP.NET: `user` with `roles`, or `orders` with `list`, `byId`, `create`. The steps below are the `user` controller; substitute your own names. With Claude Code, the `add-controller` skill follows the same steps. `npm run lint` fails until every piece exists and they agree, so run it as you go.

Names: the controller name is camelCase without a `Controller` suffix (`user`, `salesOrders`); its script id is `customscript_{{prefix}}_<snake_name>` (`sales_orders`). Script ids are capped at 40 characters: `customscript_` takes 13, so `{{prefix}}_<snake_name>` must fit in 27. Endpoint names are camelCase and never `index` or `endpoint`.

**1. Register the script** in `common/netsuite.ts`, one line above the `// @netsuite-project:scripts` marker. The only place an id is written.

```ts
    user: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' },
```

**2. Declare the wire shapes** in `common/dto/user.ts`: one request and one response type per endpoint. Pick from the entity types in `common/types/models.gen.ts` so a DTO follows its model. GET parameters arrive as strings, so type ids `number | string` and let the service parse.

```ts
import type { RoleSummary } from './userRoles';

export interface ActiveUserSummary {
    id: number;
    name: string;
    email: string;
}

/** The endpoint takes no parameters; the caller is the session's user. */
export type UserRolesRequest = Record<string, never>;

export interface UserRolesResponse {
    user: ActiveUserSummary;
    activeRoleId: number;
    roles: RoleSummary[];
}
```

**3. Declare the contract** in `common/types/user.ts`: the request and response per endpoint, and the method of each. One entry per line; the structure check reads them.

```ts
import type { UserRolesRequest, UserRolesResponse } from '../dto/user';
import { defineContract } from './api';

export interface UserEndpoints {
    roles: { request: UserRolesRequest; response: UserRolesResponse };
}

export const userContract = defineContract<UserEndpoints>({
    roles: { method: 'GET' },
});
```

**4. Write one file per endpoint** under `api/src/controllers/user/endpoints/`, named after the endpoint. Thin: hand the request to a service, return its result. The service and what it calls are the subject of [Adding a model and its data access](#adding-a-model-and-its-data-access).

```ts
// api/src/controllers/user/endpoints/roles.ts
import type { UserRolesRequest, UserRolesResponse } from 'common/dto/user';
import type { Endpoint } from '../../../lib/endpoint';
import { getActiveUserRoles } from '../../../services/user';

export const roles: Endpoint<UserRolesRequest, UserRolesResponse> = () => getActiveUserRoles();
```

**5. Bind them** in `api/src/controllers/user/endpoints/index.ts`. A handler missing from the object, or one whose types disagree with the contract, is a compile error.

```ts
import { userContract } from 'common/types/user';
import { defineEndpoints } from '../../../lib/endpoint';
import { roles } from './roles';

export const userEndpoints = defineEndpoints(userContract, { roles });
```

**6. Write the script file** `api/src/controllers/user/userController.ts`, the only transport-specific file. The JSDoc header makes it a deployed script; export exactly the HTTP methods the contract uses.

```ts
/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { defineRestlet } from '../../lib/defineRestlet';
import { userEndpoints } from './endpoints';

const restlet = defineRestlet('user', userEndpoints);

export const get = restlet.get;
```

For a Suitelet: `@NScriptType Suitelet`, `kind: 'suitelet'` in step 1, and the body is `export const onRequest = defineSuitelet('user', userEndpoints);` from `../../lib/defineSuitelet`.

**7. Write the SDF object** `netsuite/Objects/customscript_{{prefix}}_user.xml`, named after the script id. Copy `customscript_{{prefix}}_user.xml` for a Restlet or `customscript_{{prefix}}_user_roles.xml` for a Suitelet and change the ids, names and script file path.

```xml
<restlet scriptid="customscript_{{prefix}}_user">
  <description>The caller and their roles, for {{appTitle}}.</description>
  <isinactive>F</isinactive>
  <name>{{appTitle}} User</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/{{appName}}/api/controllers/user/userController.js]</scriptfile>
  <scriptdeployments>
    <scriptdeployment scriptid="customdeploy_{{prefix}}_user">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>F</allroles>
      <audslctrole>ADMINISTRATOR</audslctrole>
      <isdeployed>T</isdeployed>
      <loglevel>DEBUG</loglevel>
      <status>RELEASED</status>
      <title>{{appTitle}} User</title>
    </scriptdeployment>
  </scriptdeployments>
</restlet>
```

`<audslctrole>` is the audience: the roles allowed to call the script. Widen it (or set `<allroles>T</allroles>`) when the application is used by more than administrators.

**8. Write the client module** `client/src/api/userApi.ts`, if the browser calls the controller. One typed function per endpoint; a hook calls it, pages call the hook (see [Adding a page](#adding-a-page)).

```ts
import { scripts } from 'common/netsuite';
import { userContract } from 'common/types/user';
import { createApiClient } from './apiClient';

export const userApi = createApiClient(scripts.user, userContract);
```

**9. Check.** `npm run typecheck`, `npm run lint`, `npm test`. The structure check verifies: script and deployment ids share the prefix and the name; the SDF object's root element and the source file's `@NScriptType` match `kind`; the contract's endpoint names, the files under `endpoints/` and the handlers bound in `index.ts` are the same set; the client module, when present, is built from the contract; every controller folder, SDF script object and `@NScriptType` file belongs to a `scripts` entry. ESLint adds the import rules: endpoints never import entity types or query, `defineContract` is only called under `common/types/`, and a model never imports the wire. Then `npm run deploy` creates the script record and deployment.

## Adding an endpoint to an existing controller

Worked as `hasRole` (GET `roleId`, answers whether the caller holds that role) on the `user` controller.

**1. The wire shapes** in `common/dto/user.ts`:

```ts
export interface UserHasRoleRequest {
    roleId: number | string;
}

export interface UserHasRoleResponse {
    roleId: number;
    assigned: boolean;
}
```

**2. The contract** in `common/types/user.ts`: a line in `UserEndpoints` and a line in `userContract`.

```ts
    hasRole: { request: UserHasRoleRequest; response: UserHasRoleResponse };
```

```ts
    hasRole: { method: 'GET' },
```

**3. The decision** in `api/src/services/user.ts`, with a failing test in `api/__tests__/services/user.test.ts` first. Parse, call repository functions, shape the reply.

```ts
export function hasRole(request: UserHasRoleRequest): UserHasRoleResponse {
    const roleId = parseRoleId(request.roleId);
    const assigned = listRolesForEmployee(readActiveUser().id).some((role) => role.roleId === roleId);
    return { roleId, assigned };
}
```

**4. The endpoint file** `api/src/controllers/user/endpoints/hasRole.ts`:

```ts
import type { UserHasRoleRequest, UserHasRoleResponse } from 'common/dto/user';
import type { Endpoint } from '../../../lib/endpoint';
import { hasRole as hasRoleDecision } from '../../../services/user';

export const hasRole: Endpoint<UserHasRoleRequest, UserHasRoleResponse> = (request) => hasRoleDecision(request);
```

**5. The binding** in `endpoints/index.ts`: `defineEndpoints(userContract, { roles, hasRole })`.

**6. The controller export**, only when the endpoint uses an HTTP method the controller did not export yet: a POST endpoint adds `export const post = restlet.post;` to `userController.ts`. A Suitelet controller needs nothing.

**7. The hook** under `client/src/hooks/` (a query for GET, a mutation for POST/PUT/DELETE) and its test under `client/__tests__/`. The client module gains the function by itself: `userApi.hasRole({ roleId })` exists as soon as the contract has the entry.

**8. Check**: `npm run typecheck`, `npm run lint`, `npm test`, then deploy. An existing deployment picks the new endpoint up with the script file.

## Adding a model and its data access

Worked as `EmployeeRole`, the model behind `userRoles`.

**1. The model** under `common/model/`: a decorated class that declares the record type and every field it touches. Nothing goes in `common/netsuite.ts`. Only the property names that differ from the field id need `@Field`.

```ts
// common/model/EmployeeRole.ts
import { Field, InternalId, RecordType } from '@amerilux/netsuite-repository';

@RecordType('employeerolesforsearch')
export class EmployeeRole {
    @InternalId() @Field('role') roleId!: number;
    @Field('entity') employeeId!: number;
    @Field({ queryFieldId: 'role', text: true }) roleName!: string;
}
```

**2. Generate**: `npm run generate` writes the entity type to `common/types/models.gen.ts` (shared with the client, type-only), the config and field paths to `api/src/repositories/generated/EmployeeRole.gen.ts`, and the `employeeRoles` set on `dbContext` in `context.gen.ts`. All gitignored; every script that needs them runs generate first.

**3. The query vocabulary** in `api/src/specifications/employeeRoles.ts`: one predicate per builder, no decisions.

```ts
import type { Specification } from '@amerilux/netsuite-repository';
import { EmployeeRoleFields, type EmployeeRole } from '../repositories/generated/EmployeeRole.gen';

export const forEmployee = (employeeId: number): Specification<EmployeeRole> =>
    (query) => query.where(EmployeeRoleFields.employeeId, '=', employeeId);
```

**4. The repository function** in `api/src/repositories/employeeRoles.ts`, with its test in `api/__tests__/repositories/employeeRoles.test.ts` first (the test fakes `dbContext` with a set whose `list()` records the specifications applied). Reads go through `dbContext.<set>`; a write goes through `dbContext.withTracking()`, kept in a local and saved before the function returns.

```ts
import type { EmployeeRole } from 'common/types/models.gen';
import { dbContext } from './generated/context.gen';
import { forEmployee } from '../specifications/employeeRoles';

export function listEmployeeRolesByEmployee(employeeId: number): EmployeeRole[] {
    return dbContext.employeeRoles.list(forEmployee(employeeId));
}
```

**5. The service** in `api/src/services/userRoles.ts`, with its test first (the test mocks the repository module). It parses the request, calls repository functions by their domain names, maps entities to DTOs and decides the shape of the reply.

```ts
export function getRolesByEmployee(request: UserRolesByEmployeeRequest): UserRolesByEmployeeResponse {
    const employeeId = parseEmployeeId(request.employeeId);
    const roles = listEmployeeRolesByEmployee(employeeId)
        .map(toRoleSummary)
        .sort((left, right) => left.roleName.localeCompare(right.roleName));
    return { employeeId, roles };
}
```

**6. Expose it** through an endpoint ([Adding an endpoint](#adding-an-endpoint-to-an-existing-controller)) or a new controller ([Adding a controller](#adding-a-controller)).

## Calling another script from the server

Sometimes a script needs a role its caller lacks: the role a Restlet caller logged in with cannot read role assignments, so `userRoles` runs as Administrator and `user` calls it. Any Suitelet controller of this application can be called this way, typed by the same contract the browser would use.

**1. The helper is a Suitelet controller**: steps 1 to 7 of [Adding a controller](#adding-a-controller) with `kind: 'suitelet'`, `@NScriptType Suitelet` and `defineSuitelet`. No client module: the browser has no business with it.

**2. Its deployment runs as the role it needs** and is reachable by every role, since the calling script runs as whoever is signed in. In `netsuite/Objects/customscript_{{prefix}}_user_roles.xml`:

```xml
    <scriptdeployment scriptid="customdeploy_{{prefix}}_user_roles">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>T</allroles>
      <audslctrole></audslctrole>
      <eventtype></eventtype>
      <isdeployed>T</isdeployed>
      <isonline>F</isonline>
      <loglevel>DEBUG</loglevel>
      <runasrole>ADMINISTRATOR</runasrole>
      <status>RELEASED</status>
      <title>{{appTitle}} User Roles</title>
    </scriptdeployment>
```

Keep such a script read-only and minimal, and make its endpoints take the narrowest input they can: every signed-in user can reach it.

**3. A repository calls it** through `createSuiteletClient` from `api/src/lib/suiteletClient.ts`, so the service does not know the answer came from another script. The test fakes the client (see `api/__tests__/repositories/userRoles.test.ts`).

```ts
// api/src/repositories/userRoles.ts
import type { RoleSummary } from 'common/dto/userRoles';
import { scripts } from 'common/netsuite';
import { userRolesContract } from 'common/types/userRoles';
import { createSuiteletClient } from '../lib/suiteletClient';

const userRolesApi = createSuiteletClient(scripts.userRoles, userRolesContract);

export function listRolesForEmployee(employeeId: number): RoleSummary[] {
    return userRolesApi.byEmployee({ employeeId }).roles;
}
```

A transport failure surfaces as a 502 `ApiError`; an error envelope keeps the helper's status. The calling service decides whether to fall back (the shipped `user` service does not).

## Adding a page

Worked as `UserRolesPage` on the `/` route.

**1. The route file** under `client/src/routes/`: `index.tsx` serves `/`, `orders.tsx` serves `#/orders`, `orders.$orderId.tsx` serves `#/orders/:orderId`, and `__root.tsx` is the layout around all of them. The Vite plugin regenerates `src/routeTree.gen.ts` on `npm run dev` and `npm run build`; commit that file but never edit it.

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { UserRolesPage } from '@/pages/UserRolesPage';

export const Route = createFileRoute('/')({
    component: UserRolesPage,
});
```

**2. The hook** under `client/src/hooks/`, the only place that calls `client/src/api`. Query options are exported on their own so a test (and a loader) can use them without rendering.

```ts
// client/src/hooks/useActiveUserRoles.ts
import { queryOptions, useQuery } from '@tanstack/react-query';
import { userApi } from '@/api/userApi';

export const activeUserRolesQueryKey = ['user', 'roles'] as const;

export function activeUserRolesQueryOptions() {
    return queryOptions({
        queryKey: activeUserRolesQueryKey,
        queryFn: ({ signal }) => userApi.roles({}, { signal }),
    });
}

export function useActiveUserRoles() {
    return useQuery(activeUserRolesQueryOptions());
}
```

**3. The page** under `client/src/pages/`: a component that calls the hook and renders its pending, error and success states. No fetching, no ids.

**4. The test** under `client/__tests__/`: the hook's query key and options against a fake client (see `userQuery.test.ts`). Markup is not unit-tested.

**5. Navigation**: `client/src/components/AppShell.tsx` renders the header and the `<Outlet />` the routes fill; add TanStack Router `Link`s there when pages should be reachable from the shell rather than by URL only.

## Adding a script parameter or other id no model owns

A script parameter is a custom field on a script record (`custscript_...`) whose value is set per deployment in the NetSuite UI: a limit, a folder id, a feature switch. Saved search ids, list values and similar ids that no model declares are handled the same way, without step 1.

**1. Declare the field on the script's SDF object**, between `<scriptfile>` and `<scriptdeployments>`. This shape is the smallest that deploys; check the SuiteCloud reference for other field types and settings.

```xml
  <scriptcustomfields>
    <scriptcustomfield scriptid="custscript_{{prefix}}_user_max_roles">
      <defaultvalue>50</defaultvalue>
      <fieldtype>INTEGER</fieldtype>
      <label>Maximum roles</label>
    </scriptcustomfield>
  </scriptcustomfields>
```

**2. Register the id** in `common/netsuite.ts`, an exported `as const` object with camelCase keys, next to `scripts`:

```ts
/** Script parameters (custom fields on the script records), set per deployment in the UI. */
export const scriptParameters = {
    userMaxRoles: 'custscript_{{prefix}}_user_max_roles',
} as const;
```

**3. Read it in a repository**, never in a service or an endpoint, because it is a NetSuite module read:

```ts
// api/src/repositories/scriptParameters.ts
import * as runtime from 'N/runtime';
import { scriptParameters } from 'common/netsuite';

export function readMaximumRoles(): number {
    const value = runtime.getCurrentScript().getParameter({ name: scriptParameters.userMaxRoles });
    return typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10) || 50;
}
```

**4. Use it in a service**, with a test that mocks the repository module. Deploy, then set the value on the deployment record when the default is not right.

## Switching a controller between Restlet and Suitelet

1. In `<name>Controller.ts`, change `@NScriptType` and swap `defineRestlet` for `defineSuitelet` (or back).
2. Replace the SDF object in `netsuite/Objects/` with the other element type (`<restlet>` or `<suitelet>`); a Suitelet deployment also carries `<eventtype>`, `<isonline>` and `<runasrole>`.
3. Set `kind` on `scripts.<name>` in `common/netsuite.ts`. The client reads it to build the URL, so `client/src/api/<name>Api.ts` does not change.

{{#if performanceTracker}}
## PerformanceTracker

`api/netsuite-wrapper.config.js` enables the `performance-tracker` telemetry integration, so every wrapped `N/record`, `N/query`, `N/search`, `N/https` and `N/task` call writes an execution span to the PerformanceTracker custom record. The PerformanceTracker bundle must be installed in the target account. Set `telemetryBootstrap: false` and `instrumentation: false` to turn it off.

{{/if}}
## Local dev proxy

`client/server.ts` forwards `/api/restlet` to the sandbox restlet domain and `/api/suitelet` to the application domain, both with an OAuth 2.0 client-credentials token. It reads `client/.env` (gitignored); `client/.env.example` lists the values. The private key stays outside the repository. Nothing account-specific is exposed to Vite, so nothing account-specific ends up in the uploaded bundle.

## Testing

- `api/__tests__/` and `client/__tests__/` hold the Vitest specs; tests are never colocated with source.
- `N/*` modules and the wrapper's module entry points resolve to `api/test/stubs/N/`.
- Repository functions read through the generated `dbContext`, so a test mocks it with a fake carrying the record sets it needs; a repository that calls a helper Suitelet fakes the Suitelet client. Service tests mock the repository modules.
- UI markup is not unit-tested; hooks and API modules are.

## Working with an AI coding agent

- `CLAUDE.md` is the project brief Claude Code reads on every session: commands, layout and the rules below.
- `.claude/skills/add-controller/` is the checklist an agent follows to add a controller; it points at the recipes above.
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
- Script ids: `customscript_{{prefix}}_<name>` and `customdeploy_{{prefix}}_<name>`, at most 40 characters, written only in `common/netsuite.ts`.
- Endpoints are transport-agnostic functions under `controllers/<name>/endpoints/`, one file per endpoint named like an ASP.NET action; the contract in `common/types/<name>.ts` gives each its method, and a Restlet controller exports only the HTTP methods its endpoints use.
- Layers: endpoint calls service, service calls repository, repository composes specifications. Only `model/`, `specifications/` and `repositories/` import `@amerilux/netsuite-repository`; only a repository touches records, the session or another script. Endpoints speak DTOs; services map entities to them. `npm run lint` enforces the boundaries and the structure of every controller.
- Log titles are constant phrases; controller, method and ids go in the details object.
- Secrets never enter the repository: no account ids, auth ids, `project.json`, `.env` or key files.
