'use client'

import React from 'react'
import { Skeleton } from '@/components/Skeleton'

// Generic placeholder for a conversation while its messages load — alternates
// assistant (left, wide) / user (right, narrow) bubbles so the shape reads as
// "chat" rather than a generic list, without needing to know real content.
const ROWS: Array<{ align: 'left' | 'right'; width: string }> = [
  { align: 'left',  width: '62%' },
  { align: 'right', width: '38%' },
  { align: 'left',  width: '74%' },
  { align: 'left',  width: '48%' },
  { align: 'right', width: '30%' },
]

export function ChatMessagesSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0', width: '100%' }} aria-hidden>
      {ROWS.map((row, i) => (
        <div
          key={i}
          style={{
            display:        'flex',
            justifyContent: row.align === 'right' ? 'flex-end' : 'flex-start',
            opacity:        1 - i * 0.12,
          }}
        >
          <Skeleton width={row.width} height={36} radius={14} />
        </div>
      ))}
    </div>
  )
}

export default ChatMessagesSkeleton
