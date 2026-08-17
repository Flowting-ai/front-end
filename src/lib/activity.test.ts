import { describe, expect, it } from 'vitest'

import { normalizeActivityStatus, toolNameToType, webSearchResults } from '@/lib/activity'

describe('activity normalization', () => {
  it('does not dress the browser capability up as a search', () => {
    // The browser drives a page and emits no `web_search` event, so the
    // web-search row would promise sources it can never fill.
    expect(toolNameToType('browser')).toBe('browser')
    expect(toolNameToType('web_search')).toBe('web-search')
  })

  it('titles sources from the search metadata, not the bare URL', () => {
    const links = ['https://example.com/a-long-story-slug']
    const results = [{ url: 'https://example.com/a-long-story-slug', title: 'The Real Headline' }]

    expect(webSearchResults(links, results)).toEqual([
      { title: 'The Real Headline', url: 'https://example.com/a-long-story-slug', domain: 'example.com' },
    ])
    // A search persisted before results were streamed still renders.
    expect(webSearchResults(links, [])[0].url).toBe('https://example.com/a-long-story-slug')
  })

  it('keeps backend failures terminal instead of turning them green', () => {
    expect(normalizeActivityStatus('error')).toBe('error')
    expect(normalizeActivityStatus('failed')).toBe('error')
    expect(normalizeActivityStatus('failure')).toBe('error')
  })
})
