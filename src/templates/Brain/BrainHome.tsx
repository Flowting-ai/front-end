'use client'

import React, { useMemo } from 'react'
import { SearchOneIcon, QuillWriteOneIcon, AtomOneIcon } from '@strange-huge/icons'

// ── Rotating headlines ─────────────────────────────────────────────────────
// Each headline is a three-beat capability chain — one per Brain workflow.
// Random per session so every visit surfaces a different angle.

const ROTATING_HEADLINES = [
  'Research. Draft. Ship.',
  'Scan. Summarise. Report.',
  'Plan. Execute. Deliver.',
  'Brief. Write. Launch.',
  'Analyse. Decide. Act.',
  'Outline. Build. Export.',
]

// ── Suggestion cards ───────────────────────────────────────────────────────
// Prompt starters that fill the ChatInput — Brain-specific workflows only.

const SUGGESTION_CARDS = [
  {
    id:    'sc-0',
    Icon:  SearchOneIcon,
    label: 'Research a topic in depth and deliver a clear, sourced summary',
  },
  {
    id:    'sc-1',
    Icon:  QuillWriteOneIcon,
    label: 'Draft long-form content from scratch and refine until it\'s ready to ship',
  },
  {
    id:    'sc-2',
    Icon:  AtomOneIcon,
    label: 'Plan a multi-step project, then execute each step and report back',
  },
]

// ── SuggestionCard ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  Icon:    React.ComponentType<{ size?: number }>
  label:   string
  onClick: () => void
}

function SuggestionCard({ Icon, label, onClick }: SuggestionCardProps) {
  const [hovered, setHovered] = React.useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:         'flex',
        flexDirection:   'column',
        gap:             '8px',
        alignItems:      'flex-start',
        flex:            '1 1 0',
        minWidth:        0,
        padding:         '12px 12px 16px',
        borderRadius:    '16px',
        backgroundColor: 'var(--neutral-white, #fff)',
        boxShadow: hovered
          ? '0px 4px 8px 0px rgba(82,75,71,0.14), 0px 0px 0px 1px var(--neutral-200, #d1c6bd)'
          : '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100, #ede1d7)',
        border:          'none',
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'box-shadow 150ms ease',
      }}
    >
      {/* Icon badge */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '6px',
        borderRadius:    '8px',
        backgroundColor: 'var(--neutral-100)',
        color:           'var(--neutral-600)',
        flexShrink:      0,
      }}>
        <Icon size={32} />
      </div>

      {/* Label */}
      <p style={{
        margin:      0,
        fontFamily:  'var(--font-body)',
        fontSize:    'var(--font-size-body-lg)',
        fontWeight:  'var(--font-weight-medium)',
        lineHeight:  'var(--line-height-body-lg)',
        color:       'var(--neutral-900)',
        overflow:    'hidden',
        display:     '-webkit-box',
        WebkitLineClamp:    3,
        WebkitBoxOrient:    'vertical',
      }}>
        {label}
      </p>
    </button>
  )
}

// ── BrainHome ──────────────────────────────────────────────────────────────

export interface BrainHomeProps {
  /** Populates the ChatInput when a suggestion card is clicked. */
  onSuggestion?: (text: string) => void
}

export function BrainHome({ onSuggestion }: BrainHomeProps) {
  const headline = useMemo(
    () => ROTATING_HEADLINES[Math.floor(Math.random() * ROTATING_HEADLINES.length)],
    [],
  )

  return (
    <div style={{
      flex:           1,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            '40px',
      padding:        '40px 24px',
      overflowY:      'auto',
    }}>

      {/* ── Hero ── */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            '12px',
      }}>
        {/* Rotating headline */}
        <p style={{
          margin:        0,
          fontFamily:    'var(--font-title)',
          fontSize:      'var(--font-size-display)',
          fontWeight:    'var(--font-weight-regular)',
          lineHeight:    'var(--line-height-display)',
          color:         'var(--neutral-800)',
          letterSpacing: '-0.01em',
          textAlign:     'center',
          whiteSpace:    'nowrap',
        }}>
          {headline}
        </p>

        {/* Subtitle */}
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body)',
          lineHeight: 'var(--line-height-body)',
          color:      'var(--neutral-500)',
          textAlign:  'center',
          maxWidth:   '400px',
        }}>
          Give Brain a goal. It plans, executes, and delivers results in the world.
        </p>
      </div>

      {/* ── Suggestion cards ── */}
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            '13px',
        width:          '100%',
      }}>
        <p style={{
          margin:     0,
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-body-lg)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-body-lg)',
          color:      'var(--neutral-600)',
        }}>
          Not sure where to start?
        </p>

        <div style={{
          display:  'flex',
          gap:      '16px',
          alignItems: 'flex-start',
          width:    '100%',
        }}>
          {SUGGESTION_CARDS.map(card => (
            <SuggestionCard
              key={card.id}
              Icon={card.Icon}
              label={card.label}
              onClick={() => onSuggestion?.(card.label)}
            />
          ))}
        </div>
      </div>

    </div>
  )
}
