"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useBrainThreadContext } from "@/context/brain-thread-context"
import { openDeleteChatDialog } from "@/components/layout/AppDialogs"
import { listAutomations } from "@/lib/api/automations"
import { getAllScheduleLinks } from "@/lib/scheduleLinks"

export type TasksTab = 'all' | 'scheduled'

/**
 * Tasks-mode (the old /brain/threads page, now inlined into /chats behind
 * the Task/Chat tab strip) state: the thread list, its own tab/search
 * filtering, and the "Scheduled" tag cross-reference against schedule links.
 *
 * `libraryMode` gates the schedule-link lazy-load so it only fires the first
 * time Tasks mode is actually opened, matching how the Chats mode's Shared
 * tab lazy-loads on first visit.
 */
export function useTasksLibrary(libraryMode: 'chats' | 'tasks') {
  const { threads, isLoading: tasksLoading, rename: renameTask, star: starTask, remove: removeTask } = useBrainThreadContext()
  const [tasksSearchQuery, setTasksSearchQuery] = useState('')
  const [tasksTab, setTasksTab] = useState<TasksTab>('all')
  // Chat ids that are linked to a still-existing schedule — drives the
  // "Scheduled" tag on each thread row. Cross-referenced against the live
  // task list since scheduleLinks is a local-only map that isn't cleaned up
  // when a schedule is deleted.
  const [scheduledChatIds, setScheduledChatIds] = useState<Set<string>>(new Set())
  const scheduleLinksLoadedRef = useRef(false)

  // Lazily load schedule-link info the first time Tasks mode is actually
  // opened, matching how the Shared tab lazy-loads on first visit.
  useEffect(() => {
    if (libraryMode !== 'tasks' || scheduleLinksLoadedRef.current) return
    scheduleLinksLoadedRef.current = true
    listAutomations()
      .then(tasks => {
        const links = getAllScheduleLinks()
        const chatIds = tasks.map(t => links[t.id]).filter((id): id is string => !!id)
        setScheduledChatIds(new Set(chatIds))
      })
      .catch(() => {})
  }, [libraryMode])

  const filteredThreads = useMemo(() => {
    const scoped = tasksTab === 'scheduled' ? threads.filter(t => scheduledChatIds.has(t.id)) : threads
    if (!tasksSearchQuery.trim()) return scoped
    const q = tasksSearchQuery.toLowerCase()
    return scoped.filter(t => (t.chat_title || '').toLowerCase().includes(q))
  }, [threads, tasksSearchQuery, tasksTab, scheduledChatIds])

  const handleTaskDelete = useCallback((id: string, title: string) => {
    openDeleteChatDialog({
      chatId:    id,
      chatTitle: title,
      onConfirm: async () => { await removeTask(id) },
    })
  }, [removeTask])

  return {
    threads,
    tasksLoading,
    renameTask,
    starTask,
    tasksSearchQuery,
    setTasksSearchQuery,
    tasksTab,
    setTasksTab,
    scheduledChatIds,
    filteredThreads,
    handleTaskDelete,
  }
}
