'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { Button } from '@/components/Button'
import type { AvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { AgentAvatar } from './AgentAvatar'
import { AvatarCarousel } from './AvatarCarousel'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface AvatarFieldProps {
  name:      string
  value:     AvatarChoice
  /** Called when a choice is confirmed with "Select". */
  onChange:  (choice: AvatarChoice) => void
  disabled?: boolean
  /** Label of the button that opens the picker. @default 'Change avatar' */
  buttonLabel?: string
}

/**
 * The agent's avatar, centred: just the current avatar and a "Change avatar" button.
 * The button opens the carousel in place; browsing it changes nothing until "Select",
 * and "Cancel" puts the current one back.
 */
export function AvatarField({ name, value, onChange, disabled = false, buttonLabel = 'Change avatar' }: AvatarFieldProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<AvatarChoice>(value)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <p style={LABEL_STYLE}>Avatar</p>

      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <m.div
            key="picker"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}
          >
            <AvatarCarousel value={pending} onChange={setPending} disabled={disabled} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="default"
                size="sm"
                disabled={disabled}
                onClick={() => { if (pending !== value) onChange(pending); setOpen(false) }}
              >
                Select
              </Button>
            </div>
          </m.div>
        ) : (
          <m.div
            key="current"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
          >
            <AgentAvatar name={name} choice={value} size={88} />
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => { setPending(value); setOpen(true) }}>
              {buttonLabel}
            </Button>
          </m.div>
        )}
      </AnimatePresence>

      <p style={{ ...HINT_STYLE, textAlign: 'center' }}>Shows on the agent card, in chat and in pickers.</p>
    </div>
  )
}
