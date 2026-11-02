import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }))
vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ user: { auth0Id: 'u1' } }) }))
vi.mock('@/lib/analytics/events', () => ({ trackFeature: vi.fn() }))

import { queryKeys } from '@/lib/query-keys'
import type { Project, ProjectChat } from './project-model'
import { ProjectDeleteForbiddenError, deleteProjectOptions, updateProjectOptions } from './project-mutations'

const project = (id: string, extra: Partial<Project> = {}) => ({ id, name: id, description: '', canEdit: true, ...extra }) as Project
const listKey = queryKeys.projects.list('u1')
const chatsKey = queryKeys.projects.chats('u1')
const names = (qc: QueryClient) => qc.getQueryData<Project[]>(listKey)?.map(p => `${p.id}:${p.name}`)

function seeded() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  qc.setQueryData(listKey, [project('a'), project('b'), project('c', { canEdit: false })])
  qc.setQueryData(chatsKey, [{ id: 'ch1', projectId: 'a' } as ProjectChat])
  return qc
}

/** A request that stays pending until `fail` is called. */
function pendingThenFail(message: string) {
  let fail!: () => void
  const fn = vi.fn(() => new Promise<never>((_resolve, reject) => { fail = () => reject(new Error(message)) }))
  return { fn, fail: () => fail() }
}

beforeEach(() => toastError.mockReset())

describe('updateProjectOptions', () => {
  it('renames optimistically, then rolls back with the error toast', async () => {
    const qc = seeded()
    const req = pendingThenFail('down')
    const run = new MutationObserver(qc, updateProjectOptions(qc, 'u1', { update: req.fn })).mutate({ id: 'a', patch: { name: 'Renamed' } })
    await vi.waitFor(() => expect(req.fn).toHaveBeenCalled())
    expect(names(qc)).toEqual(['a:Renamed', 'b:b', 'c:c'])
    req.fail()
    await expect(run).rejects.toThrow('down')
    expect(names(qc)).toEqual(['a:a', 'b:b', 'c:c'])
    expect(toastError).toHaveBeenCalledWith('Failed to update project', { description: 'down' })
  })
})

describe('deleteProjectOptions', () => {
  it('removes the project and its chats at once, and restores both on error', async () => {
    const qc = seeded()
    const req = pendingThenFail('nope')
    const run = new MutationObserver(qc, deleteProjectOptions(qc, 'u1', { remove: req.fn })).mutate('a')
    await vi.waitFor(() => expect(req.fn).toHaveBeenCalled())
    expect(names(qc)).toEqual(['b:b', 'c:c'])
    expect(qc.getQueryData<ProjectChat[]>(chatsKey)).toEqual([])
    req.fail()
    await expect(run).rejects.toThrow('nope')
    expect(names(qc)?.sort()).toEqual(['a:a', 'b:b', 'c:c'])
    expect(qc.getQueryData<ProjectChat[]>(chatsKey)?.map(c => c.id)).toEqual(['ch1'])
    expect(toastError).toHaveBeenCalledWith('Failed to delete project', { description: 'nope' })
  })

  it('refuses a non-owner before touching the cache or the API', async () => {
    const qc = seeded()
    const remove = vi.fn()
    await expect(new MutationObserver(qc, deleteProjectOptions(qc, 'u1', { remove })).mutate('c')).rejects.toBeInstanceOf(ProjectDeleteForbiddenError)
    expect(remove).not.toHaveBeenCalled()
    expect(names(qc)).toEqual(['a:a', 'b:b', 'c:c'])
    expect(toastError).toHaveBeenCalledWith("You don't have permission to delete this project.")
  })
})
