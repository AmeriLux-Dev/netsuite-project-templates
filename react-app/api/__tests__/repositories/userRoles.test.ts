import { beforeEach, describe, expect, it, vi } from 'vitest';
import { scripts } from 'common/netsuite';
import { userRolesContract } from 'common/types/userRoles';

// The repository is tested against a fake Suitelet client: what it asks the userRoles script for, not how the wire looks.
const { byEmployee, createSuiteletClient } = vi.hoisted(() => {
    const byEmployee = vi.fn();
    return { byEmployee, createSuiteletClient: vi.fn(() => ({ byEmployee })) };
});
vi.mock('../../src/lib/suiteletClient', () => ({ createSuiteletClient }));

import { listRolesForEmployee } from '../../src/repositories/userRoles';

// The client is built when the module loads, before any test runs, and mock state is cleared per test: keep the call.
const clientConstructionArguments = createSuiteletClient.mock.calls[0] as unknown[] | undefined;

beforeEach(() => {
    byEmployee.mockReset();
});

describe('listRolesForEmployee', () => {
    it('builds the client for the userRoles script and its contract', () => {
        expect(clientConstructionArguments).toEqual([scripts.userRoles, userRolesContract]);
    });

    it('asks the Suitelet for the employee and returns its roles', () => {
        const roles = [{ roleId: 3, roleName: 'Administrator' }];
        byEmployee.mockReturnValue({ employeeId: 7, roles });
        expect(listRolesForEmployee(7)).toBe(roles);
        expect(byEmployee).toHaveBeenCalledWith({ employeeId: 7 });
    });
});
