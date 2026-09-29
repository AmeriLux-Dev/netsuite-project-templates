import type { Specification } from '@amerilux/netsuite-repository';
import type { EmployeeRole } from '../types/models.gen';
import { dbContext } from './generated/context.gen';

/**
 * Data access for role assignments over dbContext. Reads employeerolesforsearch, which only a role allowed to see role
 * assignments can query; the userRoles Suitelet that calls this runs as Administrator for that reason.
 */

/**
 * The role assignments the specifications ask for, applied in order as one query. Only userService reads them, so it
 * composes the read; a read a second caller needs would be named here.
 */
export function listEmployeeRoles(...specifications: Specification<EmployeeRole>[]): EmployeeRole[] {
    return dbContext.employeeRoles.list(...specifications);
}
