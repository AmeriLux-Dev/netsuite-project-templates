import { queryOptions, useQuery } from '@tanstack/react-query';
import { user } from '@/api/index.gen';

export const activeUserRolesQueryKey = ['user', 'roles'] as const;

export function activeUserRolesQueryOptions() {
    return queryOptions({
        queryKey: activeUserRolesQueryKey,
        // The endpoint takes no request; the second argument carries the abort signal.
        queryFn: ({ signal }) => user.api.roles(undefined, { signal }),
    });
}

/** The caller and every role assigned to them; the session decides who that is. */
export function useActiveUserRoles() {
    return useQuery(activeUserRolesQueryOptions());
}
