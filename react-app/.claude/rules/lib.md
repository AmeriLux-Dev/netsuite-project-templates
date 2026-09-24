---
paths:
  - "api/src/lib/**"
---

# lib

- `lib/` holds plain helpers every layer may import: messages from errors, formatting, parsing, grouping rows. Because every layer imports it, it imports only other `lib/` files: no `N/*`, no `@amerilux/*` package, no `netsuite.ts`, nothing else under `api/src/`{{#if netsuiteRepository}} (entity types included){{/if}}. `npm run lint` enforces this.
- A file is named for what it holds (`errors.ts`, `dates.ts`, `collections.ts`), with no layer suffix; a function for what it does to its input (`describeErrorMessage`). The service verb rule does not apply here.
- A function takes values and returns a value. One that needs a record is a service calling a repository; one that needs a NetSuite module is a repository; one that would need a callback to read its data belongs in a service. A business rule (a partner's file layout, the earliest date a list may read) stays in the service of its domain even when it needs no record, so a change to it opens one service.
- Tested under `api/__tests__/lib/` with plain inputs; nothing is mocked.
- Where code two parts share goes when it is not a plain helper: `how-to-use/folder-structure.md`, section `src/lib/`.
