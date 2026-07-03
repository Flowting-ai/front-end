"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AUTH_LOGIN_ROUTE, SETTINGS_ACCOUNT_ROUTE } from "@/lib/routes";

// Settings home — redirects to personal settings.
// Org settings now live at /org/* (main app sidebar admin section).
export default function SettingsPage() {
  const { replace } = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = AUTH_LOGIN_ROUTE;
      return;
    }
    replace(SETTINGS_ACCOUNT_ROUTE);
  }, [isHydrated, isAuthenticated, replace]);

  return null;
}
