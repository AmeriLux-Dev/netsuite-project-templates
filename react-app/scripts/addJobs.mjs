#!/usr/bin/env node
/**
 * `npm run add:jobs`: adds what a project needs before it can have Map/Reduce jobs, and nothing else.
 * A project scaffolded without jobs has none of this; run it the day the first job is wanted.
 *
 * What it adds:
 *   - netsuite/Objects/customrecord_<prefix>_job_run.xml   the record a run lives in
 *   - netsuite/Objects/customscript_<prefix>_job_cleanup_mr.xml  the cleanup job, scheduled daily
 *   - api/src/jobs/jobRunCleanup.ts                       that job's stages
 *   - api/src/repositories/jobRunRepository.ts            the run store: start, read, find expired, remove
 *   - api/src/services/jobRunService.ts                   who may see a run, and what cleanup removes
 *   - api/src/controllers/jobRunsController.ts (+ object)  the endpoint a page polls
 *   - client/src/hooks/useJobRun.ts                       the hook that polls it
 *   - the `jobRuns` block in netsuite-api.config.json      the record's ids, for the generator
 *
 * It writes nothing that is already there, so running it twice is safe, and it never touches a file
 * it did not create. The ids come from `app.prefix` and `app.fileCabinet.folder` in netsuite.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const written = [];
const kept = [];

function readProjectFile(relativePath) {
    return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

/** Writes the file unless it is already there; an existing file is left exactly as it is. */
function addProjectFile(relativePath, content) {
    const fullPath = path.join(projectRoot, relativePath);
    if (existsSync(fullPath)) {
        kept.push(relativePath);
        return;
    }
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
    written.push(relativePath);
}

/** The application's names, read from netsuite.ts as text: the same source the structure check reads. */
function readAppNames() {
    const source = readProjectFile('netsuite.ts');
    const prefix = source.match(/^\s*prefix:\s*'([^']*)'/m)?.[1];
    const folder = source.match(/^\s*folder:\s*'([^']*)'/m)?.[1];
    const title = source.match(/^\s*title:\s*'([^']*)'/m)?.[1];
    if (!prefix || !folder) {
        console.error('Could not read app.prefix and app.fileCabinet.folder from netsuite.ts; is this a scaffolded project?');
        process.exit(1);
    }
    return { prefix, folder, title: title ?? folder };
}

const app = readAppNames();
const recordType = `customrecord_${app.prefix}_job_run`;
const fieldPrefix = `custrecord_${app.prefix}_jr`;
const cleanupScriptId = `customscript_${app.prefix}_job_cleanup_mr`;
const cleanupDeployId = `customdeploy_${app.prefix}_job_cleanup_mr`;
const cleanupRunParameter = `custscript_${app.prefix}_job_cleanup_run`;
const cleanupDaysParameter = `custscript_${app.prefix}_job_cleanup_days`;
const controllerScriptId = `customscript_${app.prefix}_job_runs`;
const controllerDeployId = `customdeploy_${app.prefix}_job_runs`;
const DEFAULT_RETENTION_DAYS = 7;

function customRecordField(id, { label, fieldType, help = '', mandatory = false, selectRecordType = '' }) {
    return `    <customrecordcustomfield scriptid="${id}">
      <accesslevel>2</accesslevel>
      <allowquickadd>F</allowquickadd>
      <applyformatting>F</applyformatting>
      <checkspelling>F</checkspelling>
      <defaultchecked>F</defaultchecked>
      <defaultselection></defaultselection>
      <defaultvalue></defaultvalue>
      <description>${help}</description>
      <displayheight></displayheight>
      <displaytype>NORMAL</displaytype>
      <displaywidth></displaywidth>
      <dynamicdefault></dynamicdefault>
      <enabletextenhance>F</enabletextenhance>
      <encryptatrest>F</encryptatrest>
      <fieldtype>${fieldType}</fieldtype>
      <globalsearch>F</globalsearch>
      <help></help>
      <isformula>F</isformula>
      <ismandatory>${mandatory ? 'T' : 'F'}</ismandatory>
      <isparent>F</isparent>
      <label>${label}</label>
      <linktext></linktext>
      <maxlength></maxlength>
      <maxvalue></maxvalue>
      <minvalue></minvalue>
      <onparentdelete></onparentdelete>
      <parentsubtab></parentsubtab>
      <rolerestrict>F</rolerestrict>
      <searchcomparefield></searchcomparefield>
      <searchdefault></searchdefault>
      <searchlevel>2</searchlevel>
      <selectrecordtype>${selectRecordType}</selectrecordtype>
      <showinlist>T</showinlist>
      <sourcefilterby></sourcefilterby>
      <sourcefrom></sourcefrom>
      <sourcelist></sourcelist>
      <storevalue>T</storevalue>
    </customrecordcustomfield>`;
}

