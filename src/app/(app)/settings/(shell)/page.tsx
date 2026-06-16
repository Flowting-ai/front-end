"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

// Settings home — redirects to personal settings.
// Org settings now live at /org/* (main app sidebar admin section).
export default function SettingsPage() {
  const { replace } = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();

  // eslint-disable-next-line react-doctor/nextjs-no-client-side-redirect -- destination depends on client-only auth state
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    replace("/settings/account");
  }, [isHydrated, isAuthenticated, replace]);

  return null;
}
