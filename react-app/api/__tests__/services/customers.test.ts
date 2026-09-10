import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '../../src/repositories/generated/Customer.gen';

// The service is tested against a mocked repositories layer: the unit of work it opens and the
// repository function it calls are both fakes, so the test sees only the service's decisions.
const { fakeUnitOfWork, openUnitOfWork, listCustomersByCompanyName, findCustomerById } = vi.hoisted(() => {
    const fakeUnitOfWork = { customers: {} };
    return {
        fakeUnitOfWork,
        openUnitOfWork: vi.fn(() => fakeUnitOfWork),
        listCustomersByCompanyName: vi.fn<(work: unknown, query: unknown) => Customer[]>(),
        findCustomerById: vi.fn<(work: unknown, id: number) => Customer | null>(),
    };
});
vi.mock('../../src/repositories/generated/context.gen', () => ({ openUnitOfWork }));
vi.mock('../../src/repositories/customers', () => ({ listCustomersByCompanyName, findCustomerById }));

import { ApiError } from '../../src/lib/apiError';
import {
    clampCustomerLimit,
    DEFAULT_CUSTOMER_LIMIT,
    getCustomer,
    listCustomers,
    MAX_CUSTOMER_LIMIT,
    parseCustomerId,
} from '../../src/services/customers';

describe('parseCustomerId', () => {
    it('parses strings and rejects anything that is not a positive whole number as a 400', () => {
        expect(parseCustomerId('12')).toBe(12);
        expect(parseCustomerId(3)).toBe(3);
        for (const bad of ['abc', '0', -1, undefined]) {
            expect(() => parseCustomerId(bad)).toThrow(ApiError);
            expect(() => parseCustomerId(bad)).toThrow(expect.objectContaining({ status: 400 }));
        }
    });
});

describe('getCustomer', () => {
    const customer: Customer = { id: 12, companyName: 'Acme', email: null };

    beforeEach(() => {
        openUnitOfWork.mockClear();
        findCustomerById.mockReset();
    });

    it('looks the customer up in a read-only unit of work and returns its summary', () => {
        findCustomerById.mockReturnValue(customer);
        expect(getCustomer({ id: '12' })).toEqual({ id: 12, companyName: 'Acme', email: null });
        expect(openUnitOfWork).toHaveBeenCalledWith({ tracking: false });
        expect(findCustomerById).toHaveBeenCalledWith(fakeUnitOfWork, 12);
    });

    it('answers 404 when there is no such customer', () => {
        findCustomerById.mockReturnValue(null);
        expect(() => getCustomer({ id: 99 })).toThrow(expect.objectContaining({ status: 404 }));
    });
});

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
