import type { EmployeeRole } from 'common/types/models.gen';
import { defineEndpoints } from '../../lib/endpoint';
import { getRolesByEmployee } from '../../services/userRoles';

/**
 * The userRoles controller: what it sends and receives, and the endpoint that does it. The user
 * restlet calls it server-side through api/src/lib/suiteletClient.ts; the browser has no reason to.
 */

/** A role as the wire carries it: picked from the generated entity type so it follows the model. */
export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

export interface UserRolesByEmployeeRequest {
    employeeId: number;
}

export interface UserRolesByEmployeeResponse {
    employeeId: number;
    /** Every role assigned to the employee, by name. */
    roles: RoleSummary[];
}

export const userRolesEndpoints = defineEndpoints({
    /** Every role assigned to the employee; the service answers 400 for a bad id. */
    byEmployee: (request: UserRolesByEmployeeRequest): UserRolesByEmployeeResponse => getRolesByEmployee(request),
});

/** What api/src/repositories/userRoles.ts is built from: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)`. */
export type UserRolesEndpoints = typeof userRolesEndpoints;
