import { customersContract } from 'common/types/customers';
import { defineEndpoints } from '../../../lib/endpoint';
import { byId } from './byId';
import { list } from './list';

/** The controller's endpoints by name, each in its own file next to this one; the contract in common/ gives each its method. */
export const customersEndpoints = defineEndpoints(customersContract, { list, byId });
