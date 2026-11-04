import type { MetricTile } from '@/lib/warehouse/present'
import { formatValue } from '@/lib/warehouse/present'
import styles from './Dashboard.module.css'

export interface MetricTilesProps {
  tiles: MetricTile[]
  selected: string | null
  onSelect: (name: string) => void
}

/** One tile per metric; the selected one drives the chart below. */
export function MetricTiles({ tiles, selected, onSelect }: MetricTilesProps) {
  if (tiles.length === 0) return null
  return (
    <ul className={styles.tiles} aria-label="Store metrics">
      {tiles.map(tile => (
        <li key={tile.name}>
          <button
            type="button"
            className={styles.tile}
            aria-pressed={tile.name === selected}
            disabled={tile.unavailable !== null}
            title={tile.unavailable ?? tile.description}
            onClick={() => onSelect(tile.name)}
          >
            <span className={styles.tileLabel}>{tile.label}</span>
            <span className={styles.tileValue}>{tile.unavailable ? 'n/a' : formatValue(tile.value, tile.unit)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
