import { NextResponse } from "next/server";

/**
 * Federated logout at `/auth/logout`.
 *
 * This static segment takes precedence over the `auth/[auth0]` catch-all for
 * this exact path, replacing the Auth0 SDK's built-in logout — which silently
 * failed here (the trailing slash in APP_BASE_URL broke its returnTo handling,
 * so it skipped the IdP logout and bounced back into the app with the session
 * still intact).
 *
 * Mirrors the proven onboarding logout flow:
 *  1. Delete the local Auth0 session cookie(s).
 *  2. Redirect the browser to Auth0's /v2/logout so the IdP session is cleared,
 *     then back to the app's login page.
 */
export async function GET() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const returnTo = `${base}/auth/login`;

  // Build Auth0's universal-logout URL.
  const logoutUrl = new URL(`https://${domain}/v2/logout`);
  logoutUrl.searchParams.set("client_id", clientId!);
  logoutUrl.searchParams.set("returnTo", returnTo);

  // Step 1 – delete local session cookie(s) via Set-Cookie headers.
  const response = NextResponse.redirect(logoutUrl.toString());
  response.cookies.delete("appSession");
  // The SDK may chunk large cookies into appSession.0, appSession.1, …
  for (let i = 0; i < 5; i++) {
    response.cookies.delete(`appSession.${i}`);
  }

  // Step 2 – the redirect sends the browser to Auth0 /v2/logout, which clears
  // the IdP session and then 302s back to the login page.
  return response;
}
