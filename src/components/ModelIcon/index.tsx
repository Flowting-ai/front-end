'use client'

import Image from 'next/image'
import { ThemedLlmIcon } from '@/components/ThemedLlmIcon'
import { SouvenirLogo } from '@/components/SouvenirLogo'
import { toLlmIconId } from '@/lib/ai-models'

export interface ModelIconProps {
  /**
   * The model's provider or name — either resolves (see toLlmIconId). When it
   * resolves to nothing (an auto-routed turn, a retired model, a message saved
   * before the catalog stored a name) the Souvenir mark stands in.
   */
  model?: string | null
  /** Render size in px (square). Defaults to 16. */
  size?: number
  /**
   * Controls the fallback mark only — provider logos carry their own colour.
   * 'dark' (default) suits light surfaces; pass 'light' on a dark one, e.g. the
   * TopBar model-switcher's gradient, where the dark mark would be invisible.
   */
  variant?: 'dark' | 'light'
}

/**
 * A model's provider logo, falling back to the Souvenir mark.
 *
 * In dark mode the provider logo is a white single-colour mark and the fallback is the
 * white Souvenir logo (both swap with CSS — see ThemedLlmIcon / SouvenirLogo).
 */
export function ModelIcon({ model, size = 16, variant = 'dark' }: ModelIconProps) {
  const iconId = toLlmIconId(model)
  if (iconId) return <ThemedLlmIcon id={iconId} size={size} />
  // 'light' is for a surface that is dark in BOTH themes (e.g. the TopBar gradient): always white.
  if (variant === 'light') {
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
  return <SouvenirLogo size={size} />
}

ModelIcon.displayName = 'ModelIcon'

export default ModelIcon
