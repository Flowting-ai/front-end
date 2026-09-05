import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

const audience = process.env.AUTH0_AUDIENCE?.trim();
const scope = process.env.AUTH0_SCOPE?.trim() || "openid profile email offline_access";

export const auth0 = new Auth0Client({
  authorizationParameters: {
    ...(audience ? { audience } : {}),
    scope,
  },

  // 30 s - generous enough to handle any cold-start latency in the proxy
  // runtime while still failing fast on genuine connectivity issues.
  httpTimeout: 30000,

  onCallback: async (error, ctx) => {
    const baseUrl = process.env.APP_BASE_URL!;
    if (error) {
      // Preserve the intended destination across the retry. ctx.returnTo is
      // populated from transaction state even on an error callback (it's a
      // plain optional field on OnCallbackContext, not gated on success) —
      // without forwarding it here, a signup that hits an Auth0-side error
      // branch (email verification, consent, MFA enrollment — all far more
      // likely on signup than on a returning user's plain login) loses its
      // destination and the next successful login falls through to "/",
      // which the onboarding guard in proxy.ts then sends to the generic
      // self-serve /onboarding/setup instead of back to e.g. a team invite.
      const loginUrl = new URL("/auth/login", baseUrl);
      if (ctx.returnTo) loginUrl.searchParams.set("returnTo", ctx.returnTo);
      return NextResponse.redirect(loginUrl);
    }
    // Honor the post-login destination the SDK round-trips through transaction
    // state (set as ?returnTo= on /auth/login). Without this, a new user who
    // signed up from a deep link — e.g. a /team-invite/<id> invitation — lands
    // on "/" and never sees the page they came for. ctx.returnTo is already
    // sanitized by the SDK to a same-origin relative path.
    return NextResponse.redirect(new URL(ctx.returnTo || "/", baseUrl));
  },
});
