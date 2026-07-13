"use client";

// Global analytics wrapper. Pass-through: renders children unchanged, so mounting it
// has no effect on the rest of the app beyond firing analytics. Placed INSIDE
// AuthProvider (root layout) so it can read the authenticated user for identity + the
// postcard stamps. Org-level stamps are added separately by <OrgStamps/> inside the
// (app) group, where org context is available.

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  initAnalytics,
  identifyUser,
  registerStamps,
  clearStamps,
  setPeople,
  resetAnalytics,
} from "@/lib/analytics/mixpanel";
import { trackScreenView } from "@/lib/analytics/events";
import { routeToScreen } from "@/lib/analytics/screens";
import { STAMP } from "@/lib/analytics/stamps";
import { decodeJwtSub } from "@/lib/jwt-utils";

const isDev = process.env.NODE_ENV === "development";

export function MixpanelProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, jwtToken } = useAuth();
  const pathname = usePathname();
  const wasAuthenticated = useRef(false);

  // 1) Initialize once on mount (declared first so it runs before the effects below).
  useEffect(() => {
    initAnalytics();
  }, []);

  // 2) Identity + individual/plan stamps. Org members' plan is intentionally blank
  //    (their org tier, set by <OrgStamps/>, covers them). Everyone who authenticates
  //    is identified — individuals are first-class analytics subjects.
  // Identity id: prefer the backend-provided auth0_id (if/when /users/me returns it),
  // otherwise derive the Auth0 `sub` from the access token — same value, available now
  // without any backend change (GET /users/me does not currently include it).
  const auth0Id = (user?.auth0Id || decodeJwtSub(jwtToken)) ?? null;
  const planType = user?.planType ?? null;
  const orgId = user?.orgId ?? null;
  useEffect(() => {
    if (!auth0Id) {
      // Dev-only tripwire: authenticated but neither auth0_id nor a token `sub` is
      // available yet — events stay anonymous ($device:…) until identity resolves.
      if (isDev && isAuthenticated && user) {
        console.warn("[analytics] no auth0 id yet (token sub missing) — events anonymous until identity resolves");
      }
      return;
    }
    if (isDev) console.info("[analytics] identify →", auth0Id);
    // Order matters (per the Mixpanel skill): identify BEFORE people.set / register.
    identifyUser(auth0Id);
    if (orgId) {
      // Org member: org_id + org_tier own the context; ensure no stale individual plan.
      clearStamps([STAMP.plan]);
      registerStamps({ [STAMP.orgId]: orgId });
    } else {
      // Individual: carry the subscription tier; clear any org stamps.
      clearStamps([STAMP.orgId, STAMP.orgTier]);
      if (planType) {
        registerStamps({ [STAMP.plan]: planType });
        setPeople({ [STAMP.plan]: planType });
      }
    }
  }, [auth0Id, planType, orgId, isAuthenticated, user, jwtToken]);

  // 3) On logout, reset so the next anonymous session isn't merged with this user.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      resetAnalytics();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // 4) Layer 1 — fire screen_viewed on every navigation (including the first load,
  //    since track_pageview is off). Unmapped routes fire nothing.
  useEffect(() => {
    const screen = routeToScreen(pathname);
    if (screen) trackScreenView(screen);
    else if (isDev) console.debug("[analytics] unmapped route (no screen_viewed):", pathname);
  }, [pathname]);

  return <>{children}</>;
}
