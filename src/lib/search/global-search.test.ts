import { describe, expect, it } from 'vitest'
import {
  buildSearchIndex,
  CHAT_RESULT_LIMIT,
  recentChats,
  resultCountMessage,
  searchIndex,
  type SearchSources,
} from './global-search'

const EMPTY: SearchSources = { chats: [], projectChats: [], agentChats: [], projects: [], personas: [], pins: [], pages: [] }

const SOURCES: SearchSources = {
  chats: [{ id: 'c1', title: 'Revenue plan' }, { id: 'c2', title: null }],
  projectChats: [{ id: 'pc1', title: 'Revenue in Q3', projectId: 'p1' }],
  agentChats: [{ id: 'ac1', title: 'Ask about revenue', personaId: 'a1' }],
  projects: [{ id: 'p1', name: 'Finance', description: 'Quarterly REVENUE work' }],
  personas: [{ id: 'a1', name: 'Analyst', handle: 'analyst', description: 'Numbers', tags: ['Revenue'] }],
  pins: [{ id: 'pin1', title: 'Revenue chart', content: '', tags: [], chatId: 'pc1' }],
  pages: [{ id: 'page-plans', title: 'Plan & Billing', subtitle: 'Settings', route: '/org/plans', keywords: 'billing revenue' }],
}

describe('searchIndex', () => {
  const index = buildSearchIndex(SOURCES)

  it('matches every source case-insensitively, in source order', () => {
    expect(searchIndex(index, '  REVENUE ').map(r => `${r.type}:${r.id}`)).toEqual([
      'chat:c1', 'chat:pc1', 'agent-chat:ac1', 'project:p1', 'persona:a1', 'pin:pin1', 'page:page-plans',
    ])
  })

  it('adds context subtitles', () => {
    const results = searchIndex(index, 'revenue')
    expect(results.find(r => r.id === 'pc1')?.subtitle).toBe('in Finance')
    expect(results.find(r => r.id === 'ac1')?.subtitle).toBe('with Analyst')
    expect(results.find(r => r.id === 'pin1')?.subtitle).toBe('in Revenue in Q3')
  })

  it('returns nothing for a blank query', () => {
    expect(searchIndex(index, '   ')).toEqual([])
  })

  it('matches untitled chats only by their real title', () => {
    expect(searchIndex(index, 'untitled')).toEqual([])
  })

  it('caps each group', () => {
    const chats = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, title: `match ${i}` }))
    expect(searchIndex(buildSearchIndex({ ...EMPTY, chats }), 'match')).toHaveLength(CHAT_RESULT_LIMIT)
  })

  it('names chats of draft agents but never returns the draft', () => {
    const personas = [{ id: 'd1', name: 'Draft bot', handle: 'draft', description: '', tags: [], draft: true }]
    const agentChats = [{ id: 'x', title: 'hello', personaId: 'd1' }]
    const index = buildSearchIndex({ ...EMPTY, personas, agentChats })
    expect(searchIndex(index, 'draft')).toEqual([])
    expect(searchIndex(index, 'hello')[0].subtitle).toBe('with Draft bot')
  })

  it('skips pins when the caller passes none (flag off)', () => {
    expect(searchIndex(buildSearchIndex({ ...SOURCES, pins: [] }), 'chart')).toEqual([])
  })
})

describe('recentChats', () => {
  it('skips project chats and caps at five', () => {
    const chats = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, title: '' }))
    const recents = recentChats(chats, new Set(['c0']))
    expect(recents.map(r => r.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5'])
    expect(recents[0].title).toBe('Untitled chat')
  })
})

describe('resultCountMessage', () => {
  it.each([
    [0, false, false, ''],
    [0, true, true, 'Searching…'],
    [0, true, false, 'No results'],
    [1, true, false, '1 result'],
    [4, true, true, '4 results'],
  ])('%i results, query=%s, loading=%s', (count, hasQuery, loading, message) => {
    expect(resultCountMessage(count, hasQuery, loading)).toBe(message)
  })
})
