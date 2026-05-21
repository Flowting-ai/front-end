'use client'

import React from 'react'
// eslint-disable-next-line react-doctor/prefer-dynamic-import -- chart primitives require synchronous import; component is already client-only
import {
  ResponsiveContainer, AreaChart, Area, Line, ReferenceDot,
} from 'recharts'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SparklineProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Y-values, evenly spaced on X. Minimum 2 points. */
  data:    number[]
  /** Plot area height. Defaults to 160. */
  height?: number
  /** Stroke / gradient colour. Defaults to `--color-chart-primary`. */
  color?:  string
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Sparkline({ data, height = 160, color, className, style, ref, ...props }: SparklineProps & { ref?: React.Ref<HTMLDivElement> }) {
    const reduceMotion = useReducedMotion() ?? false
    const stroke = color ?? 'var(--color-chart-primary)'
    const id     = React.useId().replace(/[^a-zA-Z0-9]/g, '')
    const gradId = `spark-${id}`

    const chartData = React.useMemo(
      () => data.map((y, i) => ({ x: i, y })),
      [data],
    )
    const last = chartData[chartData.length - 1]

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{ width: '100%', height, ...style }}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={stroke} stopOpacity={0.18} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="y"
              stroke="none"
              fill={`url(#${gradId})`}
              isAnimationActive={!reduceMotion}
              animationDuration={420}
            />
            <Line
              type="monotone"
              dataKey="y"
              stroke={stroke}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={!reduceMotion}
              animationDuration={420}
            />
            {last && (
              <>
                <ReferenceDot
                  x={last.x}
                  y={last.y}
                  r={6}
                  fill={stroke}
                  fillOpacity={0.25}
                  stroke="none"
                />
                <ReferenceDot
                  x={last.x}
                  y={last.y}
                  r={2.5}
                  fill={stroke}
                  stroke="none"
                />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )
}

Sparkline.displayName = 'Sparkline'
export default Sparkline
