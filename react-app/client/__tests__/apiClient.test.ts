import { afterEach, describe, expect, it, vi } from 'vitest';
import { scripts, type ScriptRef } from 'common/netsuite';
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
    it('carries the script and deploy ids', () => {
        const url = buildApiUrl(scripts.user);
        expect(url).toContain(`script=${scripts.user.scriptId}`);
        expect(url).toContain(`deploy=${scripts.user.deployId}`);
    });

    it('routes by the script kind', () => {
        const asSuitelet: ScriptRef = { ...scripts.user, kind: 'suitelet' };
        expect(buildApiUrl(scripts.user)).toMatch(/restlet/);
        expect(buildApiUrl(asSuitelet)).toMatch(/suitelet/);
        expect(buildApiUrl(asSuitelet)).not.toMatch(/restlet/);
    });
});

describe('callEndpoint', () => {
    it('posts a JSON body carrying the request and the endpoint name, and unwraps the envelope data', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { roles: [] } });
        await expect(callEndpoint(scripts.user, 'list', { search: 'acme' })).resolves.toEqual({ roles: [] });
        const { url, init } = lastRequest(fetchMock);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body as string)).toEqual({ search: 'acme', endpoint: 'list' });
        expect(url).not.toContain('endpoint=');
    });

    it('forwards the abort signal', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: null });
        const signal = new AbortController().signal;
        await callEndpoint(scripts.user, 'create', { name: 'x' }, { signal });
        expect(lastRequest(fetchMock).init.signal).toBe(signal);
    });

    it('throws ApiClientError with the envelope status when the envelope carries an error', async () => {
        mockFetchResponse(200, { status: 404, error: 'Customer not found', data: null });
        await expect(callEndpoint(scripts.user, 'byId', { id: 9 })).rejects.toMatchObject({ name: 'ApiClientError', status: 404, message: 'Customer not found' });
    });

    it('throws ApiClientError when the response is not an envelope', async () => {
        mockFetchResponse(500, '<html>login</html>');
        const failure = await callEndpoint(scripts.user, 'list').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ApiClientError);
        expect((failure as ApiClientError).status).toBe(500);
    });
});

describe('createApiClient', () => {
    // Stands in for `typeof pingEndpoints` of a controller: the handler signatures are the contract.
    type PingEndpoints = {
        ping: (request: { value: number }) => { echoed: number };
        status: () => { up: boolean };
    };

    it('exposes one function per endpoint, named by the property accessed', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { echoed: 1 } });
        const pingApi = createApiClient<PingEndpoints>(scripts.user);
        await expect(pingApi.ping({ value: 1 })).resolves.toEqual({ echoed: 1 });
        expect(JSON.parse(lastRequest(fetchMock).init.body as string)).toEqual({ value: 1, endpoint: 'ping' });
    });

    it('sends only the endpoint name for an endpoint that takes no request', async () => {
        const fetchMock = mockFetchResponse(200, { status: 200, error: null, data: { up: true } });
        const pingApi = createApiClient<PingEndpoints>(scripts.user);
        await expect(pingApi.status()).resolves.toEqual({ up: true });
        expect(JSON.parse(lastRequest(fetchMock).init.body as string)).toEqual({ endpoint: 'status' });
    });
});
