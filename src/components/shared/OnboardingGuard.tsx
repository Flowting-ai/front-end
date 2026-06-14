"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { hasActivePaidSubscription } from "@/lib/onboarding-access";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { replace } = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    // Never redirect away from the billing confirmation page (post-checkout return)
    if (pathname.startsWith("/settings/billing/confirmation")) return;
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
      replace("/onboarding/hello");
    }
  }, [isHydrated, isAuthenticated, user, replace, pathname]);

  return <>{children}</>;
}
