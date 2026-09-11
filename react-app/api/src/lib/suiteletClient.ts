import * as https from 'N/https';
import type { ScriptRef } from 'common/netsuite';
import { ENDPOINT_PARAMETER, type ApiEnvelope, type EndpointContract, type EndpointTypes, type HttpMethod } from 'common/types/api';
import { ApiError } from './apiError';

/**
 * Calls another controller of this application from server code, the way client/src/api/apiClient.ts
 * does from the browser: by its scripts entry and its contract, one endpoint at a time, synchronously.
 * Only a Suitelet is reachable this way (https.requestSuitelet rides the caller's session). The usual
 * reason to call one is that it is deployed to run as a role the caller lacks; see scripts.userRoles.
 * A repository builds the client, so the service never knows the answer came from another script.
 */

/** One function per endpoint in the contract, typed by it: `userRolesApi.byEmployee({ employeeId })`. */
export type SuiteletClient<TTypes extends EndpointTypes<TTypes>> = {
    readonly [TName in keyof TTypes]: (request: TTypes[TName]['request']) => TTypes[TName]['response'];
};

function toUrlParameters(request: object): Record<string, string> {
    const parameters: Record<string, string> = {};
    for (const [key, value] of Object.entries(request)) {
        if (value === undefined || value === null || value === '') continue;
        parameters[key] = String(value);
    }
    return parameters;
}

function parseEnvelope<TData>(scriptRef: ScriptRef, endpointName: string, body: string): ApiEnvelope<TData> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(body);
    } catch {
        parsed = undefined;
    }
    if (parsed && typeof parsed === 'object' && 'status' in parsed) return parsed as ApiEnvelope<TData>;
    throw new ApiError(502, `${scriptRef.scriptId} did not answer with the API envelope.`, { script: scriptRef.scriptId, endpoint: endpointName, body: body.slice(0, 500) });
}

/**
 * Calls one endpoint of a Suitelet controller. A GET request travels as URL parameters (so it must be
 * flat), every other method as the JSON body; the endpoint name rides alongside either way. A transport
 * failure is a 502; an error envelope keeps the status the Suitelet answered with.
 */
export function callSuiteletEndpoint<TData>(scriptRef: ScriptRef, endpointName: string, method: HttpMethod, request: object = {}): TData {
    if (scriptRef.kind !== 'suitelet') {
        throw new Error(`${scriptRef.scriptId} is a ${scriptRef.kind}; server code reaches Suitelets only.`);
    }
    const isGet = method === 'GET';
    const response = https.requestSuitelet({
        scriptId: scriptRef.scriptId,
        deploymentId: scriptRef.deployId,
        method,
        urlParams: isGet ? toUrlParameters({ ...request, [ENDPOINT_PARAMETER]: endpointName }) : undefined,
        body: isGet ? undefined : JSON.stringify({ ...request, [ENDPOINT_PARAMETER]: endpointName }),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    });
    if (response.code !== 200) {
        throw new ApiError(502, `${scriptRef.scriptId} answered HTTP ${response.code}.`, { script: scriptRef.scriptId, endpoint: endpointName });
    }
    const envelope = parseEnvelope<TData>(scriptRef, endpointName, response.body);
    if (envelope.error !== null || envelope.status >= 400) {
        throw new ApiError(envelope.status, envelope.error ?? `Request failed (${envelope.status})`, { script: scriptRef.scriptId, endpoint: endpointName });
    }
    return envelope.data as TData;
}

/** Builds the typed client for a Suitelet controller from its scripts entry and its contract. */
export function createSuiteletClient<TTypes extends EndpointTypes<TTypes>>(scriptRef: ScriptRef, contract: EndpointContract<TTypes>): SuiteletClient<TTypes> {
    const client: Record<string, (request: unknown) => unknown> = {};
    for (const name of Object.keys(contract) as Array<keyof TTypes & string>) {
        client[name] = (request) => callSuiteletEndpoint(scriptRef, name, contract[name].method, (request ?? {}) as object);
    }
    return client as SuiteletClient<TTypes>;
}
