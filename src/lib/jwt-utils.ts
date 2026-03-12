/**
 * Auth helpers for retrieving Auth0 access tokens and attaching Bearer headers.
 * The access token is held in-memory for the lifetime of the tab.
 */

import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { audience } from "@/lib/config";

let inMemoryAccessToken: string | null = null;

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearInMemoryAccessToken(): void {
  inMemoryAccessToken = null;
}

/**
 * Request an Auth0 access token for the configured audience.
 * Also updates the in-memory token cache.
 */
export async function getAuth0AccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const token = audience
      ? await getAccessToken({ audience })
      : await getAccessToken();

    const normalized = typeof token === "string" && token.length > 0 ? token : null;
    setInMemoryAccessToken(normalized);
    return normalized;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to fetch Auth0 access token", error);
    }
    setInMemoryAccessToken(null);
    return null;
  }
}

/**
 * Build auth headers for API requests.
 *
 * Must be synchronous because it is used widely across the app.
 */
export function getAuthHeaders(
  additionalHeaders: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };

  if (inMemoryAccessToken) {
    headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }

  return headers;
}
