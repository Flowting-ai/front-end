import { notFound } from 'next/navigation'
import { LIBRARY_SETTINGS_ENABLED } from '@/lib/feature-flags'
import { PhaseTwoPage } from '@/components/Library/settings/PhaseTwoPage'

export const metadata = { title: 'Audit log' }

// Admin-only: the (org) layout around this route sends everyone else back to chat.
export default function AuditLogPage() {
  if (!LIBRARY_SETTINGS_ENABLED) notFound()
  return <PhaseTwoPage title="Audit log" text="Who opened, shared or deleted each file." />
}
