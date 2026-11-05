import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MetricRows } from './MetricRows'
import {
  channelsOf, deltaOf, headlineFrom, periodFor, pointsFor, previousPeriodFor, syncOf, tilesFrom,
} from '@/lib/warehouse/present'

const catalog = [
  { name: 'orders', label: 'Orders', unit: 'count' as const, description: 'Orders placed', category: 'store' },
  { name: 'revenue', label: 'Revenue', unit: 'money' as const, description: 'What customers paid', category: 'store' },
  { name: 'refund_rate', label: 'Refund rate', unit: 'ratio' as const, description: 'Refunds over revenue', category: 'store' },
  { name: 'mer', label: 'MER', unit: 'ratio' as const, description: 'Revenue over ad spend', category: 'ads' },
]
const TODAY = new Date('2026-11-04T12:00:00Z')

function measured(values: Record<string, number | null>, unavailable: Record<string, string> = {}) {
  return { grain: 'total' as const, start: '2026-10-06', end: '2026-11-04', timezone: 'UTC', periods: [{ start: '2026-10-06', values }], unavailable }
}

describe('periods', () => {
  it('cover the last N days ending today, and the N before them', () => {
    expect(periodFor('7d', TODAY)).toEqual({ start: '2026-10-29', end: '2026-11-04' })
    expect(previousPeriodFor('7d', TODAY)).toEqual({ start: '2026-10-22', end: '2026-10-28' })
    expect(periodFor('30d', TODAY).start).toBe('2026-10-06')
  })
})

describe('tilesFrom', () => {
  it('values every catalog metric from both periods and keeps why one is unavailable', () => {
    const tiles = tilesFrom(catalog, measured({ orders: 42 }, { mer: 'needs ad_daily' }), measured({ orders: 40 }))
    expect(tiles.map(t => [t.name, t.value, t.previous, t.unavailable])).toEqual([
      ['orders', 42, 40, null],
      ['revenue', null, null, null],
      ['refund_rate', null, null, null],
      ['mer', null, null, 'needs ad_daily'],
    ])
  })
  it('is empty-valued before a measurement arrives', () => {
    expect(tilesFrom(catalog, undefined).every(t => t.value === null && t.unavailable === null)).toBe(true)
  })
})

describe('deltaOf', () => {
  it('is the change in percent, flat with nothing to compare against', () => {
    expect(deltaOf(110, 100)).toBeCloseTo(10)
    expect(deltaOf(90, 100)).toBeCloseTo(-10)
    expect(deltaOf(5, 0)).toBe(0)
    expect(deltaOf(5, null)).toBe(0)
  })
})

describe('headlineFrom', () => {
  it('takes the headline metrics in order, in the Home strip shape, ratios in percent units', () => {
    const tiles = tilesFrom(catalog, measured({ orders: 42, revenue: 1000, refund_rate: 0.012 }), measured({ orders: 40, revenue: 800, refund_rate: 0.012 }))
    const strip = headlineFrom(tiles, ['shopify'])
    expect(strip.map(m => [m.id, m.value, m.format, Math.round(m.delta)])).toEqual([
      ['revenue', 1000, 'currency', 25],
      ['orders', 42, 'count', 5],
      ['refund_rate', 1.2, 'percent', 0],
    ])
    expect(strip[0].channels).toEqual(['shopify'])
  })
  it('leaves out a headline metric the store cannot measure', () => {
    const tiles = tilesFrom(catalog, measured({ orders: 1 }, { revenue: 'needs orders.total' }))
    expect(headlineFrom(tiles, []).map(m => m.id)).toEqual(['orders', 'refund_rate'])
  })
})

describe('channelsOf', () => {
  it('maps the Shopify connectors to one Shopify mark and ignores the rest', () => {
    expect(channelsOf(['shopify_app', 'shopify', 'klaviyo'])).toEqual(['shopify'])
  })
})

describe('syncOf', () => {
  const workspace = (categories: { status: string; lastSyncedAt: string | null }[]) => ({
    id: 'w', name: 'Forma', slug: 'forma', timezone: 'UTC', connectors: [],
    categories: categories.map((c, i) => ({ category: `c${i}`, ...c })),
  })
  it('is building until any category has synced once', () => {
    expect(syncOf(workspace([{ status: 'building', lastSyncedAt: null }])).state).toBe('building')
    expect(syncOf(workspace([{ status: 'failed', lastSyncedAt: null }])).state).toBe('failed')
  })
  it('leaves out a category the store has nothing for', () => {
    expect(syncOf(workspace([{ status: 'ready', lastSyncedAt: '2026-11-04T01:00:00Z' }, { status: 'not_applicable', lastSyncedAt: null }])).state).toBe('ready')
  })
  it('then reads failed over syncing over ready, with the newest sync time', () => {
    expect(syncOf(workspace([{ status: 'ready', lastSyncedAt: '2026-11-04T01:00:00Z' }, { status: 'failed', lastSyncedAt: null }])).state).toBe('failed')
    expect(syncOf(workspace([{ status: 'ready', lastSyncedAt: '2026-11-04T01:00:00Z' }, { status: 'syncing', lastSyncedAt: '2026-11-04T02:00:00Z' }]))).toEqual({ state: 'syncing', lastSyncedAt: '2026-11-04T02:00:00Z' })
    expect(syncOf(workspace([{ status: 'ready', lastSyncedAt: '2026-11-04T01:00:00Z' }])).state).toBe('ready')
  })
})

describe('pointsFor', () => {
  it('reads one metric out of every daily period', () => {
    const daily = {
      grain: 'day' as const, start: '2026-11-01', end: '2026-11-02', timezone: 'UTC', unavailable: {},
      periods: [{ start: '2026-11-01', values: { orders: 3 } }, { start: '2026-11-02', values: { orders: null } }],
    }
    expect(pointsFor(daily, 'orders')).toEqual([{ day: '2026-11-01', value: 3 }, { day: '2026-11-02', value: null }])
  })
})

describe('MetricRows', () => {
  it('disables an unavailable metric, marks the selected one, and shows the change', () => {
    const tiles = tilesFrom(catalog, measured({ orders: 1234 }, { mer: 'needs ad_daily' }), measured({ orders: 1000 }))
    const html = renderToStaticMarkup(<MetricRows tiles={tiles} selected="orders" onSelect={() => {}} against="previous 30 days" />)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('1,234')
    expect(html).toContain('23.4% vs previous 30 days')
    expect(html).toContain('disabled=""')
    expect(html).toContain('n/a')
    expect(html).toContain('needs ad_daily')
  })
})
