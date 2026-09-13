'use client'

import React from 'react'
import { PlusSignIcon, PenOneIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProjectInstructionsPanelProps {
  value:         string
  /** Gates whether the edit button renders at all. */
  editable?:     boolean
  /** Opens the full SystemInstructionsModal editor. This panel is preview-only —
   *  it never edits instructions inline. */
  onOpenEditor?: () => void
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ProjectInstructionsPanel({ value, editable, onOpenEditor, ref }: ProjectInstructionsPanelProps & { ref?: React.Ref<HTMLDivElement> }) {
    const isEmpty = !value.trim()

    return (
      <div
        ref={ref}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           '12px',
          padding:       '12px 12px 16px',
          borderRadius:  '16px',
          background:    'var(--neutral-50)',
          border:        '1px dashed var(--neutral-300)',
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          width:         '100%',
          boxSizing:     'border-box',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize:   '16px',
              lineHeight: 'var(--line-height-body)',
              color:      '#000',
              margin:     0,
            }}
          >
            Instructions
          </p>
          {editable && (
            <IconButton
              variant="ghost"
              size="xs"
              icon={isEmpty ? <PlusSignIcon /> : <PenOneIcon animated />}
              aria-label={isEmpty ? 'Add instructions' : 'Edit instructions'}
              onClick={onOpenEditor}
            />
          )}
        </div>

        {/* Body — preview only; editing always happens in SystemInstructionsModal. */}
        {isEmpty ? (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 'var(--font-weight-regular)',
              fontSize: '12px',
              lineHeight: '16px',
              color:      '#857a72',
              margin:     0,
            }}
          >
            Add instructions to steer this project towards the right direction…
          </p>
        ) : (
          // Clamped to 5 *rendered* lines regardless of character count — a
          // character-length threshold (the old `value.length >= 400` scroll
          // gate) is fooled by many short lines (e.g. one letter per line),
          // which rack up rendered height without ever reaching 400 chars.
          // line-clamp counts actual lines (wraps and explicit "\n" alike),
          // so it can't be gamed that way.
          <p
            style={{
              fontFamily:        'var(--font-body)',
              fontWeight:        'var(--font-weight-regular)',
              fontSize:          '14px',
              lineHeight:        '22px',
              color:             '#1a1714',
              margin:            0,
              whiteSpace:        'pre-wrap',
              wordBreak:         'break-word',
              display:           '-webkit-box',
              WebkitBoxOrient:   'vertical',
              WebkitLineClamp:   5,
              overflow:          'hidden',
              textOverflow:      'ellipsis',
            }}
          >
            {value}
          </p>
        )}
      </div>
    )
}

ProjectInstructionsPanel.displayName = 'ProjectInstructionsPanel'
export default ProjectInstructionsPanel
