import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseList, projectMemberSchema, projectResponseSchema, projectSummarySchema } from './project-schemas'

const summary = {
  id: 'p1', ownerUserId: 'u1', organizationId: null, visibility: 'shared', title: 'T', description: 'd',
  tags: ['a'], createdAt: '2026-01-01', updatedAt: '2026-01-02', chatCount: 1, documentCount: 2,
}

describe('project schemas', () => {
  afterEach(() => vi.restoreAllMocks())

  it('accepts the backend summary shape', () => {
    expect(projectSummarySchema.parse(summary)).toMatchObject({ id: 'p1', visibility: 'shared', tags: ['a'] })
  })

  it('degrades optional fields to the backend defaults', () => {
    const parsed = projectSummarySchema.parse({ ...summary, visibility: 'galaxy', tags: null, description: null, chatCount: undefined })
    expect(parsed).toMatchObject({ visibility: 'personal', tags: [], description: '', chatCount: 0 })
  })

  it('rejects a project without an id or title', () => {
    expect(projectSummarySchema.safeParse({ ...summary, id: undefined }).success).toBe(false)
    expect(projectResponseSchema.safeParse({ ...summary, title: 3 }).success).toBe(false)
  })

  it('fills detail defaults', () => {
    const parsed = projectResponseSchema.parse({ ...summary, systemInstruction: null, documents: [{ id: 'f', filename: 'a.pdf', createdAt: 'x' }] })
    expect(parsed.systemInstruction).toBe('')
    expect(parsed.documents[0].fileLink).toBe('')
  })

  it('members default missing name/email to null', () => {
    expect(projectMemberSchema.parse({ user_id: 'u' })).toEqual({ user_id: 'u', name: null, email: null })
  })

  it('parseList drops malformed rows and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = parseList(projectSummarySchema, [summary, { id: 'bad' }, summary], 'project')
    expect(out).toHaveLength(2)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('parseList throws on a non-list body', () => {
    expect(() => parseList(projectSummarySchema, { detail: 'x' }, 'project')).toThrow(/expected a list/)
  })
})
