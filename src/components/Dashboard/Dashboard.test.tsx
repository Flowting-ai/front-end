import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DataGrid, cellText } from './DataGrid'
import { MetricRows } from './MetricRows'
import { metricNameOf, parseFormula, unitOf } from '@/lib/warehouse/editor'
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

describe('metric editor', () => {
  it('names the metric from its label', () => {
    expect(metricNameOf('Shipping share of revenue')).toBe('shipping_share_of_revenue')
    expect(metricNameOf('2nd order rate!')).toBe('m_2nd_order_rate')
  })
  it('reads a formula over metrics and numbers into the warehouse shape', () => {
    const names = ['shipping_revenue', 'revenue', 'refunds', 'net_sales']
    expect(parseFormula('shipping_revenue / revenue', names, [])).toEqual({ op: 'ratio', numerator: 'shipping_revenue', denominator: 'revenue' })
    expect(parseFormula('(revenue - refunds) * 0.3', names, [])).toEqual({ op: 'multiply', terms: [{ op: 'subtract', left: 'revenue', right: 'refunds' }, 0.3] })
    expect(parseFormula('net_sales + refunds + 10', names, [])).toEqual({ op: 'add', terms: [{ op: 'add', terms: ['net_sales', 'refunds'] }, 10] })
    expect(unitOf(parseFormula('refunds / revenue', names, []))).toBe('ratio')
    expect(() => parseFormula('revenue / nope', names, [])).toThrow('No metric called nope')
    expect(() => parseFormula('revenue +', names, [])).toThrow('ends early')
    expect(() => parseFormula('revenue', names, [])).toThrow('already exists')
  })
  it('reads a sum or count over a store table, dated by its first date column', () => {
    const tables = [{ name: 'orders', meaning: '', rows: 1, columns: [{ name: 'order_id', type: 'string' }, { name: 'placed_at', type: 'timestamp[us, tz=UTC]' }, { name: 'total', type: 'decimal128(18, 2)' }] }]
    expect(parseFormula('sum(orders.total)', [], tables)).toEqual({ kind: 'sum', table: 'orders', column: 'total', day: 'placed_at', where: null })
    expect(parseFormula('count(orders)', [], tables)).toEqual({ kind: 'count', table: 'orders', column: null, day: 'placed_at', where: null })
    expect(unitOf(parseFormula('count(orders)', [], tables))).toBe('count')
    expect(() => parseFormula('sum(orders.nope)', [], tables)).toThrow('no column nope')
    expect(() => parseFormula('sum(orders.total) / 2', [], tables)).toThrow('stands alone')
    expect(() => parseFormula('count(refunds)', [], tables)).toThrow('No table called refunds')
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

describe('DataGrid', () => {
  it('prints scalars as text, nested values as JSON, and nothing for null', () => {
    expect(cellText('a')).toBe('a')
    expect(cellText(12.5)).toBe('12.5')
    expect(cellText(null)).toBe('')
    expect(cellText({ k: 1 })).toBe('{"k":1}')
    expect(cellText(['BF25'])).toBe('["BF25"]')
  })
  it('renders one column per schema column', () => {
    const html = renderToStaticMarkup(
      <DataGrid caption="orders" columns={[{ name: 'order_id', type: 'string' }, { name: 'total', type: 'decimal' }]}
        rows={[{ order_id: '6123', total: null }]} />,
    )
    expect(html).toContain('order_id')
    expect(html).toContain('6123')
    expect(html).toContain('—')
  })
})
