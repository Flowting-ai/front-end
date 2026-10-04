/**
 * Central feature switches.
 *
 * Pins (Pinboard) and Highlights are HIDDEN, not removed: all of their code is
 * still here, but it is switched off at every layer —
 *   • providers don't fetch, cache or hold any data and every action is a no-op,
 *   • the API wrappers refuse to call the backend,
 *   • no UI renders an entry point (buttons, menus, panels, chips, @-mentions),
 *   • chat / Brain requests never carry pin ids.
 *
 * Both default to OFF. To bring a feature back, set the matching env var to
 * "true" and rebuild (NEXT_PUBLIC_* values are inlined at build time):
 *   NEXT_PUBLIC_ENABLE_PINS=true
 *   NEXT_PUBLIC_ENABLE_HIGHLIGHTS=true
 *
 * Always read the flag from here — never inline `process.env` at a call site —
 * so there is exactly one place that decides.
 */
export const PINS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PINS === 'true'
export const HIGHLIGHTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_HIGHLIGHTS === 'true'

/**
 * Dark theme (and the Light / Dark / System selector in Settings → Preferences).
 * OFF by default: with it off no attribute is ever set on <html>, no script is
 * injected, and the app renders exactly as before. Turn on with
 *   NEXT_PUBLIC_ENABLE_THEMING=true
 * The default choice is still Light, so enabling it changes nothing until a user
 * picks Dark or System.
 */
export const THEMING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_THEMING === 'true'

/** Thrown by API wrappers when called while their feature is switched off. */
export class FeatureDisabledError extends Error {
  constructor(feature: 'Pins' | 'Highlights') {
    super(`${feature} are disabled in this build.`)
    this.name = 'FeatureDisabledError'
  }
}
