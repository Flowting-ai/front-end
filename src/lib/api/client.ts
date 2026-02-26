"use client";

import { API_BASE_URL } from "@/lib/config";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get JWT token from localStorage
 */
function getJwtToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

type ApiFetchOptions = RequestInit & { skipJson?: boolean };

export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {},
  csrfToken?: string | null
) {
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

  // Add JWT token to Authorization header if available
  const jwtToken = getJwtToken();
  if (jwtToken) {
    headers.set("Authorization", `Bearer ${jwtToken}`);
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}
