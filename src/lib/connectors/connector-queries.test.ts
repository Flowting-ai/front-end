import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { ConnectorCatalog } from '@/lib/api/connectors'
import { queryKeys } from '@/lib/query-keys'
import { FEATURED_APPS, appSearchQuery, loadFeaturedApps, mergeCatalog } from './connector-queries'

const row = (slug: string, accounts = 0) => ({ slug, connections: Array.from({ length: accounts }, (_, i) => ({ id: `${slug}-${i}` })) }) as unknown as ConnectorCatalog

describe('mergeCatalog', () => {
  it('lets linked rows win over picked copies and keeps unlinked picks', () => {
    const merged = mergeCatalog([row('gmail', 1)], [row('gmail', 0), row('notion')])
    expect(merged.map(r => r.slug)).toEqual(['gmail', 'notion'])
    expect(merged[0].connections).toHaveLength(1)
    expect(mergeCatalog(undefined, [row('x')]).map(r => r.slug)).toEqual(['x'])
  })
})

describe('loadFeaturedApps', () => {
  it('skips slugs that fail and fails only when every slug fails', async () => {
    const fetchOne = vi.fn(async (slug: string) => {
      if (slug === 'slack') throw new Error('down')
      return row(slug)
    })
    const rows = await loadFeaturedApps(fetchOne)
    expect(rows.map(r => r.slug)).toEqual(FEATURED_APPS.filter(s => s !== 'slack'))
    await expect(loadFeaturedApps(async () => { throw new Error('offline') })).rejects.toThrow()
  })
})

describe('appSearchQuery', () => {
  it('normalises the query key and stays off for an empty query', () => {
    expect(appSearchQuery('  Gmail ').queryKey).toEqual(queryKeys.connectors.search('gmail'))
    expect(appSearchQuery('   ').enabled).toBe(false)
  })

  it('connector invalidation reaches search and featured but not the identity map', async () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.connectors.search('gmail'), [])
    qc.setQueryData(queryKeys.connectors.featured(), [])
    qc.setQueryData(queryKeys.connectors.identities(), new Map())
    await qc.invalidateQueries({ queryKey: queryKeys.connectors.all() })
    expect(qc.getQueryState(queryKeys.connectors.search('gmail'))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.connectors.featured())?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.connectors.identities())?.isInvalidated).toBe(false)
  })
})
