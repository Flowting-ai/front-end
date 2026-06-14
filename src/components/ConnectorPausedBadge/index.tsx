'use client'

import React from 'react'

export interface ConnectorPausedBadgeProps {
  /** Why the connector is paused — affects the label shown. */
  reason?: 'plan' | 'workspace_locked'
}

export function ConnectorPausedBadge({ reason = 'plan' }: ConnectorPausedBadgeProps) {
  const label = reason === 'workspace_locked' ? 'Workspace locked' : 'Upgrade to enable'

  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        padding:         '2px 8px',
        borderRadius:    999,
        backgroundColor: 'var(--color-tag-Yellow-bg)',
        border:          '1px solid var(--color-tag-Yellow-ring)',
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        11,
        lineHeight:      '16px',
        color:           'var(--color-tag-Yellow-text)',
        whiteSpace:      'nowrap' as const,
        flexShrink:      0,
      }}
    >
      {label}
    </span>
  )
}

ConnectorPausedBadge.displayName = 'ConnectorPausedBadge'
export default ConnectorPausedBadge
