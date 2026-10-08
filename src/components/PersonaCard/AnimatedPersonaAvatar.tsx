'use client'

import React, { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { AvatarMood, GazeChannel } from './gaze'

// ── Animated persona avatar ───────────────────────────────────────────────────
// Port of agent_cards_iteration_2.html: two gooey spheres (head + body) that
// merge through an SVG blur/threshold filter, with a themed interior clipped to
// the sphere silhouettes (the clip follows the animated shapes every frame).
//
// Motion:
// - Idle / hover — the head stays merged with the body (no bob or dip).
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
  /** The avatar has eyes drawn on its head — keep the head's interior clear of them. */
  face: boolean
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
      // With a face, the head's three dots would read as a second set of eyes.
      const hidden = sp === 0 && f.face
      set(parts[n], { cx: 32 + dx * scale, cy: y + dy * scale, r: hidden ? 0 : base * (1 + pop * 0.7) })
    })
  },
}

// Hearts — four little hearts bubbling up through the body and wrapping, like live
// reactions; quicker on hover.
const HEART = 'M0 1.6C-3-1-2-3.6 0-2C2-3.6 3-1 0 1.6Z'
const heartsInterior: AvatarInterior = {
  count:  4,
  render: i => <path key={i} d={HEART} fill="#fff" />,
  update: (parts, f) => {
    if (!f.reduceMotion) f.state.ph += f.dt * (f.hover ? 0.5 : 0.12)
    const [by, br] = f.body
    parts.forEach((part, n) => {
      const q = (f.state.ph + n / 4) % 1
      const x = 32 + Math.sin(q * Math.PI * 2 + n * 1.7) * br * 0.45
      const y = by + br * 0.55 - q * br * 1.25
      set(part, { transform: `translate(${x},${y}) scale(${0.8 + Math.sin(q * Math.PI) * 0.6})`, opacity: Math.sin(q * Math.PI) * 0.9 })
    })
  },
}

export type AvatarTheme = 'guide' | 'weather' | 'scout' | 'marketing'

export const AVATAR_THEMES: Record<AvatarTheme, AvatarThemeConfig> = {
  guide:     { colors: ['#e3e5e8', '#8e949d'], status: ['Checking Tokyo…', 'Checking Lisbon…', 'Packing list ready'] },
  weather:   { colors: ['#8cc8ff', '#0a4fb0'], status: ['Fetching radar…', 'Reading alerts…', 'Forecast ready'],        interior: cloudsInterior },
  scout:     { colors: ['#b4cef0', '#2f5f9e'], status: ['Scanning arXiv…', 'Verifying sources…', '3 new papers'],       interior: signalsInterior },
  marketing: { colors: ['#ffa3bd', '#b3124f'], status: ['Drafting hooks…', 'Checking engagement…', 'Campaign ready'],   interior: heartsInterior },
}

/** Themeless agents: plain sphere (no interior) and generic status copy. */
const FALLBACK_COLORS: [string, string][] = [
  ['#d9a28a', '#8a3f22'],
  ['#a9c7b9', '#2f6a55'],
  ['#c3bde6', '#4b4392'],
]
export const GENERIC_STATUS = ['Loading context…', 'Checking tools…', 'Ready to chat']

const THEME_KEYWORDS: [AvatarTheme, RegExp][] = [
  ['guide',     /\b(guide|travel|trip|international|worldwide|world|global|globe|country|countries)\b/i],
  ['weather',   /\b(weather|forecast|climate|storm|rain|radar)\b/i],
  // Kept to unmistakable marketing words: a match changes the default avatar of every agent
  // whose name contains it (one with a picked avatar keeps theirs).
  ['marketing', /\b(marketing|marketer|campaigns?|branding|seo|advertising|newsletters?|copywriter|copywriting|influencer)\b/i],
  ['scout',     /\b(research|news|scout|paper|papers|arxiv|science|study|studies)\b/i],
]

