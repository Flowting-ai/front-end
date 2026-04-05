/**
 * Normalizes `plan_type` from GET /users/me (and similar payloads).
 * Unknown or invalid values return null — never forward arbitrary strings as tiers.
 */

export type PlanTier = "starter" | "pro" | "power";

export function parsePlanTierFromApi(raw: unknown): PlanTier | null {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "starter" || normalized === "pro" || normalized === "power") {
    return normalized;
  }
  return null;
}
