import { ArrowDown, ArrowUp } from 'lucide-react'
import { deltaColor, deltaDirection, deltaLabel, formatDelta } from '@/lib/home/format'
import { deltaOf, formatValue, type MetricTile } from '@/lib/warehouse/present'
import styles from './Dashboard.module.css'

export interface MetricRowsProps {
  tiles: MetricTile[]
  selected: string | null
  onSelect: (name: string) => void
  /** What the change is measured against, e.g. "previous 30 days". */
  against: string
}

/** Every metric as one row: what it is, its value, and its change; the selected one drives the chart. */
export function MetricRows({ tiles, selected, onSelect, against }: MetricRowsProps) {
  if (tiles.length === 0) return null
  return (
    <ul className={styles.rows} aria-label="All metrics">
      {tiles.map(tile => {
        const delta = deltaOf(tile.value, tile.previous)
        const dir = deltaDirection(delta)
        return (
          <li key={tile.name}>
            <button
              type="button"
              className={styles.row}
              aria-pressed={tile.name === selected}
              disabled={tile.unavailable !== null}
              onClick={() => onSelect(tile.name)}
            >
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{tile.label}</span>
                <span className={styles.rowDescription}>{tile.unavailable ?? tile.description}</span>
              </span>
              <span className={styles.rowValue}>
                <strong>{tile.unavailable ? 'n/a' : formatValue(tile.value, tile.unit)}</strong>
                {tile.unavailable === null && (
                  <span className={styles.delta} style={{ color: deltaColor(delta) }}>
                    {dir === 'up' && <ArrowUp size={12} strokeWidth={1.75} aria-hidden />}
                    {dir === 'down' && <ArrowDown size={12} strokeWidth={1.75} aria-hidden />}
                    <span aria-hidden>{dir === 'flat' ? '0%' : formatDelta(delta)} vs {against}</span>
                    <span className="sr-only">{deltaLabel(delta)} against the {against}</span>
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
