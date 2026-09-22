---
paths:
  - "api/src/events/**"
---

# Events

- Logic that belongs to a NetSuite record, not to this application: `user/<subject>.ts` (`@NScriptType UserEventScript`, on the server when a record is saved) and `client/<subject>.ts` (`@NScriptType ClientScript`, in the browser on a record page). One self-contained file per script, outside the layers.
- A user event works the record its context carries, logs with `N/log`, and reaches anything else in NetSuite through a repository function.
- A client event is a page script: it calls `N/*` itself, logs with `console`, imports nothing of this application, and is built without telemetry.
- The ids an event uses are written at the top of the event file.
- No SDF object: the person creates the script record and its deployments in NetSuite, pointing at `/SuiteScripts/{{appName}}/api/events/<user|client>/<subject>.js`. `npm run deploy` uploads the file; nothing creates the record.
