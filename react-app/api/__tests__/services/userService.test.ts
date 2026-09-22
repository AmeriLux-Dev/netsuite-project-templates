import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from '../../src/types/models.gen';
import type { ActiveUser } from '../../src/repositories/activeUserRepository';
import type { RoleSummary } from '../../src/services/userService';

// The service is tested against mocked repositories, so the test sees only the service's decisions. Each mock is named
// as the service imports its repository.
const { activeUserRepository, employeeRolesRepository, userRolesRepository } = vi.hoisted(() => ({
    activeUserRepository: {
        readActiveUser: vi.fn<() => ActiveUser>(),
    },
    employeeRolesRepository: {
        listEmployeeRolesByEmployee: vi.fn<(employeeId: number) => EmployeeRole[]>(),
    },
    userRolesRepository: {
        listRolesForEmployee: vi.fn<(employeeId: number) => RoleSummary[]>(),
    },
}));
vi.mock('../../src/repositories/activeUserRepository', () => activeUserRepository);
vi.mock('../../src/repositories/employeeRolesRepository', () => employeeRolesRepository);
vi.mock('../../src/repositories/userRolesRepository', () => userRolesRepository);

import { getActiveUserRoles, getRolesByEmployee } from '../../src/services/userService';

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

describe('getActiveUserRoles', () => {
    beforeEach(() => {
        activeUserRepository.readActiveUser.mockReset();
        userRolesRepository.listRolesForEmployee.mockReset();
        activeUserRepository.readActiveUser.mockReturnValue({ id: 7, name: 'Ada Lovelace', email: 'ada@example.com', roleId: 3 });
        userRolesRepository.listRolesForEmployee.mockReturnValue([{ roleId: 3, roleName: 'Administrator' }, { roleId: 57, roleName: 'Data Warehouse Integrator' }]);
    });

    it('looks the roles up for the session user and answers who they are, with their login role, and every role', () => {
        expect(getActiveUserRoles()).toEqual({
            user: { id: 7, name: 'Ada Lovelace', email: 'ada@example.com', roleId: 3 },
            roles: [{ roleId: 3, roleName: 'Administrator' }, { roleId: 57, roleName: 'Data Warehouse Integrator' }],
        });
        expect(userRolesRepository.listRolesForEmployee).toHaveBeenCalledWith(7);
    });

    it('lets a failed lookup fail the request', () => {
        userRolesRepository.listRolesForEmployee.mockImplementation(() => {
            throw new Error('userRoles answered HTTP 500.');
        });
        expect(() => getActiveUserRoles()).toThrow('userRoles answered HTTP 500.');
    });
});
