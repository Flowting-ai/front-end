'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ORG_TEAM_ROUTE } from '@/lib/routes'

// Moved to /settings/teams/[teamId] (Souvenir V1.5) — this stub keeps old
// bookmarks/links working.
export default function OrgTeamRedirect() {
  const { replace } = useRouter()
  const params = useParams<{ teamId: string }>()
  useEffect(() => {
    if (params.teamId) replace(ORG_TEAM_ROUTE(params.teamId))
  }, [replace, params.teamId])
  return null
}
