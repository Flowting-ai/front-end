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
            {/* Tabs: My Agents / Super Links */}
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton width={104} height={36} radius={10} />
              <Skeleton width={104} height={36} radius={10} />
            </div>

            {/* Title row: "Agents" + New agent button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width={120} height={32} radius={8} />
              <Skeleton width={116} height={34} radius={10} />
            </div>

            {/* Toolbar: 450px search on the left, sort + filter on the right */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Skeleton width={450} height={36} radius={10} style={{ maxWidth: '100%' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Skeleton width={96} height={34} radius={10} />
                <Skeleton width={84} height={34} radius={10} />
              </div>
            </div>
          </div>

          {/* Two rows of cards, up to three across (314px each) like the real grid */}
          <div style={{
            display:             'grid',
            gridTemplateColumns: `repeat(auto-fill, ${PERSONA_CARD_WIDTH}px)`,
            justifyContent:      'center',
            maxWidth:            PERSONA_CARD_WIDTH * 3 + GRID_GAP * 2,
            width:               '100%',
            margin:              '0 auto',
            gap:                 GRID_GAP,
          }}>
            {Array.from({ length: 6 }).map((_, i) => <PersonaCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
