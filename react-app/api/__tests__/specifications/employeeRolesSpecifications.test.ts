import { describe, expect, it } from 'vitest';
import { forEmployee } from '../../src/specifications/employeeRolesSpecifications';

// The builders userService composes its role read from. Its test sees their names only, so what each asks the query for
// is pinned here.

/** Applies the specification to a query that records what it asks for, and answers the calls. */
function recordCalls(specification: (query: never) => unknown): Array<{ method: string; args: unknown[] }> {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ['where', 'orderByAsc', 'orderByDesc', 'page']) {
        query[method] = (...args: unknown[]) => {
            calls.push({ method, args });
            return query;
        };
    }
    specification(query as never);
    return calls;
}

describe('forEmployee', () => {
    it('asks for the employee and nothing else', () => {
        expect(recordCalls(forEmployee(7))).toEqual([{ method: 'where', args: ['employeeId', '=', 7] }]);
    });
});
