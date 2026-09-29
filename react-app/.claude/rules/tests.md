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
- Test controllers (what an endpoint does with the wire: unpacking, checks, the reply), hooks, services{{#if netsuiteRepository}}, repositories and specifications{{/if}}{{#unless netsuiteRepository}} and repositories{{/unless}}, not UI markup.
- Each layer is tested against a fake of the layer below it: {{#if netsuiteRepository}}a repository test mocks the generated `dbContext` with a fake carrying the sets it reads, {{#unless netsuiteApi}}and {{/unless}}{{/if}}a service test mocks the repository module under the name the service imports it as{{#if netsuiteApi}}, and a hook test replaces the generated client's function (`vi.spyOn(user.api, 'roles')`){{/if}}. A `lib/` function has no layer below it: its test calls it with plain values and mocks nothing.
{{#if netsuiteRepository}}
- A read a service composes is tested in two halves. The service test mocks each specifications module the service imports, every builder answering its name and arguments (`forCustomer: (customerId: number) => ({ forCustomer: [customerId] })`), and asserts the call to `list<Set>`. What each of those builders asks the query for is tested in `api/__tests__/specifications/<set>Specifications.test.ts` (the `nspTestSpecification` snippet). A repository's `list<Set>` test checks only that the specifications reach the set in order.
- A write a service builds is asserted as the exact patch (`toHaveBeenCalledWith(12, { memo: 'Reviewed' })`), so an extra field fails the test. The repository's `update<Record>` test checks that the patch reaches a tracker's `update()` and that the log line names its fields.
{{/if}}
