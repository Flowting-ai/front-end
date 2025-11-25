"use client";

import { API_BASE_URL } from "@/lib/config";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
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

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}
