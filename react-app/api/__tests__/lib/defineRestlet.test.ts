import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as log from 'N/log';
import { defineContract } from 'common/types/api';
import { ApiError } from '../../src/lib/apiError';
import { defineRestlet } from '../../src/lib/defineRestlet';
import { defineEndpoints, parseEndpointRequest, readEndpointCall } from '../../src/lib/endpoint';

interface ThingsEndpoints {
    byId: { request: { id: string }; response: { id: number } };
    create: { request: { name: string }; response: { created: string } };
    explode: { request: Record<string, never>; response: never };
}

const thingsContract = defineContract<ThingsEndpoints>({
    byId: { method: 'GET' },
    create: { method: 'POST' },
    explode: { method: 'PUT' },
});

const thingsEndpoints = defineEndpoints(thingsContract, {
    byId: (request) => ({ id: Number(request.id) }),
    create: (request) => {
        if (!request.name) throw ApiError.notFound('No such thing');
        return { created: request.name };
    },
    explode: () => {
        throw new Error('boom');
    },
});

describe('parseEndpointRequest', () => {
    it('passes objects through and treats an empty body as an empty object', () => {
        expect(parseEndpointRequest({ a: 1 })).toEqual({ a: 1 });
        expect(parseEndpointRequest(undefined)).toEqual({});
        expect(parseEndpointRequest('')).toEqual({});
    });

    it('parses a JSON string body', () => {
        expect(parseEndpointRequest('{"search":"acme"}')).toEqual({ search: 'acme' });
    });

    it('rejects a body that is not JSON as a 400', () => {
        expect(() => parseEndpointRequest('not json')).toThrow(ApiError);
    });
});

describe('readEndpointCall', () => {
    it('splits the endpoint name off the rest of the request', () => {
        expect(readEndpointCall({ endpoint: 'byId', id: '7', script: 'x' })).toEqual({ name: 'byId', request: { id: '7', script: 'x' } });
    });

    it('reports a missing or blank name as undefined and rejects non-objects', () => {
        expect(readEndpointCall({ id: '7' }).name).toBeUndefined();
        expect(readEndpointCall({ endpoint: '' }).name).toBeUndefined();
        expect(() => readEndpointCall([1])).toThrow(ApiError);
    });
});

describe('defineRestlet', () => {
    const restlet = defineRestlet('things', thingsEndpoints);

    beforeEach(() => {
        vi.mocked(log.audit).mockClear();
        vi.mocked(log.error).mockClear();
    });

    it('routes GET to the named endpoint, wraps its result in the envelope and audits the call', () => {
        expect(restlet.get({ endpoint: 'byId', id: '7' })).toEqual({ status: 200, error: null, data: { id: 7 } });
        expect(log.audit).toHaveBeenCalledWith('endpoint completed', expect.objectContaining({ controller: 'things', endpoint: 'byId', method: 'GET', status: 200 }));
    });

    it('routes a JSON body to the named endpoint', () => {
        expect(restlet.post('{"endpoint":"create","name":"widget"}')).toEqual({ status: 200, error: null, data: { created: 'widget' } });
    });

    it('maps ApiError to its status and message', () => {
        expect(restlet.post({ endpoint: 'create', name: '' })).toEqual({ status: 404, error: 'No such thing', data: null });
        expect(log.error).not.toHaveBeenCalled();
    });

    it('hides unexpected errors behind a 500 and logs them', () => {
        expect(restlet.put({ endpoint: 'explode' })).toEqual({ status: 500, error: 'Internal Server Error', data: null });
        expect(log.error).toHaveBeenCalledWith('endpoint failed', expect.objectContaining({ controller: 'things', endpoint: 'explode', method: 'PUT', message: 'boom' }));
    });

    it('answers 400 without an endpoint name, 404 for an unknown one and 405 for the wrong method', () => {
        expect(restlet.get({ id: '7' })).toMatchObject({ status: 400, data: null });
        expect(restlet.get({ endpoint: 'nope' })).toMatchObject({ status: 404, data: null });
        expect(restlet.get({ endpoint: 'constructor' })).toMatchObject({ status: 404, data: null });
        expect(restlet.delete({ endpoint: 'byId', id: '7' })).toMatchObject({ status: 405, data: null });
    });
});
