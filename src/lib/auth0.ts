import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const audience = process.env.AUTH0_AUDIENCE?.trim();
const scope = process.env.AUTH0_SCOPE?.trim() || "openid profile email offline_access";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    ...(audience ? { audience } : {}),
    scope,
  },

  // 30 s — generous enough to handle any cold-start latency in the proxy
  // runtime while still failing fast on genuine connectivity issues.
  httpTimeout: 30000,

  onCallback: async (error) => {
    const baseUrl = process.env.APP_BASE_URL!;
    if (error) {
      return NextResponse.redirect(new URL("/auth/login", baseUrl));
    }
    return NextResponse.redirect(new URL("/", baseUrl));
  },
});
