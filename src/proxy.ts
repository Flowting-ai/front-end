import { auth0 } from "@/lib/auth0";

/** Turn an Auth0 sub like "auth0|abc123" into a safe cookie name. */
function onboardingCookieName(sub: string): string {
  return `ob_${sub.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function cookieExists(request: Request, name: string): boolean {
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .some((c) => c.trim().startsWith(`${name}=`));
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

  // Get the current Auth0 session (needed for per-user onboarding check)
  const session = await auth0.getSession();
  const sub = session?.user?.sub as string | undefined;

  // Onboarding is complete only if this specific user's cookie exists
  const hasOnboarded = !!(sub && cookieExists(request, onboardingCookieName(sub)));

  // If the user already completed onboarding, don't let them back into the
  // onboarding flow — even if they type the URL manually.
  if (pathname.startsWith("/onboarding/") && hasOnboarded) {
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
    return Response.redirect(new URL("/onboarding/role", request.url));
  }

  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
