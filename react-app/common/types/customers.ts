import { defineContract } from './api';

export interface CustomerSummary {
    id: number;
    companyName: string;
    email: string | null;
}

/** GET parameters arrive as strings; the service parses them. */
export interface CustomerListRequest {
    /** Case-insensitive substring of the company name. */
    search?: string;
    /** Maximum rows; the service clamps it. */
    limit?: number | string;
}

export interface CustomerListResponse {
    customers: CustomerSummary[];
    limit: number;
}

/** GET parameters arrive as strings; the service parses the id. */
export interface CustomerByIdRequest {
    id: number | string;
}

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
