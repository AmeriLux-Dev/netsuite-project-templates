import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoleSummary } from '../../src/services/userRolesService';

// The controller is tested against a mocked service, so the test sees only what the endpoint does with the wire.
const { getRolesByEmployee } = vi.hoisted(() => ({
    getRolesByEmployee: vi.fn<(employeeId: number) => RoleSummary[]>(),
}));
vi.mock('../../src/services/userRolesService', () => ({ getRolesByEmployee }));

import { userRolesEndpoints } from '../../src/controllers/userRolesController';

describe('userRoles.byEmployee', () => {
    beforeEach(() => {
        getRolesByEmployee.mockReset();
        getRolesByEmployee.mockReturnValue([{ roleId: 3, roleName: 'Administrator' }]);
    });

    it('unpacks the id, calls the service with it and shapes the reply', () => {
        expect(userRolesEndpoints.byEmployee({ employeeId: 7 })).toEqual({ employeeId: 7, roles: [{ roleId: 3, roleName: 'Administrator' }] });
        expect(getRolesByEmployee).toHaveBeenCalledWith(7);
    });

    it('accepts an id sent as a string and answers with the number', () => {
        expect(userRolesEndpoints.byEmployee({ employeeId: '12' as unknown as number })).toMatchObject({ employeeId: 12 });
        expect(getRolesByEmployee).toHaveBeenCalledWith(12);
    });

    it('rejects anything that is not a positive whole number with a 400 before calling the service', () => {
        for (const bad of ['abc', '0', -1, undefined]) {
            expect(() => userRolesEndpoints.byEmployee({ employeeId: bad as unknown as number })).toThrow(expect.objectContaining({ status: 400 }));
        }
        expect(getRolesByEmployee).not.toHaveBeenCalled();
    });
});
