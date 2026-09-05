'use client'

import { Suspense, useState, useEffect, useId, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ScheduleListView,
  ScheduleDetailView,
  ScheduleEditModal,
  ScheduleDeleteModal,
  type ScheduleListItem,
  type ScheduleDetailItem,
  type ScheduleEditData,
} from '@/templates/Brain'
import {
  listAutomations,
  getAutomation,
  runAutomationNow,
  updateAutomation,
  deleteAutomation,
  runSummary,
  type Automation,
  type AutomationDetail,
  type AutomationRun,
} from '@/lib/api/automations'
import type { ScheduleRunRecord } from '@/templates/Brain'
import { getAllScheduleLinks, getChatForSchedule, stashPendingPrompt } from '@/lib/scheduleLinks'
import { ApiError } from '@/lib/api/client'
import { BRAIN_NEW_THREAD_EVENT } from '@/hooks/use-sidebar-events'
import { BRAIN_ROUTE } from '@/lib/routes'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function BrainSchedulesPage() {
  return (
    <Suspense fallback={null}>
      <BrainSchedulesPageInner />
    </Suspense>
  )
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

// The schedule sentence the backend built ("Every 5 minutes", "Every weekday at
// 9:30 AM (America/Chicago)"). `CronSpec` owns cron — this page formats none of
// it, so what the user reads is what Pipedream is actually running.
// See services/automations/schedule.py :: describeSchedule.
function scheduleDescription(json: Record<string, unknown>): string {
  const description = json?.description
  return typeof description === 'string' && description ? description : 'On a schedule'
}

function timeOfDay(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function daysApart(date: Date, now: Date): number {
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((dayOf(date) - dayOf(now)) / 86_400_000)
}

function formatNextRun(iso: string): string {
  const date = new Date(iso)
  const now  = new Date()
  const days = daysApart(date, now)
  if (days === 0) return `Today · ${timeOfDay(date)}`
  if (days === 1) return `Tomorrow · ${timeOfDay(date)}`
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeOfDay(date)}`
}

// A run already happened, so "Tomorrow" can never be the answer — reusing the
// next-run formatter left yesterday's failures reading as a bare date.
function formatRunTime(iso: string): string {
  const date = new Date(iso)
  const now  = new Date()
  const days = daysApart(date, now)
  if (days === 0)  return `Today · ${timeOfDay(date)}`
  if (days === -1) return `Yesterday · ${timeOfDay(date)}`
  const sameYear = date.getFullYear() === now.getFullYear()
  return `${date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })} · ${timeOfDay(date)}`
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function taskToListItem(task: Automation, chatId?: string): ScheduleListItem {
  return {
    id:          task.id,
    name:        task.name,
    description: task.summary || undefined,
    frequency:   scheduleDescription(task.schedule_json),
    isActive:    task.is_active,
    chatId,
  }
}

/** Map one backend run into a run-history record for the detail view. A run is
 *  one turn rather than a graph — there are no steps to list, so the card is a
 *  status, a time, and what the run has to say when expanded. */
function runToRecord(run: AutomationRun): ScheduleRunRecord {
  const whenIso  = run.finished_at ?? run.started_at ?? null
  const isFailed = run.status === 'failed'
  const isDone   = run.status === 'succeeded'
  const summary  = runSummary(run)
  const raw      = (run.error ?? '').trim()
  return {
    id:          run.id,
    label:       whenIso ? formatRunTime(whenIso) : 'Run',
    title:       isFailed ? 'Failed' : isDone ? 'Completed' : 'Running',
    status:      isFailed ? 'failed' : isDone ? 'complete' : 'executing',
    summary,
    // Only worth offering when there's more to it than the line above.
    detail:      raw && raw !== summary ? raw : undefined,
    steps:       [],
    completedAt: run.finished_at ? new Date(run.finished_at) : undefined,
  }
}

function taskDetailToDetail(task: AutomationDetail, chatId?: string): ScheduleDetailItem {
  return {
    id:           task.id,
    name:         task.name,
    instructions: task.summary ?? '',
    frequency:    scheduleDescription(task.schedule_json),
    nextRun:      task.next_run_at ? formatNextRun(task.next_run_at) : undefined,
    isActive:     task.is_active,
    createdAt:    formatCreatedAt(task.created_at ?? ''),
    runHistory:   (task.runs ?? []).map(runToRecord),
    chatId,
  }
}

function listItemToDetail(item: ScheduleListItem): ScheduleDetailItem {
  return {
    id:           item.id,
    name:         item.name,
    instructions: item.description ?? '',
    frequency:    item.frequency,
    isActive:     item.isActive,
    chatId:       item.chatId,
  }
}

// ── Inner page ────────────────────────────────────────────────────────────────

function BrainSchedulesPageInner() {
  const { push } = useRouter()
  const searchParams = useSearchParams()
  const requestedScheduleId = searchParams.get('selected')
  const idPrefix = useId()

  // ── State ──────────────────────────────────────────────────────────────────

  const [schedules,       setSchedules]       = useState<ScheduleListItem[]>([])
  const [isLoadingList,   setIsLoadingList]   = useState(true)
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [selectedDetail,  setSelectedDetail]  = useState<ScheduleDetailItem | null>(null)
  const [editModalOpen,   setEditModalOpen]   = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEditData | undefined>(undefined)

  // IDs of schedules created locally that haven't been persisted to the backend yet
  const localIdsRef = useRef<Set<string>>(new Set())

  // ── New-thread button from sidebar ─────────────────────────────────────────
  // The sidebar emits BRAIN_NEW_THREAD_EVENT for all /brain/* pages. Only
  // brain/page.tsx listens for it normally; here we navigate to /brain so a
  // new thread actually opens.
  useEffect(() => {
    const handler = () => push(BRAIN_ROUTE)
    window.addEventListener(BRAIN_NEW_THREAD_EVENT, handler)
    return () => window.removeEventListener(BRAIN_NEW_THREAD_EVENT, handler)
  }, [push])

  // ── Load task list on mount ────────────────────────────────────────────────

  useEffect(() => {
    listAutomations()
      .then(tasks => {
        // Be defensive: a non-array payload (error envelope, paginated wrapper)
        // would otherwise throw in .map and surface as a generic load failure.
        const list = Array.isArray(tasks) ? tasks : []
        const links = getAllScheduleLinks()
        const nextSchedules = list.map(t => taskToListItem(t, links[t.id]))
        setSchedules(nextSchedules)
        if (requestedScheduleId && nextSchedules.some((schedule) => schedule.id === requestedScheduleId)) {
          setSelectedId(requestedScheduleId)
          getAutomation(requestedScheduleId)
            .then(detail => setSelectedDetail(taskDetailToDetail(detail, getChatForSchedule(requestedScheduleId))))
            .catch(() => {
              const item = nextSchedules.find(schedule => schedule.id === requestedScheduleId)
              setSelectedDetail(item ? listItemToDetail(item) : null)
            })
        }
      })
      .catch((err: unknown) => {
        // Surface the real reason — the generic message hid backend/auth errors
        // and made this undiagnosable.
        console.error('[schedules] failed to load tasks', err)
        const detail = err instanceof ApiError ? err.message : null
        toast.error('Failed to load schedules', detail ? { description: detail } : undefined)
      })
      .finally(() => setIsLoadingList(false))
  }, [requestedScheduleId])

  // ── Select / open detail ───────────────────────────────────────────────────

  const handleScheduleClick = useCallback((id: string) => {
    setSelectedId(id)
    // Local-only items: use list-item data immediately, no API call
    if (localIdsRef.current.has(id)) {
      const item = schedules.find(s => s.id === id)
      setSelectedDetail(item ? listItemToDetail(item) : null)
      return
    }
    // Fetch full detail (includes run history)
    setSelectedDetail(null)
    getAutomation(id)
      .then(detail => setSelectedDetail(taskDetailToDetail(detail, getChatForSchedule(id))))
      .catch(() => {
        const item = schedules.find(s => s.id === id)
        setSelectedDetail(item ? listItemToDetail(item) : null)
      })
  }, [schedules])

  const handleBack = useCallback(() => {
    setSelectedId(null)
    setSelectedDetail(null)
  }, [])

  // ── Create / edit (local — no create/update endpoints available yet) ───────

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
        push(`${BRAIN_ROUTE}?id=${linkedChatId}&fromSchedule=${encodeURIComponent(selectedId)}`)
      } else {
        push(`${BRAIN_ROUTE}?fromSchedule=${encodeURIComponent(selectedId)}`)
      }
      return
    }

    // Create: build a structured prompt from all form fields so the Brain
    // thread has full context, stash it, then navigate. Brain will start a
    // new chat with this prompt and write the chatId back into the link
    // store, binding the two for the lifetime of the schedule.
    const newId = `${idPrefix}-${Date.now()}`
    localIdsRef.current.add(newId)
    const prompt = [
      `I want to create a schedule called "${data.name}".`,
      ``,
      `Instructions: ${data.instructions}`,
      `Frequency: ${data.frequency}`,
      ...(data.timezone ? [`Timezone: ${data.timezone}`] : []),
    ].join('\n')
    stashPendingPrompt(newId, prompt)
    setSchedules(prev => [...prev, {
      id:          newId,
      name:        data.name,
      description: data.instructions,
      frequency:   data.frequency,
      isActive:    true,
    }])
    setEditModalOpen(false)
    setEditingSchedule(undefined)
    push(`${BRAIN_ROUTE}?fromSchedule=${encodeURIComponent(newId)}`)
  }, [editingSchedule, selectedId, selectedDetail, idPrefix, push])

  // ── Delete (DELETE /automations/{id}; local-only items just drop from state) ──

  const handleDeleteConfirm = useCallback(() => {
    const id = selectedId
    if (!id) return
    setDeleteModalOpen(false)
    const removed = schedules.find(s => s.id === id)
    // Optimistically drop it and return to the list.
    setSchedules(prev => prev.filter(s => s.id !== id))
    setSelectedId(null)
    setSelectedDetail(null)
    // Never persisted to the backend — nothing to delete server-side.
    if (localIdsRef.current.has(id)) {
      localIdsRef.current.delete(id)
      return
    }
    deleteAutomation(id)
      .then(() => toast.success('Schedule deleted'))
      .catch(() => {
        // Restore the row so the user isn't left thinking it's gone.
        if (removed) setSchedules(prev => [...prev, removed])
        toast.error('Failed to delete schedule')
      })
  }, [selectedId, schedules])

  // ── Toggle active (PATCH /automations/{id} — pause/resume; optimistic) ────────

  const handleToggleActive = useCallback((active: boolean) => {
    const id = selectedId
    if (!id) return
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, isActive: active } : s))
    setSelectedDetail(prev => prev ? { ...prev, isActive: active } : prev)
    // Local-only items have no backend row yet — keep the optimistic state.
    if (localIdsRef.current.has(id)) return
    updateAutomation(id, { is_active: active }).catch(() => {
      // Revert on failure (e.g. resuming a schedule with no future run → 409).
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, isActive: !active } : s))
      setSelectedDetail(prev => prev ? { ...prev, isActive: !active } : prev)
      toast.error(active ? 'Failed to resume schedule' : 'Failed to pause schedule')
    })
  }, [selectedId])

  // ── Run now ────────────────────────────────────────────────────────────────

  const handleRunNow = useCallback(() => {
    if (!selectedId || localIdsRef.current.has(selectedId)) {
      toast.info('This schedule has not been saved to the server yet.')
      return
    }
    const id = selectedId
    runAutomationNow(id)
      .then(() => {
        toast.success('Schedule triggered', { description: 'This task will start shortly.' })
        // Refresh detail so run_count and run history reflect the new run.
        return getAutomation(id)
      })
      .then(detail => setSelectedDetail(taskDetailToDetail(detail, getChatForSchedule(id))))
      .catch(() => toast.error('Failed to run schedule'))
  }, [selectedId])

  // ── Derived: what to show in the center ───────────────────────────────────

  const selectedListItem  = selectedId ? (schedules.find(s => s.id === selectedId) ?? null) : null
  // Show API-loaded detail if available; fall back to list-item data instantly so
  // the detail view opens immediately without waiting for the fetch.
  const detailToShow      = selectedDetail ?? (selectedListItem ? listItemToDetail(selectedListItem) : null)

  return (
    <>
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--neutral-50)',
        // Right padding restored to match BrainShell's own center container
        // (src/templates/Brain/index.tsx) and the shared AppLayout — this page
        // builds its own copy of that container since AppLayout's isBrainPage
        // branch renders {children} with no padding of its own.
        padding:         '10px 10px 10px 0',
      }}>
        <div style={{
          position:        'relative',
          flex:            '1 0 0',
          minHeight:       0,
          display:         'flex',
          flexDirection:   'column',
          borderRadius:    '22px',
          border:          '1px solid var(--neutral-200)',
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
              maxWidth:      '810px',
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
                  onToggleActive={handleToggleActive}
                  onOpenChat={(chatId) => push(`${BRAIN_ROUTE}?id=${chatId}`)}
                />
              ) : isLoadingList ? (
                <SchedulesLoadingState />
              ) : (
                <ScheduleListView
                  schedules={schedules}
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
        />
      )}
    </>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function SchedulesLoadingState() {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      padding:       '32px 0',
    }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width:        160,
          height:       24,
          borderRadius: 6,
          backgroundColor: 'var(--neutral-100)',
        }} />
      </div>
      {/* Card skeletons */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap:                 12,
      }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="kaya-skeleton"
            style={{ height: 110, borderRadius: 12 }}
          />
        ))}
      </div>
    </div>
  )
}
