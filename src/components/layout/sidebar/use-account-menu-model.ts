import { useIsClient } from "@/hooks/use-is-client";
import { useAuth } from "@/context/auth-context";
import { useOrg } from "@/context/org-context";
import type { CreditsDisplay } from "@/lib/api/plan";
import { formatCredits } from "@/lib/format-credits";
import type { ChipColor } from "@/components/Chip";
import { orgDisplayName } from "./sidebar-helpers";

// Everything the sidebar's AccountMenu / org badge shows about the viewer:
// name, role chip, workspace line, plan tag and credits. Pure derivation from
// auth + org context (plus the billing snapshot fallback below).
export function useAccountMenuModel() {
  const { user } = useAuth();
  const { orgId, org, plan, orgRole } = useOrg();

  const displayName = user
    ? user.firstName?.trim() || user.name?.split(" ")[0]?.trim() || ""
    : "";

  // Role chip next to the wordmark. admin shows its single org-level role;
  // anyone else in an org shows 'member' — there's no team-level role to add
  // to it any more.
  const displayRole = orgRole === 'admin'
    ? orgRole
    : (orgId ? 'member' : undefined)
  const orgBadgeSublabel = orgId && displayRole
    ? displayRole.charAt(0).toUpperCase() + displayRole.slice(1)
    : undefined
  const orgBadgeChipColor: ChipColor =
    displayRole === 'admin'  ? 'Blue'   :
    'Neutral'

  // Fall back to roleFit + billing snapshot to detect team accounts when orgId
  // hasn't resolved yet (e.g. an admin whose profile lacks org_id, or org API failed).
  const isClient = useIsClient()
  const billingSnap = (() => {
    if (!isClient) return null
    try { const r = window.sessionStorage.getItem('kaya:billing:snapshot:v2'); return r ? JSON.parse(r) : null } catch { return null }
  })()

  const isTeamUser = Boolean(
    orgId ||
    user?.orgId ||
    user?.roleFit === 'small_team' ||
    user?.roleFit === 'large_team' ||
    billingSnap?.isTeamAccount
  )

  const orgHasPlan = orgId ? (plan?.isFunded ?? false) : false

  // Workspace identity line — just the org name, independent of plan/billing
  // status, which now surfaces only via the status tag below. Individuals
  // have no named workspace, so they get no second line at all.
  const planLabel = isTeamUser
    ? (orgId ? (orgDisplayName(org?.name) ?? 'Workspace') : 'Workspace')
    : undefined

  const planWarning = isTeamUser ? !orgHasPlan : (!user?.planType && !user?.isTrial)

  // The status tag: the org's plan chip from the Plan, else the individual's plan.
  const planTypeLabel = isTeamUser
    ? (plan?.chipLabel ?? 'Free Plan')
    : user?.planType
      ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
      : user?.isTrial
        ? 'Free Trial'
        : undefined

  // Blue tag for "Free Plan" (running on starting credits, no plan selected
  // yet); default color once a real plan is selected, and always for
  // individuals. Irrelevant when planWarning is set (that state has its own
  // look) — AccountMenu itself ignores this prop in that case too.
  const planStatusVariant: 'neutral' | 'blue' = (isTeamUser && orgHasPlan && !plan?.hasSelectedPlan) ? 'blue' : 'neutral'

  // The credits line in the account menu: the org's Plan speaks for an org,
  // the personal balance for an individual. The two never mix.
  // A member cannot see a Teams pool; Enterprise is "Unlimited" for everyone.
  const accountCredits: CreditsDisplay | undefined = orgId
    ? (orgHasPlan && plan && (orgRole === 'admin' || plan.isEnterprise) ? plan.credits : undefined)
    : (planWarning || user?.creditsTotal == null
        ? undefined
        : { value: formatCredits(user.creditsTotal), caption: 'total credits' });

  return {
    displayName,
    displayRole,
    orgBadgeSublabel,
    orgBadgeChipColor,
    isTeamUser,
    planLabel,
    planWarning,
    planTypeLabel,
    planStatusVariant,
    accountCredits,
  };
}
