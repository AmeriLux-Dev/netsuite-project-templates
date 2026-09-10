import type { ApiEnvelope } from 'common/types/api';
import { invokeEndpoint, type EndpointMap } from './endpoint';

/**
 * Exposes an endpoint map as Restlet entry points. Every endpoint of the controller rides the entry
 * point of its method, picked by the `endpoint` parameter, so a controller exports only the methods
 * its endpoints use: `export const get = restlet.get;` and, for DELETE, `export { restletDelete as delete }`.
 */

export type RestletEntryPoint = (requestParameters: unknown) => ApiEnvelope<unknown>;

export interface DefinedRestlet {
    get: RestletEntryPoint;
    post: RestletEntryPoint;
    put: RestletEntryPoint;
    delete: RestletEntryPoint;
}

export function defineRestlet(controllerName: string, endpoints: EndpointMap): DefinedRestlet {
    return {
        get: (requestParameters) => invokeEndpoint(controllerName, 'GET', endpoints, requestParameters),
        post: (requestParameters) => invokeEndpoint(controllerName, 'POST', endpoints, requestParameters),
        put: (requestParameters) => invokeEndpoint(controllerName, 'PUT', endpoints, requestParameters),
        delete: (requestParameters) => invokeEndpoint(controllerName, 'DELETE', endpoints, requestParameters),
    };
}
