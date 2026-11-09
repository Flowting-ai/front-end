'use client'

import { LLM_COLOR, LLM_MONO } from '@/lib/llm-icons.generated'
import { cn } from '@/lib/utils'
import { THEMING_ENABLED } from '@/lib/feature-flags'

/**
 * A model provider's logo, colour-coded the same way in both themes.
 *
 * A mark drawn in real brand colour (Claude's orange, Gemini's blue, Qwen's violet
 * gradient) renders as that one image in light AND dark mode, so a provider looks
 * the same wherever it appears. Only the marks drawn in `currentColor` (OpenAI,
 * xAI, Grok, Groq, Moonshot) still swap: black would vanish on a dark surface, so
 * dark mode shows a white version of those instead. See isBrandColoured below.
 *
 * Each logo is drawn as an <img> with a data URL, so its `mono` variant (which
 * uses currentColor) would render black — an <img> never inherits the text colour.
 * Dark mode therefore renders the `mono` artwork and CSS turns it white
 * (`brightness(0) invert(1)`, see "Logos" in styles/tokens/theme.css). Mono artwork
 * is used instead of filtering the colour one because a mono mark keeps its internal
 * detail as transparent cut-outs, where a filtered colour logo would flatten into a
 * blob.
 *
 * Both are rendered and CSS shows exactly one, so there is no flash. With theming off
 * only the colour logo is rendered.
 *
 * The artwork comes from `@/lib/llm-icons.generated`, a small subset of
 * `@strange-huge/icons/llm` (which is ~10 MB as a single module). To support another
 * provider add its id in `scripts/generate-llm-icons.mjs` and run `npm run generate:llm-icons`.
 */

export interface ThemedLlmIconProps {
  /** Provider id, e.g. "Claude", "Gemini" (see toLlmIconId / getModelLlmId). */
  id: string
  /** Square size in px (default 24). */
  size?: number
  className?: string
  style?: React.CSSProperties
  alt?: string
}

type Variant = 'color' | 'mono'

interface LogoProps {
  id: string
  variant: Variant
  size: number
  className?: string
  style?: React.CSSProperties
  alt?: string
}

/** One provider logo as a data-URL <img>. Renders nothing for an unknown id. */
function Logo({ id, variant, size, className, style, alt }: LogoProps) {
  const map = variant === 'mono' ? LLM_MONO : LLM_COLOR
  const raw = map[id] ?? LLM_COLOR[id] ?? LLM_MONO[id] ?? null
  if (!raw) return null
  const sized = raw
    .replace(/width="24"/, `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`)
  const src = `data:image/svg+xml,${encodeURIComponent(sized)}`
  return (
    // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, nothing for next/image to optimise
    <img
      src={src}
      width={size}
      height={size}
      alt={alt ?? id}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...style }}
    />
  )
}

/** Colours that carry no brand: a mark painted only in these is a shape, not a logo. */
const NEUTRAL_PAINTS = new Set(['none', 'transparent', 'currentcolor', 'black', '#000', '#000000', 'white', '#fff', '#ffffff'])

const brandColourCache = new Map<string, boolean>()

/**
 * Whether a provider's COLOUR artwork actually carries brand colour.
 *
 * Several marks (OpenAI, xAI, Grok, Groq, Moonshot) are drawn in `currentColor`,
 * which an <img> renders black - those still need the white mono mark on a dark
 * surface or they disappear. The rest carry real brand paint (Claude's orange,
 * Gemini's blue, Qwen's violet gradient...) and should keep it in both themes.
 * Read from the artwork rather than a hand-kept list, so a provider added to
 * `scripts/generate-llm-icons.mjs` is classified without a second edit here.
 */
function isBrandColoured(id: string): boolean {
  const cached = brandColourCache.get(id)
  if (cached !== undefined) return cached
  const raw = LLM_COLOR[id]
  const paints = raw ? raw.match(/(?:fill|stop-color)="[^"]*"/g) ?? [] : []
  const coloured = paints.some((paint) => {
    const value = paint.slice(paint.indexOf('"') + 1, -1).trim().toLowerCase()
    // A url(#id) fill points at a gradient; its own stop-colors are in this
    // same list, so the gradient is judged by those, not by the reference.
    return !!value && !value.startsWith('url(') && !NEUTRAL_PAINTS.has(value)
  })
  brandColourCache.set(id, coloured)
  return coloured
}

export function ThemedLlmIcon({ id, size = 24, className, style, alt }: ThemedLlmIconProps) {
  // A logo with real brand colour keeps it in both themes - one image, no swap,
  // so every surface in the app shows the same colour-coded mark. Only the
  // currentColor-drawn marks still need the light/dark pair below.
  if (!THEMING_ENABLED || isBrandColoured(id)) {
    return <Logo id={id} variant="color" size={size} className={className} style={style} alt={alt} />
  }
  // Two catalogue entries have no mono artwork; their colour artwork is flattened to white instead.
  const hasMono = id in LLM_MONO
  return (
    <>
      <Logo id={id} variant="color" size={size} className={cn('kds-llm-color', className)} style={style} alt={alt} />
      <Logo id={id} variant={hasMono ? 'mono' : 'color'} size={size} className={cn('kds-llm-mono', className)} style={style} alt="" />
    </>
  )
}

ThemedLlmIcon.displayName = 'ThemedLlmIcon'

export default ThemedLlmIcon
