'use client'

import { Suspense, useState, useEffect, useId, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { Sidebar } from '@/components/Sidebar'
import { AccountMenu } from '@/components/AccountMenu'
import {
  ScheduleListView,
  ScheduleDetailView,
  ScheduleEditModal,
  ScheduleDeleteModal,
  type ScheduleListItem,
  type ScheduleDetailItem,
  type ScheduleEditData,
} from '@/templates/Brain'
import { BrainSidebarSections } from '../BrainSidebarSections'
import {
  listTasks,
  getTask,
  runTaskNow,
  updateTask,
  deleteTask,
  type Task,
  type TaskDetail,
  type ScheduledTaskRunResponse,
} from '@/lib/api/tasks'
import type { ScheduleRunRecord } from '@/templates/Brain'
import { getAllScheduleLinks, getChatForSchedule, stashPendingPrompt } from '@/lib/scheduleLinks'
import { useSearch } from '@/context/search-context'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export default function BrainSchedulesPage() {
  return (
    <Suspense fallback={null}>
      <BrainSchedulesPageInner />
    </Suspense>
  )
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

function formatScheduleJson(json: Record<string, unknown>): string {
  const type      = typeof json.type === 'string' ? json.type.toLowerCase() : 'daily'
  const rawHour   = json.hour ?? json.hour_utc ?? json.at_hour
  const rawMinute = json.minute ?? json.minute_utc ?? json.at_minute
  const hour      = typeof rawHour   === 'number' ? rawHour   : typeof rawHour   === 'string' ? parseInt(rawHour,   10) : null
  const minute    = typeof rawMinute === 'number' ? rawMinute : typeof rawMinute === 'string' ? parseInt(rawMinute, 10) : null

  if (hour === null) {
    const cron = json.cron
    if (typeof cron === 'string') return `Cron: ${cron}`
    return 'Scheduled'
  }

  const pad  = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(hour)}:${pad(minute ?? 0)}`

  if (type === 'weekly' || json.day_of_week || json.day) {
    const day = (json.day ?? json.day_of_week ?? 'Monday') as string
    return `Weekly · ${day} · ${time}`
  }
  return `Daily · ${time}`
}

function formatNextRun(iso: string): string {
  const date         = new Date(iso)
  const now          = new Date()
  const todayStart   = new Date(now.getFullYear(),  now.getMonth(),  now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)
  const dateStart    = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const timeStr      = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (dateStart.getTime() === todayStart.getTime())    return `Today · ${timeStr}`
  if (dateStart.getTime() === tomorrowStart.getTime()) return `Tomorrow · ${timeStr}`
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeStr}`
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function taskToListItem(task: Task, chatId?: string): ScheduleListItem {
  return {
    id:          task.id,
    name:        task.title,
    description: task.plan_text || undefined,
    frequency:   formatScheduleJson(task.schedule_json),
    isActive:    task.is_active,
    chatId,
  }
}

/** Map one backend run into a run-history record for the detail view. The
 *  scheduled runner records no per-node steps, so each run becomes a single
 *  status row; the synthesized result (or failure reason) shows when expanded. */
function runToRecord(run: ScheduledTaskRunResponse): ScheduleRunRecord {
  const whenIso  = run.completed_at ?? run.started_at ?? run.created_at ?? null
  const isFailed = run.status === 'failed'
  const isDone   = run.status === 'completed'
  const stepStatus = isDone ? 'complete' : isFailed ? 'failed' : 'executing'
  const stepLabel  = isFailed ? (run.error || 'Run failed')
    : isDone ? 'Run completed'
    : 'Running…'
  return {
    id:          run.id,
    label:       whenIso ? formatNextRun(whenIso) : 'Run',
    title:       isFailed ? 'Failed' : isDone ? 'Completed' : 'Running',
    summary:     run.synthesis || (isFailed ? run.error ?? undefined : undefined),
    steps:       [{ id: run.id, label: stepLabel, isCritical: false, status: stepStatus }],
    completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
  }
}

function taskDetailToDetail(task: TaskDetail, chatId?: string): ScheduleDetailItem {
  return {
    id:           task.id,
    name:         task.title,
    instructions: task.plan_text ?? '',
    frequency:    formatScheduleJson(task.schedule_json),
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
  const { push }                          = useRouter()
  const { user, logout, isAuthenticated } = useAuth()
  const idPrefix                          = useId()

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

  const planLabel = user?.planType
    ? user.planType.charAt(0).toUpperCase() + user.planType.slice(1)
    : undefined

  const sidebarCollapsedRef = useRef(
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false
  )
  const handleSidebarCollapse = useCallback(() => {
    sidebarCollapsedRef.current = !sidebarCollapsedRef.current
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(sidebarCollapsedRef.current))
    }
  }, [])

  // ── State ──────────────────────────────────────────────────────────────────

  const [schedules,       setSchedules]       = useState<ScheduleListItem[]>([])
  const [isLoadingList,   setIsLoadingList]   = useState(true)
  const [selectedId,      setSelectedId]      = useState<string | null>(null)
  const [selectedDetail,  setSelectedDetail]  = useState<ScheduleDetailItem | null>(null)
  const [editModalOpen,   setEditModalOpen]   = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEditData | undefined>(undefined)

  const { searchOpen, openSearch } = useSearch()

  // IDs of schedules created locally that haven't been persisted to the backend yet
  const localIdsRef = useRef<Set<string>>(new Set())

  // ── Load task list on mount ────────────────────────────────────────────────

  useEffect(() => {
    listTasks()
      .then(tasks => {
        const links = getAllScheduleLinks()
        setSchedules(tasks.map(t => taskToListItem(t, links[t.id])))
      })
      .catch(() => toast.error('Failed to load schedules'))
      .finally(() => setIsLoadingList(false))
  }, [])

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
    getTask(id)
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
      ].join('\n')
      stashPendingPrompt(selectedId, prompt)
      setEditModalOpen(false)
      setEditingSchedule(undefined)
      if (linkedChatId) {
        push(`/brain?id=${linkedChatId}&fromSchedule=${encodeURIComponent(selectedId)}`)
      } else {
        push(`/brain?fromSchedule=${encodeURIComponent(selectedId)}`)
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
    push(`/brain?fromSchedule=${encodeURIComponent(newId)}`)
  }, [editingSchedule, selectedId, selectedDetail, idPrefix, push])

  // ── Delete (DELETE /tasks/{id}; local-only items just drop from state) ────

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
    deleteTask(id)
      .then(() => toast.success('Schedule deleted'))
      .catch(() => {
        // Restore the row so the user isn't left thinking it's gone.
        if (removed) setSchedules(prev => [...prev, removed])
        toast.error('Failed to delete schedule')
      })
  }, [selectedId, schedules])

  // ── Toggle active (PATCH /tasks/{id} — pause/resume; optimistic) ──────────

  const handleToggleActive = useCallback((active: boolean) => {
    const id = selectedId
    if (!id) return
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, isActive: active } : s))
    setSelectedDetail(prev => prev ? { ...prev, isActive: active } : prev)
    // Local-only items have no backend row yet — keep the optimistic state.
    if (localIdsRef.current.has(id)) return
    updateTask(id, { is_active: active }).catch(() => {
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
    runTaskNow(id)
      .then(() => {
        toast.success('Schedule triggered', { description: 'Brain will start this task shortly.' })
        // Refresh detail so run_count and run history reflect the new run.
        return getTask(id)
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
    <div style={{
      display:         'flex',
      alignItems:      'stretch',
      width:           '100%',
      height:          '100svh',
      backgroundColor: 'var(--neutral-white)',
    }}>

      {/* ── Left sidebar ── */}
      <Sidebar
        defaultBodySection="brain"
        defaultCollapsed={sidebarCollapsedRef.current}
        onCollapse={handleSidebarCollapse}
        recentItems={
          <BrainSidebarSections
            activeChatId={null}
            onThreadClick={(id) => push(`/brain?id=${id}`)}
          />
        }
        hideProjects
        newChatLabel="New brain thread"
        onNewChat={() => push('/brain')}
        onBrainClick={() => push('/brain')}
        onSearch={() => openSearch()}
        searchActive={searchOpen}
        onChatTabClick={() => push('/chat')}
        onChatsClick={() => { toast.info("Opening Chat Board", { id: 'nav' }); push('/chats') }}
        onAllBrainThreadsClick={() => push('/brain/threads')}
        onSchedulesClick={() => push('/brain/schedules')}
        onPersonasClick={() => { toast.info("Opening Agents", { id: 'nav' }); push('/agents') }}
        onProjectsClick={() => { toast.info("Opening Projects", { id: 'nav' }); push('/projects') }}
        accountMenu={(collapsed) => (
          <AccountMenu
            name={displayName || 'Account'}
            plan={planLabel}
            credits={user?.creditsRemaining ?? undefined}
            avatarSrc={user?.profilePicture ?? undefined}
            collapsed={collapsed}
            panelWidth={274}
            placement="top-start"
            onProfile={() => push('/settings/account')}
            onUpgradePlan={() => push('/settings/billing')}
            onSettings={() => push('/settings')}
            onHelp={() => push('/settings/help')}
            onLogOut={() => { if (isAuthenticated) { void logout() } else { push('/auth/login') } }}
          />
        )}
      />

      {/* ── Main content area ── */}
      <div style={{
        position:        'relative',
        flex:            '1 0 0',
        minWidth:        0,
        display:         'flex',
        flexDirection:   'column',
        backgroundColor: 'var(--neutral-50)',
        padding:         '10px 0',
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
                  onOpenChat={(chatId) => push(`/brain?id=${chatId}`)}
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
    </div>
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
