'use client'

import { Suspense, useEffect, useRef } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { useHighlight } from '@/context/highlight-context'
import { HighlightPanel } from '@/components/HighlightPanel'
import { toast } from '@/components/Toast'
import type { FilterMode } from '@/context/highlight-context'
import { scrollToHighlight } from '@/lib/highlight-jump'
import { scrollChatToMessage } from '@/lib/chat-scroller'

function useCurrentChatId(): string | undefined {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const m = pathname.match(/\/project\/[^/]+\/chat\/([^/]+)/)
  if (m) return m[1]
  return searchParams.get('id') ?? undefined
}

function HighlightSidebarImpl() {
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

  const { push }      = useRouter()
  const currentChatId = useCurrentChatId()

  // Stores a pending cross-chat scroll target when the user clicks "Open in chat"
  // on a highlight from a different chat. Cleared once the scroll succeeds.
  const pendingJumpRef = useRef<{ messageId: string; highlightId: string; text: string; startOffset: number } | null>(null)

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

    let timerId: ReturnType<typeof setTimeout>

    // Phase 1: wait up to 20 × 250 ms (5 s) for the message element to appear.
    // Phase 2: once the message is in the DOM, wait up to 20 more × 250 ms (5 s)
    //          for the precise highlight mark (highlights API may still be in flight).
    //          Each phase has its own independent counter so a slow Phase 1 does
    //          not eat into Phase 2's budget.
    const tryScrollMark = (msgEl: Element, markAttempt = 0) => {
      // Check if the precise mark is now in the DOM (highlights API may still be loading)
      const hasMark = !!msgEl.querySelector(`[data-highlight-id="${pending.highlightId}"]`)

      if (hasMark || markAttempt >= 20) {
        pendingJumpRef.current = null
        scrollToHighlight(msgEl, {
          id:          pending.highlightId,
          text:        pending.text,
          startOffset: pending.startOffset,
        })
        toast.success('Jumped to highlight')
        return
      }

      timerId = setTimeout(() => tryScrollMark(msgEl, markAttempt + 1), 250)
    }

    const tryScroll = (attempt = 0) => {
      const msgEl = document.querySelector(`[data-message-id="${pending.messageId}"]`)

      if (!msgEl) {
        // Chat hasn't rendered the message yet — keep waiting (Phase 1)
        if (attempt < 20) timerId = setTimeout(() => tryScroll(attempt + 1), 250)
        return
      }

      // Message is in DOM — start Phase 2 with a fresh counter
      tryScrollMark(msgEl)
    }

    // Brief initial delay to let the chat page begin rendering
    timerId = setTimeout(() => tryScroll(), 300)
    return () => clearTimeout(timerId)
  }, [currentChatId])

  const handleJump = (id: string) => {
    const h = highlights.find(h => h.id === id)
    if (!h?.messageId) return

    // Cross-chat: navigate to the source chat first.
    // Condition covers both "different chat" and "no active chat" (new chat page).
    const isCrossChat = h.chatId && (!currentChatId || h.chatId !== currentChatId)

    if (isCrossChat) {
      pendingJumpRef.current = { messageId: h.messageId, highlightId: id, text: h.text, startOffset: h.startOffset }
      // Switch to 'this-chat' mode so the target chat's highlights load after
      // navigation (filterMode === 'all' blocks loadForChat in the context).
      // The filterMode effect skips loadForChat for the current chat because
      // pendingJumpRef is non-null at that point, avoiding a stale API call.
      if (filterMode === 'all') setFilterMode('this-chat')
      push(`/chat?id=${h.chatId}`)
      return
    }

    // Same chat — virtualizer-aware scroll
    scrollChatToMessage(h.messageId, (msgEl) => {
      scrollToHighlight(msgEl, h)
      toast.success('Jumped to highlight')
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
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
        </m.div>
      )}
    </AnimatePresence>
  )
}

export function HighlightSidebar() {
  return <Suspense fallback={null}><HighlightSidebarImpl /></Suspense>
}
