'use client'

import React from 'react'
import { AlertTwoIcon, CancelCircleIcon, CheckmarkCircleTwoIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'
import styles from './AccountRow.module.css'

/** `reconnect-required` is the only state that changes the row's shape. */
export type AccountRowState = 'connected' | 'reconnect-required'
export type AccountRowVisibility = 'shared' | 'private'
export type AccountRowPermission = 'always' | 'ask' | 'blocked' | 'custom'

export interface AccountRowProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  /** Account label — the name the person gave this connection. */
  name: string
  /** Display name of the person who added this account. */
  addedBy?: string
  /** Only the owner can reconnect; details remain available to everyone. */
  canManage?: boolean
  /** Authorised address, shown beneath the name. */
  email: string
  /** Account visibility, shown as a quiet label. */
  visibility: AccountRowVisibility
  /** The account its app runs through. Only one of a person's can be. */
  inUse?: boolean
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

const PERMISSION_ICON: Record<AccountRowPermission, React.ReactNode> = {
  always: <CheckmarkCircleTwoIcon size={12} />,
  ask: <AlertTwoIcon size={12} />,
  blocked: <CancelCircleIcon size={12} />,
  custom: null,
}

/** Column headings share the responsive grid with each account row. */
export function AccountRowHeader() {
  return (
    <div aria-hidden className={styles.header}>
      <span>Account</span>
      <span>Visibility</span>
      <span>Permissions</span>
      <span>Connected on</span>
      <span />
    </div>
  )
}

AccountRowHeader.displayName = 'AccountRowHeader'

export function AccountRow({
  ref,
  name,
  addedBy,
  canManage = true,
  email,
  visibility,
  inUse = true,
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
      className={cn(styles.row, className)}
      style={style}
      {...props}
    >
      <div className={styles.identity}>
        <span className={styles.name} title={name}>{name}</span>
        {email && <span className={styles.email} title={email}>{email}</span>}
        {addedBy && <span className={styles.email} title={`Added by ${addedBy}`}>Added by {addedBy}</span>}
        {needsReconnect && <span className={styles.warning}>{canManage ? 'Reconnect to restore access' : 'The owner needs to reconnect this account'}</span>}
      </div>
      <div className={styles.visibility} aria-label={`Visibility for ${name}: ${visibility}`}>
        <span className={styles.pill} data-tone={visibility}>
          {visibility === 'shared' ? 'Shared' : 'Private'}
        </span>
        {!inUse && <span className={styles.pill}>Not in use</span>}
      </div>
      <div className={styles.permission}>
        {!needsReconnect && (
          <span className={styles.permissionLabel} data-permission={permission} aria-label={`Permissions for ${name}: ${PERMISSION_LABEL[permission]}`}>
            {PERMISSION_ICON[permission]}
            {PERMISSION_LABEL[permission]}
          </span>
        )}
      </div>
      <div className={styles.date}>
        {connectedOn && <span><span className={styles.mobileDateLabel}>Connected </span>{connectedOn}</span>}
      </div>
      <div className={styles.action}>
        {needsReconnect && canManage ? (
          <Button variant="outline" size="sm" aria-label={`Reconnect ${name}`} onClick={onReconnect}>
            Reconnect
          </Button>
        ) : (
          <Button variant="ghost" size="sm" aria-label={`Manage ${name}`} onClick={onManage}>
            Manage
          </Button>
        )}
      </div>
    </article>
  )
}

AccountRow.displayName = 'AccountRow'
export default AccountRow
