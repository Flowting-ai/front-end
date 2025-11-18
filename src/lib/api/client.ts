"use client";

import { API_BASE_URL } from "@/lib/config";

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

  if (csrfToken) {
    headers.set("X-CSRFToken", csrfToken);
  }

  return fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
}
