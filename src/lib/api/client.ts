"use client";

import { API_BASE_URL } from "@/lib/config";
import { getAuthHeaders, getAuth0AccessToken, getInMemoryAccessToken } from "@/lib/jwt-utils";

type ApiFetchOptions = RequestInit & { skipJson?: boolean };

async function doFetch(
  path: string,
  options: ApiFetchOptions
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

  const authHeaders = getAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  return fetch(url, { credentials: "include", ...options, headers });
}

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  // On page refresh the in-memory token is gone — fetch a fresh one before
  // making any API call so we don't fire a 401 on the first request.
  if (!getInMemoryAccessToken()) {
    await getAuth0AccessToken();
  }

  const response = await doFetch(path, options);

  if (response.status === 401 && typeof window !== "undefined") {
    // Attempt one silent token refresh before giving up
    const refreshedToken = await getAuth0AccessToken();
    if (refreshedToken) {
      const retryResponse = await doFetch(path, options);
      if (retryResponse.status !== 401) {
        return retryResponse;
      }
    }
    // Token refresh failed or retry still 401 — session is truly expired
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}
