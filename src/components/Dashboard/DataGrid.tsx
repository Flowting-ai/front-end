import type { TableColumn } from '@/lib/api/warehouse'
import styles from './Dashboard.module.css'

export interface DataGridProps {
  columns: TableColumn[]
  rows: Record<string, unknown>[]
  caption: string
}

/** How one cell reads: nothing for null, the text for scalars, JSON for anything nested. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

export function DataGrid({ columns, rows, caption }: DataGridProps) {
  return (
    <div className={styles.gridViewport}>
      <table className={styles.grid}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{columns.map(column => <th key={column.name} scope="col" title={column.type}>{column.name}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(column => {
                const text = cellText(row[column.name])
                return <td key={column.name} className={text === '' ? styles.cellEmpty : undefined}>{text === '' ? '—' : text}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
