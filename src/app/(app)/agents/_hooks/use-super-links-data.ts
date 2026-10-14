'use client'

import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { bustPersonasCache } from '@/lib/api/personas'
import type { ReceivedShareResponse } from '@/lib/api/persona-shares'
import { queryKeys } from '@/lib/query-keys'
import { receivedSharesQuery, shareDashboardQuery } from '@/lib/share/share-queries'

export type SuperLinksRange = '7d' | '30d' | '90d'

const RANGE_DAYS: Record<SuperLinksRange, 7 | 30 | 90> = { '7d': 7, '30d': 30, '90d': 90 }

type Update<T> = T | ((prev: T) => T)

/**
 * Data behind the Super Links tab: the usage dashboard for the chosen date
 * range, and the links other people shared with the viewer. Both are React
 * Query entries (lib/share/share-queries.ts) that refetch whenever the tab
 * becomes active, since usage only changes on the backend.
 */
export function useSuperLinksData({ active }: { active: boolean }) {
  const queryClient = useQueryClient()
  const [slRange, setSlRange] = useState<SuperLinksRange>('30d')
  const slDays = RANGE_DAYS[slRange]

  const dashboardQ = useQuery(shareDashboardQuery(slDays, active))
  const receivedQ = useQuery(receivedSharesQuery(active))

  const dashboard = dashboardQ.data ?? null
  // True until the first load lands (also while the tab is inactive), so the
  // tab's zero-links empty state can't flash before the fetch runs.
  const sharesLoading = dashboardQ.isPending
  const dashboardRefreshing = dashboardQ.isFetching && !dashboardQ.isPending
  const receivedShares = receivedQ.data ?? []
  const receivedLoading = receivedQ.isFetching && !receivedQ.data

  const setReceivedShares = useCallback((next: Update<ReceivedShareResponse[]>) => {
    queryClient.setQueryData<ReceivedShareResponse[]>(queryKeys.shares.received(), prev =>
      typeof next === 'function' ? next(prev ?? []) : next)
  }, [queryClient])

  // Manual refresh — usage numbers (credit_used/pct_used) on a recipient's Super
  // Link only change on the backend as they use the shared agent; there's no
  // push, so this re-pulls the dashboard on demand.
  const refetchDashboard = dashboardQ.refetch
  const refreshDashboard = useCallback(() => {
    bustPersonasCache()
    void refetchDashboard()
  }, [refetchDashboard])

  return {
    dashboard, sharesLoading, dashboardRefreshing, refreshDashboard,
    slRange, setSlRange, slDays,
    receivedShares, setReceivedShares, receivedLoading,
  }
}
