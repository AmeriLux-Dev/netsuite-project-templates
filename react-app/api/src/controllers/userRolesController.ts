/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import type { EmployeeRole } from 'common/types/models.gen';
import { defineSuitelet } from '../_lib/defineSuitelet';
import { defineEndpoints } from '../_lib/endpoint';
import { getRolesByEmployee } from '../services/userRolesService';

/**
 * The userRoles controller, and the reason it is a Suitelet: its deployment runs as Administrator
 * (<runasrole> in netsuite/Objects/customscript_{{prefix}}_user_roles.xml) so it can read role
 * assignments, which the role a Restlet caller logged in with cannot. The user restlet calls it
 * server-side through api/src/_lib/suiteletClient.ts; the browser has no reason to. Keep it read-only
 * and minimal: every role can reach a Suitelet deployed to all roles.
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

/** What api/src/repositories/userRolesRepository.ts is built from: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)`. */
export type UserRolesEndpoints = typeof userRolesEndpoints;

export const onRequest = defineSuitelet('userRoles', userRolesEndpoints);
