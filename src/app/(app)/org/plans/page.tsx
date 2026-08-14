'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

// Moved to /settings/plans (Souvenir V1.5) — this stub keeps old bookmarks/
// links working.
export default function OrgPlansRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])
  return null
}
