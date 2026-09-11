import type { UserRolesRequest, UserRolesResponse } from '../dto/user';
import { defineContract } from './api';

/** The request and response of each endpoint of the user controller. */
export interface UserEndpoints {
    roles: { request: UserRolesRequest; response: UserRolesResponse };
}

/** The user controller's endpoints by name and method, shared by the Restlet and the client. */
export const userContract = defineContract<UserEndpoints>({
    roles: { method: 'GET' },
});
