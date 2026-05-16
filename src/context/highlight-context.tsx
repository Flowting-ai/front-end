'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { createHighlight, removeHighlight, getHighlights } from '@/lib/api/highlights'
import type { HighlightResponse } from '@/lib/api/highlights'
import { ApiError } from '@/lib/api/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HighlightEntry {
  id:          string
  text:        string
  colorIndex:  0 | 1 | 2 | 3
  messageId:   string
  startOffset: number
  endOffset:   number
  chatId?:     string
}

interface HighlightContextValue {
  highlights:      HighlightEntry[]
  isOpen:          boolean
  open:            () => void
  close:           () => void
  toggle:          () => void
  addHighlight:    (entry: Omit<HighlightEntry, 'id' | 'colorIndex'>) => Promise<string>
  deleteHighlight: (id: string) => Promise<void>
  copyHighlight:   (id: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const HighlightContext = createContext<HighlightContextValue | null>(null)

// ── Response → Entry mapper ────────────────────────────────────────────────────

function responseToEntry(r: HighlightResponse): HighlightEntry {
  return {
    id:          r.id,
    text:        r.selected_text,
    colorIndex:  (r.color_index % 4) as 0 | 1 | 2 | 3,
    messageId:   r.message_id,
    startOffset: r.start_offset,
    endOffset:   r.end_offset,
    chatId:      r.chat_id,
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [highlights, setHighlights] = useState<HighlightEntry[]>([])
  const [isOpen,     setIsOpen]     = useState(false)

  // Ref kept in sync with state so callbacks can read current entries without
  // stale-closure issues (avoids adding `highlights` to every dep array).
  const highlightsRef = useRef<HighlightEntry[]>([])
  useEffect(() => { highlightsRef.current = highlights }, [highlights])

  // ── Load persisted highlights on mount ────────────────────────────────────
  useEffect(() => {
    getHighlights()
      .then(data => setHighlights(data.map(responseToEntry)))
      .catch(() => {/* silently ignore - user starts with empty list */})
  }, [])

  const open   = useCallback(() => setIsOpen(true),        [])
  const close  = useCallback(() => setIsOpen(false),       [])
  const toggle = useCallback(() => setIsOpen(v => !v),     [])

  /**
   * Optimistically inserts the highlight, calls the backend, then swaps the
   * temporary client ID for the server UUID. Rolls back on failure.
   */
  const addHighlight = useCallback(async (
    entry: Omit<HighlightEntry, 'id' | 'colorIndex'>,
  ): Promise<string> => {
    const tempId     = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const colorIndex = (highlightsRef.current.length % 4) as 0 | 1 | 2 | 3

    setHighlights(prev => [{ ...entry, id: tempId, colorIndex }, ...prev])

    try {
      const result = await createHighlight({
        message_id:    entry.messageId,
        selected_text: entry.text,
        start_offset:  entry.startOffset,
        end_offset:    entry.endOffset,
        color_index:   colorIndex,
      })
      // Replace temp ID and apply all server-assigned fields via the shared mapper.
      setHighlights(prev =>
        prev.map(h => h.id === tempId ? { ...responseToEntry(result), chatId: entry.chatId } : h),
      )
      return result.id
    } catch (err) {
      setHighlights(prev => prev.filter(h => h.id !== tempId))
      toast.error('Failed to save highlight', {
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
      return tempId
    }
  }, [])

  /**
   * Optimistically removes the highlight, calls the backend. Rolls back and
   * shows a toast if the request fails.
   * Temp IDs (creation still in-flight) are removed locally only - the server
   * has never seen them.
   */
  const deleteHighlight = useCallback(async (id: string): Promise<void> => {
    if (id.startsWith('hl-')) {
      setHighlights(prev => prev.filter(h => h.id !== id))
      return
    }

    const rollback = highlightsRef.current.find(h => h.id === id)
    setHighlights(prev => prev.filter(h => h.id !== id))

    try {
      await removeHighlight(id)
    } catch (err) {
      if (rollback) {
        setHighlights(prev => [rollback, ...prev.filter(h => h.id !== id)])
      }
      toast.error('Failed to delete highlight', {
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    }
  }, [])

  const copyHighlight = useCallback((id: string) => {
    const h = highlightsRef.current.find(h => h.id === id)
    if (h) navigator.clipboard.writeText(h.text).catch(() => {})
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
