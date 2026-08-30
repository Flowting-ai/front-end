'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

// Retired — merged into /settings/plans-and-billing so every account type
// (individual, org member, org owner/admin) lands on one page. This stub
// keeps old bookmarks/links working. Sub-routes (change-plan, confirmation)
// are untouched real pages, just no longer linked from here.
export default function SettingsBillingRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(ORG_PLANS_ROUTE) }, [replace])
  return null
}
