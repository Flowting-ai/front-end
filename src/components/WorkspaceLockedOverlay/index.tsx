'use client'

import React from 'react'

export interface WorkspaceLockedOverlayProps {
  isAdmin?: boolean
  onAdminAction?: () => void
}

export function WorkspaceLockedOverlay({ isAdmin, onAdminAction }: WorkspaceLockedOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workspace locked"
      style={{
        position:             'absolute',
        inset:                0,
        zIndex:               50,
        display:              'flex',
        alignItems:           'center',
        justifyContent:       'center',
        backgroundColor:      'rgba(250, 248, 245, 0.88)',
        backdropFilter:       'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        borderRadius:         'inherit',
      }}
    >
      <div
        style={{
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          gap:             12,
          padding:         '32px 40px',
          borderRadius:    20,
          backgroundColor: 'var(--neutral-white)',
          border:          '1px solid var(--neutral-200)',
          boxShadow:       '0px 4px 20px rgba(0,0,0,0.08)',
          maxWidth:        360,
          textAlign:       'center' as const,
        }}
      >
        <span
          style={{
            width:           40,
            height:          40,
            borderRadius:    '50%',
            backgroundColor: 'var(--color-tag-Red-bg)',
            border:          '1px solid var(--color-tag-Red-ring)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
          aria-hidden
        >
          <span style={{
            width:           14,
            height:          14,
            borderRadius:    '50%',
            backgroundColor: 'var(--color-tag-Red-text)',
          }} />
        </span>

        <div>
          <p style={{
            fontFamily: 'var(--font-title)',
            fontWeight: 500,
            fontSize:   18,
            lineHeight: '26px',
            color:      'var(--neutral-900)',
            margin:     0,
          }}>
            Workspace locked
          </p>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            lineHeight: '22px',
            color:      'var(--neutral-500)',
            margin:     '4px 0 0',
          }}>
            {isAdmin
              ? 'Credits are exhausted. Add credits to restore access for your team.'
              : 'Your workspace has run out of credits. Contact your admin to restore access.'}
          </p>
        </div>

        {isAdmin && onAdminAction && (
          <button
            type="button"
            onClick={onAdminAction}
            style={{
              height:          36,
              padding:         '0 20px',
              borderRadius:    8,
              border:          'none',
              backgroundColor: 'var(--neutral-900)',
              color:           'var(--neutral-white)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        14,
              cursor:          'pointer',
            }}
          >
            Add credits
          </button>
        )}
      </div>
    </div>
  )
}

WorkspaceLockedOverlay.displayName = 'WorkspaceLockedOverlay'
export default WorkspaceLockedOverlay
