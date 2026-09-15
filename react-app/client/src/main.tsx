import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureApiClient } from '@amerilux/netsuite-api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { app } from '../../netsuite';
import { reportApiError } from '@/hooks/useApiErrors';
import { createAppRouter } from '@/router';
import '@/styles/app.css';

configureApiClient({
    // Deployed, API calls ride the NetSuite session on the same origin. In development the Vite server
    // proxies /api to server.ts, which signs each call to the sandbox.
    basePaths: import.meta.env.DEV ? { restlet: '/api/restlet', suitelet: '/api/suitelet' } : undefined,
    // Every failed call is reported here before it rejects, so hooks and pages carry no error handling
    // of their own; the AppShell shows what was reported. A call opts out with { handleError: false }.
    onError: reportApiError,
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            // A failed call is already reported once; retrying would report it again.
            retry: false,
            staleTime: 5 * 60 * 1000,
        },
    },
});

const router = createAppRouter();

// NetSuite can evaluate the inline HTML field more than once; mount only into an empty root.
const rootElement = document.getElementById(app.rootElementId);
if (rootElement && !rootElement.hasChildNodes()) {
    createRoot(rootElement).render(
        <StrictMode>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </StrictMode>,
    );
}
