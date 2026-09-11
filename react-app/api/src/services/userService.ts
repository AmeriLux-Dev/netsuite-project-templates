import type { UserRolesResponse } from '../controllers/userController';
import { readActiveUser } from '../repositories/activeUserRepository';
import { listRolesForEmployee } from '../repositories/userRolesRepository';

/**
 * Decisions about the caller. The service composes repository answers into the reply; it never sees
 * the session module or the Suitelet behind the role lookup. A failed lookup fails the request: a
 * project that prefers to fall back to the login role decides that here.
 */

/** The caller and every role assigned to them, whichever role they logged in with. */
export function getActiveUserRoles(): UserRolesResponse {
    const user = readActiveUser();
    const roles = listRolesForEmployee(user.id);
    return {
        user: { id: user.id, name: user.name, email: user.email },
        activeRoleId: user.roleId,
        roles,
    };
}
