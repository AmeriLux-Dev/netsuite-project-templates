/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

import { defineEndpoints, defineRestlet } from '@amerilux/netsuite-api/server';
import { getActiveUserRoles } from '../services/userService';
import type { RoleSummary } from './userRolesController';

/**
 * The user controller: what it sends and receives, the endpoints that do it, and the script that
 * serves them. The shapes are the wire, not the record: a DTO is an entity type from
 * api/src/types/models.gen.ts, a Pick of one, or a composition of several, and carries nothing the
 * caller does not need. `npm run generate` copies them, with the endpoint signatures and the script
 * declaration, into client/src/api/user.gen.ts, the controller's own module in the client (reached
 * as `user` from @/api/index.gen); every type here is exported for that reason. A shape's name
 * carries no controller prefix: the module is scoped by controller already.
 */

/** The caller as the session knows them. */
export interface ActiveUserSummary {
    id: number;
    name: string;
    email: string;
}

export interface RolesResponse {
    user: ActiveUserSummary;
    /** The role the caller logged in with. */
    activeRoleId: number;
    /** Every role assigned to the caller, whichever one they logged in with. */
    roles: RoleSummary[];
}

/**
 * One function per endpoint: its parameter is the request, its return value the response, and it
 * stays thin: call a service, return the result. Both types are written on the handler; the
 * generator reads them from there.
 */
export const userEndpoints = defineEndpoints({
    /** The caller and every role assigned to them. Takes no request; the session says who is calling. */
    roles: (): RolesResponse => getActiveUserRoles(),
});

/** The endpoint signatures as a type, for server code that calls this controller through the Suitelet client. */
export type UserEndpoints = typeof userEndpoints;

// The only transport-specific lines. Every call is a POST naming the endpoint in its body, so `post`
// is the one entry point. The declaration names the script this controller is deployed as: nothing
// here creates it, and the ids can be changed to whatever the record and deployment are called in
// NetSuite (and in netsuite/Objects); the generated client follows. To serve the same endpoints from
// a Suitelet instead, export `onRequest = defineSuitelet(...)` as userRolesController.ts does and
// change the SDF object to a <suitelet>; the endpoints do not change.
export const post = defineRestlet({
    name: 'user',
    scriptId: 'customscript_{{prefix}}_user',
    deployId: 'customdeploy_{{prefix}}_user',
}, userEndpoints);
