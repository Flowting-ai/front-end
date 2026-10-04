'use client'

import React, { useState } from 'react'
import { LinkSixIcon } from '@strange-huge/icons'
import { AgentHero } from '@/components/PersonaCard/AgentHero'
import { AgentCardButton } from '@/components/PersonaCard/AgentCardButton'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

// The compact agent card for the narrow agents panel: the grid card's look in one slim row. A small
// rounded tile carries the grainy colour banner and the live avatar; the name (Google Sans) and a
// one-line description sit beside it, with the white "Use" pill at the right end. Clicking the card
// opens the agent's details; the pill uses the agent. Hovering plays the avatar and lifts the card a pixel.

const RADIUS = 16
const TILE = 52
const TILE_RADIUS = 12

export interface CompactAgentCardProps {
  agent:     SelectedPersonaInfo
  superlink: boolean
  /** Label of the pill button (also its accessible name). */
  useLabel?: string
  /** Card clicked — open details. */
  onOpen:    () => void
  /** Pill clicked — use the agent. */
  onUse:     () => void
}

export function CompactAgentCard({ agent, superlink, useLabel = 'Use agent', onOpen, onUse }: CompactAgentCardProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)
  const active = hovered || focused

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
        gap:             10,
        width:           '100%',
        boxSizing:       'border-box',
        padding:         8,
        borderRadius:    RADIUS,
        cursor:          'pointer',
        backgroundColor: 'var(--agent-card-bg)',
        boxShadow:       active
          ? '0px 6px 14px -4px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-400)'
          : '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
        transform:       active ? 'translateY(-1px)' : 'none',
        transition:      'box-shadow 200ms, transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      data-surface="raised"
    >
      <AgentHero
        name={agent.name}
        agentId={agent.id}
        height={TILE}
        width={TILE}
        avatarSize={38}
        radius={TILE_RADIUS}
        rounded
        hovered={active && !agent.paused}
        bounceKey={bounceKey}
        inert={agent.paused}
        opacity={agent.paused ? 0.6 : 1}
      />

      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            title={agent.name}
            style={{
              minWidth: 0, fontFamily: 'var(--font-title)', fontSize: 15, lineHeight: '20px', fontWeight: 'var(--font-weight-medium)',
              color: 'var(--neutral-950)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {agent.name}
          </span>
          {superlink && (
            <span title="Has an active Super Link" style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--neutral-500)' }}>
              <LinkSixIcon size={13} />
            </span>
          )}
        </div>
        <p
          title={agent.description || undefined}
          style={{
            margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {agent.description || agent.handle}
        </p>
      </div>

      {/* A paused agent can't be used, so the pill stays, disabled, rather than a status tag. */}
      <div style={{ flexShrink: 0 }}>
        <AgentCardButton size="sm" disabled={agent.paused} onClick={onUse}>{useLabel}</AgentCardButton>
      </div>
    </div>
  )
}

export default CompactAgentCard
