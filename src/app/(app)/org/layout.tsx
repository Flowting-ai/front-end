'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole, orgReady } = useOrg()
  const { replace } = useRouter()
  const pathname = usePathname()
  const allowMemberConnectors = pathname === '/org/connectors'
  const canView = currentUserRole === 'admin' || allowMemberConnectors

  useEffect(() => {
    if (orgReady && !canView) {
      replace('/chat')
    }
  }, [canView, orgReady, replace])

  if (!orgReady) return null
  if (!canView) return null

  return <>{children}</>
}
