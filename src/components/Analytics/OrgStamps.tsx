"use client";

// Adds the organization postcard stamps (org_id + org_tier) for users inside an org.
// Renders nothing. Mounted inside OrgProvider (the (app) group), which is the only
// place the resolved org id and tier are available. For an org member, the org context
// replaces the individual `plan` stamp (blank for org members, per the setup doc).

import { useEffect } from "react";
import { useOrg } from "@/context/org-context";
import { registerStamps, clearStamps } from "@/lib/analytics/mixpanel";
import { STAMP, type OrgTier } from "@/lib/analytics/stamps";

// Registers org_id + org_tier as SUPER PROPERTIES only — they ride on every event and
// are anonymous-safe. We deliberately do NOT call people.set (would create/queue a
// profile before identify) or set_group (Group Analytics add-on; its group key collides
// with the scalar org_id stamp, turning it into an array). Both can be added later as a
// deliberate, add-on-gated step.
export function OrgStamps() {
  const { orgId, org, orgPlanSettled } = useOrg();

  // org_id is known as soon as it resolves; register it and drop the individual plan.
  useEffect(() => {
    if (!orgId) {
      clearStamps([STAMP.orgId, STAMP.orgTier]);
      return;
    }
    clearStamps([STAMP.plan]);
    registerStamps({ [STAMP.orgId]: orgId });
  }, [orgId]);

  // org_tier can transiently default to "teams" before the plan fetch settles — wait
  // for orgPlanSettled so we never mis-stamp an enterprise org as teams.
  useEffect(() => {
    if (!orgId || !orgPlanSettled) return;
    const tier: OrgTier = org.plan;
    registerStamps({ [STAMP.orgTier]: tier });
  }, [orgId, orgPlanSettled, org.plan]);

  return null;
}
