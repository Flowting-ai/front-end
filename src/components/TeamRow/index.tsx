'use client'

import React from 'react'
import type { Team } from '@/types/teams'

export interface TeamRowProps {
  team:       Team
  isAdmin:    boolean
  onRecover?: () => void
}

export function TeamRow({ team, isAdmin, onRecover }: TeamRowProps) {
  const isArchived = team.archived

  return (
    <div style={{
      display:    'flex',
      alignItems: 'center',
      gap:        12,
      padding:    '10px 16px',
    }}>
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{
            fontFamily:   'var(--font-body)',
            fontWeight:   500,
            fontSize:     14,
            lineHeight:   '22px',
            color:        isArchived ? 'var(--neutral-400)' : 'var(--neutral-900)',
            margin:       0,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {team.name}
          </p>
          {isArchived && (
            <span style={{
              display:         'inline-flex',
              alignItems:      'center',
              padding:         '1px 6px',
              borderRadius:    4,
              backgroundColor: 'var(--yellow-100)',
              boxShadow:       '0px 0px 0px 1px var(--yellow-300)',
              fontFamily:      'var(--font-body)',
              fontWeight:      500,
              fontSize:        11,
              lineHeight:      '16px',
              color:           'var(--yellow-700)',
              flexShrink:      0,
            }}>
              Archived
            </span>
          )}
        </div>

        {team.description && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   12,
            lineHeight: '16px',
            color:      'var(--neutral-400)',
            margin:     0,
          }}>
            {team.description}
          </p>
        )}
      </div>

      {isArchived && isAdmin && (
        <button
          onClick={onRecover}
          style={{
            display:         'inline-flex',
            alignItems:      'center',
            justifyContent:  'center',
            padding:         '4px 10px',
            borderRadius:    8,
            border:          'none',
            cursor:          'pointer',
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       '0px 0px 0px 1px var(--neutral-200)',
            fontFamily:      'var(--font-body)',
            fontWeight:      400,
            fontSize:        12,
            lineHeight:      '16px',
            color:           'var(--neutral-700)',
            flexShrink:      0,
          }}
        >
          Recover
        </button>
      )}
    </div>
  )
}

TeamRow.displayName = 'TeamRow'
export default TeamRow
