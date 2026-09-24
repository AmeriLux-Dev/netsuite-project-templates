---
paths:
  - "api/src/repositories/**"
{{#if netsuiteRepository}}
  - "api/src/specifications/**"
  - "api/src/models/**"
{{/if}}
---

# Repositories{{#if netsuiteRepository}}, specifications and models{{/if}}

- A repository is the only code that touches NetSuite: records, queries, the session, other scripts, outbound email.{{#if netsuiteRepository}} It reads through `dbContext.<set>` from `generated/context.gen` (no tracking) and writes through `dbContext.withTracking()`, kept in a local and finished before returning. A flow that reads and writes several records under one change tracker is a single repository function.{{/if}}
{{#if netsuiteApi}}
- A repository that calls another Suitelet controller of this application builds its client with `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `@amerilux/netsuite-api/server`, `scripts` coming from the generated `api/src/scripts.gen.ts`. It takes that controller's `Endpoints` and response types as types only, because the other script's wire is its data source. Only a repository builds one.
{{/if}}
- A repository is per record type or outside system, never per page or per service: a service reads from as many repositories as its domain spans (a sales order's lines come from `transactionsRepository`, shared by every transaction type).
- An outside system with several providers of one operation is one repository per provider (`fedExRepository`, `upsRepository`), each exporting the same functions and translating to and from its own API; it decides nothing. The shape they share (`CarrierRepository`, and the types it takes and answers) is declared in a repository file of its own (`carrierRepository.ts`), because a repository never imports a service; each provider imports it as types, and the service that chooses between them holds them in a map (`how-to-use/folder-structure.md`, `src/services/`).
{{#if netsuiteRepository}}
- A specification module holds the `Specification` builders of one record type, one condition per builder. Only repositories import them.
- A model is the declaration of a record, so its type and field ids are written on it and nowhere else. A native record type is named through `NetsuiteRecordType` from `@amerilux/netsuite-repository` (`@RecordType(NetsuiteRecordType.SALES_ORDER)`), a custom record by its id string. A model never imports `N/*`: `npm run generate` evaluates it outside NetSuite.
- After changing a model, run `npm run generate`: it writes `api/src/types/models.gen.ts` (each model's entity interface plus `<Model>Create` and `<Model>Patch`) and `api/src/repositories/generated/`.
- Worked example: `how-to-use/repositories/model-and-repository.md`.
{{/if}}
