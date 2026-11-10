import type { UserMeGate } from "@/lib/api/user-me-schema";
import { ONBOARDING_TEAM_WELCOME_ROUTE } from "@/lib/routes";

/**
 * Which onboarding step a signed-in user who may not use the app yet goes to. Pure: the proxy's
 * gate (lib/onboarding-gate.ts) and the client OnboardingGuard both use it, so they never disagree.
 */
export function determineNextOnboardingPath(root: UserMeGate): string {
  const onboarding: Record<string, unknown> = root.onboarding ?? root;

  const filled = (name: string, alt?: string): boolean => {
    const v = onboarding[name];
    if (typeof v === "string" && v.length > 0) return true;
    if (alt) {
      const v2 = onboarding[alt];
      return typeof v2 === "string" && v2.length > 0;
    }
    return false;
  };

  // v1.5 workspace-onboarding flow (docs-v1.5/onboarding-v1.5-flow.md), case
  // A1's 5 web-app steps:
  //   setup (no data written)              → choice screen only
  //   workspace (name + size)               → saves role_fit
  //   profile (first/last name + role)      → saves first_name/last_name via
  //                                            /users/me; user_role only if
  //                                            the optional role field is set
  //   invite (emails, optional)             → marks onboarding_completed
  // There is no account-type/plans/Stripe/tone/import step in this flow —
  // those belonged to the previous team-onboarding implementation.
  //
  // PENDING CONFIRMATION: `user_role` is optional at the profile step now, so
  // it can't gate "has this person finished profile" the way it used to.
  // first_name/last_name (top-level /users/me fields, not the onboarding
  // sub-object) are used instead. That's a real signal, but Auth0 can
  // auto-populate first_name to the account's email on some signups (see
  // auth-context.tsx's mapProfileToUser) — this function can't tell a real
  // name from that placeholder, so a user whose Auth0 profile happens to look
  // "filled" could be skipped past /onboarding/profile without ever seeing
  // it. Flagged, not silently assumed correct.
  //
  // Someone with no org and an invite waiting (signed up from Slack's Connect
  // link, never finished) accepts it first: the workspace step would otherwise
  // create them an org of their own, and then the invite can never be taken.
  if (typeof root.pending_invite_id === "string") return ONBOARDING_TEAM_WELCOME_ROUTE(root.pending_invite_id);
  if (!filled("role_fit", "roleFit")) return "/onboarding/setup";
  const firstName = root.first_name ?? "";
  const lastName = root.last_name ?? "";
  if (!(firstName.trim().length > 0 && lastName.trim().length > 0)) return "/onboarding/profile";
  return "/onboarding/invite";
}
