'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { CancelOneIcon, ArrowDownOneIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Popover } from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { cn } from '@/lib/utils'
import type { WorkspaceRole } from '@/types/teams'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_MODAL   = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_INPUT   = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_TRIGGER = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-200)'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InviteModalProps extends React.HTMLAttributes<HTMLDivElement> {
  workspaceName?: string
  loading?: boolean
  disabled?: boolean
  onClose?: () => void
  onInvite?: (params: { email: string; role: WorkspaceRole }) => void
  asChild?: boolean
}

// Cannot invite directly as Admin
const ROLE_OPTIONS: WorkspaceRole[] = ['member', 'editor']

const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  member: 'Can chat, use personas, access team projects',
  editor: 'Member + can publish personas to Team scope',
  admin:  'Full access including billing and settings',
}

// ── Role selector dropdown ────────────────────────────────────────────────────

function RoleSelector({ value, onChange }: { value: WorkspaceRole; onChange: (r: WorkspaceRole) => void }) {
  const [open,    setOpen]    = useState(false)
  const [hovered, setHovered] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', h, { capture: true })
    return () => document.removeEventListener('mousedown', h, { capture: true })
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display:         'flex',
          alignItems:      'center',
          gap:             6,
          padding:         '6px 10px',
          borderRadius:    8,
          border:          'none',
          backgroundColor: hovered ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       SHADOW_TRIGGER,
          cursor:          'pointer',
          outline:         'none',
          transition:      'background-color 120ms ease',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   'var(--font-size-body)',
          color:      'var(--neutral-700)',
          whiteSpace: 'nowrap',
        }}>
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
        <ArrowDownOneIcon size={11} color="var(--neutral-400)" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="role-panel"
            initial={{ opacity: 0, scaleY: 0.8, transformOrigin: 'top center' }}
            animate={{ opacity: 1, scaleY: 1, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, scaleY: 0.85, transition: { duration: 0.08 } }}
            style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100, minWidth: 220 }}
          >
            <Popover
              ref={panelRef}
              variant="dropdown"
              maxHeight={false}
              role="menu"
              aria-label="Select role"
              style={{ padding: 4 }}
            >
              {ROLE_OPTIONS.map(role => (
                <DropdownMenuItem
                  key={role}
                  fluid
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                  subLabel={ROLE_DESCRIPTIONS[role]}
                  selected={value === role}
                  onClick={() => { onChange(role); setOpen(false) }}
                />
              ))}
            </Popover>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Close button ──────────────────────────────────────────────────────────────

function CloseButton({ onClick }: { onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label="Close"
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         3,
        borderRadius:    6,
        border:          'none',
        backgroundColor: hovered ? 'var(--neutral-100)' : 'transparent',
        cursor:          'pointer',
        color:           hovered ? 'var(--neutral-700)' : 'var(--neutral-500)',
        flexShrink:      0,
        lineHeight:      0,
        outline:         'none',
        boxShadow:       focused ? '0px 0px 0px 2px var(--blue-400)' : 'none',
        transition:      'background-color 120ms, color 120ms',
      }}
    >
      <CancelOneIcon size={18} />
    </button>
  )
}

// ── InviteModal — self-contained card ─────────────────────────────────────────

export const InviteModal = React.forwardRef<HTMLDivElement, InviteModalProps>(
  function InviteModal(
    { workspaceName, loading = false, disabled = false, onClose, onInvite, asChild = false, className, style, ...props },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    const inputRef = useRef<HTMLInputElement>(null)
    const [email, setEmail] = useState('')
    const [role,  setRole]  = useState<WorkspaceRole>('member')

    useEffect(() => { inputRef.current?.focus() }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') { onClose?.(); return }
      if (e.key !== 'Tab') return
      const modal = e.currentTarget
      const els = Array.from(
        modal.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex="0"]'),
      )
      if (els.length < 2) return
      const first = els[0]!
      const last  = els[els.length - 1]!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }, [onClose])

    const handleSubmit = useCallback(() => {
      const trimmed = email.trim()
      if (!trimmed || loading) return
      onInvite?.({ email: trimmed, role })
      setEmail('')
    }, [email, loading, onInvite, role])

    const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
    }, [handleSubmit])

    return (
      <Comp
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={workspaceName ? `Invite to ${workspaceName}` : 'Invite member'}
        className={cn(className)}
        onKeyDown={handleKeyDown}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
          width:           480,
          padding:         '16px 14px',
          borderRadius:    18,
          boxSizing:       'border-box' as const,
          backgroundColor: 'var(--neutral-white)',
          boxShadow:       SHADOW_MODAL,
          opacity:         disabled ? 0.5 : 1,
          pointerEvents:   disabled ? 'none' : undefined,
          ...style,
        }}
        {...props}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--font-title)',
            fontSize:   'var(--font-size-heading)',
            fontWeight: 400,
            lineHeight: 'var(--line-height-heading)',
            color:      'var(--neutral-900)',
            flex:       '1 0 0',
            minWidth:   0,
          }}>
            {workspaceName ? `Invite to ${workspaceName}` : 'Invite member'}
          </span>
          <CloseButton onClick={onClose} />
        </div>

        {/* Email input + role selector */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            display:         'flex',
            alignItems:      'center',
            flex:            '1 0 0',
            padding:         '7px 10px',
            borderRadius:    10,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_INPUT,
            boxSizing:       'border-box' as const,
          }}>
            <input
              ref={inputRef}
              type="email"
              aria-label="Email address"
              placeholder="colleague@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
              style={{
                flex:       1,
                border:     'none',
                outline:    'none',
                background: 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 400,
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-900)',
                minWidth:   0,
              }}
            />
          </div>
          <RoleSelector value={role} onChange={setRole} />
        </div>

        {/* Role description hint */}
        <p style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 400,
          fontSize:   'var(--font-size-caption)',
          lineHeight: 'var(--line-height-caption)',
          color:      'var(--neutral-400)',
          margin:     0,
        }}>
          {ROLE_DESCRIPTIONS[role]}
        </p>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="default"
            size="sm"
            loading={loading}
            disabled={!email.trim()}
            onClick={handleSubmit}
          >
            Send invite
          </Button>
        </div>
      </Comp>
    )
  },
)

InviteModal.displayName = 'InviteModal'

// ── AppInviteModal — Dialog wrapper for backward compatibility ─────────────────
// Used in settings/org/teams/[teamId]/page.tsx with onInvite(email, role) API.

export interface AppInviteModalProps {
  isOpen:         boolean
  onClose:        () => void
  onInvite:       (email: string, role: WorkspaceRole) => void
  workspaceName?: string
  loading?:       boolean
}

export function AppInviteModal({ isOpen, onClose, onInvite, workspaceName, loading }: AppInviteModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(18,12,8,0.52)',
            zIndex:          100,
          }}
        />
        <Dialog.Content
          aria-label={workspaceName ? `Invite to ${workspaceName}` : 'Invite member'}
          style={{
            position:  'fixed',
            top:       '50%',
            left:      '50%',
            transform: 'translate(-50%, -50%)',
            zIndex:    101,
            outline:   'none',
          }}
        >
          <InviteModal
            workspaceName={workspaceName}
            loading={loading}
            onClose={onClose}
            onInvite={({ email, role }) => onInvite(email, role)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
