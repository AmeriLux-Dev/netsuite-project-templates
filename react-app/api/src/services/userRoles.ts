import type { RoleSummary, UserRolesByEmployeeRequest, UserRolesByEmployeeResponse } from 'common/dto/userRoles';
import type { EmployeeRole } from 'common/types/models.gen';
import { ApiError } from '../lib/apiError';
import { listEmployeeRolesByEmployee } from '../repositories/employeeRoles';

/**
 * Decisions about role assignments: what the request means and what the caller gets back. Runs
 * inside the userRoles Suitelet; the user restlet asks it for the caller's roles.
 */

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

export function getRolesByEmployee(request: UserRolesByEmployeeRequest): UserRolesByEmployeeResponse {
    const employeeId = parseEmployeeId(request.employeeId);
    const roles = listEmployeeRolesByEmployee(employeeId)
        .map(toRoleSummary)
        .sort((left, right) => left.roleName.localeCompare(right.roleName));
    return { employeeId, roles };
}
