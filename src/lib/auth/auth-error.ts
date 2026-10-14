/**
 * Is this thrown error a lost session rather than a bug? Route error boundaries
 * use it to offer "Sign in again" instead of "Something went wrong".
 * Matches an ApiError-like 401, and Auth0's `login_required` / expired-token errors.
 */
export function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const { status, code, message } = error as { status?: unknown; code?: unknown; message?: unknown }
  if (status === 401) return true
  if (code === 'login_required' || code === 'unauthorized' || code === 'invalid_token') return true
  return typeof message === 'string' && /login_required|session (has )?expired|token (has )?expired/i.test(message)
}

/** The login URL that brings the user back to where the error happened. */
export function loginUrlFor(loginRoute: string, path: string): string {
  return `${loginRoute}?returnTo=${encodeURIComponent(path || '/')}`
}
