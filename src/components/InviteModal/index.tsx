'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Slot } from '@radix-ui/react-slot'
import { AnimatePresence, motion } from 'framer-motion'
import { CancelOneIcon, ArrowDownOneIcon, InformationCircleIcon } from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { Popover } from '@/components/Popover'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { formatCredits } from '@/lib/format-credits'
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
  teams?: InviteTeamOption[]
  projects?: InviteProjectOption[]
  /** Emails already in the workspace (members + pending invites). Compared
   *  case-insensitively so a chip is flagged the instant it's typed, instead
   *  of only after a round trip to the backend. */
  existingEmails?: string[]
  /** When set, restricts (and hints at) which email domains can be invited. */
  allowedDomains?: string[]
  /** Org-wide credits left this billing period — warns inline if the cap
   *  entered, multiplied across every pending invite, would exceed it. */
  poolRemaining?: number
  onClose?: () => void
  onInvite?: (params: {
    emails: string[]
    role: WorkspaceRole
    creditCap?: number
    teamId?: string
    projectId?: string
  }) => Promise<InviteResult> | InviteResult
  asChild?: boolean
}

export interface InviteTeamOption {
  id: string
  name: string
}

export interface InviteProjectOption {
  id: string
  title: string
  teamId: string
}

const ROLE_OPTIONS: WorkspaceRole[] = ['member', 'editor', 'admin']

const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  member: 'Can chat, use agents, access team projects',
  editor: 'Everything a Member can do, plus publish to their team',
  admin:  'Full access excluding billing',
}

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin:  'Admin',
  editor: 'Editor',
  member: 'Member',
}

// ── Team gradient icons — kept in sync with org/members/page.tsx's and
//    TeamSwitcher/index.tsx's getTeamGradient so a team keeps the same color
//    everywhere it shows up. ─────────────────────────────────────────────────

const TEAM_GRADIENTS = [
  'linear-gradient(135deg, #4FACDE 0%, #2D8BBF 100%)',  // teal-blue
  'linear-gradient(135deg, #9B6FE0 0%, #7B4FC0 100%)',  // purple
  'linear-gradient(135deg, #F59542 0%, #D4742A 100%)',  // orange
  'linear-gradient(135deg, #4CAF78 0%, #2D8F58 100%)',  // green
  'linear-gradient(135deg, #E06060 0%, #B83C3C 100%)',  // red-brown
  'linear-gradient(135deg, #60A8E0 0%, #3C80C0 100%)',  // blue
]

function getTeamGradient(teamId: string): string {
  let hash = 0
  for (let i = 0; i < teamId.length; i++) {
    hash = ((hash << 5) - hash) + teamId.charCodeAt(i)
    hash |= 0
  }
  return TEAM_GRADIENTS[Math.abs(hash) % TEAM_GRADIENTS.length]!
}

function TeamAvatar({ teamId, name, size = 20 }: { teamId: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        position:     'relative',
        display:      'inline-flex',
        width:        size,
        height:       size,
        borderRadius: 4,
        background:   getTeamGradient(teamId),
        flexShrink:   0,
        overflow:     'hidden',
      }}
    >
      <span
        aria-hidden
        style={{
          position:      'absolute',
          inset:         0,
          borderRadius:  4,
          pointerEvents: 'none',
          boxShadow:     'inset 0px 4px 4px 0px rgba(0,0,0,0.25), inset 0px -1px 0.4px 0px rgba(18,60,95,0.65)',
        }}
      />
      <span
        style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          fontFamily:     'var(--font-title)',
          fontWeight:     500,
          fontSize:       Math.round(size * 0.58),
          lineHeight:     1,
          color:          'var(--neutral-white)',
          userSelect:     'none',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    </span>
  )
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
    <span
      title={chip.reason}
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
    </span>
  )
}

// ── Generic dropdown (Team / Project pickers) — same trigger+Popover pattern
//    as RoleSelector below, just parameterized over a plain option list. ─────

interface SimpleSelectOption {
  value:    string
  label:    string
  subLabel?: string
  avatar?:  React.ReactNode
}

