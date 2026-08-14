'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_TEAMS_ROUTE } from '@/lib/routes'

// Moved to /settings/teams (Souvenir V1.5) — this stub keeps old bookmarks/
// links working.
export default function OrgTeamsRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_TEAMS_ROUTE) }, [replace])
  return null
}
