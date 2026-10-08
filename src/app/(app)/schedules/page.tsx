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
  type ScheduleScope,
} from '@/templates/Schedules'
import {
  listAutomations,
  listOrganizationAutomations,
  copyAutomation,
  getAutomation,
  runAutomationNow,
  updateAutomation,
  deleteAutomation,
  runSummary,
  type Automation,
  type AutomationDetail,
  type AutomationRun,
  type OrganizationAutomation,
} from '@/lib/api/automations'
import type { ScheduleRunRecord } from '@/templates/Schedules'
import { getAllScheduleLinks, getChatForSchedule, linkScheduleToChat, stashPendingPrompt } from '@/lib/scheduleLinks'
import { ApiError } from '@/lib/api/client'
import { CHAT_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  return (
    <Suspense fallback={null}>
      <SchedulesPageInner />
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

// True when the deployed Pipedream timer disagrees with what's stored — see
// services/automations/schedule.py :: driftBetween. Surfaced as a warning
// banner in the detail view rather than left invisible.
function scheduleDrift(json: Record<string, unknown>): boolean {
  return json?.drift === true
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
    createdAt:   task.created_at ? formatCreatedAt(task.created_at) : undefined,
    chatId,
    runCount:    task.run_count,
    successRate: task.success_rate,
    isRunning:   task.is_running,
    drift:       scheduleDrift(task.schedule_json),
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
  // Backend just told us the real link — mirror it into the local store so
  // the list view (whose GET /automations rows don't carry chat_id) can
  // still resolve "open chat" without a full detail fetch per card.
  if (task.chat_id) linkScheduleToChat(task.id, task.chat_id)
  return {
    id:           task.id,
    name:         task.name,
    instructions: task.summary ?? '',
    frequency:    scheduleDescription(task.schedule_json),
    nextRun:      task.next_run_at ? formatNextRun(task.next_run_at) : undefined,
    lastRun:      task.last_run_at ? formatRunTime(task.last_run_at) : undefined,
    isActive:     task.is_active,
    createdAt:    formatCreatedAt(task.created_at ?? ''),
    runHistory:   (task.runs ?? []).map(runToRecord),
    // Backend's own chat_id is authoritative — only fall back to the local
    // link-store mapping (localStorage) for schedules the backend doesn't
    // know a chat for yet (e.g. a just-created local placeholder row).
    chatId:       task.chat_id ?? chatId,
    runCount:     task.run_count,
    successRate:  task.success_rate,
    isRunning:    task.is_running,
    drift:        scheduleDrift(task.schedule_json),
  }
}

// Someone else's automation: the org row is all a non-owner can read, so its
// detail view is built from this row alone.
function organizationToListItem(task: OrganizationAutomation): ScheduleListItem {
  return {
    ...taskToListItem(task),
    ownerName:  task.owner_name,
    connectors: task.connectors.map(connector => ({
      slug:    connector.slug,
      name:    connector.display_name,
      logoUrl: connector.logo_url,
    })),
  }
}

function listItemToDetail(item: ScheduleListItem): ScheduleDetailItem {
  return {
    id:           item.id,
    name:         item.name,
    instructions: item.description ?? '',
    frequency:    item.frequency,
    isActive:     item.isActive,
    createdAt:    item.createdAt,
    chatId:       item.chatId,
    runCount:     item.runCount,
    successRate:  item.successRate,
    isRunning:    item.isRunning,
    ownerName:    item.ownerName,
    connectors:   item.connectors,
  }
}

// ── Inner page ────────────────────────────────────────────────────────────────

function SchedulesPageInner() {
  const { push, replace } = useRouter()
  const searchParams = useSearchParams()
  const requestedScheduleId = searchParams.get('selected')
  const idPrefix = useId()

  // ── State ──────────────────────────────────────────────────────────────────

  const [schedules,       setSchedules]       = useState<ScheduleListItem[]>([])
  const [scope,           setScope]           = useState<ScheduleScope>('mine')
  const [orgSchedules,    setOrgSchedules]    = useState<ScheduleListItem[] | null>(null)
  const [isCopying,       setIsCopying]       = useState(false)
  const [isLoadingList,   setIsLoadingList]   = useState(true)
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [selectedDetail,  setSelectedDetail]  = useState<ScheduleDetailItem | null>(null)
  const [editModalOpen,   setEditModalOpen]   = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEditData | undefined>(undefined)

  // IDs of schedules created locally that haven't been persisted to the backend yet
  const localIdsRef = useRef<Set<string>>(new Set())

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

  // ── Organization scope (loaded on first visit) ─────────────────────────────

  const handleScopeChange = useCallback((next: ScheduleScope) => {
    setScope(next)
    if (next !== 'organization' || orgSchedules) return
    listOrganizationAutomations()
      .then(tasks => setOrgSchedules(tasks.map(organizationToListItem)))
      .catch((err: unknown) => {
        console.error('[schedules] failed to load organization schedules', err)
        toast.error('Failed to load organization schedules')
        setScope('mine')
      })
  }, [orgSchedules])

  const visibleSchedules = scope === 'organization' ? (orgSchedules ?? []) : schedules

  // ── Select / open detail ───────────────────────────────────────────────────

  const handleScheduleClick = useCallback((id: string) => {
    setSelectedId(id)
    // Someone else's: the org row is everything a non-owner may read.
    const orgItem = scope === 'organization' ? orgSchedules?.find(s => s.id === id) : undefined
    if (orgItem) {
      setSelectedDetail(listItemToDetail(orgItem))
      return
    }
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
  }, [schedules, scope, orgSchedules])

  const handleBack = useCallback(() => {
    setSelectedId(null)
    setSelectedDetail(null)
    // Drop a deep-linked ?selected= (notification bell, Slack link) so the
    // URL matches the list view — otherwise opening the same link again is a
    // same-URL navigation and wouldn't reopen the schedule.
    if (requestedScheduleId) replace(SCHEDULES_ROUTE, { scroll: false })
  }, [requestedScheduleId, replace])

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
        push(`${CHAT_ROUTE}?id=${linkedChatId}&fromSchedule=${encodeURIComponent(selectedId)}`)
      } else {
        push(`${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(selectedId)}`)
      }
      return
    }

    // Create: build a structured prompt from all form fields so the chat has
    // full context, stash it, then navigate. The chat page prefills it and
    // writes the chatId back into the link store on first send, binding the
    // two for the lifetime of the schedule.
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
    push(`${CHAT_ROUTE}?fromSchedule=${encodeURIComponent(newId)}`)
  }, [editingSchedule, selectedId, selectedDetail, idPrefix, push])

  // ── Delete (DELETE /automations/{id}; local-only items just drop from state) ──

  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false)

  const handleDeleteConfirm = useCallback(() => {
    const id = selectedId
    if (!id) return
    // Never persisted to the backend — nothing to delete server-side, so the
    // instant local removal below isn't misleading (there's no request to
    // wait for). A real delete keeps the modal (and detail view) open with a
    // spinner until deleteAutomation resolves, instead of clearing
    // selectedId/selectedDetail up front — doing that first would unmount
    // this very modal (gated on `detailToShow`) mid-request.
    if (localIdsRef.current.has(id)) {
      localIdsRef.current.delete(id)
      setSchedules(prev => prev.filter(s => s.id !== id))
      setSelectedId(null)
      setSelectedDetail(null)
      setDeleteModalOpen(false)
      return
    }
    setIsDeletingSchedule(true)
    deleteAutomation(id)
      .then(() => {
        toast.success('Schedule deleted')
        setSchedules(prev => prev.filter(s => s.id !== id))
        setSelectedId(null)
        setSelectedDetail(null)
      })
      .catch(() => {
        toast.error('Failed to delete schedule')
      })
      .finally(() => {
        setIsDeletingSchedule(false)
        setDeleteModalOpen(false)
      })
  }, [selectedId])

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

  const [isRunningNow, setIsRunningNow] = useState(false)

  const handleRunNow = useCallback(() => {
    if (!selectedId || localIdsRef.current.has(selectedId)) {
      toast.info('This schedule has not been saved to the server yet.')
      return
    }
    const id = selectedId
    setIsRunningNow(true)
    runAutomationNow(id)
      .then(() => {
        toast.success('Schedule triggered', { description: 'This task will start shortly.' })
        // Refresh detail so run_count and run history reflect the new run.
        return getAutomation(id)
      })
      .then(detail => setSelectedDetail(taskDetailToDetail(detail, getChatForSchedule(id))))
      .catch(() => toast.error('Failed to run schedule'))
      .finally(() => setIsRunningNow(false))
  }, [selectedId])

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
      .catch(() => {
        toast.error('Failed to copy schedule')
        setIsCopying(false)
      })
  }, [selectedId, push])

  // ── Derived: what to show in the center ───────────────────────────────────

  const selectedListItem  = selectedId ? (visibleSchedules.find(s => s.id === selectedId) ?? null) : null
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
                  runningNow={isRunningNow}
                  onToggleActive={handleToggleActive}
                  onOpenChat={(chatId) => push(`${CHAT_ROUTE}?id=${chatId}`)}
                  onCopy={handleCopy}
                  copying={isCopying}
                />
              ) : isLoadingList || (scope === 'organization' && !orgSchedules) ? (
                <SchedulesLoadingState />
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
          deleting={isDeletingSchedule}
        />
      )}
    </>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