const runRecordObject = `<customrecordtype scriptid="${recordType}">
  <accesstype>CUSTRECORDENTRYPERM</accesstype>
  <allowattachments>F</allowattachments>
  <allowinlinedeleting>F</allowinlinedeleting>
  <allowinlinedetaching>F</allowinlinedetaching>
  <allowinlineediting>F</allowinlineediting>
  <allowmobileaccess>F</allowmobileaccess>
  <allownumberingoverride>F</allownumberingoverride>
  <allowquickadd>F</allowquickadd>
  <allowquicksearch>T</allowquicksearch>
  <allowuiaccess>T</allowuiaccess>
  <customsegment></customsegment>
  <description>One row per run of a ${app.title} job: what it was asked to do, where it got to, and what it left behind. Rows are removed by the ${app.title} Job Run Cleanup script, so nothing here is permanent.</description>
  <enabledle>T</enabledle>
  <enablekeywords>F</enablekeywords>
  <enablemailmerge>F</enablemailmerge>
  <enablenametranslation>F</enablenametranslation>
  <enablenumbering>F</enablenumbering>
  <enableoptimisticlocking>F</enableoptimisticlocking>
  <enablesystemnotes>T</enablesystemnotes>
  <hierarchical>F</hierarchical>
  <icon></icon>
  <iconbuiltin>T</iconbuiltin>
  <iconindex></iconindex>
  <includeinsearchmenu>T</includeinsearchmenu>
  <includename>T</includename>
  <isinactive>F</isinactive>
  <isordered>F</isordered>
  <numberinginit></numberinginit>
  <numberingmindigits></numberingmindigits>
  <numberingprefix></numberingprefix>
  <numberingsuffix></numberingsuffix>
  <recordname>${app.title} Job Run</recordname>
  <showcreationdate>T</showcreationdate>
  <showcreationdateonlist>T</showcreationdateonlist>
  <showid>T</showid>
  <showlastmodified>T</showlastmodified>
  <showlastmodifiedonlist>T</showlastmodifiedonlist>
  <shownotes>F</shownotes>
  <showowner>F</showowner>
  <showownerallowchange>F</showownerallowchange>
  <showowneronlist>F</showowneronlist>
  <customrecordcustomfields>
${[
    customRecordField(`${fieldPrefix}_job`, { label: 'Job', fieldType: 'TEXT', mandatory: true, help: 'The job&apos;s name, as its declaration gives it.' }),
    customRecordField(`${fieldPrefix}_status`, { label: 'Status', fieldType: 'TEXT', help: 'pending, running, complete or failed.' }),
    customRecordField(`${fieldPrefix}_stage`, { label: 'Stage', fieldType: 'TEXT' }),
    customRecordField(`${fieldPrefix}_percent`, { label: 'Percent Complete', fieldType: 'INTEGER' }),
    customRecordField(`${fieldPrefix}_input`, { label: 'Input', fieldType: 'LONGTEXT', help: 'What the run was started with, as JSON.' }),
    customRecordField(`${fieldPrefix}_result`, { label: 'Result', fieldType: 'LONGTEXT', help: 'What the summarize stage returned, as JSON.' }),
    customRecordField(`${fieldPrefix}_errors`, { label: 'Errors', fieldType: 'LONGTEXT', help: 'Everything that failed in the run, as JSON.' }),
    customRecordField(`${fieldPrefix}_task`, { label: 'Task Id', fieldType: 'TEXT', help: 'NetSuite&apos;s own task id, so a finished run can still be asked about.' }),
    customRecordField(`${fieldPrefix}_deploy`, { label: 'Deployment', fieldType: 'TEXT', help: 'The deployment the run is on; a deployment runs one instance at a time.' }),
    customRecordField(`${fieldPrefix}_by`, { label: 'Started By', fieldType: 'SELECT', selectRecordType: '-4', help: 'Empty for a scheduled run.' }),
    customRecordField(`${fieldPrefix}_start`, { label: 'Started At', fieldType: 'DATETIMETZ' }),
    customRecordField(`${fieldPrefix}_end`, { label: 'Finished At', fieldType: 'DATETIMETZ' }),
].join('\n')}
  </customrecordcustomfields>
</customrecordtype>
`;

