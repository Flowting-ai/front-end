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
  InformationCircleIcon,
} from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'
import { cn } from '@/lib/utils'
import { getPersonaFallbackAvatar } from '@/lib/persona-template-avatars'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import {
  AnimatedPersonaAvatar,
  AVATAR_THEMES,
  getAvatarColors,
  getAvatarChoice,
  defaultAvatarChoice,
  type AvatarChoice,
  GENERIC_STATUS,
  pickAvatarTheme,
  type AvatarTheme,
} from './AnimatedPersonaAvatar'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_CARD          = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
// Hover lifts the 1px ring a few steps — the reference card's border-color brighten.
const SHADOW_CARD_HOVER    = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-400)'
const SHADOW_CARD_TEMPLATE ='0px 2px 2.8px 0px var(--blue-100), 0px 0px 0px 1px var(--neutral-100)'

// Fixed height for default/draft cards so every card in a grid lines up
// regardless of description length or which badges/footer content is
// present — the footer is pinned to the bottom of this via marginTop:'auto'
// rather than sitting wherever the content above happens to end.
const CARD_HEIGHT = 264
/** Card size, for layouts and skeletons that must match it. */
export const PERSONA_CARD_HEIGHT = CARD_HEIGHT
export const PERSONA_CARD_WIDTH = 314

// Avatar size — centered at the top of the card.
// How far the translucent halo circle extends past the avatar on each side.
const HALO_OVERHANG = 9
const AVATAR_SIZE = 88

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

// ── StatusTicker ──────────────────────────────────────────────────────────────
// Live status in the hover action bar: steps through `messages` every 1.2s
// (each line rising in) while a 1px progress line sweeps the bar's top edge,
// staying full once the last line lands. Mounts on hover, so its clock starts
// at hover-in.