/** Picks a theme from the agent's name, or null when nothing matches. */
/** The sphere's [highlight, shadow] colours for a theme/seed — same pick the avatar itself renders with. */
export function getAvatarColors(theme: AvatarTheme | null, seed: string): [string, string] {
  return theme ? AVATAR_THEMES[theme].colors : FALLBACK_COLORS[hashSeed(seed) % FALLBACK_COLORS.length]
}

/** A pickable avatar: one of the themed ones, or a plain sphere in a fixed colourway. */
export type AvatarChoice = AvatarTheme | 'ember' | 'mint' | 'dusk' | BaseColor

/** Eleven more plain spheres — the same orb, just in other base colours ([highlight, shadow]). */
export const BASE_COLORS = {
  coral:  { label: 'Coral',  colors: ['#ffb4a2', '#c2412d'] },
  amber:  { label: 'Amber',  colors: ['#ffd27a', '#b7791f'] },
  lime:   { label: 'Lime',   colors: ['#cde88f', '#5b8a1e'] },
  teal:   { label: 'Teal',   colors: ['#9fe0d8', '#13756b'] },
  sky:    { label: 'Sky',    colors: ['#a8dcf5', '#1f6f9e'] },
  indigo: { label: 'Indigo', colors: ['#b3b8f5', '#3b3fa8'] },
  violet: { label: 'Violet', colors: ['#d8b8f5', '#6b2fa8'] },
  rose:   { label: 'Rose',   colors: ['#f5b8d4', '#a82f6b'] },
  slate:  { label: 'Slate',  colors: ['#c4ccd6', '#3e4a5a'] },
  sand:   { label: 'Sand',   colors: ['#e8d6b8', '#8a6a3a'] },
  white:  { label: 'White',  colors: ['#ffffff', '#b9bec7'] },
} as const satisfies Record<string, { label: string; colors: [string, string] }>
export type BaseColor = keyof typeof BASE_COLORS

export interface AvatarChoiceConfig {
  id:     AvatarChoice
  label:  string
  theme:  AvatarTheme | null
  colors: [string, string]
}

/** Every avatar the picker cycles through, in order. */
export const AVATAR_CHOICES: AvatarChoiceConfig[] = [
  { id: 'guide',   label: 'Voyager', theme: 'guide',   colors: AVATAR_THEMES.guide.colors },
  { id: 'weather', label: 'Stormy',  theme: 'weather', colors: AVATAR_THEMES.weather.colors },
  { id: 'scout',     label: 'Scout',   theme: 'scout',     colors: AVATAR_THEMES.scout.colors },
  { id: 'marketing', label: 'Spark',   theme: 'marketing', colors: AVATAR_THEMES.marketing.colors },
  { id: 'ember',     label: 'Ember',   theme: null,        colors: FALLBACK_COLORS[0] },
  { id: 'mint',      label: 'Mint',    theme: null,        colors: FALLBACK_COLORS[1] },
  { id: 'dusk',      label: 'Dusk',    theme: null,        colors: FALLBACK_COLORS[2] },
  ...(Object.keys(BASE_COLORS) as BaseColor[]).map(id => ({
    id, label: BASE_COLORS[id].label, theme: null, colors: [...BASE_COLORS[id].colors] as [string, string],
  })),
]

/** The plain spheres, in FALLBACK_COLORS order — by id, so adding a theme can't shift them.
 *  The BASE_COLORS are pickable but deliberately not in this pool: adding them here would
 *  change the default avatar of every existing agent that has none picked. */
const PLAIN_CHOICES: AvatarChoice[] = ['ember', 'mint', 'dusk']

export function getAvatarChoice(id: AvatarChoice): AvatarChoiceConfig {
  return AVATAR_CHOICES.find(choice => choice.id === id) ?? AVATAR_CHOICES[0]
}

/** The avatar an agent gets when nobody has picked one: from its name, else a plain sphere by seed. */
export function defaultAvatarChoice(name: string, seed: string): AvatarChoice {
  const theme = pickAvatarTheme(name)
  if (theme) return theme
  return PLAIN_CHOICES[hashSeed(seed) % PLAIN_CHOICES.length]
}

