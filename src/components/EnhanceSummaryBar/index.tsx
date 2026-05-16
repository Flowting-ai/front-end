'use client'

import React from 'react'
import { LaurelWreathOneIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnhanceSummaryBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Word count added in the rewrite (positive integer). */
  wordsAdded:      number
  /**
   * Number of contiguous added-line groups in the diff. Used to phrase
   * "across N new guidelines" - set to 0 to suppress that clause.
   */
  guidelineGroups: number
}

// ── Component ─────────────────────────────────────────────────────────────────
// Per PRD §10. Compact purple-tinted banner above the diff. Falls back to the
// "refined existing content" copy when additions are minor (<5 words).

export const EnhanceSummaryBar = React.forwardRef<HTMLDivElement, EnhanceSummaryBarProps>(
  function EnhanceSummaryBar({ wordsAdded, guidelineGroups, className, style, ...props }, ref) {
    const minorAdds = wordsAdded < 5
    const summary = minorAdds
      ? 'Refined existing content with no major additions.'
      : guidelineGroups > 0
        ? `Added ~${wordsAdded} words across ${guidelineGroups} new guideline${guidelineGroups === 1 ? '' : 's'}.`
        : `Added ~${wordsAdded} words.`

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className={cn(className)}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             8,
          padding:         '8px 12px',
          borderRadius:    8,
          backgroundColor: 'var(--color-enhance-primary-tint)',
          border:          `1px solid var(--color-enhance-card-indicator)`,
          color:           'var(--color-diff-added-text)',
          fontFamily:      'var(--font-body)',
          fontSize:        'var(--font-size-caption)',
          fontWeight:      'var(--font-weight-medium)',
          lineHeight:      'var(--line-height-caption)',
          ...style,
        }}
        {...props}
      >
        <span aria-hidden style={{ flexShrink: 0, lineHeight: 0, color: 'var(--neutral-900)' }}>
          <LaurelWreathOneIcon size={14} />
        </span>
        <span>{summary}</span>
      </div>
    )
  },
)

EnhanceSummaryBar.displayName = 'EnhanceSummaryBar'

export default EnhanceSummaryBar
