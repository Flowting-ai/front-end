'use client'

import { useEffect, useState } from 'react'
import type { TurnTiming } from '@/lib/chat-context-store'
import { MoreButton } from './blocks'

/**
 * How long the turn has run, ticking while it works and holding its final time after —
 * until a new turn (or another chat) takes over the panel. Null when this tab never saw
 * the turn run, e.g. a chat opened from history.
 */
export function useExecutionSeconds(timing: TurnTiming | undefined, working: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!working) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [working])
  if (!timing) return null
  const end = timing.finishedAt ?? (working ? now : undefined)
  return end === undefined ? null : Math.max(0, Math.round((end - timing.startedAt) / 1000))
}

export type SectionKey = 'progress' | 'agents' | 'connectors' | 'sources' | 'documents' | 'skills'

const VISIBLE_ITEMS = 6

/** Collapsed/expanded per list, without each list keeping its own state shape. */
export function useShowAll() {
  const [all, setAll] = useState<Partial<Record<SectionKey, boolean>>>({})
  return {
    limit: <T,>(key: SectionKey, items: T[]) => (all[key] ? items : items.slice(0, VISIBLE_ITEMS)),
    more:  (key: SectionKey, items: unknown[], noun: string) => items.length > VISIBLE_ITEMS && (
      <MoreButton hidden={items.length - VISIBLE_ITEMS} expanded={!!all[key]} noun={`more ${items.length - VISIBLE_ITEMS === 1 ? noun.replace(/s$/, '') : noun}`} onClick={() => setAll(current => ({ ...current, [key]: !current[key] }))} />
    ),
  }
}
