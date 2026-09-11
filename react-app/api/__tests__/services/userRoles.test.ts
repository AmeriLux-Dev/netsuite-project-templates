import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeRole } from 'common/types/models.gen';

// The service is tested against a mocked repositories layer, so the test sees only the service's decisions.
const { listEmployeeRolesByEmployee } = vi.hoisted(() => ({
    listEmployeeRolesByEmployee: vi.fn<(employeeId: number) => EmployeeRole[]>(),
}));
vi.mock('../../src/repositories/employeeRoles', () => ({ listEmployeeRolesByEmployee }));

import { ApiError } from '../../src/lib/apiError';
import { getRolesByEmployee, parseEmployeeId, toRoleSummary } from '../../src/services/userRoles';

describe('parseEmployeeId', () => {
    it('parses strings and rejects anything that is not a positive whole number as a 400', () => {
        expect(parseEmployeeId('12')).toBe(12);
        expect(parseEmployeeId(3)).toBe(3);
        for (const bad of ['abc', '0', -1, undefined]) {
            expect(() => parseEmployeeId(bad)).toThrow(ApiError);
            expect(() => parseEmployeeId(bad)).toThrow(expect.objectContaining({ status: 400 }));
        }
    });
});

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

    it('queries by the parsed id and answers the roles sorted by name', () => {
        expect(getRolesByEmployee({ employeeId: '7' })).toEqual({
            employeeId: 7,
            roles: [
                { roleId: 3, roleName: 'Administrator' },
                { roleId: 57, roleName: 'Data Warehouse Integrator' },
            ],
        });
        expect(listEmployeeRolesByEmployee).toHaveBeenCalledWith(7);
    });

    it('rejects a bad id before querying', () => {
        expect(() => getRolesByEmployee({ employeeId: 'seven' })).toThrow(expect.objectContaining({ status: 400 }));
        expect(listEmployeeRolesByEmployee).not.toHaveBeenCalled();
    });
});
