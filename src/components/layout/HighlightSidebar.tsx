'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useHighlight } from '@/context/highlight-context'
import { HighlightPanel } from '@/components/HighlightPanel'

export function HighlightSidebar() {
  const { highlights, isOpen, close: closeHighlight, deleteHighlight, copyHighlight } = useHighlight()

  const handleJump = (id: string) => {
    const h = highlights.find(h => h.id === id)
    if (!h?.messageId) return

    const msgEl = document.querySelector(`[data-message-id="${h.messageId}"]`)
    if (!msgEl) return

    // data-highlight-id is stamped on every <mark> by the rehype plugin.
    // This gives us a precise DOM target even when the same text appears
    // multiple times in a message.
    const target =
      msgEl.querySelector(`[data-highlight-id="${id}"]`) ??
      // Fallback: first mark whose text content matches (handles the brief
      // window while the temp ID is being swapped for the server UUID).
      Array.from(msgEl.querySelectorAll('mark')).find(
        m => m.textContent?.trim() === h.text.trim(),
      ) ??
      msgEl

    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
