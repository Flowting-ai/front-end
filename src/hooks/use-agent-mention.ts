'use client'

import { useCallback, useRef, useState } from 'react'
import type React from 'react'
import { useSelectableChatPersonas } from '@/hooks/use-selectable-chat-personas'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { filterAgents, findMention, removeMention, type MentionToken } from '@/lib/agent-mention'

/**
 * `@agent` in the chat box: while the caret is inside an `@word`, offers the user's
 * agents; picking one removes the `@word` and hands the agent to the host.
 *
 * The chat box feeds it every text change (`update`) and every key press
 * (`onKeyDown`, which returns true when the key was used by the menu).
 */
export function useAgentMention(args: {
  enabled: boolean
  /** Writes new text into the chat box and puts the caret back. */
  applyText: (text: string, caret: number) => void
  onSelect: (agent: SelectedPersonaInfo) => void
}) {
  const { enabled, applyText, onSelect } = args
  const [token, setToken] = useState<MentionToken | null>(null)
  const [dismissedStart, setDismissedStart] = useState<number | null>(null)
  const [active, setActive] = useState(0)
  // The text the token was found in, so a pick can remove it without re-reading the DOM.
  const snapshot = useRef({ text: '', caret: 0 })

  const open = enabled && token !== null && token.start !== dismissedStart
  const { personas, loading } = useSelectableChatPersonas(open)
  const items = open && token ? filterAgents(personas, token.query) : []
  const activeIndex = items.length === 0 ? 0 : Math.min(active, items.length - 1)

  const update = useCallback((text: string, caret: number) => {
    snapshot.current = { text, caret }
    const next = findMention(text, caret)
    setToken(previous => (previous?.start === next?.start && previous?.query === next?.query ? previous : next))
    setActive(0)
    if (!next) setDismissedStart(null)
  }, [])

  const close = useCallback(() => {
    setDismissedStart(token?.start ?? null)
  }, [token])

  const select = useCallback((agent: SelectedPersonaInfo) => {
    if (!token) return
    const { text, caret } = removeMention(snapshot.current.text, token, snapshot.current.caret)
    setToken(null)
    setDismissedStart(null)
    applyText(text, caret)
    onSelect(agent)
  }, [token, applyText, onSelect])

  const onKeyDown = useCallback((event: React.KeyboardEvent): boolean => {
    if (!open) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return true
    }
    if (items.length === 0) return false
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((activeIndex + 1) % items.length)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((activeIndex - 1 + items.length) % items.length)
      return true
    }
    if ((event.key === 'Enter' && !event.shiftKey) || event.key === 'Tab') {
      event.preventDefault()
      select(items[activeIndex])
      return true
    }
    return false
  }, [open, items, activeIndex, close, select])

  return { open, items, loading, activeIndex, setActive, update, select, close, onKeyDown }
}
