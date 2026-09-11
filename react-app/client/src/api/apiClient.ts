import type { ScriptKind, ScriptRef } from 'common/netsuite';
import { ENDPOINT_PARAMETER, type ApiEnvelope, type EndpointContract, type EndpointTypes, type HttpMethod } from 'common/types/api';

/**
 * Calls an API controller by its script and deployment ids, one endpoint at a time. The entry's
 * `kind` decides the URL, so a controller can move between Restlet and Suitelet without touching
 * the caller. In the deployed app the call rides the NetSuite session on the same origin; in
 * development it goes through the local proxy in server.ts.
 */

export type ApiQuery = Record<string, string | number | boolean | undefined | null>;

export interface ApiCallOptions {
    signal?: AbortSignal;
}

export class ApiClientError extends Error {
    constructor(readonly status: number, message: string, readonly details?: unknown) {
        super(message);
        this.name = 'ApiClientError';
    }
}

export const API_BASE_PATHS: Record<ScriptKind, string> = import.meta.env.DEV
    ? { restlet: '/api/restlet', suitelet: '/api/suitelet' }
    : { restlet: '/app/site/hosting/restlet.nl', suitelet: '/app/site/hosting/scriptlet.nl' };

export function buildApiUrl(scriptRef: ScriptRef, query: ApiQuery = {}): string {
    const parameters = new URLSearchParams({ script: scriptRef.scriptId, deploy: scriptRef.deployId });
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        parameters.set(key, String(value));
    }
    return `${API_BASE_PATHS[scriptRef.kind]}?${parameters.toString()}`;
}

/**
 * Calls one endpoint of a controller. A GET request travels as query parameters (so it must be flat),
 * every other method as the JSON body; the endpoint name rides alongside either way.
 */
export async function callEndpoint<TData>(scriptRef: ScriptRef, endpointName: string, method: HttpMethod, request: object = {}, options: ApiCallOptions = {}): Promise<TData> {
    const isGet = method === 'GET';
    const url = buildApiUrl(scriptRef, isGet ? { ...(request as ApiQuery), [ENDPOINT_PARAMETER]: endpointName } : {});
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: isGet ? undefined : JSON.stringify({ ...request, [ENDPOINT_PARAMETER]: endpointName }),
        signal: options.signal,
    });

    let envelope: ApiEnvelope<TData> | undefined;
    const text = await response.text();
    try {
        envelope = text ? (JSON.parse(text) as ApiEnvelope<TData>) : undefined;
    } catch {
        envelope = undefined;
    }

    if (!envelope || typeof envelope !== 'object' || !('status' in envelope)) {
        throw new ApiClientError(response.status, `Unexpected response from ${scriptRef.scriptId} (${response.status})`, text.slice(0, 500));
    }
    if (envelope.error !== null || envelope.status >= 400) {
        throw new ApiClientError(envelope.status, envelope.error ?? `Request failed (${envelope.status})`);
    }
    return envelope.data as TData;
}

/** One function per endpoint in the contract, typed by it: `userApi.roles({})`. */
export type ApiClient<TTypes extends EndpointTypes<TTypes>> = {
    readonly [TName in keyof TTypes]: (request: TTypes[TName]['request'], options?: ApiCallOptions) => Promise<TTypes[TName]['response']>;
};

/** Builds the typed client for a controller from its script entry and its contract. */
export function createApiClient<TTypes extends EndpointTypes<TTypes>>(scriptRef: ScriptRef, contract: EndpointContract<TTypes>): ApiClient<TTypes> {
    const client: Record<string, (request: unknown, options?: ApiCallOptions) => Promise<unknown>> = {};
    for (const name of Object.keys(contract) as Array<keyof TTypes & string>) {
        client[name] = (request, options) => callEndpoint(scriptRef, name, contract[name].method, (request ?? {}) as object, options);
    }
    return client as ApiClient<TTypes>;
}
