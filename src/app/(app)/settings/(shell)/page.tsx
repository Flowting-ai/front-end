"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AUTH_LOGIN_ROUTE, SETTINGS_ACCOUNT_ROUTE } from "@/lib/routes";
import { AccountSkeleton } from "./SettingsSkeleton";

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

  // Renders the destination's own skeleton instead of `null` — this page is
  // a client-side redirector, so without this the layout's content area goes
  // blank for a beat (no auth guard yet, then a replace()) before /account's
  // real AccountSkeleton mounts. Same skeleton both before and after the
  // route swap reads as one continuous load, not a blank flash then a skeleton.
  return <AccountSkeleton />;
}
