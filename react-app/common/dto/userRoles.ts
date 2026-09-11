import type { EmployeeRole } from '../types/models.gen';

/**
 * What the userRoles endpoints send and receive. A DTO is the wire shape, not the record: pick from
 * the generated entity type so it follows the model, and add nothing the caller does not need.
 */

export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

/** GET parameters arrive as strings; the service parses the id. */
export interface UserRolesByEmployeeRequest {
    employeeId: number | string;
}

export interface UserRolesByEmployeeResponse {
    employeeId: number;
    /** Every role assigned to the employee, by name. */
    roles: RoleSummary[];
}
