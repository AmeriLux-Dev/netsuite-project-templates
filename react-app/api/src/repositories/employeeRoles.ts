import type { EmployeeRole } from 'common/types/models.gen';
import { dbContext } from './generated/context.gen';
import { forEmployee } from '../specifications/employeeRoles';

/**
 * Data access for role assignments: sentences built from the specifications over dbContext. Reads
 * employeerolesforsearch, which only a role allowed to see role assignments can query; the userRoles
 * Suitelet that calls this runs as Administrator for that reason.
 */

/** Every role assigned to the employee, in no particular order. */
export function listEmployeeRolesByEmployee(employeeId: number): EmployeeRole[] {
    return dbContext.employeeRoles.list(forEmployee(employeeId));
}
