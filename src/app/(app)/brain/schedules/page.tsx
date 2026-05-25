'use client'

import { Suspense, useState, useEffect, useId, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { Sidebar } from '@/components/Sidebar'
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
import { listTasks, getTask, runTaskNow, type Task, type TaskDetail } from '@/lib/api/tasks'
import { getAllScheduleLinks, getChatForSchedule, stashPendingPrompt } from '@/lib/scheduleLinks'

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

function taskDetailToDetail(task: TaskDetail, chatId?: string): ScheduleDetailItem {
  return {
    id:           task.id,
    name:         task.title,
    instructions: task.plan_text ?? '',
    frequency:    formatScheduleJson(task.schedule_json),
    nextRun:      task.next_run_at ? formatNextRun(task.next_run_at) : undefined,
    isActive:     task.is_active,
    createdAt:    formatCreatedAt(task.created_at ?? ''),
    runHistory:   [],
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

  const sidebarCollapsedRef = useRef(
    typeof window !== 'undefined' ? localStorage.getItem('sidebar_collapsed') === 'true' : false
  )
  const handleSidebarCollapse = useCallback(() => {
    sidebarCollapsedRef.current = !sidebarCollapsedRef.current
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(sidebarCollapsedRef.current))
    }
  }, [])

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || ''
    : ''

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
      setSchedules(prev => prev.map(s =>
        s.id === selectedId
          ? { ...s, name: data.name, description: data.instructions, frequency: data.frequency }
          : s
      ))
      setSelectedDetail(prev =>
        prev ? { ...prev, name: data.name, instructions: data.instructions, frequency: data.frequency } : prev
      )
      setEditModalOpen(false)
      setEditingSchedule(undefined)
      return
    }

    // Create: stash the prompt so the Brain page can pick it up, then route
    // there. Brain will start a new chat with this prompt and write the
    // chatId back into the link store, binding the two for the lifetime of
    // the schedule.
    const newId = `${idPrefix}-${Date.now()}`
    localIdsRef.current.add(newId)
    stashPendingPrompt(newId, data.instructions)
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
  }, [editingSchedule, selectedId, idPrefix, push])

  // ── Delete (local — no delete endpoint available yet) ─────────────────────

  const handleDeleteConfirm = useCallback(() => {
    setSchedules(prev => prev.filter(s => s.id !== selectedId))
    localIdsRef.current.delete(selectedId ?? '')
    setSelectedId(null)
    setSelectedDetail(null)
    setDeleteModalOpen(false)
  }, [selectedId])

  // ── Toggle active (local optimistic — no patch endpoint available yet) ────

  const handleToggleActive = useCallback((active: boolean) => {
    setSchedules(prev => prev.map(s => s.id === selectedId ? { ...s, isActive: active } : s))
    setSelectedDetail(prev => prev ? { ...prev, isActive: active } : prev)
  }, [selectedId])

  // ── Run now ────────────────────────────────────────────────────────────────

  const handleRunNow = useCallback(() => {
    if (!selectedId || localIdsRef.current.has(selectedId)) {
      toast.info('This schedule has not been saved to the server yet.')
      return
    }
    runTaskNow(selectedId)
      .then(() => toast.success('Schedule triggered', { description: 'Brain will start this task shortly.' }))
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
        userName={displayName || 'Account'}
        userEmail={user?.email ?? ''}
        isAuthenticated={isAuthenticated}
        defaultBodySection="workflow"
        defaultCollapsed={sidebarCollapsedRef.current}
        onCollapse={handleSidebarCollapse}
        recentItems={
          <BrainSidebarSections
            activeChatId={null}
            isSchedulesPage={true}
            onThreadClick={(id) => push(`/brain?id=${id}`)}
          />
        }
        onNewChat={() => push('/brain')}
        onBrainClick={() => push('/brain')}
        onChatsClick={() => { toast.info("Opening Chat Board"); push('/chats') }}
        onPersonasClick={() => { toast.info("Opening Personas"); push('/personas') }}
        onProjectsClick={() => { toast.info("Opening Projects"); push('/projects') }}
        onSettingsClick={() => push('/settings')}
        onHelpClick={() => push('/settings/help')}
        onLogoutClick={() => { void logout() }}
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
