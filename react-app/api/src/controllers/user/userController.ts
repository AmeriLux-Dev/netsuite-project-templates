/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

// The only transport-specific file of this controller. Its one endpoint (roles) is GET, so only `get`
// is exported; an endpoint with another method adds that export. To serve the same endpoints from a
// Suitelet instead, see userRoles/userRolesController.ts and HOW-TO-USE.md ("Switching a controller").

import { defineRestlet } from '../../lib/defineRestlet';
import { userEndpoints } from './endpoints';

const restlet = defineRestlet('user', userEndpoints);

export const get = restlet.get;
