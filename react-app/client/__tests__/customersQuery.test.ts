import { describe, expect, it, vi } from 'vitest';
import { scripts } from 'common/netsuite';
import { customersContract } from 'common/types/customers';

// The hook is tested against a fake customers client: what it asks for, not how the wire looks.
const { listMock, createApiClient } = vi.hoisted(() => {
    const listMock = vi.fn(async () => ({ customers: [], limit: 50 }));
    return { listMock, createApiClient: vi.fn(() => ({ list: listMock })) };
});
vi.mock('@/api/apiClient', () => ({ createApiClient }));

import { customersApi } from '@/api/customersApi';
import { customersQueryKey, customersQueryOptions } from '@/hooks/useCustomers';

// The client is built when its module loads, before any test runs, and mock state is cleared per test: keep the call.
const clientConstructionArguments = createApiClient.mock.calls[0] as unknown[] | undefined;

describe('customersApi', () => {
    it('is the typed client for the customers script and contract', () => {
        expect(clientConstructionArguments).toEqual([scripts.customers, customersContract]);
        expect(customersApi.list).toBe(listMock);
    });
});

describe('customersQueryKey', () => {
    it('is stable for equal requests and distinct for different ones', () => {
        expect(customersQueryKey({ search: 'a' })).toEqual(customersQueryKey({ search: 'a' }));
        expect(customersQueryKey({})).toEqual(['customers', { search: '', limit: null }]);
        expect(customersQueryKey({ search: 'a' })).not.toEqual(customersQueryKey({ search: 'b' }));
    });
});

describe('customersQueryOptions', () => {
    it('binds the list endpoint to the request and forwards the abort signal', async () => {
        const options = customersQueryOptions({ search: 'zeta' });
        expect(options.queryKey).toEqual(customersQueryKey({ search: 'zeta' }));
        const signal = new AbortController().signal;
        const queryFunction = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
        await expect(queryFunction({ signal })).resolves.toEqual({ customers: [], limit: 50 });
        expect(listMock).toHaveBeenCalledWith({ search: 'zeta' }, { signal });
    });
});
