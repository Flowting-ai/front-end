import { ArrowDown, ArrowUp } from 'lucide-react'
import type { HomeMetric } from '@/lib/home/mock-data'
import { deltaColor, deltaDirection, deltaLabel, formatDelta, formatMetric } from '@/lib/home/format'
import { CHANNEL_LABELS, ChannelIcon } from './ChannelIcon'
import styles from './Home.module.css'

export interface MetricCardProps {
  metric: HomeMetric
}

/** One cell of the metrics strip: label + channel marks, the value, and the change vs. last period. */
export function MetricCard({ metric }: MetricCardProps) {
  const dir = deltaDirection(metric.delta)
  const channelNames = metric.channels.map(c => CHANNEL_LABELS[c]).join(', ')
  return (
    <li className={styles.metric}>
      <div className={styles.metricTop}>
        <h2 className={styles.metricLabel}>{metric.label}</h2>
        {metric.channels.length > 0 && (
          <span className={styles.channels} role="img" aria-label={`From ${channelNames}`}>
            {metric.channels.map(c => <ChannelIcon key={c} channel={c} size={16} />)}
          </span>
        )}
      </div>
      <div className={styles.metricValueRow}>
        <span className={styles.metricValue}>{formatMetric(metric.value, metric.format)}</span>
        <span className={styles.delta} style={{ color: deltaColor(metric.delta) }}>
          {dir === 'up' && <ArrowUp size={12} strokeWidth={1.75} aria-hidden />}
          {dir === 'down' && <ArrowDown size={12} strokeWidth={1.75} aria-hidden />}
          <span aria-hidden>{dir === 'flat' ? '0%' : formatDelta(metric.delta)}</span>
          <span className="sr-only">{deltaLabel(metric.delta)}</span>
        </span>
      </div>
    </li>
  )
}

export interface MetricStripProps {
  metrics: HomeMetric[]
}

export function MetricStrip({ metrics }: MetricStripProps) {
  if (metrics.length === 0) return null
  return (
    <ul className={styles.metrics} aria-label="Store metrics">
      {metrics.map(m => <MetricCard key={m.id} metric={m} />)}
    </ul>
  )
}
