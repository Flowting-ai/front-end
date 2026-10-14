'use client'

import { RouteError } from '@/components/RouteError'

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return <RouteError error={error} onRetry={unstable_retry} />
}
