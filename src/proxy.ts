import { auth0 } from "@/lib/auth0";

const ONBOARDING_COOKIE = "onboarding_completed";

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

  const hasOnboarded = cookieExists(request, ONBOARDING_COOKIE);

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

  // For all other app routes: if the onboarding cookie is missing, the user
  // needs to authenticate first, then go through onboarding.
  // Check if they have an Auth0 session — if not, let auth0.middleware
  // redirect them to login (NOT onboarding).
  if (!hasOnboarded) {
    const session = await auth0.getSession();
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
