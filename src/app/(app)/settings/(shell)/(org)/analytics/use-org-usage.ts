'use client'

import { useCallback, useMemo } from 'react'
import { useAuth } from '@/context/auth-context'
import { useOrg } from '@/context/org-context'
import { trackBrowserEvent } from '@/lib/analytics/events'
import { memberUsageCsv, orgUsageSummary } from '@/lib/analytics/org-usage'

/**
 * The org Usage page's data: plan and members from useOrg() (React Query),
 * derived by orgUsageSummary, plus a CSV download of per-member usage.
 */
export function useOrgUsage() {
  const { members, membersLoading, plan, orgReady } = useOrg()
  const { user } = useAuth()
  const summary = useMemo(() => orgUsageSummary(plan, members, user?.email), [plan, members, user?.email])

  const exportCsv = useCallback(() => {
    const cycle = plan?.cycleLabel && plan.cycleLabel !== '—' ? plan.cycleLabel : undefined
    const blob = new Blob([memberUsageCsv(members, cycle)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'member-usage.csv'
    a.click()
    URL.revokeObjectURL(url)
    trackBrowserEvent('usage_csv_exported', { rows: summary.activeCount })
  }, [members, plan, summary.activeCount])

  // `membersLoading` is also true while React Query refreshes in the background (e.g. on returning to
  // the tab); only the first load, with no members yet, should show the skeleton.
  return { ready: orgReady && !(membersLoading && members.length === 0), plan, summary, exportCsv }
}
