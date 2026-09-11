import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from 'common/types/models.gen';

// The repository is tested against a fake dbContext carrying only the employeeRoles set, whose list()
// records the specifications applied to it.
const { fakeEmployeeRoles } = vi.hoisted(() => ({ fakeEmployeeRoles: { list: vi.fn() } }));
vi.mock('../../src/repositories/generated/context.gen', () => ({ dbContext: { employeeRoles: fakeEmployeeRoles } }));

import { listEmployeeRolesByEmployee } from '../../src/repositories/employeeRoles';

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
function listReturning(rows: EmployeeRole[]) {
    const recording = createRecordingQuery();
    fakeEmployeeRoles.list.mockImplementation((...specifications: Array<(query: unknown) => unknown>) => {
        specifications.forEach((specification) => specification(recording.query));
        return rows;
    });
    return recording.calls;
}

beforeEach(() => {
    fakeEmployeeRoles.list.mockReset();
});

describe('listEmployeeRolesByEmployee', () => {
    const rows: EmployeeRole[] = [
        { roleId: 3, employeeId: 7, roleName: 'Administrator' },
        { roleId: 57, employeeId: 7, roleName: 'Data Warehouse Integrator' },
    ];

    it('returns the rows the set lists', () => {
        listReturning(rows);
        expect(listEmployeeRolesByEmployee(7)).toBe(rows);
    });

    it('filters the set to the employee and nothing else', () => {
        const calls = listReturning(rows);
        listEmployeeRolesByEmployee(7);
        expect(calls).toEqual([{ method: 'where', args: ['employeeId', '=', 7] }]);
    });
});
