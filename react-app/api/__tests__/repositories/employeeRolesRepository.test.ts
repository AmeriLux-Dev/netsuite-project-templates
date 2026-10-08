import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from '../../src/types/models.gen';

// The repository is tested against a fake dbContext carrying only the employeeRoles set.
const { fakeEmployeeRoles } = vi.hoisted(() => ({ fakeEmployeeRoles: { list: vi.fn() } }));
vi.mock('../../src/repositories/generated/context.gen', () => ({ dbContext: { employeeRoles: fakeEmployeeRoles } }));

import { listEmployeeRoles } from '../../src/repositories/employeeRolesRepository';
import { forEmployee } from '../../src/specifications/employeeRolesSpecifications';

beforeEach(() => {
    fakeEmployeeRoles.list.mockReset();
});

// The read userService composes is its to test; the repository only has to hand the specifications on.
describe('listEmployeeRoles', () => {
    it('hands the specifications to the set in the order given, and answers its rows', () => {
        const rows: EmployeeRole[] = [
            { roleId: 3, employeeId: 7, roleName: 'Administrator' },
            { roleId: 57, employeeId: 7, roleName: 'Data Warehouse Integrator' },
        ];
        const specifications = [forEmployee(7)];
        fakeEmployeeRoles.list.mockReturnValue(rows);

        expect(listEmployeeRoles(...specifications)).toBe(rows);
        expect(fakeEmployeeRoles.list).toHaveBeenCalledWith(...specifications);
    });
});
