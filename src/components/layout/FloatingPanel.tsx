'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { PinIcon, AtomOneIcon, QuillWriteOneIcon } from '@strange-huge/icons'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { JumpTimestampGutter, type GutterMark } from '@/components/JumpTimestampGutter'
import { springs } from '@/lib/springs'
import { usePinboard } from '@/context/pinboard-context'
import { useHighlight } from '@/context/highlight-context'
import { useCompare } from '@/context/compare-context'

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
  const { isOpen: compareOpen, toggle: toggleCompare } = useCompare()
  const currentChatId = useCurrentChatId()

  const handleTogglePinboard = () => {
    if (!pinboardOpen) closeHighlight()
    togglePinboard()
  }

  const handleToggleHighlight = () => {
    if (!highlightOpen) closePinboard()
    toggleHighlight()
  }

  const handleJump = (id: string) => {
    const h = highlights.find(h => h.id === id)
    if (!h?.messageId) return

    const msgEl = document.querySelector(`[data-message-id="${h.messageId}"]`)
    if (!msgEl) return

    // Prefer the precise inline mark; fall back to text-content match; last
    // resort is the message container itself.
    const target =
      msgEl.querySelector(`[data-highlight-id="${id}"]`) ??
      Array.from(msgEl.querySelectorAll('mark')).find(
        m => m.textContent?.trim() === h.text.trim(),
      ) ??
      msgEl

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Only show marks for the current chat. With no chat open (new-chat page),
  // return nothing so stale marks from a previous chat never bleed through.
  // Highlights whose chatId is not yet known are shown as a safe fallback
  // until the backend provides chat_id in the response.
  const gutterMarks: GutterMark[] = currentChatId
    ? highlights
        .flatMap(h => (!h.chatId || h.chatId === currentChatId) ? [{ id: h.id, colorIndex: h.colorIndex }] : [])
    : []

  return (
    <>
      {/* Gutter - right edge of chat, between TopBar and FloatingMenu */}
      <AnimatePresence>
        {gutterMarks.length > 0 && (
          <m.div
            key="chat-gutter"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springs.moderate}
            style={{
              position: 'absolute',
              right:    28,
              top:      120,
              zIndex:   10,
            }}
          >
            <JumpTimestampGutter marks={gutterMarks} onJump={handleJump} />
          </m.div>
        )}
      </AnimatePresence>

      {/* Floating toolbar - vertically centered */}
      <div
        style={{
          position:  'absolute',
          right:     16,
          top:       '50%',
          transform: 'translateY(-50%)',
          zIndex:    10,
        }}
      >
        <FloatingMenu aria-label="Chat tools">
          <FloatingMenuItem
            icon={<PinIcon size={20} />}
            label="Pinboard"
            active={pinboardOpen}
            onClick={handleTogglePinboard}
            onMouseEnter={prefetchPinboard}
          />
          <FloatingMenuItem
            icon={<AtomOneIcon size={20} />}
            label="Compare Models"
            active={compareOpen}
            onClick={toggleCompare}
          />
          <FloatingMenuItem
            icon={<QuillWriteOneIcon size={20} />}
            label="Highlights"
            active={highlightOpen}
            onClick={handleToggleHighlight}
          />
        </FloatingMenu>
      </div>
    </>
  )
}

export function FloatingPanel() {
  return <Suspense fallback={null}><FloatingPanelImpl /></Suspense>
}
