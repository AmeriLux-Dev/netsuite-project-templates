import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from '../../src/types/models.gen';

// The service is tested against a mocked repositories layer, so the test sees only the service's decisions.
const { listEmployeeRolesByEmployee } = vi.hoisted(() => ({
    listEmployeeRolesByEmployee: vi.fn<(employeeId: number) => EmployeeRole[]>(),
}));
vi.mock('../../src/repositories/employeeRolesRepository', () => ({ listEmployeeRolesByEmployee }));

import { getRolesByEmployee, toRoleSummary } from '../../src/services/userRolesService';

describe('toRoleSummary', () => {
    it('keeps the role id and name only', () => {
        expect(toRoleSummary({ roleId: 3, employeeId: 7, roleName: 'Administrator' })).toEqual({ roleId: 3, roleName: 'Administrator' });
    });
});

describe('getRolesByEmployee', () => {
    beforeEach(() => {
        listEmployeeRolesByEmployee.mockReset();
        listEmployeeRolesByEmployee.mockReturnValue([
            { roleId: 57, employeeId: 7, roleName: 'Data Warehouse Integrator' },
            { roleId: 3, employeeId: 7, roleName: 'Administrator' },
        ]);
    });

    it('queries by the id and answers the roles sorted by name', () => {
        expect(getRolesByEmployee(7)).toEqual([
            { roleId: 3, roleName: 'Administrator' },
            { roleId: 57, roleName: 'Data Warehouse Integrator' },
        ]);
        expect(listEmployeeRolesByEmployee).toHaveBeenCalledWith(7);
    });

    it('answers an empty list for an employee with no roles', () => {
        listEmployeeRolesByEmployee.mockReturnValue([]);
        expect(getRolesByEmployee(8)).toEqual([]);
    });
});
