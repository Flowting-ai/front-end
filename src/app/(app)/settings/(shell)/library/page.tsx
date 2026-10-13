import { notFound } from 'next/navigation'
import { LIBRARY_ENABLED } from '@/lib/feature-flags'
import { PersonalLibrarySettings } from '@/components/Library/settings/PersonalLibrarySettings'

export const metadata = { title: 'Library settings' }

export default function SettingsLibraryPage() {
  if (!LIBRARY_ENABLED) notFound()
  return <PersonalLibrarySettings />
}