function scriptParameter(id, { label, fieldType, help, mandatory = false, defaultValue = '' }) {
    return `    <scriptcustomfield scriptid="${id}">
      <accesslevel>2</accesslevel>
      <aidescription></aidescription>
      <applyformatting>F</applyformatting>
      <checkspelling>F</checkspelling>
      <defaultchecked>F</defaultchecked>
      <defaultselection></defaultselection>
      <defaultvalue>${defaultValue}</defaultvalue>
      <description>${help}</description>
      <displayheight></displayheight>
      <displaytype>NORMAL</displaytype>
      <displaywidth></displaywidth>
      <dynamicdefault></dynamicdefault>
      <fieldtype>${fieldType}</fieldtype>
      <isformula>F</isformula>
      <ismandatory>${mandatory ? 'T' : 'F'}</ismandatory>
      <label>${label}</label>
      <linktext></linktext>
      <maxlength></maxlength>
      <maxvalue></maxvalue>
      <minvalue></minvalue>
      <onparentdelete></onparentdelete>
      <searchlevel>2</searchlevel>
      <selectrecordtype></selectrecordtype>
      <setting></setting>
      <storevalue>T</storevalue>
    </scriptcustomfield>`;
}

/** Tomorrow, so the first cleanup run is a day after the deploy rather than the moment it lands. */
function tomorrow() {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
}

const cleanupObject = `<mapreducescript scriptid="${cleanupScriptId}">
  <description>Removes ${app.title} job runs older than the retention parameter. Run records are a progress signal, not history: this keeps the record from growing without end.</description>
  <isinactive>F</isinactive>
  <name>${app.title} Job Run Cleanup</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <scriptfile>[/SuiteScripts/${app.folder}/api/jobs/jobRunCleanup.js]</scriptfile>
  <scriptcustomfields>
${[
    scriptParameter(cleanupRunParameter, { label: 'Run Id', fieldType: 'TEXT', help: 'The run record this run reports to. Left empty: a scheduled run opens its own.' }),
    scriptParameter(cleanupDaysParameter, { label: 'Retention Days', fieldType: 'INTEGER', help: 'How many days of run records to keep. Change it here; no deploy needed.', defaultValue: String(DEFAULT_RETENTION_DAYS) }),
].join('\n')}
  </scriptcustomfields>
  <scriptdeployments>
    <scriptdeployment scriptid="${cleanupDeployId}">
      <buffersize>1</buffersize>
      <concurrencylimit>1</concurrencylimit>
      <${cleanupDaysParameter}>${DEFAULT_RETENTION_DAYS}</${cleanupDaysParameter}>
      <isdeployed>T</isdeployed>
      <loglevel>AUDIT</loglevel>
      <queueallstagesatonce>F</queueallstagesatonce>
      <runasrole>ADMINISTRATOR</runasrole>
      <status>SCHEDULED</status>
      <title>${app.title} Job Run Cleanup</title>
      <yieldaftermins>60</yieldaftermins>
      <!-- The schedule lives here, not in the account: a deploy overwrites the deployment record, so a
           schedule entered in the UI would be lost the next time this is deployed. -->
      <recurrence>
        <daily>
          <startdate>${tomorrow()}</startdate>
          <starttime>07:00:00Z</starttime>
          <everyxdays>1</everyxdays>
          <repeat></repeat>
        </daily>
      </recurrence>
    </scriptdeployment>
  </scriptdeployments>
</mapreducescript>
`;

const controllerObject = `<restlet scriptid="${controllerScriptId}">
  <description>What a run of a ${app.title} job is doing, for the page that started it.</description>
  <isinactive>F</isinactive>
  <name>${app.title} Job Runs</name>
  <notifyadmins>F</notifyadmins>
  <notifyemails></notifyemails>
  <notifyowner>T</notifyowner>
  <notifyuser>F</notifyuser>
  <scriptfile>[/SuiteScripts/${app.folder}/api/controllers/jobRunsController.js]</scriptfile>
  <scriptdeployments>
    <scriptdeployment scriptid="${controllerDeployId}">
      <allemployees>F</allemployees>
      <allpartners>F</allpartners>
      <allroles>F</allroles>
      <audslctrole>ADMINISTRATOR</audslctrole>
      <isdeployed>T</isdeployed>
      <loglevel>DEBUG</loglevel>
      <status>RELEASED</status>
      <title>${app.title} Job Runs</title>
    </scriptdeployment>
  </scriptdeployments>
</restlet>
`;

