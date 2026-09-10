import { describe, expect, it, vi } from 'vitest';
import { listCustomersByCompanyName, type CustomerUnitOfWork } from '../../src/repositories/customers';
import type { Customer } from '../../src/repositories/generated/Customer.gen';

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

/** A unit of work with only the customers set: list() applies every specification to the recording query and returns the rows. */
function createFakeUnitOfWork(rows: Customer[]) {
    const recording = createRecordingQuery();
    const list = vi.fn((...specifications: Array<(query: unknown) => unknown>) => {
        specifications.forEach((specification) => specification(recording.query));
        return rows;
    });
    const work = { customers: { list } } as unknown as CustomerUnitOfWork;
    return { work, list, calls: recording.calls };
}

describe('listCustomersByCompanyName', () => {
    const rows: Customer[] = [
        { id: 1, companyName: 'Acme', email: 'hello@acme.example' },
        { id: 2, companyName: 'Beta', email: null },
    ];

    it('returns the rows the set lists', () => {
        const { work } = createFakeUnitOfWork(rows);
        expect(listCustomersByCompanyName(work, { search: '', limit: 50 })).toBe(rows);
    });

    it('filters by company name, orders, and pages when a search term is given', () => {
        const { work, calls } = createFakeUnitOfWork(rows);
        listCustomersByCompanyName(work, { search: 'acme', limit: 5 });
        expect(calls).toEqual([
            { method: 'where', args: ['companyName', 'LIKE', '%acme%'] },
            { method: 'orderByAsc', args: ['companyName'] },
            { method: 'page', args: [1, 5] },
        ]);
    });

    it('skips the filter for a blank search', () => {
        const { work, calls } = createFakeUnitOfWork(rows);
        listCustomersByCompanyName(work, { search: '', limit: 50 });
        expect(calls.map((call) => call.method)).toEqual(['orderByAsc', 'page']);
    });
});
