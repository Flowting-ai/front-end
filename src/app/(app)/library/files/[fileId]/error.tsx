'use client'

import { LibraryRouteError } from '@/components/Library/LibraryRouteError'

// A crash while showing one file keeps the rest of Library (and the sidebar) working.
export default function LibraryFileError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <LibraryRouteError error={error} onRetry={unstable_retry} boundary="library-file-route" />
}
