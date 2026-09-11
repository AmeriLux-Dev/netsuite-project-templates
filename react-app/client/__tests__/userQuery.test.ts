import { describe, expect, it, vi } from 'vitest';
import { scripts } from 'common/netsuite';
import { userContract } from 'common/types/user';

// The hook is tested against a fake user client: what it asks for, not how the wire looks.
const { rolesMock, createApiClient } = vi.hoisted(() => {
    const rolesMock = vi.fn(async () => ({ user: { id: 7, name: 'Ada', email: '' }, activeRoleId: 3, roles: [] }));
    return { rolesMock, createApiClient: vi.fn(() => ({ roles: rolesMock })) };
});
vi.mock('@/api/apiClient', () => ({ createApiClient }));

import { userApi } from '@/api/userApi';
import { activeUserRolesQueryKey, activeUserRolesQueryOptions } from '@/hooks/useActiveUserRoles';

// The client is built when its module loads, before any test runs, and mock state is cleared per test: keep the call.
const clientConstructionArguments = createApiClient.mock.calls[0] as unknown[] | undefined;

describe('userApi', () => {
    it('is the typed client for the user script and contract', () => {
        expect(clientConstructionArguments).toEqual([scripts.user, userContract]);
        expect(userApi.roles).toBe(rolesMock);
    });
});

describe('activeUserRolesQueryOptions', () => {
    it('binds the roles endpoint under a fixed key and forwards the abort signal', async () => {
        const options = activeUserRolesQueryOptions();
        expect(options.queryKey).toEqual(activeUserRolesQueryKey);
        const signal = new AbortController().signal;
        const queryFunction = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
        await expect(queryFunction({ signal })).resolves.toEqual({ user: { id: 7, name: 'Ada', email: '' }, activeRoleId: 3, roles: [] });
        expect(rolesMock).toHaveBeenCalledWith({}, { signal });
    });
});
