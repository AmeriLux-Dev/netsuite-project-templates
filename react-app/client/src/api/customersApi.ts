import { scripts } from 'common/netsuite';
import { customersContract } from 'common/types/customers';
import { createApiClient } from './apiClient';

// @netsuite-project:example — scaffold example; see api/src/controllers/customers/customersController.ts.

/** One typed function per endpoint of the customers controller: `customersApi.list({ search })`, `customersApi.byId({ id })`. */
export const customersApi = createApiClient(scripts.customers, customersContract);
