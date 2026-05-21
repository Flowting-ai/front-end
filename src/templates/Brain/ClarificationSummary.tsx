'use client'

import React from 'react'

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

// ── Chip — shared pill style for multi + rank answers ───────────────────────────

function AnswerChip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display:         'inline-flex',
      alignItems:      'center',
      gap:             4,
      padding:         '2px 8px',
      borderRadius:    999,
      backgroundColor: 'var(--neutral-100)',
      color:           'var(--neutral-500)',
      fontFamily:      'var(--font-body)',
      fontSize:        'var(--font-size-caption)',
      fontWeight:      'var(--font-weight-medium)',
      lineHeight:      'var(--line-height-caption)',
    }}>
      {children}
    </span>
  )
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
        color:      'var(--neutral-300)',
      }}>
        Skipped
      </span>
    )
  }

  if (display.type === 'multi') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {display.values.map((v) => (
          <AnswerChip key={v}>{v}</AnswerChip>
        ))}
      </div>
    )
  }

  if (display.type === 'rank') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {display.items.map((v, i) => (
          <AnswerChip key={v}>
            <span style={{ color: 'var(--neutral-400)', fontWeight: 'var(--font-weight-medium)' }}>
              {i + 1}
            </span>
            {v}
          </AnswerChip>
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
      color:      'var(--neutral-500)',
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
