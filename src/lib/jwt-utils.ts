import { getAccessToken } from "@auth0/nextjs-auth0/client";
import { audience } from "@/lib/config";

let inMemoryAccessToken: string | null = null;
let tokenExpiresAt: number | null = null;

const EXPIRY_BUFFER_SECONDS = 60;

function parseTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
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
