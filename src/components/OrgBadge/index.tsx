'use client'

import React from 'react'
import { m } from 'framer-motion'
import { LogoIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import type { ChipColor } from '@/components/Chip'

// ── Org identity colour ───────────────────────────────────────────────────────
// Deterministic assignment from a stable key (org id) into the KDS tag palette —
// the same 7-colour set Chip/Badge use. Keyed on id (not name) so a rename never
// reshuffles the colour. Neutral is reserved as an explicit fallback, so auto-
// assignment draws from the 6 chromatic tags for stronger identity/recognition.
const ORG_COLOR_PALETTE: ChipColor[] = ['Blue', 'Red', 'Green', 'Yellow', 'Purple', 'Brown']

/** Deterministically pick a tag colour for an org from a stable key (id, else name). */
export function pickOrgColor(key: string): ChipColor {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return ORG_COLOR_PALETTE[h % ORG_COLOR_PALETTE.length]!
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OrgBadgeProps extends Omit<React.HTMLAttributes<HTMLElement>, 'color' | 'onClick'> {
  /** Organisation name shown in the badge. */
  orgName: string
  /** Full name used for the title tooltip when orgName is truncated. Falls back to orgName. */
  fullName?: string
  /** Org logo URL (any web image format). Falls back to a monogram when omitted. */
  orgLogoSrc?: string
  /** Stable id used to deterministically pick the colour. Falls back to `orgName`. */
  orgId?: string
  /** Explicit colour override (KDS tag colour). Defaults to the deterministic pick. */
  color?: ChipColor
  /** Interactive (button) vs static identity pill. @default false */
  interactive?: boolean
  /** Pressed/active state — interactive only (sets `aria-pressed`). */
  active?: boolean
  /** Click handler — interactive only. */
  onClick?: () => void
  /** Max width (px) for the name before ellipsis truncation. @default 120 */
  maxNameWidth?: number
  /**
   * Accepted for back-compat; the co-brand chip does not render a secondary label
   * (the role is surfaced elsewhere, e.g. the team switcher row).
   */
  sublabel?: string
  /** Accepted for back-compat — the chip is content-width and does not stretch. */
  fluid?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────
// A co-brand identity chip — visually a Small Chip ([org avatar] + name). Colour is
// assigned per-org from the KDS tag palette (pickOrgColor) and drives BOTH the chip
// and the monogram, so each org is recognisable. Avatar = uploaded logo → monogram
// fallback. The interactive variant is the same chip wrapped in a button (used in
// the Sidebar header as the org/admin entry); reusable elsewhere.

export function OrgBadge(
  {
    ref,
    orgName,
    fullName,
    orgLogoSrc,
    orgId,
    color,
    interactive = false,
    active = false,
    onClick,
    maxNameWidth = 120,
    sublabel: _sublabel,
    fluid: _fluid,
    className,
    ...rest
  }: OrgBadgeProps & { ref?: React.Ref<HTMLElement> },
) {
  const resolved    = color ?? pickOrgColor(orgId ?? orgName)
  // Green uses the lighter `bg-soft` tint for chips/badges (matches Chip).
  const bgToken     = resolved === 'Green' ? `var(--color-tag-Green-bg-soft)` : `var(--color-tag-${resolved}-bg)`
  const textToken   = `var(--color-tag-${resolved}-text)`
  const shadowTok   = `var(--color-tag-${resolved}-shadow)`
  const innerShadow = `var(--color-tag-${resolved}-inner-shadow)`

  const monogram = orgName.trim().charAt(0).toUpperCase()
  const avatar = orgLogoSrc ? (
    <img
      src={orgLogoSrc}
      alt=""
      style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', display: 'block', flexShrink: 0 }}
    />
  ) : (
    <span
      aria-hidden
      style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        // Square uses the colour's dark text tone; white letter — the tag pair is
        // designed as text-on-bg so contrast holds across all colours.
        backgroundColor: textToken,
        color: 'var(--neutral-white)',
        fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
        fontSize: '9px', lineHeight: 1,
      }}
    >
      {monogram || <LogoIcon size={12} color="var(--neutral-white)" />}
    </span>
  )

  const inner = (
    <>
      {avatar}
      {/* Org name — truncates; full name in title tooltip */}
      <span
        title={fullName ?? orgName}
        style={{
          padding:      '0 2px',
          fontFamily:   'var(--font-body)',
          fontWeight:   'var(--font-weight-medium)',
          fontSize:     'var(--font-size-caption)',
          lineHeight:   'var(--line-height-caption)',
          color:        textToken,
          whiteSpace:   'nowrap',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          // `maxWidth` is the upper cap; `minWidth: 0` lets the name shrink +
          // ellipsize below that when the badge is in a tight flex parent.
          minWidth:     0,
          maxWidth:     `${maxNameWidth}px`,
        }}
      >
        {orgName}
      </span>
      {/* Inner depth/highlight — above content */}
      <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: innerShadow }} />
    </>
  )

  const baseStyle: React.CSSProperties = {
    position:        'relative',
    display:         'inline-flex',
    alignItems:      'center',
    // Shrink-capable: in a constrained flex parent (e.g. the Sidebar header next
    // to the wordmark) the badge shrinks and its name truncates responsively
    // (capped at `maxNameWidth`) instead of overflowing into siblings. In an
    // unconstrained context it stays content-width.
    flexShrink:      1,
    minWidth:        0,
    padding:         '2px',
    border:          'none',
    borderRadius:    '6px',
    backgroundColor: bgToken,
    boxShadow:       shadowTok,
  }

  if (!interactive) {
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        role="img"
        aria-label={`Organisation: ${orgName}`}
        className={cn(className)}
        style={baseStyle}
        {...rest}
      >
        {inner}
      </span>
    )
  }

  return (
    <m.button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      aria-label={`Open ${orgName} organisation`}
      aria-pressed={active}
      className={cn('kds-org-badge', className)}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{ ...baseStyle, cursor: 'pointer' }}
      {...(rest as React.ComponentPropsWithoutRef<typeof m.button>)}
    >
      {inner}
    </m.button>
  )
}

OrgBadge.displayName = 'OrgBadge'
export default OrgBadge
