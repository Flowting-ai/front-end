import { auth0 } from "@/lib/auth0";

type OnboardingCheck = {
  completed: boolean;
};

const apiBaseUrl = process.env.SERVER_URL?.replace(/\/+$/, "");
const audience = process.env.AUTH0_AUDIENCE?.trim() || undefined;

async function fetchOnboardingState(): Promise<OnboardingCheck | null> {
  try {
    if (!apiBaseUrl) return null;
    const { token } = await auth0.getAccessToken({ audience });
    if (!token) return null;

    const response = await fetch(`${apiBaseUrl}/users/me/onboarding`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    const root =
      (data.data && typeof data.data === "object"
        ? data.data
        : data.onboarding && typeof data.onboarding === "object"
          ? data.onboarding
          : data) as Record<string, unknown>;

    return { completed: Boolean(root.completed) };
  } catch (error) {
    console.error("Failed to fetch onboarding state", error);
    return null;
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
  const onboarding = session ? await fetchOnboardingState() : null;
  const hasOnboarded = onboarding?.completed ?? false;
  const isPricingPage = pathname.startsWith("/onboarding/pricing");

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
  if (!hasOnboarded) {
    if (!session) {
      // No session → let auth0.middleware handle it (will redirect to login)
      return await auth0.middleware(request);
    }
    // Authenticated but hasn't onboarded → send to onboarding start
    return Response.redirect(new URL("/onboarding/username", request.url));
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
