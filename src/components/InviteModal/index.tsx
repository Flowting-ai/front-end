'use client'

import { Tooltip } from '@/components/Tooltip'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useFocusReturn } from '@/components/ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Slot } from '@radix-ui/react-slot'
import { CancelOneIcon, ArrowDownOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/Dropdown'
import { cn } from '@/lib/utils'
import type { WorkspaceRole } from '@/types/teams'

// ── Shadows ───────────────────────────────────────────────────────────────────
const SHADOW_MODAL   = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_INPUT   = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

const SECTION_LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 500,
  fontSize:   13,
  lineHeight: '18px',
  color:      'var(--neutral-600)',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InviteResult {
  succeeded: string[]
  failed: { email: string; reason: string }[]
}

export interface InviteModalProps extends React.HTMLAttributes<HTMLDivElement> {
  workspaceName?: string
  loading?: boolean
  disabled?: boolean
  /** Emails already in the workspace (members + pending invites). Compared
   *  case-insensitively so a chip is flagged the instant it's typed, instead
   *  of only after a round trip to the backend. */
  existingEmails?: string[]
  /** When set, restricts (and hints at) which email domains can be invited. */
  allowedDomains?: string[]
  onClose?: () => void
  onInvite?: (params: {
    emails: string[]
    role: WorkspaceRole
  }) => Promise<InviteResult> | InviteResult
  asChild?: boolean
}

const ROLE_OPTIONS: WorkspaceRole[] = ['member', 'admin']

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  member: 'Member',
}

// ── Info note — boxed hint text, matching ManageRoleModal's InfoNote ────────

function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', backgroundColor: 'var(--neutral-100)', borderRadius: 10 }}>
      <InformationCircleIcon size={16} color="var(--neutral-500)" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 13, lineHeight: '18px', color: 'var(--neutral-700)', margin: 0 }}>
        {children}
      </p>
    </div>
  )
}

// ── Email chips ───────────────────────────────────────────────────────────────

type ChipStatus = 'pending' | 'invalid' | 'error'

interface EmailChip {
  value:  string
  status: ChipStatus
  reason?: string
}

