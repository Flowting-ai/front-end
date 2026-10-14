'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ScheduleListView,
  ScheduleDetailView,
  ScheduleEditModal,
  ScheduleDeleteModal,
  type ScheduleEditData,
  type ScheduleScope,
} from '@/templates/Schedules'
import { copyAutomation, deleteAutomation, runAutomationNow } from '@/lib/api/automations'
import { errorDetail, listItemToDetail } from '@/lib/schedules/schedule-mappers'
import {
  ScheduleNotFoundError,
  forgetSchedule,
  mySchedulesQuery,
  organizationSchedulesQuery,
  scheduleDetailQuery,
  toggleScheduleActive,
} from '@/lib/schedules/schedule-queries'
import { queryKeys } from '@/lib/query-keys'
import { stashPendingPrompt } from '@/lib/scheduleLinks'
import { ScheduleLoadFailed, ScheduleNotFound } from './ScheduleRouteStates'
import { CHAT_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'
import { SchedulesLoadingState, ScheduleDetailLoadingState } from './ScheduleSkeletons'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export function SchedulesScreen({ scheduleId }: { scheduleId?: string }) {
  return (
    <Suspense fallback={null}>
      <SchedulesPageInner scheduleId={scheduleId} />
    </Suspense>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────
// Server state is React Query (lib/schedules/schedule-queries.ts): the list,
// the org list and the detail, each polling while a run is in progress.

// `scheduleId` comes from the /schedules/[id] route; the legacy ?selected= link
// (notifications, Slack) is redirected to that route below.
function SchedulesPageInner({ scheduleId }: { scheduleId?: string }) {
  const { push, replace } = useRouter()
  const searchParams = useSearchParams()
  const legacySelectedId = searchParams.get('selected')
  const queryClient = useQueryClient()

  const [scope,           setScope]           = useState<ScheduleScope>('mine')
  const [isCopying,       setIsCopying]       = useState(false)
  const [editModalOpen,   setEditModalOpen]   = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEditData | undefined>(undefined)

  const listQ   = useQuery(mySchedulesQuery())
  const orgQ    = useQuery(organizationSchedulesQuery(scope === 'organization'))
  const detailQ = useQuery(scheduleDetailQuery(scheduleId))
  const selectedId = scheduleId ?? null
  const selectedDetail = detailQ.data ?? null

  useEffect(() => {
    if (!listQ.isError) return
    // Surface the real reason — a generic message hides backend/auth errors.
    console.error('[schedules] failed to load tasks', listQ.error)
    const description = errorDetail(listQ.error)
    toast.error('Failed to load schedules', description ? { description } : undefined)
  }, [listQ.isError, listQ.error, listQ.errorUpdatedAt])

  // ── Legacy ?selected= links → /schedules/[id] ──────────────────────────────

  useEffect(() => {
    if (!scheduleId && legacySelectedId) replace(`${SCHEDULES_ROUTE}/${encodeURIComponent(legacySelectedId)}`)
  }, [scheduleId, legacySelectedId, replace])

  // Only 403/404 from both the owner and org endpoints means "not found"; a
  // network or server failure gets a retry (see loadScheduleDetail).
  const detailError: 'not_found' | 'failed' | null = !detailQ.isError
    ? null
    : detailQ.error instanceof ScheduleNotFoundError ? 'not_found' : 'failed'

  // ── Organization scope (loaded on first visit) ─────────────────────────────

  const handleScopeChange = useCallback((next: ScheduleScope) => {
    setScope(next)
    if (next !== 'organization') return
    queryClient.fetchQuery(organizationSchedulesQuery(true)).catch((err: unknown) => {
      console.error('[schedules] failed to load organization schedules', err)
      toast.error('Failed to load organization schedules')
      setScope('mine')
    })
  }, [queryClient])

  const visibleSchedules = (scope === 'organization' ? orgQ.data : listQ.data) ?? []

  // ── Select / open detail ───────────────────────────────────────────────────
  // Every schedule has its own URL.

  const handleScheduleClick = useCallback((id: string) => {
    push(`${SCHEDULES_ROUTE}/${encodeURIComponent(id)}`)
  }, [push])

  const handleBack = useCallback(() => {
    if (scheduleId) push(SCHEDULES_ROUTE)
  }, [scheduleId, push])

  // ── Create / edit (through chat — there are no create/update-program endpoints) ──

  const handleCreateNew = useCallback(() => {
    setEditingSchedule(undefined)
    setEditModalOpen(true)
  }, [])

  const handleEdit = useCallback(() => {
    if (!selectedDetail) return
    setEditingSchedule({
      name:         selectedDetail.name,
      instructions: selectedDetail.instructions,
      frequency:    selectedDetail.frequency,
    })
    setEditModalOpen(true)
  }, [selectedDetail])

  const handleSave = useCallback((data: ScheduleEditData) => {
    const isEdit = !!(editingSchedule && selectedId)

    if (isEdit) {
      const linkedChatId = selectedDetail?.chatId
      const prompt = [
        `I want to update the schedule "${data.name}".`,
        ``,
        `Updated instructions: ${data.instructions}`,
        `Updated frequency: ${data.frequency}`,
        ...(data.timezone ? [`Timezone: ${data.timezone}`] : []),
      ].join('\n')
      stashPendingPrompt(selectedId, prompt)
      setEditModalOpen(false)
      setEditingSchedule(undefined)
      if (linkedChatId) {
        push(`${CHAT_ROUTE}?id=${linkedChatId}&fromSchedule=${encodeURIComponent(selectedId)}`)
      } else {
        push(`${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(selectedId)}`)
      }
      return
    }

    // Create: build a structured prompt from all form fields so the chat has
    // full context, stash it under a fresh key, then navigate. The chat page
    // prefills it and writes the chatId back into the link store on first send.
    // The schedule shows up in the list once the chat has created it (this
    // screen unmounts on navigation, so there is no local placeholder row).
    const pendingKey = `new-${Date.now()}`
    const prompt = [
      `I want to create a schedule called "${data.name}".`,
      ``,
      `Instructions: ${data.instructions}`,
      `Frequency: ${data.frequency}`,
      ...(data.timezone ? [`Timezone: ${data.timezone}`] : []),
    ].join('\n')
    stashPendingPrompt(pendingKey, prompt)
    setEditModalOpen(false)
    setEditingSchedule(undefined)
    push(`${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(pendingKey)}`)
  }, [editingSchedule, selectedId, selectedDetail, push])

  // ── Delete (DELETE /automations/{id}) ──────────────────────────────────────
  // Keeps the modal (and detail view) open with a spinner until it resolves.

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: (_res, id) => {
      toast.success('Schedule deleted')
      forgetSchedule(queryClient, id)
      if (scheduleId) replace(SCHEDULES_ROUTE)
    },
    onError: (err: unknown) => { toast.error('Failed to delete schedule', { description: errorDetail(err) }) },
    onSettled: () => setDeleteModalOpen(false),
  })
  const deleteSchedule = deleteMutation.mutate

  const handleDeleteConfirm = useCallback(() => {
    if (selectedId) deleteSchedule(selectedId)
  }, [selectedId, deleteSchedule])

  // ── Toggle active (PATCH /automations/{id} — pause/resume; optimistic) ────────

  const handleToggleActive = useCallback((active: boolean) => {
    if (!selectedId) return
    // Reverts on failure (e.g. resuming a schedule with no future run → 409).
    toggleScheduleActive(queryClient, selectedId, active).catch((err: unknown) => {
      toast.error(active ? 'Failed to resume schedule' : 'Failed to pause schedule', { description: errorDetail(err) })
    })
  }, [selectedId, queryClient])

  // ── Run now ────────────────────────────────────────────────────────────────
  // The refetch picks up is_running, which starts polling until the run ends.

  const runMutation = useMutation({
    mutationFn: (id: string) => runAutomationNow(id),
    onSuccess: (_res, id) => {
      toast.success('Schedule triggered', { description: 'This task will start shortly.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.detail(id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.schedules.mine() })
    },
    onError: (err: unknown) => { toast.error('Failed to run schedule', { description: errorDetail(err) }) },
  })
  const runSchedule = runMutation.mutate

  const handleRunNow = useCallback(() => {
    if (selectedId) runSchedule(selectedId)
  }, [selectedId, runSchedule])

  // ── Copy (someone else's → a chat that rebuilds it as mine) ───────────────
  // The chat already holds the program. The prompt is prefilled for the user to
  // send.

  const handleCopy = useCallback(() => {
    if (!selectedId) return
    setIsCopying(true)
    copyAutomation(selectedId)
      .then(({ chat_id, prompt }) => {
        const key = `copy-${chat_id}`
        stashPendingPrompt(key, prompt)
        push(`${CHAT_ROUTE}?id=${chat_id}&fromSchedule=${encodeURIComponent(key)}`)
      })
      .catch((err: unknown) => {
        toast.error('Failed to copy schedule', { description: errorDetail(err) })
        setIsCopying(false)
      })
  }, [selectedId, push])

  // ── Derived: what to show in the center ───────────────────────────────────

  const selectedListItem  = selectedId ? ([...(listQ.data ?? []), ...(orgQ.data ?? [])].find(s => s.id === selectedId) ?? null) : null
  // Show the loaded detail if available; fall back to the list row instantly so
  // the detail view opens without waiting for the fetch (not once it has failed).
  const detailToShow      = selectedDetail ?? (selectedListItem && !detailQ.isError ? listItemToDetail(selectedListItem) : null)
  const isLoading         = (scheduleId ? detailQ.isPending : listQ.isPending) || (scope === 'organization' && !orgQ.data)

  return (
    <>
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--neutral-50)',
        // AppLayout renders this page bare, so it builds its own copy of the
        // shared center container.
        padding:         '10px 10px 10px 0',
      }}>
        <div style={{
          position:        'relative',
          flex:            '1 0 0',
          minHeight:       0,
          display:         'flex',
          flexDirection:   'column',
          borderRadius:    '22px',
          border:          '1px solid var(--border-default)',
          backgroundColor: 'var(--color-surface-glass)',
          overflow:        'hidden',
        }}>
          <div
            style={{
              flex:                '1 0 0',
              minHeight:           0,
              overflowY:           'auto',
              overscrollBehaviorY: 'contain',
            }}
            className="kaya-scrollbar"
          >
            <div style={{
              maxWidth:      991,
              width:         '100%',
              margin:        '0 auto',
              paddingLeft:   28,
              paddingRight:  28,
              paddingBottom: 40,
              boxSizing:     'border-box',
            }}>
              {detailToShow ? (
                <ScheduleDetailView
                  key={detailToShow.id}
                  schedule={detailToShow}
                  onBack={handleBack}
                  onEdit={handleEdit}
                  onDelete={() => setDeleteModalOpen(true)}
                  onRunNow={handleRunNow}
                  runningNow={runMutation.isPending}
                  onToggleActive={handleToggleActive}
                  onOpenChat={(chatId) => push(`${CHAT_ROUTE}?id=${chatId}`)}
                  onCopy={handleCopy}
                  copying={isCopying}
                />
              ) : scheduleId && detailError === 'not_found' ? (
                <ScheduleNotFound />
              ) : scheduleId && detailError === 'failed' ? (
                <ScheduleLoadFailed onRetry={() => { void detailQ.refetch() }} />
              ) : isLoading ? (
                scheduleId ? <ScheduleDetailLoadingState /> : <SchedulesLoadingState />
              ) : (
                <ScheduleListView
                  schedules={visibleSchedules}
                  scope={scope}
                  onScopeChange={handleScopeChange}
                  onScheduleClick={handleScheduleClick}
                  onCreateNew={handleCreateNew}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ScheduleEditModal
        isOpen={editModalOpen}
        schedule={editingSchedule}
        onSave={handleSave}
        onClose={() => { setEditModalOpen(false); setEditingSchedule(undefined) }}
      />

      {detailToShow && (
        <ScheduleDeleteModal
          isOpen={deleteModalOpen}
          scheduleName={detailToShow.name}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteModalOpen(false)}
          deleting={deleteMutation.isPending}
        />
      )}
    </>
  )
}
