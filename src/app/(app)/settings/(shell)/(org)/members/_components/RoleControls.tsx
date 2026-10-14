'use client'

import React, { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TickTwoIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { ROLE_LABEL } from '@/components/RoleBadge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/Spinner'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { toast } from 'sonner'
import type { OrgMember } from '@/types/teams'
import { SHADOW_REMOVE, SHADOW_REMOVE_INNER, displayRoleFor } from './members-shared'

// ── Remove button (blur-swap animation) ───────────────────────────────────────

const REVEAL = { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const }

export function RemoveButton({
  memberName,
  onConfirm,
  label = 'Remove',
  confirmLabel = 'Confirm remove',
  icon,
}: {
  memberName:    string
  onConfirm:     () => void | Promise<void>
  /** Idle button text (e.g. "Remove" or "Revoke"). */
  label?:        string
  /** Confirmation button text (e.g. "Confirm remove" or "Revoke invite"). */
  confirmLabel?: string
  /** Leading icon for the idle button. Defaults to the remove-user glyph. */
  icon?:         React.ReactNode
}) {
  const [hov,        setHov]        = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [busy,       setBusy]       = React.useState(false)

  const handleConfirmClick = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {!confirming ? (
        <motion.button
          key="remove"
          type="button"
          aria-label={`${label} ${memberName}`}
          onClick={() => setConfirming(true)}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{
            display:         'inline-flex', alignItems: 'center', gap: 2,
            padding:         '5px 8px', borderRadius: 8, border: 'none',
            cursor:          'pointer', position: 'relative', overflow: 'hidden',
            backgroundColor: hov ? 'var(--red-50)' : 'var(--neutral-white)',
            boxShadow:       SHADOW_REMOVE,
            fontFamily:      'var(--font-body)', fontWeight: 500,
            fontSize:        'var(--font-size-body)', color: 'var(--red-500)',
            whiteSpace:      'nowrap', outline: 'none', transition: 'background-color 120ms ease',
          }}
        >
          {icon ?? (
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 7.875a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM1.75 12.25c0-2.071 2.351-3.5 5.25-3.5M10.5 10.5l1.75 1.75M12.25 10.5L10.5 12.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {label}
          <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', boxShadow: SHADOW_REMOVE_INNER }} />
        </motion.button>
      ) : (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: REVEAL }}
          exit={{    opacity: 0, filter: 'blur(4px)', transition: REVEAL }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
        >
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy} style={{ flexShrink: 0 }}>
            Cancel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => void handleConfirmClick()}
            style={{ color: 'var(--red-500)', flexShrink: 0 }}
          >
            {confirmLabel}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Role column — inline dropdown (Figma 23:29029/23:29056: "Member ▾" per
// row, not a modal) ───────────────────────────────────────────────────────────
// Team has no backend route left at all, so a member's role is just the
// org-level owner/admin/member value.

// Single source of truth for role copy — the dropdown's one-line `shortDescription`
// and the "Roles & Permissions" modal's full `description` (further down this
// file) both read from here, so the two can't drift apart on what each role means.
export const ROLES_INFO = [
  {
    role:             'admin'  as const,
    shortDescription: 'Full access, including billing',
    description:      'Full organization control, including billing, payment methods, invoices, subscriptions, and topup credit purchases. Any number of admins per org, all equal.',
  },
  {
    role:             'member' as const,
    shortDescription: 'Access through assigned projects only',
    description:      'Baseline access through assigned projects. Cannot change organization settings or manage other members.',
  },
]

function RoleDropdownTrigger({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             8,
        padding:         '5px 8px',
        borderRadius:    8,
        border:          'none',
        backgroundColor: 'var(--neutral-white)',
        boxShadow:       '0px 1.091px 1.091px 0px rgba(59,54,50,0.05), 0px 1.455px 3.127px 0px rgba(38,33,30,0.15), 0px 0px 0px 1px var(--neutral-100)',
        cursor:          disabled ? 'default' : 'pointer',
        opacity:         disabled ? 0.6 : 1,
        fontFamily:      'var(--font-body)',
        fontWeight:      500,
        fontSize:        14,
        lineHeight:      '22px',
        color:           'var(--neutral-700)',
        whiteSpace:      'nowrap',
      }}
    >
      {label}
      {disabled ? <Spinner size={12} color="var(--neutral-400)" /> : <ArrowDownOneIcon size={12} color="var(--neutral-400)" />}
    </button>
  )
}

// Editable dropdown for a manageable row — selecting "Member" on an Admin
// routes through the same downgrade confirmation the old modal had. Any admin
// can promote/demote any other member — the backend itself is the only real
// gate (rejects dropping the org below one admin).
//
// One client-side exception: the sole remaining admin can't open this for
// their OWN row at all. The backend would reject the write anyway, but
// letting them open the menu, pick "Member", confirm the downgrade modal,
// and only then get bounced by a network error is a worse way to learn the
// same thing — so this is blocked before the menu even opens, with a toast
// explaining why.
export function RoleDropdown({
  member,
  onManageRole,
  lockSelfDemotion = false,
}: {
  member:            OrgMember
  onManageRole:      (id: string, desiredOrgRole: 'admin' | 'member') => Promise<boolean>
  /** True only for the current user's own row when they're the org's only admin. */
  lockSelfDemotion?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirmDowngrade, setConfirmDowngrade] = useState(false)
  const [saving, setSaving] = useState(false)
  const currentRole: 'admin' | 'member' = displayRoleFor(member)
  const memberName = member.name || member.email

  const commit = async (next: 'admin' | 'member') => {
    if (next === currentRole || saving) return
    setSaving(true)
    await onManageRole(member.id, next)
    setSaving(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (next && lockSelfDemotion) {
      toast.info("You're the only admin — promote someone else before changing your own role.")
      return
    }
    setOpen(next)
  }

  return (
    <>
      <DropdownFloat
        open={open}
        onOpenChange={handleOpenChange}
        placement="bottom-start"
        offset={4}
        // Rows sit at arbitrary heights in a member list of any length — the
        // fixed "bottom-start" placement ran the panel off the bottom of the
        // viewport for rows near the end. Flips to open upward when it would.
        autoFlipVertical
        trigger={
          <RoleDropdownTrigger label={ROLE_LABEL[currentRole]} disabled={saving} />
        }
      >
        {/* Wider than a plain label list (AccountMenu's own dropdown panel is
            274px for the same reason) — each option carries a one-line
            description via subLabel, not just its name. Items sit in their
            own 8px-padded wrapper (PillSelect's own dropdown does the same)
            — without it they sit flush against the popover's edges, with
            no matching margin top/bottom/left/right. */}
        <Dropdown style={{ width: 240 }} maxHeight={false}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
            {ROLES_INFO.map(o => (
              <DropdownMenuItem
                key={o.role}
                fluid
                label={ROLE_LABEL[o.role]}
                subLabel={o.shortDescription}
                selected={o.role === currentRole}
                // Trailing, not leading — a leading icon ate into the label/
                // subLabel column's width, truncating "Access through
                // assigned projects only" harder on whichever row was
                // currently selected than on the other, icon-less row.
                rightIcon={o.role === currentRole ? <TickTwoIcon size={14} /> : undefined}
                onClick={() => {
                  setOpen(false)
                  if (currentRole === 'admin' && o.role === 'member') { setConfirmDowngrade(true); return }
                  void commit(o.role)
                }}
              />
            ))}
          </div>
        </Dropdown>
      </DropdownFloat>

      {confirmDowngrade && (
        <ConfirmModal
          title="Remove Admin access?"
          description={
            <>This will demote <strong style={{ color: 'var(--neutral-700)' }}>{memberName}</strong> from Admin to Member, removing their organization-wide access.</>
          }
          confirmLabel="Demote to Member"
          onCancel={() => setConfirmDowngrade(false)}
          onConfirm={() => { setConfirmDowngrade(false); void commit('member') }}
        />
      )}
    </>
  )
}

// Small confirmation dialog — used by RoleDropdown's admin→member downgrade
// and by the Actions column's remove/withdraw confirmations.
function ConfirmModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title:        string
  description:  React.ReactNode
  confirmLabel: string
  onCancel:     () => void
  onConfirm:    () => void
}) {
  // Same mousedown+click double-check as ManageRoleModal's own backdrop — a
  // layout shift between press and release shouldn't be able to misfire this.
  const backdropMouseDown = useRef(false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          400,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: 'color-mix(in srgb, var(--static-black) 35%, transparent)',
      }}
      onMouseDown={(e) => { backdropMouseDown.current = e.target === e.currentTarget }}
      onClick={(e) => {
        if (backdropMouseDown.current && e.target === e.currentTarget) onCancel()
        backdropMouseDown.current = false
      }}
    >
      <div
        style={{
          width:           400,
          maxWidth:        'calc(100vw - 32px)',
          borderRadius:    20,
          backgroundColor: 'var(--modal-bg)',
          border:          '1px solid var(--border-default)',
          boxShadow:       '0px 8px 32px color-mix(in srgb, var(--static-black) 12%, transparent)',
          overflow:        'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 16px' }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 500, fontSize: 20, lineHeight: '28px', color: 'var(--neutral-900)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: '22px', color: 'var(--neutral-500)', margin: '4px 0 0' }}>
            {description}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '20px 24px 24px' }}>
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
