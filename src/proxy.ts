import { auth0 } from "@/lib/auth0";
import { userMeRootAllowsMainApp } from "@/lib/onboarding-access";

type OnboardingGate = {
  /** True when onboarding is finished or user has an active paid subscription. */
  allowsMainApp: boolean;
  /** The onboarding step path the user should resume from. */
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
 * Determine which onboarding page the user should be on based on which
 * fields have already been filled in.  Flow order:
 *   username → role → tone → org-size → pricing
 */
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

  if (!filled("user_role", "userRole")) return "/onboarding/username";
  if (!filled("ai_tone", "aiTone")) return "/onboarding/tone";
  if (!filled("role_fit", "roleFit")) return "/onboarding/org-size";
  return "/onboarding/pricing";
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
    const root =
      (data.data && typeof data.data === "object"
        ? data.data
        : data.user && typeof data.user === "object"
          ? data.user
          : data) as Record<string, unknown>;

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

export default async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  // Auth0 handles its own routes — never block /auth/*
  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  // API routes must never be blocked by the onboarding guard
  if (pathname.startsWith("/api/")) {
    return await auth0.middleware(request);
  }

  // Get the current Auth0 session (needed for onboarding check)
  const session = await auth0.getSession();
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

  // If the user already completed onboarding, don't let them back into the
  // onboarding flow — even if they type the URL manually.
  if (pathname.startsWith("/onboarding/") && hasOnboarded && !isPricingPage) {
    return Response.redirect(new URL("/", request.url));
  }

  // Onboarding pages are reachable only for authenticated users
  // who haven't completed onboarding yet.
  if (pathname.startsWith("/onboarding/")) {
    return await auth0.middleware(request);
  }

  // For all other app routes: if onboarding is incomplete, check auth first.
  // If the user just completed checkout, a short-lived cookie lets them through
  // even when the Stripe webhook hasn't updated the backend yet.
  const cookies = request.headers.get("cookie") ?? "";
  const justCompletedCheckout = cookies.includes("souvenir_checkout_complete=1");

  if (session && hasKnownOnboardingState && !hasOnboarded && !justCompletedCheckout) {
    // Authenticated + known incomplete onboarding → enforce onboarding flow.
    return Response.redirect(new URL(onboarding!.nextPath, request.url));
  }

  // Clear the checkout cookie once the user lands on the main app so it
  // doesn't persist beyond this single transition.
  if (justCompletedCheckout) {
    const res = await auth0.middleware(request);
    res.headers.append(
      "Set-Cookie",
      "souvenir_checkout_complete=; path=/; max-age=0; SameSite=Lax",
    );
    return res;
  }

  if (!session) {
    // No session → let auth0.middleware handle it (will redirect to login)
    return await auth0.middleware(request);
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
