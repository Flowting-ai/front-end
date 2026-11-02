'use client'

import { useState } from 'react'
import { ChevronDown, Eye } from 'lucide-react'
import { Dropdown } from '@/components/Dropdown'
import { DATE_RANGE_OPTIONS, type DateRange } from '@/lib/home/mock-data'
import styles from './Home.module.css'

export interface HomeHeaderProps {
  storeName: string
  storeLive: boolean
  range: DateRange
  onRangeChange: (range: DateRange) => void
  watchingCount: number
}

/** Store name, live status + period picker, and how many things Souvenir is watching. */
export function HomeHeader({ storeName, storeLive, range, onRangeChange, watchingCount }: HomeHeaderProps) {
  const [open, setOpen] = useState(false)
  const rangeLabel = DATE_RANGE_OPTIONS.find(o => o.value === range)?.label ?? range
  return (
    <header className={styles.header}>
      <h1 className={styles.storeName}>{storeName}</h1>
      <div className={`${styles.pill} ${styles.statusPill}`}>
        <span className={styles.liveDot} aria-hidden style={storeLive ? undefined : { background: 'var(--neutral-400)', boxShadow: 'none' }} />
        {storeLive ? 'Store is live' : 'Store is offline'}
        <span className={styles.pillDivider} aria-hidden />
        <Dropdown.Float
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          trigger={
            <button type="button" className={styles.rangeTrigger} aria-label={`Period: ${rangeLabel}`}>
              {rangeLabel}
              <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
            </button>
          }
        >
          <Dropdown maxHeight={false}>
            <Dropdown.Section>
              {DATE_RANGE_OPTIONS.map(o => (
                <Dropdown.Item
                  key={o.value}
                  label={o.label}
                  selected={o.value === range}
                  onClick={() => { onRangeChange(o.value); setOpen(false) }}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      </div>
      <div className={`${styles.pill} ${styles.watching}`}>
        <Eye size={16} strokeWidth={1.75} aria-hidden />
        <span>Watching</span>
        <span className={styles.count}>{watchingCount}<span className="sr-only"> {watchingCount === 1 ? 'item' : 'items'}</span></span>
      </div>
    </header>
  )
}
