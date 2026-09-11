# {{appTitle}}

Suitelet-hosted React application for NetSuite. How to build, run, test and extend it is in [HOW-TO-USE.md](./HOW-TO-USE.md); this file is the record of what the application is for, who owns it, and why it looks the way it does.

## Purpose

{{description}}

_What business process this serves, and for whom. Name the roles that use it and the outcome they get._

## Owners

| Role | Name |
|---|---|
| Business owner | _who decides what it should do_ |
| Technical owner | {{author}} |
| Backup | _who covers when the technical owner is away_ |

## Dependencies

- **Records and fields:** declared on the models in `common/model/`; each model names its record type and every field id it reads or writes. The generated entity types in `common/types/models.gen.ts` are what each controller's request and response shapes (in its `endpoints.ts`) pick from.
- **Scripts and other ids:** `common/netsuite.ts` (script and deployment ids, and any id no model owns: script parameters, saved searches, list values).
- **Packages:** `@amerilux/netsuite-repository` (data access), `@amerilux/netsuite-wrapper` (instrumented `N/*` calls).
- **Integrations and vendors:** _external systems, bundles or SuiteApps this depends on, and the accounts or credentials they need._

## Deployment

- **Environments:** _which sandbox and production accounts this deploys to, by name, and how to get access. Account ids, authentication ids and `project.json` stay out of the repository._
- `npx suitecloud account:setup` once per account, then `npm run deploy` (full SDF deploy) or `npm run deploy:files` (File Cabinet only).
- Everything else about the scripts, the build output and the SDF project is in [HOW-TO-USE.md](./HOW-TO-USE.md#deploy).
- _Anything not covered by the scripts: manual steps, script parameters to set, roles to grant, records to seed._

## Support

- **Logs:** every deployed script writes to its own NetSuite script log (Customization › Scripting › Script Deployments). Log titles are constant phrases (`endpoint completed`, `endpoint rejected`, `endpoint failed`); the controller, endpoint, method, status and ids are in the details.
- **Known issues:** _what breaks, how it shows up, and the workaround._
- **Escalation:** _who to contact first, and where the vendor or NetSuite support case goes._

## Decisions

_Why it was built this way, not just how: the alternatives considered, the constraints that decided them, and what this application replaced. Add an entry per decision, newest last._

- _YYYY-MM-DD: decision, and the reason._
