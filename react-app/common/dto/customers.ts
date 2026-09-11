import type { Customer } from '../types/models.gen';

/**
 * What the customers endpoints send and receive. A DTO is the wire shape, not the record: pick from
 * the generated entity type so it follows the model, and add nothing the client does not need.
 */

export type CustomerSummary = Pick<Customer, 'id' | 'companyName' | 'email'>;

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
