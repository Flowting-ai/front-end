/**
 * Pure helpers for the Enhance prompt flow: how a backend failure should be
 * handled, and the analytics outcome/latency vocabulary.
 */

export type EnhanceFailure = "aborted" | "credits" | "error";

/** Credit exhaustion shows the billing message; an abort is silent; anything else falls back to the local check. */
export function classifyEnhanceFailure(error: unknown): EnhanceFailure {
  if (error && typeof error === "object") {
    const record = error as { name?: unknown; status?: unknown; message?: unknown };
    if (record.name === "AbortError") return "aborted";
    if (record.status === 402) return "credits";
    if (typeof record.message === "string" && /insufficient credits|out of credits/i.test(record.message)) return "credits";
  }
  return "error";
}

export type EnhanceOutcome =
  | "applied"
  | "discarded"
  | "closed"
  | "fallback_local"
  | "timeout"
  | "credits_exhausted";

export type LatencyBucket = "lt_2s" | "2_5s" | "5_15s" | "15_45s" | "gt_45s";

export function latencyBucket(ms: number): LatencyBucket {
  if (ms < 2_000) return "lt_2s";
  if (ms < 5_000) return "2_5s";
  if (ms < 15_000) return "5_15s";
  if (ms < 45_000) return "15_45s";
  return "gt_45s";
}

/** Props for the `prompt_enhance_outcome` event: enums and counts only, never prompt text. */
export function enhanceOutcomeProps(input: {
  outcome: EnhanceOutcome;
  source: "backend" | "local";
  startedAt: number | null;
  now: number;
  questionsAnswered: number;
}): Record<string, string | number> {
  return {
    outcome: input.outcome,
    source: input.source,
    latency: input.startedAt === null ? "lt_2s" : latencyBucket(Math.max(0, input.now - input.startedAt)),
    questions_answered: input.questionsAnswered,
  };
}
