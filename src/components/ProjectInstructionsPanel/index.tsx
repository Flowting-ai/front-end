'use client'

import React from 'react'
import { PenOneIcon, PlusSignIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectInstructionsPanelProps {
  value:         string
  /** Gates whether the Add/Edit button renders at all. */
  editable?:     boolean
  /** Opens the full SystemInstructionsModal editor. This panel is preview-only —
   *  it never edits instructions inline. */
  onOpenEditor?: () => void
}

// ── Styles ─────────────────────────────────────────────────────────────────────

// Same card chrome as the Files card below it, so the two read as one set.
const cardStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           12,
  padding:       12,
  borderRadius:  16,
  background:    'var(--card-bg)',
  // --text-field-ring: neutral-100 in light, a visible 22% white hairline in dark (as Project settings).
  border:        '1px solid var(--text-field-ring)',
  boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
  width:         '100%',
  boxSizing:     'border-box',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 'var(--font-weight-regular)',
  fontSize:   16,
  lineHeight: '22px',
  color:      'var(--color-text-primary)',
  margin:     0,
}

// The instructions sit in an inset well, set apart from the card's header.
const wellStyle: React.CSSProperties = {
  borderRadius:    10,
  // Same field box as Project settings: field surface + ring, readable in both themes.
  backgroundColor: 'var(--field-surface)',
  border:          '1px solid var(--border-default)',
  padding:         '10px 12px',
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectInstructionsPanel({ value, editable, onOpenEditor, ref }: ProjectInstructionsPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
  const isEmpty = !value.trim()

  return (
    <div ref={ref} style={cardStyle}>
      {/* Header: title, then the primary Add / Edit action. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={titleStyle}>Instructions</p>
        {editable && (
          <Button
            variant="default"
            size="xs"
            leftIcon={isEmpty ? <PlusSignIcon size={12} /> : <PenOneIcon size={12} animated />}
            onClick={onOpenEditor}
          >
            {isEmpty ? 'Add' : 'Edit'}
          </Button>
        )}
      </div>

      {/* Body — preview only; editing always happens in SystemInstructionsModal. */}
      {isEmpty ? (
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, lineHeight: '18px', color: 'var(--neutral-600)', margin: 0 }}>
          {editable
            ? 'Tell the agent how to work in this project: tone, format, what to focus on or avoid.'
            : 'No instructions yet.'}
        </p>
      ) : (
        <div style={wellStyle}>
          {/* Clamped to 5 rendered lines (wraps and "\n" alike), so many short lines can't grow it. */}
          <p
            title={value}
            style={{
              fontFamily:      'var(--font-body)',
              fontWeight:      'var(--font-weight-regular)',
              fontSize:        14,
              lineHeight:      '22px',
              color:           'var(--neutral-800)',
              margin:          0,
              whiteSpace:      'pre-wrap',
              overflowWrap:    'anywhere',
              display:         '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 5,
              overflow:        'hidden',
            }}
          >
            {value}
          </p>
        </div>
      )}
    </div>
  )
}

ProjectInstructionsPanel.displayName = 'ProjectInstructionsPanel'
export default ProjectInstructionsPanel