export function pickAvatarTheme(name: string): AvatarTheme | null {
  for (const [theme, re] of THEME_KEYWORDS) if (re.test(name)) return theme
  return null
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h
}

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
  /** Corner radius of the avatar tile — a px number, or e.g. '50%' for a circle. */
  radius?: number | string
  /** Freezes hover/bounce reactions (paused agents) — idle bob still plays. */
  inert?:  boolean
  /** Forces the sphere colours (a picked avatar); otherwise they come from the theme / seed. */
  colors?: [string, string]
  /** Draws eyes on the head that look at `gaze` and blink. Closed while `inert` (asleep). */
  eyes?:   boolean
  /** Fill behind the spheres. Defaults to the page's light surface; the orb passes 'transparent'. */
  backdrop?: string
  /** Awake, asleep (paused — eyes shut), drowsy (draft — half-lidded) or unavailable. Defaults from `inert`. */
  mood?:   AvatarMood
  /** What the eyes follow — see gaze.ts. Without it they look ahead. */
  gaze?:   GazeChannel
}

// Eyes — two vertical pills side by side.
// Eyes, in viewBox units: centred ±EYE_X off the head's middle, a touch above its centre.
const EYE_X = 3.5   // eye half-width 1.8 + 1.7 = a 3.4-unit gap between the eyes
const EYE_LIFT = 1
/** How far the eyes travel across the face toward what they look at, horizontally / vertically. */
const LOOK_X = 2
const LOOK_Y = 1.5

