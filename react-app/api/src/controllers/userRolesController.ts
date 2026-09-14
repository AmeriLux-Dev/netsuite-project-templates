/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import type { EmployeeRole } from '../types/models.gen';
import { defineEndpoints, defineSuitelet } from '@amerilux/netsuite-api/server';
import { getRolesByEmployee } from '../services/userRolesService';

/**
 * The userRoles controller, and the reason it is a Suitelet: its deployment runs as Administrator
 * (<runasrole> in netsuite/Objects/customscript_{{prefix}}_user_roles.xml) so it can read role
 * assignments, which the role a Restlet caller logged in with cannot. The user restlet calls it
 * server-side through the Suitelet client; the browser has no reason to, so its declaration says
 * `browser: false` and the generated client module carries its types only. Keep it read-only and
 * minimal: every role can reach a Suitelet deployed to all roles.
 */

/** A role as the wire carries it: picked from the generated entity type so it follows the model. */
export type RoleSummary = Pick<EmployeeRole, 'roleId' | 'roleName'>;

export interface ByEmployeeRequest {
    employeeId: number;
}

export interface ByEmployeeResponse {
    employeeId: number;
    /** Every role assigned to the employee, by name. */
    roles: RoleSummary[];
}

export const userRolesEndpoints = defineEndpoints({
    /** Every role assigned to the employee; the service answers 400 for a bad id. */
    byEmployee: (request: ByEmployeeRequest): ByEmployeeResponse => getRolesByEmployee(request),
});

/** What api/src/repositories/userRolesRepository.ts is built from: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)`. */
export type UserRolesEndpoints = typeof userRolesEndpoints;

export const onRequest = defineSuitelet({
    name: 'userRoles',
    scriptId: 'customscript_{{prefix}}_user_roles',
    deployId: 'customdeploy_{{prefix}}_user_roles',
    browser: false,
}, userRolesEndpoints);
