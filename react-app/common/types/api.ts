/** Every restlet answers with this envelope; `data` is null whenever `error` is set. */
export interface ApiEnvelope<TData> {
    status: number;
    error: string | null;
    data: TData | null;
}

/** The body of a failed call, as thrown by the client's ApiClientError. */
export interface ApiErrorBody {
    status: number;
    error: string;
    details?: unknown;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * The wire parameter naming which endpoint of a controller a call is for: a query parameter on GET,
 * a property of the JSON body otherwise.
 */
export const ENDPOINT_PARAMETER = 'endpoint';

/**
 * The shape of a controller's endpoint types: the request and response type of each endpoint, keyed
 * by endpoint name, declared as an interface next to the contract. Used as `TTypes extends EndpointTypes<TTypes>`
 * so that an interface (which has no index signature) satisfies it.
 */
export type EndpointTypes<TTypes> = { [TName in keyof TTypes]: { request: unknown; response: unknown } };

/**
 * A controller's endpoints as both sides see them: name and HTTP method. `endpointTypes` is never
 * set at runtime; it only carries the request and response types from the contract to
 * `defineEndpoints` on the server and `createApiClient` on the client.
 */
export type EndpointContract<TTypes extends EndpointTypes<TTypes>> = { readonly [TName in keyof TTypes]: { readonly method: HttpMethod } } & { readonly endpointTypes?: TTypes };

/** Declares a controller's endpoints once; a handler or a client call that disagrees with it is a compile error. */
export function defineContract<TTypes extends EndpointTypes<TTypes>>(entries: { [TName in keyof TTypes]: { method: HttpMethod } }): EndpointContract<TTypes> {
    return entries;
}
