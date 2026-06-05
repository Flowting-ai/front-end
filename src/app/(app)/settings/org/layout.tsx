'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/context/org-context'

export default function OrgSettingsLayout({ children }: { children: React.ReactNode }) {
  const { currentUserRole } = useOrg()
  const { replace } = useRouter()

  useEffect(() => {
    if (currentUserRole !== 'admin') {
      replace('/settings')
    }
  }, [currentUserRole, replace])

  if (currentUserRole !== 'admin') return null

  return <>{children}</>
}
