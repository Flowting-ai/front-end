/**
 * Hard-coded colours (not in the palette) that must follow the theme.
 *
 * Single source of truth for BOTH:
 *   • scripts/generate-dark-theme.mjs  — defines `--legacy-*` in theme.css:
 *       light: the exact original hex  (so light is pixel-identical)
 *       dark : the `dark` value below
 *   • scripts/migrate-inline-colors.mjs — swaps those literals for the tokens.
 *
 * Only values that are plainly "ink on a surface" or "a light surface" belong
 * here. Brand logo colours (Slack, Google, Linear …) and custom accents are
 * deliberately NOT listed: they stay fixed in both themes.
 */
export const LEGACY = {
  // near-black text → primary text
  '#1A1916': { token: '--legacy-1a1916', dark: '#F4EFEA' },
  '#1A1714': { token: '--legacy-1a1714', dark: '#F4EFEA' },
  '#1E1E1E': { token: '--legacy-1e1e1e', dark: '#F4EFEA' },
  '#0A0A0A': { token: '--legacy-0a0a0a', dark: '#F4EFEA' },
  '#141B34': { token: '--legacy-141b34', dark: '#F4EFEA' },
  // custom error red / mid-grey used as text (≈3.6:1 and ≈3.9:1 on the dark card) → lifted
  '#C0392B': { token: '--legacy-c0392b', dark: '#FA695B' },
  '#737373': { token: '--legacy-737373', dark: '#968B83' },
  // light surfaces → dark surfaces
  '#F9F5F1': { token: '--legacy-f9f5f1', dark: '#1C1613' },
  '#F5F1ED': { token: '--legacy-f5f1ed', dark: '#120C08' },
  '#F0F0F0': { token: '--legacy-f0f0f0', dark: '#26211E' },
  '#E5E5E5': { token: '--legacy-e5e5e5', dark: '#3B3632' },
  '#D5C9C0': { token: '--legacy-d5c9c0', dark: '#3B3632' },
}
