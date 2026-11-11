import { describe, expect, it, vi } from 'vitest'
import { MutationObserver, QueryClient } from '@tanstack/react-query'
import type { ScheduleDetailItem, ScheduleListItem } from '@/components/Schedules'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import { deleteScheduleOptions, toggleScheduleOptions } from './schedule-mutations'

// MutationObserver is the engine behind useMutation; driving it directly runs the same callbacks without a DOM.
const item = (id: string): ScheduleListItem => ({ id, name: id, description: '', frequency: 'Daily', isActive: true }) as ScheduleListItem

function seeded() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  qc.setQueryData(queryKeys.schedules.mine(), [item('a'), item('b'), item('c')])
  qc.setQueryData(queryKeys.schedules.detail('a'), item('a') as unknown as ScheduleDetailItem)
  return qc
}
const ids = (qc: QueryClient) => qc.getQueryData<ScheduleListItem[]>(queryKeys.schedules.mine())?.map(s => s.id)
const active = (qc: QueryClient, id: string) => qc.getQueryData<ScheduleListItem[]>(queryKeys.schedules.mine())?.find(s => s.id === id)?.isActive

describe('toggleScheduleOptions', () => {
  it('applies the flag before the request resolves and keeps it on success', async () => {
    const qc = seeded()
    let resolve!: (v: never) => void
    const update = vi.fn(() => new Promise<never>(r => { resolve = r }))
    const run = new MutationObserver(qc, toggleScheduleOptions(qc, update)).mutate({ id: 'a', active: false })
    await vi.waitFor(() => expect(update).toHaveBeenCalled())
    expect(active(qc, 'a')).toBe(false)
    expect(qc.getQueryData<ScheduleDetailItem>(queryKeys.schedules.detail('a'))?.isActive).toBe(false)
    resolve(undefined as never)
    await run
    expect(active(qc, 'a')).toBe(false)
  })

  it('rolls back only that schedule on error', async () => {
    const qc = seeded()
    const update = vi.fn().mockRejectedValue(new ApiError(409, 'conflict', 'No future run'))
    await expect(new MutationObserver(qc, toggleScheduleOptions(qc, update)).mutate({ id: 'a', active: false })).rejects.toBeInstanceOf(ApiError)
    expect(active(qc, 'a')).toBe(true)
    expect(active(qc, 'b')).toBe(true)
    expect(qc.getQueryData<ScheduleDetailItem>(queryKeys.schedules.detail('a'))?.isActive).toBe(true)
  })
})

describe('deleteScheduleOptions', () => {
  it('removes the row optimistically and drops the detail on success', async () => {
    const qc = seeded()
    let resolve!: (v: never) => void
    const remove = vi.fn(() => new Promise<never>(r => { resolve = r }))
    const run = new MutationObserver(qc, deleteScheduleOptions(qc, remove)).mutate('a')
    await vi.waitFor(() => expect(remove).toHaveBeenCalled())
    expect(ids(qc)).toEqual(['b', 'c'])
    expect(qc.getQueryData(queryKeys.schedules.detail('a'))).toBeDefined()
    resolve(undefined as never)
    await run
    expect(qc.getQueryData(queryKeys.schedules.detail('a'))).toBeUndefined()
  })

  it('puts the row back in place on error', async () => {
    const qc = seeded()
    const remove = vi.fn().mockRejectedValue(new Error('boom'))
    await expect(new MutationObserver(qc, deleteScheduleOptions(qc, remove)).mutate('b')).rejects.toThrow('boom')
    expect(ids(qc)).toEqual(['a', 'b', 'c'])
  })
})
