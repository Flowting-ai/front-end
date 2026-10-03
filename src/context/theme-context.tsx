'use client'

import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { THEMING_ENABLED } from '@/lib/feature-flags'
import {
  DEFAULT_THEME_MODE,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  readStoredMode,
  resolveTheme,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme'

interface ThemeContextValue {
  /** False while the theming flag is off — the selector should stay as it was. */
  enabled:  boolean
  mode:     ThemeMode
  resolved: ResolvedTheme
  setMode:  (mode: ThemeMode) => void
}

// Used when the flag is off: constant, never re-renders, never touches the DOM.
const INERT: ThemeContextValue = {
  enabled:  false,
  mode:     DEFAULT_THEME_MODE,
  resolved: 'light',
  setMode:  () => {},
}

const ThemeContext = createContext<ThemeContextValue>(INERT)

// ── External stores (so no setState-in-effect, and SSR-safe) ──────────────────

function subscribeMode(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
  }
}
const getModeSnapshot = (): ThemeMode => readStoredMode(window.localStorage)
const getModeServerSnapshot = (): ThemeMode => DEFAULT_THEME_MODE

const DARK_QUERY = '(prefers-color-scheme: dark)'
function subscribeSystem(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getSystemSnapshot = (): boolean => window.matchMedia(DARK_QUERY).matches
const getSystemServerSnapshot = (): boolean => false

// ── Provider ──────────────────────────────────────────────────────────────────

function ThemeProviderImpl({ children }: { children: React.ReactNode }) {
  const mode       = useSyncExternalStore(subscribeMode, getModeSnapshot, getModeServerSnapshot)
  const systemDark = useSyncExternalStore(subscribeSystem, getSystemSnapshot, getSystemServerSnapshot)
  const resolved   = resolveTheme(mode, systemDark)

  // The only side effect: mirror the resolved theme onto <html>. The inline init
  // script (THEME_INIT_SCRIPT) already did this before first paint for a stored
  // Dark/System choice, so this is a no-op on load and handles later changes.
  useEffect(() => {
    applyResolvedTheme(document.documentElement, resolved)
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode / blocked) — the choice just won't persist.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ enabled: true, mode, resolved, setMode }),
    [mode, resolved, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  if (!THEMING_ENABLED) {
    return <ThemeContext.Provider value={INERT}>{children}</ThemeContext.Provider>
  }
  return <ThemeProviderImpl>{children}</ThemeProviderImpl>
}

export function useTheme(): ThemeContextValue {
  return use(ThemeContext)
}
