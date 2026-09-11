import type { UserEndpoints } from 'api/controllers/userController';
import { scripts } from 'common/netsuite';
import { createApiClient } from './apiClient';

/** One typed function per endpoint of the user controller: `userApi.roles()`. The api import is a type only. */
export const userApi = createApiClient<UserEndpoints>(scripts.user);
