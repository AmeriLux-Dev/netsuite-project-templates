# How to use this project

Scaffolded with create-netsuite-project {{cliVersion}} (`react-app` template). [README.md](./README.md) says what the application is for and who owns it; this file says how the project is laid out.

The application has two halves: a frontend (React, runs in the browser) in `client/`, and a backend (SuiteScript, runs in NetSuite) in `api/`. `common/` is code both halves import. NetSuite serves the frontend from a Suitelet, and the frontend calls the backend scripts over HTTP.

## Layout

<pre>
<a href="#common">common/</a>
  model/
  types/
  netsuite.ts
<a href="#api">api/</a>
  src/controllers/
  src/services/
  src/repositories/
  src/specifications/
  src/_host/
  src/_lib/
  __tests__/
<a href="#client">client/</a>
  src/routes/
  src/pages/
  src/hooks/
  src/api/
  src/components/
  src/styles/
  __tests__/
  server.ts
  .env.example
<a href="#netsuite">netsuite/</a>
  Objects/
  FileCabinet/
  manifest.xml
  deploy.xml
<a href="#root-files">scripts/</a>
<a href="#root-files">.claude/</a>
<a href="#root-files">README.md</a>
<a href="#root-files">CLAUDE.md</a>
{{#if probity}}
<a href="#root-files">probity.config.ts</a>
{{/if}}
<a href="#root-files">package.json</a>
</pre>

## common/

Code both halves import. Never imports `N/*` modules, because the browser bundles it too.

- `model/` One class per NetSuite record type: its record type id and the field ids the app uses. Written once, here.
- `types/` `api.ts` (the response envelope and the endpoint types both sides share) and `models.gen.ts` (generated from `model/`: one entity type per model).
- `netsuite.ts` The app's names, every script and deployment id, and any other id no model owns.

## api/

The backend. Webpack bundles it into one JavaScript file per deployed script.

Every folder is flat, and the file name carries the layer: `userController.ts`, `userService.ts`, `activeUserRepository.ts`, `employeeRolesSpecifications.ts`. Services and repositories are named after what they handle, not after a controller.

- `src/controllers/` One file per deployed script, `<name>Controller.ts`: the request and response shapes, one function per endpoint, and the Restlet or Suitelet entry point that serves them.
- `src/services/` The decisions: read the request, call repository functions, shape the reply. `<subject>Service.ts`.
- `src/repositories/` The only code that touches NetSuite: records, queries, the session, other scripts. `<subject>Repository.ts`; `generated/` is written by `npm run generate`.
- `src/specifications/` Reusable query filters, one file per record type, `<record>Specifications.ts`, used by repositories.
- `src/_host/` The Suitelet that serves the frontend page, and its client script. Boilerplate: the underscore marks the folders you do not add to.
- `src/_lib/` Plumbing: `defineEndpoints`, `defineRestlet`, `defineSuitelet`, the endpoint envelope, `ApiError`, File Cabinet helpers, the Suitelet client. Boilerplate too.
- `__tests__/` Unit tests for the backend. `test/stubs/N/` stands in for the `N/*` modules.

## client/

The frontend: React 19, TanStack Router, TanStack Query, Tailwind 4. Vite builds it into one file.

- `src/routes/` One file per URL (`#/orders`); `__root.tsx` is the layout around every page. `routeTree.gen.ts` is generated.
- `src/pages/` One component per route: what is on screen. A page calls hooks, never the API directly.
- `src/hooks/` Fetching and caching, one hook per endpoint. The only code that calls `src/api/`.
- `src/api/` One typed module per backend controller the browser calls, built from the type of its endpoints.
- `src/components/` Shared UI pieces, such as the AppShell header and outlet.
- `src/styles/` Tailwind entry point and global CSS.
- `__tests__/` Unit tests for hooks and API modules.
- `server.ts` Local development proxy: signs requests to your sandbox so `npm run dev` works without a NetSuite session.
- `.env.example` The values `server.ts` needs; copy to `.env` (gitignored).

## netsuite/

The SDF project that suitecloud deploys.

- `Objects/` One XML file per script record and its deployment.
- `FileCabinet/` Build output: the bundled frontend and backend files. Never edited.
- `manifest.xml`, `deploy.xml` The SDF manifest and what to deploy.

## Root files

- `scripts/` Node scripts run by npm: `deploy.mjs`, `buildInfo.cjs`, `checkStructure.mjs` (run by `npm run lint`).
- `.claude/` Claude Code settings and the add-controller skill.
- `README.md` Purpose, owners, dependencies, deployment, support and decisions of this application.
- `CLAUDE.md` Project brief for Claude Code.
{{#if probity}}
- `probity.config.ts` Agent guardrails, hooked up in `.claude/settings.json`.
{{/if}}
- `package.json` Workspace root: the `workspaces` list (common, api, client) and the npm scripts (dev, generate, typecheck, lint, test, build, deploy).
- `node_modules/` The only install. npm workspaces hoist every workspace's packages here, so one `npm install` at the root installs everything. Add a package to the workspace that uses it: `npm install -w api <package>`. `npm run lint` fails when a workspace imports a package its own `package.json` does not declare.

## Adding a controller

A controller is one deployed script (a Restlet or a Suitelet) with named endpoints. Every call is a POST whose JSON body carries the request plus an `endpoint` property naming the endpoint. The shipped `user` controller is the reference; copy it and rename. Create these in order:

1. `common/netsuite.ts`: a line in `scripts` with the kind, script id and deployment id.
    ```typescript
    export const scripts = {
        home: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_home', deployId: 'customdeploy_{{prefix}}_home' },
        user: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' },
        /** Runs as Administrator so it can read role assignments; called by the user restlet through api/src/_lib/suiteletClient.ts, not by the browser. */
        userRoles: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_user_roles', deployId: 'customdeploy_{{prefix}}_user_roles' },
        // @netsuite-project:scripts
    } as const satisfies Record<string, ScriptRef>;
    ```
2. `api/src/controllers/<name>Controller.ts`: the whole controller in one file. The NetSuite header first, then the request and response shapes, then one function per endpoint, then the entry point. A handler's parameter is its request and its return value its response; a handler with no parameter takes no request. Shapes are the wire, not the record: an entity type from `common/types/models.gen.ts`, a `Pick` of one, or a composition of several.
    ```typescript
    /**
     * @NApiVersion 2.1
     * @NScriptType Suitelet
     * @NModuleScope SameAccount
     */
    import type { EmployeeRole } from 'common/types/models.gen';
    import { defineSuitelet } from '../_lib/defineSuitelet';
    import { defineEndpoints } from '../_lib/endpoint';
    import { getRolesByEmployee } from '../services/userRolesService';

    export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

    export interface UserRolesByEmployeeRequest {
        employeeId: number;
    }

    export interface UserRolesByEmployeeResponse {
        employeeId: number;
        roles: RoleSummary[];
    }

    export const userRolesEndpoints = defineEndpoints({
        byEmployee: (request: UserRolesByEmployeeRequest): UserRolesByEmployeeResponse => getRolesByEmployee(request),
    });

    export type UserRolesEndpoints = typeof userRolesEndpoints;

    export const onRequest = defineSuitelet('userRoles', userRolesEndpoints);
    ```
    A Restlet ends with `export const post = defineRestlet('user', userEndpoints);` instead, and its header says `@NScriptType Restlet`. That last line, the header and the SDF object are the only transport-specific pieces. An endpoint stays thin: it calls a service and returns the result. The three exports (`<name>Endpoints`, `<Name>Endpoints`, `post` or `onRequest`) are what the rest of the project looks for.
3. `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: the script record and its deployment. Copy the `user` (Restlet) or `userRoles` (Suitelet) object and change the ids, names and the script file path (`api/controllers/<name>Controller.js`).
4. `client/src/api/<name>Api.ts`: the typed client, only when the browser calls the controller. It imports the endpoint type from the controller file, as a type only, so none of the server code reaches the bundle.
    ```typescript
    import type { UserEndpoints } from 'api/controllers/userController';
    import { scripts } from 'common/netsuite';
    import { createApiClient } from './apiClient';

    export const userApi = createApiClient<UserEndpoints>(scripts.user);
    ```
    Then a hook under `client/src/hooks/` calls it: `userApi.roles()` for an endpoint without a request, `ordersApi.byId({ id })` for one with. The second argument carries the abort signal: `userApi.roles(undefined, { signal })`.

Behind the controller: a service under `api/src/services/` (`<subject>Service.ts`) that decides and shapes the reply, repository functions under `api/src/repositories/` (`<subject>Repository.ts`) that read and write, and for a new record type a model under `common/model/` (then `npm run generate`) with its `<record>Specifications.ts`. The service takes the request and response types from the controller file with `import type`. The shipped `userRoles` chain (`userRolesController.ts`, `userRolesService.ts`, `employeeRolesRepository.ts`, `employeeRolesSpecifications.ts`, `common/model/EmployeeRole.ts`) is the reference.

A script that calls another controller of this application from the server (the `user` restlet calling the `userRoles` Suitelet) builds the same kind of client in a repository: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `api/src/_lib/suiteletClient.ts`, with the type imported from the controller file.

`npm run lint` names any piece that is missing or disagrees with the others; `npm run typecheck` catches a client call that names an endpoint the controller lacks.
