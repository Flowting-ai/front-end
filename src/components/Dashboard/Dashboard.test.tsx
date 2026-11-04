import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DataGrid, cellText } from './DataGrid'
import { MetricTiles } from './MetricTiles'
import { periodFor, pointsFor, tilesFrom } from '@/lib/warehouse/present'

const catalog = [
  { name: 'orders', label: 'Orders', unit: 'count' as const, description: 'Orders placed' },
  { name: 'mer', label: 'MER', unit: 'ratio' as const, description: 'Revenue over ad spend' },
]

describe('periodFor', () => {
  it('covers the last N days ending today', () => {
    expect(periodFor('7d', new Date('2026-11-04T12:00:00Z'))).toEqual({ start: '2026-10-29', end: '2026-11-04' })
    expect(periodFor('30d', new Date('2026-11-04T12:00:00Z')).start).toBe('2026-10-06')
  })
})

describe('tilesFrom', () => {
  it('values every catalog metric from the total period and keeps why one is unavailable', () => {
    const tiles = tilesFrom(catalog, {
      grain: 'total', start: '2026-10-06', end: '2026-11-04', timezone: 'UTC',
      periods: [{ start: '2026-10-06', values: { orders: 42 } }],
      unavailable: { mer: 'needs ad_daily, which no connection in this store fills' },
    })
    expect(tiles.map(t => [t.name, t.value, t.unavailable])).toEqual([
      ['orders', 42, null],
      ['mer', null, 'needs ad_daily, which no connection in this store fills'],
    ])
  })
  it('is empty-valued before a measurement arrives', () => {
    expect(tilesFrom(catalog, undefined).every(t => t.value === null && t.unavailable === null)).toBe(true)
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

describe('MetricTiles', () => {
  it('disables an unavailable metric and marks the selected one', () => {
    const tiles = tilesFrom(catalog, {
      grain: 'total', start: '2026-10-06', end: '2026-11-04', timezone: 'UTC',
      periods: [{ start: '2026-10-06', values: { orders: 1234 } }], unavailable: { mer: 'needs ad_daily' },
    })
    const html = renderToStaticMarkup(<MetricTiles tiles={tiles} selected="orders" onSelect={() => {}} />)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('1,234')
    expect(html).toContain('disabled=""')
    expect(html).toContain('n/a')
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
