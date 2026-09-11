import type { RoleSummary } from './userRoles';

/** What the user endpoints send and receive: the caller as the session knows them. */

export interface ActiveUserSummary {
    id: number;
    name: string;
    email: string;
}

/** The endpoint takes no parameters; the caller is the session's user. */
export type UserRolesRequest = Record<string, never>;

export interface UserRolesResponse {
    user: ActiveUserSummary;
    /** The role the caller logged in with. */
    activeRoleId: number;
    /** Every role assigned to the caller, whichever one they logged in with. */
    roles: RoleSummary[];
}
