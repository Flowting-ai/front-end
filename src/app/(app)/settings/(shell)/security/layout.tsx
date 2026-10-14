import { notFound } from 'next/navigation'
import { SETTINGS_PREVIEW_ENABLED } from '@/lib/feature-flags'

// Not wired to real data yet; see SETTINGS_PREVIEW_ENABLED.
export default function SettingsPreviewLayout({ children }: { children: React.ReactNode }) {
  if (!SETTINGS_PREVIEW_ENABLED) notFound()
  return children
}
