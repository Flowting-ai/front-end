'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import Image from 'next/image'
import { m, AnimatePresence } from 'framer-motion'
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
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Dropdown, DROPDOWN_SCALE_PRESET } from '@/components/Dropdown'
import { cn } from '@/lib/utils'
import { useStoredAvatarChoice } from '@/lib/avatar-choice'
import {
  getAvatarColors,
  getAvatarChoice,
  defaultAvatarChoice,
  type AvatarChoice,
  pickAvatarTheme,
  type AvatarTheme,
} from './AnimatedPersonaAvatar'
import { agentHeroStyle } from './AgentHero'
import { HeroScene, sceneFor, type AnySceneKind } from './HeroScene'
import { GazeChannel, type AvatarMood } from './gaze'
import { AgentOrb } from './AgentOrb'
import { Badge } from '@/components/Badge'
import { AgentCardButton } from './AgentCardButton'

// ── Shadows ───────────────────────────────────────────────────────────────────

const SHADOW_CARD          = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)'
// Hover lifts the 1px ring a few steps — the reference card's border-color brighten.
const SHADOW_CARD_HOVER    = '0px 2px 2.8px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-400)'
const SHADOW_CARD_TEMPLATE ='0px 2px 2.8px 0px var(--blue-100), 0px 0px 0px 1px var(--neutral-100)'

// Fixed height for default/draft cards so every card in a grid lines up
// regardless of description length or which badges/footer content is
// present — the footer is pinned to the bottom of this via marginTop:'auto'
// rather than sitting wherever the content above happens to end.
const CARD_HEIGHT = 320
/** Card size, for layouts and skeletons that must match it. */
export const PERSONA_CARD_HEIGHT = CARD_HEIGHT
export const PERSONA_CARD_WIDTH = 314

// Card layout, top to bottom: a tinted hero banner holding the avatar (50% of the card), the
// details — name, "by" line, description (35%) — and the action row (15%). Heights are px so the
// auto-height template/community variants keep the same banner and action row.
const CARD_RADIUS = 20
const HERO_HEIGHT = CARD_HEIGHT * 0.5
const ACTION_HEIGHT = CARD_HEIGHT * 0.15
const AVATAR_SIZE = 110
/** The hero sits this far in from the card's top and sides, like a screen in a bezel. */
const HERO_INSET = 6

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

