import type { CustomerByIdRequest, CustomerListRequest, CustomerListResponse, CustomerSummary } from '../dto/customers';
import { defineContract } from './api';

/** The request and response of each endpoint of the customers controller. */
export interface CustomersEndpoints {
    list: { request: CustomerListRequest; response: CustomerListResponse };
    byId: { request: CustomerByIdRequest; response: CustomerSummary };
}

/** The customers controller's endpoints by name and method, shared by the Restlet and the client. */
export const customersContract = defineContract<CustomersEndpoints>({
    list: { method: 'GET' },
    byId: { method: 'GET' },
});
