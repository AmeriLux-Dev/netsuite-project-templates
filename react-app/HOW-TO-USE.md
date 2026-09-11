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
  src/host/
  src/services/
  src/repositories/
  src/specifications/
  src/lib/
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

- `src/controllers/` One folder per deployed script, two files: `endpoints.ts` (the request and response shapes and one function per endpoint) and `<name>Controller.ts` (the Restlet or Suitelet that serves them).
- `src/host/` The Suitelet that serves the frontend page, and its client script.
- `src/services/` The decisions: read the request, call repository functions, shape the reply.
- `src/repositories/` The only code that touches NetSuite: records, queries, the session, other scripts. `generated/` is written by `npm run generate`.
- `src/specifications/` Reusable query filters, one file per record type, used by repositories.
- `src/lib/` Plumbing: `defineRestlet`, `defineSuitelet`, the endpoint envelope, `ApiError`, File Cabinet helpers, the Suitelet client.
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
- `package.json` Workspace root: the npm scripts (dev, generate, typecheck, lint, test, build, deploy).

## Adding a controller

A controller is one deployed script (a Restlet or a Suitelet) with named endpoints. Every call is a POST whose JSON body carries the request plus an `endpoint` property naming the endpoint. The shipped `user` controller is the reference; copy its files and rename. Create these in order:

1. `common/netsuite.ts`: a line in `scripts` with the kind, script id and deployment id.
    ```typescript
    export const scripts = {
        home: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_home', deployId: 'customdeploy_{{prefix}}_home' },
        user: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' },
        /** Runs as Administrator so it can read role assignments; called by the user restlet through api/src/lib/suiteletClient.ts, not by the browser. */
        userRoles: { kind: 'suitelet', scriptId: 'customscript_{{prefix}}_user_roles', deployId: 'customdeploy_{{prefix}}_user_roles' },
        // @netsuite-project:scripts
    } as const satisfies Record<string, ScriptRef>;
    ```
2. `api/src/controllers/<name>/endpoints.ts`: the request and response shapes, then one function per endpoint. A handler's parameter is its request and its return value its response; a handler with no parameter takes no request. Shapes are the wire, not the record: an entity type from `common/types/models.gen.ts`, a `Pick` of one, or a composition of several.
    ```typescript
    import type { EmployeeRole } from 'common/types/models.gen';
    import { defineEndpoints } from '../../lib/endpoint';
    import { getRolesByEmployee } from '../../services/userRoles';

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
    ```
    An endpoint stays thin: it calls a service and returns the result. A big controller can spread its handlers over more files and gather them in `endpoints.ts`; the two exports are what the rest of the project looks for.
3. `api/src/controllers/<name>/<name>Controller.ts`: the deployed script file. A Restlet exports `post`, a Suitelet exports `onRequest`; both take the endpoints from step 2.
    ```typescript
    /**
     * @NApiVersion 2.1
     * @NScriptType Restlet
     * @NModuleScope SameAccount
     */
    import { defineRestlet } from '../../lib/defineRestlet';
    import { userEndpoints } from './endpoints';

    export const post = defineRestlet('user', userEndpoints);
    ```
4. `netsuite/Objects/customscript_{{prefix}}_<snake_name>.xml`: the script record and its deployment. Copy the `user` (Restlet) or `userRoles` (Suitelet) object and change the ids, names and script file path.
5. `client/src/api/<name>Api.ts`: the typed client, only when the browser calls the controller. It imports the endpoint type from the api, as a type only, so none of the server code reaches the bundle.
    ```typescript
    import type { UserEndpoints } from 'api/controllers/user/endpoints';
    import { scripts } from 'common/netsuite';
    import { createApiClient } from './apiClient';

    export const userApi = createApiClient<UserEndpoints>(scripts.user);
    ```
    Then a hook under `client/src/hooks/` calls it: `userApi.roles()` for an endpoint without a request, `ordersApi.byId({ id })` for one with. The second argument carries the abort signal: `userApi.roles(undefined, { signal })`.

A script that calls another controller of this application from the server (the `user` restlet calling the `userRoles` Suitelet) builds the same kind of client in a repository: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `api/src/lib/suiteletClient.ts`.

`npm run lint` names any piece that is missing or disagrees with the others; `npm run typecheck` catches a client call that names an endpoint the controller lacks.