function SimpleSelect({
  value, onChange, options, placeholder, ariaLabel, disabled = false,
}: {
  value:        string
  onChange:     (v: string) => void
  options:      SimpleSelectOption[]
  placeholder:  string
  ariaLabel:    string
  disabled?:    boolean
}) {
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

  const selected = options.find(o => o.value === value)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        style={{
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'space-between',
          gap:             8,
          width:           '100%',
          padding:         '8px 10px',
          borderRadius:    10,
          border:          'none',
          backgroundColor: hovered && !disabled ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       SHADOW_INPUT,
          cursor:          disabled ? 'default' : 'pointer',
          opacity:         disabled ? 0.6 : 1,
          outline:         'none',
          boxSizing:       'border-box' as const,
          transition:      'background-color 120ms ease',
        }}
      >
        <span style={{
          fontFamily:   'var(--font-body)',
          fontSize:     'var(--font-size-body)',
          fontWeight:   400,
          color:        selected ? 'var(--neutral-900)' : 'var(--neutral-400)',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {selected ? selected.label : placeholder}
        </span>
        <ArrowDownOneIcon size={11} color="var(--neutral-400)" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="simple-select-panel"
            initial={{ opacity: 0, scaleY: 0.8, transformOrigin: 'top center' }}
            animate={{ opacity: 1, scaleY: 1, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } }}
            exit={{ opacity: 0, scaleY: 0.85, transition: { duration: 0.08 } }}
            style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100 }}
          >
            {/* Padding lives on this inner wrapper, not on <Popover>'s own
                style prop — that prop only reaches Popover's outer
                overflow:hidden shell, which sits OUTSIDE the actual
                scrollable row list (maxHeight engages an inner ScrollArea).
                Padding on the outer shell never reaches the rows, so they
                rendered flush against the clipped scroll edges with zero
                breathing room. */}
            <Popover ref={panelRef} variant="dropdown" maxHeight={240} role="menu" aria-label={ariaLabel}>
              <div style={{ padding: 4 }}>
                {options.map(opt => (
                  <DropdownMenuItem
                    key={opt.value}
                    fluid
                    avatar={opt.avatar}
                    label={opt.label}
                    subLabel={opt.subLabel}
                    selected={value === opt.value}
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                  />
                ))}
              </div>
            </Popover>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Role selector dropdown ────────────────────────────────────────────────────

