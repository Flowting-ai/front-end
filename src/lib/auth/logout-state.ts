/**
 * Whether this tab has started logging out.
 *
 * Logging out is a full-page navigation through /auth/logout to Auth0's logout
 * endpoint and back to /auth/login. Until the browser leaves the page, the app is
 * still running: the cleared session makes in-flight API calls and the token
 * refresh fail with 401, which fires "auth:session-expired" and sends guards to
 * the login page. Any of those navigations replaces the one still on its way to
 * Auth0, so the Auth0 session is never ended and /auth/login signs the user
 * straight back in. While this flag is set, those paths stand down.
 *
 * Lives on its own (not in auth-context) so lib/api/client can read it without a
 * circular import. It is never reset: the page is about to unload.
 */
let loggingOut = false;

export function markLoggingOut(): void {
  loggingOut = true;
}

export function isLoggingOut(): boolean {
  return loggingOut;
}

/**
 * A request made while logging out would carry the old session cookie, and its
 * response re-sets that cookie (the session is rolling) after /auth/logout cleared
 * it. Callers return this instead of making the request: it never settles, and the
 * page unloads moments later.
 */
export function pendingForever<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

/** Send the browser to login, unless a logout is already taking it there through Auth0. */
export function redirectToLogin(loginRoute: string): void {
  if (loggingOut) return;
  window.location.href = loginRoute;
}
