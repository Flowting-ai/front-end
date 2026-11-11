import { describe, expect, it } from 'vitest'
import type { SearchResult } from '@/components/GlobalSearchModal'
import { MATCH_RANK, foldText, matchRanges, matchesAllTerms, queryTerms, rankTitle } from './text-match'
import { buildSearchIndex, parseStoredRecents, recentsWithOpened, rememberOpened, searchIndex, type SearchSources } from './global-search'

describe('text matching', () => {
  it('folds case and diacritics', () => {
    expect(foldText('Café Ñandú')).toBe('cafe nandu')
    expect(queryTerms('  Paris  café paris ')).toEqual(['paris', 'cafe'])
  })

  it('requires every term somewhere', () => {
    expect(matchesAllTerms(['trip to paris', 'notes'], ['paris', 'notes'])).toBe(true)
    expect(matchesAllTerms(['trip to paris'], ['paris', 'rome'])).toBe(false)
    expect(matchesAllTerms(['x'], [])).toBe(false)
  })

  it('ranks exact > prefix > word start > substring', () => {
    expect(rankTitle('budget', 'Budget')).toBe(MATCH_RANK.exact)
    expect(rankTitle('budget 2026', 'budget')).toBe(MATCH_RANK.prefix)
    expect(rankTitle('q3 budget', 'budget')).toBe(MATCH_RANK.wordStart)
    expect(rankTitle('rebudgeting', 'budget')).toBe(MATCH_RANK.substring)
    expect(rankTitle('notes', 'budget')).toBe(MATCH_RANK.none)
  })

  it('maps ranges back to the original text, merging overlaps', () => {
    expect(matchRanges('Café in Paris', 'cafe paris')).toEqual([[0, 4], [8, 13]])
    expect(matchRanges('aaa', 'aa a')).toEqual([[0, 3]])
    expect(matchRanges('plain', '')).toEqual([])
  })
})

const sources = (chats: string[]): SearchSources => ({
  chats: chats.map((title, i) => ({ id: `c${i}`, title })),
  projectChats: [], agentChats: [], projects: [], personas: [], pins: [], pages: [],
})

describe('searchIndex ranking', () => {
  it('ranks within a group and keeps recency order for ties', () => {
    const index = buildSearchIndex(sources(['Old budget notes', 'Budget', 'new budget plan', 'Budget review']))
    expect(searchIndex(index, 'budget').map(r => r.title)).toEqual(['Budget', 'Budget review', 'Old budget notes', 'new budget plan'])
  })

  it('matches without diacritics and across terms', () => {
    const index = buildSearchIndex(sources(['Réunion à Montréal', 'Montreal trip']))
    expect(searchIndex(index, 'reunion montreal').map(r => r.title)).toEqual(['Réunion à Montréal'])
  })
})

describe('recently opened', () => {
  const r = (id: string, title = id): SearchResult => ({ id, type: 'chat', title })

  it('dedupes, caps and survives bad storage', () => {
    let list: SearchResult[] = []
    for (const id of ['a', 'b', 'a', 'c', 'd', 'e', 'f']) list = rememberOpened(list, r(id))
    expect(list.map(x => x.id)).toEqual(['f', 'e', 'd', 'c', 'a'])
    expect(parseStoredRecents('not json')).toEqual([])
    expect(parseStoredRecents(JSON.stringify([{ id: 1 }, r('x')]))).toEqual([r('x')])
  })

  it('drops results that no longer exist and uses current titles', () => {
    const index = buildSearchIndex(sources(['Renamed', 'Other']))
    const out = recentsWithOpened(index, [r('c0', 'Old name'), r('gone')], [r('c1')])
    expect(out.map(x => x.title)).toEqual(['Renamed', 'Other'])
  })
})
