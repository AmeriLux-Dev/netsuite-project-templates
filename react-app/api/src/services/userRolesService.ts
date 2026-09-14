import type { EmployeeRole } from '../types/models.gen';
import type { ByEmployeeRequest, ByEmployeeResponse, RoleSummary } from '../controllers/userRolesController';
import { ApiError } from '@amerilux/netsuite-api/server';
import { listEmployeeRolesByEmployee } from '../repositories/employeeRolesRepository';

/**
 * Decisions about role assignments: what the request means and what the caller gets back. Runs
 * inside the userRoles Suitelet; the user restlet asks it for the caller's roles.
 */

/** The wire promises a number; a caller that sends something else still gets a 400, not a query for NaN. */
export function parseEmployeeId(requested: number | string | undefined): number {
    const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : requested;
    if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) {
        throw ApiError.badRequest('employeeId must be a positive whole number.', { employeeId: requested });
    }
    return parsed;
}

export function toRoleSummary(role: EmployeeRole): RoleSummary {
    return { roleId: role.roleId, roleName: role.roleName };
}

export function getRolesByEmployee(request: ByEmployeeRequest): ByEmployeeResponse {
    const employeeId = parseEmployeeId(request.employeeId);
    const roles = listEmployeeRolesByEmployee(employeeId)
        .map(toRoleSummary)
        .sort((left, right) => left.roleName.localeCompare(right.roleName));
    return { employeeId, roles };
}
