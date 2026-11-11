import { notFound } from 'next/navigation'
import { LIBRARY_SETTINGS_ENABLED } from '@/lib/feature-flags'
import { PhaseTwoPage } from '@/components/Library/settings/PhaseTwoPage'

export const metadata = { title: 'Inventory' }

// Admin-only: the (org) layout around this route sends everyone else back to chat.
export default function InventoryPage() {
  if (!LIBRARY_SETTINGS_ENABLED) notFound()
  return <PhaseTwoPage title="Inventory" text="Storage by member and type." />
}
