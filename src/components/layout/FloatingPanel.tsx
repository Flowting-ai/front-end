'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { PinIcon, QuillWriteOneIcon } from '@strange-huge/icons'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { JumpTimestampGutter, type GutterMark } from '@/components/JumpTimestampGutter'
import { springs } from '@/lib/springs'
import { usePinboard } from '@/context/pinboard-context'
import { useHighlight } from '@/context/highlight-context'
import { useProjectPanel } from '@/context/project-panel-context'
import { useChatHistoryContext } from '@/context/chat-history-context'
import { useOpenChatPanel } from '@/hooks/use-open-chat-panel'
import { scrollToHighlight } from '@/lib/highlight-jump'
import { scrollChatToMessage } from '@/lib/chat-scroller'
import { sortHighlightsBySourcePosition } from '@/lib/highlight-order'
import { CHAT_ROUTE } from '@/lib/routes'
import { PINS_ENABLED, HIGHLIGHTS_ENABLED } from '@/lib/feature-flags'

// The top bar's Share button ends 44px down the page; the toolbar starts 12px below it.
const TOOLBAR_TOP = 56

// Derives the active chat ID from the URL so the gutter can be filtered
// per-chat. Handles both URL patterns used in the app:
//   • Regular chat : /chat?id={chatId}
//   • Project chat : /project/[projectId]/chat/[chatId]
function useCurrentChatId(): string | undefined {
  const pathname    = usePathname()
  const searchParams = useSearchParams()
  const m = pathname.match(/\/project\/[^/]+\/chat\/([^/]+)/)
  if (m) return m[1]
  return searchParams.get('id') ?? undefined
}

