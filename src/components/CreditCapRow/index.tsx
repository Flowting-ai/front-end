'use client'

import React, { useState } from 'react'
import { CancelOneIcon, PlusSignIcon, TickTwoIcon } from '@strange-huge/icons'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { SettingsTableCell, SettingsTableRow } from '@/components/SettingsTable'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_INPUT = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'
const SHADOW_INPUT_FOCUS = '0px 0px 0px 1.5px var(--neutral-500)'

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
  /** Fires with the additional credits to assign. */
  onAssignCredits?: (amount: number) => void | Promise<void>
}

const CREDIT_FORMATTER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

function formatCredits(value: number | null | undefined): string {
  return CREDIT_FORMATTER.format(Number.isFinite(value) ? value ?? 0 : 0)
}

export const CREDIT_CAP_COLUMNS = 'minmax(240px, 1fr) 130px 120px 120px 140px'

function CapInput({
  onAssign,
  onDone,
}: {
  onAssign: (amount: number) => void | Promise<void>
  onDone: () => void
}) {
  const [focused, setFocused] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  async function commit() {
    const n = parseInt(draft, 10)
    if (!draft.trim() || isNaN(n) || n <= 0) return
    setSaving(true)
    try {
      await onAssign(n)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{
        display:         'flex',
        alignItems:      'center',
        height:          32,
        width:           96,
        borderRadius:    8,
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       focused ? SHADOW_INPUT_FOCUS : SHADOW_INPUT,
        opacity:         saving ? 0.6 : 1,
        transition:      'box-shadow 120ms, opacity 120ms',
        flexShrink:      0,
      }}>
        <input
          type="number"
          min={1}
          value={draft}
          placeholder="Credits"
          autoFocus
          disabled={saving}
          aria-label="Credits to assign"
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') onDone()
          }}
          style={{
            width:      '100%',
            minWidth:   0,
            padding:    '0 10px',
            border:     'none',
            outline:    'none',
            background: 'transparent',
            fontFamily: 'var(--font-body)',
            fontWeight: 400,
            fontSize:   14,
            color:      'var(--neutral-700)',
            MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'],
          }}
        />
      </div>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Assign credits"
        loading={saving}
        icon={<TickTwoIcon size={16} color="var(--green-600)" />}
        onClick={() => { void commit() }}
      />
      <IconButton
        variant="ghost"
        size="sm"
        aria-label="Cancel"
        disabled={saving}
        icon={<CancelOneIcon size={16} color="var(--neutral-400)" />}
        onClick={onDone}
      />
    </div>
  )
}

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
  onAssignCredits,
}: CreditCapRowProps) {
  const [editing, setEditing] = useState(false)
  const exceeded = canAssign && creditCap != null && allocationUsed > creditCap
  const remaining = canAssign && creditCap != null ? Math.max(creditCap - allocationUsed, 0) : null

  return (
    <SettingsTableRow
      minHeight={72}
      style={{ backgroundColor: exceeded ? 'var(--color-tag-Red-bg)' : undefined }}
    >
      <SettingsTableCell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar name={memberName} size="md" />
          <div style={{ minWidth: 0 }}>
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
        <p style={{ ...valueStyle, color: canAssign && creditCap != null ? valueStyle.color : 'var(--neutral-300)' }}>
          {canAssign ? (creditCap != null ? formatCredits(creditCap) : 'No limit') : '-'}
        </p>
      </SettingsTableCell>

      <SettingsTableCell align="center">
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
      </SettingsTableCell>

      <SettingsTableCell align="center">
        {isAdmin && canAssign ? (
          editing ? (
            <CapInput
              onAssign={onAssignCredits ?? (() => {})}
              onDone={() => setEditing(false)}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<PlusSignIcon size={16} />}
              onClick={() => setEditing(true)}
            >
              Assign
            </Button>
          )
        ) : (
          <span style={{ ...valueStyle, color: 'var(--neutral-300)' }}>-</span>
        )}
      </SettingsTableCell>
    </SettingsTableRow>
  )
}

export default CreditCapRow
