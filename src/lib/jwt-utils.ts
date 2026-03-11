/**
 * Auth utilities — ready for Auth0 integration.
 *
 * TODO: When @auth0/nextjs-auth0 is installed:
 *   1. Remove this file.
 *   2. Use `useAuth0()` in components to get `getAccessTokenSilently`.
 *   3. Replace `getAuthHeaders()` calls with Auth0's access token retrieval.
 */

/**
 * Returns Authorization headers for API requests.
 * Replace this implementation with Auth0's access token when integrating:
 *
 *   const { getAccessTokenSilently } = useAuth0();
 *   const token = await getAccessTokenSilently();
 *   return { Authorization: `Bearer ${token}`, ...additionalHeaders };
 */
export function getAuthHeaders(
  additionalHeaders: Record<string, string> = {}
): Record<string, string> {
  // TODO: Populate with Auth0 access token.
  return { ...additionalHeaders };
}
