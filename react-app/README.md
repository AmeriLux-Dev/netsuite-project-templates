# {{appTitle}}

Suitelet-hosted React application for NetSuite. How it is laid out and how to extend it is in [how-to-use/](./how-to-use/folder-structure.md): the folder structure, and worked examples of a repository, a controller and a job; this file is the record of what the application is for, who owns it, and why it looks the way it does.

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

- **Records and fields:** declared on the models in `api/src/models/`; each model names its record type and every field id it reads or writes. The generated entity types in `api/src/types/models.gen.ts` are what the services' types and each controller's request and response shapes (declared in its controller file) pick from.
- **Scripts:** each controller declares its own script and deployment ids in its `defineRestlet` or `defineSuitelet` call. **Other ids:** `netsuite.ts` (the application's names, and any id no model or controller owns: script parameters, saved searches, list values).
- **Packages:** `@amerilux/netsuite-api` (endpoints, the generated browser client), `@amerilux/netsuite-repository` (data access), `@amerilux/netsuite-wrapper` (instrumented `N/*` calls).
- **Integrations and vendors:** _external systems, bundles or SuiteApps this depends on, and the accounts or credentials they need._

## Deployment

- **Environments:** _which sandbox and production accounts this deploys to, by name, and how to get access. Account ids, authentication ids and `project.json` stay out of the repository._
- `npx suitecloud account:setup` once per account, then `npm run deploy` (full SDF deploy) or `npm run deploy:files` (File Cabinet only).
- Everything else about the scripts, the build output and the SDF project is in [how-to-use/folder-structure.md](./how-to-use/folder-structure.md#netsuite).
- **Roles:** the `home` Suitelet and the `user` Restlet are deployed to the Administrator role only (`audslctrole` in `netsuite/Objects/`); widen the audience there when other roles use the application. The `userRoles` Suitelet is already deployed to all roles and runs as Administrator, and answers for any employee id: before widening the audience, give it an `authorize` option that rejects an employee id other than the caller's.
- _Anything not covered by the scripts: manual steps, script parameters to set, records to seed._

## Support

- **Logs:** every deployed script writes to its own NetSuite script log (Customization › Scripting › Script Deployments). Log titles are constant phrases (`endpoint completed`, `endpoint rejected`, `endpoint failed`); the controller, endpoint, method, status and ids are in the details.
- **Telemetry:** {{#if performanceTracker}}on. Every script run writes a root span to the PerformanceTracker app under the scope `app:{{appNameKebab}}`; that app must be installed in the account. Its Scopes screen turns the scope off, to boundary (root span and log lines) or to diagnostic (every wrapped `N/*` call) without a redeploy. To also ship each run's spans and log lines to an external log system, set `httpsExport` in `api/netsuite-wrapper.config.js` and create the API secret it names.{{/if}}{{#unless performanceTracker}}off. `api/netsuite-wrapper.config.js` turns it on: set `telemetryBootstrap` to the PerformanceTracker integration with this app's scope key, and `instrumentation` to true.{{/unless}}
- **Known issues:** _what breaks, how it shows up, and the workaround._
- **Escalation:** _who to contact first, and where the vendor or NetSuite support case goes._

## Decisions

_Why it was built this way, not just how: the alternatives considered, the constraints that decided them, and what this application replaced. Add an entry per decision, newest last._

- _YYYY-MM-DD: decision, and the reason._
