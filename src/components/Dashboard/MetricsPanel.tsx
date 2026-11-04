'use client'

import React, { Suspense, useMemo, useState } from 'react'
import { Skeleton } from '@/components/Skeleton'
import { useIsClient } from '@/hooks/use-is-client'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { useMeasurement, useMetricCatalog } from '@/lib/warehouse/queries'
import {
  CHART_GRAIN, RANGE_OPTIONS, periodFor, pointsFor, tilesFrom, type DashboardRange,
} from '@/lib/warehouse/present'
import { MetricTiles } from './MetricTiles'
import styles from './Dashboard.module.css'

// The chart pulls in Recharts, so it is loaded the first time a metric is charted, not with the page.
const MetricLineChart = React.lazy(() => import('./MetricLineChart').then(module => ({ default: module.MetricLineChart })))
const CHART_HEIGHT = 220

/** The metric library measured over a range: tiles for the totals, a daily line for the chosen one. */
export function MetricsPanel() {
  const [range, setRange] = useState<DashboardRange>('30d')
  const [selected, setSelected] = useState<string | null>(null)
  const period = useMemo(() => periodFor(range), [range])
  const catalog = useMetricCatalog(true)
  const names = useMemo(() => (catalog.data ?? []).map(entry => entry.name), [catalog.data])
  const total = useMeasurement({ metrics: names, ...period, grain: 'total' }, names.length > 0)
  const daily = useMeasurement({ metrics: names, ...period, grain: CHART_GRAIN }, names.length > 0)

  const tiles = useMemo(() => tilesFrom(catalog.data ?? [], total.data), [catalog.data, total.data])
  const chosen = tiles.find(tile => tile.name === selected && tile.unavailable === null)
    ?? tiles.find(tile => tile.unavailable === null)
    ?? null
  const points = useMemo(() => pointsFor(daily.data, chosen?.name ?? ''), [daily.data, chosen?.name])
  const isClient = useIsClient()
  const chartPlaceholder = <Skeleton style={{ width: '100%', height: CHART_HEIGHT }} />

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <Tabs value={range} onValueChange={value => setRange(value as DashboardRange)}>
          <TabsList size="small" aria-label="Period">
            {RANGE_OPTIONS.map(option => <TabsTrigger key={option.id} value={option.id}>{option.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <span className={styles.toolbarMeta}>{period.start} – {period.end}</span>
      </div>
      {catalog.data === undefined || (total.data === undefined && !total.isError)
        ? <Skeleton style={{ width: '100%', height: 96 }} />
        : <MetricTiles tiles={tiles} selected={chosen?.name ?? null} onSelect={setSelected} />}
      {chosen && (
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>{chosen.label} by day</div>
          {daily.data === undefined || !isClient
            ? chartPlaceholder
            : (
              <div className={styles.chart}>
                <Suspense fallback={chartPlaceholder}>
                  <MetricLineChart points={points} unit={chosen.unit} height={CHART_HEIGHT} />
                </Suspense>
              </div>
            )}
        </div>
      )}
    </section>
  )
}
