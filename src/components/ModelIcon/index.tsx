'use client'

import Image from 'next/image'
import { LlmIcon } from '@strange-huge/icons/llm'
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

/** A model's provider logo, falling back to the Souvenir mark. */
export function ModelIcon({ model, size = 16, variant = 'dark' }: ModelIconProps) {
  const iconId = toLlmIconId(model)
  if (iconId) return <LlmIcon id={iconId} variant="color" size={size} />
  return (
    <Image
      src={variant === 'light' ? '/icons/souvenir-logo-white.svg' : '/icons/souvenir-logo.svg'}
      width={size}
      height={size}
      alt=""
      unoptimized
      style={{ display: 'block' }}
    />
  )
}

ModelIcon.displayName = 'ModelIcon'

export default ModelIcon
