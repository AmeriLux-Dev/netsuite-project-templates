import { createSuiteletClient } from '@amerilux/netsuite-api/server';
import type { RoleSummary, UserRolesEndpoints } from '../controllers/userRolesController';
import { scripts } from '../scripts.gen';

/**
 * Role assignments, read through the userRoles Suitelet because the role a Restlet caller logged in
 * with cannot query them; that Suitelet is deployed to run as Administrator. Data access, so a
 * repository: the service does not know the answer came from another script. The scripts map is
 * generated from the controllers' declarations by `npm run generate`.
 */

const userRolesApi = createSuiteletClient<UserRolesEndpoints>(scripts.userRoles);

export function listRolesForEmployee(employeeId: number): RoleSummary[] {
    return userRolesApi.byEmployee({ employeeId }).roles;
}
