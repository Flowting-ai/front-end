'use client'

import { useState } from 'react'
import { PinIcon, AtomOneIcon, QuillWriteOneIcon } from '@strange-huge/icons'
import { FloatingMenu } from '@/components/FloatingMenu'
import { FloatingMenuItem } from '@/components/FloatingMenuItem'
import { usePinboard } from '@/context/pinboard-context'

export function FloatingPanel() {
  const { isOpen: pinboardOpen, toggle: togglePinboard } = usePinboard()
  const [compareOpen, setCompareOpen] = useState(false)
  const [highlightsOpen, setHighlightsOpen] = useState(false)

  return (
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
          onClick={togglePinboard}
        />
        <FloatingMenuItem
          icon={<AtomOneIcon size={20} />}
          label="Compare LLMs"
          active={compareOpen}
          onClick={() => setCompareOpen((v) => !v)}
        />
        <FloatingMenuItem
          icon={<QuillWriteOneIcon size={20} />}
          label="Highlights"
          active={highlightsOpen}
          onClick={() => setHighlightsOpen((v) => !v)}
        />
      </FloatingMenu>
    </div>
  )
}
