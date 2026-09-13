'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'
import { CHAT_ROUTE } from '@/lib/routes'

// Connectors and Souvenir-in-Slack moved out to their own top-level routes
// (/connectors, /souvenir-slack — each with its own layout guard); everything
// still under /org/* is either the root redirect or a stub redirecting to its
// new /settings/* location, all admin-only.
export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
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
