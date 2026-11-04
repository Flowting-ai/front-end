// Turning warehouse measurements into what the Dashboard draws: periods for a range, the headline strip, metric rows, chart points, sync state.

import type { Grain, Measurement, MetricEntry, MetricUnit, Workspace } from '@/lib/api/warehouse'
import { formatCount, formatCurrencyCompact, formatPercent, type MetricFormat } from '@/lib/home/format'
import type { Channel, HomeMetric } from '@/lib/home/mock-data'

export type DashboardRange = '7d' | '30d' | '90d'

export const RANGE_OPTIONS: ReadonlyArray<{ id: DashboardRange; label: string; days: number }> = [
  { id: '7d',  label: 'Last 7 days',  days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

/** The metrics that lead the page, in order; the rest list below them. */
export const HEADLINE = ['revenue', 'orders', 'aov', 'refund_rate']

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function daysOf(range: DashboardRange): number {
  return RANGE_OPTIONS.find(o => o.id === range)?.days ?? 30
}

/** The inclusive window a range covers, ending today (UTC dates; the warehouse counts days in the store's zone). */
export function periodFor(range: DashboardRange, today = new Date()): { start: string; end: string } {
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - (daysOf(range) - 1))
  return { start: isoDate(start), end: isoDate(today) }
}

/** The window of the same length just before periodFor's, for the change figures. */
export function previousPeriodFor(range: DashboardRange, today = new Date()): { start: string; end: string } {
  const end = new Date(today)
  end.setUTCDate(end.getUTCDate() - daysOf(range))
  return periodFor(range, end)
}

export function formatValue(value: number | null, unit: MetricUnit): string {
  if (value === null) return '—'
  switch (unit) {
    case 'money': return formatCurrencyCompact(value)
    case 'count': return formatCount(value)
    case 'ratio': return formatPercent(value * 100, 1)
  }
}

const FORMAT_OF: Record<MetricUnit, MetricFormat> = { money: 'currency', count: 'count', ratio: 'percent' }

/** Change against the previous period in percent units; nothing to compare against reads as flat. */
export function deltaOf(current: number | null, previous: number | null): number {
  if (current === null || previous === null || previous === 0) return 0
  return ((current - previous) / Math.abs(previous)) * 100
}

export interface MetricTile {
  name: string
  label: string
  unit: MetricUnit
  description: string
  value: number | null
  previous: number | null
  /** Why the store cannot measure it, when it cannot. */
  unavailable: string | null
}

/** One tile per catalog metric, valued from a total-grain measurement and the one before it. */
export function tilesFrom(catalog: MetricEntry[], total: Measurement | undefined, previous?: Measurement): MetricTile[] {
  const values = total?.periods[0]?.values ?? {}
  const before = previous?.periods[0]?.values ?? {}
  return catalog.map(entry => ({
    name: entry.name, label: entry.label, unit: entry.unit, description: entry.description,
    value: values[entry.name] ?? null,
    previous: before[entry.name] ?? null,
    unavailable: total?.unavailable[entry.name] ?? null,
  }))
}

const CHANNEL_OF: Record<string, Channel> = { shopify: 'shopify', shopify_app: 'shopify' }

/** The sales channels among the connectors feeding a workspace, for the marks on the headline strip. */
export function channelsOf(connectors: string[]): Channel[] {
  return [...new Set(connectors.map(slug => CHANNEL_OF[slug]).filter((channel): channel is Channel => channel !== undefined))]
}

/** The headline metrics in the Home strip's shape; an unavailable one is left out. */
export function headlineFrom(tiles: MetricTile[], channels: Channel[]): HomeMetric[] {
  return HEADLINE
    .map(name => tiles.find(tile => tile.name === name))
    .filter((tile): tile is MetricTile => tile !== undefined && tile.unavailable === null)
    .map(tile => ({
      id: tile.name,
      label: tile.label,
      value: tile.unit === 'ratio' ? (tile.value ?? 0) * 100 : tile.value ?? 0,
      format: FORMAT_OF[tile.unit],
      delta: deltaOf(tile.value, tile.previous),
      channels,
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

export type SyncState = 'building' | 'syncing' | 'ready' | 'failed'

export interface Sync {
  state: SyncState
  lastSyncedAt: string | null
}

/** The workspace's sync as one state: building until any category has synced once, then failed, syncing or ready. */
export function syncOf(workspace: Workspace): Sync {
  const synced = workspace.categories.map(c => c.lastSyncedAt).filter((at): at is string => at !== null).sort()
  const lastSyncedAt = synced.at(-1) ?? null
  if (lastSyncedAt === null) return { state: workspace.categories.every(c => c.status === 'failed') ? 'failed' : 'building', lastSyncedAt }
  if (workspace.categories.some(c => c.status === 'failed')) return { state: 'failed', lastSyncedAt }
  if (workspace.categories.some(c => c.status === 'syncing' || c.status === 'building')) return { state: 'syncing', lastSyncedAt }
  return { state: 'ready', lastSyncedAt }
}

export function syncedLabel(sync: Sync): string {
  if (sync.state === 'building') return 'Building your dashboard'
  if (sync.state === 'failed') return 'Sync failed'
  if (sync.state === 'syncing') return 'Syncing'
  const minutes = Math.round((Date.now() - new Date(sync.lastSyncedAt ?? 0).getTime()) / 60_000)
  if (minutes < 1) return 'Synced just now'
  if (minutes < 60) return `Synced ${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `Synced ${hours} h ago` : `Synced ${Math.round(hours / 24)} d ago`
}
