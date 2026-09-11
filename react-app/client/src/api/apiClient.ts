import type { ScriptKind, ScriptRef } from 'common/netsuite';
import { ENDPOINT_PARAMETER, type ApiEnvelope, type EndpointRequest, type EndpointResponse, type Endpoints } from 'common/types/api';

/**
 * Calls an API controller by its script and deployment ids, one endpoint at a time. The entry's
 * `kind` decides the URL, so a controller can move between Restlet and Suitelet without touching
 * the caller. In the deployed app the call rides the NetSuite session on the same origin; in
 * development it goes through the local proxy in server.ts.
 */

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

export function buildApiUrl(scriptRef: ScriptRef): string {
    const parameters = new URLSearchParams({ script: scriptRef.scriptId, deploy: scriptRef.deployId });
    return `${API_BASE_PATHS[scriptRef.kind]}?${parameters.toString()}`;
}

/** Calls one endpoint of a controller: a POST whose JSON body carries the request and the endpoint name. */
export async function callEndpoint<TData>(scriptRef: ScriptRef, endpointName: string, request: object = {}, options: ApiCallOptions = {}): Promise<TData> {
    const response = await fetch(buildApiUrl(scriptRef), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...request, [ENDPOINT_PARAMETER]: endpointName }),
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

/**
 * One function per endpoint, typed by the controller's handlers: `userApi.roles()`,
 * `ordersApi.byId({ id })`. The request comes first, the call options second.
 */
export type ApiClient<TEndpoints extends Endpoints> = {
    readonly [TName in keyof TEndpoints]: (request: EndpointRequest<TEndpoints[TName]>, options?: ApiCallOptions) => Promise<EndpointResponse<TEndpoints[TName]>>;
};

/**
 * Builds the typed client for a controller from its scripts entry: `createApiClient<UserEndpoints>(scripts.user)`.
 * The endpoint names come from the type alone (an `import type` from the controller's endpoints file);
 * the property accessed is the endpoint named on the wire.
 */
export function createApiClient<TEndpoints extends Endpoints>(scriptRef: ScriptRef): ApiClient<TEndpoints> {
    return new Proxy({} as ApiClient<TEndpoints>, {
        get(_target, endpointName) {
            if (typeof endpointName !== 'string') return undefined;
            return (request: unknown, options?: ApiCallOptions) => callEndpoint(scriptRef, endpointName, (request ?? {}) as object, options);
        },
    });
}
