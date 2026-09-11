import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as https from 'N/https';
import type { ScriptRef } from 'common/netsuite';
import { defineContract } from 'common/types/api';
import { ApiError } from '../../src/lib/apiError';
import { callSuiteletEndpoint, createSuiteletClient } from '../../src/lib/suiteletClient';

// N/https resolves to the stub in api/test/stubs/N; the client is tested on what it sends and how it reads the answer.
const requestSuitelet = vi.mocked(https.requestSuitelet);
const helper: ScriptRef = { kind: 'suitelet', scriptId: 'customscript_test_helper', deployId: 'customdeploy_test_helper' };

function answering(status: number, error: string | null, data: unknown, code = 200) {
    requestSuitelet.mockReturnValue({ code, body: JSON.stringify({ status, error, data }), headers: {} } as never);
}

beforeEach(() => {
    requestSuitelet.mockReset();
});

describe('callSuiteletEndpoint', () => {
    it('sends a GET as URL parameters with the endpoint name, dropping empty values, and returns the envelope data', () => {
        answering(200, null, { roles: [] });
        const data = callSuiteletEndpoint(helper, 'byEmployee', 'GET', { employeeId: 7, search: undefined, note: '' });
        expect(data).toEqual({ roles: [] });
        expect(requestSuitelet).toHaveBeenCalledWith(expect.objectContaining({
            scriptId: 'customscript_test_helper',
            deploymentId: 'customdeploy_test_helper',
            method: 'GET',
            urlParams: { employeeId: '7', endpoint: 'byEmployee' },
            body: undefined,
        }));
    });

    it('sends other methods as a JSON body carrying the endpoint name', () => {
        answering(200, null, { ok: true });
        callSuiteletEndpoint(helper, 'create', 'POST', { memo: 'x' });
        expect(requestSuitelet).toHaveBeenCalledWith(expect.objectContaining({
            method: 'POST',
            urlParams: undefined,
            body: JSON.stringify({ memo: 'x', endpoint: 'create' }),
        }));
    });

    it('turns a transport failure or a non-envelope answer into a 502', () => {
        requestSuitelet.mockReturnValue({ code: 500, body: 'boom', headers: {} } as never);
        expect(() => callSuiteletEndpoint(helper, 'byEmployee', 'GET')).toThrow(expect.objectContaining({ status: 502 }));
        requestSuitelet.mockReturnValue({ code: 200, body: '<html>login</html>', headers: {} } as never);
        expect(() => callSuiteletEndpoint(helper, 'byEmployee', 'GET')).toThrow(expect.objectContaining({ status: 502 }));
    });

    it('keeps the status and message of an error envelope', () => {
        answering(400, 'employeeId must be a positive whole number.', null);
        let caught: unknown;
        try {
            callSuiteletEndpoint(helper, 'byEmployee', 'GET', { employeeId: 'x' });
        } catch (error) {
            caught = error;
        }
        expect(caught).toBeInstanceOf(ApiError);
        expect(caught).toEqual(expect.objectContaining({ status: 400, message: 'employeeId must be a positive whole number.' }));
    });

    it('refuses a scripts entry that is not a Suitelet', () => {
        const restlet: ScriptRef = { kind: 'restlet', scriptId: 'customscript_test_api', deployId: 'customdeploy_test_api' };
        expect(() => callSuiteletEndpoint(restlet, 'list', 'GET')).toThrow(/Suitelets only/);
        expect(requestSuitelet).not.toHaveBeenCalled();
    });
});

describe('createSuiteletClient', () => {
    interface HelperEndpoints {
        byEmployee: { request: { employeeId: number }; response: { roles: string[] } };
        reset: { request: { employeeId: number }; response: null };
    }
    const contract = defineContract<HelperEndpoints>({ byEmployee: { method: 'GET' }, reset: { method: 'POST' } });

    it('exposes one function per endpoint, each calling with the contract method', () => {
        const client = createSuiteletClient(helper, contract);
        answering(200, null, { roles: ['Administrator'] });
        expect(client.byEmployee({ employeeId: 7 })).toEqual({ roles: ['Administrator'] });
        expect(requestSuitelet).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'GET', urlParams: { employeeId: '7', endpoint: 'byEmployee' } }));
        answering(200, null, null);
        expect(client.reset({ employeeId: 7 })).toBeNull();
        expect(requestSuitelet).toHaveBeenLastCalledWith(expect.objectContaining({ method: 'POST', body: JSON.stringify({ employeeId: 7, endpoint: 'reset' }) }));
    });
});
