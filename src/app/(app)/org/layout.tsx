'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'

export default function OrgAdminLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole } = useOrg()
  const { replace } = useRouter()

  useEffect(() => {
    if (currentUserRole !== 'admin') {
      replace('/chat')
    }
  }, [currentUserRole, replace])

  if (currentUserRole !== 'admin') return null

  return <>{children}</>
}
