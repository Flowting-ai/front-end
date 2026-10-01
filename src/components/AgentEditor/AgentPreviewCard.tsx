'use client'

import React from 'react'
import { PersonaCard } from '@/components/PersonaCard'
import { HINT_STYLE, LABEL_STYLE } from './styles'

export interface AgentPreviewCardProps {
  name:        string
  /** Handle without the leading @. */
  handle:      string
  description: string
  avatarUrl:   string | null
  tags:        string[]
}

/** The agent exactly as it will look in lists — updates as the form changes. */
export function AgentPreviewCard({ name, handle, description, avatarUrl, tags }: AgentPreviewCardProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={LABEL_STYLE}>Live preview</p>
      <PersonaCard
        style={{ width: '100%' }}
        name={name.trim() || 'Agent name'}
        handle={handle}
        description={description.trim() || 'Your agent’s description shows here.'}
        avatarUrl={avatarUrl ?? undefined}
        avatarSeed={name || 'agent'}
        tags={tags}
        visibility="private"
        createdBy="You"
      />
      <p style={HINT_STYLE}>How the card looks in your agents, chat and pickers.</p>
    </div>
  )
}
