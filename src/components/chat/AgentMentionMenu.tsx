'use client'

import React from 'react'
import { Dropdown } from '@/components/Dropdown'
import { AnimatedPersonaAvatar, defaultAvatarChoice, getAvatarChoice } from '@/components/PersonaCard/AnimatedPersonaAvatar'
import { agentHeroStyle } from '@/components/PersonaCard/AgentHero'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import type { SelectedPersonaInfo } from '@/lib/chat-personas'

export interface AgentMentionMenuProps {
  items:       SelectedPersonaInfo[]
  loading:     boolean
  activeIndex: number
  /** The agent already attached to the chat, shown as selected. */
  selectedId:  string | null
  onPick:      (agent: SelectedPersonaInfo) => void
  onHover:     (index: number) => void
}

/** The agent's banner colour as a small tile with its live avatar — the agent card's hero, miniature. */
function MentionAvatar({ agent }: { agent: SelectedPersonaInfo }) {
  const stored = useStoredAvatarChoice(agent.id)
  const avatar = getAvatarChoice(stored ?? defaultAvatarChoice(agent.name, agent.id))
  return (
    <span
      aria-hidden
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        justifyContent:  'center',
        width:           28,
        height:          28,
        borderRadius:    8,
        ...agentHeroStyle(avatar.colors[0]),
        flexShrink:      0,
      }}
    >
      <span style={{ display: 'inline-flex', borderRadius: '50%', backgroundColor: 'var(--static-white)' }}>
        <AnimatedPersonaAvatar size={20} radius="50%" theme={avatar.theme} colors={avatar.colors} seed={agent.id} hovered={false} inert />
      </span>
    </span>
  )
}

/** The list that appears above the chat box while typing `@agent`. */
export function AgentMentionMenu({ items, loading, activeIndex, selectedId, onPick, onHover }: AgentMentionMenuProps) {
  return (
    <div
      role="listbox"
      aria-label="Agents"
      // Keep focus in the textarea: a click on a row must not blur it first.
      onMouseDown={event => event.preventDefault()}
      style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 30, minWidth: 260, maxWidth: '100%' }}
    >
      <Dropdown size="md" maxHeight="min(280px, 40dvh)">
        <Dropdown.Section fluid label="Agents">
          {loading && items.length === 0 ? (
            <Dropdown.Item label="Loading…" fluid disabled />
          ) : items.length === 0 ? (
            <Dropdown.Item label="No agents match" fluid disabled />
          ) : (
            items.map((agent, index) => (
              <div key={agent.id} role="option" aria-selected={index === activeIndex} onMouseEnter={() => onHover(index)}>
                <Dropdown.Item
                  label={agent.name}
                  subLabel={agent.description || agent.handle}
                  avatar={<MentionAvatar agent={agent} />}
                  fluid
                  selected={index === activeIndex || agent.id === selectedId}
                  onClick={() => onPick(agent)}
                />
              </div>
            ))
          )}
        </Dropdown.Section>
      </Dropdown>
    </div>
  )
}
