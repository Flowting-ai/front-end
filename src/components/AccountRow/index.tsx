'use client'

import React from 'react'
import { AlertTwoIcon, CancelCircleIcon, CheckmarkCircleTwoIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
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
  /** Drives the badge beside the name: Shared is Blue, Private is Green. */
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
}

const PERMISSION_LABEL: Record<AccountRowPermission, string> = {
  always: 'Always allow',
  ask: 'Ask before use',
  blocked: 'Blocked',
  custom: 'Custom',
}

const PERMISSION_ICON: Record<AccountRowPermission, React.ReactElement> = {
  always: <CheckmarkCircleTwoIcon size={16} />,
  ask: <AlertTwoIcon size={16} />,
  blocked: <CancelCircleIcon size={16} />,
  custom: <AlertTwoIcon size={16} />,
}

export function AccountRow({
  ref,
  name,
  email,
  visibility,
  state = 'connected',
  permission = 'custom',
  onManage,
  onReconnect,
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
        boxSizing: 'border-box',
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 20px',
        flexWrap: 'wrap',
        fontFamily: 'var(--font-body)',
        ...style,
      }}
      {...props}
    >
      <div style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              color: 'var(--neutral-900)',
              fontSize: 'var(--font-size-body)',
              fontWeight: 'var(--font-weight-medium)',
              lineHeight: 'var(--line-height-body)',
            }}
          >
            {name}
          </span>
          <Badge
            label={visibility === 'shared' ? 'Shared' : 'Private'}
            color={visibility === 'shared' ? 'Blue' : 'Green'}
          />
        </div>
        <span
          style={{
            maxWidth: '100%',
            overflow: 'hidden',
            color: 'var(--color-text-placeholder)',
            fontSize: 'var(--font-size-caption)',
            fontWeight: 'var(--font-weight-regular)',
            lineHeight: 'var(--line-height-caption)',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email}
        </span>
      </div>

      <div style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', gap: 8 }}>
        {needsReconnect ? (
          /* No permission control here: the account cannot act until it is
             reauthorised, so a permission choice would be a setting with no effect. */
          <Button size="sm" aria-label={`Reconnect ${name}`} onClick={onReconnect}>
            Reconnect
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              leftIcon={PERMISSION_ICON[permission]}
              aria-label={`Permissions for ${name}: ${PERMISSION_LABEL[permission]}`}
            >
              {PERMISSION_LABEL[permission]}
            </Button>
            <Button variant="outline" size="sm" aria-label={`Manage ${name}`} onClick={onManage}>
              Manage
            </Button>
          </>
        )}
      </div>
    </article>
  )
}

AccountRow.displayName = 'AccountRow'
export default AccountRow
