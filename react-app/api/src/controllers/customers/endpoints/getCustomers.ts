import type { CustomerListRequest, CustomerListResponse } from 'common/types/customers';
import type { Endpoint } from '../../../lib/endpoint';
import { listCustomers } from '../../../services/customers';

// @netsuite-project:example — scaffold example; see customersController.ts.

/** GET customers?search=&limit= — hands the parsed request to the service and returns its result. */
export const getCustomers: Endpoint<CustomerListRequest, CustomerListResponse> = (request) => listCustomers(request);
