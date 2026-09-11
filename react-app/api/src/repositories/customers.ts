import type { Specification } from '@amerilux/netsuite-repository';
import type { Customer } from './generated/Customer.gen';
import { dbContext } from './generated/context.gen';
import { companyNameContains, firstPage, orderedByCompanyName } from '../specifications/customers';

// @netsuite-project:example — scaffold example; see controllers/customers/customersController.ts.

/**
 * Data access for customers: sentences built from the specifications over dbContext. Reads go
 * through its sets; a write would go through dbContext.withTracking(). The only layer that touches
 * records; it never decides what a request means.
 */

export interface CustomerListQuery {
    /** Case-insensitive substring of the company name; blank means no filter. */
    search: string;
    /** Rows in the first page. */
    limit: number;
}

export function listCustomersByCompanyName(query: CustomerListQuery): Customer[] {
    const specifications: Specification<Customer>[] = [];
    if (query.search) specifications.push(companyNameContains(query.search));
    specifications.push(orderedByCompanyName(), firstPage(query.limit));
    return dbContext.customers.list(...specifications);
}

/** The customer with this internal id, or null when there is none. */
export function findCustomerById(id: number): Customer | null {
    return dbContext.customers.find(id);
}
