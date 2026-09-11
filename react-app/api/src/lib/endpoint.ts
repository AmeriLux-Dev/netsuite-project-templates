import * as log from 'N/log';
import { ENDPOINT_PARAMETER, type ApiEnvelope, type EndpointContract, type EndpointTypes, type HttpMethod } from 'common/types/api';
import { ApiError } from './apiError';

/**
 * Endpoints are the transport-agnostic unit of an API controller: named, each with an HTTP method,
 * each a synchronous function from a parsed request to a response value, one file per endpoint
 * under `controllers/<name>/endpoints/`. The
 * contract in common/ names them and gives each its method, so the client calls them by name. The
 * controller file wraps the map as a Restlet (`defineRestlet`) or a Suitelet (`defineSuitelet`);
 * switching transport is a change to that one file and its SDF object, never to the endpoints.
 */

export type Endpoint<TRequest, TResponse> = (request: TRequest) => TResponse;

/** An endpoint for any request type is assignable here: parameters are contravariant and `never` sits below every type. */
export type AnyEndpoint = Endpoint<never, unknown>;

export type { HttpMethod } from 'common/types/api';

/** One handler per endpoint in the contract, typed by the contract's request and response types. */
export type EndpointHandlers<TTypes extends EndpointTypes<TTypes>> = {
    [TName in keyof TTypes]: Endpoint<TTypes[TName]['request'], TTypes[TName]['response']>;
};

export interface DefinedEndpoint {
    method: HttpMethod;
    handler: AnyEndpoint;
}

/** Endpoints by name: the shape the transports dispatch on. */
export type EndpointMap = Record<string, DefinedEndpoint>;

/** Binds the contract's endpoints to their handlers. A missing or mistyped handler is a compile error. */
export function defineEndpoints<TTypes extends EndpointTypes<TTypes>>(contract: EndpointContract<TTypes>, handlers: EndpointHandlers<TTypes>): EndpointMap {
    const endpoints: EndpointMap = {};
    for (const name of Object.keys(contract) as Array<keyof TTypes & string>) {
        endpoints[name] = { method: contract[name].method, handler: handlers[name] as AnyEndpoint };
    }
    return endpoints;
}

/** NetSuite hands GET parameters as an object and bodies as either an object or a JSON string. */
export function parseEndpointRequest(rawRequest: unknown): unknown {
    if (typeof rawRequest !== 'string') return rawRequest ?? {};
    const trimmed = rawRequest.trim();
    if (trimmed === '') return {};
    try {
        return JSON.parse(trimmed);
    } catch {
        throw ApiError.badRequest('Request body is not valid JSON.');
    }
}

export interface EndpointCall {
    /** The endpoint named by the request, or undefined when the parameter is missing. */
    name: string | undefined;
    /** Everything else in the request: the endpoint's own input. */
    request: Record<string, unknown>;
}

/** Splits the endpoint name off the parsed request: `?endpoint=` on GET, an `endpoint` property in the body otherwise. */
export function readEndpointCall(parsedRequest: unknown): EndpointCall {
    if (!parsedRequest || typeof parsedRequest !== 'object' || Array.isArray(parsedRequest)) {
        throw ApiError.badRequest('The request must be an object.');
    }
    const { [ENDPOINT_PARAMETER]: name, ...request } = parsedRequest as Record<string, unknown>;
    return { name: typeof name === 'string' && name !== '' ? name : undefined, request };
}

function describeError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) return { message: error.message, stack: error.stack };
    return { message: String(error) };
}

function findEndpoint(controllerName: string, method: HttpMethod, endpoints: EndpointMap, call: EndpointCall): DefinedEndpoint {
    if (call.name === undefined) {
        throw ApiError.badRequest(`The ${ENDPOINT_PARAMETER} parameter is required.`, { controller: controllerName });
    }
    if (!Object.prototype.hasOwnProperty.call(endpoints, call.name)) {
        throw ApiError.notFound(`${controllerName} has no endpoint named ${call.name}.`, { controller: controllerName, endpoint: call.name });
    }
    const endpoint = endpoints[call.name];
    if (endpoint.method !== method) {
        throw new ApiError(405, `${call.name} on ${controllerName} answers ${endpoint.method}, not ${method}.`, { controller: controllerName, endpoint: call.name });
    }
    return endpoint;
}

/**
 * Runs the endpoint the request names and produces the envelope: 200 with data, an ApiError's own
 * status and message (400 without an endpoint name, 404 for an unknown one, 405 for the wrong
 * method), or 500 with the details logged. Audits the outcome and timing either way. Log titles are
 * constant phrases; the controller, endpoint, method and ids live in the details object.
 */
export function invokeEndpoint(controllerName: string, method: HttpMethod, endpoints: EndpointMap, rawRequest: unknown): ApiEnvelope<unknown> {
    const started = Date.now();
    let status = 200;
    let endpointName: string | undefined;
    try {
        const call = readEndpointCall(parseEndpointRequest(rawRequest));
        endpointName = call.name;
        const endpoint = findEndpoint(controllerName, method, endpoints, call);
        const data = endpoint.handler(call.request as never);
        return { status, error: null, data: data ?? null };
    } catch (error) {
        if (error instanceof ApiError) {
            status = error.status;
            log.debug('endpoint rejected', { controller: controllerName, endpoint: endpointName, method, status, message: error.message, details: error.details });
            return { status, error: error.message, data: null };
        }
        status = 500;
        log.error('endpoint failed', { controller: controllerName, endpoint: endpointName, method, ...describeError(error) });
        return { status, error: 'Internal Server Error', data: null };
    } finally {
        log.audit('endpoint completed', { controller: controllerName, endpoint: endpointName, method, status, durationMs: Date.now() - started });
    }
}
