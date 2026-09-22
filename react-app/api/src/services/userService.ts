import type { ActiveUser } from '../repositories/activeUserRepository';
import * as activeUserRepository from '../repositories/activeUserRepository';
import type { RoleSummary } from './userRolesService';
import * as userRolesRepository from '../repositories/userRolesRepository';

/**
 * Decisions about the caller. The service composes repository answers into a type of its own; it
 * never sees the session module or the Suitelet behind the role lookup, and never the wire. A failed
 * lookup fails the request: a project that prefers to fall back to the login role decides that here.
 */

export interface ActiveUserRoles {
    /** The caller as the session knows them, with the role they logged in with. */
    user: ActiveUser;
    /** Every role assigned to the caller, whichever one they logged in with. */
    roles: RoleSummary[];
}

export function getActiveUserRoles(): ActiveUserRoles {
    const user = activeUserRepository.readActiveUser();
    return { user, roles: userRolesRepository.listRolesForEmployee(user.id) };
}
