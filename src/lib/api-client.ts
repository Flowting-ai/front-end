/**
 * Secure API client — rate limiting, circuit breaker, retry, streaming.
 *
 * Rate limits:
 *   apiRateLimiter    100 req / 60 s
 *   uploadRateLimiter  10 req / 60 s
 *   chatRateLimiter    30 req / 60 s
 *
 * Circuit breaker:
 *   threshold 5 failures · reset window 30 s
 *   CLOSED → OPEN → HALF_OPEN → CLOSED
 *
 * Request queue:
 *   5 simultaneous requests maximum
 *
 * When the circuit is OPEN:
 *   - secureFetch rejects immediately with "Service temporarily unavailable"
 *   - apiCircuitBreaker.retryInMs exposes the countdown for UI banners
 */

import { throttle, exponentialBackoff, CircuitBreaker, RequestQueue } from "./throttle";
import { RateLimiter } from "./security";
import { logger } from "./logger";
import { getAuthHeaders } from "./jwt-utils";

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// ---------------------------------------------------------------------------
// Shared infrastructure (module-level singletons)
// ---------------------------------------------------------------------------

const apiRateLimiter = new RateLimiter(100, 60_000);
const uploadRateLimiter = new RateLimiter(10, 60_000);
const chatRateLimiter = new RateLimiter(30, 60_000);

export const apiCircuitBreaker = new CircuitBreaker(5, 30_000);

const requestQueue = new RequestQueue(5);

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * Enhanced fetch with auth headers, rate limiting, circuit breaker, and retries.
 *
 * - Selects the appropriate rate limiter based on URL / method.
 * - Wraps execution in the circuit breaker.
 * - Retries with exponential backoff (3 attempts, 1 s base delay).
 * - Adds a request timeout (default 30 s).
 */
export async function secureFetch<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeout = 30_000, retries = 3, retryDelay = 1_000, ...fetchOptions } = options;

  if (!url || typeof url !== "string") {
    throw new Error("Invalid URL provided");
  }

  const isUpload = fetchOptions.method === "POST" && fetchOptions.body instanceof FormData;
  const isChat = url.includes("/chat") || url.includes("/completion");

  const rateLimiter = isUpload ? uploadRateLimiter : isChat ? chatRateLimiter : apiRateLimiter;

  if (!rateLimiter.canProceed()) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  return apiCircuitBreaker.execute(async () => {
    return exponentialBackoff(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const authHeaders = getAuthHeaders();
          const headers = new Headers(fetchOptions.headers);
          for (const [key, val] of Object.entries(authHeaders)) {
            headers.set(key, val);
          }

          const response = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          return data as T;
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error) {
            if (error.name === "AbortError") {
              throw new Error("Request timeout");
            }
            logger.error("Fetch error:", { url, error: error.message });
          }

          throw error;
        }
      },
      retries,
      retryDelay,
    );
  });
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

/**
 * Throttled API call — prevents excessive calls from rapid user actions.
 * Queues execution through the shared RequestQueue (max 5 concurrent).
 */
export const throttledApiCall = throttle(async <T>(fn: () => Promise<T>): Promise<T> => {
  return requestQueue.add(fn);
}, 1_000);

/**
 * Secure POST — JSON body, credentials included.
 */
export async function securePost<T = unknown>(
  url: string,
  data: unknown,
  options: FetchOptions = {},
): Promise<T> {
  return secureFetch<T>(url, {
    ...options,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(data),
    credentials: "include",
  });
}

/**
 * Secure GET — credentials included.
 */
export async function secureGet<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  return secureFetch<T>(url, {
    ...options,
    method: "GET",
    credentials: "include",
  });
}

/**
 * Secure file upload — validates type and size (10 MB max) before sending.
 *
 * Allowed types: PNG, JPEG, GIF, PDF, DOC, DOCX, PPT, PPTX, CSV, XLS, XLSX
 */
export async function secureUpload<T = unknown>(
  url: string,
  file: File,
  options: FetchOptions = {},
): Promise<T> {
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("File too large. Maximum size is 10 MB.");
  }

  const ALLOWED_MIME_TYPES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(
      "Invalid file type. Allowed: PNG, JPEG, GIF, PDF, DOC, DOCX, PPT, PPTX, CSV, XLS, XLSX",
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  return secureFetch<T>(url, {
    ...options,
    method: "POST",
    headers: { ...options.headers },
    body: formData,
    credentials: "include",
  });
}

/**
 * Batch requests in chunks to avoid saturating the server.
 */
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  batchSize = 5,
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
  }

  return results;
}

/**
 * SSE stream handler with backpressure.
 *
 * Reads the response body line-by-line and calls onChunk for each non-empty line.
 * Releases the reader on completion or error to prevent connection pool exhaustion.
 */
export async function handleStream(
  url: string,
  options: RequestInit,
  onChunk: (chunk: string) => void,
  onError?: (error: Error) => void,
): Promise<void> {
  try {
    const authHeaders = getAuthHeaders();
    const headers = new Headers(options.headers);
    for (const [key, val] of Object.entries(authHeaders)) {
      headers.set(key, val);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    try {
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            onChunk(line);
          }
        }
      }

      if (buffer.trim()) {
        onChunk(buffer);
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  } catch (error) {
    logger.error("Stream error:", error);
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error;
  }
}