const cleanupJob = `/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */

import { defineJob } from '@amerilux/netsuite-api/server';
import type { JobSummary } from '@amerilux/netsuite-api/server';
import { jobRuns } from '../scripts.gen';
import { listExpiredJobRuns, removeJobRun } from '../services/jobRunService';

/**
 * Removes run records that have outlived the retention parameter on this job's deployment. A run
 * record is how a page follows a job that is working and how a failure is found afterwards; it is not
 * history, so it goes. Change \`Retention Days\` on the deployment in NetSuite to keep more or less.
 *
 * This job is itself a job, so it has a run of its own, cleaned up by a later run like any other.
 */

/** What the run leaves behind: how many records it removed. */
export interface CleanupResult {
    removed: number;
}

export const { getInputData, map, summarize } = defineJob({
    name: 'jobRunCleanup',
    scriptId: '${cleanupScriptId}',
    deployments: ['${cleanupDeployId}'],
    runParameter: '${cleanupRunParameter}',
    parameters: { retentionDays: { id: '${cleanupDaysParameter}', type: 'integer' } },
    runs: jobRuns,
}, {
    getInputData: (_input: void, job): string[] => listExpiredJobRuns(job.parameters.retentionDays),
    map: (runId: string, job): void => {
        removeJobRun(runId);
        job.write(runId, 1);
    },
    summarize: (summary: JobSummary<number>): CleanupResult => ({ removed: summary.output.length }),
});
`;

const jobRunRepository = `import { createJobRunStore } from '@amerilux/netsuite-api/server';
import type { JobRef, JobRun } from '@amerilux/netsuite-api/server';
import { jobRuns } from '../scripts.gen';

/**
 * Data access for job runs: the record a run lives in, and the task that carries it. Starting a job
 * writes a record and submits a Map/Reduce task, and reading one asks NetSuite about the task as well,
 * which is what tells a run that died from one still working. A repository, because both are NetSuite
 * calls; a service decides whether a job should start and who may look at a run.
 *
 * The ids come from the generated \`jobRuns\`, written from the jobRuns block of netsuite-api.config.json.
 */

const jobRunStore = createJobRunStore(jobRuns);

/** Starts a job and answers the run id. Throws a 409 when every deployment of it is already running. */
export function startJobRun(job: JobRef, input: unknown): string {
    return jobRunStore.start(job, input);
}

/** The run as it stands, or null when there is no such record (it was never started, or it has been cleaned up). */
export function findJobRun(runId: string): JobRun | null {
    return jobRunStore.read(runId);
}

/** Run ids older than the given number of days: what the cleanup job works through. */
export function listExpiredJobRunIds(olderThanDays: number): string[] {
    return jobRunStore.findExpired(olderThanDays);
}

export function deleteJobRun(runId: string): void {
    jobRunStore.remove(runId);
}
`;

const jobRunService = `import type { JobRun } from '@amerilux/netsuite-api/server';
import { readActiveUser } from '../repositories/activeUserRepository';
import { deleteJobRun, findJobRun, listExpiredJobRunIds } from '../repositories/jobRunRepository';

/**
 * What may be known about a job run, and what the cleanup job removes. A run belongs to whoever
 * started it: anyone else is told there is no such run rather than that they may not see it, so a run
 * id cannot be used to find out what other people are running. A scheduled run belongs to nobody and
 * is nobody's to read.
 */

/** The run, if it is the caller's to see. Null covers both "no such run" and "not yours". */
export function getJobRunForCaller(runId: string): JobRun | null {
    const run = findJobRun(runId);
    if (!run) return null;
    return run.startedBy !== null && run.startedBy === readActiveUser().id ? run : null;
}

/** The runs old enough to remove. */
export function listExpiredJobRuns(olderThanDays: number): string[] {
    return listExpiredJobRunIds(Math.max(1, olderThanDays));
}

export function removeJobRun(runId: string): void {
    deleteJobRun(runId);
}
`;

