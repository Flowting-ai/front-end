import { describe, expect, it } from 'vitest'
import { diffLines, diffSummary, fromBackendQuestions } from './index'

describe('diffLines', () => {
  it('keeps headings and bullets on their own rows instead of gluing them to the next sentence', () => {
    const original = '## Role\nYou are a lawyer.\n- Be brief'
    const rewrite = '## Role\nYou are a contracts lawyer.\n- Be brief\n- Cite sources'
    expect(diffLines(original, rewrite)).toEqual([
      { type: 'unchanged', text: '## Role' },
      { type: 'removed',   text: 'You are a lawyer.' },
      { type: 'added',     text: 'You are a contracts lawyer.' },
      { type: 'unchanged', text: '- Be brief' },
      { type: 'added',     text: '- Cite sources' },
    ])
  })

  it('ignores blank lines, trailing whitespace and CRLF', () => {
    expect(diffLines('a  \r\n\r\nb', 'a\nb')).toEqual([
      { type: 'unchanged', text: 'a' },
      { type: 'unchanged', text: 'b' },
    ])
  })

  it('treats an empty original as all additions and an empty rewrite as all removals', () => {
    expect(diffLines('', 'x\ny')).toEqual([{ type: 'added', text: 'x' }, { type: 'added', text: 'y' }])
    expect(diffLines('x\ny', '')).toEqual([{ type: 'removed', text: 'x' }, { type: 'removed', text: 'y' }])
  })

  it('shows an unchanged prompt as all unchanged', () => {
    expect(diffLines('a\nb', 'a\nb').every(s => s.type === 'unchanged')).toBe(true)
  })
})

describe('diffSummary', () => {
  it('counts words added and contiguous added groups', () => {
    const s = diffSummary('one\ntwo', 'one\nnew line here\ntwo\nanother new')
    expect(s.wordsAdded).toBe(5)
    expect(s.guidelineGroups).toBe(2)
  })
})

describe('fromBackendQuestions', () => {
  it('maps questions to card questions and appends an "Other" row', () => {
    const [q] = fromBackendQuestions([{
      question: 'Who is the audience?',
      multi_select: true,
      options: [{ label: 'Lawyers', description: 'd1' }, { label: 'Clients', description: 'd2' }],
    }])
    expect(q.id).toBe('q0')
    expect(q.text).toBe('Who is the audience?')
    expect(q.multiSelect).toBe(true)
    expect(q.options.map(o => o.label)).toEqual(['Lawyers', 'Clients', 'Other'])
    expect(q.options.at(-1)?.id).toBe('custom')
  })

  it('gives each question a distinct id and leaves single-select unflagged', () => {
    const qs = fromBackendQuestions([
      { question: 'a', multi_select: false, options: [] },
      { question: 'b', multi_select: false, options: [] },
    ])
    expect(qs.map(q => q.id)).toEqual(['q0', 'q1'])
    expect(qs[0].multiSelect).toBeUndefined()
  })
})
