import { userContract } from 'common/types/user';
import { defineEndpoints } from '../../../lib/endpoint';
import { roles } from './roles';

/** The controller's endpoints by name, each in its own file next to this one; the contract in common/ gives each its method. */
export const userEndpoints = defineEndpoints(userContract, { roles });
