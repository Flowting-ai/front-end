'use client'

import React, { useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { BubbleChatAddIcon, LinkSixIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { AnimatedPersonaAvatar, defaultAvatarChoice, getAvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

// ── Compact agent card ────────────────────────────────────────────────────────
// A one-row version of the agent card for the narrow agents panel (~64px tall vs the
// 264px grid card): live avatar in a tinted halo, name, one line of description, and on
// the right either quiet status (paused / Super Link) or — on hover — a "Use" pill that
// slides in. Hovering also lets the avatar play its sink-and-spring animation and floats
// the row up a pixel; clicking the row opens the agent's details.

const AVATAR = 40
const HALO = 4

export interface CompactAgentCardProps {
  agent:     SelectedPersonaInfo
  superlink: boolean
  /** Accessible name + tooltip of the hover icon button. */
  useLabel?: string
  /** Row clicked — open details. */
  onOpen:    () => void
  /** Hover button clicked — use the agent. */
  onUse:     () => void
}

export function CompactAgentCard({ agent, superlink, useLabel = 'Use agent', onOpen, onUse }: CompactAgentCardProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)
  const active = hovered || focused
  const stored = useStoredAvatarChoice(agent.id)
  const avatar = getAvatarChoice(stored ?? defaultAvatarChoice(agent.name, agent.id))
  const tint = avatar.colors[0]

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${agent.name} — open details`}
      onClick={event => {
        if ((event.target as HTMLElement).closest('button')) return
        setBounceKey(n => n + 1)
        onOpen()
      }}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen() } }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="kaya-field"
      style={{
        position:        'relative',
        display:         'flex',
        alignItems:      'center',
        gap:             12,
        width:           '100%',
        boxSizing:       'border-box',
        padding:         '10px 12px 10px 12px',
        borderRadius:    14,
        cursor:          'pointer',
        overflow:        'hidden',
        backgroundColor: 'var(--agent-card-bg)',
        backgroundImage: 'var(--agent-card-gradient)',
        // Same trick as the full card: rests zoomed in, relaxes to the full gradient on hover.
        backgroundSize:  active ? '100% 100%' : '260% 260%',
        backgroundPosition: 'center',
        boxShadow:       active
          ? '0px 3px 8px -2px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-400)'
          : '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
        transform:       active ? 'translateY(-1px)' : 'none',
        opacity:         agent.paused ? 0.7 : 1,
        transition:      'box-shadow 200ms, transform 200ms cubic-bezier(0.22, 1, 0.36, 1), background-size 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms',
      }}
      data-surface="raised"
    >
      {/* Avatar in a halo of its own colour */}
      <div style={{ position: 'relative', width: AVATAR, height: AVATAR, margin: HALO, flexShrink: 0 }}>
        <div
          aria-hidden
          style={{
            position:        'absolute',
            inset:           -HALO,
            borderRadius:    '50%',
            backgroundColor: `color-mix(in srgb, ${tint} 40%, transparent)`,
            transform:       active ? 'scale(1.12)' : 'scale(1)',
            transition:      'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
        <div style={{ position: 'relative', borderRadius: '50%', backgroundColor: 'var(--static-white)' }}>
          <AnimatedPersonaAvatar
            size={AVATAR}
            radius="50%"
            theme={avatar.theme}
            colors={avatar.colors}
            seed={agent.id}
            hovered={active && !agent.paused}
            bounceKey={bounceKey}
            inert={agent.paused}
          />
        </div>
      </div>

      {/* Name + one line of description */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          title={agent.name}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '20px', fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--neutral-950)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {agent.name}
        </span>
        <span
          title={agent.description || undefined}
          style={{
            fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px',
            color: 'var(--neutral-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {agent.description || agent.handle}
        </span>
      </div>

      {/* Right side: quiet status at rest, "Use" pill on hover */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, minWidth: 28, height: 32 }}>
        <AnimatePresence initial={false} mode="popLayout">
          {active && !agent.paused ? (
            <m.div
              key="use"
              initial={{ opacity: 0, x: 10, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            >
              {/* Icon-only "use" button; the label stays as its tooltip + accessible name. */}
              <Tooltip content={useLabel}>
                <IconButton variant="default" size="sm" icon={<BubbleChatAddIcon animated />} aria-label={useLabel} onClick={onUse} />
              </Tooltip>
            </m.div>
          ) : (
            <m.div
              key="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {agent.paused && <Badge color="Yellow" label="Paused" />}
              {superlink && (
                <span title="Has an active Super Link" style={{ display: 'inline-flex', color: 'var(--neutral-500)' }}>
                  <LinkSixIcon size={16} />
                </span>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default CompactAgentCard
