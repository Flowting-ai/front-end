'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_MEMBERS_ROUTE } from '@/lib/routes'

// Moved to /settings/members (Souvenir V1.5) — this stub keeps old bookmarks/
// links working.
export default function OrgMembersRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_MEMBERS_ROUTE) }, [replace])
  return null
}
