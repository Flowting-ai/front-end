'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'
import { AUTH_LOGIN_ROUTE } from '@/lib/routes'

/**
 * Last-resort boundary: the root layout itself failed (providers, auth
 * hydration), so nothing from it is available. Plain HTML and inline styles,
 * with a way back in through login when the session is what broke.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    logger.error('[app] global error', error.digest ?? '', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 12, padding: 32, textAlign: 'center',
          fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#1a1a1a',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500 }}>Something went wrong</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#555' }}>
          Souvenir could not load. Try again, or sign in again if it keeps happening.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={unstable_retry} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Try again
          </button>
          {/* A full navigation, not next/link: the router may be what failed. */}
          <a href={AUTH_LOGIN_ROUTE} style={{ padding: '8px 16px', color: 'inherit' }}>Sign in again</a>
        </div>
      </body>
    </html>
  )
}
