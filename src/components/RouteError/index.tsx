'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import { ROOT_ROUTE } from '@/lib/routes'

/**
 * Fallback UI for an app route's `error.tsx` when no closer boundary (agents,
 * library) caught the crash. Keeps the sidebar and the rest of the shell alive.
 */
export function RouteError({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  useEffect(() => {
    logger.error('[app] route error', error.digest ?? '', error)
  }, [error])

  return (
    <div
      role="alert"
      style={{
        flex: '1 0 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center', minHeight: 0,
      }}
    >
      <h2
        style={{
          margin: 0, fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24,
          lineHeight: '32px', color: 'var(--neutral-900)',
        }}
      >
        Something went wrong
      </h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)' }}>
        This page hit an unexpected error. Your work is saved.
      </p>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Button variant="default" onClick={onRetry}>Try again</Button>
        <Button variant="secondary" asChild>
          <Link href={ROOT_ROUTE}>Go home</Link>
        </Button>
      </div>
    </div>
  )
}
