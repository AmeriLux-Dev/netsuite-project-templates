import { createFileRoute } from '@tanstack/react-router';
{{#if userRolesExample}}
import { UserRolesPage } from '@/pages/UserRolesPage';
{{/if}}

// File-based routing: this file is the "/" route. Add src/routes/orders.tsx for "/orders",
// src/routes/orders.$orderId.tsx for "/orders/:orderId", and so on. The Vite plugin keeps
// src/routeTree.gen.ts in sync; never edit that file by hand.
export const Route = createFileRoute('/')({
{{#if userRolesExample}}
    component: UserRolesPage,
{{/if}}
{{#unless userRolesExample}}
    // A placeholder until the first page: write it in src/pages/ and name it here.
    component: () => <p className="text-sm text-slate-500">No pages yet.</p>,
{{/unless}}
});
