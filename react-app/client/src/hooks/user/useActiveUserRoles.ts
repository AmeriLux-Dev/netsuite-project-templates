import { queryOptions, useQuery } from '@tanstack/react-query';
import { user } from '@/api/index.gen';

export const activeUserRolesQueryKey = ['user', 'roles'] as const;

export function activeUserRolesQueryOptions() {
    return queryOptions({
        queryKey: activeUserRolesQueryKey,
        // The endpoint takes no request, so the call options, with the abort signal, are its only argument.
        queryFn: ({ signal }) => user.api.roles({ signal }),
    });
}

/** The caller and every role assigned to them; the session decides who that is. */
export function useActiveUserRoles() {
    return useQuery(activeUserRolesQueryOptions());
}
