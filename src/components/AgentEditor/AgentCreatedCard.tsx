'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { AgentHero } from '@/components/PersonaCard/AgentHero'
import { AgentCardButton } from '@/components/PersonaCard/AgentCardButton'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { AGENT_EDIT_ROUTE, AGENTS_ROUTE } from '@/lib/routes'
import { HINT_STYLE } from './styles'

export interface AgentCreatedCardProps {
  agent:      SelectedPersonaInfo
  /** False when the agent was created but could not be made live. */
  published:  boolean
  /** True when this agent is the one currently attached to the chat. */
  inUse:      boolean
  /** Attach the agent to the chat. Omitted where the host can't (the button is not shown). */
  onUse?:     (agent: SelectedPersonaInfo) => void
}

const RADIUS = 20
// The grid card's 50 / 35 / 15 split of a 320px card.
const HERO = 160
const DETAILS = 112
const ACTION = 48

/**
 * The result of "Create an agent that…" in chat: the new agent as a card in the thread,
 * laid out like a Grok Bot template card — colour banner with the live avatar, name, handle,
 * description, then Open / Edit / Use now. The agent is already saved when this shows.
 */
export function AgentCreatedCard({ agent, published, inUse, onUse }: AgentCreatedCardProps) {
  const { push } = useRouter()
  return (
    <div
      role="group"
      aria-label={`Agent created: ${agent.name}`}
      // Rows already sit in the chat's centred column, like any assistant message.
      style={{ width: '100%', padding: '12px 0', boxSizing: 'border-box' }}
    >
      <p style={{ ...HINT_STYLE, marginBottom: 8 }}>
        {published ? 'Your agent is ready and saved.' : 'Your agent was created but isn’t live yet.'}
      </p>
      <div
        style={{
          width:           'min(100%, 340px)',
          display:         'flex',
          flexDirection:   'column',
          borderRadius:    RADIUS,
          backgroundColor: 'var(--agent-card-bg)',
          boxShadow:       '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
        }}
        data-surface="raised"
      >
        <AgentHero name={agent.name} agentId={agent.id} height={HERO} avatarSize={110} radius={RADIUS} />

        <div style={{ minHeight: DETAILS, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 16px 0', textAlign: 'center' }}>
          <p style={{ margin: 0, maxWidth: '100%', fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 20, lineHeight: '26px', color: 'var(--neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</p>
          <p style={{ ...HINT_STYLE, fontSize: 13, lineHeight: '20px' }}>{agent.handle}</p>
          {agent.description && (
            <p style={{ ...HINT_STYLE, margin: '6px 0 0', fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>{agent.description}</p>
          )}
        </div>

        {/* Action row */}
        <div style={{ minHeight: ACTION, flexShrink: 0, boxSizing: 'border-box', marginInline: 16, borderTop: '1px solid var(--neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 0' }}>
          <Button variant="outline" size="sm" onClick={() => push(`${AGENTS_ROUTE}?agent=${agent.id}`)}>Open</Button>
          <Button variant="outline" size="sm" onClick={() => push(AGENT_EDIT_ROUTE(agent.id))}>Edit</Button>
          {published && onUse && (
            <AgentCardButton size="sm" disabled={inUse} onClick={() => onUse(agent)}>
              {inUse ? 'In use' : 'Use now'}
            </AgentCardButton>
          )}
        </div>
      </div>
    </div>
  )
}
