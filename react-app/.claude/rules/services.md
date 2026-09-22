---
paths:
  - "api/src/services/**"
---

# Services

- A service decides. It takes plain arguments (an id, a filter, one object for a create's fields), calls repository functions by their domain names, and returns a type it declares itself: `RoleSummary`, a `Pick` of an entity type, or a composition such as `ActiveUserRoles`. Entity types from `../types/models.gen` are fine.
- A service is one domain: a NetSuite record type with everything that exists only as part of it (its lines, its subrecords, the custom records that exist only under it), or an outside party or capability with no record of its own (carriers, EDI, documents). It is named for the domain (`salesOrderService`, `fulfillmentService`, `customerService`, `carrierService`), never for a line, a page, a job, a step or a controller: there is no `salesOrderLineService`, `transactionLineService` or `salesOrderLabelsService`. Transactions of different types are different domains; what they share at the data level (lines, links) is one repository, not a `transactionService`.
- A function that touches two records belongs to the domain of the record it creates or changes; a read belongs to the domain of the records it reads or lists. Creating a fulfillment from a sales order is `fulfillmentService`'s; a customer's credit is `customerService`'s, whichever page shows it.
- It never sees a controller: the controller depends on the service, so any controller can call any service and shape the reply its own way.
- What it exports starts with `get`, `create`, `update` or `remove`, or `is` / `has` for a yes-or-no check. A `build<Type>` stays inside the service, tested through the functions that use it.
- Services import one another in one direction, following NetSuite's transaction flow: the later record's service imports the earlier one's (`fulfillmentService` imports `salesOrderService`, `invoiceService` imports `fulfillmentService`), never back; `npm run lint` fails on an import cycle. Code two services share that decides and reads or writes records goes in a service below both, named for its subject (never `sharedService` or `commonService`). Code that only hands a record through is a repository function each calls directly; code that only computes from values goes in `lib/`.
- Several providers of one operation (FedEx and UPS both create a shipping label) are one service and one repository per provider. The service owns the choice (the order's ship method, weight, customer) and everything every provider shares; each provider's repository exports the same functions, translates to and from its API, and decides nothing. The service holds them in a map checked with `satisfies`, so a provider missing a function fails the typecheck:

  ```ts
  import * as fedExRepository from '../repositories/fedExRepository';
  import * as upsRepository from '../repositories/upsRepository';
  import type { CarrierRepository } from '../repositories/carrierRepository';

  const carrierRepositories = { fedEx: fedExRepository, ups: upsRepository } satisfies Record<CarrierName, CarrierRepository>;
  ```

  Keep the shared shape to what every provider does; a provider's extra step (a pickup, a customs form) happens inside its own repository function. With one provider, call its repository directly and add the map when the second arrives.
- Each repository is imported as a namespace (`import * as salesOrdersRepository from '../repositories/salesOrdersRepository'`, then `salesOrdersRepository.findSalesOrder(id)`), so the service's `removeSalesOrder` can call the repository's without the names clashing. Its test mocks each repository module under that same name.
- Which role a function needs is its script's concern: a function that reads a record the caller's role cannot works only in a script whose deployment runs as another role, and its comment says so (`userService.getRolesByEmployee`).
