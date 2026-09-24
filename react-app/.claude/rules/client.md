---
paths:
  - "client/src/**"
---

# client/src

- File-based routing (TanStack Router, hash history) in `routes/`; `routeTree.gen.ts` is written by the Vite plugin. Pages live in `pages/`, hooks in `hooks/`.
{{#if netsuiteApi}}
- `api/` is generated from the controllers: one `<name>.gen.ts` per controller holding its request and response types, the entity types it names, and (unless `browser: false`) its `api`, one function per endpoint. `index.gen.ts` re-exports each module under the controller's name.
{{/if}}
- A page calls a hook; only a hook calls {{#if netsuiteApi}}a generated `api`{{/if}}{{#unless netsuiteApi}}the backend{{/unless}}.{{#if netsuiteApi}} A hook imports `@/api/index.gen` and writes `user.api.roles()` or `orders.api.byId({ id })`, with call options such as the abort signal after the request, or alone for an endpoint without one (`user.api.roles({ signal })`). A shape is named `user.RolesResponse`.{{/if}}
{{#if netsuiteApi}}
- The generated types are the client's vocabulary: a page or component imports them freely as types (`import type { RoleSummary } from '@/api/user.gen'`). A hook declares a type of its own only when it shapes or combines data for more than one page.
{{/if}}
- A page or component that needs `app` imports the root `netsuite.ts` by relative path (`../../netsuite` from `src/`). Nothing imports from `api/`.
{{#if netsuiteApi}}
- A failed call is reported to `reportApiError` (`hooks/useApiErrors.ts`, handed to `configureApiClient` in `main.tsx`) before it rejects, and the AppShell's `ApiErrorBanner` shows it until dismissed: hooks and pages carry no error handling of their own. A page that shows a failure in place reads the query's `isError` and `error` (an `ApiClientError`, whose `details` is whatever the handler gave its `ApiError`), and its hook passes `{ handleError: false }` to the call.
- A `Date` in a response shape reaches the browser as an ISO string, typed `string` in the generated module. A request shape cannot carry a `Date`.
{{/if}}