function EmailChipPill({ chip, onRemove }: { chip: EmailChip; onRemove: () => void }) {
  const isBad = chip.status !== 'pending'
  return (
    <Tooltip content={chip.reason} disabled={!chip.reason} maxWidth={280}><span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             4,
        maxWidth:        240,
        padding:         '4px 6px 4px 8px',
        borderRadius:    6,
        backgroundColor: isBad ? 'var(--color-tag-Red-bg)' : 'var(--neutral-100)',
        boxShadow:       isBad ? 'inset 0 0 0 1px var(--color-tag-Red-text)' : 'none',
      }}
    >
      <span style={{
        fontFamily:   'var(--font-body)',
        fontWeight:   500,
        fontSize:     12,
        lineHeight:   '16px',
        color:        isBad ? 'var(--color-tag-Red-text)' : 'var(--neutral-700)',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
      }}>
        {chip.value}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.value}`}
        style={{
          display:         'flex',
          alignItems:      'center',
          border:          'none',
          background:      'transparent',
          cursor:          'pointer',
          padding:         0,
          color:           'inherit',
          opacity:         0.6,
          flexShrink:      0,
        }}
      >
        <CancelOneIcon size={12} />
      </button>
    </span></Tooltip>
  )
}

// ── Role selector dropdown ────────────────────────────────────────────────────

function RoleSelector({ value, onChange }: { value: WorkspaceRole; onChange: (r: WorkspaceRole) => void }) {
  const [open, setOpen] = useState(false)
  // Radix DropdownMenu (via Dropdown.Float): roving focus, and Escape closes only this menu,
  // not the invite dialog around it.
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <Dropdown.Float
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        trigger={
          <Button type="button" variant="secondary" size="sm" rightIcon={<ArrowDownOneIcon size={11} />}>
            {ROLE_LABELS[value]}
          </Button>
        }
      >
        <Dropdown maxHeight={false} aria-label="Select role" style={{ padding: 4, minWidth: 220 }}>
          {ROLE_OPTIONS.map(role => (
            <Dropdown.Item
              key={role}
              fluid
              label={ROLE_LABELS[role]}
              selected={value === role}
              onClick={() => { onChange(role); setOpen(false) }}
            />
          ))}
        </Dropdown>
      </Dropdown.Float>
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
    {
      workspaceName,
      loading = false,
      disabled = false,
      existingEmails,
      allowedDomains,
      onClose,
      onInvite,
      asChild = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp = (asChild ? Slot : 'div') as React.ElementType

    const inputRef = useRef<HTMLInputElement>(null)
    const [emailChips, setEmailChips] = useState<EmailChip[]>([])
    const [draft,      setDraft]      = useState('')
    const [role,       setRole]       = useState<WorkspaceRole>('member')
    const [submitting, setSubmitting] = useState(false)
    // Button 30: after every invite goes out, the button shows "Sent" briefly before the modal closes.
    const [sent, setSent] = useState(false)

    useEffect(() => { inputRef.current?.focus() }, [])

    // Classifies one raw token as it's committed to a chip: format, then
    // already-a-member/invited, then domain restriction. Surfacing all three
    // inline (not just on submit) is the whole point of the chip list.
    const classify = useCallback((raw: string): EmailChip => {
      const value = raw.trim()
      if (!EMAIL_RE.test(value)) {
        return { value, status: 'invalid', reason: 'Not a valid email address' }
      }
      const lower = value.toLowerCase()
      if (existingEmails?.some(e => e.toLowerCase() === lower)) {
        return { value, status: 'invalid', reason: 'Already a member or already invited' }
      }
      if (allowedDomains && allowedDomains.length > 0) {
        const domain = lower.split('@')[1] ?? ''
        if (!allowedDomains.includes(domain)) {
          return { value, status: 'invalid', reason: `Domain not allowed — restricted to ${allowedDomains.map(d => `@${d}`).join(', ')}` }
        }
      }
      return { value, status: 'pending' }
    }, [existingEmails, allowedDomains])

    const commitTokens = useCallback((raw: string) => {
      const tokens = raw.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean)
      if (tokens.length === 0) return
      setEmailChips(prev => {
        const next = [...prev]
        const seen = new Set(next.map(c => c.value.toLowerCase()))
        for (const token of tokens) {
          const lower = token.toLowerCase()
          if (seen.has(lower)) continue
          seen.add(lower)
          next.push(classify(token))
        }
        return next
      })
    }, [classify])

    const removeChip = useCallback((value: string) => {
      setEmailChips(prev => prev.filter(c => c.value !== value))
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      // A Radix layer (the role menu, or the wrapping Dialog) that already handled this Escape
      // marks it defaultPrevented; only close when nothing else did.
      if (e.key === 'Escape') { if (!e.defaultPrevented) onClose?.(); return }
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

    const handleSubmit = useCallback(async () => {
      const pending = emailChips.filter(c => c.status === 'pending').map(c => c.value)
      if (pending.length === 0 || loading || submitting) return

      setSubmitting(true)
      try {
        const result = await onInvite?.({
          emails: pending,
          role,
        })
        if (!result) return

        // Only drop the chips that actually succeeded; failed ones stay
        // visible with their reason so nothing typed gets silently lost.
        const succeededSet = new Set(result.succeeded.map(e => e.toLowerCase()))
        const failedByEmail = new Map(result.failed.map(f => [f.email.toLowerCase(), f.reason]))
        setEmailChips(prev => prev
          .filter(c => c.status !== 'pending' || !succeededSet.has(c.value.toLowerCase()))
          .map(c => {
            const reason = failedByEmail.get(c.value.toLowerCase())
            return reason ? { ...c, status: 'error' as const, reason } : c
          }))

        if (result.failed.length === 0) {
          setSent(true)
          window.setTimeout(() => { setSent(false); onClose?.() }, 900)
        }
      } finally {
        setSubmitting(false)
      }
    }, [emailChips, loading, submitting, onInvite, onClose, role])

    const handleDraftKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        if (draft.trim()) {
          commitTokens(draft)
          setDraft('')
        } else if (e.key === 'Enter') {
          void handleSubmit()
        }
        return
      }
      if (e.key === 'Backspace' && draft === '' && emailChips.length > 0) {
        setEmailChips(prev => prev.slice(0, -1))
      }
    }, [draft, commitTokens, handleSubmit, emailChips.length])

    const handleDraftPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData('text')
      if (/[\s,;]/.test(text)) {
        e.preventDefault()
        commitTokens(text)
      }
    }, [commitTokens])

    const handleDraftBlur = useCallback(() => {
      if (draft.trim()) { commitTokens(draft); setDraft('') }
    }, [draft, commitTokens])

    const pendingCount = emailChips.filter(c => c.status === 'pending').length

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
          width:           'min(480px, calc(100vw - 32px))',
          padding:         '16px 14px',
          borderRadius:    18,
          boxSizing:       'border-box' as const,
          backgroundColor: 'var(--modal-bg)',
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

        {/* Content — bordered like the app's other content shells (AppLayout,
            ManageRoleModal's team list) */}
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           16,
          padding:       14,
          border:        '1px solid var(--border-default)',
          borderRadius:  14,
        }}>

        {/* Email chips + role selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ ...SECTION_LABEL_STYLE, flex: '1 0 0' }}>Email</span>
            <span style={SECTION_LABEL_STYLE}>Role</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{
            display:         'flex',
            flexWrap:        'wrap',
            alignItems:      'center',
            gap:             6,
            flex:            '1 0 0',
            minHeight:       36,
            padding:         '6px 8px',
            borderRadius:    10,
            backgroundColor: 'var(--field-surface)',
            boxShadow:       SHADOW_INPUT,
            boxSizing:       'border-box' as const,
          }}>
            {emailChips.map(chip => (
              <EmailChipPill key={chip.value} chip={chip} onRemove={() => removeChip(chip.value)} />
            ))}
            <input
              ref={inputRef}
              type="text"
              aria-label="Email address"
              placeholder={emailChips.length === 0 ? 'colleague@company.com' : 'Add another…'}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleDraftKeyDown}
              onPaste={handleDraftPaste}
              onBlur={handleDraftBlur}
              autoComplete="off"
              style={{
                flex:       '1 0 120px',
                minWidth:   120,
                border:     'none',
                outline:    'none',
                background: 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 400,
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-900)',
              }}
            />
          </div>
          <div style={{ paddingTop: 1 }}>
            <RoleSelector value={role} onChange={setRole} />
          </div>
          </div>
        </div>

        {/* Domain restriction hint — boxed like ManageRoleModal's InfoNote */}
        {allowedDomains && allowedDomains.length > 0 && (
          <InfoNote>Restricted to: {allowedDomains.map(d => `@${d}`).join(', ')}</InfoNote>
        )}

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <Button variant="cancel" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="default"
            size="sm"
            sendState={sent ? 'success' : loading || submitting ? 'loading' : 'idle'}
            successLabel={pendingCount > 1 ? 'Invites sent' : 'Invite sent'}
            disabled={pendingCount === 0 && !sent}
            onClick={() => void handleSubmit()}
          >
            {pendingCount > 1 ? `Send ${pendingCount} invites` : 'Send invite'}
          </Button>
        </div>
      </Comp>
    )
  },
)

InviteModal.displayName = 'InviteModal'

// ── AppInviteModal — Dialog wrapper, used by members/page.tsx ─────────────────

export interface AppInviteModalProps {
  isOpen:         boolean
  onClose:        () => void
  onInvite:       (
    emails: string[],
    role: WorkspaceRole,
  ) => Promise<InviteResult> | InviteResult
  workspaceName?: string
  loading?:       boolean
  existingEmails?: string[]
  allowedDomains?: string[]
}

export function AppInviteModal({
  isOpen,
  onClose,
  onInvite,
  workspaceName,
  loading,
  existingEmails,
  allowedDomains,
}: AppInviteModalProps) {
  // Opened from a button without a Dialog.Trigger: hand focus back to it on close.
  const { capture, handleCloseAutoFocus } = useFocusReturn()
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'var(--overlay-bg)',
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
          onCloseAutoFocus={handleCloseAutoFocus}
        >
          {capture}
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{workspaceName ? `Invite to ${workspaceName}` : 'Invite member'}</Dialog.Title>
          </VisuallyHidden.Root>
          <InviteModal
            workspaceName={workspaceName}
            loading={loading}
            existingEmails={existingEmails}
            allowedDomains={allowedDomains}
            onClose={onClose}
            onInvite={({ emails, role }) => onInvite(emails, role)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
