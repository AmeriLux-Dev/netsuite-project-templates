import { afterEach, describe, expect, it, vi } from 'vitest';
import { user } from '@/api/index.gen';
import { activeUserRolesQueryKey, activeUserRolesQueryOptions } from '@/hooks/user/useActiveUserRoles';

// The hook is tested against the user client's roles function, replaced: what the hook asks for, not how the wire looks.
const activeUserRolesResponse: user.RolesResponse = { user: { id: 7, name: 'Ada', email: '' }, activeRoleId: 3, roles: [] };

afterEach(() => {
    vi.restoreAllMocks();
});

describe('activeUserRolesQueryOptions', () => {
    it('binds the roles endpoint under a fixed key and forwards the abort signal', async () => {
        const rolesSpy = vi.spyOn(user.api, 'roles').mockResolvedValue(activeUserRolesResponse);
        const options = activeUserRolesQueryOptions();
        expect(options.queryKey).toEqual(activeUserRolesQueryKey);
        const signal = new AbortController().signal;
        const queryFunction = options.queryFn as (context: { signal: AbortSignal }) => Promise<unknown>;
        await expect(queryFunction({ signal })).resolves.toEqual(activeUserRolesResponse);
        expect(rolesSpy).toHaveBeenCalledWith({ signal });
    });
});
