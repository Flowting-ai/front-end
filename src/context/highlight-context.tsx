'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HighlightEntry {
  id:         string
  text:       string
  messageId?: string
  chatId?:    string
}

interface HighlightContextValue {
  highlights:      HighlightEntry[]
  isOpen:          boolean
  open:            () => void
  close:           () => void
  toggle:          () => void
  addHighlight:    (entry: Omit<HighlightEntry, 'id'>) => string
  deleteHighlight: (id: string) => void
  copyHighlight:   (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const HighlightContext = createContext<HighlightContextValue | null>(null)

// ── Provider ──────────────────────────────────────────────────────────────────

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [isOpen,     setIsOpen]     = useState(false)

  const open   = useCallback(() => setIsOpen(true),          [])
  const close  = useCallback(() => setIsOpen(false),         [])
  const toggle = useCallback(() => setIsOpen(v => !v),       [])

  const addHighlight = useCallback((entry: Omit<HighlightEntry, 'id'>): string => {
    const id = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setHighlights(prev => [{ ...entry, id }, ...prev])
    return id
  }, [])

  const deleteHighlight = useCallback((id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id))
  }, [])

  const copyHighlight = useCallback((id: string) => {
    setHighlights(prev => {
      const h = prev.find(h => h.id === id)
      if (h) navigator.clipboard.writeText(h.text).catch(() => {})
      return prev
    })
  }, [])

  return (
    <HighlightContext.Provider
      value={{ highlights, isOpen, open, close, toggle, addHighlight, deleteHighlight, copyHighlight }}
    >
      {children}
    </HighlightContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useHighlight(): HighlightContextValue {
  const ctx = useContext(HighlightContext)
  if (!ctx) throw new Error('useHighlight must be used within HighlightProvider')
  return ctx
}
