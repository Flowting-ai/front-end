'use client'

import { LibraryRouteError } from '@/components/Library/LibraryRouteError'
import { MESSAGES } from '@/lib/library/messages'

// A crash in Trash keeps the rest of Library working and says which page failed.
export default function LibraryTrashError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <LibraryRouteError error={error} onRetry={unstable_retry} boundary="library-trash-route" title={MESSAGES.trashCrashTitle} />
}
