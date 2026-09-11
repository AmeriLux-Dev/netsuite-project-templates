import type { UserRolesByEmployeeRequest, UserRolesByEmployeeResponse } from '../dto/userRoles';
import { defineContract } from './api';

/** The request and response of each endpoint of the userRoles controller. */
export interface UserRolesEndpoints {
    byEmployee: { request: UserRolesByEmployeeRequest; response: UserRolesByEmployeeResponse };
}

/** The userRoles controller's endpoints by name and method; the user restlet calls it server-side. */
export const userRolesContract = defineContract<UserRolesEndpoints>({
    byEmployee: { method: 'GET' },
});
