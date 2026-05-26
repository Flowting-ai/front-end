'use client'

import React, { useState, useCallback, useEffect } from 'react'
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
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { cn } from '@/lib/utils'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_CARD          = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
const SHADOW_CARD_TEMPLATE = '0px 2px 2.8px 0px var(--blue-100), 0px 0px 0px 1px var(--neutral-100)'

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

// ── Persona fallback avatars ──────────────────────────────────────────────────
// Deterministically assigns one of 18 marble avatars when no avatarUrl is set.

const FALLBACK_AVATARS = [
  '/persona-avatars/0656f3b794e38cb70243c01880ae7e8c.jpg',
  '/persona-avatars/0d76e6ce216e9a37aabb374a0b5ff373.jpg',
  '/persona-avatars/1a28810d426619782dd1d5a595389cc1.jpg',
  '/persona-avatars/2d566c8909b00dd3a384be6fff13dde6.jpg',
  '/persona-avatars/3df055256e83c4e96b7d12375b0350c7.jpg',
  '/persona-avatars/545edd8b11f485a6af182827235fe77b.jpg',
  '/persona-avatars/610d02a62c92aabef208323fb3eb963b.jpg',
  '/persona-avatars/61a217559aa4835edef3077e097d8bff.jpg',
  '/persona-avatars/654341558b7022e87d7c11ad97c043f2.jpg',
  '/persona-avatars/67426067d03211790d002ab8dfd355b1.jpg',
  '/persona-avatars/7f4fa28c942a9c408d96c4b5f3adcfbe.jpg',
  '/persona-avatars/81fd248d2aea38920976f7d6420f90ca.jpg',
  '/persona-avatars/88dfe7bf97d198e8e9abb38db9d3f6a9.jpg',
  '/persona-avatars/b651f98459d8d64940c19220dc05e83c.jpg',
  '/persona-avatars/b75eeab04cced8e1a3d2edb69f2e134d.jpg',
  '/persona-avatars/c70a7e37d62d3983cc8561af76e98f40.jpg',
  '/persona-avatars/eed3b5053d44561ee17a1411b3c399dd.jpg',
  '/persona-avatars/eeef0281aa011612dac0bfc085d7798c.jpg',
] as const

function getFallbackAvatar(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_AVATARS[hash % FALLBACK_AVATARS.length]
}

// ── PersonaAvatar ─────────────────────────────────────────────────────────────
// 65 × 65 rounded avatar — shows saved image URL, falls back to initials.

