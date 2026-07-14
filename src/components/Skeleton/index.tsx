'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default '100%' */
  width?: number | string
  /** @default '14px' */
  height?: number | string
  /** @default '6px' */
  radius?: number | string
}

// ── Component ─────────────────────────────────────────────────────────────────
// Shared pulse-skeleton block — wraps the `kaya-skeleton` CSS primitive
// (globals.css) so every loading state in the app uses one visual language
// instead of hand-rolled pulse animations per page.

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton({ width = '100%', height = '14px', radius = '6px', className, style, ...props }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        className={cn('kaya-skeleton', className)}
        style={{ width, height, borderRadius: radius, flexShrink: 0, ...style }}
        {...props}
      />
    )
  },
)

Skeleton.displayName = 'Skeleton'

export default Skeleton
