'use client'

import React, { type HTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface InputGroupProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

// ── InputGroup ────────────────────────────────────────────────────────────────
// Layout container that groups InputField components into a vertical stack.
// Use for logically related fields (sign-up form, address block, etc.).

export function InputGroup({ ref, children, className, ...props }: InputGroupProps & { ref?: React.Ref<HTMLDivElement> }) {
    return (
      <div
        ref={ref}
        className={cn(className)}
        {...props}
        style={{ display: 'flex', flexDirection: 'column', gap: '24px', ...props.style }}
      >
        {children}
      </div>
    )
}

InputGroup.displayName = 'InputGroup'

export default InputGroup
