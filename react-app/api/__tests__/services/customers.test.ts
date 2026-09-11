import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from '../../src/repositories/generated/Customer.gen';

// The service is tested against a mocked repositories layer: the repository functions it calls are
// fakes, so the test sees only the service's decisions.
const { listCustomersByCompanyName, findCustomerById } = vi.hoisted(() => ({
    listCustomersByCompanyName: vi.fn<(query: unknown) => Customer[]>(),
    findCustomerById: vi.fn<(id: number) => Customer | null>(),
}));
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
        findCustomerById.mockReset();
    });

    it('looks the customer up by its parsed id and returns its summary', () => {
        findCustomerById.mockReturnValue(customer);
        expect(getCustomer({ id: '12' })).toEqual({ id: 12, companyName: 'Acme', email: null });
        expect(findCustomerById).toHaveBeenCalledWith(12);
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
        listCustomersByCompanyName.mockReset();
        listCustomersByCompanyName.mockReturnValue(rows);
    });

    it('asks the repository for the default page when the request is empty', () => {
        listCustomers({});
        expect(listCustomersByCompanyName).toHaveBeenCalledWith({ search: '', limit: DEFAULT_CUSTOMER_LIMIT });
    });

    it('trims the search term and clamps the limit before querying', () => {
        listCustomers({ search: '  acme ', limit: '5' });
        expect(listCustomersByCompanyName).toHaveBeenCalledWith({ search: 'acme', limit: 5 });
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
