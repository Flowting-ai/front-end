"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isHydrated, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    // Only redirect if we have user data and onboarding is explicitly not completed
    if (user && user.onboardingCompleted === false) {
      router.replace("/onboarding/welcome");
    }
  }, [isHydrated, isAuthenticated, user, router]);

  return <>{children}</>;
}
