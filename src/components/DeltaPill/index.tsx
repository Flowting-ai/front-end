'use client'

import React from 'react'
import { ArrowDownTwoIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { Chip, type ChipColor } from '@/components/Chip'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DeltaTrend = 'up' | 'down'

export interface DeltaPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Direction of change. Drives icon + Chip colour. */
  trend: DeltaTrend
  /** Pre-formatted delta string, e.g. "+8.2%" or "-0.3%". */
  value: string
}

// ── Component ─────────────────────────────────────────────────────────────────
// Wraps the KDS `Chip` Small variant — a Green/Red coloured tag with an arrow
// icon in the left ChipButton slot. Interactivity is disabled by passing no
// `onRemove` handler (the icon button renders but does nothing) and pointer
// events are suppressed on the wrapper so the cursor never changes.

export function DeltaPill({ ref, trend, value, className, style, ...props }: DeltaPillProps & { ref?: React.Ref<HTMLDivElement> }) {
    const isUp = trend === 'up'
    const Icon = isUp ? ArrowUpTwoIcon : ArrowDownTwoIcon
    const chipColor: ChipColor = isUp ? 'Green' : 'Red'

    // Cast around React.HTMLAttributes' inherited `color: string` clashing
    // with ChipProps' narrower `color: ChipColor`.
    const ChipAny = Chip as unknown as (props: Record<string, unknown>) => React.ReactElement
    return (
      <ChipAny
        ref={ref}
        size="Small"
        color={chipColor}
        label={value}
        leftIcon={<Icon size={14} />}
        className={cn(className)}
        style={{ pointerEvents: 'none', ...style }}
        {...props}
      />
    )
}

DeltaPill.displayName = 'DeltaPill'
export default DeltaPill
