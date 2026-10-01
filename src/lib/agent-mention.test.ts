import { describe, expect, it } from 'vitest'
import { MAX_MENTION_RESULTS, filterAgents, findMention, removeMention } from './agent-mention'

describe('findMention', () => {
  it('finds a mention at the start, after a space, and while typing its query', () => {
    expect(findMention('@', 1)).toEqual({ start: 0, query: '' })
    expect(findMention('@sup', 4)).toEqual({ start: 0, query: 'sup' })
    expect(findMention('hello @sup', 10)).toEqual({ start: 6, query: 'sup' })
    expect(findMention('line one\n@tri', 13)).toEqual({ start: 9, query: 'tri' })
  })

  it('uses the caret, not the end of the text', () => {
    expect(findMention('hello @sup there', 10)).toEqual({ start: 6, query: 'sup' })
    expect(findMention('hello @sup there', 16)).toBeNull()
  })

  it('ignores an email address, a finished word, and a mid-word @', () => {
    expect(findMention('mail me at a@b.com', 18)).toBeNull()
    expect(findMention('@support ', 9)).toBeNull()
    expect(findMention('price@', 6)).toBeNull()
    expect(findMention('no mention here', 15)).toBeNull()
  })

  it('does not run on across a second @', () => {
    expect(findMention('@a@b', 4)).toBeNull()
  })

  it('tolerates a caret outside the text', () => {
    expect(findMention('@ab', 99)).toEqual({ start: 0, query: 'ab' })
    expect(findMention('@ab', -3)).toBeNull()
  })
})

describe('removeMention', () => {
  it('removes the mention and leaves single spacing', () => {
    expect(removeMention('hello @sup world', { start: 6, query: 'sup' }, 10)).toEqual({ text: 'hello world', caret: 6 })
    expect(removeMention('hello @sup', { start: 6, query: 'sup' }, 10)).toEqual({ text: 'hello ', caret: 6 })
  })

  it('removes a leading mention without leaving a leading space', () => {
    expect(removeMention('@sup summarise this', { start: 0, query: 'sup' }, 4)).toEqual({ text: 'summarise this', caret: 0 })
    expect(removeMention('@', { start: 0, query: '' }, 1)).toEqual({ text: '', caret: 0 })
  })

  it('only removes up to the caret', () => {
    expect(removeMention('@sup extra', { start: 0, query: 'su' }, 3)).toEqual({ text: 'p extra', caret: 0 })
  })
})

describe('filterAgents', () => {
  const agents = [
    { id: '1', name: 'Support Triage', handle: '@support-triage' },
    { id: '2', name: 'Contract Reviewer', handle: '@contract-reviewer' },
    { id: '3', name: 'Email Support Writer', handle: '@email-support-writer' },
    { id: '4', name: 'Research Helper', handle: '@research-helper' },
  ]

  it('returns the first agents for an empty query', () => {
    expect(filterAgents(agents, '').map(a => a.id)).toEqual(['1', '2', '3', '4'])
    expect(filterAgents(agents, '', 2).map(a => a.id)).toEqual(['1', '2'])
  })

  it('ranks prefix matches before word-start and substring matches', () => {
    expect(filterAgents(agents, 'sup').map(a => a.id)).toEqual(['1', '3'])
    expect(filterAgents(agents, 'rev').map(a => a.id)).toEqual(['2'])
    expect(filterAgents(agents, 'ewer').map(a => a.id)).toEqual(['2'])
  })

  it('matches the handle with or without the @ and ignores case and punctuation', () => {
    expect(filterAgents(agents, '@Contract-Rev').map(a => a.id)).toEqual(['2'])
    expect(filterAgents(agents, 'RESEARCH').map(a => a.id)).toEqual(['4'])
  })

  it('returns nothing when nothing matches', () => {
    expect(filterAgents(agents, 'zzz')).toEqual([])
  })

  it('caps the results', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `Agent ${i}`, handle: `@agent-${i}` }))
    expect(filterAgents(many, 'agent')).toHaveLength(MAX_MENTION_RESULTS)
  })
})
