'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarMenuSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Show an icon placeholder on the left - matches `default` variant icon slot.
   * @default false
   */
  showIcon?: boolean
  /**
   * Full width instead of fixed 217px - always pass inside Sidebar.
   * @default false
   */
  fluid?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SidebarMenuSkeleton({ showIcon = false, fluid = false, className, ref, ...props }: SidebarMenuSkeletonProps & { ref?: React.Ref<HTMLDivElement> }) {
    // Start with a fixed width on SSR; randomise only after mount to avoid hydration mismatch
    const [width, setWidth] = useState('70%')
    useEffect(() => {
      setWidth(`${Math.floor(Math.random() * 38) + 50}%`)
    }, [])

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
}

SidebarMenuSkeleton.displayName = 'SidebarMenuSkeleton'

export default SidebarMenuSkeleton
