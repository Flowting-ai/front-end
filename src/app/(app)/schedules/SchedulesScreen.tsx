'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ScheduleListView,
  ScheduleDetailView,
  ScheduleEditModal,
  ScheduleDeleteModal,
  type ScheduleEditData,
} from '@/components/Schedules'
import { canSchedule } from '@/lib/schedules/schedule-permissions'
import { ScheduleLoadFailed, ScheduleNotFound } from './ScheduleRouteStates'
import { CHAT_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'
import { SchedulesLoadingState, ScheduleDetailLoadingState } from './ScheduleSkeletons'
import { useSchedules } from './use-schedules'

// ── Page wrapper ──────────────────────────────────────────────────────────────

export function SchedulesScreen({ scheduleId }: { scheduleId?: string }) {
  return (
    <Suspense fallback={null}>
      <SchedulesPageInner scheduleId={scheduleId} />
    </Suspense>
  )
}

// ── Inner page ────────────────────────────────────────────────────────────────
// Data and actions: use-schedules.ts. This file is layout and modal state only.

// `scheduleId` comes from the /schedules/[id] route; the legacy ?selected= link
// (notifications, Slack) is redirected to that route below.
function SchedulesPageInner({ scheduleId }: { scheduleId?: string }) {
  const { push, replace } = useRouter()
  const legacySelectedId = useSearchParams().get('selected')
  const s = useSchedules(scheduleId)

  const [editModalOpen,   setEditModalOpen]   = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEditData | undefined>(undefined)

  useEffect(() => {
    if (!scheduleId && legacySelectedId) replace(`${SCHEDULES_ROUTE}/${encodeURIComponent(legacySelectedId)}`)
  }, [scheduleId, legacySelectedId, replace])

  const detail = s.detailToShow

  const openEdit = useCallback(() => {
    if (!detail || !canSchedule('edit', detail)) return
    setEditingSchedule({ name: detail.name, instructions: detail.instructions, frequency: detail.frequency })
    setEditModalOpen(true)
  }, [detail])

  const closeEdit = () => { setEditModalOpen(false); setEditingSchedule(undefined) }

  const save = (data: ScheduleEditData) => {
    closeEdit()
    s.sendToTask(data, !!editingSchedule && !!scheduleId)
  }

  return (
    <>
      {/* AppLayout renders this page bare, so it builds its own copy of the shared center container. */}
      <div className="relative flex min-w-0 flex-1 flex-col bg-[var(--neutral-50)] py-2.5 pr-2.5">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--color-surface-glass)]">
          <div className="kaya-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="mx-auto box-border w-full max-w-[991px] px-7 pb-10">
              {detail ? (
                <ScheduleDetailView
                  key={detail.id}
                  schedule={detail}
                  onBack={() => { if (scheduleId) push(SCHEDULES_ROUTE) }}
                  onEdit={openEdit}
                  onDelete={() => setDeleteModalOpen(true)}
                  onRunNow={() => { if (scheduleId) s.runNow(scheduleId) }}
                  runningNow={s.isRunningNow}
                  onToggleActive={s.toggleActive}
                  onOpenChat={(chatId) => push(`${CHAT_ROUTE}?id=${chatId}`)}
                  onCopy={s.copy}
                  copying={s.isCopying}
                />
              ) : scheduleId && s.detailError === 'not_found' ? (
                <ScheduleNotFound />
              ) : scheduleId && s.detailError === 'failed' ? (
                <ScheduleLoadFailed onRetry={s.retryDetail} />
              ) : s.isLoading ? (
                scheduleId ? <ScheduleDetailLoadingState /> : <SchedulesLoadingState />
              ) : (
                <ScheduleListView
                  schedules={s.visibleSchedules}
                  scope={s.scope}
                  onScopeChange={s.changeScope}
                  onScheduleClick={(id) => push(`${SCHEDULES_ROUTE}/${encodeURIComponent(id)}`)}
                  onCreateNew={() => { setEditingSchedule(undefined); setEditModalOpen(true) }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <ScheduleEditModal isOpen={editModalOpen} schedule={editingSchedule} onSave={save} onClose={closeEdit} />

      {detail && (
        <ScheduleDeleteModal
          isOpen={deleteModalOpen}
          scheduleName={detail.name}
          onConfirm={() => { if (scheduleId) s.deleteSchedule(scheduleId, { onSettled: () => setDeleteModalOpen(false) }) }}
          onClose={() => setDeleteModalOpen(false)}
          deleting={s.isDeleting}
        />
      )}
    </>
  )
}
