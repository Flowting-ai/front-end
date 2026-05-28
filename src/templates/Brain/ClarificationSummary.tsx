'use client'

import React from 'react'
import { Badge } from '@/components/Badge'

// ── Answer display types ─────────────────────────────────────────────────────────
// Mirrors QuestionCard's three input types + open-ended + skipped.

export type ClarificationAnswerDisplay =
  | { type: 'text';    value: string   }   // single-choice or open-ended text
  | { type: 'multi';   values: string[] }  // multiple selected options
  | { type: 'rank';    items: string[]  }  // ordered list (index = rank)
  | { type: 'skipped'                   }  // user pressed Skip

export interface ClarificationSummaryItem {
  question: string
  /**
   * Pass a plain string for single-choice / open-ended (backwards-compatible).
   * Pass a ClarificationAnswerDisplay object for multi, rank, or skipped.
   */
  answer: ClarificationAnswerDisplay | string
}

export interface ClarificationSummaryProps {
  /** One or more Q&A pairs, shown as stacked rows in a bordered card. Max 3. */
  items: ClarificationSummaryItem[]
}

// ── AnswerDisplay ────────────────────────────────────────────────────────────────

function AnswerDisplay({ answer }: { answer: ClarificationAnswerDisplay | string }) {
  const display: ClarificationAnswerDisplay =
    typeof answer === 'string' ? { type: 'text', value: answer } : answer

  if (display.type === 'skipped') {
    return (
      <span style={{
        fontFamily: 'var(--font-body)',
        fontSize:   'var(--font-size-body)',
        lineHeight: 'var(--line-height-body)',
        color:      'var(--neutral-400)',
      }}>
        Skipped
      </span>
    )
  }

  if (display.type === 'multi') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {display.values.map((v, i) => (
          // eslint-disable-next-line react-doctor/no-array-index-as-key -- answer values are static, index is stable
          <Badge key={i} color="Neutral" label={v} />
        ))}
      </div>
    )
  }

  if (display.type === 'rank') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {display.items.map((v, i) => (
          // eslint-disable-next-line react-doctor/no-array-index-as-key -- ranked items are static, index is stable
          <Badge key={i} color="Neutral" label={`${i + 1} ${v}`} />
        ))}
      </div>
    )
  }

  // 'text' (default)
  return (
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize:   'var(--font-size-body)',
      lineHeight: 'var(--line-height-body)',
      color:      'var(--neutral-600)',
    }}>
      {display.value}
    </span>
  )
}

// ── ClarificationSummary ───────────────────────────────────────────────────────
/**
 * Read-only Q&A card in the Brain thread.
 * Replaces the interactive ClarificationCard once a question is answered.
 * Separate thread element — not inside BrainPhaseGroup.
 */
export function ClarificationSummary({ items }: ClarificationSummaryProps) {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           0,
      borderRadius:  12,
      border:        '1px solid var(--neutral-200)',
      overflow:      'hidden',
    }}>
      {items.map(({ question, answer }, i) => (
        <div
          key={question}
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           6,
            padding:       '12px 16px',
            borderTop:     i > 0 ? '1px solid var(--neutral-200)' : 'none',
          }}
        >
          <span style={{
            fontFamily:  'var(--font-body)',
            fontSize:    'var(--font-size-body)',
            fontWeight:  'var(--font-weight-medium)',
            lineHeight:  'var(--line-height-body)',
            color:       'var(--neutral-800)',
          }}>
            {question}
          </span>
          <AnswerDisplay answer={answer} />
        </div>
      ))}
    </div>
  )
}

ClarificationSummary.displayName = 'ClarificationSummary'
