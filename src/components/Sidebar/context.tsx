'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarContextValue {
  /** Whether the sidebar is open */
  open: boolean
  /** Programmatically set open state */
  setOpen: (open: boolean) => void
  /** Toggle open ↔ closed */
  toggleSidebar: () => void
}

export interface SidebarProviderProps {
  children: React.ReactNode
  /**
   * Initial open state.
   * If a `sidebar:state` cookie is present it takes precedence.
   * @default true
   */
  defaultOpen?: boolean
}

// ── Context ────────────────────────────────────────────────────────────────────

const SidebarContext = createContext<SidebarContextValue | null>(null)

// ── Cookie helpers ─────────────────────────────────────────────────────────────

const COOKIE_KEY     = 'sidebar:state'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function readCookie(): boolean | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_KEY}=([^;]+)`))
  return match ? match[1] === 'true' : null
}

function writeCookie(value: boolean) {
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SidebarProvider({
  children,
  defaultOpen = true,
}: SidebarProviderProps) {
  const [open, setOpenState] = useState<boolean>(() => readCookie() ?? defaultOpen)

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value)
    writeCookie(value)
  }, [])

  const toggleSidebar = useCallback(() => setOpen(!open), [open, setOpen])

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('[Kaya] useSidebar must be used inside <SidebarProvider>')
  return ctx
}
