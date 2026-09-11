import type { Specification } from '@amerilux/netsuite-repository';
import { CustomerFields, type Customer } from '../repositories/generated/Customer.gen';

// @netsuite-project:example — scaffold example; see controllers/customers/customersController.ts.

/**
 * The query vocabulary for customers: one predicate per builder, no decisions. A repository
 * function composes them; a test can render any of them with describe() and no context.
 */

export const companyNameContains = (term: string): Specification<Customer> =>
    (query) => query.where(CustomerFields.companyName, 'LIKE', `%${term}%`);

export const orderedByCompanyName = (): Specification<Customer> =>
    (query) => query.orderByAsc(CustomerFields.companyName);

export const firstPage = (limit: number): Specification<Customer> =>
    (query) => query.page(1, limit);
