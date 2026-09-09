'use client'

import React from 'react'
import { AlertTwoIcon, CancelCircleIcon, CheckmarkCircleTwoIcon } from '@strange-huge/icons'
import { Badge, type BadgeColor } from '@/components/Badge'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

/** `reconnect-required` is the only state that changes the row's shape. */
export type AccountRowState = 'connected' | 'reconnect-required'
export type AccountRowVisibility = 'shared' | 'private'
export type AccountRowPermission = 'always' | 'ask' | 'blocked' | 'custom'

export interface AccountRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Account label — the name the person gave this connection. */
  name: string
  /** Authorised address, shown beneath the name. */
  email: string
  /** Drives the badge in the Type column: Shared is Blue, Private is Green. */
  visibility: AccountRowVisibility
  /** @default 'connected' */
  state?: AccountRowState
  /**
   * Permission summary shown on a connected row. Omit for `custom`, which is what a
   * group reports when its tools disagree. Ignored on a `reconnect-required` row.
   */
  permission?: AccountRowPermission
  /** Connected rows only. */
  onManage?: () => void
  /** `reconnect-required` rows only. */
  onReconnect?: () => void
  /** Pre-formatted date this account was first connected, e.g. "March 2, 2026". Omit to hide. */
  connectedOn?: string
}

const PERMISSION_LABEL: Record<AccountRowPermission, string> = {
  always: 'Always allow',
  ask: 'Ask before use',
  blocked: 'Blocked',
  custom: 'Custom',
}

const PERMISSION_ICON: Record<AccountRowPermission, React.ReactElement> = {
  always: <CheckmarkCircleTwoIcon size={12} />,
  ask: <AlertTwoIcon size={12} />,
  blocked: <CancelCircleIcon size={12} />,
  custom: <AlertTwoIcon size={12} />,
}

const PERMISSION_COLOR: Record<AccountRowPermission, BadgeColor> = {
  always: 'Green',
  ask: 'Yellow',
  blocked: 'Red',
  custom: 'Neutral',
}

// Shared between AccountRowHeader and AccountRow so the tiny column labels
// stay aligned with the values underneath them.
const ROW_GRID_COLUMNS = 'minmax(0, 1fr) 96px 152px 132px 112px'

const columnLabelStyle: React.CSSProperties = {
  margin:     0,
  color:      'var(--neutral-400)',
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  fontWeight: 'var(--font-weight-medium)',
  lineHeight: 'var(--line-height-caption)',
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
}

/** Tiny column headers — Name / Type / Permissions — rendered once above a
 *  group of AccountRows, not per row. */
export function AccountRowHeader() {
  return (
    <div
      aria-hidden
      style={{
        display:              'grid',
        gridTemplateColumns:  ROW_GRID_COLUMNS,
        alignItems:           'center',
        gap:                  12,
        padding:              '0 20px 6px',
      }}
    >
      <p style={columnLabelStyle}>Name</p>
      <p style={columnLabelStyle}>Type</p>
      <p style={columnLabelStyle}>Permissions</p>
      <p style={columnLabelStyle}>Connected on</p>
      <span />
    </div>
  )
}

AccountRowHeader.displayName = 'AccountRowHeader'

export function AccountRow({
  ref,
  name,
  email,
  visibility,
  state = 'connected',
  permission = 'custom',
  onManage,
  onReconnect,
  connectedOn,
  className,
  style,
  ...props
}: AccountRowProps & { ref?: React.Ref<HTMLElement> }) {
  const needsReconnect = state === 'reconnect-required'

  return (
    <article
      ref={ref}
      className={cn(className)}
      style={{
        boxSizing:           'border-box',
        display:             'grid',
        gridTemplateColumns: ROW_GRID_COLUMNS,
        width:               '100%',
        alignItems:          'center',
        gap:                 12,
        padding:             '12px 20px',
        fontFamily:          'var(--font-body)',
        ...style,
      }}
      {...props}
    >
      {/* Name */}
      <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            color:        'var(--neutral-900)',
            fontSize:     'var(--font-size-body-lg)',
            fontWeight:   'var(--font-weight-medium)',
            lineHeight:   'var(--line-height-body-lg)',
          }}
        >
          {name}
        </span>
        <span
          style={{
            maxWidth:     '100%',
            overflow:     'hidden',
            color:        'var(--color-text-placeholder)',
            fontSize:     'var(--font-size-caption)',
            fontWeight:   'var(--font-weight-regular)',
            lineHeight:   'var(--line-height-caption)',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {email}
        </span>
      </div>

      {/* Type */}
      <div>
        <Badge
          label={visibility === 'shared' ? 'Shared' : 'Private'}
          color={visibility === 'shared' ? 'Blue' : 'Green'}
        />
      </div>

      {/* Permissions */}
      <div>
        {!needsReconnect && (
          <Badge
            label={PERMISSION_LABEL[permission]}
            color={PERMISSION_COLOR[permission]}
            icon={PERMISSION_ICON[permission]}
            aria-label={`Permissions for ${name}: ${PERMISSION_LABEL[permission]}`}
          />
        )}
      </div>

      {/* Connected on */}
      <div>
        {connectedOn && (
          <span
            style={{
              whiteSpace: 'nowrap',
              color:      'var(--neutral-500)',
              fontSize:   'var(--font-size-caption)',
              fontWeight: 'var(--font-weight-regular)',
              lineHeight: 'var(--line-height-caption)',
            }}
          >
            {connectedOn}
          </span>
        )}
      </div>

      {/* Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {needsReconnect ? (
          /* No permission control here: the account cannot act until it is
             reauthorised, so a permission choice would be a setting with no effect. */
          <Button size="sm" aria-label={`Reconnect ${name}`} onClick={onReconnect}>
            Reconnect
          </Button>
        ) : (
          <Button variant="outline" size="sm" aria-label={`Manage ${name}`} onClick={onManage}>
            Manage
          </Button>
        )}
      </div>
    </article>
  )
}

AccountRow.displayName = 'AccountRow'
export default AccountRow
