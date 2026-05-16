'use client'

import React from 'react'
import { Eyebrow } from '@/components/Eyebrow'
import { DeltaPill, type DeltaTrend } from '@/components/DeltaPill'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { cn } from '@/lib/utils'

export interface ChartCardRangeOption<R extends string = string> {
  id:    R
  label: string
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChartCardProps<R extends string = string>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Uppercase eyebrow. */
  label:       string
  /** Headline number (e.g. "12,408"). */
  value?:      React.ReactNode
  /** Optional delta + trend rendered next to the value. */
  delta?:      string
  deltaTrend?: DeltaTrend
  /** Range toggle options (e.g. 7d / 30d / 90d). */
  rangeOptions?:    ChartCardRangeOption<R>[]
  rangeValue?:      R
  onRangeChange?:   (next: R) => void
  /** Optional left-side toggle (e.g. All links / Per link). Rendered before the range toggle. */
  toolbarLeft?:     React.ReactNode
  /** Chart body — Sparkline, UsageBarChart, or anything chart-shaped. */
  chart:            React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  function ChartCard(
    {
      label, value, delta, deltaTrend = 'up',
      rangeOptions, rangeValue, onRangeChange,
      toolbarLeft, chart,
      className, style, ...props
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          isolation:       'isolate',
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
          padding:         '20px 22px',
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       'var(--shadow-surface-card)',
          minWidth:        0,
          ...style,
        }}
        {...props}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <Eyebrow>{label}</Eyebrow>
            {(value || delta) && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                {value && (
                  <span
                    style={{
                      fontFamily:    'var(--font-title)',
                      fontSize:      'var(--font-size-heading)',
                      lineHeight:    'var(--line-height-heading)',
                      fontWeight:    'var(--font-weight-medium)',
                      color:         'var(--neutral-900)',
                    }}
                  >
                    {value}
                  </span>
                )}
                {delta && <DeltaPill trend={deltaTrend} value={delta} />}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {toolbarLeft}
            {rangeOptions && rangeValue && onRangeChange && (
              <Tabs value={rangeValue} onValueChange={onRangeChange}>
                <TabsList size="small" aria-label={`${label} range`}>
                  {rangeOptions.map(opt => (
                    <TabsTrigger key={opt.id} value={opt.id}>{opt.label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>{chart}</div>
      </div>
    )
  },
)

ChartCard.displayName = 'ChartCard'
export default ChartCard
