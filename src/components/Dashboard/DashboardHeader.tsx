'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Dropdown } from '@/components/Dropdown'
import type { Workspace } from '@/lib/api/warehouse'
import { RANGE_OPTIONS, syncOf, syncedLabel, type DashboardRange } from '@/lib/warehouse/present'
import styles from './Dashboard.module.css'

export interface DashboardHeaderProps {
  workspace: Workspace
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
  /** What sits at the right edge: the view switch. */
  children?: ReactNode
}

/** The store's name, its sync state with the period picker, and the view switch. */
export function DashboardHeader({ workspace, range, onRangeChange, children }: DashboardHeaderProps) {
  const [open, setOpen] = useState(false)
  const sync = syncOf(workspace)
  const rangeLabel = RANGE_OPTIONS.find(o => o.id === range)?.label ?? range
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{workspace.name}</h1>
      <div className={styles.statusPill} data-state={sync.state}>
        <span className={styles.statusDot} aria-hidden />
        {syncedLabel(sync)}
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
              {RANGE_OPTIONS.map(o => (
                <Dropdown.Item
                  key={o.id}
                  label={o.label}
                  selected={o.id === range}
                  onClick={() => { onRangeChange(o.id); setOpen(false) }}
                  fluid
                />
              ))}
            </Dropdown.Section>
          </Dropdown>
        </Dropdown.Float>
      </div>
      <div className={styles.headerEnd}>{children}</div>
    </header>
  )
}
