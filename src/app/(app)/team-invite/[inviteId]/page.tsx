'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ONBOARDING_TEAM_WELCOME_ROUTE } from '@/lib/routes'

// The invite email link lands here (after login). Team-invite acceptance now runs
// through the dedicated, isolated onboarding flow under /onboarding/team/<id> —
// this route just forwards there, preserving the invite id.
export default function TeamInviteRedirectPage() {
  const params = useParams<{ inviteId: string }>()
  const { replace } = useRouter()
  const inviteId = params.inviteId

  useEffect(() => {
    if (inviteId) replace(ONBOARDING_TEAM_WELCOME_ROUTE(inviteId))
  }, [inviteId, replace])

  return null
}