// Rises the "by" line back in after the pointer leaves, like a label returning.
const RISE = {
  initial:    { y: 8, opacity: 0 },
  animate:    { y: 0, opacity: 1 },
  transition: { duration: 0.3, ease: 'easeOut' as const },
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
          color:      'var(--neutral-600)',
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
  /** A specific banner scene (e.g. a template's own job scene) — wins over the avatar theme's. */
  scene?: AnySceneKind
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
      scene:         sceneProp,
      repoId,
      hovered:       hoveredProp,
      paused         = false,
      superlink:     _superlink,
      modelUnavailable = false,
      modelUnavailableReason = 'retired',
      unavailableModelName,
      onChangeModel,
      createdBy,
      visibility:    _visibility,
      teamCount:     _teamCount,
      tags:          _tags = EMPTY_PERSONA_TAGS,
      shared:        _shared,
      authorHandle,
      authorAvatarUrl: _authorAvatarUrl,
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
    // Where the avatar's eyes look: the hero scene's lead element, or the pointer over the card.
    const [gaze] = useState(() => new GazeChannel())
    const [menuOpen,         setMenuOpen]         = useState(false)
    const [dropUp,           setDropUp]           = useState(false)
    const menuTriggerRef = useRef<HTMLDivElement>(null)

    // Keyboard focus inside the card counts as being there — it wakes the card like a hover.
    const [keyboardHot, setKeyboardHot] = useState(false)
    // Bumped per arrival, so the orb's "screen wake" sweep plays once each time.
    const [arrivals, setArrivals] = useState(0)
    // The button's own hover/keyboard focus — the arrow appears only then, not on card hover.
    const [ctaHot, setCtaHot] = useState(false)
    const isHovered   = hoveredProp ?? (internalHovered || keyboardHot)
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
    const [bounceKey,  setBounceKey]  = useState(0)
    // Bumped on hover-out so "Created by" rises back in, like the reference
    // footer label returning after its status run.
    const [leaveCount, setLeaveCount] = useState(0)
    const animateHover = isHovered && !modelUnavailable

    // The one centred button under the description — what a tap on this card should do.
    // Live agents "Use in chat"; a draft resumes building; a paused agent resumes; templates
    // try and community agents open. No handler → no button.
    const primary: { label: string; onClick: () => void; loading?: boolean } | null =
      paused && onResume ? { label: 'Resume', onClick: onResume, loading: pausePending } :
      isDraft && onEdit ? { label: 'Continue building', onClick: onEdit } :
      isTemplate && onTry ? { label: 'Try', onClick: onTry } :
      isCommunity && onOpen ? { label: 'Open', onClick: onOpen } :
      !paused && !isDraft && !isTemplate && !isCommunity && onUseInChat ? { label: useInChatLabel ?? 'Use in chat', onClick: onUseInChat } :
      null

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
    const mood: AvatarMood = modelUnavailable ? 'unavailable' : paused ? 'asleep' : isDraft ? 'drowsy' : 'awake'
    const canTilt = !modelUnavailable && !isDraft

    // Pointer over the card: the eyes follow it, the glare tracks it (--mx/--my) and the card
    // tilts toward it (--rx/--ry) — all straight onto the element, never through React state.
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      gaze.setPointer({ x: e.clientX, y: e.clientY })
      const el = e.currentTarget
      const box = el.getBoundingClientRect()
      const mx = e.clientX - box.left, my = e.clientY - box.top
      el.style.setProperty('--mx', `${mx.toFixed(0)}px`)
      el.style.setProperty('--my', `${my.toFixed(0)}px`)
      if (e.pointerType === 'mouse' && canTilt && !menuOpen) {
        el.style.setProperty('--ry', `${(((mx / box.width) * 2 - 1) * 4).toFixed(2)}deg`)
        el.style.setProperty('--rx', `${(-((my / box.height) * 2 - 1) * 3).toFixed(2)}deg`)
      }
    }
    const settle = (el: HTMLElement) => {
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }

    // "Use in chat" holds the eyes' attention — they look at it, happily.
    const attendTo = (el: HTMLElement | null) => {
      if (!el) { gaze.setAttention(null); return }
      const box = el.getBoundingClientRect()
      gaze.setAttention({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
    }

    return (
      <Comp
        ref={ref}
        className={cn('agent-card', className)}
        data-hot={(animateHover && !isDraft) || undefined}
        data-menu-open={menuOpen || undefined}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          setInternalHovered(true)
          setArrivals(n => n + 1)
          onMouseEnterProp?.(e)
        }}
        onPointerMove={handlePointerMove}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          gaze.setPointer(null)
          gaze.setAttention(null)
          settle(e.currentTarget)
          setInternalHovered(false)
          setLeaveCount(n => n + 1)
          onMouseLeaveProp?.(e)
        }}
        onFocus={(e: React.FocusEvent<HTMLDivElement>) => {
          if ((e.target as HTMLElement).matches(':focus-visible')) {
            if (!keyboardHot) setArrivals(n => n + 1)
            setKeyboardHot(true)
          }
        }}
        onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardHot(false)
        }}
        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
          if (!modelUnavailable) setBounceKey(n => n + 1)
          onClickProp?.(e)
        }}
        style={{
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          width:           314,
          height:          (!isTemplate && !isCommunity) ? CARD_HEIGHT : undefined,
          borderRadius:    CARD_RADIUS,
          backgroundColor: isDraft ? 'var(--neutral-50)' : 'var(--agent-card-bg)',
          // Dark: pink → black → dark pink toward the bottom-right. Light: none (flat colour above).
          backgroundImage: isDraft ? undefined : 'var(--agent-card-gradient)',
          // Reverse zoom: rests zoomed-in, then slowly zooms OUT to the full gradient on hover.
          backgroundSize:     animateHover || isDraft ? '100% 100%' : '260% 260%',
          backgroundPosition: 'center',
          backgroundRepeat:   'no-repeat',
          // Hot: lifted, with a shadow tinted by the agent's colour under the brightened ring.
          boxShadow:       isTemplate ? SHADOW_CARD_TEMPLATE : (animateHover && !isDraft
            ? `var(--lift-shadow), 0 24px 60px -20px color-mix(in srgb, ${avatarColors[0]} 40%, transparent), ${SHADOW_CARD_HOVER}`
            : SHADOW_CARD),
          border:          isDraft
            ? `1px dashed ${isHovered ? 'var(--neutral-600)' : 'var(--neutral-500)'}`
            : undefined,
          cursor:          modelUnavailable ? 'default' : 'pointer',
          boxSizing:       'border-box' as const,
          zIndex:          menuOpen ? 100 : undefined,
          opacity:         pausePending ? 0.6 : 1,
          pointerEvents:   pausePending ? 'none' : undefined,
          // Lift, tilt and their transitions come from .agent-card (globals.css).
          ['--c0' as string]: avatarColors[0],
          ['--c1' as string]: avatarColors[1],
          ...style,
        }}
        // Dark mode: the card sits on a lighter grey, so its muted text/icon tones are lifted
        // (see theme.css "Raised surface"). No effect in light.
        data-surface="raised"
        {...props}
      >
        {/* Pointer spotlight + lit border, while the card is hot. */}
        <div className="agent-card-glare" aria-hidden />

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

        {/* ── Hero: the agent's colour as a banner, avatar centred on it ───── */}
        {/* The hero is an inset "screen" (HERO_INSET in from the card's edges, concentric
            corners): the agent's living scene, with the avatar in its glass orb at the centre. */}
        <div
          className="agent-hero-screen"
          style={{
            position:     'relative',
            height:       HERO_HEIGHT - HERO_INSET,
            margin:       `${HERO_INSET}px ${HERO_INSET}px 0`,
            flexShrink:   0,
            borderRadius: CARD_RADIUS - HERO_INSET,
            ...agentHeroStyle(avatarColors[0]),
            // A draft is not live yet — mute its banner.
            opacity:      isDraft ? 0.55 : paused ? 0.6 : 1,
            transition:   'opacity 0.2s ease',
          }}
        >
          <HeroScene
            kind={sceneProp ?? sceneFor(avatarTheme)}
            colors={avatarColors}
            seed={seed}
            avatarSize={AVATAR_SIZE}
            hovered={animateHover && !isDraft}
            bounceKey={bounceKey}
            inert={paused || modelUnavailable}
            gaze={gaze}
            // Paused: a still, faded scene. Unavailable: still and grey. Draft: slow and faint.
            filter={modelUnavailable ? 'grayscale(1)' : paused ? 'saturate(0.35)' : undefined}
            pace={isDraft ? 0.4 : 1}
            opacity={isDraft ? 0.5 : 1}
          />
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}>
            <AgentOrb
              size={AVATAR_SIZE}
              theme={avatarTheme}
              colors={avatarColors}
              seed={seed}
              hovered={animateHover && !isDraft}
              wakeKey={arrivals}
              bounceKey={bounceKey}
              inert={paused || modelUnavailable}
              mood={mood}
              eyes
              gaze={gaze}
            />
            {paused && (
              <span className="agent-zzz" aria-hidden style={{ left: AVATAR_SIZE * 0.78, top: AVATAR_SIZE * 0.12 }}>
                <span>z</span><span>z</span><span>z</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Draft: tag in the top-left corner of the hero ──────────────── */}
        {isDraft && (
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
            <Badge color="Yellow" label="Draft" />
          </div>
        )}

        {/* ── Template: copy icon — top-right corner of the hero ─────────── */}
        {isTemplate && (
          <div
            style={{
              position:        'absolute',
              top:             10,
              right:           10,
              zIndex:          2,
              borderRadius:    8,
              backgroundColor: 'color-mix(in srgb, var(--neutral-white) 62%, transparent)',
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
            flex:          '1 1 0',
            minHeight:     0,
            boxSizing:     'border-box' as const,
            padding:       '14px 18px 0',
            // No opacity here when unavailable — the scrim below already dims
            // the content, and `opacity < 1` would create a stacking context
            // that traps the ··· menu underneath it.
            pointerEvents: modelUnavailable ? 'none' : undefined,
            transition:    'opacity 0.2s ease',
          }}
        >

          {/* Corner controls (bookmark / ··· menu) float over the hero's top-right. */}
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
                borderRadius:    8,
                padding:         '0 4px 0 0',
                backgroundColor: 'color-mix(in srgb, var(--neutral-white) 62%, transparent)',
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
              className="agent-card-chip"
              data-open={menuOpen || undefined}
              style={{
                position:      'absolute',
                top:           12,
                right:         12,
                zIndex:        3,
                ...(modelUnavailable ? { pointerEvents: 'auto' as const } : null),
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <IconButton
                variant="ghost"
                size="xs"
                aria-label="More options"
                aria-expanded={menuOpen}
                icon={
                  <m.span animate={{ rotate: menuOpen ? 90 : 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} style={{ display: 'inline-flex' }}>
                    <MoreVerticalIcon />
                  </m.span>
                }
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
                          {(onMenuEdit ?? onEdit) && (
                            <Dropdown.Item
                              label="Edit"
                              icon={<PenOneIcon />}
                              fluid
                              onClick={() => { setMenuOpen(false); (onMenuEdit ?? onEdit)?.() }}
                            />
                          )}
                          {(onMenuShare ?? onLink) && (
                            <Dropdown.Item
                              label="Share"
                              icon={<ShareOneIcon />}
                              fluid
                              onClick={() => { setMenuOpen(false); (onMenuShare ?? onLink)?.() }}
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


          {/* Identity: name, "by" line, description — centred under the hero */}
          <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {(() => {
              const titleStyle: React.CSSProperties = {
                width:         '100%',
                fontFamily:    'var(--font-title)', // Google Sans
                fontSize:      18,
                lineHeight:    '24px',
                fontWeight:    'var(--font-weight-medium)',
                letterSpacing: '-0.01em',
                color:         'var(--neutral-950)',
                overflow:      'hidden',
                textOverflow:  'ellipsis',
                whiteSpace:    'nowrap',
                opacity:       paused ? 0.6 : 1,
                transition:    'opacity 0.2s ease',
              }
              // With a Details action, the title is the card's keyboard entry point (Tab → Enter).
              return onMenuDetails ? (
                <button type="button" className="agent-card__title" title={name} aria-label={`${name} — details`} onClick={onMenuDetails} style={titleStyle}>
                  {name}
                </button>
              ) : (
                <span title={name} style={titleStyle}>{name}</span>
              )
            })()}

            {(createdBy || authorHandle) && (
              <m.span
                key={leaveCount}
                {...(leaveCount > 0 ? RISE : null)}
                title={createdBy ? `Created by ${createdBy}` : `@${authorHandle}`}
                style={{
                  maxWidth:     '100%',
                  fontFamily:   'var(--font-body)',
                  fontSize:     'var(--font-size-caption)',
                  lineHeight:   '18px',
                  color:        'var(--neutral-600)',
                  overflow:     'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace:   'nowrap',
                }}
              >
                by {createdBy ?? `@${authorHandle}`}
              </m.span>
            )}

            {/* Description */}
            {(description || (!isTemplate && !isCommunity)) && (
              <p
                title={description}
                className={animateHover ? 'persona-card-desc-reading' : undefined}
                style={{
                  margin:           '8px 0 0',
                  // Always two lines tall, so every card's action row lines up whatever the description length.
                  minHeight:        'calc(2 * var(--line-height-caption))',
                  fontFamily:       'var(--font-body)',
                  fontSize:         'var(--font-size-caption)',
                  lineHeight:       'var(--line-height-caption)',
                  color:            'var(--neutral-600)',
                  display:          '-webkit-box',
                  WebkitLineClamp:  2,
                  WebkitBoxOrient:  'vertical',
                  overflow:         'hidden',
                }}
              >
                {description}
              </p>
            )}
          </div>

        </div>{/* /Main content */}

        {/* ── Action row: the one centred button, under a hairline like the reference card's
            divider. The row is always there so the 40 / 40 / 20 split holds with or without a button. ── */}
        <div
          style={{
            height:         ACTION_HEIGHT,
            flexShrink:     0,
            boxSizing:      'border-box' as const,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            // A hairline that fades out at both ends.
            backgroundImage:    primary && !modelUnavailable ? 'linear-gradient(90deg, transparent, var(--neutral-200), transparent)' : undefined,
            backgroundSize:     '100% 1px',
            backgroundPosition: 'top',
            backgroundRepeat:   'no-repeat',
            marginInline:   14,
          }}
        >
          {primary && !modelUnavailable && (
            <span
              className="agent-card-cta"
              onPointerEnter={e => { attendTo(e.currentTarget); setCtaHot(true) }}
              onPointerLeave={() => { attendTo(null); setCtaHot(false) }}
              onFocus={e => { if ((e.target as HTMLElement).matches(':focus-visible')) { attendTo(e.currentTarget); setCtaHot(true) } }}
              onBlur={() => { attendTo(null); setCtaHot(false) }}
            >
              <AgentCardButton size="sm" loading={primary.loading} disabled={primary.loading} onClick={primary.onClick}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {primary.label}
                  {/* Slides in (and takes its room) only while the button is hot, so the label
                      stays centred at rest: "go". */}
                  <m.span
                    aria-hidden
                    initial={false}
                    animate={{ width: ctaHot ? 20 : 0, opacity: ctaHot ? 1 : 0, x: ctaHot ? 0 : -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    style={{ display: 'inline-flex', justifyContent: 'flex-end', overflow: 'hidden' }}
                  >
                    <ArrowRightTwoIcon size={14} />
                  </m.span>
                </span>
              </AgentCardButton>
            </span>
          )}
        </div>

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
                borderRadius:    CARD_RADIUS,
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
