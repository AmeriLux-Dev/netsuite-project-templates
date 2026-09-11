import type { Specification } from '@amerilux/netsuite-repository';
import { EmployeeRoleFields, type EmployeeRole } from '../repositories/generated/EmployeeRole.gen';

/**
 * The query vocabulary for role assignments: one predicate per builder, no decisions. A repository
 * function composes them; a test can render any of them against a recording query and no context.
 */

export const forEmployee = (employeeId: number): Specification<EmployeeRole> =>
    (query) => query.where(EmployeeRoleFields.employeeId, '=', employeeId);
