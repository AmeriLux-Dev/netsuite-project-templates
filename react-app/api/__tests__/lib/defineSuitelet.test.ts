import { describe, expect, it, vi } from 'vitest';
import type { EntryPoints } from 'N/types';
import { defineContract } from 'common/types/api';
import { ApiError } from '../../src/lib/apiError';
import { defineSuitelet } from '../../src/lib/defineSuitelet';
import { defineEndpoints } from '../../src/lib/endpoint';

/** The parts of a Suitelet context the wrapper touches, with the response captured for assertions. */
function createSuiteletContext(method: string, parameters: Record<string, string> = {}, body = '') {
    const write = vi.fn();
    const setHeader = vi.fn();
    const context = {
        request: { method, parameters, body },
        response: { write, setHeader },
    } as unknown as EntryPoints.Suitelet.onRequestContext;
    const written = () => JSON.parse((write.mock.calls[0] as [{ output: string }])[0].output) as unknown;
    return { context, write, setHeader, written };
}

interface ThingsEndpoints {
    byId: { request: { id: string }; response: { id: number } };
    create: { request: { name: string }; response: { created: string } };
}

const thingsContract = defineContract<ThingsEndpoints>({ byId: { method: 'GET' }, create: { method: 'POST' } });

const endpoints = defineEndpoints(thingsContract, {
    byId: (request) => ({ id: Number(request.id) }),
    create: (request) => {
        if (!request.name) throw ApiError.badRequest('name is required');
        return { created: request.name };
    },
});

describe('defineSuitelet', () => {
    const suitelet = defineSuitelet('things', endpoints);

    it('serves GET from the query parameters, endpoint name included, as a JSON envelope', () => {
        const { context, setHeader, written } = createSuiteletContext('GET', { endpoint: 'byId', id: '7', script: 'x', deploy: 'y' });
        suitelet(context);
        expect(setHeader).toHaveBeenCalledWith({ name: 'Content-Type', value: 'application/json' });
        expect(written()).toEqual({ status: 200, error: null, data: { id: 7 } });
    });

    it('serves POST from the JSON body, endpoint name included', () => {
        const { context, written } = createSuiteletContext('POST', {}, '{"endpoint":"create","name":"widget"}');
        suitelet(context);
        expect(written()).toEqual({ status: 200, error: null, data: { created: 'widget' } });
    });

    it('returns the same error envelope a Restlet would', () => {
        const { context, written } = createSuiteletContext('POST', {}, '{"endpoint":"create"}');
        suitelet(context);
        expect(written()).toEqual({ status: 400, error: 'name is required', data: null });
    });

    it('answers 400 without an endpoint name and 405 for the wrong method', () => {
        const missing = createSuiteletContext('GET', { id: '7' });
        suitelet(missing.context);
        expect(missing.written()).toMatchObject({ status: 400, data: null });

        const wrongMethod = createSuiteletContext('DELETE', {}, '{"endpoint":"byId"}');
        suitelet(wrongMethod.context);
        expect(wrongMethod.written()).toMatchObject({ status: 405, data: null });
    });
});
