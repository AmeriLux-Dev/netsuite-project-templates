import type { Specification } from '@amerilux/netsuite-repository';
import type { Customer } from './generated/Customer.gen';
import type { UnitOfWork } from './generated/context.gen';
import { companyNameContains, firstPage, orderedByCompanyName } from '../specifications/customers';

// @netsuite-project:example — scaffold example; see controllers/customers/customersController.ts.

/**
 * Data access for customers: sentences built from the specifications, over the unit of work
 * the service opened. The only layer that touches records; it never decides what a request means.
 */

/** The sets this module reads. A test passes any object with them. */
export type CustomerUnitOfWork = Pick<UnitOfWork, 'customers'>;

export interface CustomerListQuery {
    /** Case-insensitive substring of the company name; blank means no filter. */
    search: string;
    /** Rows in the first page. */
    limit: number;
}

export function listCustomersByCompanyName(work: CustomerUnitOfWork, query: CustomerListQuery): Customer[] {
    const specifications: Specification<Customer>[] = [];
    if (query.search) specifications.push(companyNameContains(query.search));
    specifications.push(orderedByCompanyName(), firstPage(query.limit));
    return work.customers.list(...specifications);
}

/** The customer with this internal id, or null when there is none. */
export function findCustomerById(work: CustomerUnitOfWork, id: number): Customer | null {
    return work.customers.find(id);
}
