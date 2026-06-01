"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";

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
    // Redirect if onboarding is not completed (false) or has no record yet (null)
    if (user && user.onboardingCompleted !== true) {
      replace("/onboarding/welcome");
    }
  }, [isHydrated, isAuthenticated, user, replace, pathname]);

  return <>{children}</>;
}
