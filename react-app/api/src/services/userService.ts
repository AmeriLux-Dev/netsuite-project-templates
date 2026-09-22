import type { EmployeeRole } from '../types/models.gen';
import type { ActiveUser } from '../repositories/activeUserRepository';
import * as activeUserRepository from '../repositories/activeUserRepository';
import * as employeeRolesRepository from '../repositories/employeeRolesRepository';
import * as userRolesRepository from '../repositories/userRolesRepository';

/**
 * Decisions about the application's users: who is calling, and the roles an employee holds (a sublist of the
 * employee record, so the same domain). The service takes plain arguments and returns types it declares itself: it
 * knows nothing about the wire, so any controller can call it and shape the reply its own way.
 *
 * Which role a function needs is its script's concern, not the service's: `getRolesByEmployee` reads role
 * assignments directly, so it works only in the userRoles Suitelet, whose deployment runs as Administrator;
 * `getActiveUserRoles` reads them through that Suitelet, so it works in any script.
 */

/** A role as the service hands it up: id and name, nothing else. */
export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

export interface ActiveUserRoles {
    /** The caller as the session knows them, with the role they logged in with. */
    user: ActiveUser;
    /** Every role assigned to the caller, whichever one they logged in with. */
    roles: RoleSummary[];
}

function buildRoleSummary(role: EmployeeRole): RoleSummary {
    return { roleId: role.roleId, roleName: role.roleName };
}

/** Every role assigned to the employee, sorted by name. */
export function getRolesByEmployee(employeeId: number): RoleSummary[] {
    return employeeRolesRepository.listEmployeeRolesByEmployee(employeeId)
        .map(buildRoleSummary)
        .sort((left, right) => left.roleName.localeCompare(right.roleName));
}

/**
 * The caller and every role assigned to them. A failed lookup fails the request: a project that prefers to fall back
 * to the login role decides that here.
 */
export function getActiveUserRoles(): ActiveUserRoles {
    const user = activeUserRepository.readActiveUser();
    return { user, roles: userRolesRepository.listRolesForEmployee(user.id) };
}
