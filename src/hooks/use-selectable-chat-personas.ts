'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { fetchSelectableChatPersonas, type SelectedPersonaInfo } from '@/lib/chat-personas'
import { resolveViewerUserId } from '@/lib/api/teams'
import { queryKeys } from '@/lib/query-keys'

const EMPTY: SelectedPersonaInfo[] = []

/** Agents the viewer can pick in chat; fetched only while the picker is open.
 *  Under the ["personas"] prefix, so bustPersonasCache() refreshes it. */
export function useSelectableChatPersonas(open: boolean) {
  const { currentUserRole, orgId, members } = useOrg()
  const { user } = useAuth()
  const viewerUserId = resolveViewerUserId(members, user?.email)
  const isAdmin = currentUserRole === 'admin'

  const query = useQuery({
    queryKey: queryKeys.personas.selectable(orgId, viewerUserId, currentUserRole),
    queryFn: () => fetchSelectableChatPersonas(orgId, viewerUserId, isAdmin),
    enabled: open,
    staleTime: 30_000,
    retry: false,
  })

  return {
    personas: query.isError ? EMPTY : query.data ?? EMPTY,
    loading: query.fetchStatus === 'fetching' && query.data === undefined,
  }
}
