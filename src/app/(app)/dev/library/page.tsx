import { notFound } from 'next/navigation'
import { LIBRARY_ENABLED } from '@/lib/feature-flags'
import { LibraryPlayground } from './LibraryPlayground'

// Dev-only: the composer-side Library pieces (attachment cards, notices, the picker) and the mock's
// failure switches, rendered on their own so every state can be seen and tried without the chat page.
// Lives inside (app) for the real providers. 404s in production builds and when Library is off.
export default function DevLibraryPage() {
  if (process.env.NODE_ENV === 'production' || !LIBRARY_ENABLED) notFound()
  return <LibraryPlayground />
}
