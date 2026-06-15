"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useOrg } from "@/context/org-context";

// Settings home. Org owners/admins manage the workspace, so they default to the
// Organization settings; individuals and members default to personal settings.
// Decided client-side because the org role is only known via org-context.
export default function SettingsPage() {
  const { replace } = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();
  const { orgReady, currentUserRole } = useOrg();

  // eslint-disable-next-line react-doctor/nextjs-no-client-side-redirect -- destination depends on the client-only org role
  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    // Wait until the org id + role have resolved so we don't route an owner to
    // personal settings on the default 'member' role.
    if (!orgReady) return;
    // Org owners/admins (Teams plan) → Organization settings; everyone else → personal.
    if (currentUserRole === "admin") {
      replace("/settings/org/general");
    } else {
      replace("/settings/account");
    }
  }, [isHydrated, isAuthenticated, orgReady, currentUserRole, replace]);

  return null;
}
