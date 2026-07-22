'use client'

import React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/Button'
import { AlertCircleIcon } from '@strange-huge/icons'

interface ErrorBoundaryProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Catches render-time exceptions in the wrapped subtree so they can't take
 * down navigation/chrome mounted outside it (e.g. the sidebar's New Chat
 * button) — without a boundary, an uncaught error unmounts the nearest parent
 * that has one, which for this app was nothing, so a crash anywhere in the
 * page silently left surrounding controls unresponsive with no visible cause.
 */
class ErrorBoundaryInner extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            12,
            padding:        32,
            height:         '100%',
            minHeight:      320,
            textAlign:      'center',
          }}
        >
          <AlertCircleIcon size={28} color="var(--color-tag-Red-text)" />
          <p style={{ fontFamily: 'var(--font-title)', fontSize: 18, color: 'var(--neutral-900)', margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neutral-500)', margin: 0, maxWidth: 360 }}>
            This page ran into an unexpected error. Reloading usually fixes it.
          </p>
          <Button variant="default" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

/**
 * Wraps ErrorBoundaryInner with a `key` derived from the current route
 * (pathname + search params). The boundary's `hasError` state has no other
 * way to clear itself — without this, once a render error is caught, the
 * fallback occupies `{children}` forever, and navigating away (e.g. clicking
 * "New chat" while `/chat?id=xxx` is stuck on a caught error) changes the URL
 * but never actually remounts the page, so the click looks like it does
 * nothing. Giving React a new key on every route change forces a fresh
 * instance — and a fresh `hasError: false` — instead of requiring a manual
 * full-page reload.
 */
export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return (
    <ErrorBoundaryInner key={`${pathname}?${searchParams.toString()}`}>
      {children}
    </ErrorBoundaryInner>
  )
}

export default ErrorBoundary
