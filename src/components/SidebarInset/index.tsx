'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarInsetProps extends React.HTMLAttributes<HTMLElement> {}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Layout companion for `<Sidebar>`. Renders as `<main>` and fills the
 * remaining horizontal space next to the sidebar.
 *
 * Usage:
 * ```tsx
 * <SidebarProvider>
 *   <div style={{ display: 'flex', height: '100svh' }}>
 *     <Sidebar ... />
 *     <SidebarInset>
 *       {/* page content *\/}
 *     </SidebarInset>
 *   </div>
 * </SidebarProvider>
 * ```
 */
export function SidebarInset({ className, children, style, ref, ...props }: SidebarInsetProps & { ref?: React.Ref<HTMLElement> }) {
    return (
      <main
        ref={ref}
        className={cn('kaya-scrollbar', className)}
        style={{
          position:        'relative',
          flex:            1,
          display:         'flex',
          flexDirection:   'column',
          minHeight:       '100svh',
          minWidth:        0,
          overflow:        'auto',
          backgroundColor: 'var(--neutral-50)',
          ...style,
        }}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        {children}
      </main>
    )
}

SidebarInset.displayName = 'SidebarInset'

export default SidebarInset
