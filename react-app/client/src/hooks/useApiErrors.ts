import { useSyncExternalStore } from 'react';
import type { ApiCallContext, ApiClientError } from '@amerilux/netsuite-api/client';

/**
 * Where failed API calls land by default. main.tsx hands `reportApiError` to configureApiClient, so
 * every generated client reports a failure here before rejecting; the AppShell's ApiErrorBanner
 * shows what is reported until it is dismissed. A hook needs no error handling of its own. A page
 * that shows a failure inline instead reads the query's error and has its hook pass
 * `{ handleError: false }` so the banner stays quiet.
 */

export interface ReportedApiError {
    id: number;
    message: string;
    /** The envelope status, or 0 when the call got no answer at all. */
    status: number;
    scriptId: string;
    endpoint: string;
    reportedAt: Date;
}

let reportedApiErrors: readonly ReportedApiError[] = [];
let nextReportedApiErrorId = 1;
const reportedApiErrorListeners = new Set<() => void>();

function publishReportedApiErrors(next: readonly ReportedApiError[]): void {
    reportedApiErrors = next;
    reportedApiErrorListeners.forEach((listener) => listener());
}

/** The handler given to configureApiClient. The same failure reported again replaces its earlier entry rather than stacking. */
export function reportApiError(error: ApiClientError, context: ApiCallContext): void {
    const scriptId = context.scriptRef.scriptId;
    const kept = reportedApiErrors.filter((reported) => !(reported.scriptId === scriptId && reported.endpoint === context.endpoint && reported.message === error.message));
    publishReportedApiErrors([...kept, { id: nextReportedApiErrorId++, message: error.message, status: error.status, scriptId, endpoint: context.endpoint, reportedAt: new Date() }]);
}

export function dismissApiError(id: number): void {
    publishReportedApiErrors(reportedApiErrors.filter((reported) => reported.id !== id));
}

export function clearApiErrors(): void {
    publishReportedApiErrors([]);
}

export function readApiErrors(): readonly ReportedApiError[] {
    return reportedApiErrors;
}

export function subscribeToApiErrors(listener: () => void): () => void {
    reportedApiErrorListeners.add(listener);
    return () => {
        reportedApiErrorListeners.delete(listener);
    };
}

/** The failures reported and not yet dismissed, oldest first. */
export function useApiErrors(): readonly ReportedApiError[] {
    return useSyncExternalStore(subscribeToApiErrors, readApiErrors, readApiErrors);
}
