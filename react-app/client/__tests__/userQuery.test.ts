import { describe, expect, it, vi } from 'vitest';

// The hook is tested against a fake user client: what it asks for, not how the wire looks.
const { rolesMock, createApiClient } = vi.hoisted(() => {
    const rolesMock = vi.fn(async () => ({ user: { id: 7, name: 'Ada', email: '' }, activeRoleId: 3, roles: [] }));
    return { rolesMock, createApiClient: vi.fn(() => ({ roles: rolesMock })) };
});
vi.mock('@amerilux/netsuite-api/client', () => ({ createApiClient }));

import { userApi } from '@/api/index.gen';
import { activeUserRolesQueryKey, activeUserRolesQueryOptions } from '@/hooks/useActiveUserRoles';

// The generated module builds the client when it loads, before any test runs, and mock state is cleared per test: keep the call.
const clientConstructionArguments = createApiClient.mock.calls[0] as unknown[] | undefined;

describe('userApi', () => {
    it('is the typed client for the script the user controller declares, as npm run generate wrote it', () => {
        expect(clientConstructionArguments).toEqual([{ kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' }]);
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
        expect(rolesMock).toHaveBeenCalledWith(undefined, { signal });
    });
});
