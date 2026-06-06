'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { motion } from 'framer-motion'
import { Button } from '@/components/Button'
import { ConnectorStatusBadge } from '@/components/ConnectorStatusBadge'
import { springs } from '@/lib/springs'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_CARD  = '0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_INNER = 'inset 0px 1px 0px 0px rgba(247,242,237,0.5), inset 0px -1px 0px 0px rgba(82,75,71,0.05)'
const SHADOW_ICON  = '0px 0px 0px 1px var(--neutral-100)'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectorRequestStatus = 'pending' | 'not-available'

export interface ConnectorRequestRowProps extends React.HTMLAttributes<HTMLDivElement> {
  connectorName:  string
  iconUrl?:       string
  iconAlt?:       string
  status:         ConnectorRequestStatus
  /**
   * "From your team" rows: who requested + upvote count + reason quote.
   * "Your accounts" rows: who requested + their reason.
   */
  requestedBy:    string
  requestedAgo?:  string
  upvotedByCount?: number
  reason?:        string
  /** "Approve & connect" — fires for admin pending rows */
  onApprove?:     () => void
  /** "Decline" — fires for admin pending rows */
  onDecline?:     () => void
  /** "Dismiss" — fires for not-available rows */
  onDismiss?:     () => void
  /** "Request from Souvenir →" — fires for not-available rows */
  onRequestFromSouvenir?: () => void
  asChild?: boolean
}

// ── Connector icon ────────────────────────────────────────────────────────────

function ConnectorIcon({ iconUrl, iconAlt, name }: { iconUrl?: string; iconAlt?: string; name: string }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'var(--neutral-white)', boxShadow: SHADOW_ICON, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {iconUrl ? (
        <img src={iconUrl} alt={iconAlt ?? name} style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 12, color: 'var(--neutral-500)' }}>{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ConnectorRequestRow = React.forwardRef<HTMLDivElement, ConnectorRequestRowProps>(
  function ConnectorRequestRow(
    {
      connectorName, iconUrl, iconAlt, status,
      requestedBy, requestedAgo, upvotedByCount, reason,
      onApprove, onDecline, onDismiss, onRequestFromSouvenir,
      asChild = false, className, style, ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: springs.moderate }}
      >
        <Comp
          ref={ref}
          className={cn(className)}
          style={{
            position:        'relative',
            display:         'flex',
            alignItems:      'flex-start',
            gap:             12,
            padding:         '12px 14px',
            borderRadius:    12,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_CARD,
            ...style,
          }}
          {...props}
        >
          {/* Inner shadow overlay */}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_INNER, zIndex: 1 }} />

          {/* Icon */}
          <ConnectorIcon iconUrl={iconUrl} iconAlt={iconAlt} name={connectorName} />

          {/* Main content */}
          <div style={{ flex: '1 0 0', minWidth: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Name + status badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', color: 'var(--neutral-900)' }}>
                {connectorName}
              </span>
              <ConnectorStatusBadge status={status} />
            </div>

            {/* Requested by + upvote count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>
                Requested by <strong style={{ color: 'var(--neutral-700)' }}>{requestedBy}</strong>
                {requestedAgo && <span style={{ color: 'var(--neutral-400)' }}> · {requestedAgo}</span>}
              </span>
              {upvotedByCount != null && upvotedByCount > 0 && (
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-500)' }}>
                  — also upvoted by{' '}
                  <span style={{ fontWeight: 500, color: 'var(--neutral-700)' }}>{upvotedByCount} others</span>
                </span>
              )}
            </div>

            {/* Reason quote */}
            {reason && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', margin: 0, fontStyle: 'italic' }}>
                "{reason}"
              </p>
            )}
          </div>

          {/* Actions — right aligned */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, alignSelf: 'center' }}>
            {status === 'pending' && (
              <>
                <Button variant="outline" size="sm" onClick={onDecline}>Decline</Button>
                <Button variant="default" size="sm" onClick={onApprove}>Approve &amp; connect</Button>
              </>
            )}
            {status === 'not-available' && (
              <>
                <Button variant="outline" size="sm" onClick={onDismiss}>Dismiss</Button>
                <Button variant="default" size="sm" onClick={onRequestFromSouvenir}>Request from Souvenir →</Button>
              </>
            )}
          </div>
        </Comp>
      </motion.div>
    )
  },
)

ConnectorRequestRow.displayName = 'ConnectorRequestRow'
export default ConnectorRequestRow
