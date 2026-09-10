import type { CustomerListRequest, CustomerListResponse, CustomerSummary } from 'common/types/customers';
import { listCustomersByCompanyName } from '../repositories/customers';
import type { Customer } from '../repositories/generated/Customer.gen';
import { openUnitOfWork } from '../repositories/generated/context.gen';

// @netsuite-project:example — scaffold example; see controllers/customers/customersController.ts.

/**
 * Decisions about customers: what the request means and what the caller gets back. The service
 * opens the unit of work and hands it to repository functions; it never queries on its own.
 */

export const DEFAULT_CUSTOMER_LIMIT = 50;
export const MAX_CUSTOMER_LIMIT = 500;

export function clampCustomerLimit(requested: number | string | undefined): number {
    const parsed = typeof requested === 'string' ? Number.parseInt(requested, 10) : requested;
    if (parsed === undefined || Number.isNaN(parsed) || parsed <= 0) return DEFAULT_CUSTOMER_LIMIT;
    return Math.min(parsed, MAX_CUSTOMER_LIMIT);
}

export function toCustomerSummary(customer: Customer): CustomerSummary {
    return { id: customer.id, companyName: customer.companyName, email: customer.email ?? null };
}

export function listCustomers(request: CustomerListRequest): CustomerListResponse {
    const limit = clampCustomerLimit(request.limit);
    const search = (request.search ?? '').trim();
    const work = openUnitOfWork({ tracking: false });
    const customers = listCustomersByCompanyName(work, { search, limit }).map(toCustomerSummary);
    return { customers, limit };
}
