'use client'

import { useState } from 'react'
import { DashboardHeader, MetricsPanel, WorkspaceBuilding, WorkspaceEmpty } from '@/components/Dashboard'
import styles from '@/components/Dashboard/Dashboard.module.css'
import { Skeleton } from '@/components/Skeleton'
import { ApiError } from '@/lib/api/client'
import { syncOf, type DashboardRange } from '@/lib/warehouse/present'
import { useWorkspace } from '@/lib/warehouse/queries'

/** The store workspace: its metrics over a period. */
export function DashboardScreen() {
  const [range, setRange] = useState<DashboardRange>('30d')
  const workspace = useWorkspace()

  if (workspace.isError && workspace.error instanceof ApiError && workspace.error.status === 404) {
    return <div className={styles.page}><WorkspaceEmpty /></div>
  }
  if (workspace.isError) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.emptyText}>The warehouse didn&apos;t answer. Try again in a minute.</p>
      </div>
    )
  }
  if (workspace.data === undefined) {
    return (
      <div className={styles.page} aria-busy>
        <Skeleton style={{ width: 240, height: 28 }} />
        <Skeleton style={{ width: '100%', height: 96 }} />
      </div>
    )
  }
  const building = syncOf(workspace.data).state === 'building'
  return (
    <div className={styles.page}>
      <DashboardHeader workspace={workspace.data} range={range} onRangeChange={setRange} />
      {building ? <WorkspaceBuilding /> : <MetricsPanel workspace={workspace.data} range={range} />}
    </div>
  )
}
