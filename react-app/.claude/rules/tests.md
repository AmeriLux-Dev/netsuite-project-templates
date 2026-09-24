---
paths:
  - "**/__tests__/**"
---

# Tests

- Tests live in `api/__tests__/<layer>/` and `client/__tests__/`, never next to source, and are never focused or skipped. A service whose domain has grown several concerns may split its tests one file per concern under `api/__tests__/services/<service>/` (`salesOrderService/lines.test.ts`); the service itself stays one file.
{{#if netsuiteApi}}
- `N/*` and the wrapper's module entry points resolve to the stubs `@amerilux/netsuite-api/testing` ships (see `api/vitest.config.mts`).
{{/if}}
{{#unless netsuiteApi}}
- Vitest has no stubs for `N/*`: a test that reaches a module importing `N/*` or the wrapper's module entry points needs an alias of the project's own in `api/vitest.config.mts`.
{{/unless}}
- Test controllers (what an endpoint does with the wire: unpacking, checks, the reply), hooks, services and repositories, not UI markup.
- Each layer is tested against a fake of the layer below it: {{#if netsuiteRepository}}a repository test mocks the generated `dbContext` with a fake carrying the sets it reads, {{#unless netsuiteApi}}and {{/unless}}{{/if}}a service test mocks the repository module under the name the service imports it as{{#if netsuiteApi}}, and a hook test replaces the generated client's function (`vi.spyOn(user.api, 'roles')`){{/if}}. A `lib/` function has no layer below it: its test calls it with plain values and mocks nothing.
