'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
import { AGENT_EDIT_ROUTE, AGENTS_ROUTE } from '@/lib/routes'
import { BOX_STYLE, HINT_STYLE } from './styles'

export interface AgentCreatedCardProps {
  agent:      SelectedPersonaInfo
  /** False when the agent was created but could not be made live. */
  published:  boolean
  /** True when this agent is the one currently attached to the chat. */
  inUse:      boolean
  /** Attach the agent to the chat. Omitted where the host can't (the button is not shown). */
  onUse?:     (agent: SelectedPersonaInfo) => void
}

/**
 * The result of "Create an agent that…" in chat: the new agent as a card in the
 * thread, with Use now / Edit / Open. The agent is already saved when this shows.
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
      <div style={{ ...BOX_STYLE, borderRadius: 16, padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar may be a signed remote URL */}
        <img
          src={agent.imageUrl ?? getPersonaFallbackAvatar(agent.id)}
          alt=""
          style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
        />
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-title)', fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)' }}>{agent.name}</p>
          <p style={{ ...HINT_STYLE, fontSize: 13, lineHeight: '20px' }}>{agent.handle}</p>
          {agent.description && (
            <p style={{ ...HINT_STYLE, fontSize: 13, lineHeight: '20px', color: 'var(--neutral-600)' }}>{agent.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={() => push(`${AGENTS_ROUTE}?agent=${agent.id}`)}>Open</Button>
          <Button variant="outline" size="sm" onClick={() => push(AGENT_EDIT_ROUTE(agent.id))}>Edit</Button>
          {published && onUse && (
            <Button variant="default" size="sm" disabled={inUse} onClick={() => onUse(agent)}>
              {inUse ? 'In use' : 'Use now'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
