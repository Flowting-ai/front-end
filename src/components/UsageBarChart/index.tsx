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
  /** Optional 1px outline color for this series' bar segments. Omit for no border. */
  borderColor?: string
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
  /** Corner radius per bar, as Recharts' `[topLeft, topRight, bottomRight, bottomLeft]`. @default [3, 3, 0, 0] */
  barRadius?: [number, number, number, number]
  /** Background highlight behind the hovered day's bars. @default true */
  showHoverCursor?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

interface BarGeometry {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
}

// A plain `stroke` on each stacked segment draws its FULL perimeter, so two
// adjacent segments each draw their own line along the seam where they
// touch — in different colors, since every category has its own ring color.
// That reads as a doubled/conflicting border at every internal seam instead
// of one clean line. This draws each segment's fill with no built-in stroke,
// then adds the left/right edges (never shared with another segment) plus
// the top edge only for the topmost segment and the bottom edge only for
// the bottommost — so the seams between segments stay borderless and the
// stack's outer silhouette reads as one continuous outline.
function makeStackedBarShape(borderColor: string, isTop: boolean, isBottom: boolean, fillOpacity: number) {
  return function StackedBarShape({ x = 0, y = 0, width = 0, height = 0, fill }: BarGeometry) {
    if (height <= 0 || width <= 0) return null
    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={fill} fillOpacity={fillOpacity} />
        <line x1={x} y1={y} x2={x} y2={y + height} stroke={borderColor} strokeWidth={1} />
        <line x1={x + width} y1={y} x2={x + width} y2={y + height} stroke={borderColor} strokeWidth={1} />
        {isTop && <line x1={x} y1={y} x2={x + width} y2={y} stroke={borderColor} strokeWidth={1} />}
        {isBottom && <line x1={x} y1={y + height} x2={x + width} y2={y + height} stroke={borderColor} strokeWidth={1} />}
      </g>
    )
  }
}

// Dark tooltip bubble matching the app's established convention (dark
// gradient background, --tooltip-text foreground) — one row per series,
// colour dot + label + value, ordered to match the visual stack.
function ChartTooltip({ active, payload, label, series, mode }: TooltipContentProps & { series: UsageBarChartSeries[]; mode: UsageBarChartProps['mode'] }) {
  if (!active || !payload || payload.length === 0) return null

  // In `per-link` (stacked), each <Bar> below stacks in declaration order —
  // the FIRST series ends up at the BOTTOM of the stack, the LAST at the TOP.
  // Reversed here so reading the tooltip top-to-bottom matches reading the
  // bar top-to-bottom, instead of listing bottom-of-stack first.
  const rows = mode === 'per-link' ? [...series].reverse() : series

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
      {rows.map(s => {
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

export function UsageBarChart({ days, series, mode, selectedId, height = 180, barRadius = [3, 3, 0, 0], showHoverCursor = true, className, style, ref, ...props }: UsageBarChartProps & { ref?: React.Ref<HTMLDivElement> }) {
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
                cursor={showHoverCursor ? { fill: 'var(--neutral-100)' } : false}
                content={(tooltipProps: TooltipContentProps) => <ChartTooltip {...tooltipProps} series={series} mode={mode} />}
              />
            )}
            {mode === 'all' ? (
              <Bar
                dataKey="total"
                fill="var(--neutral-700)"
                radius={barRadius}
                isAnimationActive={!reduceMotion}
                animationDuration={360}
              />
            ) : (
              series.map((s, idx) => {
                const dim = selectedId && selectedId !== s.id
                const fillOpacity = dim ? 0.25 : 0.9
                // Only stacked bars have touching-segment seams to worry
                // about — `grouped` bars sit side by side with nothing
                // touching, so a plain full-perimeter stroke is already
                // seam-free there.
                const stacked = mode === 'per-link' && !!s.borderColor
                return (
                  <Bar
                    key={s.id}
                    dataKey={s.id}
                    stackId={mode === 'per-link' ? 'a' : undefined}
                    fill={s.color}
                    fillOpacity={fillOpacity}
                    stroke={stacked ? undefined : s.borderColor}
                    strokeWidth={stacked ? 0 : (s.borderColor ? 1 : 0)}
                    shape={stacked ? makeStackedBarShape(s.borderColor!, idx === series.length - 1, idx === 0, fillOpacity) : undefined}
                    radius={barRadius}
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
