import type { CustomerByIdRequest, CustomerSummary } from 'common/types/customers';
import type { Endpoint } from '../../../lib/endpoint';
import { getCustomer } from '../../../services/customers';

// @netsuite-project:example — scaffold example; see customersController.ts.

/** GET ?endpoint=byId&id= — one customer; the service answers 404 for an unknown id. */
export const byId: Endpoint<CustomerByIdRequest, CustomerSummary> = (request) => getCustomer(request);
