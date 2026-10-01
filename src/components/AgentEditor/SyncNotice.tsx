'use client'

import React from 'react'
import { Button } from '@/components/Button'
import type { SyncNotice as SyncNoticeKind } from '@/lib/agent-sync'

export interface SyncNoticeProps {
  notice:    SyncNoticeKind
  onLoadLatest: () => void
  onDismiss:    () => void
}

/**
 * Shown when the agent was saved from another view or tab: a quiet "Updated" note
 * when this view was clean, or a choice when the user has unsaved edits.
 */
export function SyncNotice({ notice, onLoadLatest, onDismiss }: SyncNoticeProps) {
  if (!notice) return null
  const conflict = notice === 'conflict'
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 10,
        backgroundColor: conflict ? 'var(--color-tag-Yellow-bg, #fdf3d6)' : 'var(--blue-50, #eef4fb)',
        boxShadow: '0px 0px 0px 1px var(--neutral-100)',
        fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-800)',
      }}
    >
      <span>
        {conflict
          ? 'This agent was updated elsewhere. Your unsaved edits are still here.'
          : 'Updated — this agent was changed elsewhere and is now up to date.'}
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        {conflict && <Button type="button" variant="outline" size="sm" onClick={onLoadLatest}>Load latest</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>{conflict ? 'Keep mine' : 'Dismiss'}</Button>
      </span>
    </div>
  )
}
