import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from 'N/runtime';
import { readActiveUser } from '../../src/repositories/activeUser';

// N/runtime resolves to the stub in api/test/stubs/N; the repository is tested on how it reads the session.
const getCurrentUser = vi.mocked(runtime.getCurrentUser);

beforeEach(() => {
    getCurrentUser.mockReset();
});

describe('readActiveUser', () => {
    it('reads the session user as numbers and strings, and the login role as roleId', () => {
        getCurrentUser.mockReturnValue({ id: 7, name: 'Ada Lovelace', email: 'ada@example.com', role: 3 } as never);
        expect(readActiveUser()).toEqual({ id: 7, name: 'Ada Lovelace', email: 'ada@example.com', roleId: 3 });
    });

    it('coerces ids NetSuite hands over as strings', () => {
        getCurrentUser.mockReturnValue({ id: '7', name: 'Ada Lovelace', email: '', role: '1481' } as never);
        expect(readActiveUser()).toEqual({ id: 7, name: 'Ada Lovelace', email: '', roleId: 1481 });
    });
});
