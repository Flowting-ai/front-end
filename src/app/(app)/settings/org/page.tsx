'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /settings/org has no view of its own — it's a section, not a page. Forward to
// the first Organization tab. (The org settings nav lives in SettingsSidebar /
// the main sidebar's in-place "admin" section.) The parent org layout already
// gates non-admins, redirecting them to /settings.
export default function OrgSettingsIndexPage() {
  const { replace } = useRouter()
  useEffect(() => {
    replace('/settings/org/general')
  }, [replace])
  return null
}
