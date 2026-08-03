'use client'

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/**
 * App-wide "you have unsaved changes" guard — bridges dirty state from a
 * route subtree (e.g. /agent/configure/*) to navigation triggers that live
 * outside it (e.g. LeftSidebar, rendered as a sibling, not a descendant).
 *
 * Unlike settings-guard-context (which guards a fixed set of href pushes and
 * has one obvious per-page save action), LeftSidebar's triggers are
 * heterogeneous — plain pushes, toast+push, conditional branches, logout —
 * so the guard wraps an arbitrary callback (`guardedNavigate`) rather than
 * an href. Confirming just runs the original callback; there's no generic
 * "save" step here because most agent-configure dirtiness already autosaves
 * on tab-switch (see PersonaConfigureProvider) — the thing actually at risk
 * of being lost is an unpublished version, which the confirmation copy
 * should make clear at the call site that owns the modal.
 */

type Ctx = {
  isDirty:         boolean
  setIsDirty:      (v: boolean) => void
  /** Runs `action` immediately when not dirty; otherwise stashes it and
   *  surfaces `pendingAction` for a confirmation UI to resolve. */
  guardedNavigate: (action: () => void) => void
  pendingAction:   (() => void) | null
  confirmLeave:    () => void
  cancelLeave:     () => void
}

const NavGuardContext = createContext<Ctx>({
  isDirty:         false,
  setIsDirty:      () => {},
  guardedNavigate: (action) => action(),
  pendingAction:   null,
  confirmLeave:    () => {},
  cancelLeave:     () => {},
})

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const guardedNavigate = useCallback((action: () => void) => {
    if (isDirty) setPendingAction(() => action)
    else action()
  }, [isDirty])

  const confirmLeave = useCallback(() => {
    setPendingAction(current => {
      current?.()
      return null
    })
    // Leaving discards whatever was pending — the destination page/tab
    // re-derives its own dirty state independently.
    setIsDirty(false)
  }, [])

  const cancelLeave = useCallback(() => setPendingAction(null), [])

  const value = useMemo(
    () => ({ isDirty, setIsDirty, guardedNavigate, pendingAction, confirmLeave, cancelLeave }),
    [isDirty, guardedNavigate, pendingAction, confirmLeave, cancelLeave],
  )

  return <NavGuardContext.Provider value={value}>{children}</NavGuardContext.Provider>
}

export function useNavGuard() {
  return useContext(NavGuardContext)
}

/**
 * Drop-in replacement for `useRouter()` whose `push` is routed through
 * `guardedNavigate` first. Everything else on the router object passes
 * through unchanged. Intended for components like LeftSidebar that trigger
 * navigation from many places but don't have a per-action save/discard
 * story of their own — they just need "don't navigate away from unsaved
 * work without asking."
 */
export function useGuardedRouter() {
  const router = useRouter()
  const { guardedNavigate } = useNavGuard()
  const push = useCallback(
    (href: Parameters<typeof router.push>[0], options?: Parameters<typeof router.push>[1]) => {
      guardedNavigate(() => router.push(href, options))
    },
    [router, guardedNavigate],
  )
  return { ...router, push }
}

/**
 * Global "Unsaved changes" confirmation — mounted once (see (app)/layout.tsx)
 * so it can intercept navigation triggered from anywhere, including
 * LeftSidebar, regardless of which route subtree currently owns `isDirty`.
 */
export function NavGuardModal() {
  const { pendingAction, confirmLeave, cancelLeave } = useNavGuard()
  if (!pendingAction) return null

  return (
    <div
      role="presentation"
      onClick={cancelLeave}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(18,12,8,0.4)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved changes"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--neutral-white, #fff)',
          borderRadius: 16,
          padding: 24,
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: '0px 8px 32px 0px rgba(38,33,30,0.18), 0px 0px 0px 1px var(--neutral-100)',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            Unsaved changes
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            You have unpublished changes to this agent. Leaving now may lose work that hasn&apos;t been saved as a version.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={cancelLeave}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', boxShadow: '0px 0px 0px 1px rgba(59,54,50,0.3)',
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: 'var(--neutral-700)',
            }}
          >
            Stay
          </button>
          <button
            type="button"
            onClick={confirmLeave}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              backgroundColor: 'var(--neutral-900, #26211e)',
              fontFamily: 'var(--font-body)', fontWeight: 500, fontSize: 14, color: '#fff',
            }}
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  )
}
