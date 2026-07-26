'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { m, AnimatePresence, useIsPresent } from 'framer-motion'
import { Slot } from '@radix-ui/react-slot'
import {
  MoreVerticalIcon,
  PenOneIcon,
  ShareOneIcon,   // ⚠ substitute — no LinkIcon in @strange-huge/icons yet
  CopyOneIcon,
  BookmarkTwoIcon,
  StopCircleIcon,     // ⚠ substitute — no PauseIcon yet
  ArrowRightTwoIcon,  // ⚠ substitute — no PlayIcon/ResumeIcon yet
  AlertTwoIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_CARD          = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_CARD_TEMPLATE = '0px 2px 2.8px 0px var(--blue-100), 0px 0px 0px 1px var(--neutral-100)'

// Fixed height for default/draft cards so every card in a grid lines up
// regardless of description length or which badges/footer content is
// present — the footer is pinned to the bottom of this via marginTop:'auto'
// rather than sitting wherever the content above happens to end.
const CARD_HEIGHT = 176

// Avatar size — shared with the meta column's height cap so name/handle/tags
// stay within the avatar's footprint instead of growing taller than it.
const AVATAR_SIZE = 65

const EMPTY_PERSONA_TAGS: string[] = []

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

// ── PersonaAvatar ─────────────────────────────────────────────────────────────
// 65 × 65 rounded avatar — shows saved image URL, falls back to initials.

function PersonaAvatar({
  avatarUrl,
  name,
  avatarSeed,
  size   = AVATAR_SIZE,
  radius = 8,
}: {
  avatarUrl?: string
  name:       string
  avatarSeed?: string
  size?:      number
  radius?:    number
}) {
  // Match may-day: when no avatar (or the provided URL fails to load) fall back
  // to a deterministic marble image rather than initials.
  const [imgError, setImgError] = useState(false)
  const src = (avatarUrl && !imgError)
    ? avatarUrl
    : getPersonaFallbackAvatar(avatarSeed || name)

  return (
    <div
      aria-hidden
      style={{
        width:        size,
        height:       size,
        borderRadius: radius,
        overflow:     'hidden',
        flexShrink:   0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic avatar URL, onError fallback requires HTMLImageElement access */}
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

// ── AuthorRow ─────────────────────────────────────────────────────────────────
// Author info row shown on community cards (below description).

function AuthorRow({
  authorHandle,
  authorAvatarUrl,
  useCount,
}: {
  authorHandle?:    string
  authorAvatarUrl?: string
  useCount?:        number
}) {
  if (!authorHandle) return null

  const initials = getInitials(authorHandle.replace(/\d+$/, '') || authorHandle)

  return (
    <div
      style={{
        display:    'flex',
        alignItems: 'center',
        gap:        6,
        marginTop:  8,
      }}
    >
      {/* Mini-avatar */}
      <div
        style={{
          width:           18,
          height:          18,
          borderRadius:    '50%',
          overflow:        'hidden',
          backgroundColor: 'var(--neutral-200)',
          flexShrink:      0,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        {authorAvatarUrl ? (
          <Image
            src={authorAvatarUrl}
            alt=""
            fill
            sizes="18px"
            style={{ objectFit: 'cover', display: 'block' }}
            unoptimized
          />
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color:      'var(--neutral-600)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Handle */}
      <span
        style={{
          fontFamily: 'var(--font-code)',
          fontSize:   'var(--font-size-code)',
          lineHeight: 'var(--line-height-code)',
          color:      'var(--neutral-500)',
        }}
      >
        @{authorHandle}
      </span>

      {useCount !== undefined && (
        <>
          <span
            aria-hidden
            style={{ color: 'var(--neutral-300)', lineHeight: 1, flexShrink: 0 }}
          >
            ·
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize:   'var(--font-size-caption)',
              lineHeight: 'var(--line-height-caption)',
              color:      'var(--neutral-400)',
            }}
          >
            {formatCount(useCount)}
          </span>
        </>
      )}
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PersonaCardVariant =
  | 'default'
  | 'draft'
  | 'template'
  | 'community'
  | 'community-imported'

export interface PersonaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card layout variant. Defaults to 'default'. */
  variant?: PersonaCardVariant

  /** Persona display name. */
  name: string
  /** Username handle rendered as @handle — omit the @. */
  handle: string
  /** One-to-two line persona summary shown below the badge row. */
  description?: string
  /** Avatar image URL. Falls back to initials derived from `name`. */
  avatarUrl?: string
  /** Stable persona id used to select the deterministic fallback avatar. */
  avatarSeed?: string

  /**
   * Controlled hover override. When true, the action bar is forced visible
   * regardless of pointer position. Internal mouseenter/leave is used when
   * this prop is not supplied.
   */
  hovered?: boolean

  /**
   * Persona is paused — dims the identity header at 60 % and surfaces a
   * full-width Resume action bar. Applies to the 'default' variant only.
   */
  paused?: boolean

  /**
   * SuperLink is active — shows a Blue "Superlink" chip in the badge row to
   * signal that this persona is shared and accessible to others via a link.
   */
  superlink?: boolean

  /**
   * The agent's configured model is disabled, missing, or deprecated — dims
   * the card, suppresses its normal hover actions and ··· menu (nothing on
   * it can run right now), and shows a centered "Change model" ghost button
   * instead. Applies to the 'default' variant only.
   */
  modelUnavailable?: boolean
  /** "Change model" button shown when `modelUnavailable` is true. */
  onChangeModel?: () => void

  /**
   * "Created by {createdBy}" text shown in the footer's bottom-right slot —
   * e.g. "You" for an agent the viewer owns, or the actual creator's name
   * for a team-shared one.
   */
  createdBy?: string

  /**
   * Visibility, shown as a badge in the footer's bottom-left slot — not the
   * scrolling tag row, so it's always visible and always in the same place
   * regardless of how many tags there are.
   * 'private' → "Private" badge · 'team' → "N teams" badge (needs `teamCount`).
   */
  visibility?: 'private' | 'team'
  /** Number of teams this agent is shared with — drives the "N teams" footer badge when `visibility` is 'team'. */
  teamCount?: number
  /** Additional Neutral tag badges shown in the badge row (e.g. ["Research"]). */
  tags?: string[]
  /** Shows a Blue "Shared" chip — use for personas accepted from another user's share. */
  shared?: boolean

  // ── Community-specific ────────────────────────────────────────────────────
  /** Community author handle (without @). */
  authorHandle?:    string
  /** Community author avatar URL. Falls back to initials. */
  authorAvatarUrl?: string
  /** Raw use count — formatted as "1.2K" internally. */
  useCount?:        number

  // ── Callbacks ─────────────────────────────────────────────────────────────
  /** Pencil icon in hover/draft action bar. */
  onEdit?:              () => void
  /** Link/share icon in hover action bar. */
  onLink?:              () => void
  /** "Use in chat" button in hover action bar. */
  onUseInChat?:         () => void
  /** Label for the hover action bar's primary button. Defaults to "Use in chat". */
  useInChatLabel?:      string
  /** Pause action (not currently exposed in UI but available for future use). */
  onPause?:             () => void
  /** Resume button in paused action bar. */
  onResume?:            () => void
  /** Copy icon on template cards. */
  onCopy?:              () => void
  /** "Try" button on template cards. */
  onTry?:               () => void
  /** "Open" button on community cards. */
  onOpen?:              () => void
  /** Bookmark icon on community cards. */
  onBookmark?:          () => void
  /** ··· menu → Edit */
  onMenuEdit?:          () => void
  /** ··· menu → Share (navigates to the sharing configuration page) */
  onMenuShare?:         () => void
  /** ··· menu → Duplicate */
  onMenuDuplicate?:     () => void
  /** ··· menu → Pause / Resume (toggles based on `paused`) */
  onMenuPauseToggle?:   () => void
  /** ··· menu → Delete */
  onMenuDelete?:        () => void

  /** Render the card root element as the provided child component (Radix Slot). */
  asChild?: boolean
}

// ── ActionBar ─────────────────────────────────────────────────────────────────
// Absolute overlay for ALL variants — card height never changes.
// Separate component so useIsPresent works inside AnimatePresence.
// always=true  → renders without a hover trigger (draft, template, community, paused)
// always=false → renders only when hovered (default variant)

const ACTION_BAR_TRANSITION = { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const }

type ActionBarType = 'hover' | 'resume' | 'draft' | 'template' | 'community'

function ActionBar({
  type,
  isDraft,
  authorHandle,
  authorAvatarUrl,
  onEdit,
  onLink,
  onUseInChat,
  useInChatLabel = 'Use in chat',
  onResume,
  onTry,
  onOpen,
}: {
  type:             ActionBarType
  isDraft?:         boolean
  authorHandle?:    string
  authorAvatarUrl?: string
  onEdit?:          () => void
  onLink?:          () => void
  onUseInChat?:     () => void
  useInChatLabel?:  string
  onResume?:        () => void
  onTry?:           () => void
  onOpen?:          () => void
}) {
  const isPresent = useIsPresent()

  return (
    <m.div
      initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{   opacity: 0, y: 4, filter: 'blur(4px)' }}
      transition={ACTION_BAR_TRANSITION}
      style={{
        position:                'absolute',
        bottom:                  0,
        left:                    0,
        right:                   0,
        backgroundColor:         isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)',
        borderBottomLeftRadius:  16,
        borderBottomRightRadius: 16,
        padding:                 '8px 10px',
        display:                 'flex',
        alignItems:              'center',
        gap:                     6,
        zIndex:                  1,
        pointerEvents:           isPresent ? 'auto' : 'none',
      }}
    >
      {type === 'hover' && (
        <>
          {onEdit && (
            <Tooltip content="Edit">
              <IconButton variant="ghost" size="sm" aria-label="Edit agent" icon={<PenOneIcon />} onClick={onEdit} />
            </Tooltip>
          )}
          {onLink && (
            <Tooltip content="Share">
              <IconButton variant="ghost" size="sm" aria-label="Copy link" icon={<ShareOneIcon />} onClick={onLink} />
            </Tooltip>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={onUseInChat}>{useInChatLabel}</Button>
        </>
      )}

      {type === 'resume' && onResume && (
        <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={onResume}>Resume</Button>
      )}

      {type === 'draft' && (
        <>
          {onEdit && <IconButton variant="ghost" size="sm" aria-label="Edit draft" icon={<PenOneIcon />} onClick={onEdit} />}
          <div style={{ flex: 1 }} />
          {onEdit && <Button variant="outline" size="sm" onClick={onEdit}>Continue building</Button>}
        </>
      )}

      {type === 'template' && (
        <>
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={onTry}>Try</Button>
        </>
      )}

      {type === 'community' && (
        <>
          {authorHandle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, minWidth: 0 }}>
              <div
                style={{
                  width:           18,
                  height:          18,
                  borderRadius:    '50%',
                  overflow:        'hidden',
                  backgroundColor: 'var(--neutral-200)',
                  flexShrink:      0,
                }}
              >
                <Image
                  src={authorAvatarUrl ?? getPersonaFallbackAvatar(authorHandle)}
                  alt=""
                  fill
                  sizes="18px"
                  style={{ objectFit: 'cover', display: 'block' }}
                  unoptimized
                />
              </div>
              <span
                style={{
                  fontFamily:   'var(--font-code)',
                  fontSize:     'var(--font-size-code)',
                  lineHeight:   'var(--line-height-code)',
                  color:        'var(--neutral-500)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                  maxWidth:     90,
                }}
              >
                @{authorHandle}
              </span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={onOpen}>Open</Button>
        </>
      )}
    </m.div>
  )
}

// ── PersonaCard ───────────────────────────────────────────────────────────────

function PersonaCardInner({
      ref,
      variant       = 'default',
      name,
      handle,
      description,
      avatarUrl,
      avatarSeed,
      hovered:       hoveredProp,
      paused         = false,
      superlink      = false,
      modelUnavailable = false,
      onChangeModel,
      createdBy,
      visibility,
      teamCount,
      tags           = EMPTY_PERSONA_TAGS,
      shared         = false,
      authorHandle,
      authorAvatarUrl,
      useCount,
      onEdit,
      onLink,
      onUseInChat,
      useInChatLabel,
      onPause:       _onPause,
      onResume,
      onCopy,
      onTry,
      onOpen,
      onBookmark,
      onMenuEdit,
      onMenuShare,
      onMenuDuplicate,
      onMenuPauseToggle,
      onMenuDelete,
      asChild        = false,
      className,
      style,
      onMouseEnter:  onMouseEnterProp,
      onMouseLeave:  onMouseLeaveProp,
      ...props
    }: PersonaCardProps & { ref?: React.Ref<HTMLDivElement> }) {
    const [internalHovered, setInternalHovered] = useState(false)
    const [menuOpen,         setMenuOpen]         = useState(false)
    const [dropUp,           setDropUp]           = useState(false)
    const menuTriggerRef = useRef<HTMLDivElement>(null)

    const isHovered   = hoveredProp ?? internalHovered
    const isDraft     = variant === 'draft'
    const isTemplate  = variant === 'template'
    const isCommunity = variant === 'community' || variant === 'community-imported'

    // Which content to render inside the action bar.
    const actionBarType =
      paused        ? 'resume'    :
      isDraft       ? 'draft'     :
      isTemplate    ? 'template'  :
      isCommunity   ? 'community' :
                      'hover'

    // Close dropdown when clicking anywhere outside the card.
    useEffect(() => {
      if (!menuOpen) return
      const close = () => setMenuOpen(false)
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }, [menuOpen])

    const handleMenuToggle = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      setMenuOpen(v => {
        if (!v) {
          const el = menuTriggerRef.current
          if (el) {
            const rect = el.getBoundingClientRect()
            setDropUp(window.innerHeight - rect.bottom < 200)
          }
        }
        return !v
      })
    }, [])

    // ── Drag-to-scroll for the tag row ────────────────────────────────────────
    const tagRowRef   = useRef<HTMLDivElement>(null)
    const dragState   = useRef({ active: false, startX: 0, scrollLeft: 0 })

    // Edge fades so a badge row with more tags than fit has some visual hint
    // it scrolls at all — nothing else here signals that (no scrollbar, no
    // peeking badge), so hidden tags were otherwise easy to miss entirely.
    const [tagRowAtStart, setTagRowAtStart] = useState(true)
    const [tagRowAtEnd,   setTagRowAtEnd]   = useState(true)

    const updateTagRowEdges = useCallback(() => {
      const el = tagRowRef.current
      if (!el) return
      setTagRowAtStart(el.scrollLeft < 4)
      setTagRowAtEnd(el.scrollWidth - el.scrollLeft - el.clientWidth < 4)
    }, [])

    // Re-check whenever the badge set can change, since that changes whether
    // the row overflows at all.
    useEffect(() => {
      updateTagRowEdges()
    }, [updateTagRowEdges, tags, shared, superlink, paused, isDraft, variant])

    const onTagRowMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const el = tagRowRef.current
      if (!el) return
      dragState.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
      el.style.cursor = 'grabbing'
    }, [])

    const onTagRowMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const el = tagRowRef.current
      if (!dragState.current.active || !el) return
      e.preventDefault()
      const x    = e.pageX - el.offsetLeft
      const walk = x - dragState.current.startX
      el.scrollLeft = dragState.current.scrollLeft - walk
    }, [])

    const onTagRowMouseUp = useCallback(() => {
      const el = tagRowRef.current
      dragState.current.active = false
      if (el) el.style.cursor = 'grab'
    }, [])

    const Comp = (asChild ? Slot : 'div') as React.ElementType

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          setInternalHovered(true)
          onMouseEnterProp?.(e)
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          setInternalHovered(false)
          onMouseLeaveProp?.(e)
        }}
        style={{
          position:        'relative',
          width:           314,
          height:          (!isTemplate && !isCommunity) ? CARD_HEIGHT : undefined,
          borderRadius:    16,
          backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       isTemplate ? SHADOW_CARD_TEMPLATE : SHADOW_CARD,
          border:          isDraft
            ? `1px dashed ${isHovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`
            : undefined,
          cursor:          modelUnavailable ? 'default' : 'pointer',
          boxSizing:       'border-box' as const,
          zIndex:          menuOpen ? 100 : undefined,
          ...style,
        }}
        {...props}
      >

        {/* ── Template: copy icon — top-right corner ──────────────────── */}
        {isTemplate && (
          <div
            style={{
              position: 'absolute',
              top:      10,
              right:    10,
              zIndex:   2,
            }}
          >
            <IconButton
              variant="ghost"
              size="xs"
              aria-label="Copy template"
              icon={<CopyOneIcon />}
              onClick={onCopy}
            />
          </div>
        )}

        {/* ── Main content ────────────────────────────────────────────── */}
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            height:        (!isTemplate && !isCommunity) ? '100%' : undefined,
            boxSizing:     'border-box' as const,
            padding:       12,
            opacity:       modelUnavailable ? 0.5 : 1,
            pointerEvents: modelUnavailable ? 'none' : undefined,
            transition:    'opacity 0.2s ease',
          }}
        >

          {/* Header row: avatar + meta */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>

            {/* Avatar — fades to 60 % when paused */}
            <div
              style={{
                opacity:    paused ? 0.6 : 1,
                flexShrink: 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              <PersonaAvatar avatarUrl={avatarUrl} name={name} avatarSeed={avatarSeed} />
            </div>

            {/* Meta column */}
            <div style={{ flex: 1, minWidth: 0 }}>

              {/* Name row + ··· menu */}
              <div
                style={{
                  display:        'flex',
                  alignItems:     'flex-start',
                  justifyContent: 'space-between',
                  gap:            4,
                }}
              >
                <span
                  title={name}
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontSize:     'var(--font-size-body-lg)',
                    // Tighter than --line-height-body-lg (~24px) — that much
                    // leading was the real source of the name/handle gap,
                    // not the handle's own margin.
                    lineHeight:   '20px',
                    fontWeight:   'var(--font-weight-regular)',
                    color:        'var(--neutral-950)',
                    flex:         1,
                    minWidth:     0,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                    opacity:      paused ? 0.6 : 1,
                    transition:   'opacity 0.2s ease',
                  }}
                >
                  {name}
                </span>

                {/* Community: bookmark icon + save count in name row */}
                {isCommunity && (
                  <div
                    style={{
                      display:    'flex',
                      alignItems: 'center',
                      gap:        2,
                      flexShrink: 0,
                    }}
                  >
                    <IconButton
                      variant="ghost"
                      size="xs"
                      aria-label="Bookmark agent"
                      icon={<BookmarkTwoIcon />}
                      onClick={onBookmark}
                    />
                    {useCount !== undefined && (
                      <span
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize:   'var(--font-size-caption)',
                          lineHeight: 'var(--line-height-caption)',
                          color:      'var(--neutral-400)',
                          flexShrink: 0,
                        }}
                      >
                        {formatCount(useCount)}
                      </span>
                    )}
                  </div>
                )}

                {/* ··· menu trigger + dropdown (default variant only) */}
                {!isTemplate && !isCommunity && !modelUnavailable && (
                  // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
                  <div
                    ref={menuTriggerRef}
                    style={{ position: 'relative', flexShrink: 0 }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                  >
                    <IconButton
                      variant="ghost"
                      size="xs"
                      aria-label="More options"
                      icon={<MoreVerticalIcon />}
                      onClick={handleMenuToggle}
                    />

                    {/* Dropdown menu */}
                    <AnimatePresence>
                      {menuOpen && (
                        <>
                          {/* Click-outside backdrop */}
                          {/* eslint-disable-next-line no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements */}
                          <div
                            style={{
                              position: 'fixed',
                              inset:    0,
                              zIndex:   10,
                            }}
                            onMouseDown={() => setMenuOpen(false)}
                          />
                          <m.div
                            {...DROPDOWN_SCALE_PRESET}
                            initial={{ ...DROPDOWN_SCALE_PRESET.initial, transformOrigin: dropUp ? 'bottom center' : 'top center' }}
                            animate={{ ...DROPDOWN_SCALE_PRESET.animate, transformOrigin: dropUp ? 'bottom center' : 'top center' }}
                            style={{
                              position: 'absolute',
                              ...(dropUp ? { bottom: 28, top: 'auto' } : { top: 28 }),
                              right:    0,
                              zIndex:   20,
                            }}
                          >
                            <Dropdown size="sm">
                              <Dropdown.Section fluid>
                                {onMenuEdit && (
                                  <Dropdown.Item
                                    label="Edit"
                                    icon={<PenOneIcon />}
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuEdit() }}
                                  />
                                )}
                                {onMenuShare && (
                                  <Dropdown.Item
                                    label="Share"
                                    icon={<ShareOneIcon />}
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuShare() }}
                                  />
                                )}
                                {onMenuPauseToggle && (
                                  <Dropdown.Item
                                    label={paused ? 'Resume' : 'Pause'}
                                    icon={paused ? <ArrowRightTwoIcon /> : <StopCircleIcon />}
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuPauseToggle() }}
                                  />
                                )}
                              </Dropdown.Section>
                              {onMenuDuplicate && (
                                <Dropdown.Section fluid divider>
                                  <Dropdown.Item
                                    label="Copy & Edit"
                                    icon={<CopyOneIcon />}
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuDuplicate() }}
                                  />
                                </Dropdown.Section>
                              )}
                              {onMenuDelete && (
                                <Dropdown.Section fluid divider>
                                  <Dropdown.Item
                                    label="Delete"
                                    variant="danger"
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuDelete() }}
                                  />
                                </Dropdown.Section>
                              )}
                            </Dropdown>
                          </m.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Handle */}
              <div
                style={{
                  marginTop:  -2,
                  opacity:    paused ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize:   'var(--font-size-code)',
                    lineHeight: '14px',
                    color:      'var(--neutral-400)',
                  }}
                >
                  @{handle}
                </span>
              </div>

              {/* Badge row — single line, horizontally scrollable, drag-to-scroll */}
              <div style={{ position: 'relative', margin: '3px -1px 0' }}>
                <div
                  ref={tagRowRef}
                  onMouseDown={onTagRowMouseDown}
                  onMouseMove={onTagRowMouseMove}
                  onMouseUp={onTagRowMouseUp}
                  onMouseLeave={onTagRowMouseUp}
                  onScroll={updateTagRowEdges}
                  style={{
                    display:             'flex',
                    flexWrap:            'nowrap',
                    gap:                 4,
                    overflowX:           'auto',
                    overscrollBehaviorX: 'contain',
                    scrollbarWidth:      'none',
                    padding:             '1px',
                    cursor:              'grab',
                    userSelect:          'none',
                  }}
                >
                  {variant === 'community-imported' && (
                    <Badge color="Green" label="Imported" />
                  )}
                  {isDraft && (
                    <Badge color="Yellow" label="Draft" />
                  )}
                  {shared && (
                    <Badge color="Blue" label="Shared" />
                  )}
                  {superlink && (
                    <Badge color="Blue" label="Superlink" />
                  )}
                  {paused && (
                    <Badge color="Yellow" label="Paused" />
                  )}
                  {tags.map(tag => (
                    <Badge key={tag} color="Neutral" label={tag} />
                  ))}
                </div>

                {/* Edge fades — only visible once there's actually more to scroll to. */}
                <div
                  aria-hidden
                  style={{
                    position:      'absolute',
                    top:           0,
                    bottom:        0,
                    left:          0,
                    width:         16,
                    background:    `linear-gradient(to right, ${isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)'} 0%, transparent 100%)`,
                    pointerEvents: 'none',
                    opacity:       tagRowAtStart ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position:      'absolute',
                    top:           0,
                    bottom:        0,
                    right:         0,
                    width:         16,
                    background:    `linear-gradient(to left, ${isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)'} 0%, transparent 100%)`,
                    pointerEvents: 'none',
                    opacity:       tagRowAtEnd ? 0 : 1,
                    transition:    'opacity 150ms ease',
                  }}
                />
              </div>

            </div>{/* /Meta column */}
          </div>{/* /Header row */}

          {/* Description */}
          {description && (
            <p
              title={description}
              style={{
                margin:           '8px 0 0',
                fontFamily:       'var(--font-body)',
                fontSize:         'var(--font-size-caption)',
                lineHeight:       'var(--line-height-caption)',
                color:            'var(--neutral-500)',
                display:          '-webkit-box',
                WebkitLineClamp:  2,
                WebkitBoxOrient:  'vertical',
                overflow:         'hidden',
              }}
            >
              {description}
            </p>
          )}

          {/* Footer — visibility bottom-left, "Created by" bottom-right.
              Separate from the scrolling tag/badge row above (never pushed
              out of view), and pinned to the bottom of the fixed-height card
              via marginTop:'auto' regardless of how much content sits above
              it — this is what keeps every card the same height. No
              minWidth/overflow clamps on the slots — those clipped content
              before; both sides are short enough to size to their own
              content within the card's width. */}
          {(visibility || createdBy) && (
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                flexWrap:       'wrap',
                gap:            6,
                marginTop:      'auto',
                paddingTop:     8,
                borderTop:      '1px solid var(--neutral-100)',
              }}
            >
              {/* Bottom-left slot: visibility — "N teams" rather than the
                  team's actual name, so this never depends on a name lookup.
                  A plain wrapper so a single badge still anchors to this side
                  under space-between instead of collapsing to flex-start. */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {visibility === 'team' ? (
                  <Badge
                    color="Neutral"
                    label={teamCount ? `${teamCount} team${teamCount === 1 ? '' : 's'}` : 'Team'}
                  />
                ) : visibility === 'private' ? (
                  <Badge color="Neutral" label="Private" />
                ) : null}
              </div>

              {/* Bottom-right slot: creator attribution. */}
              <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                {createdBy && (
                  <span
                    title={`Created by ${createdBy}`}
                    style={{
                      fontFamily:   'var(--font-body)',
                      fontSize:     'var(--font-size-caption)',
                      lineHeight:   'var(--line-height-caption)',
                      color:        'var(--neutral-500)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                    }}
                  >
                    Created by {createdBy}
                  </span>
                )}
              </div>
            </div>
          )}

        </div>{/* /Main content */}

        {/* ── Action bar — hover-triggered absolute overlay, same for every variant ── */}
        <AnimatePresence initial={false}>
          {isHovered && !modelUnavailable && (
            <ActionBar
              key="action-bar"
              type={actionBarType}
              isDraft={isDraft}
              authorHandle={authorHandle}
              authorAvatarUrl={authorAvatarUrl}
              onEdit={onEdit}
              onLink={onLink}
              onUseInChat={onUseInChat}
              useInChatLabel={useInChatLabel}
              onResume={onResume}
              onTry={onTry}
              onOpen={onOpen}
            />
          )}
        </AnimatePresence>

        {/* ── Model unavailable — muted scrim + centered "Change model" over
            the dimmed content (kept faintly visible so the card still reads
            as "this agent", just not usable right now). The card body above
            has pointerEvents:none, so this is the only interactive surface
            left on the card. ── */}
        {modelUnavailable && (
          <>
            <div
              aria-hidden
              style={{
                position:        'absolute',
                inset:           0,
                borderRadius:    16,
                backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)',
                opacity:         0.6,
                zIndex:          1,
              }}
            />
            <div
              style={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            10,
                padding:        16,
                textAlign:      'center',
                zIndex:         2,
              }}
            >
              <AlertTwoIcon animated size={20} color="var(--color-tag-Yellow-text)" />
              <p
                style={{
                  margin:     0,
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-500)',
                }}
              >
                This agent&apos;s model is unavailable.
              </p>
              <Button variant="ghost" size="sm" onClick={onChangeModel}>
                Change model
              </Button>
            </div>
          </>
        )}

      </Comp>
    )
}

export const PersonaCard = React.memo(PersonaCardInner)
PersonaCard.displayName = 'PersonaCard'
export default PersonaCard
