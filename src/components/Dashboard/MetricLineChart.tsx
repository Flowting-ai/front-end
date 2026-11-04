'use client'

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MetricUnit } from '@/lib/api/warehouse'
import { formatValue, type ChartPoint } from '@/lib/warehouse/present'

export interface MetricLineChartProps {
  points: ChartPoint[]
  unit: MetricUnit
  height?: number
}

// Owns the Recharts import (~290 KB); MetricsPanel loads this lazily the first time a chart renders.
export function MetricLineChart({ points, unit, height = 220 }: MetricLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border-default)" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={24}
          tick={{ fill: 'var(--neutral-600)', fontSize: 12 }} tickFormatter={day => String(day).slice(5)} />
        <YAxis width={64} tickLine={false} axisLine={false}
          tick={{ fill: 'var(--neutral-600)', fontSize: 12 }}
          tickFormatter={value => formatValue(Number(value), unit)} />
        <Tooltip
          formatter={value => formatValue(typeof value === 'number' ? value : null, unit)}
          contentStyle={{ background: 'var(--neutral-white)', border: '1px solid var(--border-default)', borderRadius: 8 }}
        />
        <Line type="monotone" dataKey="value" stroke="var(--neutral-900)" strokeWidth={1.5} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  )
}