// Mirrors ScheduleCard's own box model exactly (220px, padding 20, top row /
// title / description / divider / footer) so the loading state doesn't jump
// when the real cards swap in.
function ScheduleCardSkeleton({ delay }: { delay: number }) {
  const fade = { opacity: 1 - delay * 0.15 }
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      height:         220,
      padding:        20,
      boxSizing:      'border-box',
      borderRadius:   12,
      boxShadow:      '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)',
    }}>
      {/* Top row — "Created on" (left), status badge (right) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="kaya-skeleton" style={{ ...fade, width: 96, height: 12 }} />
        <div className="kaya-skeleton" style={{ ...fade, width: 52, height: 20, borderRadius: 999 }} />
      </div>

      {/* Title */}
      <div className="kaya-skeleton" style={{ ...fade, width: '65%', height: 18, marginTop: 12 }} />

      {/* Description — 2 lines */}
      <div className="kaya-skeleton" style={{ ...fade, width: '100%', height: 12, marginTop: 14 }} />
      <div className="kaya-skeleton" style={{ ...fade, width: '80%', height: 12, marginTop: 6 }} />

      {/* Spacer — pushes divider/footer to the bottom, matching ScheduleCard */}
      <div style={{ flex: '1 1 auto', minHeight: 12 }} />

      <div style={{ height: 1, width: '100%', backgroundColor: 'var(--divider-color)' }} />

      {/* Footer — calendar icon + frequency text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <div className="kaya-skeleton" style={{ ...fade, width: 14, height: 14, borderRadius: 4 }} />
        <div className="kaya-skeleton" style={{ ...fade, width: 84, height: 12 }} />
      </div>
    </div>
  )
}

function SchedulesLoadingState() {
  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      padding:       '32px 0',
      width:         '100%',
    }}>
      {/* Header skeleton — matches ScheduleListView's title + subtitle +
          "New schedule" button layout */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: '1 0 0' }}>
          <div className="kaya-skeleton" style={{ width: 120, height: 24 }} />
          <div className="kaya-skeleton" style={{ width: 220, height: 14, marginTop: 6 }} />
        </div>
        <div className="kaya-skeleton" style={{ width: 128, height: 32, borderRadius: 8 }} />
      </div>
      {/* Card skeletons — same 2-column grid, gap 24, as ScheduleListView */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 24,
      }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <ScheduleCardSkeleton key={i} delay={i} />
        ))}
      </div>
    </div>
  )
}
