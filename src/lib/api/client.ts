"use client";

import { API_BASE_URL } from "@/lib/config";
import { getAuthHeaders, getAuth0AccessToken, ensureFreshToken } from "@/lib/jwt-utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ApiFetchOptions = RequestInit & {
  /** Skip JSON parsing — returns the raw Response. */
  skipJson?: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------------------------------------------------------------------------
// User-friendly error mapping
// ---------------------------------------------------------------------------

/**
 * Map raw API / backend error text to a user-readable message.
 * Falls back to the original string when no pattern matches.
 */
export function friendlyApiError(raw: string, statusCode?: number): string {
  const lower = raw.toLowerCase();

  if (statusCode === 401 || lower.includes("token expired") || lower.includes("token_expired")) {
    return "Your session has expired. Please sign in again.";
  }
  if (lower.includes("not authenticated") || lower.includes("unauthorized")) {
    return "You're not signed in. Please log in and try again.";
  }
  if (lower.includes("forbidden") || statusCode === 403) {
    return "You don't have permission to perform this action.";
  }
  if (statusCode === 429 || lower.includes("rate limit") || lower.includes("too many requests")) {
    return "You're sending requests too quickly. Please wait a moment and try again.";
  }
  if (lower.includes("quota") || lower.includes("budget") || lower.includes("limit exceeded")) {
    return "You've reached your usage limit. Check your plan or try again later.";
  }
  if (statusCode !== undefined && statusCode >= 500) {
    return "Something went wrong on our end. Please try again in a moment.";
  }
  if (lower.includes("fetch") && lower.includes("failed")) {
    return "Unable to reach the server. Please check your connection and try again.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return "The request took too long. Please try again.";
  }
  if (lower.includes("model not found") || lower.includes("model_not_found")) {
    return "The selected AI model is currently unavailable. Please choose a different model.";
  }
  if (
    lower.includes("context length") ||
    lower.includes("too long") ||
    lower.includes("max tokens")
  ) {
    return "Your message is too long for this model. Try shortening it or starting a new chat.";
  }
  if (lower.includes("content filter") || lower.includes("content_filter")) {
    return "Your message was flagged by the content filter. Please rephrase and try again.";
  }
  if (statusCode === 422 || lower.includes("validation error")) {
    return "Something was wrong with the request. Please check your input and try again.";
  }
  if (statusCode === 404) {
    return "The requested resource was not found.";
  }

  // Long JSON blobs or stack traces → generic message
  if (raw.length > 300 || raw.startsWith("{") || raw.startsWith("<")) {
    return "Something went wrong. Please try again.";
  }

  return raw;
}

// ---------------------------------------------------------------------------
// Internal fetch
// ---------------------------------------------------------------------------

async function doFetch(path: string, options: ApiFetchOptions): Promise<Response> {
  // Resolve URL:
  //   - Absolute URLs pass through unchanged.
  //   - Same-origin Next.js routes (/api/…) use window.location.origin.
  //   - Everything else is prefixed with API_BASE_URL.
  const url = path.startsWith("http")
    ? path
    : path.startsWith("/api/")
      ? `${typeof window !== "undefined" ? window.location.origin : ""}${path}`
      : `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers ?? undefined);

  // Auto-set Content-Type for JSON bodies (skip for FormData — browser sets multipart boundary).
  if (
    options.method &&
    options.method.toUpperCase() !== "GET" &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // Inject current Auth0 Bearer token.
  const authHeaders = getAuthHeaders();
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  return fetch(url, { credentials: "include", ...options, headers });
}

// ---------------------------------------------------------------------------
// Public apiFetch
// ---------------------------------------------------------------------------

/**
 * Authenticated fetch for all API calls.
 *
 * Behaviors:
 *  1. Ensures a fresh Auth0 token before every call (handles idle-tab expiry).
 *  2. On 401 → attempts one silent token refresh and retries.
 *  3. On second 401 → dispatches "auth:session-expired" and shows a toast,
 *     then returns the 401 response so callers can handle it.
 *  4. All other non-2xx responses are returned as-is (callers throw ApiError).
 *
 * Throws ApiError for non-2xx responses when the caller uses the JSON helper
 * wrappers (apiFetchJson). Raw-response callers (streaming) handle status
 * themselves.
 */
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  await ensureFreshToken();

  const response = await doFetch(path, options);

  if (response.status === 401 && typeof window !== "undefined") {
    const refreshedToken = await getAuth0AccessToken();
    if (refreshedToken) {
      const retryResponse = await doFetch(path, options);
      if (retryResponse.status !== 401) {
        return retryResponse;
      }
    }

    // Token refresh failed — session is truly expired.
    console.error("[apiFetch] session expired (401)");
    toast.error("Session expired", { description: "Signing you out…" });
    window.dispatchEvent(new Event("auth:session-expired"));
  }

  return response;
}

// ---------------------------------------------------------------------------
// JSON helper — throws typed ApiError on non-2xx
// ---------------------------------------------------------------------------

/**
 * apiFetch + automatic JSON parsing + typed ApiError on failure.
 *
 * Use this for all non-streaming calls. Streaming callers use apiFetch
 * directly and consume the ReadableStream themselves.
 */
export async function apiFetchJson<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);

  if (!response.ok) {
    let code = "api_error";
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.clone().json()) as {
        error?: string;
        code?: string;
        message?: string;
      };
      code = body.code ?? code;
      message = body.message ?? body.error ?? message;
    } catch {
      // non-JSON error body — keep defaults
    }
    throw new ApiError(
      response.status,
      code,
      friendlyApiError(message, response.status),
    );
  }

  return response.json() as Promise<T>;
}
