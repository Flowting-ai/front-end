'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole, orgReady } = useOrg()
  const { replace } = useRouter()

  useEffect(() => {
    if (orgReady && currentUserRole !== 'admin') {
      replace('/chat')
    }
  }, [orgReady, currentUserRole, replace])

  if (!orgReady) return null
  if (currentUserRole !== 'admin') return null

  return <>{children}</>
}
