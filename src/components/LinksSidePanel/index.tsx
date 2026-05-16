'use client'

import React from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Eyebrow } from '@/components/Eyebrow'
import { SuperLinkRow, type SuperLinkStatus } from '@/components/SuperLinkRow'
import { SuperLinksEmpty } from '@/components/SuperLinksEmpty'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LinksSidePanelItem {
  id:           string
  personaName:  string
  avatarColor:  string
  url:          string
  tokenUsed:    number
  tokenLimit:   number
  status:       SuperLinkStatus
}

export interface LinksSidePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  links:        LinksSidePanelItem[]
  selectedId?:  string | null
  onSelect?:    (id: string) => void
  onGenerate?:  () => void
  onCopyUrl?:   (id: string) => void
  /** Eyebrow at the top of the panel. */
  label?:       string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const LinksSidePanel = React.forwardRef<HTMLDivElement, LinksSidePanelProps>(
  function LinksSidePanel(
    { links, selectedId, onSelect, onGenerate, onCopyUrl, label = 'Active links', className, style, ...props },
    ref,
  ) {
    const empty = links.length === 0
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          isolation:       'isolate',
          display:         'flex',
          flexDirection:   'column',
          padding:         '20px 22px',
          borderRadius:    16,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       'var(--shadow-surface-card)',
          minWidth:        0,
          minHeight:       0,
          ...style,
        }}
        {...props}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eyebrow>{label}</Eyebrow>
            <span
              style={{
                display:         'inline-flex',
                alignItems:      'center',
                justifyContent:  'center',
                minWidth:        18,
                height:          18,
                padding:         '0 6px',
                borderRadius:    99,
                backgroundColor: 'var(--neutral-100)',
                color:           'var(--neutral-700)',
                fontFamily:      'var(--font-body)',
                fontSize:        'var(--font-size-caption)',
                lineHeight:      'var(--line-height-caption)',
                fontWeight:      'var(--font-weight-medium)',
              }}
            >
              {links.length}
            </span>
          </div>
          <Button size="sm" variant="secondary" onClick={onGenerate} leftIcon={<PlusSignIcon />}>
            Generate link
          </Button>
        </div>

        {empty ? (
          <SuperLinksEmpty />
        ) : (
          <div
            className="kaya-scrollbar"
            style={{
              display:             'flex',
              flexDirection:       'column',
              gap:                 8,
              overflowY:           'auto',
              overscrollBehaviorY: 'contain',
              minHeight:           0,
              padding:             '4px 4px',
              margin:              '-4px -4px',
            }}
          >
            {links.map(link => (
              <SuperLinkRow
                key={link.id}
                personaName={link.personaName}
                avatarColor={link.avatarColor}
                url={link.url}
                tokenUsed={link.tokenUsed}
                tokenLimit={link.tokenLimit}
                status={link.status}
                selected={selectedId === link.id}
                onClick={() => onSelect?.(link.id)}
                onCopyUrl={() => onCopyUrl?.(link.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  },
)

LinksSidePanel.displayName = 'LinksSidePanel'
export default LinksSidePanel
