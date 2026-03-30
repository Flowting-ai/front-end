import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const audience = process.env.AUTH0_AUDIENCE?.trim();

/** Turn an Auth0 sub into a safe cookie name. */
function onboardingCookieName(sub: string): string {
  return `ob_${sub.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export const auth0 = new Auth0Client({
  authorizationParameters: audience ? { audience } : undefined,

  /**
   * After every Auth0 login/signup callback:
   * - Returning users (have their per-user onboarding cookie): go straight to /
   * - New users (no cookie): start the onboarding flow at /onboarding/role
   */
  onCallback: async (error, ctx, session) => {
    const baseUrl = process.env.AUTH0_BASE_URL!;

    if (error) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }

    // Check if this specific user has completed onboarding
    const sub = session?.user?.sub;
    if (sub) {
      const cookieStore = await cookies();
      if (cookieStore.has(onboardingCookieName(sub))) {
        return NextResponse.redirect(new URL("/", baseUrl));
      }
    }

    return NextResponse.redirect(new URL("/onboarding/role", baseUrl));
  },
});
