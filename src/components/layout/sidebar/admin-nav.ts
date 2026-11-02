import { DEFAULT_ADMIN_GROUPS } from "@/components/Sidebar";
import {
  ORG_MEMBERS_ROUTE,
  ORG_ACTIVITY_ROUTE,
  ORG_PLANS_ROUTE,
  ORG_GENERAL_ROUTE,
  ORG_ANALYTICS_ROUTE,
  ORG_SOUVENIR_SLACK_ROUTE,
  ORG_CONNECTORS_ROUTE,
} from "@/lib/routes";

// -- Organization admin nav ----------------------------------------------------
// The sidebar's in-place "admin" body section (entered via the org badge) renders
// the Sidebar component's default groups — Organization / Models
// (DEFAULT_ADMIN_GROUPS), matching the design-system "Org section" story. We don't
// redefine that content here; we only wire each item's behaviour via
// onAdminSectionClick. The `id`s below are those default item ids.
//
// Items with a real destination navigate there; the rest surface a "coming soon"
// toast so nothing is ever a dead click. Reference the route constants (not
// literal strings) so this can never drift out of sync with an actual route
// move again — general/members/teams/plans-usage/analytics/activity-log live
// under /settings/* now; connectors/souvenir-slack stay under /org/*.
export const ADMIN_SECTION_ROUTES: Record<string, string> = {
  general:           ORG_GENERAL_ROUTE,
  members:           ORG_MEMBERS_ROUTE,
  "plans-usage":     ORG_PLANS_ROUTE,
  analytics:         ORG_ANALYTICS_ROUTE,
  connectors:        ORG_CONNECTORS_ROUTE,
  "souvenir-slack":  ORG_SOUVENIR_SLACK_ROUTE,
  "activity-log":    ORG_ACTIVITY_ROUTE,
};

// Items with no page yet — surfaced as "coming soon" (id ? toast label).
export const ADMIN_SECTION_COMING_SOON: Record<string, string> = {};

// Default admin groups without the "Company Data" section, and without the
// "Teams" item — Team is fully removed from the product model (Workspace
// Model v2: Teams entity gone, Projects are the org unit), and its page was
// already deleted (commit 2c8c1dcb) leaving this nav row a 404.
export const ORG_ADMIN_GROUPS = DEFAULT_ADMIN_GROUPS
  .filter(g => g.id !== 'company-data')
  .map(g => g.id === 'organization' ? { ...g, items: g.items.filter(i => i.id !== 'teams') } : g);
