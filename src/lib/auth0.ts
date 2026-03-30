import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const audience = process.env.AUTH0_AUDIENCE?.trim();
const ONBOARDING_COOKIE = "onboarding_completed";

export const auth0 = new Auth0Client({
  authorizationParameters: audience ? { audience } : undefined,

  /**
   * After every Auth0 login/signup callback:
   * - Returning users (have onboarding_completed cookie): go straight to /
   * - New users (no cookie): start the onboarding flow at /onboarding/role
   */
  onCallback: async (error, ctx) => {
    const baseUrl = process.env.AUTH0_BASE_URL!;

    if (error) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }

    // Check if user already completed onboarding
    const cookieStore = await cookies();
    const hasOnboarded = cookieStore.has(ONBOARDING_COOKIE);

    if (hasOnboarded) {
      return NextResponse.redirect(new URL("/", baseUrl));
    }

    return NextResponse.redirect(new URL("/onboarding/role", baseUrl));
  },
});
