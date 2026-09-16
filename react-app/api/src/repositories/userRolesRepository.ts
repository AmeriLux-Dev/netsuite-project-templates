import { createSuiteletClient } from '@amerilux/netsuite-api/server';
import type { ByEmployeeResponse, UserRolesEndpoints } from '../controllers/userRolesController';
import { scripts } from '../scripts.gen';

/**
 * Role assignments, read through the userRoles Suitelet because the role a Restlet caller logged in
 * with cannot query them; that Suitelet is deployed to run as Administrator. Data access, so a
 * repository: the service does not know the answer came from another script. The scripts map is
 * generated from the controllers' declarations by `npm run generate`. What comes back is that
 * script's wire shape, so the return type is taken from its controller (as a type only).
 */

const userRolesApi = createSuiteletClient<UserRolesEndpoints>(scripts.userRoles);

export function listRolesForEmployee(employeeId: number): ByEmployeeResponse['roles'] {
    return userRolesApi.byEmployee({ employeeId }).roles;
}
