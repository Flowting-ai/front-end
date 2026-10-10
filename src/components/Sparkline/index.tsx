'use client'

import React, { Suspense } from 'react'
import { useIsClient } from '@/hooks/use-is-client'
import { cn } from '@/lib/utils'
import type { SparklineProps } from './SparklineChart'

export type { SparklineProps } from './SparklineChart'

// The chart itself lives in ./SparklineChart and pulls in Recharts (~290 KB raw / ~90 KB gzip).
// Sparklines appear in chat metric tiles, which most chats never contain, so the chart is
// loaded the first time one renders instead of with the chat page. Until then (and during
// server rendering / hydration) a blank box of the same size is shown, so nothing shifts.
const SparklineChart = React.lazy(() =>
  import('./SparklineChart').then((module) => ({ default: module.Sparkline })),
)

export function Sparkline({ ref, ...props }: SparklineProps & { ref?: React.Ref<HTMLDivElement> }) {
  const isClient = useIsClient()
  const { height = 160, className, style } = props
  const placeholder = (
    <div ref={ref} aria-hidden className={cn(className)} style={{ width: '100%', height, ...style }} />
  )
  if (!isClient) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <SparklineChart ref={ref} {...props} />
    </Suspense>
  )
}

Sparkline.displayName = 'Sparkline'
export default Sparkline
