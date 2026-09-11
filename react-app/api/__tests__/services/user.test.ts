import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleSummary } from '../../src/controllers/userRoles/endpoints';
import type { ActiveUser } from '../../src/repositories/activeUser';

// The service is tested against mocked repositories: the session reader and the role lookup are fakes.
const { readActiveUser, listRolesForEmployee } = vi.hoisted(() => ({
    readActiveUser: vi.fn<() => ActiveUser>(),
    listRolesForEmployee: vi.fn<(employeeId: number) => RoleSummary[]>(),
}));
vi.mock('../../src/repositories/activeUser', () => ({ readActiveUser }));
vi.mock('../../src/repositories/userRoles', () => ({ listRolesForEmployee }));

import { getActiveUserRoles } from '../../src/services/user';

describe('getActiveUserRoles', () => {
    beforeEach(() => {
        readActiveUser.mockReset();
        listRolesForEmployee.mockReset();
        readActiveUser.mockReturnValue({ id: 7, name: 'Ada Lovelace', email: 'ada@example.com', roleId: 3 });
        listRolesForEmployee.mockReturnValue([{ roleId: 3, roleName: 'Administrator' }, { roleId: 57, roleName: 'Data Warehouse Integrator' }]);
    });

    it('looks the roles up for the session user and answers who they are, their login role and every role', () => {
        expect(getActiveUserRoles()).toEqual({
            user: { id: 7, name: 'Ada Lovelace', email: 'ada@example.com' },
            activeRoleId: 3,
            roles: [{ roleId: 3, roleName: 'Administrator' }, { roleId: 57, roleName: 'Data Warehouse Integrator' }],
        });
        expect(listRolesForEmployee).toHaveBeenCalledWith(7);
    });

    it('lets a failed lookup fail the request', () => {
        listRolesForEmployee.mockImplementation(() => {
            throw new Error('userRoles answered HTTP 500.');
        });
        expect(() => getActiveUserRoles()).toThrow('userRoles answered HTTP 500.');
    });
});
