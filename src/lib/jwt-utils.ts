/**
 * Utility functions for JWT token management
 */

/**
 * Get JWT token from localStorage
 */
export function getJwtToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
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

/**
 * Remove JWT token from localStorage
 */
export function removeJwtToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("token");
  }
}
