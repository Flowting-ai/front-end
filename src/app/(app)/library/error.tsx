'use client'

import { LibraryRouteError } from '@/components/Library/LibraryRouteError'

export default function LibraryError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <LibraryRouteError error={error} onRetry={unstable_retry} showBackLink={false} />
}
