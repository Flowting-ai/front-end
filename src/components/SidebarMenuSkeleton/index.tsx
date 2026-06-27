'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarMenuSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Show an icon placeholder on the left — matches `default` variant icon slot.
   * @default false
   */
  showIcon?: boolean
  /**
   * Full width instead of fixed 217px — always pass inside Sidebar.
   * @default false
   */
  fluid?: boolean
  /**
   * Deterministic seed for the text bar width — avoids SSR/client hydration
   * mismatches that occur with Math.random(). Pass the item's list index.
   * @default 0
   */
  index?: number
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SidebarMenuSkeleton = React.forwardRef<HTMLDivElement, SidebarMenuSkeletonProps>(
  function SidebarMenuSkeleton({ showIcon = false, fluid = false, index = 0, className, ...props }, ref) {
    // Derive a deterministic width (50–88%) from `index` so server and client
    // always agree — Math.random() produces different values on each side.
    const width = useMemo(() => {
      const pct = 50 + ((index * 37 + 17) % 38)
      return `${pct}%`
    }, [index])

    return (
      <div
        ref={ref}
        aria-hidden
        className={cn(className)}
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        '8px',
          padding:    '6px',
          borderRadius: '8px',
          width:      fluid ? '100%' : '217px',
          flexShrink: 0,
        }}
        {...props}
      >
        {showIcon && (
          <div
            className="kaya-skeleton"
            style={{ width: '20px', height: '20px', borderRadius: '6px' }}
          />
        )}

        <div
          className="kaya-skeleton"
          style={{ flex: 1, maxWidth: width, height: '10px', borderRadius: '4px' }}
        />
      </div>
    )
  },
)

SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton'

export default SidebarMenuSkeleton
