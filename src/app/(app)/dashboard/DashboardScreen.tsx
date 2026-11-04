'use client'

import { useState } from 'react'
import { DashboardHeader, MetricsPanel, TablesPanel, WorkspaceEmpty } from '@/components/Dashboard'
import styles from '@/components/Dashboard/Dashboard.module.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/Tabs'
import { Skeleton } from '@/components/Skeleton'
import { ApiError } from '@/lib/api/client'
import { useWorkspace } from '@/lib/warehouse/queries'

type View = 'metrics' | 'tables'

/** The store workspace: its metrics over a period, and the store tables the warehouse keeps for it. */
export function DashboardScreen() {
  const [view, setView] = useState<View>('metrics')
  const workspace = useWorkspace()

  if (workspace.isError && workspace.error instanceof ApiError && workspace.error.status === 404) {
    return <div className={styles.page}><WorkspaceEmpty /></div>
  }
  if (workspace.data === undefined) {
    return (
      <div className={styles.page} aria-busy>
        <Skeleton style={{ width: 240, height: 28 }} />
        <Skeleton style={{ width: '100%', height: 96 }} />
      </div>
    )
  }
  return (
    <div className={styles.page}>
      <DashboardHeader workspace={workspace.data} />
      <Tabs value={view} onValueChange={value => setView(value as View)}>
        <TabsList size="small" aria-label="Dashboard view">
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics"><MetricsPanel /></TabsContent>
        <TabsContent value="tables"><TablesPanel /></TabsContent>
      </Tabs>
    </div>
  )
}
