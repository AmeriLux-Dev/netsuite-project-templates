/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

import { ApiError, defineEndpoints, defineSuitelet } from '@amerilux/netsuite-api/server';
import { getRolesByEmployee, type RoleSummary } from '../services/userRolesService';

/**
 * The userRoles controller, and the reason it is a Suitelet: its deployment runs as Administrator
 * (<runasrole> in netsuite/Objects/customscript_{{prefix}}_user_roles.xml) so it can read role
 * assignments, which the role a Restlet caller logged in with cannot. The user restlet calls it
 * server-side through the Suitelet client; the browser has no reason to, so its declaration says
 * `browser: false` and the generated client module carries its types only. Keep it read-only and
 * minimal: every role can reach a Suitelet deployed to all roles, and this one answers for any
 * employee id. While the application is Administrator-only that is moot; before other roles are
 * granted the `user` Restlet, add an `authorize` option here that rejects an employee id other than
 * the caller's (read the session through a repository function).
 *
 * The wire shapes are this file's; the service's types (RoleSummary) are what they are built from.
 * The endpoint is the only code that knows the wire: it checks what came off it, calls the
 * service with plain arguments, and shapes the reply.
 */

export interface ByEmployeeRequest {
    employeeId: number;
}

export interface ByEmployeeResponse {
    employeeId: number;
    /** Every role assigned to the employee, by name. */
    roles: RoleSummary[];
}

/** The wire promises a number; a caller that sends something else gets a 400, not a query for NaN. */
function parseEmployeeId(requested: number | string | undefined): number {
    const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : requested;
    if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) {
        throw ApiError.badRequest('employeeId must be a positive whole number.', { employeeId: requested });
    }
    return parsed;
}

export const userRolesEndpoints = defineEndpoints({
    /** Every role assigned to the employee; 400 for a bad id. */
    byEmployee: (request: ByEmployeeRequest): ByEmployeeResponse => {
        const employeeId = parseEmployeeId(request.employeeId);
        return { employeeId, roles: getRolesByEmployee(employeeId) };
    },
});

/** What api/src/repositories/userRolesRepository.ts is built from: `createSuiteletClient<UserRolesEndpoints>(scripts.userRoles)`. */
export type UserRolesEndpoints = typeof userRolesEndpoints;

export const onRequest = defineSuitelet({
    name: 'userRoles',
    scriptId: 'customscript_{{prefix}}_user_roles',
    deployId: 'customdeploy_{{prefix}}_user_roles',
    browser: false,
}, userRolesEndpoints);
