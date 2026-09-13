'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

// Moved to /settings/plans-and-billing (Souvenir V1.5, later merged with the
// individual billing page) — this stub keeps old bookmarks/links working.
export default function OrgPlansRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])
  return null
}
