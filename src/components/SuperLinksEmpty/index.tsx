'use client'

import React from 'react'
import { ArrowRightOneIcon, LinkSixIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuperLinksEmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  onBrowsePersonas?: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuperLinksEmpty({ ref, onBrowsePersonas, className, style, ...props }: SuperLinksEmptyProps & { ref?: React.Ref<HTMLDivElement> }) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             12,
          padding:         '32px 20px',
          borderRadius:    14,
          backgroundColor: 'var(--neutral-50)',
          boxShadow:       '0 0 0 1.5px var(--neutral-200)',
          textAlign:       'center',
          color:           'var(--neutral-500)',
          ...style,
        }}
        {...props}
      >
        <span
          aria-hidden
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            width:           40,
            height:          40,
            borderRadius:    12,
            backgroundColor: 'var(--neutral-100)',
            color:           'var(--neutral-700)',
          }}
        >
          <LinkSixIcon size={20} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-title)',
              fontSize:   'var(--font-size-body)',
              lineHeight: 'var(--line-height-body)',
              fontWeight: 'var(--font-weight-medium)',
              color:      'var(--neutral-900)',
            }}
          >
            No Super Links yet
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
              color:      'var(--neutral-500)',
              maxWidth:   260,
            }}
          >
            Generate a Super Link from any agent. Open an agent card and choose &ldquo;Generate Super Link&rdquo; from the menu.
          </span>
        </div>
        <Button size="sm" variant="secondary" onClick={onBrowsePersonas} rightIcon={<ArrowRightOneIcon />}>
          Browse My Agents
        </Button>
      </div>
    )
}

SuperLinksEmpty.displayName = 'SuperLinksEmpty'
export default SuperLinksEmpty
