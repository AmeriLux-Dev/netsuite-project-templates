import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '../../src/repositories/generated/Customer.gen';

// The service is tested against a mocked repositories layer: the unit of work it opens and the
// repository function it calls are both fakes, so the test sees only the service's decisions.
const { fakeUnitOfWork, openUnitOfWork, listCustomersByCompanyName } = vi.hoisted(() => {
    const fakeUnitOfWork = { customers: {} };
    return {
        fakeUnitOfWork,
        openUnitOfWork: vi.fn(() => fakeUnitOfWork),
        listCustomersByCompanyName: vi.fn<(work: unknown, query: unknown) => Customer[]>(),
    };
});
vi.mock('../../src/repositories/generated/context.gen', () => ({ openUnitOfWork }));
vi.mock('../../src/repositories/customers', () => ({ listCustomersByCompanyName }));

import {
    clampCustomerLimit,
    DEFAULT_CUSTOMER_LIMIT,
    listCustomers,
    MAX_CUSTOMER_LIMIT,
} from '../../src/services/customers';

describe('clampCustomerLimit', () => {
    it('falls back to the default for missing or invalid values', () => {
        expect(clampCustomerLimit(undefined)).toBe(DEFAULT_CUSTOMER_LIMIT);
        expect(clampCustomerLimit('abc')).toBe(DEFAULT_CUSTOMER_LIMIT);
        expect(clampCustomerLimit(0)).toBe(DEFAULT_CUSTOMER_LIMIT);
    });

    it('parses strings and caps at the maximum', () => {
        expect(clampCustomerLimit('25')).toBe(25);
        expect(clampCustomerLimit(10_000)).toBe(MAX_CUSTOMER_LIMIT);
    });
});

describe('listCustomers', () => {
    const rows: Customer[] = [
        { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
        { id: 2, companyName: 'Beta', email: null },
    ];

    beforeEach(() => {
        openUnitOfWork.mockClear();
        listCustomersByCompanyName.mockReset();
        listCustomersByCompanyName.mockReturnValue(rows);
    });

    it('opens a read-only unit of work and hands it to the repository', () => {
        listCustomers({});
        expect(openUnitOfWork).toHaveBeenCalledWith({ tracking: false });
        expect(listCustomersByCompanyName).toHaveBeenCalledWith(fakeUnitOfWork, { search: '', limit: DEFAULT_CUSTOMER_LIMIT });
    });

    it('trims the search term and clamps the limit before querying', () => {
        listCustomers({ search: '  acme ', limit: '5' });
        expect(listCustomersByCompanyName).toHaveBeenCalledWith(fakeUnitOfWork, { search: 'acme', limit: 5 });
    });

    it('maps rows to summaries and reports the applied limit', () => {
        expect(listCustomers({})).toEqual({
            customers: [
                { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
                { id: 2, companyName: 'Beta', email: null },
            ],
            limit: DEFAULT_CUSTOMER_LIMIT,
        });
    });
});
