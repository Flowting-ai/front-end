'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_GENERAL_ROUTE } from '@/lib/routes'

// Moved to /settings/general (Souvenir V1.5) — this stub keeps old bookmarks/
// links working.
export default function OrgGeneralRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_GENERAL_ROUTE) }, [replace])
  return null
}
