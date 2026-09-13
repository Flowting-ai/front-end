'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ORG_PLANS_ROUTE } from '@/lib/routes'

// Moved to /settings/plans-and-billing/confirmation — this stub keeps old
// bookmarks/links working.
export default function SettingsPlansConfirmationRedirect() {
  const { replace } = useRouter()
  useEffect(() => { replace(`${ORG_PLANS_ROUTE}/confirmation`) }, [replace])
  return null
}
