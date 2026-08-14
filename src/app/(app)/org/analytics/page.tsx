'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_ANALYTICS_ROUTE } from '@/lib/routes'

// Moved to /settings/analytics (Souvenir V1.5) — this stub keeps old
// bookmarks/links working.
export default function OrgAnalyticsRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_ANALYTICS_ROUTE) }, [replace])
  return null
}
