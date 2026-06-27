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
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SidebarMenuSkeleton = React.forwardRef<HTMLDivElement, SidebarMenuSkeletonProps>(
  function SidebarMenuSkeleton({ showIcon = false, fluid = false, className, ...props }, ref) {
    // Randomise text bar width (50–88%) so stacked skeletons look naturally varied
    const width = useMemo(() => `${Math.floor(Math.random() * 38) + 50}%`, [])

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
