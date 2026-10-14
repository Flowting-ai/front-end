import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import type { ScheduleDetailItem, ScheduleListItem } from '@/components/Schedules'
import { ApiError } from '@/lib/api/client'
import { queryKeys } from '@/lib/query-keys'
import {
  SCHEDULE_POLL_MS,
  ScheduleNotFoundError,
  forgetSchedule,
  loadScheduleDetail,
  pollWhileRunning,
  scheduleDetailQuery,
  toggleScheduleActive,
  type DetailDeps,
} from './schedule-queries'

const item = (id: string, extra: Partial<ScheduleListItem> = {}): ScheduleListItem =>
  ({ id, name: id, description: '', frequency: 'Daily', isActive: true, ...extra }) as ScheduleListItem

function seeded() {
  const qc = new QueryClient()
  qc.setQueryData(queryKeys.schedules.mine(), [item('a'), item('b')])
  qc.setQueryData(queryKeys.schedules.detail('a'), { ...item('a') } as unknown as ScheduleDetailItem)
  return qc
}
const listActive = (qc: QueryClient, id: string) =>
  qc.getQueryData<ScheduleListItem[]>(queryKeys.schedules.mine())?.find(s => s.id === id)?.isActive

describe('toggleScheduleActive', () => {
  it('applies the change to list and detail on success', async () => {
    const qc = seeded()
    const update = vi.fn().mockResolvedValue({})
    await toggleScheduleActive(qc, 'a', false, update)
    expect(update).toHaveBeenCalledWith('a', { is_active: false })
    expect(listActive(qc, 'a')).toBe(false)
    expect(qc.getQueryData<ScheduleDetailItem>(queryKeys.schedules.detail('a'))?.isActive).toBe(false)
  })

  it('reverts only that schedule and rethrows on failure', async () => {
    const qc = seeded()
    const update = vi.fn().mockRejectedValue(new ApiError(409, 'conflict', 'No future run'))
    await expect(toggleScheduleActive(qc, 'a', false, update)).rejects.toMatchObject({ status: 409 })
    expect(listActive(qc, 'a')).toBe(true)
    expect(listActive(qc, 'b')).toBe(true)
    expect(qc.getQueryData<ScheduleDetailItem>(queryKeys.schedules.detail('a'))?.isActive).toBe(true)
  })
})

describe('forgetSchedule', () => {
  it('drops the row and the detail after a confirmed delete', () => {
    const qc = seeded()
    forgetSchedule(qc, 'a')
    expect(qc.getQueryData<ScheduleListItem[]>(queryKeys.schedules.mine())?.map(s => s.id)).toEqual(['b'])
    expect(qc.getQueryData(queryKeys.schedules.detail('a'))).toBeUndefined()
  })
})

describe('pollWhileRunning', () => {
  it('polls only while something shown is running', () => {
    expect(pollWhileRunning(undefined)).toBe(false)
    expect(pollWhileRunning([item('a'), item('b')])).toBe(false)
    expect(pollWhileRunning([item('a'), item('b', { isRunning: true })])).toBe(SCHEDULE_POLL_MS)
    expect(pollWhileRunning({ isRunning: true } as ScheduleDetailItem)).toBe(SCHEDULE_POLL_MS)
  })
})

describe('loadScheduleDetail', () => {
  const orgRow = {
    id: 'x', name: 'Org one', summary: '', schedule_json: {}, trigger: {}, is_active: true, status: 'active',
    run_count: 0, success_count: 0, failure_count: 0, running_count: 0, is_running: false,
    owner_name: 'Sam', connectors: [],
  }
  const deps = (over: Partial<DetailDeps>): DetailDeps => ({
    getAutomation: vi.fn().mockRejectedValue(new ApiError(404, 'nf', 'no')),
    listOrganizationAutomations: vi.fn().mockResolvedValue([]),
    linkScheduleToChat: vi.fn(),
    getChatForSchedule: vi.fn(),
    ...over,
  } as DetailDeps)

  it('rethrows a server failure without trying the org list', async () => {
    const d = deps({ getAutomation: vi.fn().mockRejectedValue(new ApiError(503, 'down', 'down')) })
    await expect(loadScheduleDetail('x', d)).rejects.toMatchObject({ status: 503 })
    expect(d.listOrganizationAutomations).not.toHaveBeenCalled()
  })

  it('falls back to the org row on 403/404, else not found', async () => {
    const found = deps({ listOrganizationAutomations: vi.fn().mockResolvedValue([orgRow]) as DetailDeps['listOrganizationAutomations'] })
    await expect(loadScheduleDetail('x', found)).resolves.toMatchObject({ id: 'x', name: 'Org one' })
    await expect(loadScheduleDetail('x', deps({}))).rejects.toBeInstanceOf(ScheduleNotFoundError)
  })

  it('a failing org list is retryable unless it is also 403/404', async () => {
    const down = deps({ listOrganizationAutomations: vi.fn().mockRejectedValue(new ApiError(500, 'x', 'x')) })
    await expect(loadScheduleDetail('x', down)).rejects.toMatchObject({ status: 500 })
    const forbidden = deps({ listOrganizationAutomations: vi.fn().mockRejectedValue(new ApiError(403, 'x', 'x')) })
    await expect(loadScheduleDetail('x', forbidden)).rejects.toBeInstanceOf(ScheduleNotFoundError)
  })

  it('never retries a not-found detail', () => {
    const retry = scheduleDetailQuery('x').retry as (n: number, e: unknown) => boolean
    expect(retry(0, new ScheduleNotFoundError('x'))).toBe(false)
    expect(retry(0, new ApiError(503, 'x', 'x'))).toBe(true)
  })
})