const STATUS_STEP_S = 1.2
const RISE = {
  initial:    { y: 8, opacity: 0 },
  animate:    { y: 0, opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
}

function StatusTicker({ messages, inline = false }: { messages: string[]; inline?: boolean }) {
  const [idx, setIdx] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  // Once the last line ("ready") lands the loader is finished: the line stops shimmering
  // and settles to a plain solid silver.
  const done = idx === messages.length - 1

  useEffect(() => {
    const start = performance.now() / 1000
    const lastIdx = messages.length - 1
    let raf = 0
    const tick = () => {
      const t    = performance.now() / 1000 - start
      const next = Math.min(Math.floor(t / STATUS_STEP_S), lastIdx)
      setIdx(next)
      if (barRef.current) {
        const pct = next === lastIdx ? 100 : ((t % STATUS_STEP_S) / STATUS_STEP_S) * 100
        barRef.current.style.width = `${pct}%`
      }
      if (next < lastIdx) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [messages])

  return (
    <>
      {/* Full-width shimmering track — keeps the line visible for the whole run, not just as it fills. */}
      {inline && !done && (
        <div
          aria-hidden
          className="kaya-silver-line"
          style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 2, borderRadius: 1, opacity: 0.35, pointerEvents: 'none' }}
        />
      )}
      <div
        ref={barRef}
        aria-hidden
        className={done ? undefined : 'kaya-silver-line'}
        style={{
          position:        'absolute',
          ...(inline ? { bottom: -4 } : { top: -1 }),
          ...(done ? { backgroundColor: '#C0C0C0' } : null),
          left:            0,
          height:          2,
          borderRadius:    1,
          width:           0,
          pointerEvents:   'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', justifyContent: inline ? 'center' : 'flex-end' }}>
        <m.span
          key={idx}
          {...RISE}
          style={{
            display:      'inline-block',
            fontFamily:   'var(--font-body)',
            fontSize:     'var(--font-size-caption)',
            lineHeight:   'var(--line-height-caption)',
            color:        'var(--neutral-500)',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
            maxWidth:     '100%',
          }}
        >
          {messages[idx]}
        </m.span>
      </div>
    </>
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
  /**
   * Avatar image URL. Not rendered on the card — every card draws the
   * animated gooey avatar (agent_cards_iteration_2) instead; kept so callers
   * and other surfaces sharing these props needn't change.
   */
  avatarUrl?: string
  /** Stable persona id used to select the deterministic fallback avatar. */
  avatarSeed?: string
  /**
   * Avatar interior theme. Omit to pick from the agent's name; pass null
   * for a plain sphere with no interior detail.
   */
  avatarTheme?: AvatarTheme | null
  /** A picked avatar (see AVATAR_CHOICES) — wins over the name-based theme. */
  avatarChoice?: AvatarChoice | null
  /** The agent's repo id — looks up the avatar the user picked for it. */
  repoId?: string

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
   * the card, suppresses its normal hover actions, and shows a centered
   * message with a "Change model" ghost button instead. Applies to the
   * 'default' variant only.
   *
   * The ··· menu stays live: only inference is broken, so renaming,
   * duplicating, pausing and deleting the agent must all still work.
   */
  modelUnavailable?: boolean
  /**
   * Why it's unavailable, which changes the copy — 'blocked' is something
   * this account did (turned the model off), 'retired' is the provider
   * dropping it. Defaults to 'retired' phrasing.
   */
  modelUnavailableReason?: 'retired' | 'blocked'
  /** Display name of the unavailable model, so the message can name it. */
  unavailableModelName?: string | null
  /**
   * "Change model" button shown when `modelUnavailable` is true. Omit it when
   * the agent has no version to patch — the message renders without a button
   * rather than showing one that can't do anything.
   */
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
  /** ··· menu → Details (opens the agent details side panel) */
  onMenuDetails?:       () => void
  /** ··· menu → Edit */
  onMenuEdit?:          () => void
  /** ··· menu → Share (navigates to the sharing configuration page) */
  onMenuShare?:         () => void
  /** ··· menu → Duplicate */
  onMenuDuplicate?:     () => void
  /** ··· menu → Pause / Resume (toggles based on `paused`) */
  onMenuPauseToggle?:   () => void
  /**
   * True while a pause/resume request for this persona is in flight — shows
   * a spinner on the Resume action-bar button and the ··· menu's Pause/Resume
   * item, and blocks re-triggering either while pending.
   */
  pausePending?:        boolean
  /** ··· menu → Delete */
  onMenuDelete?:        () => void

  /** Hides the ··· options menu (compact lists where the card just opens details). */
  hideMenu?: boolean

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
  resumePending,
  onTry,
  onOpen,
  statusMessages,
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
  resumePending?:   boolean
  onTry?:           () => void
  onOpen?:          () => void
  statusMessages?:  string[]
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
        backgroundColor:         isDraft ? 'var(--neutral-50)' : 'var(--agent-card-bg)',
        borderBottomLeftRadius:  16,
        borderBottomRightRadius: 16,
        padding:                 '8px 10px',
        display:                 'flex',
        alignItems:              'center',
        gap:                     6,
        zIndex:                  1,
        pointerEvents:           isPresent ? 'auto' : 'none',
        // Stands in for the footer divider it covers, so the status
        // ticker's progress line has an edge to sweep along.
        borderTop:               statusMessages ? '1px solid var(--neutral-100)' : undefined,
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
          {statusMessages ? <StatusTicker messages={statusMessages} /> : <div style={{ flex: 1 }} />}
          <Button variant="secondary" size="sm" onClick={onUseInChat}>{useInChatLabel}</Button>
        </>
      )}

      {type === 'resume' && onResume && (
        <Button variant="outline" size="sm" style={{ flex: 1 }} loading={resumePending} disabled={resumePending} onClick={onResume}>Resume</Button>
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
      handle:        _handle,
      description,
      avatarUrl:     _avatarUrl,
      avatarSeed,
      avatarTheme:   avatarThemeProp,
      avatarChoice:  avatarChoiceProp,
      repoId,
      hovered:       hoveredProp,
      paused         = false,
      superlink      = false,
      modelUnavailable = false,
      modelUnavailableReason = 'retired',
      unavailableModelName,
      onChangeModel,
      createdBy,
      visibility,
      teamCount,
      tags:          _tags = EMPTY_PERSONA_TAGS,
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
      onMenuDetails,
      onMenuEdit,
      onMenuShare,
      onMenuDuplicate,
      onMenuPauseToggle,
      pausePending    = false,
      onMenuDelete,
      hideMenu       = false,
      asChild        = false,
      className,
      style,
      onMouseEnter:  onMouseEnterProp,
      onMouseLeave:  onMouseLeaveProp,
      onClick:       onClickProp,
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

    // ── Animation ─────────────────────────────────────────────────────────────
    // Avatar theme + status copy: explicit `avatarTheme` prop wins, otherwise
    // it's picked from the agent's name (null → plain sphere, generic copy).
    const seed = avatarSeed || name
    const storedChoice = useStoredAvatarChoice(repoId)
    // A picked avatar wins; for a known agent with none picked, the same default the other
    // surfaces compute from its name + repo id, so one agent looks identical everywhere.
    const chosenId = avatarChoiceProp ?? storedChoice ?? (repoId && avatarThemeProp === undefined ? defaultAvatarChoice(name, repoId) : null)
    const picked = chosenId ? getAvatarChoice(chosenId) : null
    const avatarTheme = picked ? picked.theme : avatarThemeProp !== undefined ? avatarThemeProp : pickAvatarTheme(name)
    const avatarColors = picked?.colors ?? getAvatarColors(avatarTheme, seed)
    const statusMessages = avatarTheme ? AVATAR_THEMES[avatarTheme].status : GENERIC_STATUS
    const [bounceKey,  setBounceKey]  = useState(0)
    // Bumped on hover-out so "Created by" rises back in, like the reference
    // footer label returning after its status run.
    const [leaveCount, setLeaveCount] = useState(0)
    const animateHover = isHovered && !modelUnavailable
    const statusBadgesShown = variant === 'community-imported' || isDraft || shared || superlink || paused

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
          setLeaveCount(n => n + 1)
          onMouseLeaveProp?.(e)
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!modelUnavailable) setBounceKey(n => n + 1)
          onClickProp?.(e)
        }}
        style={{
          position:        'relative',
          width:           314,
          height:          (!isTemplate && !isCommunity) ? CARD_HEIGHT : undefined,
          borderRadius:    16,
          backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--agent-card-bg)',
          // Dark: pink → black → dark pink toward the bottom-right. Light: none (flat colour above).
          backgroundImage: isDraft ? undefined : 'var(--agent-card-gradient)',
          // Reverse zoom: rests zoomed-in, then slowly zooms OUT to the full gradient on hover.
          backgroundSize:     animateHover || isDraft ? '100% 100%' : '260% 260%',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
          boxShadow:       isTemplate ? SHADOW_CARD_TEMPLATE : (animateHover && !isDraft ? SHADOW_CARD_HOVER : SHADOW_CARD),
          border:          isDraft
            ? `1px dashed ${isHovered ? 'var(--neutral-400)' : 'var(--neutral-300)'}`
            : undefined,
          cursor:          modelUnavailable ? 'default' : 'pointer',
          boxSizing:       'border-box' as const,
          zIndex:          menuOpen ? 100 : undefined,
          opacity:         pausePending ? 0.6 : 1,
          pointerEvents:   pausePending ? 'none' : undefined,
          transition:      'opacity 150ms, box-shadow 300ms, background-size 900ms cubic-bezier(0.22, 1, 0.36, 1)',
          ...style,
        }}
        // Dark mode: the card sits on a lighter grey, so its muted text/icon tones are lifted
        // (see theme.css "Raised surface"). No effect in light.
        data-surface="raised"
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
            // No opacity here when unavailable — the scrim below already dims
            // the content, and `opacity < 1` would create a stacking context
            // that traps the ··· menu underneath it.
            pointerEvents: modelUnavailable ? 'none' : undefined,
            transition:    'opacity 0.2s ease',
          }}
        >

          {/* Identity block (avatar, name, description) — vertically centred in the space above the footer */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

          {/* Header row: avatar + meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>

            {/* Avatar — fades to 60 % when paused */}
            <div
              style={{
                position:   'relative',
                // Room for the halo, which overhangs the avatar by HALO_OVERHANG on every side.
                margin:     `${HALO_OVERHANG - 6}px 0 ${HALO_OVERHANG - 8}px`,
                opacity:    paused ? 0.6 : 1,
                flexShrink: 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              {/* Medium-opacity circle behind the avatar, larger in radius than it. */}
              <div
                aria-hidden
                style={{
                  position:        'absolute',
                  inset:           -HALO_OVERHANG,
                  borderRadius:    '50%',
                  zIndex:          0,
                  // Same colour as the avatar sphere, at 40% opacity.
                  backgroundColor: `color-mix(in srgb, ${avatarColors[0]} 40%, transparent)`,
                  pointerEvents:   'none',
                }}
              />
              {/* Avatar: white-backed circle sitting ABOVE the halo (a positioned wrapper,
                  since the halo is absolutely positioned and would otherwise paint over it). */}
              <div style={{ position: 'relative', zIndex: 1, borderRadius: '50%', backgroundColor: '#FFFFFF' }}>
              <AnimatedPersonaAvatar
                size={AVATAR_SIZE}
                radius="50%"
                theme={avatarTheme}
                colors={picked?.colors}
                seed={seed}
                hovered={animateHover}
                bounceKey={bounceKey}
                inert={paused || modelUnavailable}
              />
              </div>
            </div>

            {/* Meta column */}
            <div style={{ width: '100%', minWidth: 0 }}>

              {/* Name row (centered) — bookmark / ··· menu float in the top-right corner */}
              <div
                style={{
                  display:        'flex',
                  alignItems:     'flex-start',
                  justifyContent: 'center',
                  gap:            4,
                  padding:        '0 22px',
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
                    fontWeight:   'var(--font-weight-semibold)',
                    textAlign:    'center',
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
                      position:   'absolute',
                      top:        8,
                      right:      8,
                      zIndex:     2,
                      display:    'flex',
                      alignItems: 'center',
                      gap:        2,
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

                {/* ··· menu trigger + dropdown (default variant only).
                    Stays interactive when the model is unavailable — the
                    surrounding content sets pointerEvents:none and the scrim
                    paints over it, so this opts both back in for itself. */}
                {!isTemplate && !isCommunity && !hideMenu && (
                  // eslint-disable-next-line click-events-have-key-events, no-static-element-interactions -- interactive div; keyboard handling delegated to inner elements
                  <div
                    ref={menuTriggerRef}
                    style={{
                      position:      'absolute',
                      top:           8,
                      right:         8,
                      zIndex:        2,
                      ...(modelUnavailable ? { zIndex: 3, pointerEvents: 'auto' as const } : null),
                    }}
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
                            <Dropdown size="sm" maxHeight={false}>
                              <Dropdown.Section fluid>
                                {onMenuDetails && (
                                  <Dropdown.Item
                                    label="Details"
                                    icon={<InformationCircleIcon />}
                                    fluid
                                    onClick={() => { setMenuOpen(false); onMenuDetails() }}
                                  />
                                )}
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
                                    loading={pausePending}
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

            </div>{/* /Meta column */}
          </div>{/* /Header row */}

          {/* Description */}
          {(description || (!isTemplate && !isCommunity)) && (
            <p
              title={description}
              className={animateHover ? 'persona-card-desc-reading' : undefined}
              style={{
                margin:           '8px 0 0',
                // Always two lines tall, so avatar/name/description sit in the same place on
                // every card whether the description is one line or two.
                minHeight:        'calc(2 * var(--line-height-caption))',
                textAlign:        'center',
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

          </div>{/* /Identity block */}

          {/* Hover status ticker — a fixed slot pinned directly above the footer on every
              default card (reserved even when idle, so nothing shifts on hover). Mounts the
              ticker on hover so its clock starts at hover-in. */}
          {actionBarType === 'hover' && (
            <div style={{ position: 'relative', display: 'flex', marginTop: 'auto', minHeight: 16, paddingBottom: 22 }}>
              {animateHover && (
                <m.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0 }}
                >
                  <StatusTicker inline messages={statusMessages} />
                </m.div>
              )}
            </div>
          )}

          {/* Footer — status tags bottom-left, "Created by" bottom-right (end to end).
              Pinned to the bottom of the fixed-height card
              via marginTop:'auto' regardless of how much content sits above
              it — this is what keeps every card the same height. No
              minWidth/overflow clamps on the slots — those clipped content
              before; both sides are short enough to size to their own
              content within the card's width. */}
          {(visibility || createdBy || statusBadgesShown) && (
            <div
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                flexWrap:       'wrap',
                gap:            6,
                marginTop:      actionBarType === 'hover' ? 0 : 'auto',
                paddingTop:     8,
                borderTop:      '1px solid var(--neutral-100)',
              }}
            >
              {/* Bottom-left slot: status tags only (Draft / Imported / Shared /
                  Superlink / Paused) plus visibility — "N teams" rather than the
                  team's actual name, so this never depends on a name lookup.
                  Descriptive tags are intentionally not shown on the card. */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', minWidth: 0 }}>
                {variant === 'community-imported' && <Badge color="Green" label="Imported" />}
                {isDraft && <Badge color="Yellow" label="Draft" />}
                {shared && <Badge color="Blue" label="Shared" />}
                {superlink && <Badge color="Blue" label="Superlink" />}
                {paused && <Badge color="Yellow" label="Paused" />}
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
                  <m.span
                    key={leaveCount}
                    {...(leaveCount > 0 ? RISE : null)}
                    title={`Created by ${createdBy}`}
                    style={{
                      fontFamily:   'var(--font-body)',
                      fontSize:     'var(--font-size-caption)',
                      lineHeight:   'var(--line-height-caption)',
                      color:        'var(--neutral-500)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      display:      'inline-block',
                    }}
                  >
                    Created by {createdBy}
                  </m.span>
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
              resumePending={pausePending}
              onTry={onTry}
              onOpen={onOpen}
            />
          )}
        </AnimatePresence>

        {/* ── Model unavailable — muted scrim + centered "Change model" over
            the dimmed content (kept faintly visible so the card still reads
            as "this agent", just not usable right now). The card body above
            has pointerEvents:none, so this and the ··· menu (which lifts
            itself to zIndex 3) are the only interactive surfaces left. ── */}
        {modelUnavailable && (
          <>
            <div
              aria-hidden
              style={{
                position:        'absolute',
                inset:           0,
                borderRadius:    16,
                backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--agent-card-bg)',
                // Carries the whole dim now that the content div no longer
                // fades itself (see the pointerEvents note above).
                opacity:         0.72,
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
                {unavailableModelName
                  ? modelUnavailableReason === 'blocked'
                    ? `${unavailableModelName} is turned off.`
                    : `${unavailableModelName} is no longer available.`
                  : modelUnavailableReason === 'blocked'
                    ? 'This agent’s model is turned off.'
                    : 'This agent’s model is no longer available.'}
              </p>
              {onChangeModel && (
                <Button variant="ghost" size="sm" onClick={onChangeModel}>
                  Change model
                </Button>
              )}
            </div>
          </>
        )}

      </Comp>
    )
}

export const PersonaCard = React.memo(PersonaCardInner)
PersonaCard.displayName = 'PersonaCard'
export default PersonaCard
