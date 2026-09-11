import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Customer } from 'common/types/models.gen';

// The repository is tested against a fake dbContext carrying only the customers set, whose list()
// records the specifications applied to it.
const { fakeCustomers } = vi.hoisted(() => ({ fakeCustomers: { list: vi.fn(), find: vi.fn() } }));
vi.mock('../../src/repositories/generated/context.gen', () => ({ dbContext: { customers: fakeCustomers } }));

import { findCustomerById, listCustomersByCompanyName } from '../../src/repositories/customers';

/** Records the query builder calls a specification makes, so a test can assert on them. */
function createRecordingQuery() {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ['where', 'orderByAsc', 'orderByDesc', 'page']) {
        query[method] = (...args: unknown[]) => {
            calls.push({ method, args });
            return query;
        };
    }
    return { query, calls };
}

/** Makes the fake set's list() apply every specification to a recording query and return the rows. */
function listReturning(rows: Customer[]) {
    const recording = createRecordingQuery();
    fakeCustomers.list.mockImplementation((...specifications: Array<(query: unknown) => unknown>) => {
        specifications.forEach((specification) => specification(recording.query));
        return rows;
    });
    return recording.calls;
}

beforeEach(() => {
    fakeCustomers.list.mockReset();
    fakeCustomers.find.mockReset();
});

describe('listCustomersByCompanyName', () => {
    const rows: Customer[] = [
        { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
        { id: 2, companyName: 'Beta', email: null },
    ];

    it('returns the rows the set lists', () => {
        listReturning(rows);
        expect(listCustomersByCompanyName({ search: '', limit: 50 })).toBe(rows);
    });

    it('filters by company name, orders, and pages when a search term is given', () => {
        const calls = listReturning(rows);
        listCustomersByCompanyName({ search: 'acme', limit: 5 });
        expect(calls).toEqual([
            { method: 'where', args: ['companyName', 'LIKE', '%acme%'] },
            { method: 'orderByAsc', args: ['companyName'] },
            { method: 'page', args: [1, 5] },
        ]);
    });

    it('skips the filter for a blank search', () => {
        const calls = listReturning(rows);
        listCustomersByCompanyName({ search: '', limit: 50 });
        expect(calls.map((call) => call.method)).toEqual(['orderByAsc', 'page']);
    });
});

describe('findCustomerById', () => {
    const customer: Customer = { id: 1, companyName: 'Acme', email: null };

    it('asks the set for the id and passes its answer through', () => {
        fakeCustomers.find.mockImplementation((id: number) => (id === 1 ? customer : null));
        expect(findCustomerById(1)).toBe(customer);
        expect(findCustomerById(2)).toBeNull();
        expect(fakeCustomers.find).toHaveBeenCalledWith(1);
    });
});
