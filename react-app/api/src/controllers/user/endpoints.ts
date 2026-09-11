import { defineEndpoints } from '../../_lib/endpoint';
import { getActiveUserRoles } from '../../services/user';
import type { RoleSummary } from '../userRoles/endpoints';

/**
 * The user controller: what it sends and receives, and the endpoint that does it. The shapes below
 * are the wire, not the record: a DTO is an entity type from common/types/models.gen.ts, a Pick of
 * one, or a composition of several, and carries nothing the caller does not need.
 */

/** The caller as the session knows them. */
export interface ActiveUserSummary {
    id: number;
    name: string;
    email: string;
}

export interface UserRolesResponse {
    user: ActiveUserSummary;
    /** The role the caller logged in with. */
    activeRoleId: number;
    /** Every role assigned to the caller, whichever one they logged in with. */
    roles: RoleSummary[];
}

/**
 * One function per endpoint: its parameter is the request, its return value the response, and it
 * stays thin: call a service, return the result. The client imports the type below, never this value.
 */
export const userEndpoints = defineEndpoints({
    /** The caller and every role assigned to them. Takes no request; the session says who is calling. */
    roles: (): UserRolesResponse => getActiveUserRoles(),
});

/** What client/src/api/userApi.ts is built from: `createApiClient<UserEndpoints>(scripts.user)`. */
export type UserEndpoints = typeof userEndpoints;
