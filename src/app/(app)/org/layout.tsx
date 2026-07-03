'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'
import { ORG_CONNECTORS_ROUTE, CHAT_ROUTE } from '@/lib/routes'

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole, orgReady } = useOrg()
  const { replace } = useRouter()
  const pathname = usePathname()
  // The /org/* section is admin-only (plus members may view /org/connectors).
  // Editors manage their teams from the editor-scoped /teams/[teamId] page,
  // which lives outside this layout — so no editor allowance is needed here.
  const allowMemberConnectors = pathname === ORG_CONNECTORS_ROUTE
  const canView = currentUserRole === 'admin' || allowMemberConnectors

  useEffect(() => {
    if (orgReady && !canView) {
      replace(CHAT_ROUTE)
    }
  }, [canView, orgReady, replace])

  if (!orgReady) return null
  if (!canView) return null

  return <>{children}</>
}
