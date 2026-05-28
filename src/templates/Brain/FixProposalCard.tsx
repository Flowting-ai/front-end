'use client'

import React from 'react'
import { AlertCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_SHADOW = 'var(--shadow-card-default)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FixProposalDiff {
  /** Parameter name — "Search query" | "Date filter" | "API endpoint" */
  label:  string
  /** Original value that caused the failure */
  before: string
  /** Brain's proposed replacement */
  after:  string
}

export interface FixProposalCardProps {
  /** The step label that failed — shown in the card header. */
  failedStep:       string
  /** Prose explanation of why it failed and what Brain would change. Always shown. */
  reasoning:        string
  /** Optional structured parameter diffs — only shown when Brain can surface specific changes. */
  diffs?:           FixProposalDiff[]
  onApplyFix?:      () => void
  onTryDifferent?:  () => void
  onCancel?:        () => void
}

// ── DiffRow ───────────────────────────────────────────────────────────────────

function DiffRow({ diff }: { diff: FixProposalDiff }) {
  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      gap:             4,
      padding:         '8px 10px',
      borderRadius:    8,
      backgroundColor: 'var(--neutral-50)',
      border:          '1px solid var(--neutral-100)',
    }}>
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-caption)',
        fontWeight: 'var(--font-weight-medium)',
        color:      'var(--neutral-500)',
        lineHeight: 'var(--line-height-caption)',
      }}>
        {diff.label}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily:      'var(--font-body)',
            fontSize:        'var(--font-size-caption)',
            lineHeight:      'var(--line-height-caption)',
            color:           'var(--color-tag-Red-text)',
            flexShrink:      0,
            width:           38,
          }}>
            Before
          </span>
          <code style={{
            fontFamily:      'var(--font-mono, monospace)',
            fontSize:        '0.85em',
            backgroundColor: 'var(--color-tag-Red-bg)',
            color:           'var(--color-tag-Red-text)',
            padding:         '1px 5px',
            borderRadius:    4,
          }}>
            {diff.before}
          </code>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-caption)',
            lineHeight: 'var(--line-height-caption)',
            color:      'var(--color-tag-Green-text)',
            flexShrink: 0,
            width:      38,
          }}>
            After
          </span>
          <code style={{
            fontFamily:      'var(--font-mono, monospace)',
            fontSize:        '0.85em',
            backgroundColor: 'var(--color-tag-Green-bg)',
            color:           'var(--color-tag-Green-text)',
            padding:         '1px 5px',
            borderRadius:    4,
          }}>
            {diff.after}
          </code>
        </div>
      </div>
    </div>
  )
}

// ── FixProposalCard ───────────────────────────────────────────────────────────

/**
 * Shown after NodeFailureCard when Brain can self-diagnose the failure.
 * Presents prose reasoning (always) and optional structured parameter diffs.
 * Transitions: fix-proposed → executing (apply) | cancelled (cancel).
 */
export function FixProposalCard({
  failedStep,
  reasoning,
  diffs,
  onApplyFix,
  onTryDifferent,
  onCancel,
}: FixProposalCardProps) {
  return (
    <div style={{
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      padding:         20,
      boxShadow:       CARD_SHADOW,
      display:         'flex',
      flexDirection:   'column',
      gap:             14,
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertCircleIcon size={14} color="var(--neutral-500)" />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize:   'var(--font-size-caption)',
          fontWeight: 'var(--font-weight-medium)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-600)',
          flex:       '1 0 0',
          minWidth:   0,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          Brain found a fix for &ldquo;{failedStep}&rdquo;
        </span>
      </div>

      {/* Reasoning */}
      <p style={{
        margin:     0,
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-700)',
      }}>
        {reasoning}
      </p>

      {/* Diffs (optional) */}
      {diffs && diffs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {diffs.map((diff, i) => (
            <DiffRow key={i} diff={diff} />
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, backgroundColor: 'var(--neutral-100)' }} />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <div style={{ flex: '1 0 0' }} />
        <Button variant="outline" size="sm" onClick={onTryDifferent}>
          Try different approach
        </Button>
        <Button variant="default" size="sm" onClick={onApplyFix}>
          Apply fix
        </Button>
      </div>

    </div>
  )
}

FixProposalCard.displayName = 'FixProposalCard'
