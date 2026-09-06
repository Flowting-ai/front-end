'use client'

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'

/**
 * App-wide "you have unsaved changes" guard — bridges dirty state from a
 * route subtree (e.g. /settings/account) to navigation triggers that live
 * outside it (e.g. LeftSidebar, rendered as a sibling, not a descendant).
 *
 * Single guard for the whole app — both Settings' own sidebar and the main
 * app sidebar route their navigation through this (see `useGuardedRouter`),
 * so there's exactly one "Unsaved changes" dialog rather than one per
 * surface. Any dirty page can customize the dialog's copy (`setGuardMessage`)
 * and optionally register a save action (`setSaveHandler`) so the dialog can
 * offer "Save & Continue" alongside "Discard changes" — pages with nothing
 * to save just leave it unset and get a plain two-button confirm.
 */

export interface GuardMessage {
  title:       string
  description: string
}

const DEFAULT_MESSAGE: GuardMessage = {
  title:       'Unsaved changes',
  description: 'You have unsaved changes. Leaving now will discard them.',
}

type Ctx = {
  isDirty:         boolean
  setIsDirty:      (v: boolean) => void
  /** Runs `action` immediately when not dirty; otherwise stashes it and
   *  surfaces `pendingAction` for a confirmation UI to resolve. */
  guardedNavigate: (action: () => void) => void
  pendingAction:   (() => void) | null
  confirmLeave:    () => void
  cancelLeave:     () => void
  /** Customizes the confirmation dialog's copy for the current dirty page.
   *  Pass null to fall back to the generic message. */
  guardMessage:    GuardMessage | null
  setGuardMessage: (msg: GuardMessage | null) => void
  /** Registers a save action for the current dirty page — return true on
   *  success. When set, the dialog offers "Save & Continue" in addition to
   *  "Discard changes". Pass null to clear (no save option). */
  hasSaveHandler:  boolean
  setSaveHandler:  (fn: (() => Promise<boolean>) | null) => void
  isSaving:        boolean
  saveAndLeave:    () => void
}

const NavGuardContext = createContext<Ctx>({
  isDirty:         false,
  setIsDirty:      () => {},
  guardedNavigate: (action) => action(),
  pendingAction:   null,
  confirmLeave:    () => {},
  cancelLeave:     () => {},
  guardMessage:    null,
  setGuardMessage: () => {},
  hasSaveHandler:  false,
  setSaveHandler:  () => {},
  isSaving:        false,
  saveAndLeave:    () => {},
})

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const [isDirty, setIsDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [guardMessage, setGuardMessage] = useState<GuardMessage | null>(null)
  const [saveFn, setSaveFn] = useState<(() => Promise<boolean>) | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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

  const setSaveHandler = useCallback((fn: (() => Promise<boolean>) | null) => {
    // Function state needs the functional-updater form, or React calls it
    // immediately as if it were a lazy initializer instead of storing it.
    setSaveFn(() => fn)
  }, [])

  const saveAndLeave = useCallback(() => {
    if (!saveFn) { confirmLeave(); return }
    setIsSaving(true)
    void saveFn()
      .then(ok => { if (ok) confirmLeave() })
      .finally(() => setIsSaving(false))
  }, [saveFn, confirmLeave])

  const value = useMemo(
    () => ({
      isDirty, setIsDirty, guardedNavigate, pendingAction, confirmLeave, cancelLeave,
      guardMessage, setGuardMessage,
      hasSaveHandler: saveFn !== null, setSaveHandler,
      isSaving, saveAndLeave,
    }),
    [isDirty, guardedNavigate, pendingAction, confirmLeave, cancelLeave, guardMessage, saveFn, setSaveHandler, isSaving, saveAndLeave],
  )

  return <NavGuardContext.Provider value={value}>{children}</NavGuardContext.Provider>
}

export function useNavGuard() {
  return useContext(NavGuardContext)
}

/**
 * Drop-in replacement for `useRouter()` whose `push` is routed through
 * `guardedNavigate` first. Everything else on the router object passes
 * through unchanged. Intended for components like LeftSidebar/SettingsSidebar
 * that trigger navigation from many places but don't have a per-action
 * save/discard story of their own — they just need "don't navigate away from
 * unsaved work without asking."
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
 * LeftSidebar and SettingsSidebar, regardless of which route subtree
 * currently owns `isDirty`.
 */
export function NavGuardModal() {
  const { pendingAction, confirmLeave, cancelLeave, guardMessage, hasSaveHandler, isSaving, saveAndLeave } = useNavGuard()
  if (!pendingAction) return null

  const message = guardMessage ?? DEFAULT_MESSAGE

  return (
    <div
      role="presentation"
      onClick={() => { if (!isSaving) cancelLeave() }}
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
        aria-label={message.title}
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
          boxShadow: '0px 8px 32px 0px rgba(82,75,71,0.18), 0px 0px 0px 1px var(--neutral-100)',
        }}
      >
        <div>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 16, lineHeight: '24px', color: 'var(--neutral-900)', margin: 0 }}>
            {message.title}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '8px 0 0' }}>
            {message.description}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" size="sm" disabled={isSaving} onClick={cancelLeave}>
            Stay
          </Button>
          {hasSaveHandler ? (
            <>
              <Button variant="ghost" size="sm" disabled={isSaving} onClick={confirmLeave}>
                Discard changes
              </Button>
              <Button variant="default" size="sm" loading={isSaving} onClick={saveAndLeave}>
                Save &amp; Continue
              </Button>
            </>
          ) : (
            <Button variant="danger" size="sm" disabled={isSaving} onClick={confirmLeave}>
              Discard changes
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
