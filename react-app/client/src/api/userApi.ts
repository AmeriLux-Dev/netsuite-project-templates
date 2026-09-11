import { scripts } from 'common/netsuite';
import { userContract } from 'common/types/user';
import { createApiClient } from './apiClient';

/** One typed function per endpoint of the user controller: `userApi.roles({})`. */
export const userApi = createApiClient(scripts.user, userContract);
