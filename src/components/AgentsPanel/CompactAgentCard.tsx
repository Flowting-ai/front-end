'use client'

import React, { useState } from 'react'
import { AlertTwoIcon, BubbleChatAddIcon, ExchangeOneIcon, LinkSixIcon, TickTwoIcon } from '@strange-huge/icons'
import { Tooltip } from '@/components/Tooltip'
import { AgentHero } from '@/components/PersonaCard/AgentHero'
import { AgentCardButton, AgentCardIconButton } from '@/components/PersonaCard/AgentCardButton'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import type { ModelUnavailableReason } from '@/lib/agent-model-health'

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
  /** Label of the use button (its tooltip and accessible name). */
  useLabel?: string
  /** This is the agent already attached to the chat — it shows an "in use" tick instead of a button. */
  inUse?: boolean
  /** Another agent's chip is active — the button replaces it ("Replace agent") instead of "Use agent". */
  replaces?: boolean
  /** Card clicked — open details. */
  onOpen:    () => void
  /** Pill clicked — use the agent. */
  onUse:     () => void
  /**
   * Set when the agent's model is retired or turned off (lib/agent-model-health),
   * matching PersonaCard's unavailable state on /agents: the tile goes grey and
   * faded, the description becomes the reason, and the pill swaps "Use" for
   * "Fix model" (when `onFixModel` is given) or stays disabled.
   */
  modelUnavailable?: ModelUnavailableReason | null
  /** "Fix model" pill clicked — open the Change model flow for this agent. */
  onFixModel?: () => void
}

export function CompactAgentCard({ agent, superlink, useLabel = 'Use agent', inUse = false, replaces = false, onOpen, onUse, modelUnavailable, onFixModel }: CompactAgentCardProps) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [bounceKey, setBounceKey] = useState(0)
  const active = hovered || focused
  const unavailable = !!modelUnavailable
  const dimmed = agent.paused || unavailable

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
      {/* Keeps the bottom edge hovered while the card lifts 1px (otherwise the pointer on that edge flickers). */}
      <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: -3, height: 3 }} />
      {/* Unavailable: still and grey, like PersonaCard's scene. Paused: still and faded. */}
      <div style={{ display: 'flex', flexShrink: 0, filter: unavailable ? 'grayscale(1)' : undefined }}>
        <AgentHero
          name={agent.name}
          agentId={agent.id}
          height={TILE}
          width={TILE}
          avatarSize={38}
          radius={TILE_RADIUS}
          rounded
          hovered={active && !dimmed}
          bounceKey={bounceKey}
          inert={dimmed}
          opacity={dimmed ? 0.6 : 1}
        />
      </div>

      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Tooltip content={agent.name} maxWidth={260}><span
            style={{
              minWidth: 0, fontFamily: 'var(--font-title)', fontSize: 15, lineHeight: '20px', fontWeight: 'var(--font-weight-medium)',
              color: unavailable ? 'var(--neutral-500)' : 'var(--neutral-950)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {agent.name}
          </span></Tooltip>
          {superlink && (
            <Tooltip content="Has an active Super Link"><span style={{ display: 'inline-flex', flexShrink: 0, color: 'var(--neutral-500)' }}>
              <LinkSixIcon size={13} />
            </span></Tooltip>
          )}
        </div>
        {unavailable ? (
          // Same reason copy as PersonaCard's scrim, in the same warning tone.
          <p
            style={{
              margin: 0, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0,
              fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--color-tag-Yellow-text)',
            }}
          >
            <AlertTwoIcon size={12} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {modelUnavailable === 'blocked' ? 'Model turned off — needs attention' : 'Model no longer available — needs attention'}
            </span>
          </p>
        ) : (
          <Tooltip content={agent.description} maxWidth={280} disabled={!agent.description}><p
            style={{
              margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {agent.description || agent.handle}
          </p></Tooltip>
        )}
      </div>

      {/* A paused agent can't be used, so the pill stays, disabled, rather than a status tag.
          An agent whose model is gone can't be used either — its pill fixes the model instead. */}
      <div style={{ flexShrink: 0 }}>
        {unavailable && onFixModel ? (
          <AgentCardButton size="sm" onClick={onFixModel}>Fix model</AgentCardButton>
        ) : (
          inUse ? (
            <AgentCardIconButton label="In use in this chat" icon={<TickTwoIcon size={16} />} disabled />
          ) : replaces ? (
            <AgentCardIconButton label="Replace agent" icon={<ExchangeOneIcon size={16} />} disabled={agent.paused || unavailable} onClick={onUse} />
          ) : (
            <AgentCardIconButton label={useLabel} icon={<BubbleChatAddIcon size={16} />} disabled={agent.paused || unavailable} onClick={onUse} />
          )
        )}
      </div>
    </div>
  )
}

export default CompactAgentCard
