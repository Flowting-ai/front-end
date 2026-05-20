'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { toast } from '@/components/Toast'
import { createHighlight, removeHighlight, getHighlights, getAllHighlights } from '@/lib/api/highlights'
import type { HighlightResponse } from '@/lib/api/highlights'
import { ApiError } from '@/lib/api/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export type FilterMode = 'this-chat' | 'all'

export interface HighlightEntry {
  id:          string
  /** Stable across the temp→server-ID swap. Use this as the React key to prevent remount animations. */
  renderKey:   string
  text:        string
  colorIndex:  0 | 1 | 2 | 3
  messageId:   string
  startOffset: number
  endOffset:   number
  chatId?:     string
}

interface HighlightDataValue {
  highlights:  HighlightEntry[]
  isOpen:      boolean
  filterMode:  FilterMode
}

interface HighlightActionsValue {
  open:            () => void
  close:           () => void
  toggle:          () => void
  setFilterMode:   (mode: FilterMode) => void
  /** Load / reload highlights for the given chat from the backend. */
  loadForChat:     (chatId: string) => void
  /** Load all highlights across every chat from the backend. */
  loadAll:         () => void
  addHighlight:    (entry: Omit<HighlightEntry, 'id' | 'colorIndex' | 'renderKey'>) => Promise<string>
  deleteHighlight: (id: string) => Promise<void>
  copyHighlight:   (id: string) => void
}

/** Combined shape — kept for backward compatibility. */
interface HighlightContextValue extends HighlightDataValue, HighlightActionsValue {}

// ── Contexts ──────────────────────────────────────────────────────────────────

const HighlightDataContext    = createContext<HighlightDataValue | null>(null)
const HighlightActionsContext = createContext<HighlightActionsValue | null>(null)

// ── Response → Entry mapper ────────────────────────────────────────────────────

function responseToEntry(r: HighlightResponse): HighlightEntry {
  return {
    id:          r.id,
    renderKey:   r.id,
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
  const [highlights,  setHighlights]  = useState<HighlightEntry[]>([])
  const [isOpen,      setIsOpen]      = useState(false)
  const [filterMode,  setFilterMode]  = useState<FilterMode>('this-chat')

  // Refs kept in sync with state so callbacks can read current values without
  // stale-closure issues. Updated during render so they are always current.
  const highlightsRef = useRef<HighlightEntry[]>([])
  const filterModeRef = useRef<FilterMode>('this-chat')
  highlightsRef.current = highlights
  filterModeRef.current = filterMode

  // ── Actions (stable refs — never change identity) ─────────────────────────

  const loadForChat = useCallback((chatId: string) => {
    if (filterModeRef.current === 'all') return
    getHighlights(chatId)
      .then(data => setHighlights(data.map(responseToEntry)))
      .catch(() => {/* silently ignore */})
  }, [])

  const loadAll = useCallback(() => {
    getAllHighlights()
      .then(data => setHighlights(data.map(responseToEntry)))
      .catch(() => {/* silently ignore */})
  }, [])

  const open   = useCallback(() => setIsOpen(true),    [])
  const close  = useCallback(() => setIsOpen(false),   [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  const handleSetFilterMode = useCallback((mode: FilterMode) => setFilterMode(mode), [])

  const addHighlight = useCallback(async (
    entry: Omit<HighlightEntry, 'id' | 'colorIndex' | 'renderKey'>,
  ): Promise<string> => {
    const tempId     = `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const colorIndex = (highlightsRef.current.length % 4) as 0 | 1 | 2 | 3

    setHighlights(prev => [{ ...entry, id: tempId, colorIndex, renderKey: tempId }, ...prev])

    try {
      const result = await createHighlight({
        message_id:    entry.messageId,
        selected_text: entry.text,
        start_offset:  entry.startOffset,
        end_offset:    entry.endOffset,
        color_index:   colorIndex,
      })
      setHighlights(prev =>
        prev.map(h => h.id === tempId ? { ...responseToEntry(result), chatId: entry.chatId, renderKey: h.renderKey } : h),
      )
      toast.success('Highlight saved')
      return result.id
    } catch (err) {
      setHighlights(prev => prev.filter(h => h.id !== tempId))
      toast.error('Failed to save highlight', {
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
      return tempId
    }
  }, [])

  const deleteHighlight = useCallback(async (id: string): Promise<void> => {
    if (id.startsWith('hl-')) {
      setHighlights(prev => prev.filter(h => h.id !== id))
      return
    }

    const rollback = highlightsRef.current.find(h => h.id === id)
    setHighlights(prev => prev.filter(h => h.id !== id))

    try {
      await removeHighlight(id)
      toast.success('Highlight deleted')
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
    if (h) {
      navigator.clipboard.writeText(h.text)
        .then(() => toast.success('Copied to clipboard'))
        .catch(() => toast.error('Failed to copy'))
    }
  }, [])

  const actions: HighlightActionsValue = {
    open, close, toggle,
    setFilterMode: handleSetFilterMode,
    loadForChat, loadAll,
    addHighlight, deleteHighlight, copyHighlight,
  }

  return (
    <HighlightActionsContext.Provider value={actions}>
      <HighlightDataContext.Provider value={{ highlights, isOpen, filterMode }}>
        {children}
      </HighlightDataContext.Provider>
    </HighlightActionsContext.Provider>
  )
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Backward-compatible hook — subscribes to both data and actions. */
export function useHighlight(): HighlightContextValue {
  const data    = useContext(HighlightDataContext)
  const actions = useContext(HighlightActionsContext)
  if (!data || !actions) throw new Error('useHighlight must be used within HighlightProvider')
  return { ...data, ...actions }
}

/** Actions-only hook — does NOT re-render when highlights/isOpen/filterMode change. */
export function useHighlightActions(): HighlightActionsValue {
  const actions = useContext(HighlightActionsContext)
  if (!actions) throw new Error('useHighlightActions must be used within HighlightProvider')
  return actions
}
