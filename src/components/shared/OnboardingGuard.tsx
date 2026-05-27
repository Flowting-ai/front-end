"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const { replace } = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    // Redirect if onboarding is not completed (false) or has no record yet (null)
    if (user && user.onboardingCompleted !== true) {
      replace("/onboarding/welcome");
    }
  }, [isHydrated, isAuthenticated, user, replace]);

  return <>{children}</>;
}
