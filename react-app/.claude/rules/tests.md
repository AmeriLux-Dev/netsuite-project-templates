---
paths:
  - "**/__tests__/**"
---

# Tests

- Tests live in `api/__tests__/<layer>/` and `client/__tests__/`, never next to source, and are never focused or skipped.
- `N/*` and the wrapper's module entry points resolve to the stubs `@amerilux/netsuite-api/testing` ships (see `api/vitest.config.mts`).
- Test controllers (what an endpoint does with the wire: unpacking, checks, the reply), hooks, services and repositories, not UI markup.
- Each layer is tested against a fake of the layer below it: a repository test mocks the generated `dbContext` with a fake carrying the sets it reads, a service test mocks the repository module under the name the service imports it as, and a hook test replaces the generated client's function (`vi.spyOn(user.api, 'roles')`).