export function AnimatedPersonaAvatar({
  theme,
  seed,
  hovered,
  bounceKey = 0,
  size      = 64,
  radius    = 8,
  inert     = false,
  colors: colorsProp,
  eyes      = false,
  backdrop  = 'var(--avatar-backdrop, var(--neutral-50))',
  mood: moodProp,
  gaze,
}: AnimatedPersonaAvatarProps) {
  const reduceMotion = useReducedMotion() ?? false
  const uid  = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const hash = hashSeed(seed)
  // Per-card phase offset (radians-ish) so neighbouring cards never bob in sync.
  const phase = (Math.imul(hash, 2654435761) >>> 0) / 4294967296 * Math.PI * 2
  const config = theme ? AVATAR_THEMES[theme] : null
  const [c0, c1] = colorsProp ?? config?.colors ?? FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
  const interior = config?.interior
  const mood: AvatarMood = moodProp ?? (inert ? 'asleep' : 'awake')

  const rootRef  = useRef<HTMLDivElement>(null)
  const headRef  = useRef<SVGCircleElement>(null)
  const bodyRef  = useRef<SVGEllipseElement>(null)
  const visorRef = useRef<SVGGElement>(null)
  const clipBRef = useRef<SVGEllipseElement>(null)
  const ringRef  = useRef<SVGCircleElement>(null)
  const flashRef = useRef<SVGRectElement>(null)
  const partsRef = useRef<SVGGElement>(null)
  const eyeRefs   = useRef<(SVGGElement | null)[]>([])

  // Animation state lives in a ref so the rAF loop reads current values
  // without restarting on every prop change.
  const st = useRef({
    hover: false, ht: 0, ct: -9, interior: { ph: (hash % 97) / 97 },
    inert: false,
    // Eyes: eased pupil offset, the last blink, and when the next one is due.
    lookX: 0, lookY: 0, blinkAt: -9, nextBlink: 1 + (hash % 300) / 100, blinkTwice: false,
    lookSource: 'ahead', saccadeUntil: 0, microAt: 0, microX: 0, microY: 0,
    heldTarget: null as [number, number] | null, heldUntil: 0,
    rect: null as DOMRect | null,
    visitor: false, vt: 0,
  })

  useEffect(() => {
    const s = st.current
    const now = performance.now() / 1000
    s.hover = hovered && !inert
    s.inert = inert
    // Visits count even for a sleeping agent — that's when it peeks.
    if (hovered && !s.visitor) s.vt = now
    s.visitor = hovered
    if (hovered && !inert) {
      s.ht = now
      // A blink on arrival — the agent noticing you.
      s.nextBlink = now + 0.05
    }
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
      const hr = 15, by = 67, br = 25
      // The head rests joined to the body (no idle bob or hover dip to pull them apart);
      // only the click hop lifts it off.
      let hy = 28
      let sq = 0, rk = -1

      const c = now - s.ct
      if (c < 0.75 && !reduceMotion) {
        const q = c / 0.75
        hy -= Math.sin(Math.PI * Math.min(q / 0.8, 1)) * 20
        if (q > 0.75) sq = Math.sin(((q - 0.75) / 0.25) * Math.PI) * 0.16
        rk = q
      }

      set(headRef.current,  { cy: hy, r: hr })

      const rx = br * (1 + sq), ry = br * (1 - sq), cy = by + br * sq
      set(bodyRef.current,  { cy, rx, ry })
      set(clipBRef.current, { cy, rx, ry })

      if (rk >= 0) set(ringRef.current, { cy: cy - ry + 2, r: 6 + rk * 30, opacity: (1 - rk) * 0.8 })
      else         set(ringRef.current, { opacity: 0 })

      if (interior) {
        const frame: InteriorFrame = {
          now, dt, hover: s.hover, sinceClick: c,
          head: [hy, hr], body: [cy, ry],
          state: s.interior, reduceMotion, face: eyes,
        }
        interior.update(parts, frame)
        set(flashRef.current, { opacity: interior.flash?.(frame) ?? 0 })
      }

      if (eyes) {
        // The visor rides the head (it jumps on click).
        set(visorRef.current, { transform: `translate(32,${(hy - EYE_LIFT).toFixed(2)})` })
        drawEyes(now, dt, hy)
      }
    }

    // ── Eyes ──────────────────────────────────────────────────────────────────
    // Pursuit with quick saccades on a jump, tiny micro-saccades, a slight head turn, pupils
    // that widen when you arrive, blinks (sometimes double), a happy squint at the button,
    // and moods: asleep (paused, peeks when you come by), drowsy (draft), unavailable.

    const viewBoxPoint = (client: { x: number; y: number }): [number, number] | null => {
      const s = st.current
      const root = rootRef.current
      if (!root) return null
      // Measured once per pointer visit and on scroll/resize — never every frame.
      if (!s.rect) s.rect = root.getBoundingClientRect()
      const box = s.rect
      return box.width > 0 ? [(client.x - box.left) * 64 / box.width, (client.y - box.top) * 64 / box.height] : null
    }
    const dropRect = () => { st.current.rect = null }
    window.addEventListener('scroll', dropRect, true)
    window.addEventListener('resize', dropRect)

    const blink = (now: number, s: typeof st.current) => {
      s.blinkAt = now
      // One in six is a double blink.
      s.blinkTwice = Math.random() < 0.16
      s.nextBlink = now + (mood === 'unavailable' ? 6 : 2.6 + Math.random() * 3.4)
    }

    const drawEyes = (now: number, dt: number, hy: number) => {
      const s = st.current
      const g = gaze
      const ey = hy - EYE_LIFT
      const awake = mood === 'awake' || mood === 'drowsy'

      // ─ Where to look. Attention (the button) > pointer > a held last look > the scene.
      let target: [number, number] | null = null
      let source = 'ahead'
      let squint = false
      if (g?.attention && awake) {
        target = viewBoxPoint(g.attention); source = 'attention'; squint = true
      } else if (g?.pointer && mood !== 'unavailable') {
        target = viewBoxPoint(g.pointer); source = 'pointer'
        s.heldTarget = target; s.heldUntil = 0
      } else if (s.heldTarget && s.heldUntil === 0) {
        // The pointer just left: hold the look half a second, then blink and glide back.
        s.heldUntil = now + 0.5
        target = s.heldTarget; source = 'pointer'
      } else if (s.heldTarget && now < s.heldUntil) {
        target = s.heldTarget; source = 'pointer'
      } else {
        if (s.heldTarget) { s.heldTarget = null; if (awake && !reduceMotion) blink(now, s) }
        if (mood === 'unavailable') { target = [32 - 6, ey + 8]; source = 'down' }
        else if (g?.ambient) { target = [g.ambient.x, g.ambient.y]; source = 'ambient' }
      }
      if (!g?.pointer) s.rect = null

      let lx = 0, ly = 0
      if (target) {
        const dx = target[0] - 32, dy = target[1] - ey
        const d = Math.hypot(dx, dy) || 1
        const reach = Math.min(1, d / 14)   // a target right on the face barely moves them
        lx = (dx / d) * LOOK_X * reach
        ly = (dy / d) * LOOK_Y * reach
      }

      // ─ Saccade: a big change of direction or of what's being watched snaps quickly.
      const turn = Math.abs(Math.atan2(ly, lx) - Math.atan2(s.lookY, s.lookX))
      const jumped = source !== s.lookSource || (Math.hypot(lx - s.lookX, ly - s.lookY) > 0.5 && Math.min(turn, Math.PI * 2 - turn) > 0.44)
      if (jumped) {
        s.saccadeUntil = now + 0.09
        // A long hand-off between scene elements gets a blink, like a real glance.
        if (source === 'ambient' && s.lookSource === 'ambient' && Math.hypot(lx - s.lookX, ly - s.lookY) > 1.2 && !reduceMotion) blink(now, s)
        s.lookSource = source
      }
      // ─ Micro-saccades: small held jitters every ~0.6–1.6s.
      if (now >= s.microAt && !reduceMotion) {
        s.microX = (Math.random() - 0.5) * 0.24
        s.microY = (Math.random() - 0.5) * 0.24
        s.microAt = now + 0.6 + Math.random()
      }
      const rate = reduceMotion ? Infinity : now < s.saccadeUntil ? 28 : 10
      const ease = dt > 0 && rate !== Infinity ? 1 - Math.exp(-dt * rate) : 1
      s.lookX += (lx + s.microX - s.lookX) * ease
      s.lookY += (ly + s.microY - s.lookY) * ease

      // ─ Lids.
      let open = 1
      // Eyes stay open in every mood (only the blink closes them).
      if (!reduceMotion) {
        if (now >= s.nextBlink) blink(now, s)
        const b = now - s.blinkAt
        const one = (t: number) => (t < 0.06 ? t / 0.06 : t < 0.14 ? 1 - (t - 0.06) / 0.08 : 0)   // close 60ms, open 80ms
        const shut = Math.max(one(b), s.blinkTwice ? one(b - 0.22) : 0)
        open = 1 - shut * 0.9
      }
      // Happy: the eyes become little upturned arcs, "^ ^", instead of open eyes.
      const happy = squint && open > 0.5
      const lid = happy ? 1 : open

      ;[-1, 1].forEach((side, i) => {
        const thisLid = lid
        // Both eyes drift together with the look, so the gap between them never changes.
        const x = 32 + side * EYE_X + s.lookX
        const eye = eyeRefs.current[i]
        set(eye, { transform: `translate(${x.toFixed(2)},${(ey + s.lookY).toFixed(2)}) scale(1,${thisLid.toFixed(3)})` })
        set(eye?.children[0], { opacity: happy ? 0 : 1 })   // the open eye
        set(eye?.children[1], { opacity: happy ? 1 : 0 })   // the "^"
      })
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
    if (!reduceMotion) raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', dropRect, true)
      window.removeEventListener('resize', dropRect)
    }
  }, [interior, phase, reduceMotion, eyes, gaze, mood])


  const gradId = `pa-g-${uid}`
  const gooId  = `pa-goo-${uid}`
  const clipId = `pa-cp-${uid}`
  const visorId = `pa-vz-${uid}`

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
        // Always white behind the spheres, in light and dark.
        backgroundColor: backdrop,
      }}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ display: 'block' }}>
        <defs>
          <radialGradient id={gradId} cx=".35" cy=".3" r=".8">
            <stop offset="0"   stopColor="#fff" />
            <stop offset=".14" stopColor={c0} />
            <stop offset="1"   stopColor={c1} />
          </radialGradient>
          <filter id={gooId} x="-20%" y="-20%" width="140%" height="150%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="b" />
            <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10" result="goo" />
            {/* A soft shadow under the merged head + body, lifting them off the background. */}
            <feDropShadow in="goo" dx="0" dy="1.6" stdDeviation="1.6" style={{ floodColor: 'var(--avatar-shadow, rgba(20,20,30,0.28))' }} />
          </filter>
          {/* Face screen colours come from theme tokens (globals.css): a black screen in both modes. */}
          <radialGradient id={visorId} cx=".4" cy=".3" r=".9">
            <stop offset="0" style={{ stopColor: 'var(--avatar-visor-a, #262b38)' }} />
            <stop offset="1" style={{ stopColor: 'var(--avatar-visor-b, #07080c)' }} />
          </radialGradient>
          {/* Interiors live in the body only — heads are solid, never see-through. */}
          <clipPath id={clipId}>
            <ellipse ref={clipBRef} cx={32} cy={67} rx={25} ry={25} />
          </clipPath>
        </defs>

        <circle ref={ringRef} cx={32} fill="none" stroke={c1} strokeWidth={1.2} opacity={0} />

        <g filter={`url(#${gooId})`}>
          <ellipse ref={bodyRef} cx={32} cy={67} rx={25} ry={25} fill={`url(#${gradId})`} />
          <circle  ref={headRef} cx={32} cy={28} r={15} fill={`url(#${gradId})`} />
        </g>

        {interior && (
          <g ref={partsRef} clipPath={`url(#${clipId})`}>
            {Array.from({ length: interior.count }, (_, i) => interior.render(i))}
          </g>
        )}

        {/* EVE-style face: a round screen across the head, the eyes on it. */}
        {eyes && (
          <g ref={visorRef} transform={`translate(32,${28 - EYE_LIFT})`}>
            <path d="M-12.2 0A12.2 10.2 0 0 1 12.2 0A12.2 12.2 0 0 1 -12.2 0Z" fill={`url(#${visorId})`} />
            <path d="M-12.2 0A12.2 10.2 0 0 1 12.2 0A12.2 12.2 0 0 1 -12.2 0Z" fill="none" stroke="#000" strokeOpacity={0.3} strokeWidth={0.5} />
            {/* Gloss: a soft sheen across the top of the glass. */}
            <ellipse cx={-2.5} cy={-7.2} rx={5} ry={1.2} fill="#fff" opacity={0.18} />
          </g>
        )}

        {eyes && [-1, 1].map((side, i) => (
          <g key={side} ref={el => { eyeRefs.current[i] = el }} transform={`translate(${32 + side * EYE_X},${28 - EYE_LIFT})`}>
            <g>
              {/* Retro-TV eye: a vertical pill with faint scanlines (chord-width so they stay inside the round ends). */}
              <rect x={-1.8} y={-3.6} width={3.6} height={7.2} rx={1.8} style={{ fill: 'var(--avatar-eye, #9fd8ff)' }} />
              {[[-3, 1.34], [-1.8, 1.8], [-0.6, 1.8], [0.6, 1.8], [1.8, 1.8], [3, 1.34]].map(([y, hw]) => (
                <line key={y} x1={-hw} x2={hw} y1={y} y2={y} style={{ stroke: 'var(--avatar-eye-line, #07080c)' }} strokeOpacity={0.3} strokeWidth={0.4} />
              ))}
            </g>
            <path d="M-2.6 1.1Q0-2.4 2.6 1.1" fill="none" style={{ stroke: 'var(--avatar-eye, #9fd8ff)' }} strokeWidth={1.4} strokeLinecap="round" opacity={0} />
          </g>
        ))}

        <rect ref={flashRef} width={64} height={64} fill="#fff" opacity={0} pointerEvents="none" />
      </svg>
    </div>
  )
}

export default AnimatedPersonaAvatar
