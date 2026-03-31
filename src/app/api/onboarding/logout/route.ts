import { NextResponse } from "next/server";

/**
 * Two-step logout for onboarding pages:
 *  1. Clear the local Auth0 session cookie.
 *  2. Redirect to Auth0's /v2/logout so the IdP session is also cleared.
 *     Auth0 will then redirect the browser to https://getsouvenir.com.
 */
export async function GET() {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const returnTo = "https://getsouvenir.com";

  // Build Auth0's universal-logout URL
  const logoutUrl = new URL(`https://${domain}/v2/logout`);
  logoutUrl.searchParams.set("client_id", clientId!);
  logoutUrl.searchParams.set("returnTo", returnTo);

  // Step 1 – delete local session cookie(s) via Set-Cookie headers
  const response = NextResponse.redirect(logoutUrl.toString());
  response.cookies.delete("appSession");
  // The SDK may chunk large cookies into appSession.0, appSession.1, …
  for (let i = 0; i < 5; i++) {
    response.cookies.delete(`appSession.${i}`);
  }

  // Step 2 – the redirect itself sends the browser to Auth0 /v2/logout,
  // which clears the IdP session and then 302s to getsouvenir.com.
  return response;
}
