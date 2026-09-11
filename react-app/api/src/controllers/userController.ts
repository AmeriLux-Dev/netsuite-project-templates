/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { defineRestlet } from '../_lib/defineRestlet';
import { defineEndpoints } from '../_lib/endpoint';
import { getActiveUserRoles } from '../services/userService';
import type { RoleSummary } from './userRolesController';

/**
 * The user controller: what it sends and receives, the endpoints that do it, and the script that
 * serves them. The shapes are the wire, not the record: a DTO is an entity type from
 * common/types/models.gen.ts, a Pick of one, or a composition of several, and carries nothing the
 * caller does not need. The client imports `UserEndpoints` from this file as a type only.
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
 * stays thin: call a service, return the result.
 */
export const userEndpoints = defineEndpoints({
    /** The caller and every role assigned to them. Takes no request; the session says who is calling. */
    roles: (): UserRolesResponse => getActiveUserRoles(),
});

/** What client/src/api/userApi.ts is built from: `createApiClient<UserEndpoints>(scripts.user)`. */
export type UserEndpoints = typeof userEndpoints;

// The only transport-specific line. Every call is a POST naming the endpoint in its body, so `post`
// is the one entry point. To serve the same endpoints from a Suitelet instead, export
// `onRequest = defineSuitelet(...)` as userRolesController.ts does, change the SDF object to a
// <suitelet>, and set `kind` on the scripts entry; the endpoints do not change.
export const post = defineRestlet('user', userEndpoints);
