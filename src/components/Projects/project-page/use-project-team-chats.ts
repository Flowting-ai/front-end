'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { publishProjectChat } from '@/lib/api/chat'
import { fetchProjectChats, type ApiProjectChat } from '@/lib/api/projects'
import type { Project } from '@/context/projects-context'

/**
 * The chat list of a Workspace or Shared project, from GET /projects/{id}/chats: your own chats plus
 * any chat published to the project, for every project member. (The personal GET /chats listing is
 * scoped to the caller, so other members' published chats never showed there.) Personal projects
 * use useProjects().getChats() instead. Keyed on visibility, not teamId: an org member's Personal
 * project also carries the org id.
 */
export function useProjectTeamChats(project: Project | undefined, projectId: string, userId: string | undefined) {
  const [teamChats, setTeamChats] = useState<ApiProjectChat[]>([])
  const [loading, setLoading] = useState(true)

  // Reset during render when the identity changes (the project loads, or the user changes), so the
  // effect below only sets state from a real async completion.
  const key = `${project?.visibility ?? ''}|${projectId}|${userId ?? ''}`
  const [syncedKey, setSyncedKey] = useState(key)
  if (key !== syncedKey) {
    setSyncedKey(key)
    if (!project || project.visibility === 'personal' || !userId) {
      setTeamChats([])
      setLoading(false)
    } else {
      setLoading(true)
    }
  }

  const visibility = project?.visibility
  useEffect(() => {
    if (!visibility || visibility === 'personal' || !userId) return
    let cancelled = false
    fetchProjectChats(projectId, userId)
      .then(list => { if (!cancelled) setTeamChats(list) })
      .catch(() => { if (!cancelled) setTeamChats([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [visibility, projectId, userId])

  /**
   * Publishes one chat so every project member sees it. Optimistic, reverted on failure. There is no
   * backend route to unpublish yet, so `next` is always true from the rows; false is a guard.
   */
  async function publish(chatId: string, next: boolean, publishedTabLabel: string): Promise<boolean> {
    if (!next) {
      toast.error("Unpublishing isn't supported yet")
      return false
    }
    setTeamChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: 'team' } : c))
    try {
      await publishProjectChat(chatId)
      toast.success(`Chat published — visible in ${publishedTabLabel}`)
      return true
    } catch (err) {
      setTeamChats(prev => prev.map(c => c.id === chatId ? { ...c, visibility: 'private' } : c))
      toast.error(err instanceof Error ? err.message : 'Failed to publish chat')
      return false
    }
  }

  const rename = (chatId: string, title: string) =>
    setTeamChats(prev => prev.map(c => c.id === chatId ? { ...c, chatTitle: title } : c))
  const remove = (chatId: string) => setTeamChats(prev => prev.filter(c => c.id !== chatId))

  return { teamChats, loading, publish, rename, remove }
}
