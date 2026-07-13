// The "postcard stamps" — the identity/context properties attached to every event
// as Mixpanel super properties (see docs/mixpanel-setup-notion.txt and
// docs/mixpanel-backend-contract.md). Values are IDs / enumerated types only — never
// free text — matching the doc's privacy rule and the Mixpanel skill's naming rules
// (snake_case keys, lowercase enum values, no `$`/`mp_` prefixes).

/** Where the event originated. The browser always stamps `web`; `slack` is emitted by
 *  the backend door and never set here. */
export type Surface = "web" | "slack";

/** Individual (non-org) subscription tier. Blank for org members — their org's tier
 *  covers them. "plan" means subscription tier ONLY (Brain plans are "runs"). */
export type IndividualPlan = "starter" | "pro" | "power";

/** Organization tier, for comparing Enterprise orgs vs Teams orgs. */
export type OrgTier = "teams" | "enterprise";

/** Canonical super-property keys. Kept in one place so register/unregister never drift. */
export const STAMP = {
  surface: "surface",
  plan: "plan",
  orgId: "org_id",
  orgTier: "org_tier",
} as const;

/** Mixpanel group key used for Group Analytics (org-level rollups). */
export const ORG_GROUP_KEY = "org_id";

export const SURFACE_WEB: Surface = "web";
