---
paths:
  - "api/src/jobs/**"
---

# Map/Reduce jobs

- `api/src/jobs/<name>/` is everything about one job, and exists once `npm run add:jobs` has been run:
  - `<name>.ts`, the file NetSuite loads: the `@NScriptType MapReduceScript` header and one `export { map } from './map';` line per stage. It imports nothing, and nothing imports it.
  - `contract.ts`: every shape the run carries (Request, Item, what map writes, what reduce writes, Result). Every stage imports its types from here: TypeScript does not compare one stage file's types against another's, so one declaration per value keeps the stages together.
  - `getInputData.ts`, `map.ts`, `reduce.ts`, `summarize.ts`: each is the entry point NetSuite calls, built by the builder of that stage from `jobRunRepository`, e.g. `export const map = jobMap<Item, Outcome>(jobs.<name>, (item, job) => …)`. The builder hands the stage its value parsed and carries what `job.write` writes as JSON; `job.runId` is there for a stage that stamps a record with its run.
  - `start.ts`: exports `start<Doing>` for a controller to call; it calls `startJobRun(jobs.<name>, input)` and answers the run id.
- The job's script, deployment and parameter ids are in `netsuite.ts` under `jobs.<name>`, written by hand: a script id ending in `_mr`, a `runParameter`, one deployment id per deployment it may run on. Never in the job's files. The SDF object repeats them.
- `jobGetInputData` opens the run and hands the stage what the run was started with; what `jobSummarize` answers becomes the run's result and closes the run. The first type argument of `jobGetInputData` and the second of `jobSummarize` are the run's contract: `npm run generate` copies the result's type into `client/src/api/<name>Job.gen.ts` (`jobs.<name>.Result`), so it holds no `Date` and no class. The rest of `contract.ts` stays on the server.
- Export getInputData, map or reduce, and summarize always: the run is closed in summarize. A job that leaves nothing behind answers `null` from `jobSummarize<Outcome, null>`.
- A stage that needs NetSuite's context writes the entry point itself (`export function map(context: EntryPoints.MapReduce.mapContext)`) and calls `openJobRun<Request>` / `closeJobRun<Result>` from `jobRunRepository`; the generator reads either form.
- A page follows a run with `useJobRun({ job, runId })` (409 when every deployment of the job is already running). Show `itemsProcessed` of `itemsTotal`: `stagePercentComplete` belongs to the stage being worked, not the run, and starts again at each stage.
- Worked example, including following a run and refreshing the page: `how-to-use/jobs/map-reduce-job.md`.
