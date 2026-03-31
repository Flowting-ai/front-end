import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const audience = process.env.AUTH0_AUDIENCE?.trim();

export const auth0 = new Auth0Client({
  authorizationParameters: audience ? { audience } : undefined,

  /**
   * After every Auth0 login/signup callback, redirect to /.
   * The proxy (proxy.ts) handles the onboarding gate: if the user hasn't
   * completed onboarding it will redirect them to /onboarding/role.
   *
   * NOTE: cookies() from next/headers does NOT work in the proxy/middleware
   * context (Next.js 16), so the onboarding cookie check must live in
   * proxy.ts where request.headers.get("cookie") is available instead.
   */
  onCallback: async (error) => {
    const baseUrl = process.env.AUTH0_BASE_URL!;

    if (error) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }

    return NextResponse.redirect(new URL("/", baseUrl));
  },
});
