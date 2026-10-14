'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ScheduleEditData, ScheduleScope } from '@/components/Schedules'
import { copyAutomation, deleteAutomation, runAutomationNow } from '@/lib/api/automations'
import { ApiError } from '@/lib/api/client'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { logger } from '@/lib/logger'
import { queryKeys } from '@/lib/query-keys'
import { CHAT_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'
import { stashPendingPrompt } from '@/lib/scheduleLinks'
import { errorDetail, listItemToDetail } from '@/lib/schedules/schedule-mappers'
import {
  ScheduleNotFoundError,
  forgetSchedule,
  mySchedulesQuery,
  organizationSchedulesQuery,
  scheduleDetailQuery,
  toggleScheduleActive,
} from '@/lib/schedules/schedule-queries'

type ScheduleAction = 'load' | 'load_organization' | 'pause' | 'resume' | 'delete' | 'run' | 'copy'

/** One countable line per failed action: the action and HTTP status, nothing else. */
function logFailure(action: ScheduleAction, err: unknown) {
  logger.event('schedule_action_failed', { action, status: err instanceof ApiError ? err.status : undefined })
}

/** The Task prompt that creates or updates a schedule (the backend has no create/update-program endpoint). */
export function schedulePrompt(data: ScheduleEditData, isEdit: boolean): string {
  return [
    isEdit ? `I want to update the schedule "${data.name}".` : `I want to create a schedule called "${data.name}".`,
    ``,
    `${isEdit ? 'Updated instructions' : 'Instructions'}: ${data.instructions}`,
    `${isEdit ? 'Updated frequency' : 'Frequency'}: ${data.frequency}`,
    ...(data.timezone ? [`Timezone: ${data.timezone}`] : []),
  ].join('\n')
}

/**
 * Everything the Schedules screen does with data: the list, org list and
 * detail queries (polling while a run is in progress), and the actions with
 * their toasts, analytics and failure logs. SchedulesScreen renders only.
 */
export function useSchedules(scheduleId: string | undefined) {
  const { push, replace } = useRouter()
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<ScheduleScope>('mine')
  const [isCopying, setIsCopying] = useState(false)

  const listQ   = useQuery(mySchedulesQuery())
  const orgQ    = useQuery(organizationSchedulesQuery(scope === 'organization'))
  const detailQ = useQuery(scheduleDetailQuery(scheduleId))
  const selectedId = scheduleId ?? null

  useEffect(() => {
    if (!listQ.isError) return
    logFailure('load', listQ.error)
    const description = errorDetail(listQ.error)
    toast.error('Failed to load schedules', description ? { description } : undefined)
  }, [listQ.isError, listQ.error, listQ.errorUpdatedAt])

  // Only 403/404 from both the owner and org endpoints means "not found"; a
  // network or server failure gets a retry (see loadScheduleDetail).
  const detailError: 'not_found' | 'failed' | null = !detailQ.isError
    ? null
    : detailQ.error instanceof ScheduleNotFoundError ? 'not_found' : 'failed'

  const changeScope = useCallback((next: ScheduleScope) => {
    setScope(next)
    if (next !== 'organization') return
    queryClient.fetchQuery(organizationSchedulesQuery(true)).catch((err: unknown) => {
      logFailure('load_organization', err)
      toast.error('Failed to load organization schedules')
      setScope('mine')
    })
  }, [queryClient])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: (_res, id) => {
      trackBrowserEvent('schedule_deleted', {})
      toast.success('Schedule deleted')
      forgetSchedule(queryClient, id)
      if (scheduleId) replace(SCHEDULES_ROUTE)
    },
    onError: (err: unknown) => {
      logFailure('delete', err)
      toast.error('Failed to delete schedule', { description: errorDetail(err) })
    },
  })

  const toggleActive = useCallback((active: boolean) => {
    if (!selectedId) return
    // Reverts on failure (e.g. resuming a schedule with no future run → 409).
    toggleScheduleActive(queryClient, selectedId, active)
      .then(() => {
        if (active) trackBrowserEvent('schedule_resumed', {})
        else trackBrowserEvent('schedule_paused', {})
      })
      .catch((err: unknown) => {
        logFailure(active ? 'resume' : 'pause', err)
        toast.error(active ? 'Failed to resume schedule' : 'Failed to pause schedule', { description: errorDetail(err) })
      })
  }, [selectedId, queryClient])

  // The refetch picks up is_running, which starts polling until the run ends.
  const runMutation = useMutation({
    mutationFn: (id: string) => runAutomationNow(id),
    onSuccess: (_res, id) => {
      trackBrowserEvent('schedule_run_now', {})
      toast.success('Schedule triggered', { description: 'This task will start shortly.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.detail(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() })
    },
    onError: (err: unknown) => {
      logFailure('run', err)
      toast.error('Failed to run schedule', { description: errorDetail(err) })
    },
  })

  // Someone else's → a chat that already holds the program; the prompt is prefilled.
  const copy = useCallback(() => {
    if (!selectedId) return
    setIsCopying(true)
    copyAutomation(selectedId)
      .then(({ chat_id, prompt }) => {
        trackBrowserEvent('schedule_copied', {})
        const key = `copy-${chat_id}`
        stashPendingPrompt(key, prompt)
        push(`${CHAT_ROUTE}?id=${chat_id}&fromSchedule=${encodeURIComponent(key)}`)
      })
      .catch((err: unknown) => {
        logFailure('copy', err)
        toast.error('Failed to copy schedule', { description: errorDetail(err) })
        setIsCopying(false)
      })
  }, [selectedId, push])

  const selectedDetail = detailQ.data ?? null

  /**
   * Create or edit through chat: stash a structured prompt and open Task. An
   * edit reopens the schedule's own chat when known. The new schedule shows up
   * in the list once the chat has created it (this screen unmounts on navigation).
   */
  const sendToTask = useCallback((data: ScheduleEditData, isEdit: boolean) => {
    if (isEdit && selectedId) {
      stashPendingPrompt(selectedId, schedulePrompt(data, true))
      const linkedChatId = selectedDetail?.chatId
      push(linkedChatId
        ? `${CHAT_ROUTE}?id=${linkedChatId}&fromSchedule=${encodeURIComponent(selectedId)}`
        : `${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(selectedId)}`)
      return
    }
    const pendingKey = `new-${Date.now()}`
    stashPendingPrompt(pendingKey, schedulePrompt(data, false))
    push(`${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(pendingKey)}`)
  }, [selectedId, selectedDetail, push])

  const selectedListItem = selectedId ? ([...(listQ.data ?? []), ...(orgQ.data ?? [])].find(s => s.id === selectedId) ?? null) : null
  // The loaded detail if available; else the list row instantly (not once it has failed).
  const detailToShow = selectedDetail ?? (selectedListItem && !detailQ.isError ? listItemToDetail(selectedListItem) : null)

  return {
    scope,
    changeScope,
    visibleSchedules: (scope === 'organization' ? orgQ.data : listQ.data) ?? [],
    detailToShow,
    detailError,
    isLoading: (scheduleId ? detailQ.isPending : listQ.isPending) || (scope === 'organization' && !orgQ.data),
    retryDetail: () => { void detailQ.refetch() },
    toggleActive,
    deleteSchedule: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    runNow: runMutation.mutate,
    isRunningNow: runMutation.isPending,
    copy,
    isCopying,
    sendToTask,
  }
}
