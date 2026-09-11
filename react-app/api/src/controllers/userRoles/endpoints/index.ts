import { userRolesContract } from 'common/types/userRoles';
import { defineEndpoints } from '../../../lib/endpoint';
import { byEmployee } from './byEmployee';

/** The controller's endpoints by name, each in its own file next to this one; the contract in common/ gives each its method. */
export const userRolesEndpoints = defineEndpoints(userRolesContract, { byEmployee });
