'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { ConfirmModal } from '@/components/ConfirmModal'
import { MetricStrip } from '@/components/Home'
import { Skeleton } from '@/components/Skeleton'
import { useIsClient } from '@/hooks/use-is-client'
import type { Workspace } from '@/lib/api/warehouse'
import { useDeleteMetric, useMeasurement, useMetricCatalog } from '@/lib/warehouse/queries'
import { deltaColor, formatDelta } from '@/lib/home/format'
import {
  CHART_GRAIN, RANGE_OPTIONS, channelsOf, deltaOf, formatValue, headlineFrom, periodFor, pointsFor, previousPeriodFor, tilesFrom,
  type DashboardRange, type MetricTile,
} from '@/lib/warehouse/present'
import { MetricEditor } from './MetricEditor'
import { MetricRows } from './MetricRows'
import styles from './Dashboard.module.css'

// The chart pulls in Recharts, so it is loaded the first time a metric is charted, not with the page.
const MetricLineChart = React.lazy(() => import('./MetricLineChart').then(module => ({ default: module.MetricLineChart })))
const CHART_HEIGHT = 200

export interface MetricsPanelProps {
  workspace: Workspace
  range: DashboardRange
}

/** The metric library over a range: the headline strip, a daily line for the chosen metric, and every metric as a row. */
export function MetricsPanel({ workspace, range }: MetricsPanelProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<MetricTile | null>(null)
  const period = useMemo(() => periodFor(range), [range])
  const before = useMemo(() => previousPeriodFor(range), [range])
  const catalog = useMetricCatalog(true)
  const remove = useDeleteMetric()
  const names = useMemo(() => (catalog.data ?? []).map(entry => entry.name), [catalog.data])
  const total = useMeasurement({ metrics: names, ...period, grain: 'total' }, names.length > 0)
  const previous = useMeasurement({ metrics: names, ...before, grain: 'total' }, names.length > 0)
  const daily = useMeasurement({ metrics: names, ...period, grain: CHART_GRAIN }, names.length > 0)

  const tiles = useMemo(() => tilesFrom(catalog.data ?? [], total.data, previous.data), [catalog.data, total.data, previous.data])
  const headline = useMemo(() => headlineFrom(tiles, channelsOf(workspace.connectors)), [tiles, workspace.connectors])
  const chosen = tiles.find(tile => tile.name === selected && tile.unavailable === null)
    ?? tiles.find(tile => tile.unavailable === null)
    ?? null
  const points = useMemo(() => pointsFor(daily.data, chosen?.name ?? ''), [daily.data, chosen?.name])
  const isClient = useIsClient()
  const chartPlaceholder = <Skeleton style={{ width: '100%', height: CHART_HEIGHT }} />
  const against = `previous ${RANGE_OPTIONS.find(o => o.id === range)?.days ?? 30} days`

  if (catalog.data === undefined || (total.data === undefined && !total.isError)) {
    return (
      <section className={styles.panel} aria-busy>
        <Skeleton style={{ width: '100%', height: 96 }} />
        <Skeleton style={{ width: '100%', height: CHART_HEIGHT }} />
      </section>
    )
  }
  return (
    <section className={styles.panel}>
      <MetricStrip metrics={headline} />
      <div className={styles.feature}>
        {chosen && (
          <section className={styles.focus} aria-labelledby="dashboard-focus">
            <div className={styles.focusTop}>
              <h2 id="dashboard-focus" className={styles.focusEyebrow}>{chosen.label}</h2>
              <span className={styles.sectionMeta}>by day</span>
            </div>
            <div className={styles.focusValue}>
              <strong>{formatValue(chosen.value, chosen.unit)}</strong>
              <span className={styles.delta} style={{ color: deltaColor(deltaOf(chosen.value, chosen.previous)) }}>
                {formatDelta(deltaOf(chosen.value, chosen.previous))} vs {against}
              </span>
            </div>
            <div className={styles.focusChart}>
              {daily.data === undefined || !isClient
                ? chartPlaceholder
                : (
                  <Suspense fallback={chartPlaceholder}>
                    <MetricLineChart points={points} unit={chosen.unit} height={CHART_HEIGHT} />
                  </Suspense>
                )}
            </div>
            <p className={styles.focusDescription}>{chosen.description}</p>
          </section>
        )}
        <div className={styles.list}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>All metrics</h2>
            <Button variant="secondary" size="sm" leftIcon={<Plus size={14} strokeWidth={1.75} aria-hidden />} onClick={() => setAdding(true)}>
              Add metric
            </Button>
          </div>
          <MetricRows tiles={tiles} selected={chosen?.name ?? null} onSelect={setSelected} against={against} onRemove={setRemoving} />
        </div>
      </div>
      {adding && <MetricEditor onClose={() => setAdding(false)} />}
      {removing && (
        <ConfirmModal
          title={`Remove ${removing.label}?`}
          description="It comes off the dashboard for everyone in the organization. Metrics built on it stop working."
          confirmLabel="Remove"
          onConfirm={async () => {
            await remove.mutateAsync(removing.name)
            toast.success(`${removing.label} removed`)
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  )
}
