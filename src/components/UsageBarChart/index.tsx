'use client'

import React from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
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
  /**
   * `all` → single bar, no per-series breakdown.
   * `per-link` → one bar per day, series stacked on top of each other.
   * `grouped` → one bar per series per day, side by side.
   */
  mode:     'all' | 'per-link' | 'grouped'
  /** Highlighted series in `per-link`/`grouped` mode — dimmed-out for the rest. */
  selectedId?: string | null
  height?:  number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// Dark tooltip bubble matching the app's established convention (dark
// gradient background, --tooltip-text foreground) — one row per series,
// colour dot + label + value, sorted to match the legend/bar order.
function ChartTooltip({ active, payload, label, series }: TooltipContentProps & { series: UsageBarChartSeries[] }) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div
      style={{
        background:    'linear-gradient(180deg, var(--tooltip-bg-from) 0%, var(--tooltip-bg-to) 100%)',
        color:         'var(--tooltip-text)',
        borderRadius:  8,
        padding:       '8px 10px',
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
        minWidth:      120,
        fontFamily:    'var(--font-body)',
        fontSize:      11,
        lineHeight:    '16px',
        boxShadow:     '0px 1px 4px rgba(59,54,50,0.5), 0px 0px 0px 0.5px var(--neutral-black)',
      }}
    >
      <span style={{ fontWeight: 500, opacity: 0.7 }}>{label}</span>
      {series.map(s => {
        const item = payload.find(p => p.dataKey === s.id)
        if (!item || item.value == null) return null
        return (
          <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{s.label}</span>
            <span style={{ fontWeight: 500 }}>{Number(item.value).toLocaleString()}</span>
          </span>
        )
      })}
    </div>
  )
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
            {mode !== 'all' && (
              <Tooltip
                cursor={{ fill: 'var(--neutral-100)' }}
                content={(tooltipProps: TooltipContentProps) => <ChartTooltip {...tooltipProps} series={series} />}
              />
            )}
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
                    stackId={mode === 'per-link' ? 'a' : undefined}
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
