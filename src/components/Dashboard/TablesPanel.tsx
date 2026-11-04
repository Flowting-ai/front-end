'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/Skeleton'
import { formatCount } from '@/lib/home/format'
import { ROWS_PER_PAGE, useRows, useTables } from '@/lib/warehouse/queries'
import { DataGrid } from './DataGrid'
import styles from './Dashboard.module.css'

/** The store tables: pick one, page through its rows. */
export function TablesPanel() {
  const tables = useTables(true)
  const [picked, setPicked] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const current = picked ?? tables.data?.find(table => table.rows > 0)?.name ?? tables.data?.[0]?.name ?? null
  const rows = useRows(current, page)
  const total = rows.data?.total ?? 0
  const last = total === 0 ? 0 : Math.ceil(total / ROWS_PER_PAGE) - 1

  if (tables.data === undefined) return <Skeleton style={{ width: '100%', height: 240 }} />
  return (
    <section className={styles.tables}>
      <nav className={styles.tableList} aria-label="Store tables">
        {tables.data.map(table => (
          <button
            key={table.name}
            type="button"
            className={styles.tableRow}
            aria-current={table.name === current ? 'true' : undefined}
            title={table.meaning}
            onClick={() => { setPicked(table.name); setPage(0) }}
          >
            <span className={styles.tableName}>{table.name}</span>
            <span className={styles.tableCount}>{formatCount(table.rows)}</span>
          </button>
        ))}
      </nav>
      <div className={styles.tableBody}>
        {current && rows.data && (
          <>
            <div className={styles.toolbar}>
              <span className={styles.toolbarMeta}>
                {total === 0 ? 'No rows yet' : `${formatCount(page * ROWS_PER_PAGE + 1)}–${formatCount(Math.min(total, (page + 1) * ROWS_PER_PAGE))} of ${formatCount(total)}`}
              </span>
              <span className={styles.pager}>
                <button type="button" className={styles.pagerButton} disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <button type="button" className={styles.pagerButton} disabled={page >= last} onClick={() => setPage(page + 1)}>Next</button>
              </span>
            </div>
            {total > 0 && <DataGrid columns={rows.data.columns} rows={rows.data.rows} caption={`${current} rows`} />}
          </>
        )}
        {current && rows.data === undefined && <Skeleton style={{ width: '100%', height: 240 }} />}
      </div>
    </section>
  )
}
