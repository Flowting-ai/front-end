import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { userMeRootAllowsMainApp } from "@/lib/onboarding-access";
import {
  ORG_GENERAL_ROUTE,
  AUTH_LOGIN_ROUTE,
  ONBOARDING_PRICING_ROUTE,
  ONBOARDING_BASE_ROUTE,
  ONBOARDING_TEAM_BASE_ROUTE,
  SETTINGS_BILLING_CONFIRMATION_ROUTE,
  TEAM_INVITE_BASE_ROUTE,
  INVITE_LANDING_BASE_ROUTE,
  ROOT_ROUTE,
} from "@/lib/routes";

type OnboardingGate = {
  allowsMainApp: boolean;
  nextPath: string;
};

type OnboardingStateResult = {
  data: OnboardingGate | null;
  requiresReauth: boolean;
};

const apiBaseUrl = process.env.SERVER_URL?.replace(/\/+$/, "");
const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined;
let hasLoggedOnboardingFetchFailure = false;

const ONBOARDING_ENDPOINT_PATH = "/users/me";

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

function isOnboardedCached(sub: string | null): boolean {
  if (!sub) return false;
  const at = onboardedCache.get(sub);
  if (at === undefined) return false;
  if (Date.now() - at >= ONBOARDED_TTL) {
    onboardedCache.delete(sub);
    return false;
  }
  return true;
}

function rememberOnboarded(sub: string | null): void {
  if (!sub) return;
  // Bound the map so a long-lived server process cannot grow it without limit.
  if (onboardedCache.size > 500) onboardedCache.clear();
  onboardedCache.set(sub, Date.now());
}

function determineNextOnboardingPath(root: Record<string, unknown>): string {
  const onboarding =
    root.onboarding && typeof root.onboarding === "object"
      ? (root.onboarding as Record<string, unknown>)
      : root;

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
  if (!filled("role_fit", "roleFit")) return "/onboarding/setup";
  const firstName = typeof root.first_name === "string" ? root.first_name : "";
  const lastName = typeof root.last_name === "string" ? root.last_name : "";
  if (!(firstName.trim().length > 0 && lastName.trim().length > 0)) return "/onboarding/profile";
  return "/onboarding/invite";
}

