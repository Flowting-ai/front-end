"use client";

import { API_BASE_URL } from "@/lib/config";
import { getAuthHeaders, getAuth0AccessToken, ensureFreshToken } from "@/lib/jwt-utils";
import { toast } from "@/lib/toast-helper";
import { reportSessionExpired, reportApiFailure } from "@/lib/error-reporter";

type ApiFetchOptions = RequestInit & { skipJson?: boolean };

/**
 * Map raw API / backend error text to a user-friendly message.
 * Keeps the original as a fallback but intercepts common patterns.
 */
export function friendlyApiError(
  raw: string,
  statusCode?: number,
): string {
  const lower = raw.toLowerCase();

  // Auth / token errors
  if (statusCode === 401 || lower.includes("token expired") || lower.includes("token_expired")) {
    return "Your session has expired. Please sign in again.";
  }
  if (lower.includes("not authenticated") || lower.includes("unauthorized")) {
    return "You're not signed in. Please log in and try again.";
  }
  if (lower.includes("forbidden") || statusCode === 403) {
    return "You don't have permission to perform this action.";
  }

  // Rate limiting
  if (statusCode === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "You're sending requests too quickly. Please wait a moment and try again.";
  }

  // Quota / billing
  if (lower.includes("quota") || lower.includes("budget") || lower.includes("limit exceeded")) {
    return "You've reached your usage limit. Check your plan or try again later.";
  }

  // Server errors
  if (statusCode !== undefined && statusCode >= 500) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  // Network / connectivity
  if (lower.includes("fetch") && lower.includes("failed")) {
    return "Unable to reach the server. Please check your connection and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return "The request took too long. Please try again.";
  }

  // Model / AI specific
  if (lower.includes("model not found") || lower.includes("model_not_found")) {
    return "The selected AI model is currently unavailable. Please choose a different model.";
  }
  if (lower.includes("context length") || lower.includes("too long") || lower.includes("max tokens")) {
    return "Your message is too long for this model. Try shortening it or starting a new chat.";
  }
  if (lower.includes("content filter") || lower.includes("content_filter")) {
    return "Your message was flagged by the content filter. Please rephrase and try again.";
  }

  // Validation
  if (statusCode === 422 || lower.includes("validation error")) {
    return "Something was wrong with the request. Please check your input and try again.";
  }

  // Not found
  if (statusCode === 404) {
    return "The requested resource was not found.";
  }

  // Generic fallback — if the raw message is a long JSON blob or stack trace,
  // replace it with something readable.
  if (raw.length > 300 || raw.startsWith("{") || raw.startsWith("<")) {
    return "Something went wrong. Please try again.";
  }

  return raw;
}

async function doFetch(
  path: string,
  options: ApiFetchOptions
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : path.startsWith("/api/")
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${path}`
      : `${API_BASE_URL}${path}`;
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
  // Ensure the token is fresh before every API call — this handles both
  // the initial page-refresh case (no token) and the idle-tab case (expired token).
  await ensureFreshToken();

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
    reportSessionExpired("apiFetch", 401);
    toast.error("Session expired", {
      description: "Signing you out\u2026",
    });
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}
