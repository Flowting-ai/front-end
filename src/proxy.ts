import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  fetchOnboardingState,
  isOnboardedCached,
  rememberOnboarded,
  type OnboardingStateResult,
} from "@/lib/onboarding-gate";
import {
  exemptFromOnboardingRedirect,
  isCrossSiteMutation,
  onboardingOpenWhenOnboarded,
  routePolicy,
} from "@/lib/auth/route-policy";
import {
  ORG_GENERAL_ROUTE,
  AUTH_LOGIN_ROUTE,
  ROOT_ROUTE,
} from "@/lib/routes";

/**
 * Session gate, then onboarding gate. Which paths skip which gate is the table
 * in lib/auth/route-policy.ts (tested there); the onboarding state comes from
 * lib/onboarding-gate.ts (fail-open, tested there).
 */
export default async function proxy(request: NextRequest) {
  const { pathname, search } = new URL(request.url);
  // A deep link's query string is part of where the caller was going: the
  // Slack /connect link carries its signed state there, so dropping it sends
  // them back to a page with nothing to act on.
  const returnTo = `${pathname}${search}`;

  switch (routePolicy(pathname, process.env.NODE_ENV === "production")) {
    // Component verification harnesses render fixtures only and must stay
    // reachable without a session while developing. Never in production.
    case "dev-harness":
      return NextResponse.next();

    // The organization security page was removed. Redirect before Auth0/session
    // handling so stale links and logged-out bookmarks cannot keep /org/security
    // as a post-login return path.
    case "removed-org-security":
      return NextResponse.redirect(new URL(ORG_GENERAL_ROUTE, request.url));

    // Auth0 handles its own routes (the v4 SDK serves /auth/access-token natively,
    // with the { token } shape getAccessToken expects and a JSON 401 without a session).
    case "auth":
      return await auth0.middleware(request);

    // Route handlers never see the onboarding gate, but every one needs a
    // session. A JSON 401, not a login redirect, because the callers are fetches.
    case "api": {
      // APP_BASE_URL may differ from the request host behind a proxy or preview alias.
      const allowed = process.env.APP_BASE_URL ? [new URL(process.env.APP_BASE_URL).origin] : [];
      if (isCrossSiteMutation(request.method, request.headers.get("origin"), request.url, allowed)) {
        return NextResponse.json(
          { error: { code: "forbidden", message: "Cross-site request refused" } },
          { status: 403 },
        );
      }
      const response = await auth0.middleware(request);
      if (!(await auth0.getSession(request))) {
        return NextResponse.json(
          { error: { code: "unauthorized", message: "Sign in to continue" } },
          { status: 401 },
        );
      }
      return response;
    }

    // The pre-login invite landing IS the "sign in vs sign up" screen for a
    // logged-out invitee, so it runs before any session check; /api/health too.
    case "public":
      return NextResponse.next();

    case "onboarding":
    case "app":
      break;
  }

  // Pass the request explicitly so the SDK reads cookies from the incoming
  // request rather than falling back to next/headers.
  const session = await auth0.getSession(request);

  // Authentication is decided before any route-specific pass-through: the team
  // invite landing forwards into onboarding, and a logged-out invitee must hit
  // Auth0, not the client loader and its protected API call.
  if (!session) {
    const loginUrl = new URL(AUTH_LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set("returnTo", returnTo || ROOT_ROUTE);
    return Response.redirect(loginUrl);
  }

  const sub = typeof session.user?.sub === "string" ? session.user.sub : null;

  // Already known to be onboarded: use the cached gate instead of re-fetching
  // /users/me. `nextPath` is only read when !hasOnboarded, so the placeholder is
  // never consulted on this path.
  const onboardedFromCache = isOnboardedCached(sub);
  const onboardingResult: OnboardingStateResult = onboardedFromCache
    ? { data: { allowsMainApp: true, nextPath: ROOT_ROUTE }, requiresReauth: false }
    : await fetchOnboardingState();
  if (!onboardedFromCache && onboardingResult.data?.allowsMainApp === true) {
    rememberOnboarded(sub);
  }

  const onboarding = onboardingResult.data;
  const hasOnboarded = onboarding?.allowsMainApp === true;

  if (onboardingResult.requiresReauth) {
    const loginUrl = new URL(AUTH_LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set("returnTo", returnTo);
    return Response.redirect(loginUrl);
  }

  if (routePolicy(pathname, process.env.NODE_ENV === "production") === "onboarding") {
    // Completed onboarding blocks re-entry, except the pages onboarded users use.
    if (hasOnboarded && !onboardingOpenWhenOnboarded(pathname)) {
      return Response.redirect(new URL(ROOT_ROUTE, request.url));
    }
    return await auth0.middleware(request);
  }

  // Set by the checkout pages so a user returning from Stripe is not bounced
  // into onboarding before the webhook marks them paid. It is script-set and
  // unsigned, so it is a UX hint only: it skips a redirect, never an access check.
  const justCompletedCheckout = request.cookies.get("souvenir_checkout_complete")?.value === "1";

  if (onboarding !== null && !hasOnboarded && !justCompletedCheckout && !exemptFromOnboardingRedirect(pathname)) {
    return Response.redirect(new URL(onboarding.nextPath, request.url));
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
