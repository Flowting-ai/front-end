/**
 * AnimatedTags.contrast.ts
 *
 * Pure colour maths for model-supplied tag colours, split out from
 * AnimatedTags.tsx so that file only exports the component. A tag keeps the
 * model's tint as its background; only the label colour is darkened, just
 * enough to reach WCAG AA (4.5:1) against that background.
 */

type Rgb = [number, number, number]

function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase()
}

function luminance([r, g, b]: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** WCAG contrast ratio between two 6-digit hex colours (1 when unparsable). */
export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a)
  const cb = parseHex(b)
  if (!ca || !cb) return 1
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The opaque colour `hex` at `alpha` produces over `background`. */
export function blendOver(hex: string, alpha: number, background: string): string {
  const fg = parseHex(hex)
  const bg = parseHex(background)
  if (!fg || !bg) return background
  return toHex([0, 1, 2].map((i) => fg[i] * alpha + bg[i] * (1 - alpha)) as Rgb)
}

/**
 * Returns `hex` unchanged when it already reaches `min` contrast against
 * `background`; otherwise darkens it step by step (scaling the channels, so
 * the hue is kept) until it does. Unparsable input comes back unchanged.
 */
export function ensureContrast(hex: string, background: string, min = 4.5): string {
  const rgb = parseHex(hex)
  if (!rgb || contrastRatio(hex, background) >= min) return hex
  for (let step = 1; step <= 20; step++) {
    const darker = toHex(rgb.map((c) => c * (1 - step * 0.05)) as Rgb)
    if (contrastRatio(darker, background) >= min) return darker
  }
  return "#000000"
}
