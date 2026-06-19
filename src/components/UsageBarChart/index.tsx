'use client'

import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UsageBarChartSeries {
  id:    string
  label: string
  color: string
  /** Per-day values, length must match `days`. */
  data:  number[]
}

export interface UsageBarChartProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** X-axis labels, e.g. `["May 6", "May 7", …]`. */
  days:     string[]
  /** One series per link (stacked) or a single series (all). */
  series:   UsageBarChartSeries[]
  /** `all` → single colour, `per-link` → stacked. */
  mode:     'all' | 'per-link'
  /** Highlighted series in `per-link` mode — dimmed-out for the rest. */
  selectedId?: string | null
  height?:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UsageBarChart({ days, series, mode, selectedId, height = 180, className, style, ref, ...props }: UsageBarChartProps & { ref?: React.Ref<HTMLDivElement> }) {
    const reduceMotion = useReducedMotion() ?? false

    const data = React.useMemo(() => (
      days.map((day, i) => {
        const row: Record<string, number | string> = { day }
        if (mode === 'all') {
          row.total = series.reduce((sum, s) => sum + (s.data[i] ?? 0), 0)
        } else {
          series.forEach(s => { row[s.id] = s.data[i] ?? 0 })
        }
        return row
      })
    ), [days, series, mode])

    const axisStyle = {
      fontFamily: 'var(--font-body)',
      fontSize:   'var(--font-size-caption)',
      fill:       'var(--neutral-500)',
    } as const

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{ width: '100%', height, ...style }}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="2 4" stroke="var(--neutral-200)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={axisStyle}
              tickLine={false}
              axisLine={{ stroke: 'var(--neutral-200)' }}
            />
            <YAxis
              tick={axisStyle}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v: number) => fmtK(v)}
            />
            {mode === 'all' ? (
              <Bar
                dataKey="total"
                fill="var(--neutral-700)"
                radius={[3, 3, 0, 0]}
                isAnimationActive={!reduceMotion}
                animationDuration={360}
              />
            ) : (
              series.map(s => {
                const dim = selectedId && selectedId !== s.id
                return (
                  <Bar
                    key={s.id}
                    dataKey={s.id}
                    stackId="a"
                    fill={s.color}
                    fillOpacity={dim ? 0.25 : 0.9}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={!reduceMotion}
                    animationDuration={360}
                  />
                )
              })
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
}

UsageBarChart.displayName = 'UsageBarChart'
export default UsageBarChart
