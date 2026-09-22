/**
 * What went wrong, in words. Anything can be thrown (an Error, a NetSuite error object, a string), and a log line
 * or a status wants one message out of it.
 */

/** The message of an Error or of any object that carries one; the text of anything else that was thrown. */
export function describeErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
    return String(error);
}
