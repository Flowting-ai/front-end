'use client'

// Plans & Billing: picks the workspace or personal view. Parts in ./_components.

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'
import { SETTINGS_USAGE_ROUTE } from '@/lib/routes'
import { TeamsPlansSkeleton } from './_components/billing-skeletons'
import { OrgBillingView } from './_components/OrgBillingView'
import { PersonalBillingView } from './_components/PersonalBillingView'

// ── Page — branches on account type ────────────────────────────────────────────
// One route for everyone (individual, org member, org admin). `orgReady`
// gates the branch so an org account never flashes the personal view while its
// org id is still resolving (see org-context.tsx).
export default function PlansAndBillingPage() {
  const { orgId, orgReady, orgRole, orgRoleResolved, roleError } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!orgReady || !orgId || roleError || !orgRoleResolved) return
    if (orgRole !== 'admin') router.replace(SETTINGS_USAGE_ROUTE)
  }, [orgId, orgReady, orgRole, orgRoleResolved, roleError, router])

  if (!orgReady || (orgId && orgRoleResolved && !roleError && orgRole !== 'admin')) {
    // orgId/isEnterprise aren't resolved yet (or role just resolved to
    // non-admin and we're about to redirect away) — Teams' non-admin shape
    // (no hero, no Payment/Invoice) is the closest neutral placeholder for
    // this brief, transient state.
    return (
      <div className="kaya-scrollbar" style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 48px' }}>
        <TeamsPlansSkeleton isAdmin={false} />
      </div>
    )
  }
  return orgId ? <OrgBillingView /> : <PersonalBillingView />
}

