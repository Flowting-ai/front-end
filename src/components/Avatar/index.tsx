'use client'

import React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { useOptionalAuthUser, userFullName } from '@/context/auth-context'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name. Initials are derived as the first letter of the first two words. */
  name:   string
  /** Background colour, or a `linear-gradient(...)`/`radial-gradient(...)` CSS
   *  value for a gradient fill. Falls back to `var(--neutral-700)`. */
  color?: string
  /** Render size. xs=24, sm=28, md=32, lg=40. */
  size?:  AvatarSize
  /** Override the auto-derived initials. */
  initials?: string
  /** Stable value the tint is picked from (a user id). Defaults to `name`, so the same person keeps the same colour. */
  seed?: string
  asChild?: boolean
}

const SIZE_PX: Record<AvatarSize, number> = { xs: 24, sm: 28, md: 32, lg: 40 }
const FONT_TOKEN: Record<AvatarSize, string> = {
  xs: 'var(--font-size-caption)',
  sm: 'var(--font-size-caption)',
  md: 'var(--font-size-body)',
  lg: 'var(--font-size-body)',
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

// ── Standard tint ─────────────────────────────────────────────────────────────
// Without a caller-supplied colour, an avatar is a soft tag-tinted circle with a diagonal gradient (light
// top-left to the full tint bottom-right) and a hairline edge, the look first used by Library's Access
// column. The tint is picked from a hash of the seed, so a person keeps their colour everywhere.

const TINTS = ['Blue', 'Green', 'Purple', 'Yellow', 'Brown'] as const
export const AVATAR_HAIRLINE = 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)'

export function avatarGradient(colour: string): string {
  return `linear-gradient(135deg, color-mix(in srgb, ${colour} 45%, white), color-mix(in srgb, ${colour} 88%, black))`
}

/** The background and text colour for a seed (user id or name). */
export function avatarTint(seed: string): { background: string; color: string } {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const tint = TINTS[hash % TINTS.length]
  return { background: avatarGradient(`var(--color-tag-${tint}-bg)`), color: `var(--color-tag-${tint}-text)` }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Avatar({ ref, name, color, size = 'md', initials, seed, asChild, className, style, ...props }: AvatarProps & { ref?: React.Ref<HTMLSpanElement> }) {
    const Comp = asChild ? Slot : 'span'
    const px = SIZE_PX[size]
    const fontSize = FONT_TOKEN[size]
    const text = (initials ?? deriveInitials(name)).slice(0, 2)
    const isGradient = color?.includes('gradient(')
    const tint = color ? null : avatarTint(seed ?? name)

    return (
      <Comp
        ref={ref}
        aria-label={name}
        className={cn(className)}
        style={{
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          flexShrink:      0,
          width:           px,
          height:          px,
          borderRadius:    '50%',
          backgroundColor: color && !isGradient ? color : undefined,
          backgroundImage:  tint ? tint.background : isGradient ? color : undefined,
          boxShadow:        tint ? AVATAR_HAIRLINE : undefined,
          // A caller-supplied fill (team gradients etc.) is fixed in both themes, so
          // its text stays white; the default fill is a token that flips, so its
          // text flips with it (--neutral-white is a dark surface in dark mode).
          color:           tint ? tint.color : 'var(--color-text-on-accent)',
          fontFamily:      'var(--font-body)',
          fontWeight:      tint ? 600 : 'var(--font-weight-medium)',
          fontSize:        fontSize,
          lineHeight:      1,
          userSelect:      'none',
          ...style,
        }}
        {...props}
      >
        {text}
      </Comp>
    )
}

Avatar.displayName = 'Avatar'

// ── The signed-in user's own avatar ───────────────────────────────────────────
// One look everywhere the user sees themselves (sidebar profile row, account menu, Profile card):
// a rounded square, their photo if they have one, else two initials on their tint.
// Initials and tint come from the signed-in user's FULL name and id — not the `name` a caller shows
// (the main sidebar labels you by first name only) — so every surface draws the same letters and colour.

/** Corner radius for a user avatar of a given size — about 28%, so 32px gets 9px and 72px gets 20px. */
export const userAvatarRadius = (size: number) => Math.round(size * 0.28)

export function UserAvatar({ name, src, size, seed, initials }: {
  /** Fallback for the initials when no user is signed in (tests, previews). */
  name:  string
  src?:  string | null
  size:  number
  /** Stable value the tint is picked from. Defaults to the user's id, else their full name. */
  seed?: string
  /** Override the initials (e.g. while a name is being typed). */
  initials?: string
}) {
  const user = useOptionalAuthUser()
  const fullName = userFullName(user) || name
  const radius = userAvatarRadius(size)
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user-supplied avatar URL, not a static asset
    return <img alt="" src={src} style={{ display: 'block', width: size, height: size, borderRadius: radius, objectFit: 'cover', flexShrink: 0 }} />
  }
  const tint = avatarTint(seed ?? (user?.id != null ? String(user.id) : fullName))
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: size, height: size, borderRadius: radius,
        backgroundImage: tint.background, boxShadow: AVATAR_HAIRLINE, color: tint.color,
        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: Math.round(size * 0.38), lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {(initials ?? deriveInitials(fullName)).slice(0, 2)}
    </span>
  )
}
export default Avatar