const jobRunsController = `/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { ApiError, defineEndpoints, defineRestlet } from '@amerilux/netsuite-api/server';
import type { JobRunError, JobRunStage, JobRunStatus } from '@amerilux/netsuite-api/server';
import { getJobRunForCaller } from '../services/jobRunService';

/**
 * What a run of a job is doing. Every job's page polls this one endpoint, and \`result\` is whatever
 * that job's summarize stage returned: the client hook types it from the job's generated module
 * (\`useJobRun<jobs.<name>.Result>(runId)\`), because one endpoint cannot be typed per job.
 *
 * Starting a job is not here: that belongs to the controller of whatever the job is part of, so the
 * service can decide whether it should start at all.
 */

export interface StatusRequest {
    runId: string;
}

export interface StatusResponse {
    id: string;
    job: string;
    status: JobRunStatus;
    /** Where the run is, while NetSuite is working on it. */
    stage: JobRunStage | null;
    percentComplete: number;
    startedAt: string | null;
    finishedAt: string | null;
    /** What the job's summarize stage returned, once it has; the hook gives it the job's own type. */
    result: unknown;
    errors: JobRunError[];
}

export const jobRunsEndpoints = defineEndpoints({
    /** One run, as the caller who started it may see it; 404 for anything else. */
    status: (request: StatusRequest): StatusResponse => {
        const run = typeof request.runId === 'string' && request.runId !== '' ? getJobRunForCaller(request.runId) : null;
        if (!run) throw ApiError.notFound('No such job run.', { runId: request.runId });
        return {
            id: run.id,
            job: run.job,
            status: run.status,
            stage: run.stage,
            percentComplete: run.percentComplete,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            result: run.result,
            errors: run.errors,
        };
    },
});

/** The endpoint signatures as a type, for server code that calls this controller through the Suitelet client. */
export type JobRunsEndpoints = typeof jobRunsEndpoints;

export const post = defineRestlet({
    name: 'jobRuns',
    scriptId: '${controllerScriptId}',
    deployId: '${controllerDeployId}',
}, jobRunsEndpoints);
`;

const useJobRunHook = `import { useQuery } from '@tanstack/react-query';
import { jobRuns } from '@/api/index.gen';

/**
 * Follows a job run until it ends. A Map/Reduce answers nothing, so the page holds the run id the
 * starting endpoint gave it and asks about it every couple of seconds; the polling stops by itself
 * once the run is complete or failed, and the run says why it failed rather than going quiet.
 *
 * The result is whatever that job's summarize stage returns, so the caller names the job's own type:
 * \`useJobRun<jobs.closeStaleOrders.Result>(runId)\`.
 */

const POLL_INTERVAL_MILLISECONDS = 2000;

export const jobRunQueryKey = (runId: string | undefined) => ['jobRuns', 'status', runId] as const;

export function useJobRun<TResult = unknown>(runId: string | undefined) {
    const query = useQuery({
        queryKey: jobRunQueryKey(runId),
        enabled: runId !== undefined,
        queryFn: ({ signal }) => jobRuns.api.status({ runId: runId as string }, { signal }),
        // A finished run never changes again; anything else is still worth asking about.
        refetchInterval: ({ state }) => (state.data?.status === 'complete' || state.data?.status === 'failed' ? false : POLL_INTERVAL_MILLISECONDS),
    });
    const run = query.data;
    return {
        ...query,
        run,
        /** True while the run exists and has not ended. */
        isRunning: run !== undefined && (run.status === 'pending' || run.status === 'running'),
        result: (run?.result ?? null) as TResult | null,
    };
}
`;

addProjectFile(`netsuite/Objects/${recordType}.xml`, runRecordObject);
addProjectFile(`netsuite/Objects/${cleanupScriptId}.xml`, cleanupObject);
addProjectFile(`netsuite/Objects/${controllerScriptId}.xml`, controllerObject);
addProjectFile('api/src/jobs/jobRunCleanup.ts', cleanupJob);
addProjectFile('api/src/repositories/jobRunRepository.ts', jobRunRepository);
addProjectFile('api/src/services/jobRunService.ts', jobRunService);
addProjectFile('api/src/controllers/jobRunsController.ts', jobRunsController);
addProjectFile('client/src/hooks/useJobRun.ts', useJobRunHook);

// The generator needs the record's ids to write them into the scripts map; everything else it reads from the jobs.
const configPath = 'netsuite-api.config.json';
const config = JSON.parse(readProjectFile(configPath));
if (config.jobRuns === undefined) {
    config.jobRuns = { recordType, fieldPrefix, extraFields: {} };
    writeFileSync(path.join(projectRoot, configPath), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    written.push(`${configPath} (jobRuns)`);
} else {
    kept.push(`${configPath} (jobRuns)`);
}

if (written.length === 0) {
    console.log('Jobs are already set up in this project; nothing to add.');
} else {
    console.log('Added:');
    for (const file of written) console.log(`  + ${file}`);
    if (kept.length > 0) {
        console.log('Already there, left alone:');
        for (const file of kept) console.log(`  = ${file}`);
    }
    console.log('\nNext: `npm run generate`, then write a job under api/src/jobs (the nspJob snippet, or HOW-TO-USE.md, "Adding a job").');
    console.log('The run record and the cleanup script reach the account on the next `npm run deploy`.');
}
