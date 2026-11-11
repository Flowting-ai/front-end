import { mutationOptions, type QueryClient } from '@tanstack/react-query'
import type { ScheduleListItem } from '@/components/Schedules'
import { deleteAutomation, updateAutomation } from '@/lib/api/automations'
import { queryKeys } from '@/lib/query-keys'
import { setActive } from './schedule-queries'

export type ToggleScheduleVars = { id: string; active: boolean }

/**
 * Pause/resume. Optimistic in the list and the detail; on failure (e.g. a 409 resuming a schedule
 * with no future run) only this schedule's flag goes back. Settling refetches just its list and detail.
 */
export function toggleScheduleOptions(qc: QueryClient, update: typeof updateAutomation = updateAutomation) {
  return mutationOptions({
    mutationKey: [...queryKeys.schedules.all(), 'toggle'],
    mutationFn: ({ id, active }: ToggleScheduleVars) => update(id, { is_active: active }),
    onMutate: async ({ id, active }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.schedules.mine(), exact: true }),
        qc.cancelQueries({ queryKey: queryKeys.schedules.detail(id), exact: true }),
      ])
      setActive(qc, id, active)
      return { previous: !active }
    },
    onError: (_err, { id }, ctx) => {
      if (ctx) setActive(qc, id, ctx.previous)
    },
    onSettled: (_data, _err, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedules.mine(), exact: true })
      void qc.invalidateQueries({ queryKey: queryKeys.schedules.detail(id), exact: true })
    },
  })
}

/**
 * Delete. The row leaves My schedules at once and is put back where it was on failure. The detail is
 * kept until the server confirms, because the open schedule page still reads it under the confirm.
 */
export function deleteScheduleOptions(qc: QueryClient, remove: typeof deleteAutomation = deleteAutomation) {
  return mutationOptions({
    mutationKey: [...queryKeys.schedules.all(), 'delete'],
    mutationFn: (id: string) => remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.schedules.mine(), exact: true })
      const list = qc.getQueryData<ScheduleListItem[]>(queryKeys.schedules.mine())
      const index = list?.findIndex(s => s.id === id) ?? -1
      const removed = index >= 0 ? list![index] : undefined
      if (removed) qc.setQueryData<ScheduleListItem[]>(queryKeys.schedules.mine(), prev => prev?.filter(s => s.id !== id))
      return { removed, index }
    },
    onError: (_err, id, ctx) => {
      const removed = ctx?.removed
      if (!removed) return
      qc.setQueryData<ScheduleListItem[]>(queryKeys.schedules.mine(), prev => {
        if (!prev || prev.some(s => s.id === id)) return prev
        const next = prev.slice()
        next.splice(Math.min(ctx.index, next.length), 0, removed)
        return next
      })
    },
    onSuccess: (_res, id) => {
      qc.removeQueries({ queryKey: queryKeys.schedules.detail(id), exact: true })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.schedules.mine(), exact: true })
    },
  })
}
