/**
 * Pure helpers for money flows: typed action errors, a single-flight guard so a
 * double click never starts two checkouts, and backoff polling for the Stripe
 * webhook lag after a checkout return.
 */

export class BillingActionError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "BillingActionError";
    this.status = status;
  }
}

/** Reason text from a FastAPI-style error body, or the fallback. */
export function errorReason(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["detail", "error", "message"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}

export function billingErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Wraps an async action so concurrent calls share one in-flight promise.
 * The backend does not accept idempotency keys for checkout yet, so this is
 * the client's guard against double charges from repeated clicks.
 */
export function singleFlight<A extends unknown[], T>(fn: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return (...args: A) => {
    if (inFlight) return inFlight;
    inFlight = fn(...args).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}

/** Delays between checks after a checkout return: ~45 s in total. */
export const CHECKOUT_POLL_DELAYS_MS = [1000, 2000, 3000, 5000, 8000, 10000, 15000] as const;

export interface BillingFingerprintInput {
  planId?: string | null;
  totalCredits?: number | null;
  cancelAtPeriodEnd?: boolean | null;
  paymentSetupComplete?: boolean | null;
}

/** A compact key that changes when the webhook has applied a purchase. */
export function billingFingerprint(input: BillingFingerprintInput): string {
  return [
    input.planId ?? "",
    input.totalCredits ?? "",
    input.cancelAtPeriodEnd ? "1" : "0",
    input.paymentSetupComplete ? "1" : "0",
  ].join("|");
}

export type PollOutcome = "changed" | "timeout" | "aborted";

/**
 * Calls `check` after each delay until it returns a fingerprint different
 * from `initial`. Errors from `check` count as "not changed yet".
 */
export async function pollUntilChanged(options: {
  initial: string;
  check: () => Promise<string | null>;
  delays?: readonly number[];
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}): Promise<PollOutcome> {
  const { initial, check, delays = CHECKOUT_POLL_DELAYS_MS, signal } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  for (const ms of delays) {
    if (signal?.aborted) return "aborted";
    await sleep(ms);
    if (signal?.aborted) return "aborted";
    const next = await check().catch(() => null);
    if (next !== null && next !== initial) return "changed";
  }
  return signal?.aborted ? "aborted" : "timeout";
}
