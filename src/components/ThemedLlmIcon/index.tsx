'use client'

import { LLM_MONO, LlmIcon } from '@strange-huge/icons/llm'
import { cn } from '@/lib/utils'
import { THEMING_ENABLED } from '@/lib/feature-flags'

/**
 * A model provider's logo: full colour in light mode, a single-colour WHITE mark in
 * dark mode.
 *
 * LlmIcon draws each logo as an <img> with a data URL, so its `mono` variant (which
 * uses currentColor) would render black — an <img> never inherits the text colour.
 * Dark mode therefore renders the `mono` artwork and CSS turns it white
 * (`brightness(0) invert(1)`, see "Logos" in styles/tokens/theme.css). Mono artwork
 * is used instead of filtering the colour one because a mono mark keeps its internal
 * detail as transparent cut-outs, where a filtered colour logo would flatten into a
 * blob.
 *
 * Both are rendered and CSS shows exactly one, so there is no flash. With theming off
 * only the colour logo is rendered — identical to the plain LlmIcon this replaces.
 */

export interface ThemedLlmIconProps {
  /** LlmIcon id, e.g. "Claude", "Gemini" (see toLlmIconId). */
  id: string
  /** Square size in px (default 24, as LlmIcon). */
  size?: number
  className?: string
  style?: React.CSSProperties
  alt?: string
}

export function ThemedLlmIcon({ id, size = 24, className, style, alt }: ThemedLlmIconProps) {
  if (!THEMING_ENABLED) {
    return <LlmIcon id={id} variant="color" size={size} className={className} style={style} alt={alt} />
  }
  // Two catalogue entries have no mono artwork; their colour artwork is flattened to white instead.
  const hasMono = id in LLM_MONO
  return (
    <>
      <LlmIcon id={id} variant="color" size={size} className={cn('kds-llm-color', className)} style={style} alt={alt} />
      <LlmIcon id={id} variant={hasMono ? 'mono' : 'color'} size={size} className={cn('kds-llm-mono', className)} style={style} alt="" />
    </>
  )
}

ThemedLlmIcon.displayName = 'ThemedLlmIcon'

export default ThemedLlmIcon
