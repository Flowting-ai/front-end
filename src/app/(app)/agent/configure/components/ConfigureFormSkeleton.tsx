'use client'

import React from 'react'
import { Skeleton } from '@/components/Skeleton'

// Generic "form is loading" placeholder shared by the configure tabs (Profile,
// Sharing, Instructions, Knowledge) — a label bar + input-shaped block per row.
export function ConfigureFormSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 1 - i * 0.12 }}>
          <Skeleton width={120} height={12} />
          <Skeleton height={40} radius={10} />
        </div>
      ))}
    </div>
  )
}

export default ConfigureFormSkeleton
