'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { fetchSelectableChatPersonas, type SelectedPersonaInfo } from '@/lib/chat-personas'
import { resolveViewerUserId } from '@/lib/api/teams'

export function useSelectableChatPersonas(open: boolean) {
  const { currentUserRole, orgId, members, teams } = useOrg()
  const { user } = useAuth()
  const viewerUserId = resolveViewerUserId(members, user?.email)
  // Sorted + joined so the effect below doesn't re-run on a new array identity
  // for the same set of teams.
  const orgTeamIdsKey = [...teams.map(t => t.id)].sort().join(',')
  const [personas, setPersonas] = useState<SelectedPersonaInfo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const list = await fetchSelectableChatPersonas(
          orgId,
          orgTeamIdsKey ? orgTeamIdsKey.split(',') : [],
          viewerUserId,
          currentUserRole === 'admin',
        )
        if (!cancelled) setPersonas(list)
      } catch {
        if (!cancelled) setPersonas([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [open, currentUserRole, orgId, orgTeamIdsKey, viewerUserId])

  return { personas, loading }
}
