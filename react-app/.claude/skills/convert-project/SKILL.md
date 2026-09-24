---
name: convert-project
description: Bring an existing NetSuite project into this scaffold (SuiteScript files, an older application, another project's services, controllers and scripts). Use when asked to convert, migrate, port or move existing code into this project. Regroups the old logic into one service per domain (a NetSuite record type, or an outside party such as carriers) and proposes the merges before moving anything.
---

# Converting an existing project into this one

The goal is the old project's behaviour in this project's layers, with its logic regrouped by domain. Moving code file for file keeps the old boundaries (a service per page, per line, per carrier), so regroup first and move second. The old project is read, never changed.

## 1. Read

- `how-to-use/folder-structure.md`, sections `src/services/` (domains, the import direction, several providers of one operation) and `src/lib/` (where shared code goes), and `how-to-use/naming.md`.
- Every script of the old project: its type, what triggers it, its deployments and parameters.
- Every module that decides something: who calls it, and which NetSuite record types and outside systems it reads and writes.

## 2. Group the logic into domains

One service per domain. A domain is a NetSuite record type with everything that exists only as part of it, or an outside party or capability with no record of its own.

- A record's lines, subrecords and the custom records that exist only under it belong to it: an old `salesOrderLineService`, `salesOrderPackagesService` or `salesOrderLabelsService` becomes part of `salesOrderService`.
- Transactions of different types are different domains: `salesOrderService`, `fulfillmentService`, `purchaseOrderService`, `invoiceService`. What they share at the data level (lines, links) is `transactionsRepository`; there is no `transactionService`.
- An outside party or capability is a domain: carriers, an EDI partner, documents.
- Several providers of one operation are one domain. An old `fedExService` and `upsService` become one `carrierService`, which chooses the carrier (starting from the order's ship method) and holds the rules every carrier shares, over `fedExRepository` and `upsRepository`, which export the same functions and translate to and from their own APIs. Where the old project let a page or a job pick the provider (an endpoint or a job per carrier), the choice moves into the service and those endpoints and jobs merge into one.
- A page, a job, a document or a step is never a domain: its logic goes to the service of the domain it is about.
- A function that touches two records belongs to the domain of the record it creates or changes; a read belongs to the domain of the records it reads or lists.
- A pure function that states a business rule (a partner's file layout, a cutoff date, how a carton label is numbered) stays in its domain's service. Only helpers that know nothing of NetSuite or the business go to `api/src/lib/`.
- For a doubtful merge: merge what changes together and what one caller chooses between; keep apart what changes for different reasons.

## 3. Order the services

Services import one another in one direction, following NetSuite's transaction flow: the later record's service imports the earlier one's (fulfillment imports sales order), never back. Code two services need that reads or writes records goes in a service below both, named for its subject, never `sharedService` or `commonService`. `npm run lint` fails on a cycle.

## 4. Place everything else

| Old code | Goes to |
|---|---|
| a Restlet or a Suitelet | one controller per script{{#if netsuiteApi}} (`how-to-use/controllers/`){{/if}}: it unpacks the request, calls a service and shapes the reply |
{{#if netsuiteApi}}
| a Map/Reduce or scheduled script | a job folder (`how-to-use/jobs/map-reduce-job.md`), after `npm run add:jobs` |
{{/if}}
| a user event or a client script | `api/src/events/user/` or `api/src/events/client/` |
| `N/record`, `N/query`, `N/search` | {{#if netsuiteRepository}}a model per record type, and repository functions over `dbContext` (`how-to-use/repositories/model-and-repository.md`){{/if}}{{#unless netsuiteRepository}}repository functions, one repository per record type{{/unless}} |
| `N/https`, `N/file`, `N/runtime`, `N/email` | repository functions, one repository per outside system or module |
| a hard-coded id | {{#if netsuiteRepository}}the model (record and field ids), {{/if}}{{#if netsuiteApi}}the controller's declaration (script ids), {{/if}}`netsuite.ts`{{#if codeGeneration}} (everything else){{/if}} |
| a helper that knows nothing of NetSuite or the business | `api/src/lib/` |

Old names are not carried over: a file or function keeps its name only when it already follows `how-to-use/naming.md`.

## 5. Propose, then move

Before moving any code, show the person one table: each old module, where its logic lands (a service, repository, controller{{#if netsuiteApi}}, job{{/if}} or `lib/` file), and every merge and rename. The merges are theirs to decide; wait for their answer.

Then move one domain at a time, earliest record in the transaction flow first:

{{#if netsuiteRepository}}
1. The models, then `npm run generate`.
{{/if}}
{{#if netsuiteRepository}}2{{/if}}{{#unless netsuiteRepository}}1{{/unless}}. The repositories, with their tests.
{{#if netsuiteRepository}}3{{/if}}{{#unless netsuiteRepository}}2{{/unless}}. The service, with its tests. Exports are renamed to `get`, `create`, `update` or `remove` (`is` or `has` for a check) as they move, and builders stay private. A large domain's tests may split one file per concern under `api/__tests__/services/<service>/`.
{{#if netsuiteRepository}}4{{/if}}{{#unless netsuiteRepository}}3{{/unless}}. The controllers{{#if netsuiteApi}} and jobs{{/if}} that call it, with their SDF objects.
{{#if netsuiteRepository}}5{{/if}}{{#unless netsuiteRepository}}4{{/unless}}. The client's hooks and pages.

After each domain, run `npm run typecheck`, `npm run lint` and `npm test`, and fix what fails before starting the next. Raise anything these rules do not place with the person rather than forcing it into a folder.
