'use client'

import React from 'react'
import { Skeleton } from '@/components/Skeleton'
import { Divider } from '@/components/Divider'

// Row separation comes from a divider between items, not a per-row border —
// intersperses one before every row after the first.
export function withDividers(rows: React.ReactNode[]): React.ReactNode[] {
  return rows.flatMap((row, i) => (i === 0 ? [row] : [<Divider key={`divider-${i}`} />, row]))
}

// Shown in place of "Your chats"/"Published chats" while teamChats is still
// loading (project/[id]/page.tsx's fetchProjectChats effect) — same padding/
// shape as a real ProjectChatRow so there's no layout jump once the rows swap
// in, and no "No chats yet" flash for a project that genuinely has chats.
function TeamChatRowSkeleton({ w }: { w: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ flex: '1 0 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Skeleton width={w} height={14} />
        <Skeleton width="30%" height={12} />
      </div>
    </div>
  )
}

export function teamChatsLoadingRows() {
  return withDividers(['70%', '45%', '58%'].map((w, i) => <TeamChatRowSkeleton key={i} w={w} />))
}
