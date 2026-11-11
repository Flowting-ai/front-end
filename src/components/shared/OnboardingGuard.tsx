"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { hasActivePaidSubscription } from "@/lib/onboarding-access";
import { redirectToLogin } from "@/lib/auth/logout-state";
import { currentUser } from "@/lib/api/current-user";
import { parseUserMeGate } from "@/lib/api/user-me-schema";
import { determineNextOnboardingPath } from "@/lib/onboarding-next-step";
import { AUTH_LOGIN_ROUTE, SETTINGS_BILLING_CONFIRMATION_ROUTE, TEAM_INVITE_BASE_ROUTE, ONBOARDING_SETUP_ROUTE, ONBOARDING_TEAM_WELCOME_ROUTE, SLACK_LINK_ROUTE } from "@/lib/routes";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { replace } = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      // Back to this page after signing in, as the server-side redirect does.
      const here = window.location.pathname + window.location.search;
      redirectToLogin(`${AUTH_LOGIN_ROUTE}?returnTo=${encodeURIComponent(here)}`);
      return;
    }
    // Never redirect away from the billing confirmation page (post-checkout return)
    if (pathname.startsWith(SETTINGS_BILLING_CONFIRMATION_ROUTE)) return;
    // Let an un-onboarded invitee reach their invite link (mirrors proxy.ts) so
    // the invitation popup renders instead of bouncing them into onboarding.
    if (pathname.startsWith(TEAM_INVITE_BASE_ROUTE)) return;
    // Same for the Slack Connect landing (mirrors proxy.ts): it joins them to
    // their workspace's org and marks onboarding complete itself.
    if (pathname.startsWith(SLACK_LINK_ROUTE)) return;
    // Wait until the profile has loaded — redirecting on a null user races the
    // initial /users/me fetch and can bounce the user mid-hydration.
    if (!user) return;

    // This gate MUST mirror the server proxy's `userMeRootAllowsMainApp`: a user
    // is allowed into the app when onboarding is complete OR they have an active
    // paid/trial subscription. If the two disagree, the proxy lets /chat through
    // while the guard kicks back to /onboarding (or vice-versa), producing an
    // infinite /chat ⇄ /onboarding ⇄ / reload loop.
    const allowsMainApp =
      user.onboardingCompleted === true ||
      hasActivePaidSubscription(user.planType ?? null, user.subscriptionStatus ?? null);

    // Someone back from checkout is let through, as the proxy does (souvenir_checkout_complete).
    if (!allowsMainApp && document.cookie.split("; ").includes("souvenir_checkout_complete=1")) return;

    // The same next step as the proxy (determineNextOnboardingPath), so a user part-way through
    // resumes there instead of starting again at Setup. A waiting invite still comes first.
    if (!allowsMainApp) {
      let next = user.pendingInviteId ? ONBOARDING_TEAM_WELCOME_ROUTE(user.pendingInviteId) : ONBOARDING_SETUP_ROUTE;
      try {
        const profile = currentUser.peek();
        if (profile) next = determineNextOnboardingPath(parseUserMeGate(profile));
      } catch { /* unexpected profile shape: keep the default step */ }
      replace(next);
    }
  }, [isHydrated, isAuthenticated, user, replace, pathname]);

  return <>{children}</>;
}
