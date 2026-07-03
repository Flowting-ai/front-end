"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { hasActivePaidSubscription } from "@/lib/onboarding-access";
import { AUTH_LOGIN_ROUTE, SETTINGS_BILLING_CONFIRMATION_ROUTE, TEAM_INVITE_BASE_ROUTE, ONBOARDING_HELLO_ROUTE } from "@/lib/routes";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { replace } = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = AUTH_LOGIN_ROUTE;
      return;
    }
    // Never redirect away from the billing confirmation page (post-checkout return)
    if (pathname.startsWith(SETTINGS_BILLING_CONFIRMATION_ROUTE)) return;
    // Let an un-onboarded invitee reach their invite link (mirrors proxy.ts) so
    // the invitation popup renders instead of bouncing them into onboarding.
    if (pathname.startsWith(TEAM_INVITE_BASE_ROUTE)) return;
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

    if (!allowsMainApp) {
      replace(ONBOARDING_HELLO_ROUTE);
    }
  }, [isHydrated, isAuthenticated, user, replace, pathname]);

  return <>{children}</>;
}
