'use client'

import React, { useState } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ArrowDownOneIcon, TickTwoIcon } from '@strange-huge/icons'
import { Dropdown, DropdownFloat } from '@/components/Dropdown'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { Button } from '@/components/Button'
import type { WorkspaceRole } from '@/components/RoleBadge'
import { cn } from '@/lib/utils'

// ── Shadow ────────────────────────────────────────────────────────────────────

const SHADOW_TRIGGER = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

// ── Role labels & descriptions ────────────────────────────────────────────────

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

const ROLE_DESC: Record<WorkspaceRole, string> = {
  admin:  'Manage workspace, members, teams, and connectors — no billing',
  editor: 'Member + can publish personas to Team scope',
  member: 'Can chat, use personas, access team projects',
}

const ALL_ROLES: WorkspaceRole[] = ['admin', 'editor', 'member']

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoleSelectorDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  currentRole:     WorkspaceRole
  /** Subset of roles shown in dropdown. Defaults to all 3. */
  availableRoles?: WorkspaceRole[]
  onRoleChange?:   (role: WorkspaceRole) => void
  disabled?:       boolean
  asChild?: boolean
}

// ── Demote-admin warning ──────────────────────────────────────────────────────

function DemoteWarning({
  pendingRole,
  onConfirm,
  onCancel,
}: {
  pendingRole: WorkspaceRole
  onConfirm:  () => void
  onCancel:   () => void
}) {
  return (
    <div style={{
      position:  'absolute',
      top:       'calc(100% + 6px)',
      left:      0,
      right:     0,
      zIndex:    50,
      borderRadius: 10,
      backgroundColor: 'var(--neutral-white)',
      boxShadow: '0px 4px 16px rgba(0,0,0,0.10), 0px 0px 0px 1px var(--neutral-200)',
      padding:   '12px 14px',
      display:   'flex',
      flexDirection: 'column',
      gap:       10,
    }}>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   'var(--font-size-body)',
        color:      'var(--neutral-900)',
        margin:     0,
      }}>
        Remove admin access?
      </p>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize:   'var(--font-size-caption)',
        color:      'var(--neutral-500)',
        margin:     0,
      }}>
        This will change the role to <strong style={{ color: 'var(--neutral-700)' }}>{ROLE_LABEL[pendingRole]}</strong> and remove workspace administration access.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="danger"    size="sm" onClick={onConfirm}>Confirm</Button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const RoleSelectorDropdown = React.forwardRef<HTMLDivElement, RoleSelectorDropdownProps>(
  function RoleSelectorDropdown(
    {
      currentRole,
      availableRoles = ALL_ROLES,
      onRoleChange,
      disabled = false,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType
    const [open,        setOpen]        = useState(false)
    const [pendingRole, setPendingRole] = useState<WorkspaceRole | null>(null)

    function handleSelect(role: WorkspaceRole) {
      setOpen(false)
      if (currentRole === 'admin' && role !== 'admin') {
        setPendingRole(role)
        return
      }
      onRoleChange?.(role)
    }

    function handleConfirm() {
      if (pendingRole) {
        onRoleChange?.(pendingRole)
        setPendingRole(null)
      }
    }

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}
        {...props}
      >
        {/* Demote warning panel */}
        {pendingRole && (
          <DemoteWarning
            pendingRole={pendingRole}
            onConfirm={handleConfirm}
            onCancel={() => setPendingRole(null)}
          />
        )}

        <DropdownFloat
          open={open && !pendingRole}
          onOpenChange={(v) => { if (!disabled) setOpen(v) }}
          placement="bottom-end"
          offset={4}
          trigger={
            <button
              type="button"
              disabled={disabled}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             6,
                padding:         '5px 10px',
                borderRadius:    8,
                border:          'none',
                backgroundColor: 'var(--neutral-white)',
                boxShadow:       SHADOW_TRIGGER,
                cursor:          disabled ? 'not-allowed' : 'pointer',
                opacity:         disabled ? 0.5 : 1,
                outline:         'none',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 500,
                fontSize:   'var(--font-size-body)',
                color:      'var(--neutral-700)',
              }}>
                {ROLE_LABEL[currentRole]}
              </span>
              <ArrowDownOneIcon size={12} color="var(--neutral-400)" />
            </button>
          }
        >
          <Dropdown style={{ width: 240 }}>
            {availableRoles.map(role => (
              <DropdownMenuItem
                key={role}
                fluid
                label={ROLE_LABEL[role]}
                subLabel={ROLE_DESC[role]}
                selected={role === currentRole}
                icon={role === currentRole ? <TickTwoIcon size={14} /> : undefined}
                onClick={() => handleSelect(role)}
              />
            ))}
          </Dropdown>
        </DropdownFloat>
      </Comp>
    )
  },
)

RoleSelectorDropdown.displayName = 'RoleSelectorDropdown'
export default RoleSelectorDropdown
