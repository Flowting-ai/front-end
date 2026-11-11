'use client'

import { RequireAdmin } from '@/components/RequireAdmin'

// Admin-only: General, Members, Plans, Analytics, Activity, Workspace library.
export default function SettingsOrgAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>
}
