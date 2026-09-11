import type { UserRolesByEmployeeRequest, UserRolesByEmployeeResponse } from 'common/dto/userRoles';
import type { Endpoint } from '../../../lib/endpoint';
import { getRolesByEmployee } from '../../../services/userRoles';

/** GET ?endpoint=byEmployee&employeeId= — every role assigned to the employee; the service answers 400 for a bad id. */
export const byEmployee: Endpoint<UserRolesByEmployeeRequest, UserRolesByEmployeeResponse> = (request) => getRolesByEmployee(request);
