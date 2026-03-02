"use client";

import { API_BASE_URL, TOKEN_REFRESH_ENDPOINT } from "@/lib/config";
import {
  getJwtToken,
  setJwtCookie,
  getRefreshToken,
  setRefreshToken,
} from "@/lib/jwt-utils";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

type ApiFetchOptions = RequestInit & { skipJson?: boolean };

// Mutex: prevent concurrent token refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(TOKEN_REFRESH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;

      const data = await res.json();
      if (data?.token) setJwtCookie(data.token);
      if (data?.refreshToken) setRefreshToken(data.refreshToken);
      return !!data?.token;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function doFetch(
  path: string,
  options: ApiFetchOptions,
  csrfToken?: string | null
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || undefined);

  if (
    options.method &&
    options.method.toUpperCase() !== "GET" &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const tokenToSend =
    csrfToken ||
    (options.method && options.method.toUpperCase() !== "GET"
      ? readCookie("csrftoken")
      : null);
  if (tokenToSend) headers.set("X-CSRFToken", tokenToSend);

  const jwtToken = getJwtToken();
  if (jwtToken) headers.set("Authorization", `Bearer ${jwtToken}`);

  return fetch(url, { credentials: "include", ...options, headers });
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  csrfToken?: string | null
): Promise<Response> {
  const response = await doFetch(path, options, csrfToken);

  if (response.status === 401) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      // Retry original request once with the new access token
      return doFetch(path, options, csrfToken);
    }
    // Refresh failed — session expired, signal the app to clear auth
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("auth:session-expired"));
    }
  }

  return response;
}
