import { useActiveUserRoles } from '@/hooks/user/useActiveUserRoles';

/**
 * The starting page: who is signed in and which roles they hold. A page calls a hook; only a hook
 * calls the api. A failed call needs nothing here: it is reported to the AppShell's banner before
 * the query sees it (configureApiClient in main.tsx). A page that would rather show the failure in
 * place reads the query's isError and error, and its hook passes { handleError: false } to the call.
 */
export function UserRolesPage() {
    const activeUserRoles = useActiveUserRoles();

    return (
        <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Your roles</h2>

            {activeUserRoles.isPending && <p className="text-sm text-slate-500">Loading your roles…</p>}

            {activeUserRoles.isSuccess && (
                <>
                    <p className="text-sm text-slate-700">
                        Signed in as <span className="font-medium text-slate-900">{activeUserRoles.data.user.name}</span>
                        {activeUserRoles.data.user.email && <span className="text-slate-500"> ({activeUserRoles.data.user.email})</span>}
                    </p>

                    {activeUserRoles.data.roles.length === 0 && <p className="text-sm text-slate-500">No roles are assigned to you.</p>}

                    {activeUserRoles.data.roles.length > 0 && (
                        <div className="overflow-x-auto rounded-md border border-slate-200">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                                    <tr>
                                        <th scope="col" className="px-3 py-2 font-medium">Id</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Role</th>
                                        <th scope="col" className="px-3 py-2 font-medium">Active</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {activeUserRoles.data.roles.map((role) => (
                                        <tr key={role.roleId} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 tabular-nums text-slate-500">{role.roleId}</td>
                                            <td className="px-3 py-2 font-medium text-slate-900">{role.roleName}</td>
                                            <td className="px-3 py-2 text-slate-700">{role.roleId === activeUserRoles.data.activeRoleId ? 'Yes' : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
