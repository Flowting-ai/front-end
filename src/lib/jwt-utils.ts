import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { audience } from "@/lib/config";

let inMemoryAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;
// Deduplicates concurrent token fetches: all callers that arrive while a
// request is in-flight share the same Promise instead of hammering Auth0.
let _tokenFetchPromise: Promise<string | null> | null = null;

const EXPIRY_BUFFER_SECONDS = 60;

/**
 * Decode a JWT's payload. JWTs use base64url (`-`, `_`, no padding), which
 * `atob` rejects, and claims may hold UTF-8 (names), which `atob` alone mangles.
 * No signature check: the token came from our own session.
 */
export function decodeJwtPayload(token: string | null): Record<string, unknown> | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return decoded && typeof decoded === "object" ? (decoded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function parseTokenExpiry(token: string): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === "number" ? exp : null;
}

/**
 * Decode the `sub` (subject) claim from a JWT access token — the Auth0 user id
 * (e.g. "auth0|abc123"). This is the same value the backend uses as `auth0_id`, and
 * `GET /users/me` does NOT currently return it, so analytics derives identity here.
 */
export function decodeJwtSub(token: string | null): string | null {
  const sub = decodeJwtPayload(token)?.sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

export function setInMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
  tokenExpiresAt = token ? parseTokenExpiry(token) : null;
}

export function getInMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearInMemoryAccessToken(): void {
  inMemoryAccessToken = null;
  tokenExpiresAt = null;
}

export function isTokenExpiringSoon(): boolean {
  if (!inMemoryAccessToken || tokenExpiresAt === null) return true;
  return Math.floor(Date.now() / 1000) >= tokenExpiresAt - EXPIRY_BUFFER_SECONDS;
}

/** Milliseconds until the token enters the expiry buffer; 0 when already there or unknown. */
export function msUntilTokenRefresh(): number {
  if (!inMemoryAccessToken || tokenExpiresAt === null) return 0;
  return Math.max(0, (tokenExpiresAt - EXPIRY_BUFFER_SECONDS) * 1000 - Date.now());
}

export async function getAuth0AccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (_tokenFetchPromise) return _tokenFetchPromise;

  _tokenFetchPromise = (async () => {
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
    } finally {
      _tokenFetchPromise = null;
    }
  })();

  return _tokenFetchPromise;
}

export async function ensureFreshToken(): Promise<string | null> {
  if (isTokenExpiringSoon()) {
    return getAuth0AccessToken();
  }
  return inMemoryAccessToken;
}

export function getAuthHeaders(
  additionalHeaders: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...additionalHeaders };
  if (inMemoryAccessToken) {
    headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return headers;
}
