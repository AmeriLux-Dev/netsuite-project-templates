import type { UserRolesRequest, UserRolesResponse } from 'common/dto/user';
import type { Endpoint } from '../../../lib/endpoint';
import { getActiveUserRoles } from '../../../services/user';

/** GET ?endpoint=roles — the caller and every role assigned to them. */
export const roles: Endpoint<UserRolesRequest, UserRolesResponse> = () => getActiveUserRoles();
