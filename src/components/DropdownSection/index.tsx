'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Divider } from '@/components/Divider'
import { useMenuMode, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DropdownSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Optional section header label - renders a `DropdownMenuItem variant="header"` row
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
  /** `DropdownMenuItem` rows - should use `fluid` prop to fill available width */
  children?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DropdownSection(
  { label, divider = false, fluid = false, children, className, style, ref, ...props }: DropdownSectionProps & { ref?: React.Ref<HTMLDivElement> },
) {
    // Inside a Radix menu the section is a Radix Group (role="group"); its
    // header row renders as a Radix Label via DropdownMenuItem.
    const inMenu = useMenuMode() === 'menu'
    const Comp = inMenu ? DropdownMenuGroup : 'div'
    return (
      <Comp
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
      </Comp>
    )
}

DropdownSection.displayName = 'DropdownSection'

export default DropdownSection
