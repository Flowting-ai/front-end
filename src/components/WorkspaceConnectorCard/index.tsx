'use client'

import React from 'react'
import type { WorkspaceConnector } from '@/types/teams'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'

export interface WorkspaceConnectorCardProps {
  connector: WorkspaceConnector
  isAdmin:   boolean
  onManage?: () => void
  onRevoke?: () => void
}

const STATUS_CONFIG: Record<WorkspaceConnector['status'], { label: string; color: 'Green' | 'Neutral' | 'Yellow' | 'Red' }> = {
  connected:        { label: 'Connected',     color: 'Green'   },
  not_connected:    { label: 'Not connected', color: 'Neutral' },
  auth_in_progress: { label: 'Connecting…',  color: 'Yellow'  },
  auth_failed:      { label: 'Auth failed',  color: 'Red'     },
}

export function WorkspaceConnectorCard({ connector, isAdmin, onManage, onRevoke }: WorkspaceConnectorCardProps) {
  const statusCfg = STATUS_CONFIG[connector.status]

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      gap:             12,
      padding:         '10px 16px',
      backgroundColor: 'var(--neutral-white)',
      borderRadius:    12,
      boxShadow:       '0px 1px 2px 0px rgba(82,75,71,0.08), 0px 0px 0px 1px var(--neutral-100)',
    }}>
      {/* Icon */}
      <div style={{
        width:           36,
        height:          36,
        borderRadius:    8,
        backgroundColor: 'var(--neutral-100)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
        fontFamily:      'var(--font-body)',
        fontWeight:      600,
        fontSize:        14,
        color:           'var(--neutral-600)',
      }}>
        {connector.name.charAt(0)}
      </div>

      {/* Name + connected-by */}
      <div style={{ flex: '1 0 0', minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   14,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {connector.name}
        </p>
        {connector.connectedBy && (
          <p style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   12,
            lineHeight: '16px',
            color:      'var(--neutral-400)',
            margin:     0,
          }}>
            by {connector.connectedBy}
          </p>
        )}
      </div>

      {/* Status badge */}
      <Badge label={statusCfg.label} color={statusCfg.color} />

      {/* Admin actions */}
      {isAdmin && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {connector.status === 'connected' && onRevoke && (
            <Button variant="danger" size="sm" onClick={onRevoke}>
              Revoke
            </Button>
          )}
          {(connector.status === 'not_connected' || connector.status === 'auth_failed') && onManage && (
            <Button variant="default" size="sm" onClick={onManage}>
              {connector.status === 'auth_failed' ? 'Retry' : 'Connect'}
            </Button>
          )}
          {connector.status === 'connected' && onManage && (
            <Button variant="secondary" size="sm" onClick={onManage}>
              Manage
            </Button>
          )}
          {connector.status === 'auth_in_progress' && (
            <Button variant="secondary" size="sm" disabled>
              Connecting…
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

WorkspaceConnectorCard.displayName = 'WorkspaceConnectorCard'
export default WorkspaceConnectorCard
