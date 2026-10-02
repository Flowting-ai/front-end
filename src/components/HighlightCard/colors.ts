// Color-variant constant for HighlightCard, split out of index.tsx. Keeping
// non-component value exports out of a file that also exports a React
// component is what Fast Refresh needs to safely hot-reload the component on
// edit — see src/components/Pinboard/constants.ts for the identical reasoning
// applied elsewhere in this feature.
//
// Auto-assigned by index (highlights.length % 4) - never set by the user.
// fold is the -200 / -300 step of the same hue, used for the dog-ear triangle.
export const HIGHLIGHT_COLORS = [
  { key: 'sand',     bg: 'var(--yellow-100)', fold: 'var(--yellow-200)' },
  { key: 'lavender', bg: 'var(--purple-200)', fold: 'var(--purple-300)' },
  { key: 'sky',      bg: 'var(--blue-100)',   fold: 'var(--blue-200)'   },
  { key: 'sage',     bg: 'var(--green-100)',  fold: 'var(--green-200)'  },
] as const

export type HighlightColorIndex = 0 | 1 | 2 | 3
