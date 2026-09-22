---
paths:
  - "api/src/repositories/**"
  - "api/src/specifications/**"
  - "api/src/models/**"
---

# Repositories, specifications and models

- A repository is the only code that touches NetSuite: records, queries, the session, other scripts, outbound email. It reads through `dbContext.<set>` from `generated/context.gen` (no tracking) and writes through `dbContext.withTracking()`, kept in a local and finished before returning. A flow that reads and writes several records under one change tracker is a single repository function.
- A repository that calls another Suitelet controller of this application builds its client with `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)` from `@amerilux/netsuite-api/server`, `scripts` coming from the generated `api/src/scripts.gen.ts`. It takes that controller's `Endpoints` and response types as types only, because the other script's wire is its data source. Only a repository builds one.
- A specification module holds the `Specification` builders of one record type, one condition per builder. Only repositories import them.
- A model is the declaration of a record, so its type and field ids are written on it and nowhere else. A native record type is named through `NetsuiteRecordType` from `@amerilux/netsuite-repository` (`@RecordType(NetsuiteRecordType.SALES_ORDER)`), a custom record by its id string. A model never imports `N/*`: `npm run generate` evaluates it outside NetSuite.
- After changing a model, run `npm run generate`: it writes `api/src/types/models.gen.ts` (each model's entity interface plus `<Model>Create` and `<Model>Patch`) and `api/src/repositories/generated/`.
- Worked example: `how-to-use/repositories/model-and-repository.md`.
