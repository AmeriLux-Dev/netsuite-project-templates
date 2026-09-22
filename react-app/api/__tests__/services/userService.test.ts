import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleSummary } from '../../src/services/userRolesService';
import type { ActiveUser } from '../../src/repositories/activeUserRepository';

// The service is tested against mocked repositories: the session reader and the role lookup are fakes, each named as
// the service imports its repository.
const { activeUserRepository, userRolesRepository } = vi.hoisted(() => ({
    activeUserRepository: {
        readActiveUser: vi.fn<() => ActiveUser>(),
    },
    userRolesRepository: {
        listRolesForEmployee: vi.fn<(employeeId: number) => RoleSummary[]>(),
    },
}));
vi.mock('../../src/repositories/activeUserRepository', () => activeUserRepository);
vi.mock('../../src/repositories/userRolesRepository', () => userRolesRepository);

import { getActiveUserRoles } from '../../src/services/userService';

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
