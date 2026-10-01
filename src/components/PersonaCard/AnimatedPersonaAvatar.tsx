'use client'

import React, { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'

// ── Animated persona avatar ───────────────────────────────────────────────────
// Port of agent_cards_iteration_2.html: two gooey spheres (head + body) that
// merge through an SVG blur/threshold filter, with a themed interior clipped to
// the sphere silhouettes (the clip follows the animated shapes every frame).
//
// Motion:
// - Idle   — head bobs ±0.9px on a ~1.8 rad/s sine, phase-offset per card.
// - Hover  — head sinks 17px into the body over 0.4s (ease-in-out), then
//            springs back over 0.7s with an easeOutBack overshoot (c1 1.9).
// - Click  — head hops 20px on a sine arc (~0.6s); on landing the body
//            squashes (rx ×1.16, ry ×0.84, top edge grounded) and a ring
//            (r 6→36, opacity 0.8→0) emits from the body's top. 0.75s total.
//
// Everything runs imperatively from one rAF loop (attributes set on refs) —
// re-rendering React 60×/sec per card would be far too expensive.

// ── Theme registry ────────────────────────────────────────────────────────────
// A theme = sphere colours + hover status copy + an optional interior layer.
// To add one: write an `AvatarInterior` and register it in AVATAR_THEMES (and
// THEME_KEYWORDS if it should be picked from the agent's name).

/** Per-frame values handed to an interior's `update`. */
export interface InteriorFrame {
  now:   number
  /** Seconds since last frame (0 under reduced motion). */
  dt:    number
  hover: boolean
  /** Seconds since the last click bounce started (large when none). */
  sinceClick: number
  /** Live sphere geometry: [cy, r] for head and body (body r = ry). */
  head:  [number, number]
  body:  [number, number]
  /** Mutable per-avatar state the interior may use (e.g. rotation phase). */
  state: { ph: number }
  reduceMotion: boolean
}

export interface AvatarInterior {
  /** Number of part elements the interior renders. */
  count: number
  /** Renders part `i` as a single top-level element — `update` receives them in order. */
  render: (i: number) => React.ReactNode
  /** Positions the parts for this frame. */
  update: (parts: (SVGElement | null)[], f: InteriorFrame) => void
  /** Optional white flicker over the whole avatar, returns flash opacity. */
  flash?: (f: InteriorFrame) => number
}

export interface AvatarThemeConfig {
  /** [highlight, shadow] for the sphere's radial gradient. */
  colors:    [string, string]
  /** Status lines cycled in the card's hover status ticker. */
  status:    string[]
  interior?: AvatarInterior
}

const set = (el: Element | null | undefined, attrs: Record<string, number | string>) => {
  if (!el) return
  for (const k in attrs) el.setAttribute(k, String(attrs[k]))
}

// Globe — 4 rotating meridians (rx = r·|cos a|) + an equator (ry = r·0.22) per
// sphere. Slow at idle, ~6× faster on hover.
const GLOBE_LINES = [0, 1].flatMap(s => [
  ...[0, 1, 2, 3].map(m => ({ s, m, equator: false })),
  { s, m: 0, equator: true },
])
const globeInterior: AvatarInterior = {
  count:  GLOBE_LINES.length,
  render: i => <ellipse key={i} cx={32} fill="none" stroke="#fff" strokeWidth={0.6} opacity={0.3} />,
  update: (parts, f) => {
    if (!f.reduceMotion) f.state.ph += f.dt * (f.hover ? 0.5 : 0.08)
    GLOBE_LINES.forEach((line, i) => {
      const [y, r] = line.s ? f.body : f.head
      if (line.equator) { set(parts[i], { cy: y, rx: r, ry: r * 0.22 }); return }
      const a = ((f.state.ph + line.m / 4) % 1) * Math.PI
      set(parts[i], { cy: y, rx: Math.abs(r * Math.cos(a)), ry: r })
    })
  },
}

// Clouds — 3 puff clusters drifting left→right and wrapping; faster on hover.
// Click adds a ~0.25s lightning flicker.
const CLOUD_PUFFS: [number, number, number][] = [[0, 0, 4], [5, -2, 5], [10, 0, 4], [5, 2, 4]]
const CLOUD_ROWS = [16, 40, 54]
const cloudsInterior: AvatarInterior = {
  count:  CLOUD_ROWS.length,
  render: i => (
    <g key={i} opacity={0.85}>
      {CLOUD_PUFFS.map(([x, y, r], j) => <circle key={j} cx={x} cy={y} r={r} fill="#fff" />)}
    </g>
  ),
  update: (parts, f) => {
    if (!f.reduceMotion) f.state.ph += f.dt * (f.hover ? 0.4 : 0.05)
    CLOUD_ROWS.forEach((row, n) => {
      const x = ((f.state.ph + n / 3) % 1) * 90 - 22
      // Top cloud rides along with the head.
      const y = row + (n === 0 ? f.head[0] - 21 : 0)
      set(parts[n], { transform: `translate(${x},${y})` })
    })
  },
  flash: f => (f.sinceClick < 0.25 && !f.reduceMotion ? (Math.sin(f.sinceClick * 40) > 0 ? 0.7 : 0) : 0),
}

// Signals — 3 dots on the head, 5 on the body; hover pulses them in a
// staggered ripple (radius up to 1.7×). [dx, dy, sphere] in rest-size units.
const SIGNAL_DOTS: [number, number, 0 | 1][] = [
  [0, -6, 0], [-6, 4, 0], [6, 4, 0],
  [0, -12, 1], [-12, -2, 1], [12, -2, 1], [-7, 10, 1], [7, 10, 1],
]
const signalsInterior: AvatarInterior = {
  count:  SIGNAL_DOTS.length,
  render: i => <circle key={i} fill="#fff" opacity={0.92} />,
  update: (parts, f) => {
    SIGNAL_DOTS.forEach(([dx, dy, sp], n) => {
      const [y, r] = sp ? f.body : f.head
      const scale  = r / (sp ? 25 : 13)
      const base   = sp ? 3.6 : 2.4
      const pop    = f.hover && !f.reduceMotion ? Math.max(0, Math.sin(f.now * 5 - n * 0.8)) : 0
      set(parts[n], { cx: 32 + dx * scale, cy: y + dy * scale, r: base * (1 + pop * 0.7) })
    })
  },
}

export type AvatarTheme = 'guide' | 'weather' | 'scout'

export const AVATAR_THEMES: Record<AvatarTheme, AvatarThemeConfig> = {
  guide:   { colors: ['#4a4a4a', '#030303'], status: ['Checking Tokyo…', 'Checking Lisbon…', 'Packing list ready'], interior: globeInterior },
  weather: { colors: ['#8cc8ff', '#0a4fb0'], status: ['Fetching radar…', 'Reading alerts…', 'Forecast ready'],     interior: cloudsInterior },
  scout:   { colors: ['#b4cef0', '#2f5f9e'], status: ['Scanning arXiv…', 'Verifying sources…', '3 new papers'],    interior: signalsInterior },
}

/** Themeless agents: plain sphere (no interior) and generic status copy. */
const FALLBACK_COLORS: [string, string][] = [
  ['#d9a28a', '#8a3f22'],
  ['#a9c7b9', '#2f6a55'],
  ['#c3bde6', '#4b4392'],
]
export const GENERIC_STATUS = ['Loading context…', 'Checking tools…', 'Ready to chat']

const THEME_KEYWORDS: [AvatarTheme, RegExp][] = [
  ['guide',   /\b(guide|travel|trip|international|worldwide|world|global|globe|country|countries)\b/i],
  ['weather', /\b(weather|forecast|climate|storm|rain|radar)\b/i],
  ['scout',   /\b(research|news|scout|paper|papers|arxiv|science|study|studies)\b/i],
]

/** Picks a theme from the agent's name, or null when nothing matches. */
export function pickAvatarTheme(name: string): AvatarTheme | null {
  for (const [theme, re] of THEME_KEYWORDS) if (re.test(name)) return theme
  return null
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

// ── Easing ────────────────────────────────────────────────────────────────────

const easeOutBack = (x: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
const easeInOut   = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

// ── Component ─────────────────────────────────────────────────────────────────

export interface AnimatedPersonaAvatarProps {
  /** Theme to render; null → plain sphere with no interior detail. */
  theme:   AvatarTheme | null
  /** Stable per-agent seed — offsets the idle bob and picks fallback colours. */
  seed:    string
  hovered: boolean
  /** Increment to play the hop/squash/ring bounce (e.g. on card click). */
  bounceKey?: number
  size?:   number
  radius?: number
  /** Freezes hover/bounce reactions (paused agents) — idle bob still plays. */
  inert?:  boolean
}

export function AnimatedPersonaAvatar({
  theme,
  seed,
  hovered,
  bounceKey = 0,
  size      = 64,
  radius    = 8,
  inert     = false,
}: AnimatedPersonaAvatarProps) {
  const reduceMotion = useReducedMotion() ?? false
  const uid  = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const hash = hashSeed(seed)
  // Per-card phase offset (radians-ish) so neighbouring cards never bob in sync.
  const phase = (Math.imul(hash, 2654435761) >>> 0) / 4294967296 * Math.PI * 2
  const config = theme ? AVATAR_THEMES[theme] : null
  const [c0, c1] = config?.colors ?? FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
  const interior = config?.interior

  const rootRef  = useRef<HTMLDivElement>(null)
  const headRef  = useRef<SVGCircleElement>(null)
  const bodyRef  = useRef<SVGEllipseElement>(null)
  const clipHRef = useRef<SVGCircleElement>(null)
  const clipBRef = useRef<SVGEllipseElement>(null)
  const ringRef  = useRef<SVGCircleElement>(null)
  const flashRef = useRef<SVGRectElement>(null)
  const partsRef = useRef<SVGGElement>(null)

  // Animation state lives in a ref so the rAF loop reads current values
  // without restarting on every prop change.
  const st = useRef({ hover: false, ht: 0, ct: -9, interior: { ph: (hash % 97) / 97 } })

  useEffect(() => {
    st.current.hover = hovered && !inert
    if (hovered && !inert) st.current.ht = performance.now() / 1000
  }, [hovered, inert])

  useEffect(() => {
    if (bounceKey > 0 && !inert) st.current.ct = performance.now() / 1000
  }, [bounceKey, inert])

  useEffect(() => {
    let raf = 0
    let last = performance.now() / 1000

    // The interior's rendered parts, in render order (children of the clip group).
    const parts = Array.from(partsRef.current?.children ?? []) as SVGElement[]

    const draw = (now: number, dt: number) => {
      const s = st.current
      const hr = 13, by = 61, br = 25
      let hy = 21 + (reduceMotion ? 0 : Math.sin(now * 1.8 + phase) * 0.9)
      let sq = 0, rk = -1

      if (s.hover && !reduceMotion) {
        const t = now - s.ht
        if (t < 0.4)      hy += easeInOut(t / 0.4) * 17
        else if (t < 1.1) hy += 17 * (1 - easeOutBack((t - 0.4) / 0.7))
      }

      const c = now - s.ct
      if (c < 0.75 && !reduceMotion) {
        const q = c / 0.75
        hy -= Math.sin(Math.PI * Math.min(q / 0.8, 1)) * 20
        if (q > 0.75) sq = Math.sin(((q - 0.75) / 0.25) * Math.PI) * 0.16
        rk = q
      }

      set(headRef.current,  { cy: hy, r: hr })
      set(clipHRef.current, { cy: hy, r: hr })

      const rx = br * (1 + sq), ry = br * (1 - sq), cy = by + br * sq
      set(bodyRef.current,  { cy, rx, ry })
      set(clipBRef.current, { cy, rx, ry })

      if (rk >= 0) set(ringRef.current, { cy: cy - ry + 2, r: 6 + rk * 30, opacity: (1 - rk) * 0.8 })
      else         set(ringRef.current, { opacity: 0 })

      if (interior) {
        const frame: InteriorFrame = {
          now, dt, hover: s.hover, sinceClick: c,
          head: [hy, hr], body: [cy, ry],
          state: s.interior, reduceMotion,
        }
        interior.update(parts, frame)
        set(flashRef.current, { opacity: interior.flash?.(frame) ?? 0 })
      }
    }

    const frame = () => {
      const now = performance.now() / 1000
      draw(now, Math.min(now - last, 0.1))
      last = now
      raf = requestAnimationFrame(frame)
    }

    // First frame synchronously so the initial paint is never an unpositioned
    // interior; under reduced motion that static frame is all we draw.
    draw(last, 0)
    if (reduceMotion) return
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [interior, phase, reduceMotion])


  const gradId = `pa-g-${uid}`
  const gooId  = `pa-goo-${uid}`
  const clipId = `pa-cp-${uid}`

  return (
    <div
      ref={rootRef}
      aria-hidden
      style={{
        width:           size,
        height:          size,
        borderRadius:    radius,
        overflow:        'hidden',
        flexShrink:      0,
        backgroundColor: '#fff',
      }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <radialGradient id={gradId} cx=".35" cy=".3" r=".8">
            <stop offset="0"   stopColor="#fff" />
            <stop offset=".14" stopColor={c0} />
            <stop offset="1"   stopColor={c1} />
          </radialGradient>
          <filter id={gooId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10" />
          </filter>
          <clipPath id={clipId}>
            <circle  ref={clipHRef} cx={32} cy={21} r={13} />
            <ellipse ref={clipBRef} cx={32} cy={61} rx={25} ry={25} />
          </clipPath>
        </defs>

        <circle ref={ringRef} cx={32} fill="none" stroke={c1} strokeWidth={1.2} opacity={0} />

        <g filter={`url(#${gooId})`}>
          <ellipse ref={bodyRef} cx={32} cy={61} rx={25} ry={25} fill={`url(#${gradId})`} />
          <circle  ref={headRef} cx={32} cy={21} r={13} fill={`url(#${gradId})`} />
        </g>

        {interior && (
          <g ref={partsRef} clipPath={`url(#${clipId})`}>
            {Array.from({ length: interior.count }, (_, i) => interior.render(i))}
          </g>
        )}

        <rect ref={flashRef} width={64} height={64} fill="#fff" opacity={0} pointerEvents="none" />
      </svg>
    </div>
  )
}

export default AnimatedPersonaAvatar
