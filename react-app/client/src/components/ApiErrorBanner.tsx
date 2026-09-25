import { dismissApiError, useApiErrors } from '@/hooks/apiErrors/useApiErrors';

/** Every API failure reported and not yet dismissed, one line each, above the page. Renders nothing while there is none. */
export function ApiErrorBanner() {
    const apiErrors = useApiErrors();
    if (apiErrors.length === 0) return null;

    return (
        <div className="flex flex-col gap-1 border-b border-red-200 bg-red-50 px-4 py-2">
            {apiErrors.map((apiError) => (
                <p key={apiError.id} role="alert" className="flex items-start justify-between gap-4 text-sm text-red-800">
                    <span>
                        {apiError.message}
                        <span className="text-red-500"> ({apiError.endpoint}{apiError.status > 0 ? `, ${apiError.status}` : ''})</span>
                    </span>
                    <button type="button" onClick={() => dismissApiError(apiError.id)} className="shrink-0 rounded px-2 text-xs font-medium text-red-700 hover:bg-red-100">
                        Dismiss
                    </button>
                </p>
            ))}
        </div>
    );
}
