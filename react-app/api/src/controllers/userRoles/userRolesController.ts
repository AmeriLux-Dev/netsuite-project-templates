/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */

// A Suitelet-served controller, and the reason it is one: its deployment runs as Administrator
// (<runasrole> in netsuite/Objects/customscript_{{prefix}}_user_roles.xml) so it can read role
// assignments, which the role a Restlet caller logged in with cannot. The user restlet calls it through
// api/src/lib/suiteletClient.ts; the browser has no reason to. Keep it read-only and minimal: every
// role can reach a Suitelet deployed to all roles.

import { defineSuitelet } from '../../lib/defineSuitelet';
import { userRolesEndpoints } from './endpoints';

export const onRequest = defineSuitelet('userRoles', userRolesEndpoints);
