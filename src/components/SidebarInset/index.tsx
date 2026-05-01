'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface SidebarInsetProps extends React.HTMLAttributes<HTMLElement> {}

export const SidebarInset = React.forwardRef<HTMLElement, SidebarInsetProps>(
  function SidebarInset({ className, children, style, ...props }, ref) {
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
  },
)

SidebarInset.displayName = 'SidebarInset'

export default SidebarInset
