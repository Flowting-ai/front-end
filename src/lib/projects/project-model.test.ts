import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { ApiProjectSummary } from '@/lib/api/projects'
import { optimisticUpdate } from '@/lib/query-invalidation'
import { queryKeys } from '@/lib/query-keys'
import {
  mapProject,
  mergeProjectChats,
  mergeSummaries,
  summaryToProject,
  tagsFromLabels,
  toApiPatch,
  upsertProject,
  type Project,
  type ProjectChat,
} from './project-model'

const summary = (id: string, title = id): ApiProjectSummary => ({
  id, title, description: '', ownerUserId: 'u1', teamId: null, visibility: 'personal',
  canEdit: true, tags: [], chatCount: 0, updatedAt: '2026-10-01T00:00:00Z',
} as unknown as ApiProjectSummary)

const chat = (id: string, projectId: string): ProjectChat => ({
  id, projectId, ownerUserId: 'u1', canEdit: true, title: id, pinCount: 0, createdAt: '', updatedAt: '',
})

describe('mergeSummaries', () => {
  it('keeps loaded detail fields, refreshes summary fields, drops missing projects', () => {
    const loaded: Project = { ...summaryToProject(summary('a')), instructions: 'Be brief' }
    const gone = summaryToProject(summary('b'))
    const next = mergeSummaries([loaded, gone], [summary('a', 'Renamed')])
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ id: 'a', name: 'Renamed', instructions: 'Be brief' })
  })
})

describe('list helpers', () => {
  it('upsertProject replaces in place or prepends', () => {
    const a = summaryToProject(summary('a'))
    const b = summaryToProject(summary('b'))
    expect(upsertProject([a], { ...a, name: 'A2' }).map(p => p.name)).toEqual(['A2'])
    expect(upsertProject([a], b).map(p => p.id)).toEqual(['b', 'a'])
    expect(mapProject([a, b], 'b', p => ({ ...p, chatCount: 3 }))[1].chatCount).toBe(3)
  })

  it('toApiPatch maps view fields to the PATCH body and drops absent ones', () => {
    expect(toApiPatch({ name: 'N', tags: tagsFromLabels(['x']) })).toEqual({ title: 'N', tags: ['x'] })
    expect(toApiPatch({})).toEqual({})
  })
})

describe('mergeProjectChats', () => {
  it('replaces one project, keeps local-only chats and other projects', () => {
    const prev = [chat('local', 'p1'), chat('old', 'p1'), chat('other', 'p2')]
    const next = mergeProjectChats(prev, 'p1', [chat('old', 'p1'), chat('new', 'p1')])
    expect(next.map(c => c.id).sort()).toEqual(['local', 'new', 'old', 'other'])
    expect(next.filter(c => c.id === 'old')).toHaveLength(1)
  })
})

describe('optimisticUpdate', () => {
  it('cancels an in-flight fetch so a late response cannot overwrite the change, and rolls back', async () => {
    const qc = new QueryClient()
    const key = queryKeys.projects.list('u1')
    qc.setQueryData<Project[]>(key, [summaryToProject(summary('a'))])
    let resolveLate: (v: Project[]) => void = () => {}
    const late = qc.fetchQuery({ queryKey: key, queryFn: () => new Promise<Project[]>(r => { resolveLate = r }), staleTime: 0 }).catch(() => null)

    const rollback = await optimisticUpdate<Project[]>(qc, key, prev => mapProject(prev ?? [], 'a', p => ({ ...p, name: 'Optimistic' })))
    resolveLate([summaryToProject(summary('a', 'Stale'))])
    await late
    expect(qc.getQueryData<Project[]>(key)?.[0].name).toBe('Optimistic')

    rollback()
    expect(qc.getQueryData<Project[]>(key)?.[0].name).toBe('a')
  })
})
