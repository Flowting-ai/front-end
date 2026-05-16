'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Slot } from '@radix-ui/react-slot'
import {
  CancelOneIcon,
  SearchOneIcon,
  UserIcon,
  ViewIcon,
  CopyOneIcon,
  TickTwoIcon,
  ArrowDownOneIcon,
} from '@strange-huge/icons'
import { Button }          from '@/components/Button'
import { Badge }           from '@/components/Badge'
import { Popover }         from '@/components/Popover'
import { Divider }         from '@/components/Divider'
import { DropdownMenuItem } from '@/components/DropdownMenuItem'
import { cn }              from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_MODAL    = '0px 12px 16px -4px rgba(130,122,116,0.12), 0px 2px 2.8px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_AVATAR   = '0px 0px 0px 1px rgba(59,54,50,0.3)'
const SHADOW_INPUT    = '0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px var(--neutral-100)'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Permission config ─────────────────────────────────────────────────────────

export type SharePermission = 'can-use' | 'can-view' | 'can-copy'

const PERMISSION_OPTIONS: { value: SharePermission; label: string; icon: React.ReactElement }[] = [
  { value: 'can-use',  label: 'Can use',  icon: <UserIcon    /> },
  { value: 'can-view', label: 'Can view', icon: <ViewIcon    /> },
  { value: 'can-copy', label: 'Can copy', icon: <CopyOneIcon /> },
]

function permissionLabel(p: SharePermission): string {
  return PERMISSION_OPTIONS.find((o) => o.value === p)?.label ?? 'Can use'
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShareModalPerson {
  id: string
  name: string
  email: string
  avatarUrl?: string
  /** 'owner' renders as plain text — no dropdown */
  permission: SharePermission | 'owner'
  /** Email sent but not yet accepted */
  pending?: boolean
}

export interface ShareModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Persona name shown in the header — e.g. "Legal Advisor" */
  personaName?: string
  /** URL for the persona avatar displayed in the modal header */
  personaAvatarUrl?: string
  /** Alt text for the persona avatar */
  personaAvatarAlt?: string
  /** Ordered list of people who currently have access */
  people?: readonly ShareModalPerson[]
  /** Shows spinner on Send invite button while the invite is in-flight */
  loading?: boolean
  /** Disables all interaction */
  disabled?: boolean
  /** Fires when the X button or Escape key is pressed */
  onClose?: () => void
  /** Fires with the trimmed email string when Send invite is submitted */
  onInvite?: (email: string) => void
  /** Fires when a non-owner's permission level is changed */
  onPermissionChange?: (id: string, permission: SharePermission) => void
  /** Fires when a non-owner is removed */
  onRemove?: (id: string) => void
  asChild?: boolean
}

// ── Permission dropdown ───────────────────────────────────────────────────────

interface PermissionMenuProps {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  current: SharePermission
  onSelect: (p: SharePermission) => void
  onRemove: () => void
  onClose: () => void
}

function PermissionMenu({ triggerRef, current, onSelect, onRemove, onClose }: PermissionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside — use capture so it fires before any bubbling
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        menuRef.current    && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
  }, [onClose, triggerRef])

  // Focus first item when opened
  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLElement>('[tabindex="0"]')
    first?.focus()
  }, [])

  // Arrow key navigation + Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[tabindex="0"]') ?? []
    )
    const idx = items.indexOf(document.activeElement as HTMLElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[Math.min(idx + 1, items.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[Math.max(idx - 1, 0)]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      triggerRef.current?.focus()
    }
  }, [onClose, triggerRef])

  return (
    <Popover
      ref={menuRef}
      variant="dropdown"
      maxHeight={false}
      role="menu"
      aria-label="Permission options"
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        top:      'calc(100% + 4px)',
        right:    0,
        zIndex:   200,
        padding:  4,
        minWidth: 160,
      }}
    >
      {PERMISSION_OPTIONS.map((opt) => (
        <DropdownMenuItem
          key={opt.value}
          fluid
          label={opt.label}
          icon={opt.icon}
          selected={current === opt.value}
          rightIcon={current === opt.value ? <TickTwoIcon /> : undefined}
          onClick={() => { onSelect(opt.value); onClose() }}
        />
      ))}

      <Divider
        decorative
        style={{
          backgroundColor: 'rgba(59,54,50,0.15)',
          margin:          '4px 0',
        }}
      />

      <DropdownMenuItem
        fluid
        variant="danger"
        label="Remove"
        icon={<CancelOneIcon />}
        onClick={() => { onRemove(); onClose() }}
      />
    </Popover>
  )
}

