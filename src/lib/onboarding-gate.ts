import { auth0 } from "@/lib/auth0";
import { userMeRootAllowsMainApp } from "@/lib/onboarding-access";
import { parseUserMeGate, type UserMeGate } from "@/lib/api/user-me-schema";
import { ONBOARDING_TEAM_WELCOME_ROUTE } from "@/lib/routes";
import { logger } from "@/lib/logger";

/**
 * The proxy's onboarding gate: reads GET /users/me with the session's token
 * and decides whether the user may use the app or which onboarding step is
 * next. Routing (which paths are exempt) stays in proxy.ts.
 */

export type OnboardingGate = {
  allowsMainApp: boolean;
  nextPath: string;
};

export type OnboardingStateResult = {
  data: OnboardingGate | null;
  requiresReauth: boolean;
};

const apiBaseUrl = process.env.SERVER_URL?.replace(/\/+$/, "");
const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined;
let lastGateFailureLogAt = 0;

const ONBOARDING_ENDPOINT_PATH = "/users/me";
// Every navigation waits on this call, so a slow backend must not stall the app.
const ONBOARDING_FETCH_TIMEOUT_MS = 3_000;

/**
 * Failure policy: fail OPEN. When /users/me errors or times out, the request
 * goes through without the onboarding redirect. The gate only steers people to
 * the right onboarding step; the backend authorizes every call itself, so
 * failing closed would lock every user out during a backend blip for no
 * security gain. A missing or rejected token still sends the user to login.
 */
function logGateFailure(reason: string, detail?: unknown): void {
  // At most one line a minute per server instance, so an outage cannot flood logs.
  if (Date.now() - lastGateFailureLogAt < 60_000) return;
  lastGateFailureLogAt = Date.now();
  const message = detail instanceof Error ? detail.message : detail === undefined ? "" : String(detail);
  logger.event("onboarding_gate_failed", { reason, message });
}

/**
 * Positive onboarding-gate cache, keyed by Auth0 `sub`.
 *
 * Without it, `fetchOnboardingState()` issued one uncached GET /users/me for
 * *every* request the matcher accepts — including every RSC payload request, so
 * each `<Link>` Next.js prefetches on hover/viewport cost a backend round-trip.
 * Hovering a sidebar full of links produced dozens of identical calls.
 *
 * Only `allowsMainApp === true` is cached, deliberately: "onboarded" is
 * monotonic (an account never un-onboards), so a hit can never wrongly let
 * someone through or wrongly bounce them. The un-onboarded state is *not*
 * cached, because it changes mid-flow — a user who just submitted the import
 * step navigates immediately and must be re-read, or they would be bounced back
 * into onboarding. Un-onboarded users therefore still pay one call per request,
 * but that is a handful of pages, not the steady-state app.
 */
const ONBOARDED_TTL = 60_000;
const onboardedCache = new Map<string, number>();

export function isOnboardedCached(sub: string | null): boolean {
  if (!sub) return false;
  const at = onboardedCache.get(sub);
  if (at === undefined) return false;
  if (Date.now() - at >= ONBOARDED_TTL) {
    onboardedCache.delete(sub);
    return false;
  }
  return true;
}

export function rememberOnboarded(sub: string | null): void {
  if (!sub) return;
  // Bound the map so a long-lived server process cannot grow it without limit.
  if (onboardedCache.size > 500) onboardedCache.clear();
  onboardedCache.set(sub, Date.now());
}

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

  // v1.5 workspace-onboarding flow (docs v1.5/onboarding-v1.5-flow.md), case
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

export async function fetchOnboardingState(): Promise<OnboardingStateResult> {
  try {
    if (!apiBaseUrl) return { data: null, requiresReauth: false };
    const { token } = await auth0.getAccessToken({ audience });
    if (!token) return { data: null, requiresReauth: true };

    const response = await fetch(`${apiBaseUrl}${ONBOARDING_ENDPOINT_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ONBOARDING_FETCH_TIMEOUT_MS),
    });

    if (response.status === 401) {
      return { data: null, requiresReauth: true };
    }
    if (!response.ok) {
      logGateFailure("http_status", response.status);
      return { data: null, requiresReauth: false };
    }

    const root = parseUserMeGate(await response.json());

    return {
      data: {
        allowsMainApp: userMeRootAllowsMainApp(root),
        nextPath: determineNextOnboardingPath(root),
      },
      requiresReauth: false,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "missing_session" || code === "missing_refresh_token") {
      return { data: null, requiresReauth: true };
    }

    logGateFailure(
      error instanceof Error && error.name === "TimeoutError" ? "timeout" : "fetch_error",
      error,
    );
    return { data: null, requiresReauth: false };
  }
}
