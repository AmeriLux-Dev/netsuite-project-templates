import { afterEach, describe, expect, it, vi } from 'vitest';
import { scripts, type ScriptRef } from 'common/netsuite';
import { defineContract } from 'common/types/api';
import { ApiClientError, buildApiUrl, callEndpoint, createApiClient } from '@/api/apiClient';

function mockFetchResponse(status: number, body: unknown) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const fetchMock = vi.fn(async () => new Response(text, { status, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function lastRequest(fetchMock: ReturnType<typeof mockFetchResponse>) {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, init };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('buildApiUrl', () => {
    it('always carries script and deploy ids and drops empty query values', () => {
        const url = buildApiUrl(scripts.user, { search: 'acme', limit: undefined, empty: '' });
        expect(url).toContain(`script=${scripts.user.scriptId}`);
        expect(url).toContain(`deploy=${scripts.user.deployId}`);
        expect(url).toContain('search=acme');
        expect(url).not.toContain('limit=');
        expect(url).not.toContain('empty=');
    });

    it('routes by the script kind', () => {
        const asSuitelet: ScriptRef = { ...scripts.user, kind: 'suitelet' };
        expect(buildApiUrl(scripts.user)).toMatch(/restlet/);
        expect(buildApiUrl(asSuitelet)).toMatch(/suitelet/);
        expect(buildApiUrl(asSuitelet)).not.toMatch(/restlet/);
    });
});

describe('callEndpoint', () => {
    it('sends a GET request as query parameters with the endpoint name and unwraps the envelope data', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { roles: [] } });
        await expect(callEndpoint(scripts.user, 'list', 'GET', { search: 'acme' })).resolves.toEqual({ roles: [] });
        const { url, init } = lastRequest(fetchMock);
        expect(init.method).toBe('GET');
        expect(init.body).toBeUndefined();
        expect(url).toContain('endpoint=list');
        expect(url).toContain('search=acme');
    });

    it('sends a JSON body with the endpoint name for writes', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: null });
        await callEndpoint(scripts.user, 'create', 'POST', { name: 'x' });
        const { url, init } = lastRequest(fetchMock);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toEqual({ name: 'x', endpoint: 'create' });
        expect(url).not.toContain('endpoint=');
    });

    it('throws ApiClientError with the envelope status when the envelope carries an error', async () => {
        mockFetchResponse(200, { status: 404, error: 'Customer not found', data: null });
        await expect(callEndpoint(scripts.user, 'byId', 'GET', { id: 9 })).rejects.toMatchObject({ name: 'ApiClientError', status: 404, message: 'Customer not found' });
    });

    it('throws ApiClientError when the response is not an envelope', async () => {
        mockFetchResponse(500, '<html>login</html>');
        const failure = await callEndpoint(scripts.user, 'list', 'GET').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ApiClientError);
        expect((failure as ApiClientError).status).toBe(500);
    });
});

describe('createApiClient', () => {
    interface PingEndpoints {
        ping: { request: { value: number }; response: { echoed: number } };
        rename: { request: { name: string }; response: null };
    }
    const pingContract = defineContract<PingEndpoints>({ ping: { method: 'GET' }, rename: { method: 'POST' } });

    it('exposes one function per endpoint that calls it with the contract method', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { echoed: 1 } });
        const pingApi = createApiClient(scripts.user, pingContract);
        await expect(pingApi.ping({ value: 1 })).resolves.toEqual({ echoed: 1 });
        const { url, init } = lastRequest(fetchMock);
        expect(init.method).toBe('GET');
        expect(url).toContain('endpoint=ping');
        expect(url).toContain('value=1');

        const renameFetch = mockFetchResponse(200, { status: 200, error: null, data: null });
        await pingApi.rename({ name: 'x' }, { signal: new AbortController().signal });
        expect(lastRequest(renameFetch).init.method).toBe('POST');
        expect(Object.keys(pingApi)).toEqual(['ping', 'rename']);
    });
});
