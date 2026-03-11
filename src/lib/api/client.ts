"use client";

import { API_BASE_URL } from "@/lib/config";
import { getAuthHeaders } from "@/lib/jwt-utils";

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

  // TODO: Once Auth0 is wired, getAuthHeaders() will inject { Authorization: "Bearer <token>" }
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
  const response = await doFetch(path, options);

  if (response.status === 401 && typeof window !== "undefined") {
    // Auth0 handles token refresh automatically via silent authentication.
    // Dispatch the session-expired event so the app can redirect to login.
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}
