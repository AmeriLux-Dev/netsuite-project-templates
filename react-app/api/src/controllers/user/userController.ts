/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

// The only transport-specific file of this controller. Every call is a POST naming the endpoint in
// its body, so `post` is the one entry point. To serve the same endpoints from a Suitelet instead,
// export `onRequest = defineSuitelet(...)` as userRoles/userRolesController.ts does, change the SDF
// object to a <suitelet>, and set `kind` on the scripts entry; the endpoints do not change.

import { defineRestlet } from '../../_lib/defineRestlet';
import { userEndpoints } from './endpoints';

export const post = defineRestlet('user', userEndpoints);
