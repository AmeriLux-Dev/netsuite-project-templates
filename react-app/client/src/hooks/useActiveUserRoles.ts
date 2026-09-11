import { queryOptions, useQuery } from '@tanstack/react-query';
import { userApi } from '@/api/userApi';

export const activeUserRolesQueryKey = ['user', 'roles'] as const;

export function activeUserRolesQueryOptions() {
    return queryOptions({
        queryKey: activeUserRolesQueryKey,
        queryFn: ({ signal }) => userApi.roles({}, { signal }),
    });
}

/** The caller and every role assigned to them; the session decides who that is. */
export function useActiveUserRoles() {
    return useQuery(activeUserRolesQueryOptions());
}
