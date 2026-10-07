/**
 * XmlMap.colors.ts
 *
 * MapLibre draws layers with WebGL and parses paint colours itself, so a CSS
 * `var(--token)` string is invalid there (the pins silently don't render).
 * Design tokens are resolved to concrete colours first; split out from
 * XmlMapCanvas.tsx so that file only exports the component.
 */

export interface MapColors {
  clusterLow: string
  clusterMid: string
  clusterHigh: string
  clusterStroke: string
  clusterText: string
  pointLow: string
  pointHigh: string
  pointStroke: string
  pointStrokeSelected: string
}

// [token, light-theme fallback from styles/tokens/primitives.css]
const TOKENS: Record<keyof MapColors, readonly [string, string]> = {
  clusterLow: ["--blue-300", "#8EAED8"],
  clusterMid: ["--blue-500", "#4A83BF"],
  clusterHigh: ["--blue-600", "#0D6EB2"],
  clusterStroke: ["--neutral-white-90", "rgba(255, 255, 255, 0.90)"],
  clusterText: ["--static-white", "#FFFFFF"],
  pointLow: ["--blue-300", "#8EAED8"],
  pointHigh: ["--blue-600", "#0D6EB2"],
  pointStroke: ["--static-white", "#FFFFFF"],
  pointStrokeSelected: ["--neutral-900", "#26211E"],
}

// Only plain hex/rgb/hsl values are handed to MapLibre; anything else (an
// unresolved reference, color-mix(), an empty string) uses the fallback.
const PLAIN_COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([^()]*\))$/i

/**
 * Resolves every map colour token through `getVar` (which returns the
 * token's computed value, e.g. via getComputedStyle), falling back to the
 * light-theme hex when the value isn't a colour MapLibre can parse.
 */
export function resolveMapColors(getVar: (name: string) => string): MapColors {
  const resolved = {} as MapColors
  for (const key of Object.keys(TOKENS) as Array<keyof MapColors>) {
    const [token, fallback] = TOKENS[key]
    const value = getVar(token).trim()
    resolved[key] = PLAIN_COLOR_RE.test(value) ? value : fallback
  }
  return resolved
}
