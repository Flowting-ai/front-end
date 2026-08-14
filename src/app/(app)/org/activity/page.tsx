'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_ACTIVITY_ROUTE } from '@/lib/routes'

// Moved to /settings/activity (Souvenir V1.5) — this stub keeps old
// bookmarks/links working.
export default function OrgActivityRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_ACTIVITY_ROUTE) }, [replace])
  return null
}