function RoleSelector({ value, onChange }: { value: WorkspaceRole; onChange: (r: WorkspaceRole) => void }) {
  const [open, setOpen] = useState(false)
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
      <Button
        ref={triggerRef}
        type="button"
        variant="secondary"
        size="sm"
        rightIcon={<ArrowDownOneIcon size={11} />}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {ROLE_LABELS[value]}
      </Button>

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
                  label={ROLE_LABELS[role]}
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
    {
      workspaceName,
      loading = false,
      disabled = false,
      teams = [],
      projects = [],
      existingEmails,
      allowedDomains,
      poolRemaining,
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
    const [capDraft,   setCapDraft]   = useState('')
    const [teamId,     setTeamId]     = useState('')
    const [projectId,  setProjectId]  = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => { inputRef.current?.focus() }, [])
    const effectiveTeamId = teamId || teams[0]?.id || ''

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

    const handleSubmit = useCallback(async () => {
      const pending = emailChips.filter(c => c.status === 'pending').map(c => c.value)
      if (pending.length === 0 || loading || submitting) return
      if (role === 'editor' && !effectiveTeamId) return

      const capVal = capDraft.trim() === '' ? undefined : parseInt(capDraft.trim(), 10)
      const project = role === 'member'
        ? projects.find(option => option.id === projectId)
        : undefined

      setSubmitting(true)
      try {
        const result = await onInvite?.({
          emails: pending,
          role,
          creditCap: capVal && capVal > 0 ? capVal : undefined,
          teamId: role === 'editor' ? effectiveTeamId : project?.teamId,
          projectId: project?.id,
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
          setCapDraft('')
          setProjectId('')
          onClose?.()
        }
      } finally {
        setSubmitting(false)
      }
    }, [capDraft, effectiveTeamId, emailChips, loading, submitting, onInvite, onClose, projectId, projects, role])

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
    const capNum = capDraft.trim() === '' ? 0 : parseInt(capDraft.trim(), 10) || 0
    const totalCommit = capNum * Math.max(pendingCount, 1)
    const exceedsPool = poolRemaining != null && capNum > 0 && totalCommit > poolRemaining

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
          backgroundColor: 'var(--neutral-50)',
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
          border:        '1px solid var(--neutral-200)',
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
            backgroundColor: 'var(--neutral-white)',
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
            <RoleSelector
              value={role}
              onChange={nextRole => {
                setRole(nextRole)
                setProjectId('')
                if (nextRole === 'admin') setCapDraft('')
              }}
            />
          </div>
          </div>
        </div>

        {/* Role description + domain restriction hints — boxed like ManageRoleModal's InfoNote */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <InfoNote>{ROLE_DESCRIPTIONS[role]}</InfoNote>
          {allowedDomains && allowedDomains.length > 0 && (
            <InfoNote>Restricted to: {allowedDomains.map(d => `@${d}`).join(', ')}</InfoNote>
          )}
        </div>

        {role === 'editor' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={SECTION_LABEL_STYLE}>Team</span>
            <SimpleSelect
              ariaLabel="Team"
              value={effectiveTeamId}
              onChange={setTeamId}
              disabled={teams.length === 0}
              placeholder="No teams available"
              options={teams.map(team => ({
                value:  team.id,
                label:  team.name,
                avatar: <TeamAvatar teamId={team.id} name={team.name} size={24} />,
              }))}
            />
          </div>
        )}

        {role === 'member' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={SECTION_LABEL_STYLE}>Project access (optional)</span>
            <SimpleSelect
              ariaLabel="Project access"
              value={projectId}
              onChange={setProjectId}
              placeholder="No project access"
              options={[
                { value: '', label: 'No project access' },
                ...projects.map(project => {
                  const team = teams.find(t => t.id === project.teamId)
                  return {
                    value:    project.id,
                    label:    project.title,
                    subLabel: team?.name,
                    avatar:   team && <TeamAvatar teamId={team.id} name={team.name} size={24} />,
                  }
                }),
              ]}
            />
          </div>
        )}

        {/* Credit cap — only for member/editor roles; admins use the workspace pool */}
        {role !== 'admin' && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={SECTION_LABEL_STYLE}>Credit cap (optional)</span>
            {poolRemaining != null && (
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--neutral-500)' }}>
                <strong style={{ fontWeight: 600, color: 'var(--neutral-700)' }}>{formatCredits(poolRemaining)}</strong> left in pool
              </span>
            )}
          </div>
          <div style={{
            display:         'flex',
            alignItems:      'center',
            padding:         '7px 10px',
            borderRadius:    10,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_INPUT,
            boxSizing:       'border-box' as const,
          }}>
            <input
              type="number"
              min={1}
              aria-label="Credit cap"
              placeholder="No limit"
              value={capDraft}
              onChange={e => setCapDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSubmit() } }}
              style={{
                flex:       1,
                border:     'none',
                outline:    'none',
                background: 'transparent',
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 400,
                color:      'var(--neutral-900)',
                minWidth:   0,
                MozAppearance: 'textfield' as React.CSSProperties['MozAppearance'],
              }}
            />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--neutral-400)', flexShrink: 0, paddingLeft: 6 }}>
              credits {pendingCount > 1 ? `× ${pendingCount} invites` : ''}
            </span>
          </div>
          {exceedsPool && (
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 12, lineHeight: '16px', color: 'var(--color-tag-Red-text)', margin: 0 }}>
              Exceeds the org&rsquo;s remaining pool — this would commit {formatCredits(totalCommit)} of {formatCredits(poolRemaining)} left.
            </p>
          )}
        </div>}

        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="default"
            size="sm"
            loading={loading || submitting}
            disabled={pendingCount === 0 || (role === 'editor' && !effectiveTeamId)}
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

// ── AppInviteModal — Dialog wrapper for backward compatibility ─────────────────
// Used in settings/org/teams/[teamId]/page.tsx with onInvite(email, role) API.

export interface AppInviteModalProps {
  isOpen:         boolean
  onClose:        () => void
  onInvite:       (
    emails: string[],
    role: WorkspaceRole,
    creditCap?: number,
    teamId?: string,
    projectId?: string,
  ) => Promise<InviteResult> | InviteResult
  workspaceName?: string
  loading?:       boolean
  teams?:         InviteTeamOption[]
  projects?:      InviteProjectOption[]
  existingEmails?: string[]
  allowedDomains?: string[]
  poolRemaining?: number
}

export function AppInviteModal({
  isOpen,
  onClose,
  onInvite,
  workspaceName,
  loading,
  teams,
  projects,
  existingEmails,
  allowedDomains,
  poolRemaining,
}: AppInviteModalProps) {
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
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{workspaceName ? `Invite to ${workspaceName}` : 'Invite member'}</Dialog.Title>
          </VisuallyHidden.Root>
          <InviteModal
            workspaceName={workspaceName}
            loading={loading}
            teams={teams}
            projects={projects}
            existingEmails={existingEmails}
            allowedDomains={allowedDomains}
            poolRemaining={poolRemaining}
            onClose={onClose}
            onInvite={({ emails, role, creditCap, teamId, projectId }) => (
              onInvite(emails, role, creditCap, teamId, projectId)
            )}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
