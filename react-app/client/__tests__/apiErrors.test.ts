import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@amerilux/netsuite-api/client';
import type { ApiCallContext } from '@amerilux/netsuite-api/client';
import { clearApiErrors, dismissApiError, readApiErrors, reportApiError, subscribeToApiErrors } from '@/hooks/useApiErrors';

const userRolesCall: ApiCallContext = { scriptRef: { kind: 'restlet', scriptId: 'customscript_{{prefix}}_user', deployId: 'customdeploy_{{prefix}}_user' }, endpoint: 'roles', request: {} };

beforeEach(() => {
    clearApiErrors();
});

describe('reportApiError', () => {
    it('keeps what a failed call reported, oldest first, and tells subscribers', () => {
        const listener = vi.fn();
        const unsubscribe = subscribeToApiErrors(listener);
        reportApiError(new ApiClientError(403, 'Not permitted'), userRolesCall);
        reportApiError(new ApiClientError(0, 'Could not reach customscript_{{prefix}}_user.roles: Failed to fetch'), userRolesCall);
        expect(readApiErrors().map((reported) => [reported.message, reported.status, reported.scriptId, reported.endpoint])).toEqual([
            ['Not permitted', 403, 'customscript_{{prefix}}_user', 'roles'],
            ['Could not reach customscript_{{prefix}}_user.roles: Failed to fetch', 0, 'customscript_{{prefix}}_user', 'roles'],
        ]);
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        reportApiError(new ApiClientError(500, 'Boom'), userRolesCall);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('replaces the same failure reported again instead of stacking it', () => {
        reportApiError(new ApiClientError(403, 'Not permitted'), userRolesCall);
        reportApiError(new ApiClientError(403, 'Not permitted'), userRolesCall);
        reportApiError(new ApiClientError(403, 'Not permitted'), { ...userRolesCall, endpoint: 'other' });
        expect(readApiErrors().map((reported) => reported.endpoint)).toEqual(['roles', 'other']);
    });
});

describe('dismissApiError', () => {
    it('removes one reported failure by id and leaves the rest', () => {
        reportApiError(new ApiClientError(403, 'Not permitted'), userRolesCall);
        reportApiError(new ApiClientError(404, 'Not found'), { ...userRolesCall, endpoint: 'byId' });
        const [first, second] = readApiErrors();
        dismissApiError(first.id);
        expect(readApiErrors()).toEqual([second]);
    });
});
