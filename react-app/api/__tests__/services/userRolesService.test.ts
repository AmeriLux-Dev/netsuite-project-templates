import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from '../../src/types/models.gen';

// The service is tested against a mocked repositories layer, so the test sees only the service's decisions. The mock is
// named as the service imports the repository.
const { employeeRolesRepository } = vi.hoisted(() => ({
    employeeRolesRepository: {
        listEmployeeRolesByEmployee: vi.fn<(employeeId: number) => EmployeeRole[]>(),
    },
}));
vi.mock('../../src/repositories/employeeRolesRepository', () => employeeRolesRepository);

import { getRolesByEmployee } from '../../src/services/userRolesService';

describe('getRolesByEmployee', () => {
    beforeEach(() => {
        employeeRolesRepository.listEmployeeRolesByEmployee.mockReset();
        employeeRolesRepository.listEmployeeRolesByEmployee.mockReturnValue([
            { roleId: 57, employeeId: 7, roleName: 'Data Warehouse Integrator' },
            { roleId: 3, employeeId: 7, roleName: 'Administrator' },
        ]);
    });

    it('queries by the id and answers the roles sorted by name', () => {
        expect(getRolesByEmployee(7)).toEqual([
            { roleId: 3, roleName: 'Administrator' },
            { roleId: 57, roleName: 'Data Warehouse Integrator' },
        ]);
        expect(employeeRolesRepository.listEmployeeRolesByEmployee).toHaveBeenCalledWith(7);
    });

    it('answers an empty list for an employee with no roles', () => {
        employeeRolesRepository.listEmployeeRolesByEmployee.mockReturnValue([]);
        expect(getRolesByEmployee(8)).toEqual([]);
    });
});