function PersonaAvatar({
  avatarUrl,
  name,
  size   = 65,
  radius = 8,
}: {
  avatarUrl?: string
  name:       string
  size?:      number
  radius?:    number
}) {
  const [imgError, setImgError] = useState(false)
  const showImage = avatarUrl && !imgError

  if (showImage) {
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
        {/* eslint-disable-next-line @next/next/no-img-element, react-doctor/nextjs-no-img-element -- dynamic avatar URL, onError fallback requires HTMLImageElement access */}
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  const initials = (name ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase() || '?'

  return (
    <div
      aria-hidden
      style={{
        width:           size,
        height:          size,
        borderRadius:    radius,
        flexShrink:      0,
        background:      'var(--neutral-100)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        Math.round(size * 0.3),
        color:           'var(--neutral-500)',
        userSelect:      'none',
      }}
    >
      {initials}
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
   * Show the model badge in the badge row. Supply `modelName` to customise
   * the label (defaults to "Claude : Sonnet").
   */
  modelVisible?: boolean
  /** Model badge label. Only rendered when `modelVisible` is true. */
  modelName?: string

  /**
   * Visibility badge shown in the badge row.
   * 'private' → "Private" (Neutral)  |  'team' → "Team" (Neutral)
   */
  visibility?: 'private' | 'team'
  /** Additional Neutral tag badges shown in the badge row (e.g. ["Research"]). */
  tags?: string[]

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
          <IconButton variant="ghost" size="sm" aria-label="Edit persona" icon={<PenOneIcon />} onClick={onEdit} />
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" onClick={onUseInChat}>Use in chat</Button>
        </>
      )}

      {type === 'resume' && (
        <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={onResume}>Resume</Button>
      )}

      {type === 'draft' && (
        <>
          <IconButton variant="ghost" size="sm" aria-label="Edit draft" icon={<PenOneIcon />} onClick={onEdit} />
          <div style={{ flex: 1 }} />
          <Button variant="outline" size="sm" onClick={onEdit}>Continue building</Button>
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
                  src={authorAvatarUrl ?? getFallbackAvatar(authorHandle)}
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
      hovered:       hoveredProp,
      paused         = false,
      superlink      = false,
      modelVisible   = false,
      modelName      = 'Claude : Sonnet',
      visibility,
      tags           = EMPTY_PERSONA_TAGS,
      authorHandle,
      authorAvatarUrl,
      useCount,
      onEdit,
      onLink,
      onUseInChat,
      onPause:       _onPause,
      onResume,
      onCopy,
      onTry,
      onOpen,
      onBookmark,
      onMenuEdit,
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
      document.addEventListener('mousedown', close)
      return () => document.removeEventListener('mousedown', close)
    }, [menuOpen])

    const handleMenuToggle = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      setMenuOpen(v => !v)
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
          minHeight:       isDraft ? 138 : undefined,
          borderRadius:    16,
          backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--neutral-white)',
          boxShadow:       isTemplate ? SHADOW_CARD_TEMPLATE : SHADOW_CARD,
          border:          isDraft
            ? `1px dashed ${isHovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`
            : undefined,
          cursor:          'default',
          boxSizing:       'border-box' as const,
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
        <div style={{ padding: 12 }}>

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
              <PersonaAvatar avatarUrl={avatarUrl} name={name} />
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
                  opacity:        paused ? 0.6 : 1,
                  transition:     'opacity 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontSize:     'var(--font-size-body-lg)',
                    lineHeight:   'var(--line-height-body-lg)',
                    fontWeight:   'var(--font-weight-regular)',
                    color:        'var(--neutral-950)',
                    flex:         1,
                    minWidth:     0,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
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
                      aria-label="Bookmark persona"
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
                {!isTemplate && !isCommunity && (
                  // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
                  <div
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
                            style={{
                              position: 'absolute',
                              top:      28,
                              right:    0,
                              zIndex:   20,
                            }}
                          >
                            <Dropdown size="sm">
                              <Dropdown.Section fluid>
                                <Dropdown.Item
                                  label="Edit"
                                  icon={<PenOneIcon />}
                                  fluid
                                  onClick={() => { setMenuOpen(false); onMenuEdit?.() }}
                                />
                                <Dropdown.Item
                                  label={paused ? 'Resume' : 'Pause'}
                                  icon={paused ? <ArrowRightTwoIcon /> : <StopCircleIcon />}
                                  fluid
                                  onClick={() => { setMenuOpen(false); onMenuPauseToggle?.() }}
                                />
                              </Dropdown.Section>
                              <Dropdown.Section fluid divider>
                                <Dropdown.Item
                                  label="Delete"
                                  variant="danger"
                                  fluid
                                  onClick={() => { setMenuOpen(false); onMenuDelete?.() }}
                                />
                              </Dropdown.Section>
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
                  marginTop:  2,
                  opacity:    paused ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-code)',
                    fontSize:   'var(--font-size-code)',
                    lineHeight: 'var(--line-height-code)',
                    color:      'var(--neutral-400)',
                  }}
                >
                  @{handle}
                </span>
              </div>

              {/* Badge row — single line, horizontally scrollable, no wrap */}
              <div
                style={{
                  display:             'flex',
                  flexWrap:            'nowrap',
                  gap:                 4,
                  marginTop:           6,
                  overflowX:           'auto',
                  overscrollBehaviorX: 'contain',
                  scrollbarWidth:      'none',
                  padding:             '1px',
                  margin:              `5px -1px 0`,
                }}
              >
                {variant === 'community-imported' && (
                  <Badge color="Green" label="Imported" />
                )}
                {isDraft && (
                  <Badge color="Yellow" label="Draft" />
                )}
                {modelVisible && (
                  <Badge color="Red" label={modelName} />
                )}
                {superlink && (
                  <Badge color="Blue" label="Superlink" />
                )}
                {paused && (
                  <Badge color="Yellow" label="Paused" />
                )}
                {visibility === 'private' && <Badge color="Neutral" label="Private" />}
                {visibility === 'team'    && <Badge color="Neutral" label="Team"    />}
                {tags.map(tag => (
                  <Badge key={tag} color="Neutral" label={tag} />
                ))}
              </div>

            </div>{/* /Meta column */}
          </div>{/* /Header row */}

          {/* Description */}
          {description && (
            <p
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

        </div>{/* /Main content */}

        {/* ── Action bar — hover-triggered absolute overlay, same for every variant ── */}
        <AnimatePresence initial={false}>
          {isHovered && (
            <ActionBar
              key="action-bar"
              type={actionBarType}
              isDraft={isDraft}
              authorHandle={authorHandle}
              authorAvatarUrl={authorAvatarUrl}
              onEdit={onEdit}
              onLink={onLink}
              onUseInChat={onUseInChat}
              onResume={onResume}
              onTry={onTry}
              onOpen={onOpen}
            />
          )}
        </AnimatePresence>

      </Comp>
    )
}

export const PersonaCard = React.memo(PersonaCardInner)
PersonaCard.displayName = 'PersonaCard'
export default PersonaCard
