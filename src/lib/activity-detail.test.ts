import { describe, expect, it } from 'vitest'

import { deriveActivityDetail } from '@/lib/activity-detail'

describe('deriveActivityDetail', () => {
  it('shows the search query instead of the tool name', () => {
    expect(deriveActivityDetail('search_web', '{"query":"best hiking boots 2026"}')).toBe('best hiking boots 2026')
  })

  it('accepts the parsed args object stored with history', () => {
    expect(deriveActivityDetail('read_url', { url: 'https://example.com/post' })).toBe('https://example.com/post')
  })

  it('prefers the query for search tools and the target for everything else', () => {
    const args = { query: 'pricing', url: 'https://example.com' }
    expect(deriveActivityDetail('search_web', args)).toBe('pricing')
    expect(deriveActivityDetail('fetch_resource', args)).toBe('https://example.com')
  })

  it('joins list arguments and collapses whitespace', () => {
    expect(deriveActivityDetail('search_web', { queries: ['a  b', ' c '] })).toBe('a b, c')
  })

  it('truncates very long values', () => {
    const detail = deriveActivityDetail('search_web', { query: 'x'.repeat(400) })
    expect(detail).toHaveLength(160)
    expect(detail?.endsWith('…')).toBe(true)
  })

  it('returns undefined when the args carry nothing to show', () => {
    expect(deriveActivityDetail('search_web', undefined)).toBeUndefined()
    expect(deriveActivityDetail('search_web', '')).toBeUndefined()
    expect(deriveActivityDetail('search_web', '{"query": "unterminated')).toBeUndefined()
    expect(deriveActivityDetail('search_web', '["a"]')).toBeUndefined()
    expect(deriveActivityDetail('csv_execute', { code: 'print(1)' })).toBeUndefined()
    expect(deriveActivityDetail('search_web', { query: '   ' })).toBeUndefined()
  })
})
