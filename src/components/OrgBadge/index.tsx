'use client'

import React from 'react'
import { LogoIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'
import type { ChipColor } from '@/components/Chip'
import { Button } from '@/components/Button'

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
  /**
   * Max width (px) of the entire badge before the name is ellipsis-clipped.
   * Includes the avatar and padding — the name portion gets whatever remains.
   * @default 160
   */
  maxNameWidth?: number
  /**
   * Secondary label shown below the org name — interactive mode only.
   * Typically the user's role, e.g. "Admin", "Owner".
   */
  sublabel?: string
  /** Stretch the interactive button to fill its container — interactive only. */
  fluid?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────
// A co-brand identity chip — visually a Small Chip ([org avatar] + name). Colour is
// assigned per-org from the KDS tag palette (pickOrgColor) and drives BOTH the chip
// and the monogram, so each org is recognisable. Avatar = uploaded logo → monogram
// fallback. Used in the Sidebar header as the org/admin entry; reusable elsewhere.

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
    maxNameWidth = 160,
    sublabel,
    fluid = false,
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

  // ── Static chip avatar (16 × 16) — used in the non-interactive variant ──────
  const chipAvatar = orgLogoSrc ? (
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
        backgroundColor: textToken,
        color: 'var(--neutral-white)',
        fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
        fontSize: '9px', lineHeight: 1,
      }}
    >
      {monogram || <LogoIcon size={12} color="var(--neutral-white)" />}
    </span>
  )

  // ── Static (non-interactive) — identity chip, no button semantics ────────────
  if (!interactive) {
    const chipInner = (
      <>
        {chipAvatar}
        <span
          title={fullName ?? orgName}
          style={{
            flex: '1 1 0', minWidth: 0, padding: '0 2px',
            fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)',
            fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)',
            color: textToken, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {orgName}
        </span>
        <span aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit', boxShadow: innerShadow }} />
      </>
    )
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        role="img"
        aria-label={`Organisation: ${orgName}`}
        className={cn(className)}
        style={{
          position: 'relative', display: 'inline-flex', alignItems: 'center',
          flexShrink: 0, minWidth: 0, maxWidth: `${maxNameWidth}px`,
          overflow: 'hidden', padding: '2px', border: 'none',
          borderRadius: '6px', backgroundColor: bgToken, boxShadow: shadowTok,
        }}
        {...rest}
      >
        {chipInner}
      </span>
    )
  }

  // ── Interactive — secondary small Button with LogoIcon + role chip ──────────
  return (
    <Button
      ref={ref as React.Ref<HTMLButtonElement>}
      variant="secondary"
      size="sm"
      fluid={fluid}
      leftIcon={<LogoIcon size={16} animated />}
      aria-label={`Open ${fullName ?? orgName} organisation settings`}
      aria-pressed={active}
      className={cn('kds-org-badge', className)}
      onClick={onClick}
      {...(rest as React.ComponentPropsWithoutRef<typeof Button>)}
    >
      Manage Organization
    </Button>
  )
}

OrgBadge.displayName = 'OrgBadge'
export default OrgBadge
