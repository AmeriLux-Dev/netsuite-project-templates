import type { EmployeeRole } from '../types/models.gen';
import { listEmployeeRolesByEmployee } from '../repositories/employeeRolesRepository';

/**
 * Decisions about role assignments. Runs inside the userRoles Suitelet; the user restlet asks it for
 * the caller's roles. The service takes plain arguments and returns types it declares itself: it
 * knows nothing about the wire, so any controller can call it and shape the reply its own way.
 */

/** A role as the service hands it up: id and name, nothing else. */
export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

export function toRoleSummary(role: EmployeeRole): RoleSummary {
    return { roleId: role.roleId, roleName: role.roleName };
}

/** Every role assigned to the employee, sorted by name. */
export function getRolesByEmployee(employeeId: number): RoleSummary[] {
    return listEmployeeRolesByEmployee(employeeId)
        .map(toRoleSummary)
        .sort((left, right) => left.roleName.localeCompare(right.roleName));
}
