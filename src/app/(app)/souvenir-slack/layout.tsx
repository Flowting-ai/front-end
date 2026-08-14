'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'
import { CHAT_ROUTE } from '@/lib/routes'

// Moved from /org/souvenir-slack — admin-only, ported from
// src/app/(app)/org/layout.tsx's guard (this page had no member allowance
// there, unlike Connectors).
export default function SouvenirSlackLayout({ children }: { children: React.ReactNode }) {
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