async function fetchOnboardingState(): Promise<OnboardingStateResult> {
  try {
    if (!apiBaseUrl) return { data: null, requiresReauth: false };
    const { token } = await auth0.getAccessToken({ audience });
    if (!token) return { data: null, requiresReauth: true };

    const response = await fetch(`${apiBaseUrl}${ONBOARDING_ENDPOINT_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (response.status === 401) {
      return { data: null, requiresReauth: true };
    }
    if (!response.ok) return { data: null, requiresReauth: false };

    const data = (await response.json()) as Record<string, unknown>;
    const root = (
      data.data && typeof data.data === "object"
        ? data.data
        : data.user && typeof data.user === "object"
          ? data.user
          : data
    ) as Record<string, unknown>;

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

    if (!hasLoggedOnboardingFetchFailure) {
      hasLoggedOnboardingFetchFailure = true;
      console.warn("Failed to fetch onboarding state", error);
    }
    return { data: null, requiresReauth: false };
  }
}

export default async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url);

  // Component verification harnesses render fixtures only and must stay
  // reachable without a session while developing. Never in production.
  if (
    process.env.NODE_ENV !== "production" &&
    (pathname === "/reasoning-verify" || pathname === "/brain-verify")
  ) {
    return NextResponse.next();
  }

  // The organization security page was removed. Redirect before Auth0/session
  // handling so stale client links and logged-out bookmarks cannot preserve
  // /org/security as a post-login return path.
  if (pathname === "/org/security" || pathname.startsWith("/org/security/")) {
    return NextResponse.redirect(new URL(ORG_GENERAL_ROUTE, request.url));
  }

  // Auth0 handles its own routes - never block /auth/*. The v4 SDK middleware
  // serves /auth/access-token natively (handleAccessToken): it reads the
  // `audience` query param the client sends and responds with the { token }
  // shape `getAccessToken` expects, plus a JSON 401 when there is no session.
  // We serve it here through the SDK rather than bypassing to a custom route
  // handler — bypassing relied on App Router resolving the static
  // /auth/access-token segment, which 404s and breaks client token fetches.
  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  // API routes must never be blocked by the onboarding guard
  if (pathname.startsWith("/api/")) {
    return await auth0.middleware(request);
  }

  // B1/B2 pre-login invite landing (/invite/<id>) is deliberately public — it
  // IS the "decide sign in vs sign up" screen for a logged-out invitee, so it
  // must be reachable before any session check runs. Its own Sign in/Sign up
  // buttons are what send the visitor into /auth/login.
  if (pathname.startsWith(`${INVITE_LANDING_BASE_ROUTE}/`)) {
    return NextResponse.next();
  }

  // Pass the request explicitly so the SDK reads cookies from the incoming
  // request rather than falling back to next/headers (which behaves differently
  // in the proxy runtime vs. App Router route handlers).
  const session = await auth0.getSession(request);

  // Authentication must be decided before any route-specific pass-through.
  // In particular, the team invite landing page forwards to
  // /onboarding/team/<inviteId>. If onboarding is allowed through first, a
  // logged-out invitee reaches the client loader and its protected API call
  // instead of Auth0.
  if (!session) {
    const loginUrl = new URL(AUTH_LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set("returnTo", pathname || ROOT_ROUTE);
    return Response.redirect(loginUrl);
  }

  const sub = typeof session.user?.sub === "string" ? session.user.sub : null;

  // Already known to be onboarded — substitute the cached gate instead of
  // re-fetching /users/me. `nextPath` is only read when !hasOnboarded, so the
  // placeholder is never consulted on this path, and every decision below runs
  // exactly as it would have with a live fetch.
  const onboardedFromCache = isOnboardedCached(sub);
  const onboardingResult: OnboardingStateResult = onboardedFromCache
    ? { data: { allowsMainApp: true, nextPath: ROOT_ROUTE }, requiresReauth: false }
    : await fetchOnboardingState();
  if (!onboardedFromCache && onboardingResult.data?.allowsMainApp === true) {
    rememberOnboarded(sub);
  }

  const onboarding = onboardingResult.data;
  const hasOnboarded = onboarding?.allowsMainApp === true;
  const hasKnownOnboardingState = onboarding !== null;
  const isPricingPage = pathname.startsWith(ONBOARDING_PRICING_ROUTE);
  // The team-invite onboarding flow lives under /onboarding/team/<inviteId>. An
  // already-onboarded user can still be invited into a new team, so they must be
  // allowed into this flow rather than bounced to "/" like the rest of onboarding.
  const isTeamInviteOnboarding = pathname.startsWith(ONBOARDING_TEAM_BASE_ROUTE);

  if (onboardingResult.requiresReauth) {
    const loginUrl = new URL(AUTH_LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return Response.redirect(loginUrl);
  }

  // Completed onboarding - block re-entry into onboarding flow (except the
  // pricing return page and the team-invite flow, which onboarded users may use).
  if (pathname.startsWith(`${ONBOARDING_BASE_ROUTE}/`) && hasOnboarded && !isPricingPage && !isTeamInviteOnboarding) {
    return Response.redirect(new URL(ROOT_ROUTE, request.url));
  }

  // Onboarding pages - pass through Auth0 for authenticated users
  if (pathname.startsWith(`${ONBOARDING_BASE_ROUTE}/`)) {
    return await auth0.middleware(request);
  }

  const cookies = request.headers.get("cookie") ?? "";
  const justCompletedCheckout = cookies.includes("souvenir_checkout_complete=1");

  // Never block access to the billing confirmation page (post-checkout return from Stripe)
  const isBillingConfirmation = pathname.startsWith(SETTINGS_BILLING_CONFIRMATION_ROUTE);

  // An invited user may still be un-onboarded when they land on their invite
  // link (e.g. a brand-new signup arriving via ?returnTo=/team-invite/<id>).
  // Let them reach the accept page instead of bouncing them into onboarding —
  // otherwise the invitation popup never renders.
  const isTeamInvite = pathname.startsWith(TEAM_INVITE_BASE_ROUTE);

  if (session && hasKnownOnboardingState && !hasOnboarded && !justCompletedCheckout && !isBillingConfirmation && !isTeamInvite && !isTeamInviteOnboarding) {
    return Response.redirect(new URL(onboarding!.nextPath, request.url));
  }

  if (justCompletedCheckout) {
    const res = await auth0.middleware(request);
    res.headers.append(
      "Set-Cookie",
      "souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax",
    );
    return res;
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    // Exclude framework internals AND any path with a file extension (the
    // `.*\..*` alternative). Static assets under public/ — persona-avatars,
    // icons, *.svg/*.png/*.mjs — must NOT pass through the
    // onboarding/auth gate; otherwise an <img> request gets a 302 to /auth/login
    // (or the next onboarding step) instead of the file, rendering as a broken
    // image. App/API/auth routes have no dot in the path, so they still match.
    //
    // `dispatch` is the first-party Mixpanel analytics proxy
    // (src/app/dispatch/[...path]/route.ts). It is extension-less, so without this
    // exclusion every analytics beacon would hit the onboarding/auth gate —
    // pre-auth events would be 302'd to /auth/login (and lost), and authed events
    // would trigger a /users/me fetch each. Middleware runs before route
    // handlers, so it must be skipped here entirely.
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|dispatch|.*\\..*).*)",
  ],
};
