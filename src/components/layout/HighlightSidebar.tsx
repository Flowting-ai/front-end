'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useHighlight } from '@/context/highlight-context'
import { HighlightPanel } from '@/components/HighlightPanel'
import { toast } from '@/components/Toast'
import type { FilterMode } from '@/context/highlight-context'

function useCurrentChatId(): string | undefined {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const m = pathname.match(/\/project\/[^/]+\/chat\/([^/]+)/)
  if (m) return m[1]
  return searchParams.get('id') ?? undefined
}

export function HighlightSidebar() {
  const {
    highlights,
    isOpen,
    close:           closeHighlight,
    deleteHighlight,
    copyHighlight,
    loadAll,
    loadForChat,
    filterMode,
    setFilterMode,
  } = useHighlight()

  const router        = useRouter()
  const currentChatId = useCurrentChatId()

  // Stores a pending cross-chat scroll target when the user clicks "Open in chat"
  // on a highlight from a different chat. Cleared once the scroll succeeds.
  const pendingJumpRef = useRef<{ messageId: string; highlightId: string; text: string } | null>(null)

  // When filterMode changes, load the appropriate data.
  // Skip the loadForChat call if we're mid-navigation for a cross-chat jump —
  // chat/page.tsx's loadForChat will load the correct chat once activeChatId updates.
  // This prevents a stale-chat API call racing the correct one.
  useEffect(() => {
    if (filterMode === 'all') {
      loadAll()
    } else if (currentChatId && pendingJumpRef.current === null) {
      loadForChat(currentChatId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMode])

  // After a cross-chat navigation currentChatId changes. Poll the DOM for the
  // target message and highlight mark — the chat and its highlights both render
  // asynchronously after navigation.
  //
  // Two-phase retry:
  //   Phase 1 — message not in DOM yet:  retry up to 20× (5 s) waiting for the
  //             chat to render its message list.
  //   Phase 2 — message found, mark missing: the highlight data may still be
  //             loading (API call in flight). Keep retrying until the
  //             data-highlight-id element appears, then do the precise scroll.
  //             After 20 combined attempts fall back to the message container.
  useEffect(() => {
    const pending = pendingJumpRef.current
    if (!pending) return

    let cancelled = false

    const tryScroll = (attempt = 0) => {
      if (cancelled) return

      const msgEl = document.querySelector(`[data-message-id="${pending.messageId}"]`)

      if (!msgEl) {
        // Chat hasn't rendered the message yet — keep waiting
        if (attempt < 20) setTimeout(() => tryScroll(attempt + 1), 250)
        return
      }

      // Message is in DOM. Try to find the precise highlight mark.
      const preciseMark =
        msgEl.querySelector(`[data-highlight-id="${pending.highlightId}"]`) ??
        Array.from(msgEl.querySelectorAll('mark')).find(
          m => m.textContent?.trim() === pending.text.trim(),
        ) ?? null

      if (preciseMark) {
        pendingJumpRef.current = null
        preciseMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
        toast.success('Jumped to highlight')
        return
      }

      // Mark not rendered yet — highlights API call may still be in flight.
      // Keep retrying for a precise scroll; fall back to message after 20 attempts.
      if (attempt < 20) {
        setTimeout(() => tryScroll(attempt + 1), 250)
        return
      }

      // Exhausted — scroll to message container as best effort
      pendingJumpRef.current = null
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      toast.success('Jumped to message')
    }

    // Brief initial delay to let the chat page begin rendering
    setTimeout(() => tryScroll(), 300)
    return () => { cancelled = true }
  }, [currentChatId])

  const handleJump = (id: string) => {
    const h = highlights.find(h => h.id === id)
    if (!h?.messageId) return

    // Cross-chat: navigate to the source chat first.
    // Condition covers both "different chat" and "no active chat" (new chat page).
    const isCrossChat = h.chatId && (!currentChatId || h.chatId !== currentChatId)

    if (isCrossChat) {
      pendingJumpRef.current = { messageId: h.messageId, highlightId: id, text: h.text }
      // Switch to 'this-chat' mode so the target chat's highlights load after
      // navigation (filterMode === 'all' blocks loadForChat in the context).
      // The filterMode effect skips loadForChat for the current chat because
      // pendingJumpRef is non-null at that point, avoiding a stale API call.
      if (filterMode === 'all') setFilterMode('this-chat')
      router.push(`/chat?id=${h.chatId}`)
      return
    }

    // Same chat — scroll directly
    const msgEl = document.querySelector(`[data-message-id="${h.messageId}"]`)
    if (!msgEl) return

    const target =
      msgEl.querySelector(`[data-highlight-id="${id}"]`) ??
      Array.from(msgEl.querySelectorAll('mark')).find(
        m => m.textContent?.trim() === h.text.trim(),
      ) ??
      msgEl

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    toast.success('Jumped to highlight')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="highlight-sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 332, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }}
          style={{ height: '100%', flexShrink: 0, overflow: 'hidden' }}
        >
          <HighlightPanel
            highlights={highlights}
            onJump={handleJump}
            onCopy={copyHighlight}
            onDelete={deleteHighlight}
            onClose={closeHighlight}
            filterMode={filterMode}
            onFilterChange={setFilterMode}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
