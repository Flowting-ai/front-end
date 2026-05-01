import { auth0 } from "@/lib/auth0";

/**
 * Logout helper for onboarding pages.
 * Delegates entirely to the SDK's /auth/logout route (auto-mounted by the
 * [auth0] catch-all), which clears the session cookie and signs the user
 * out of the Auth0 IdP in one step.
 */
export async function GET(request: Request) {
  return auth0.middleware(request);
}
