'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { RouteState } from '@/components/RouteState'
import { logger } from '@/lib/logger'
import { isAuthError, loginUrlFor } from '@/lib/auth/auth-error'
import { AUTH_LOGIN_ROUTE, ROOT_ROUTE } from '@/lib/routes'

/**
 * Fallback UI for an app route's `error.tsx` when no closer boundary (agents,
 * library) caught the crash. Keeps the sidebar and the rest of the shell alive.
 * A lost session gets its own screen with a way back in, not "Something went wrong".
 */
export function RouteError({
  error,
  onRetry,
}: {
  error: Error & { digest?: string }
  onRetry: () => void
}) {
  const authLost = isAuthError(error)

  useEffect(() => {
    if (!authLost) logger.error('[app] route error', error.digest ?? '', error)
  }, [error, authLost])

  if (authLost) {
    const href = typeof window === 'undefined' ? AUTH_LOGIN_ROUTE : loginUrlFor(AUTH_LOGIN_ROUTE, window.location.pathname + window.location.search)
    return (
      <RouteState
        fill
        tone="alert"
        headingLevel="h2"
        heading="You've been signed out"
        body="Your session ended. Sign in again to pick up where you left off."
        // A full navigation: the login route is served by Auth0's middleware.
        actions={<Button variant="default" asChild><a href={href}>Sign in again</a></Button>}
      />
    )
  }

  return (
    <RouteState
      fill
      tone="alert"
      headingLevel="h2"
      heading="Something went wrong"
      body="This page hit an unexpected error. Your work is saved."
      actions={
        <>
          <Button variant="default" onClick={onRetry}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href={ROOT_ROUTE}>Go home</Link>
          </Button>
        </>
      }
    />
  )
}