function FloatingPanelImpl() {
  const { isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard, prefetch: prefetchPinboard } = usePinboard()
  const { isOpen: highlightOpen, toggle: toggleHighlight, close: closeHighlight, highlights } = useHighlight()
  const { setPanel: setSidePanel } = useProjectPanel()
  const currentChatId = useCurrentChatId()
  const pathname = usePathname()
  // A read-only chat — not owned by the viewer, or owned but archived (see
  // chat/page.tsx's `activeChatReadOnly`) — has no live chat state to
  // mutate, so the whole floating toolbar stays inert on it too.
  const { chats: chatHistoryChats } = useChatHistoryContext()
  const currentChat = chatHistoryChats.find(c => c.id === currentChatId)
  const isReadOnlyChat = !!currentChat && (currentChat.can_edit === false || currentChat.visibility === 'archived')
  // Archived specifically (not just any read-only chat) hides the toolbar
  // outright instead of showing it disabled — ChatInterface already replaces
  // the composer itself with a plain "this chat is read-only" banner for
  // archived chats, so a grayed-out Pinboard/Agents/Highlights toolbar next
  // to it would be redundant clutter, not a real affordance.
  const isArchivedChat = currentChat?.visibility === 'archived'
  // Agents only works on the regular chat page today (new chat + existing
  // chat are the same /chat route, distinguished by ?id= — see
  // useCurrentChatId above). Nowhere else listens for AGENT_SELECT_EVENT
  // (project chat, /chats, persona chat, etc.), so the trigger would be a
  // dead button there.
  const isChatPage = pathname === CHAT_ROUTE
  const isProjectChatPage = /^\/project\/[^/]+\/chat\//.test(pathname)
  // The chat panel (Context · Browser · Agents) belongs to the regular chat page and project chats:
  // Context describes the open chat, and both listen for AGENT_SELECT_EVENT for Agents.
  const isChatPanelPage = isChatPage || isProjectChatPage
  // Its toggle sits beside the Share button (ChatShareOverlay); here it only closes off chat pages.
  const chatPanel = useOpenChatPanel({ inProject: isProjectChatPage, agentsDisabled: isReadOnlyChat })
  const chatPanelOpen = chatPanel.isOpen

  // If the panel is open and the user navigates off /chat, force it closed —
  // otherwise the side panel context (global, outside this page) would keep
  // showing "Agents" content on a page whose floating menu no longer offers it.
  useEffect(() => {
    if (!isChatPanelPage && chatPanelOpen) setSidePanel(null)
  }, [isChatPanelPage, chatPanelOpen, setSidePanel])

  // The effect above only fires while this component stays mounted. AppLayout
  // unmounts FloatingPanel entirely on some routes (e.g. /projects), which
  // skips it — leaving stale "Agents" content in the (still-mounted) side
  // panel context/sidebar. Close it on unmount too, using a ref so the
  // cleanup sees the latest agentsOpen without re-running on every toggle.
  const ownPanelOpenRef = useRef(chatPanelOpen)
  useEffect(() => {
    ownPanelOpenRef.current = chatPanelOpen
  }, [chatPanelOpen])
  useEffect(() => {
    return () => {
      if (ownPanelOpenRef.current) setSidePanel(null)
    }
  }, [setSidePanel])

  const handleTogglePinboard = () => {
    if (!pinboardOpen) { closeHighlight(); chatPanel.close() }
    togglePinboard()
  }

  const handleToggleHighlight = () => {
    if (!highlightOpen) { closePinboard(); chatPanel.close() }
    toggleHighlight()
  }

  const handleJump = (id: string) => {
    const h = highlights.find(h => h.id === id)
    if (!h?.messageId) return

    // scrollChatToMessage handles both cases:
    //  • message is already rendered → calls back immediately
    //  • message is virtualised out → scrolls the virtualizer first, then calls back
    scrollChatToMessage(h.messageId, (msgEl) => scrollToHighlight(msgEl, h))
  }

  // Only show marks for the current chat. With no chat open (new-chat page),
  // return nothing so stale marks from a previous chat never bleed through.
  // Highlights whose chatId is not yet known are shown as a safe fallback
  // until the backend provides chat_id in the response.
  const gutterMarks: GutterMark[] = useMemo(() => {
    if (!currentChatId) return []

    return sortHighlightsBySourcePosition(
      highlights.filter(h => !h.chatId || h.chatId === currentChatId),
    ).map(h => ({ id: h.id, colorIndex: h.colorIndex }))
  }, [currentChatId, highlights])

  return (
    <>
      {/* Gutter - right edge of chat, between TopBar and FloatingMenu */}
      <AnimatePresence>
        {HIGHLIGHTS_ENABLED && gutterMarks.length > 0 && (
          <m.div
            key="chat-gutter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.moderate}
            style={{
              position: 'absolute',
              right:    28,
              top:      TOOLBAR_TOP + 200,
              zIndex:   10,
            }}
          >
            <JumpTimestampGutter marks={gutterMarks} onJump={handleJump} />
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating toolbar (Pinboard, Highlights — both behind feature flags) - pinned below the top bar. */}
      {!isArchivedChat && (PINS_ENABLED || HIGHLIGHTS_ENABLED) && (
        <div
          style={{
            position:  'absolute',
            right:     16,
            top:       TOOLBAR_TOP + 4,
            zIndex:    10,
          }}
        >
          <div role="toolbar" aria-label="Chat tools" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PINS_ENABLED && (
              <FloatingMenuItem
                icon={<PinIcon size={20} />}
                label="Pinboard"
                active={pinboardOpen}
                disabled={isReadOnlyChat}
                onClick={isReadOnlyChat ? undefined : handleTogglePinboard}
                onMouseEnter={isReadOnlyChat ? undefined : prefetchPinboard}
              />
            )}
            {HIGHLIGHTS_ENABLED && (
              <FloatingMenuItem
                icon={<QuillWriteOneIcon size={20} />}
                label="Highlights"
                active={highlightOpen}
                disabled={isReadOnlyChat}
                onClick={isReadOnlyChat ? undefined : handleToggleHighlight}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function FloatingPanel() {
  return <Suspense fallback={null}><FloatingPanelImpl /></Suspense>
}
