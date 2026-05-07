'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Divider } from '@/components/Divider'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DropdownSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional section header label — renders a `DropdownMenuItem variant="header"` row
   * with extra bottom padding above the item list. Omit for an unlabelled section.
   */
  label?: string
  /**
   * When `true`, renders a full-width `<Divider />` at the top of the section.
   * Use on all sections except the first in a menu to visually separate groups.
   * @default false
   */
  divider?: boolean
  /** Stretch to full width instead of fixed 217px */
  fluid?: boolean
  /** `DropdownMenuItem` rows — should use `fluid` prop to fill available width */
  children?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export const DropdownSection = React.forwardRef<HTMLDivElement, DropdownSectionProps>(
  function DropdownSection(
    { label, divider = false, fluid = false, children, className, style, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          width:         fluid ? '100%' : '217px',
          ...style,
        }}
        {...props}
      >
        {divider && <Divider decorative />}

        <div style={{ display: 'flex', flexDirection: 'column', padding: '8px', width: '100%' }}>
          {label && <DropdownMenuItem variant="header" label={label} fluid />}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
            {children}
          </div>
        </div>
      </div>
    )
  },
)

DropdownSection.displayName = 'DropdownSection'

export default DropdownSection
