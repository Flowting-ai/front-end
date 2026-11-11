import { z } from "zod";
import { ApiError } from "@/lib/api/client";

/**
 * Shared React Query policy: how long data stays fresh, which failures are
 * retried, and how long to wait between tries. createQueryClient() installs
 * these as defaults, so feature hooks only override staleTime when they need a
 * different tier.
 */

/** Data that must reflect the server right now (credit balance, a running schedule). */
export const STALE_REALTIME_MS = 0;
/** Matches the ~30 s TTL the old module caches in src/lib/api/*.ts used. */
export const STALE_DEFAULT_MS = 30_000;
/** Data that rarely changes in a session (model catalogue, plan catalogue). */
export const STALE_STATIC_MS = 5 * 60_000;

/** Total tries after the first failure. One retry; apiClient already handles 401 refresh. */
const MAX_QUERY_RETRIES = 1;
const MAX_RETRY_DELAY_MS = 10_000;

/** A response that failed schema validation. Never retried: the same bytes come back. */
export class ResponseShapeError extends Error {
  constructor(public readonly what: string, public readonly issues: z.core.$ZodIssue[]) {
    super(`Unexpected ${what} response`);
    this.name = "ResponseShapeError";
  }
}

/** Should a query retry after this failure? Only transient failures are worth it. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  if (error instanceof ResponseShapeError || error instanceof z.ZodError) return false;
  if (error instanceof ApiError) return error.retryable;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  // fetch() rejects with TypeError on network failure: worth one more try.
  return error instanceof TypeError;
}

/** Delay before retry `attempt` (0-based). Honors Retry-After, else exponential backoff with jitter. */
export function queryRetryDelay(attempt: number, error: unknown, random: () => number = Math.random): number {
  if (error instanceof ApiError && error.retryAfterSeconds) {
    return Math.min(error.retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
  }
  const base = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.round(base / 2 + random() * (base / 2));
}

/** Validate a response inside a queryFn; a mismatch becomes a non-retried ResponseShapeError. */
export function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, what: string): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ResponseShapeError(what, parsed.error.issues);
  return parsed.data;
}
