'use client'

import { RequireAdmin } from '@/components/RequireAdmin'

// Admin-only: Souvenir in Slack.
export default function SouvenirSlackLayout({ children }: { children: React.ReactNode }) {
  return <RequireAdmin>{children}</RequireAdmin>
}
