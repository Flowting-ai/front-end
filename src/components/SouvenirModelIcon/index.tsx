'use client'

import Image from 'next/image'

export interface SouvenirModelIconProps {
  /** Render size in px (square). Defaults to 16, matching LlmIcon's usual size in these spots. */
  size?: number
}

/**
 * The Souvenir mark — used wherever a model row/button/trigger would
 * otherwise show a per-provider LlmIcon (e.g. Anthropic's Claude logo).
 * Every model in the catalog is one of the 3 Souvenir Muse tiers; there is
 * no other provider/brand to reveal to the user.
 */
export function SouvenirModelIcon({ size = 16 }: SouvenirModelIconProps) {
  return (
    <Image
      src="/icons/souvenir-logo-white.svg"
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
