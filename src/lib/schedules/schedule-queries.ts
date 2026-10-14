import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { ScheduleDetailItem, ScheduleListItem } from '@/templates/Schedules'
import {
  getAutomation,
  listAutomations,
  listOrganizationAutomations,
  updateAutomation,
} from '@/lib/api/automations'
import { queryKeys } from '@/lib/query-keys'
import { shouldRetryQuery } from '@/lib/query-policy'
import { getAllScheduleLinks, getChatForSchedule, linkScheduleToChat } from '@/lib/scheduleLinks'
import {
  detailFailureKind,
  listItemToDetail,
  organizationToListItem,
  taskDetailToDetail,
  taskToListItem,
} from './schedule-mappers'

/** How often to refetch while a run is executing, so status and history update live. */
export const SCHEDULE_POLL_MS = 5_000

/** The schedule is neither the viewer's nor in their org's list. Not retried. */
export class ScheduleNotFoundError extends Error {
  constructor(public readonly id: string) {
    super('Schedule not found')
    this.name = 'ScheduleNotFoundError'
  }
}

export interface DetailDeps {
  getAutomation: typeof getAutomation
  listOrganizationAutomations: typeof listOrganizationAutomations
  linkScheduleToChat: typeof linkScheduleToChat
  getChatForSchedule: typeof getChatForSchedule
}

const defaultDeps: DetailDeps = { getAutomation, listOrganizationAutomations, linkScheduleToChat, getChatForSchedule }

/**
 * Load one schedule. The owner gets the full detail (and its chat_id is
 * mirrored into the link store, since list rows don't carry chat_id). Only a
 * 403/404 falls back to the org list, which is all a non-owner may read;
 * anything else rethrows so the screen can offer a retry.
 */
export async function loadScheduleDetail(id: string, deps: DetailDeps = defaultDeps): Promise<ScheduleDetailItem> {
  try {
    const task = await deps.getAutomation(id)
    if (task.chat_id) deps.linkScheduleToChat(task.id, task.chat_id)
    return taskDetailToDetail(task, deps.getChatForSchedule(task.id))
  } catch (err) {
    if (detailFailureKind(err) === 'retry') throw err
  }
  try {
    const row = (await deps.listOrganizationAutomations()).find(task => task.id === id)
    if (!row) throw new ScheduleNotFoundError(id)
    return listItemToDetail(organizationToListItem(row))
  } catch (orgErr) {
    if (orgErr instanceof ScheduleNotFoundError || detailFailureKind(orgErr) !== 'retry') throw new ScheduleNotFoundError(id)
    throw orgErr
  }
}

/** Refetch interval: poll while anything shown is running, otherwise stop. */
export function pollWhileRunning(data: ScheduleListItem[] | ScheduleDetailItem | undefined): number | false {
  if (!data) return false
  const running = Array.isArray(data) ? data.some(s => s.isRunning) : !!data.isRunning
  return running ? SCHEDULE_POLL_MS : false
}

export const mySchedulesQuery = () =>
  queryOptions({
    queryKey: queryKeys.schedules.mine(),
    queryFn: async () => {
      const links = getAllScheduleLinks()
      return (await listAutomations()).map(t => taskToListItem(t, links[t.id]))
    },
    refetchInterval: q => pollWhileRunning(q.state.data),
  })

export const organizationSchedulesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.schedules.organization(),
    queryFn: async () => (await listOrganizationAutomations()).map(organizationToListItem),
    enabled,
  })

export const scheduleDetailQuery = (id: string | undefined) =>
  queryOptions({
    queryKey: queryKeys.schedules.detail(id ?? ''),
    queryFn: () => loadScheduleDetail(id!),
    enabled: !!id,
    retry: (count, err) => !(err instanceof ScheduleNotFoundError) && shouldRetryQuery(count, err),
    refetchInterval: q => pollWhileRunning(q.state.data),
  })

function setActive(qc: QueryClient, id: string, active: boolean) {
  qc.setQueryData<ScheduleListItem[]>(queryKeys.schedules.mine(), prev => prev?.map(s => (s.id === id ? { ...s, isActive: active } : s)))
  qc.setQueryData<ScheduleDetailItem>(queryKeys.schedules.detail(id), prev => (prev ? { ...prev, isActive: active } : prev))
}

/**
 * Pause/resume, optimistic in the list and the detail. On failure (e.g. a 409
 * resuming a schedule with no future run) only this schedule's flag is
 * reverted, and the error is rethrown for the caller's toast.
 */
export async function toggleScheduleActive(qc: QueryClient, id: string, active: boolean, update = updateAutomation): Promise<void> {
  await Promise.all([
    qc.cancelQueries({ queryKey: queryKeys.schedules.mine(), exact: true }),
    qc.cancelQueries({ queryKey: queryKeys.schedules.detail(id), exact: true }),
  ])
  setActive(qc, id, active)
  try {
    await update(id, { is_active: active })
  } catch (err) {
    setActive(qc, id, !active)
    throw err
  }
}

/** After a confirmed delete: drop it from the list and forget its detail. */
export function forgetSchedule(qc: QueryClient, id: string): void {
  qc.setQueryData<ScheduleListItem[]>(queryKeys.schedules.mine(), prev => prev?.filter(s => s.id !== id))
  qc.removeQueries({ queryKey: queryKeys.schedules.detail(id), exact: true })
}
