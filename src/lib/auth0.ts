import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const audience = process.env.AUTH0_AUDIENCE?.trim();
const scope = process.env.AUTH0_SCOPE?.trim() || "openid profile email offline_access";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    ...(audience ? { audience } : {}),
    scope,
  },

  /**
   * After every Auth0 login/signup callback:
   * - Always send users to the app shell; middleware will route to onboarding
   *   if the backend says onboarding is incomplete.
   */
  onCallback: async (error) => {
    const baseUrl = process.env.AUTH0_BASE_URL!;

    if (error) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }
    return NextResponse.redirect(new URL("/", baseUrl));
  },
});
