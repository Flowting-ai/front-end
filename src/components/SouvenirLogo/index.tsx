'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { THEMING_ENABLED } from '@/lib/feature-flags'

/**
 * The Souvenir mark. Dark (or grey) mark on light surfaces; the WHITE mark
 * (/icons/souvenir-logo-white.svg) in dark mode.
 *
 * Both images are rendered and CSS shows exactly one (see "Logos" in
 * styles/tokens/theme.css), so the swap needs no JS and cannot flash the wrong mark
 * on first paint. With theming off only the original image is rendered — identical
 * to the plain <img> this replaces.
 */

export type SouvenirLogoVariant = 'default' | 'gray'

const LIGHT_SRC: Record<SouvenirLogoVariant, string> = {
  default: '/icons/souvenir-logo.svg',
  gray:    '/icons/souvenir-logo-gray.svg',
}
const WHITE_SRC = '/icons/souvenir-logo-white.svg'

export interface SouvenirLogoProps {
  /** Square size in px. Ignored per-axis when `width` / `height` are given. */
  size?: number
  width?: number
  height?: number
  /** Which mark to use on light surfaces. Dark mode always uses the white mark. */
  variant?: SouvenirLogoVariant
  /** Accessible name. Empty (default) marks the logo decorative. */
  alt?: string
  className?: string
  style?: React.CSSProperties
}

export function SouvenirLogo({
  size = 24,
  width,
  height,
  variant = 'default',
  alt = '',
  className,
  style,
}: SouvenirLogoProps) {
  const w = width ?? size
  const h = height ?? size
  const decorative = alt === ''
  // The dark-mode rule forces display with !important (to beat the hidden state), so a caller's
  // `display` is also exposed as --kds-logo-display for it to honour (e.g. inline-block in a heading).
  const imgStyle = {
    display: 'block',
    ...style,
    ...(style?.display ? { '--kds-logo-display': style.display } : null),
  } as React.CSSProperties

  const light = (
    <Image
      src={LIGHT_SRC[variant]}
      width={w}
      height={h}
      alt={alt}
      aria-hidden={decorative || undefined}
      unoptimized
      className={cn(THEMING_ENABLED && 'kds-logo-light', className)}
      style={imgStyle}
    />
  )
  if (!THEMING_ENABLED) return light

  return (
    <>
      {light}
      <Image
        src={WHITE_SRC}
        width={w}
        height={h}
        alt=""
        aria-hidden
        unoptimized
        className={cn('kds-logo-dark', className)}
        style={imgStyle}
      />
    </>
  )
}

SouvenirLogo.displayName = 'SouvenirLogo'

export default SouvenirLogo
