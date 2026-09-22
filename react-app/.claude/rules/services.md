---
paths:
  - "api/src/services/**"
---

# Services

- A service decides. It takes plain arguments (an id, a filter, one object for a create's fields), calls repository functions by their domain names, and returns a type it declares itself: `RoleSummary`, a `Pick` of an entity type, or a composition such as `ActiveUserRoles`. Entity types from `../types/models.gen` are fine.
- It is named after what it handles (a subject), not after a controller, and never sees one: the controller depends on the service, so any controller can call any service and shape the reply its own way.
- What it exports starts with `get`, `create`, `update` or `remove`, or `is` / `has` for a yes-or-no check. A `build<Type>` stays inside the service, tested through the functions that use it.
- Each repository is imported as a namespace (`import * as salesOrdersRepository from '../repositories/salesOrdersRepository'`, then `salesOrdersRepository.findSalesOrder(id)`), so the service's `removeSalesOrder` can call the repository's without the names clashing. Its test mocks each repository module under that same name.
