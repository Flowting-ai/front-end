'use client'

import Image from 'next/image'

export interface SouvenirModelIconProps {
  /** Render size in px (square). Defaults to 16, matching LlmIcon's usual size in these spots. */
  size?: number
  /**
   * 'dark' (default) is the standard mark for light/white surfaces (dropdown
   * rows, modals, cards). Pass 'light' only on a dark surface — e.g. the
   * TopBar model-switcher button's dark gradient — where the dark mark would
   * be invisible.
   */
  variant?: 'dark' | 'light'
}

/**
 * The Souvenir mark — used wherever a model row/button/trigger would
 * otherwise show a per-provider LlmIcon (e.g. Anthropic's Claude logo).
 * Every model in the catalog is one of the 3 Souvenir Muse tiers; there is
 * no other provider/brand to reveal to the user.
 */
export function SouvenirModelIcon({ size = 16, variant = 'dark' }: SouvenirModelIconProps) {
  return (
    <Image
      src={variant === 'light' ? '/icons/souvenir-logo-white.svg' : '/icons/logo/souvenir-logo.svg'}
      width={size}
      height={size}
      alt=""
      unoptimized
      style={{ display: 'block' }}
    />
  )
}

SouvenirModelIcon.displayName = 'SouvenirModelIcon'

export default SouvenirModelIcon
