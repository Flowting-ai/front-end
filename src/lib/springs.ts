// ── KDS Spring Presets ─────────────────────────────────────────────────────────
// Framer Motion spring configs shared across all KDS components.
// fast     → snappy UI feedback: icon swaps, tooltips, popovers
// moderate → layout animations, chip expand, panel open
// slow     → page-level transitions, large area reveals

export const springs = {
  fast: {
    type:      'spring' as const,
    stiffness: 500,
    damping:   30,
  },
  moderate: {
    type:      'spring' as const,
    stiffness: 300,
    damping:   28,
  },
  slow: {
    type:      'spring' as const,
    stiffness: 200,
    damping:   25,
  },
} as const
