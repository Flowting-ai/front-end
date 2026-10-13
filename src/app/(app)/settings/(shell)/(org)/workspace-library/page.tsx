import { notFound } from 'next/navigation'
import { LIBRARY_ENABLED } from '@/lib/feature-flags'
import { AdminLibrarySettings } from '@/components/Library/settings/AdminLibrarySettings'

export const metadata = { title: 'Workspace Library settings' }

// Admin-only: the (org) layout around this route sends everyone else back to chat.
export default function WorkspaceLibraryPage() {
  if (!LIBRARY_ENABLED) notFound()
  return <AdminLibrarySettings />
}
