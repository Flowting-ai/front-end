'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

// Moved to /settings/plans-and-billing — merged with the individual Usage &
// Billing page so every account type lands on one page. This stub keeps old
// bookmarks/links working.
export default function SettingsPlansRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])
  return null
}
