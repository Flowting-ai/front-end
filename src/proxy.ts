import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { userMeRootAllowsMainApp } from "@/lib/onboarding-access";

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

  // Onboarding flow:
  //   hello (name + role)            → saves user_role
  //   account-type (just me / team)  → saves role_fit (just_me for individuals)
  //     ├─ individual → import       (tone is skipped)
  //     └─ team       → workspace     → saves role_fit (small_team / large_team) → import
  //   import (bring context)         → marks onboarding complete
  // Resume keys off the backend fields each step writes; both branches finish
  // on the import step.
  if (!filled("user_role", "userRole")) return "/onboarding/hello";
  if (!filled("role_fit", "roleFit")) return "/onboarding/account-type";
  return "/onboarding/import";
}

async function fetchOnboardingState(): Promise<OnboardingStateResult> {
  try {
    if (!apiBaseUrl) return { data: null, requiresReauth: false };
    const { token } = await auth0.getAccessToken({ audience });
    if (!token) return { data: null, requiresReauth: false };

    const response = await fetch(`${apiBaseUrl}${ONBOARDING_ENDPOINT_PATH}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

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

    if (code === "missing_refresh_token") {
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

  // The organization security page was removed. Redirect before Auth0/session
  // handling so stale client links and logged-out bookmarks cannot preserve
  // /org/security as a post-login return path.
  if (pathname === "/org/security" || pathname.startsWith("/org/security/")) {
    return NextResponse.redirect(new URL("/org/general", request.url));
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

  // Pass the request explicitly so the SDK reads cookies from the incoming
  // request rather than falling back to next/headers (which behaves differently
  // in the proxy runtime vs. App Router route handlers).
  const session = await auth0.getSession(request);
  const onboardingResult = session
    ? await fetchOnboardingState()
    : { data: null, requiresReauth: false };

  const onboarding = onboardingResult.data;
  const hasOnboarded = onboarding?.allowsMainApp === true;
  const hasKnownOnboardingState = onboarding !== null;
  const isPricingPage = pathname.startsWith("/onboarding/pricing");

  if (onboardingResult.requiresReauth) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return Response.redirect(loginUrl);
  }

  // Completed onboarding - block re-entry into onboarding flow
  if (pathname.startsWith("/onboarding/") && hasOnboarded && !isPricingPage) {
    return Response.redirect(new URL("/", request.url));
  }

  // Onboarding pages - pass through Auth0 for authenticated users
  if (pathname.startsWith("/onboarding/")) {
    return await auth0.middleware(request);
  }

  const cookies = request.headers.get("cookie") ?? "";
  const justCompletedCheckout = cookies.includes("souvenir_checkout_complete=1");

  // Never block access to the billing confirmation page (post-checkout return from Stripe)
  const isBillingConfirmation = pathname.startsWith("/settings/billing/confirmation");

  // An invited user may still be un-onboarded when they land on their invite
  // link (e.g. a brand-new signup arriving via ?returnTo=/team-invite/<id>).
  // Let them reach the accept page instead of bouncing them into onboarding —
  // otherwise the invitation popup never renders.
  const isTeamInvite = pathname.startsWith("/team-invite");

  if (session && hasKnownOnboardingState && !hasOnboarded && !justCompletedCheckout && !isBillingConfirmation && !isTeamInvite) {
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

  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname || "/");
    return Response.redirect(loginUrl);
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
