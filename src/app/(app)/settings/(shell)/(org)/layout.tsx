'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'
import { CHAT_ROUTE } from '@/lib/routes'

// Admin-only guard for the former /org/* pages (General/Members/Teams/Plans/
// Analytics/Activity), now living under /settings/*. Ported from
// src/app/(app)/org/layout.tsx — that layout still guards the two pages that
// stayed at /org/* (Connectors, Souvenir in Slack); this one covers everything
// that moved. No member-connectors allowance needed here — Connectors isn't
// in this group.
export default function SettingsOrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole, orgReady } = useOrg()
  const { replace } = useRouter()
  const canView = currentUserRole === 'admin'

  useEffect(() => {
    if (orgReady && !canView) {
      replace(CHAT_ROUTE)
    }
  }, [canView, orgReady, replace])

  if (!orgReady) return null
  if (!canView) return null

  return <>{children}</>
}
