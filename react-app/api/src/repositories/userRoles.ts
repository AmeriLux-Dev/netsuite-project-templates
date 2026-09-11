import type { RoleSummary } from 'common/dto/userRoles';
import { scripts } from 'common/netsuite';
import { userRolesContract } from 'common/types/userRoles';
import { createSuiteletClient } from '../lib/suiteletClient';

/**
 * Role assignments, read through the userRoles Suitelet because the role a Restlet caller logged in
 * with cannot query them; that Suitelet is deployed to run as Administrator. Data access, so a
 * repository: the service does not know the answer came from another script.
 */

const userRolesApi = createSuiteletClient(scripts.userRoles, userRolesContract);

export function listRolesForEmployee(employeeId: number): RoleSummary[] {
    return userRolesApi.byEmployee({ employeeId }).roles;
}
