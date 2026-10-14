/**
 * Pure helpers for the compare modal's per-model streams
 * (components/compare/CompareModels.tsx). Kept out of the component so they
 * can be unit-tested in Node.
 */

type Payload = Record<string, unknown>

/** The model a stream event belongs to (`model_id` or `modelId`), or null. */
export function resolveModelId(payload: Payload): string | null {
  const raw = payload.model_id ?? payload.modelId ?? null
  if (raw === null || raw === undefined) return null
  const resolved = String(raw).trim()
  return resolved.length > 0 ? resolved : null
}

/** Credits charged for a run, from whichever field the `done` event uses. */
export function extractCredits(payload: Payload): number | null {
  for (const key of ["credits_used", "creditsUsed", "credits", "cost"]) {
    if (typeof payload[key] === "number") return payload[key] as number
  }
  const usage = payload.usage
  if (usage && typeof usage === "object") {
    const u = usage as Payload
    if (typeof u.total_cost === "number") return u.total_cost
    if (typeof u.cost === "number") return u.cost
  }
  return null
}

/** Message for a model request that failed before streaming began. */
export function httpErrorMessage(status: number): string {
  if (status === 402) return "Not enough credits to run this model."
  if (status === 429) return "Too many requests. Wait a moment and retry."
  if (status >= 500) return `The model service failed (${status}). Retry in a moment.`
  return `Request failed (${status}).`
}

export const NETWORK_ERROR_MESSAGE = "Couldn't reach the model. Check your connection and retry."

/** Returns `map` without `key`, or `map` itself when the key is absent. */
export function omitKey<T>(map: Record<string, T>, key: string): Record<string, T> {
  if (!(key in map)) return map
  const next = { ...map }
  delete next[key]
  return next
}
