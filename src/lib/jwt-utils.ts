/**
 * JWT token management via cookies.
 * Cookies persist across refreshes and new tabs without hydration race conditions.
 */

const JWT_COOKIE_NAME = "jwt";
const JWT_MAX_AGE_DAYS = 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get JWT token from cookie
 */
export function getJwtToken(): string | null {
  return readCookie(JWT_COOKIE_NAME);
}

/**
 * Set JWT token as a cookie
 */
export function setJwtCookie(token: string): void {
  if (typeof document === "undefined") return;
  const maxAge = JWT_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${JWT_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

/**
 * Remove JWT token cookie
 */
export function removeJwtCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${JWT_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
}

/**
 * Get authorization headers with JWT token
 */
export function getAuthHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
  const jwtToken = getJwtToken();
  const headers: Record<string, string> = { ...additionalHeaders };

  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  return headers;
}
