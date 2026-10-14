import { z } from "zod";

/**
 * GET /users/me has been seen in three envelopes: `{ data: {...} }`,
 * `{ user: {...} }` and the bare profile. Returns the profile object, or `{}`.
 * Shared by the proxy's onboarding gate and the client's profile normalizer so
 * the two cannot disagree on which object is the user.
 */
export function unwrapUserMe(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const payload = raw as Record<string, unknown>;
  for (const inner of [payload.data, payload.user]) {
    if (inner && typeof inner === "object") return inner as Record<string, unknown>;
  }
  return payload;
}

// A wrong type on one field becomes null instead of failing the whole gate.
const text = z.string().nullish().catch(null);

/**
 * The fields the onboarding gate reads. Loose: everything else passes through
 * untouched for `userMeRootAllowsMainApp`, which reads plan and subscription.
 */
export const userMeGateSchema = z.looseObject({
  first_name: text,
  last_name: text,
  pending_invite_id: text,
  role_fit: text,
  roleFit: text,
  onboarding: z.looseObject({}).nullish().catch(null),
});

export type UserMeGate = z.infer<typeof userMeGateSchema>;

export function parseUserMeGate(raw: unknown): UserMeGate {
  return userMeGateSchema.parse(unwrapUserMe(raw));
}
