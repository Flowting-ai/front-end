import React from 'react'
import { Skeleton } from '@/components/Skeleton'
import { PersonaCardSkeleton } from '@/components/PersonaCard/PersonaCardSkeleton'
import { PERSONA_CARD_WIDTH } from '@/components/PersonaCard'

const GRID_GAP = 16

/**
 * Route-transition placeholder for /agents (the My Agents list). Mirrors page.tsx: the rounded
 * scroll card, the tab strip, the title row with "New agent", the search / sort / filter toolbar
 * and two rows of agent cards, using the same widths, gaps and paddings so the real page replaces
 * it without anything moving.
 */
export function AgentsListLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading agents"
      style={{
        background:   'var(--color-surface-container)',
        border:       '1px solid var(--border-default)',
        borderRadius: 22,
        flex:         '1 1 0',
        minHeight:    0,
        overflow:     'hidden',
        padding:      3,
      }}
    >
      <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 36, paddingBottom: 24, boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 991, padding: '0 12px', boxSizing: 'border-box', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 41 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tabs: the My Agents / Super Links segmented control */}
            <Skeleton width={217} height={46} radius={14} />

            {/* Title row: "Agents" (24/32) + New agent button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ height: 32, display: 'flex', alignItems: 'center' }}>
                <Skeleton width={77} height={24} radius={6} />
              </div>
              <Skeleton width={115} height={36} radius={10} />
            </div>

            {/* Toolbar: 450px search on the left, sort + filter on the right */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width={450} height={36} radius={10} style={{ maxWidth: '100%' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Skeleton width={132} height={36} radius={10} />
                <Skeleton width={76} height={36} radius={10} />
              </div>
            </div>
          </div>

          {/* Two rows of three cards, the same columns as AgentsGrid (up to 314px each) */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: `repeat(3, minmax(0, ${PERSONA_CARD_WIDTH}px))`,
            justifyContent:      'center',
            gap:                 GRID_GAP,
          }}>
            {Array.from({ length: 6 }).map((_, i) => <PersonaCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
