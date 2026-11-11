'use client'

import React from 'react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'ghost' | 'outline' | 'secondary' | 'danger'
type Size = 'md' | 'sm' | 'xs' | 'lg'

export interface LinkButtonProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  variant?: Variant
  size?: Size
  fluid?: boolean
  className?: string
}

/**
 * A real link that looks like a button. Navigation should be an anchor (open in a new tab, copy the
 * address, correct role), and `<Button asChild>` cannot do it here: only the primary variant supports
 * asChild, the others wrap their content in several elements, which the underlying Slot rejects.
 */
export function LinkButton({ variant = 'secondary', size = 'md', fluid = false, className, children, ...props }: LinkButtonProps) {
  return (
    <Link className={cn(buttonVariants({ variant, size }), fluid && 'w-full flex-1', className)} {...props}>
      {children}
    </Link>
  )
}
