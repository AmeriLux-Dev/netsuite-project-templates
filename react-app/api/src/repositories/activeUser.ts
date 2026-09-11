import * as runtime from 'N/runtime';

/**
 * Data access for the session: who is calling. A repository rather than a service concern, because
 * it reads a NetSuite module; the service composes what it returns with other repository answers.
 */

export interface ActiveUser {
    id: number;
    name: string;
    email: string;
    /** The role the caller logged in with, not every role they hold. */
    roleId: number;
}

export function readActiveUser(): ActiveUser {
    const user = runtime.getCurrentUser();
    return { id: Number(user.id), name: user.name, email: user.email, roleId: Number(user.role) };
}
