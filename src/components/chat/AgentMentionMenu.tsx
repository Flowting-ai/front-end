'use client'

import React from 'react'
import { Dropdown } from '@/components/Dropdown'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
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
                  avatar={
                    // eslint-disable-next-line @next/next/no-img-element -- avatar may be a signed remote URL
                    <img
                      src={agent.imageUrl ?? getPersonaFallbackAvatar(agent.id)}
                      alt=""
                      style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }}
                    />
                  }
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
