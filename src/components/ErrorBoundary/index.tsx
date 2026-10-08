'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { useSidebarEvents } from '@/hooks/use-sidebar-events'
import { Button } from '@/components/Button'
import { AlertCircleIcon } from '@strange-huge/icons'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Bumping this clears a caught error without remounting a healthy subtree. */
  resetToken?: number
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

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.hasError && prev.resetToken !== this.props.resetToken) {
      this.setState({ hasError: false })
    }
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
 * Wraps ErrorBoundaryInner with a `key` derived from the current pathname
 * only (not search params). The boundary's `hasError` state has no other way
 * to clear itself — without this, once a render error is caught, the
 * fallback occupies `{children}` forever, and navigating to a different page
 * never actually remounts it. Deliberately pathname-only, not pathname+search:
 * keying on search params too seemed appealing (it would also reset on
 * same-page id-only changes, e.g. "New chat"), but a chat's OWN first message
 * assigns itself an id via router.replace() — same-page, self-initiated, not
 * a real navigation — and that would remount the whole page mid-stream,
 * wiping the in-flight response (see chat/page.tsx's handleChatCreated).
 * usePathname() alone doesn't need a Suspense boundary, unlike
 * useSearchParams(), so this stays simple.
 *
 * The one same-pathname exception is the sidebar's "New chat": a chat that
 * crashed on /chat?id=X would otherwise leave the fallback up after New chat
 * (/chat is the same pathname), so that event clears a caught error.
 */
export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const pathname = usePathname()
  const [resetToken, setResetToken] = React.useState(0)
  useSidebarEvents({ onNewChat: () => setResetToken((n) => n + 1) })
  return <ErrorBoundaryInner key={pathname} resetToken={resetToken}>{children}</ErrorBoundaryInner>
}

export default ErrorBoundary
