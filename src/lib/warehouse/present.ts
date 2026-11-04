// Turning warehouse measurements into what the Dashboard draws: the period for a range, metric tiles, chart points.

import type { Grain, Measurement, MetricEntry, MetricUnit } from '@/lib/api/warehouse'
import { formatCount, formatCurrencyCompact, formatPercent } from '@/lib/home/format'

export type DashboardRange = '7d' | '30d' | '90d'

export const RANGE_OPTIONS: ReadonlyArray<{ id: DashboardRange; label: string; days: number }> = [
  { id: '7d',  label: '7d',  days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
]

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** The inclusive window a range covers, ending today (UTC dates; the warehouse counts days in the store's zone). */
export function periodFor(range: DashboardRange, today = new Date()): { start: string; end: string } {
  const days = RANGE_OPTIONS.find(o => o.id === range)?.days ?? 30
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return { start: isoDate(start), end: isoDate(today) }
}

export function formatValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return '—'
  switch (unit) {
    case 'money': return formatCurrencyCompact(value)
    case 'count': return formatCount(value)
    case 'ratio': return formatPercent(value * 100, 1)
  }
}

export interface MetricTile {
  name: string
  label: string
  unit: MetricUnit
  description: string
  value: number | null
  /** Why the store cannot measure it, when it cannot. */
  unavailable: string | null
}

/** One tile per catalog metric, valued from a total-grain measurement. */
export function tilesFrom(catalog: MetricEntry[], total: Measurement | undefined): MetricTile[] {
  const values = total?.periods[0]?.values ?? {}
  return catalog.map(entry => ({
    name: entry.name, label: entry.label, unit: entry.unit, description: entry.description,
    value: values[entry.name] ?? null,
    unavailable: total?.unavailable[entry.name] ?? null,
  }))
}

export interface ChartPoint {
  day: string
  value: number | null
}

export function pointsFor(daily: Measurement | undefined, metric: string): ChartPoint[] {
  return (daily?.periods ?? []).map(period => ({ day: period.start, value: period.values[metric] ?? null }))
}

export const CHART_GRAIN: Grain = 'day'
