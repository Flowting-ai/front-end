'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfirmModal } from '@/components/ConfirmModal'
import { useAuth } from '@/context/auth-context'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { msUntilNextPhase, sessionDeadline, sessionLimitsFromEnv, sessionPhase } from '@/lib/auth/session-policy'
import { SESSION_LAST_ACTIVITY_KEY, SESSION_SIGNED_IN_AT_KEY } from '@/lib/storage-keys'

const LIMITS = sessionLimitsFromEnv()
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'focus'] as const
/** Activity writes to storage at most this often (it is shared by every tab). */
const ACTIVITY_WRITE_MS = 15_000

const readTime = (key: string): number | null => {
  try {
    const n = Number(localStorage.getItem(key))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}
const writeTime = (key: string, at: number) => {
  try { localStorage.setItem(key, String(at)) } catch { /* storage unavailable */ }
}

/**
 * Idle / absolute session limits (decision D2). Renders nothing unless
 * NEXT_PUBLIC_SESSION_IDLE_MINUTES or NEXT_PUBLIC_SESSION_MAX_HOURS is set.
 * Activity in any tab counts (shared through localStorage); the warning lets
 * the user stay, and the deadline signs out every tab.
 */
export function SessionTimeoutGuard() {
  const { isAuthenticated, logout } = useAuth()
  const [phase, setPhase] = useState<'active' | 'warning'>('active')
  const enabled = LIMITS !== null && isAuthenticated
  // logout() is a new function each render; keep the timers from resetting.
  const logoutRef = useRef(logout)
  useEffect(() => { logoutRef.current = logout })

  useEffect(() => {
    if (!enabled || !LIMITS) return
    const limits = LIMITS
    const now = Date.now()
    if (readTime(SESSION_SIGNED_IN_AT_KEY) === null) writeTime(SESSION_SIGNED_IN_AT_KEY, now)
    if (readTime(SESSION_LAST_ACTIVITY_KEY) === null) writeTime(SESSION_LAST_ACTIVITY_KEY, now)

    let timer: ReturnType<typeof setTimeout> | undefined
    let lastWrite = 0
    const evaluate = () => {
      clearTimeout(timer)
      const deadline = sessionDeadline(
        limits,
        readTime(SESSION_LAST_ACTIVITY_KEY) ?? Date.now(),
        readTime(SESSION_SIGNED_IN_AT_KEY) ?? Date.now(),
      )
      if (!deadline) return
      const t = Date.now()
      const next = sessionPhase(t, deadline.at, limits.warnMs)
      if (next === 'expired') {
        trackBrowserEvent('auth_session_timed_out', { reason: deadline.reason })
        void logoutRef.current()
        return
      }
      setPhase(next)
      timer = setTimeout(evaluate, msUntilNextPhase(t, deadline.at, limits.warnMs) + 50)
    }
    const onActivity = () => {
      const t = Date.now()
      if (t - lastWrite < ACTIVITY_WRITE_MS) return
      lastWrite = t
      writeTime(SESSION_LAST_ACTIVITY_KEY, t)
      evaluate()
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_LAST_ACTIVITY_KEY || e.key === SESSION_SIGNED_IN_AT_KEY) evaluate()
    }
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true })
    window.addEventListener('storage', onStorage)
    evaluate()
    return () => {
      clearTimeout(timer)
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true })
      window.removeEventListener('storage', onStorage)
    }
  }, [enabled])

  if (!enabled || phase !== 'warning') return null
  return (
    <ConfirmModal
      title="Your session is about to end"
      description="For your security you'll be signed out soon. Stay signed in to keep working."
      confirmLabel="Sign out"
      cancelLabel="Stay signed in"
      onConfirm={() => logout()}
      onClose={() => {
        writeTime(SESSION_LAST_ACTIVITY_KEY, Date.now())
        setPhase('active')
      }}
    />
  )
}
