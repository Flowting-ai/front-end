'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { PinIcon, AtomOneIcon, QuillWriteOneIcon } from '@strange-huge/icons'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { JumpTimestampGutter, type GutterMark } from '@/components/JumpTimestampGutter'
import { springs } from '@/lib/springs'
import { usePinboard } from '@/context/pinboard-context'
import { useHighlight } from '@/context/highlight-context'
import { useCompare } from '@/context/compare-context'

export function FloatingPanel() {
  const { isOpen: pinboardOpen, toggle: togglePinboard, close: closePinboard } = usePinboard()
  const { isOpen: highlightOpen, toggle: toggleHighlight, close: closeHighlight, highlights } = useHighlight()
  const { isOpen: compareOpen, toggle: toggleCompare } = useCompare()

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
    const el = document.querySelector(`[data-message-id="${h.messageId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const gutterMarks: GutterMark[] = highlights.map((h, i) => ({
    id: h.id,
    colorIndex: (i % 4) as 0 | 1 | 2 | 3,
  }))

  return (
    <>
      {/* Gutter — right edge of chat, between TopBar and FloatingMenu */}
      <AnimatePresence>
        {highlightOpen && gutterMarks.length > 0 && (
          <motion.div
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toolbar — vertically centered */}
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
            label="Pin board"
            active={pinboardOpen}
            disabled
            onClick={handleTogglePinboard}
          />
          <FloatingMenuItem
            icon={<AtomOneIcon size={20} />}
            label="Compare LLMs"
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