// ── Person row ────────────────────────────────────────────────────────────────

interface PersonRowProps {
  person: ShareModalPerson
  onPermissionChange: (id: string, p: SharePermission) => void
  onRemove: (id: string) => void
}

function PersonRow({ person, onPermissionChange, onRemove }: PersonRowProps) {
  const [menuOpen,  setMenuOpen]  = useState(false)
  const [hovered,   setHovered]   = useState(false)
  const [focused,   setFocused]   = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const isOwner    = person.permission === 'owner'

  // Ring: rest → subtle, hover → slightly stronger, focus → blue outline
  const btnShadow = focused
    ? '0px 0px 0px 2px var(--blue-400), 0px 0px 0px 1px rgba(59,54,50,0.3)'
    : hovered
      ? '0px 0px 0px 1px rgba(59,54,50,0.5)'
      : '0px 0px 0px 1px rgba(59,54,50,0.3)'

  return (
    <li
      style={{
        position:   'relative',
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        width:      '100%',
        listStyle:  'none',
      }}
    >
      {/* Avatar */}
      {person.avatarUrl ? (
        <img
          src={person.avatarUrl}
          alt={`${person.name} avatar`}
          style={{
            width:        40,
            height:       40,
            borderRadius: '50%',
            objectFit:    'cover',
            flexShrink:   0,
            boxShadow:    SHADOW_AVATAR,
            display:      'block',
          }}
        />
      ) : (
        <div
          aria-hidden
          style={{
            width:           40,
            height:          40,
            borderRadius:    '50%',
            flexShrink:      0,
            backgroundColor: 'var(--neutral-200)',
            boxShadow:       SHADOW_AVATAR,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-body)',
              fontWeight: 600,
              color:      'var(--neutral-600)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {getInitials(person.name)}
          </span>
        </div>
      )}

      {/* Name / email column */}
      <div
        style={{
          flex:          '1 1 0',
          display:       'flex',
          flexDirection: 'column',
          gap:           1,
          minWidth:      0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--font-size-body)',
              fontWeight:   600,
              lineHeight:   'var(--line-height-body)',
              color:        'var(--neutral-950)',
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}
          >
            {person.name}
          </span>
          {person.pending && (
            <Badge label="pending" color="Neutral" />
          )}
        </div>
        <span
          style={{
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            fontWeight:   400,
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}
        >
          {person.email}
        </span>
      </div>

      {/* Permission: Owner = plain text; others = trigger + dropdown */}
      {isOwner ? (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 400,
            lineHeight: 'var(--line-height-body)',
            color:      'var(--neutral-500)',
            flexShrink: 0,
          }}
        >
          Owner
        </span>
      ) : (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            style={{
              display:         'flex',
              alignItems:      'center',
              gap:             4,
              padding:         '5px 8px',
              borderRadius:    8,
              border:          'none',
              backgroundColor: hovered ? 'var(--neutral-50)' : 'transparent',
              cursor:          'pointer',
              fontFamily:      'var(--font-body)',
              fontSize:        'var(--font-size-body)',
              fontWeight:      400,
              lineHeight:      'var(--line-height-body)',
              color:           'var(--neutral-700)',
              boxShadow:       btnShadow,
              minWidth:        88,
              justifyContent:  'space-between',
              whiteSpace:      'nowrap',
              outline:         'none',
              transition:      'background-color 120ms, box-shadow 120ms',
            }}
          >
            {permissionLabel(person.permission as SharePermission)}
            <ArrowDownOneIcon size={11} color="var(--neutral-500)" />
          </button>

          {menuOpen && (
            <PermissionMenu
              triggerRef={triggerRef}
              current={person.permission as SharePermission}
              onSelect={(p) => onPermissionChange(person.id, p)}
              onRemove={() => onRemove(person.id)}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      )}
    </li>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ShareModal = React.forwardRef<HTMLDivElement, ShareModalProps>(
  function ShareModal(
    {
      personaName       = '',
      personaAvatarUrl,
      personaAvatarAlt,
      people            = [],
      loading           = false,
      disabled          = false,
      onClose,
      onInvite,
      onPermissionChange,
      onRemove,
      asChild           = false,
      className,
      style,
      ...props
    },
    ref,
  ) {
    const Comp       = (asChild ? Slot : 'div') as React.ElementType
    const inputRef   = useRef<HTMLInputElement>(null)
    const [emailDraft, setEmailDraft] = useState('')
    const resolvedAlt = personaAvatarAlt ?? (personaName ? `${personaName} persona` : 'Persona')

    // Auto-focus email input on mount
    useEffect(() => { inputRef.current?.focus() }, [])

    // Focus trap: cycle Tab within the modal; Escape closes
    const handleModalKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') { onClose?.(); return }
        if (e.key !== 'Tab') return

        const modal = e.currentTarget
        const els   = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex="0"]:not([tabindex="-1"])',
          ),
        )
        if (els.length < 2) return

        const first = els[0]
        const last  = els[els.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      },
      [onClose],
    )

    const handleInvite = useCallback(() => {
      const trimmed = emailDraft.trim()
      if (!trimmed) return
      onInvite?.(trimmed)
      setEmailDraft('')
      inputRef.current?.focus()
    }, [emailDraft, onInvite])

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleInvite() }
      },
      [handleInvite],
    )

    return (
      <Comp
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={personaName ? `Share ${personaName}` : 'Share persona'}
        className={cn(className)}
        onKeyDown={handleModalKeyDown}
        style={{
          display:         'flex',
          flexDirection:   'column',
          gap:             16,
          width:           572,
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

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {/* Persona avatar */}
            {personaAvatarUrl ? (
              <img
                src={personaAvatarUrl}
                alt={resolvedAlt}
                style={{
                  width:        36,
                  height:       36,
                  borderRadius: 10,
                  objectFit:    'cover',
                  flexShrink:   0,
                  boxShadow:    SHADOW_AVATAR,
                  display:      'block',
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width:           36,
                  height:          36,
                  borderRadius:    10,
                  flexShrink:      0,
                  backgroundColor: 'var(--neutral-100)',
                  boxShadow:       SHADOW_AVATAR,
                }}
              />
            )}

            {/* Title — Besley heading scale */}
            <span
              style={{
                fontFamily:   'var(--font-title)',
                fontSize:     'var(--font-size-heading)',
                fontWeight:   400,
                lineHeight:   'var(--line-height-heading)',
                color:        'var(--neutral-900)',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                whiteSpace:   'nowrap',
              }}
            >
              {personaName ? `Share '${personaName}'` : 'Share persona'}
            </span>
          </div>

          {/* Close button */}
          <CloseButton onClick={onClose} />
        </div>

        {/* ── Email input ─────────────────────────────────────────────────────── */}
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             8,
            padding:         '7px 10px',
            borderRadius:    10,
            backgroundColor: 'var(--neutral-white)',
            boxShadow:       SHADOW_INPUT,
            boxSizing:       'border-box' as const,
          }}
        >
          <span
            aria-hidden
            style={{
              display:    'flex',
              alignItems: 'center',
              color:      'var(--neutral-400)',
              flexShrink: 0,
              lineHeight: 0,
            }}
          >
            <SearchOneIcon size={16} />
          </span>
          <input
            ref={inputRef}
            type="email"
            id="share-email-input"
            aria-label="Add people by email"
            placeholder="Add people by email"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
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

        {/* ── Who has access ─────────────────────────────────────────────────── */}
        {people.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              id="share-access-label"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize:   'var(--font-size-body)',
                fontWeight: 400,
                lineHeight: 'var(--line-height-body)',
                color:      'var(--neutral-700)',
              }}
            >
              Who has access
            </span>
            <ul
              aria-labelledby="share-access-label"
              style={{
                listStyle: 'none',
                margin:    0,
                padding:   0,
                display:   'flex',
                flexDirection: 'column',
                gap:       14,
              }}
            >
              {people.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  onPermissionChange={onPermissionChange ?? (() => {})}
                  onRemove={onRemove ?? (() => {})}
                />
              ))}
            </ul>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            display:        'flex',
            justifyContent: 'flex-end',
            alignItems:     'center',
            gap:            8,
          }}
        >
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            loading={loading}
            onClick={handleInvite}
            disabled={!emailDraft.trim()}
          >
            Send invite
          </Button>
        </div>

      </Comp>
    )
  },
)

ShareModal.displayName = 'ShareModal'
export default ShareModal

// ── Close button (extracted to keep parent clean) ─────────────────────────────

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
