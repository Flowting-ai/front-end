'use client'

import React, { useState } from 'react'
import { PlusSignIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SettingsTableCell, SettingsTableRow } from '@/components/SettingsTable'
import { TokenBudgetBar } from '@/components/TokenBudgetBar'
import { AssignCreditsModal } from '@/components/AssignCreditsModal'
import { formatCredits } from '@/lib/format-credits'

export { formatCredits }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreditCapRowProps {
  memberName:  string
  email:       string
  /** Credits consumed this billing period */
  creditUsed:  number
  /** Credits consumed specifically from the assigned workspace allocation. */
  allocationUsed: number
  /** Current cap — undefined means no cap set */
  creditCap?:  number
  /** When true, renders the editable admin input for the cap */
  isAdmin?:    boolean
  /** Owners and admins use the workspace pool directly and cannot receive an allocation. */
  canAssign?:  boolean
  /** Org-wide credits left this billing period — warns the admin inline if a
   *  draft assignment would exceed it. Omit to skip the check. */
  poolRemaining?: number
  /** Fires with the additional credits to assign. */
  onAssignCredits?: (amount: number) => void | Promise<void>
}

export const CREDIT_CAP_COLUMNS = 'minmax(240px, 1fr) 130px 120px 120px 140px'

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 400,
  fontSize:   14,
  lineHeight: '22px',
  color:      'var(--neutral-900)',
  margin:     0,
}

export function CreditCapRow({
  memberName,
  email,
  creditUsed,
  allocationUsed,
  creditCap,
  isAdmin = false,
  canAssign = false,
  poolRemaining,
  onAssignCredits,
}: CreditCapRowProps) {
  const [editing, setEditing] = useState(false)
  const exceeded = canAssign && creditCap != null && allocationUsed > creditCap
  const remaining = canAssign && creditCap != null ? Math.max(creditCap - allocationUsed, 0) : null
  const hasCap = canAssign && creditCap != null

  return (
    <SettingsTableRow
      minHeight={72}
      style={{ backgroundColor: exceeded ? 'var(--color-tag-Red-bg)' : undefined }}
    >
      <SettingsTableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, width: '100%' }}>
          <Avatar name={memberName} size="md" />
          <div style={{ minWidth: 0, flex: '1 0 0' }}>
            <p style={{
              ...valueStyle,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {memberName}
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize:   11,
              lineHeight: '16px',
              color:      'var(--neutral-500)',
              margin:     0,
              overflow:   'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {email}
            </p>
            {/* Visual read on how close this member is to their cap — only
                meaningful when a cap actually exists to measure against. */}
            {hasCap && (
              <div style={{ marginTop: 6, maxWidth: 180 }}>
                <TokenBudgetBar used={allocationUsed} limit={creditCap} size="sm" />
              </div>
            )}
          </div>
        </div>
      </SettingsTableCell>

      <SettingsTableCell align="center">
        <p style={{
          ...valueStyle,
          color: valueStyle.color,
        }}>
          {formatCredits(creditUsed)}
        </p>
      </SettingsTableCell>

      <SettingsTableCell align="center">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p style={{
            ...valueStyle,
            color: exceeded
              ? 'var(--color-tag-Red-text)'
              : remaining != null
                ? valueStyle.color
                : 'var(--neutral-300)',
          }}>
            {remaining != null ? formatCredits(remaining) : canAssign ? 'No limit' : '-'}
          </p>
          {/* The red row background alone isn't accessible (color-only, no
              text) — this makes the over-cap state explicit for everyone,
              including screen readers and colorblind users. */}
          {exceeded && (
            <>
              <Badge label="Over cap" color="Red" />
              <span className="sr-only">
                {memberName} has exceeded their assigned credit cap.
              </span>
            </>
          )}
        </div>
      </SettingsTableCell>

      <SettingsTableCell align="center">
        <p style={{ ...valueStyle, color: canAssign && creditCap != null ? valueStyle.color : 'var(--neutral-300)' }}>
          {canAssign ? (creditCap != null ? formatCredits(creditCap) : 'No limit') : '-'}
        </p>
      </SettingsTableCell>

      <SettingsTableCell align="center">
        {isAdmin && canAssign ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<PlusSignIcon size={16} />}
              onClick={() => setEditing(true)}
            >
              {creditCap != null ? 'Add credits' : 'Set cap'}
            </Button>
            <AssignCreditsModal
              open={editing}
              memberName={memberName}
              currentCap={creditCap}
              poolRemaining={poolRemaining}
              onAssign={(amount) => onAssignCredits?.(amount)}
              onClose={() => setEditing(false)}
            />
          </>
        ) : (
          <span style={{ ...valueStyle, color: 'var(--neutral-300)' }}>-</span>
        )}
      </SettingsTableCell>
    </SettingsTableRow>
  )
}

export default CreditCapRow
