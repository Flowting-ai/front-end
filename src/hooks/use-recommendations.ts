'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import { useIsClient } from '@/hooks/use-is-client'
import { fetchRecommendations, type Recommendations } from '@/lib/api/recommendations'
import { getQueryClient } from '@/lib/query-client'
import { queryKeys } from '@/lib/query-keys'

/**
 * Starter cards for the empty chat screen, generated per user and refreshed by the
 * backend roughly every 12 hours.
 *
 * Stale-while-revalidate on React Query, so coming back to a new chat never waits on the network:
 *   • the query cache (survives client-side navigation between pages),
 *   • a sessionStorage copy (survives a reload; scoped to the signed-in user) that seeds the
 *     query as initialData with its original timestamp,
 *   • a background refresh once the copy is older than STALE_MS (the query's staleTime).
 * `warmRecommendations` warms all of this from the app shell, so the very first visit to a
 * new chat is usually instant as well. Until the first response lands there is nothing to show,
 * so callers render a skeleton (`loading`) — never a placeholder set, because the backend is the
 * only place card copy lives. A failed request leaves the section hidden.
 */

const STORAGE_KEY = 'souvenir:recommendations:v1'
const STALE_MS = 5 * 60 * 1000

type Entry = { userKey: string; at: number; data: Recommendations }

function readStored(userKey: string): Entry | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as Entry
    return entry.userKey === userKey && entry.data?.cards ? entry : null
  } catch {
    return null
  }
}

function writeStored(entry: Entry) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry)) } catch { /* private mode / quota */ }
}

/** Query options for one user's cards; the stored copy (if any) is the initial data. */
export function recommendationsQuery(userKey: string) {
  return {
    queryKey: queryKeys.recommendations(userKey),
    queryFn: async ({ signal }: { signal?: AbortSignal }) => {
      const data = await fetchRecommendations(signal)
      writeStored({ userKey, at: Date.now(), data })
      return data
    },
    staleTime: STALE_MS,
    retry: false,
    initialData: () => readStored(userKey)?.data,
    initialDataUpdatedAt: () => readStored(userKey)?.at,
  }
}

/** Fetch now (deduplicated by the query cache). Resolves null on failure so callers keep what they have. */
export function prefetchRecommendations(userKey: string): Promise<Recommendations | null> {
  return getQueryClient()
    .fetchQuery({ ...recommendationsQuery(userKey), staleTime: 0 })
    .catch(() => null)
}

/** Warm the cache if it is missing or stale (no-op when fresh). Safe to call repeatedly. */
export function warmRecommendations(userKey: string | null | undefined): void {
  if (!userKey) return
  void getQueryClient().prefetchQuery(recommendationsQuery(userKey))
}

export function useRecommendationsState(): { recommendations: Recommendations | null; loading: boolean } {
  const { user } = useAuth()
  const userKey = String(user?.auth0Id ?? user?.id ?? '')
  // Storage is read only after hydration, so the first client render matches the server's HTML.
  const isClient = useIsClient()
  const activeKey = isClient ? userKey : ''
  const query = useQuery({ ...recommendationsQuery(activeKey), enabled: !!activeKey })

  return {
    recommendations: query.data ?? null,
    loading: query.data === undefined && !query.isError,
  }
}

export function useRecommendations(): Recommendations | null {
  return useRecommendationsState().recommendations
}
