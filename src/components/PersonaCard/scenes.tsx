import React from 'react'

// The themed scenery around an agent's avatar (see HeroScene). A scene is built once for the
// banner's size — laid out from a seeded random source, so an agent always gets the same sky
// — and `update` positions every element each frame, returning the point the avatar's eyes
// should follow while nobody is pointing.
//
// Two layers: `back` is drawn behind the orb, `front` over it (but under the card's menu).
// Things that circle the orb are drawn in both and swap by depth where they're clear of it,
// so nothing ever jumps. Sizes scale with the avatar (`u`, 1 at the main card's 110px orb).

export type SceneKind = 'weather' | 'guide' | 'scout' | 'marketing' | 'orbit'

export interface SceneCtx {
  W: number; H: number; cx: number; cy: number
  /** The orb's radius, px. */
  R: number
  colors: [string, string]
  rand: () => number
  uid: string
  /** Small heroes: fewer elements, no front layer, no rain or bursts. */
  lite: boolean
}

export interface SceneFrame {
  /** The scene clock (s) — faster on hover, surging after a click, frozen while paused. */
  t: number
  now: number
  dt: number
  W: number; H: number; cx: number; cy: number; R: number
  /** 0…1, eased. */
  hover: number
  /** Seconds since the last click burst began (large when none). */
  sinceClick: number
  /** Pointer offset over the banner, −1…1 each way, eased — for parallax. */
  par: { x: number; y: number }
  reduceMotion: boolean
}

export interface Point { x: number; y: number }

export interface BuiltScene {
  defs?:  React.ReactNode
  /** Behind the orb. One top-level element per part. */
  back:   React.ReactNode[]
  /** Over the orb. `update` receives back parts then front parts, in order. */
  front?: React.ReactNode[]
  update: (parts: SVGElement[], f: SceneFrame) => Point | null
}

export type Builder = (ctx: SceneCtx) => BuiltScene

// ── Helpers ─────────────────────────────────────────────────────────────────────

export const set = (el: Element | undefined, attrs: Record<string, number | string>) => {
  if (!el) return
  for (const k in attrs) {
    const v = String(attrs[k])
    if (el.getAttribute(k) !== v) el.setAttribute(k, v)
  }
}
export const f2 = (v: number) => v.toFixed(2)
export const place = (x: number, y: number, rotate = 0, sx = 1, sy = sx) =>
  `translate(${f2(x)},${f2(y)}) rotate(${f2(rotate)}) scale(${sx.toFixed(3)},${sy.toFixed(3)})`
export const wrap = (v: number, m: number) => ((v % m) + m) % m
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export const unitOf = (R: number) => Math.max(0.55, Math.min(1.2, R / 55))
export const easeOutBack = (x: number) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }

/** A random point on the banner `pad` px clear of the orb and `edge` px in from the sides,
 *  avoiding the ⋮ menu's corner. */
export function scatter(ctx: SceneCtx, pad: number, edge: number): Point {
  for (let tries = 0; tries < 60; tries++) {
    const x = edge + ctx.rand() * (ctx.W - edge * 2)
    const y = edge + ctx.rand() * (ctx.H - edge * 2)
    const clearOfOrb = Math.hypot(x - ctx.cx, y - ctx.cy) > ctx.R + pad
    const clearOfMenu = !(x > ctx.W - 48 && y < 40)
    if (clearOfOrb && clearOfMenu) return { x, y }
  }
  return { x: edge, y: ctx.H - edge }
}

/** Where the avatar's head is, for keeping front-layer things off its eyes. */
const headOf = (f: SceneFrame) => ({ x: f.cx, y: f.cy - f.R * 0.62, r: f.R * 0.3 })
/** Dims a front element that would sit over the eyes. */
export function overEyes(f: SceneFrame, p: Point): number {
  const h = headOf(f)
  return Math.hypot(p.x - h.x, p.y - h.y) < h.r + 8 ? 0.35 : 1
}

// ── Weather ─────────────────────────────────────────────────────────────────────
// A sun with turning rays; far clouds high and low; two near clouds — the lower one drifts
// across the orb's lower third IN FRONT of it. Hover darkens the sky and it rains; a click
// strikes lightning from the nearest cloud. The eyes follow the cloud approaching the face.

const CLOUD = (
  <>
    <circle cx={-14} cy={0} r={8} /><circle cx={-3} cy={-6} r={11} /><circle cx={10} cy={-3} r={9} /><circle cx={18} cy={2} r={6} />
    <rect x={-22} y={0} width={46} height={8} rx={4} />
  </>
)
const BOLT = 'M0 0l-5 11h5l-4 12 11-15h-5l4-8z'

const weather: Builder = ctx => {
  const { W, H, cx, cy, R, uid, lite } = ctx
  const u = unitOf(R)
  const far = Array.from({ length: lite ? 2 : 3 }, (_, i) => ({
    y: (i % 2 === 0 ? 0.12 + ctx.rand() * 0.2 : 0.72 + ctx.rand() * 0.14) * H,
    offset: ctx.rand(), speed: 6,
  }))
  const near = [
    { y: cy - 0.55 * R, offset: ctx.rand() },
    { y: cy + 0.72 * R, offset: ctx.rand() },   // the lead lane — crosses in front of the orb
  ].slice(0, lite ? 1 : 2)
  const nearScale = 1.25 * u, farScale = 0.55 * u
  const span = W + 160 * u
  const drops = lite ? 0 : 14
  const sun = { x: W * 0.2, y: H * 0.22 }

  const cloud = (key: string, fill: string, opacity: number, shade: boolean) => (
    <g key={key} opacity={opacity}>
      {shade && <g transform="translate(0,2)" fill={ctx.colors[1]} opacity={0.18}>{CLOUD}</g>}
      <g fill={fill}>{CLOUD}</g>
    </g>
  )

  const back: React.ReactNode[] = [
    <rect key="sky" width={W} height={H} fill="#0b1a33" opacity={0} />,
    <g key="sun">
      <circle r={0.6 * R} fill={`url(#sh-${uid})`} />
      <g data-rays>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2
          return <line key={i} x1={Math.cos(a) * 0.3 * R} y1={Math.sin(a) * 0.3 * R} x2={Math.cos(a) * 0.41 * R} y2={Math.sin(a) * 0.41 * R} stroke="#fff3c4" strokeWidth={1.2} strokeLinecap="round" opacity={0.5} />
        })}
      </g>
      <circle r={0.22 * R} fill="#fff3c4" opacity={0.9} />
    </g>,
    ...far.map((_, i) => cloud(`f${i}`, '#fff', 0.22, false)),
    ...near.map((_, i) => cloud(`n${i}`, '#fff', 0.85, true)),
    ...Array.from({ length: drops }, (_, k) => (
      <line key={`d${k}`} x1={0} y1={0} x2={-1.3} y2={6} stroke="#fff" strokeWidth={1.2} strokeLinecap="round" opacity={0} />
    )),
    <path key="bolt" d={BOLT} fill="#fff8d6" opacity={0} />,
    <rect key="flash" width={W} height={H} fill="#fff" opacity={0} />,
  ]
  const front = lite ? [] : [cloud('front', '#fff', 0, true)]

  // Part indices.
  const SKY = 0, SUN = 1, FAR = 2, NEAR = FAR + far.length, DROPS = NEAR + near.length
  const BOLT_I = DROPS + drops, FLASH = BOLT_I + 1, FRONT = FLASH + 1

  let lead = -1

  return {
    defs: (
      <radialGradient id={`sh-${uid}`}>
        <stop offset="0" stopColor="#fff3c4" stopOpacity={0.35} />
        <stop offset="1" stopColor="#fff3c4" stopOpacity={0} />
      </radialGradient>
    ),
    back,
    front,
    update: (parts, f) => {
      set(parts[SKY], { opacity: (f.hover * 0.18).toFixed(3) })
      const sunEl = parts[SUN]
      set(sunEl, { transform: place(sun.x - f.par.x * 2, sun.y - f.par.y * 2) })
      set(sunEl?.querySelector('[data-rays]') ?? undefined, { transform: `rotate(${f2(((f.t * 0.15) * 180) / Math.PI)})` })

      far.forEach((c, i) => {
        const x = wrap(c.offset * span + f.t * c.speed * u, span) - 80 * u - f.par.x * 3
        set(parts[FAR + i], { transform: place(x, c.y - f.par.y * 2, 0, farScale) })
      })
      const nearAt: Point[] = near.map((c, i) => {
        const x = wrap(c.offset * span + f.t * 14 * u, span) - 80 * u - f.par.x * 7
        const y = c.y + Math.sin(f.t * 0.4 + i) * 1.5 - f.par.y * 4
        set(parts[NEAR + i], { transform: place(x, y, 0, nearScale) })
        return { x, y }
      })

      // The lower near cloud crosses IN FRONT of the orb while it's over it.
      if (!lite && nearAt[1]) {
        const p = nearAt[1]
        const over = Math.abs(p.x - cx) < R + 20 * u
        set(parts[FRONT], { transform: place(p.x, p.y, 0, nearScale), opacity: over ? (0.75 * overEyes(f, p)).toFixed(3) : 0 })
      }

      for (let k = 0; k < drops; k++) {
        const from = nearAt[k % nearAt.length]
        const fall = wrap(f.t * 160 + k * 37, H)
        const x = from.x + ((k % 7) - 3) * 6 * u - fall * 0.21   // a 12° slant
        const y = from.y + 8 * u + fall
        set(parts[DROPS + k], { transform: place(x, y), opacity: (f.hover * 0.5 * clamp01(1 - (y / H))).toFixed(3) })
      }

      // Lightning from the near cloud closest to the orb, in step with the avatar's flash.
      const c = f.sinceClick
      const striking = c < 0.3 && !f.reduceMotion && !lite
      if (striking) {
        const from = nearAt.reduce((a, b) => (Math.abs(a.x - cx) < Math.abs(b.x - cx) ? a : b))
        const on = c < 0.08 || (c > 0.15 && c < 0.23)
        set(parts[BOLT_I], { transform: place(from.x, from.y + 6 * u, 0, 1.4 * u), opacity: on ? 1 : 0 })
      } else set(parts[BOLT_I], { opacity: 0 })
      set(parts[FLASH], { opacity: c < 0.35 && !f.reduceMotion && !lite ? (0.22 * (1 - c / 0.35)).toFixed(3) : 0 })

      // Focus: the near cloud on its way in (closest to the face from the left); hand off once
      // it has drifted 1.2R past the middle.
      const approaching = nearAt.map((p, i) => ({ p, i })).filter(({ p }) => p.x < cx + 1.2 * R && p.x > -20)
      const pick = approaching.length ? approaching.reduce((a, b) => (a.p.x > b.p.x ? a : b)) : null
      lead = pick ? pick.i : lead
      return pick ? pick.p : nearAt[0] ?? null
    },
  }
}

// ── Guide (travel) ──────────────────────────────────────────────────────────────
// A flat, tilted orbit round the orb: the plane flies IN FRONT of it on the near half and
// behind it on the far half, trailing a dotted contrail, under a field of twinkling city
// lights. Pins pop as it passes (and show their codes on hover); a click is a barrel roll.

const PIN = 'M0 0C-4-5-5-8-5-10a5 5 0 1 1 10 0c0 2-1 5-5 10z'
const PIN_CODES = ['TYO', 'LIS', 'NYC']

const guide: Builder = ctx => {
  const { W, H, cx, cy, R, lite } = ctx
  const u = unitOf(R)
  const rx = Math.min(1.75 * R, W / 2 - 14)
  const ry = 0.42 * R
  const oy = cy + 4 * u
  const tilt = (-10 * Math.PI) / 180
  const offset = ctx.rand() * Math.PI * 2
  const stars = Array.from({ length: lite ? 8 : 18 }, () => ({ ...scatter(ctx, 4, 6), r: 0.8 + ctx.rand() * 0.6, o: 0.15 + ctx.rand() * 0.45, hz: 0.6 + ctx.rand() * 0.8, ph: ctx.rand() * 6.28 }))
  const pins = (lite ? [] : [0, 1, 2]).map(i => {
    const side = i % 2 === 0 ? -1 : 1
    const d = (1.3 + ctx.rand() * 0.9) * R
    const x = Math.max(16, Math.min(W - 16, cx + side * d))
    const y = Math.max(22, Math.min(H - 10, cy + (ctx.rand() - 0.5) * H * 0.5))
    return { x, y: x > W - 48 && y < 40 ? 48 : y, code: PIN_CODES[i], popAt: -9 }
  })

  const at = (theta: number): Point => {
    const ex = rx * Math.cos(theta), ey = ry * Math.sin(theta)
    return { x: cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y: oy + ex * Math.sin(tilt) + ey * Math.cos(tilt) }
  }
  const arc = (from: number, to: number) => {
    const pts = Array.from({ length: 25 }, (_, i) => at(from + ((to - from) * i) / 24))
    return 'M' + pts.map(p => `${f2(p.x)} ${f2(p.y)}`).join('L')
  }

  const plane = (key: string) => (
    <g key={key} opacity={0}>
      <path d="M-7-5L8 0-7 5-4 0z" fill="#fff" />
      <path d="M-4 0H8" stroke={ctx.colors[1]} strokeOpacity={0.5} strokeWidth={0.8} />
    </g>
  )
  const trail = (key: string) => <path key={key} d="" fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="0.1 4" />

  // A big globe wireframe behind the orb (the avatar itself stays a plain black agent).
  const gR = 1.45 * R
  const back: React.ReactNode[] = [
    <g key="globe" fill="none" stroke="#fff" strokeOpacity={0.13} strokeWidth={1}>
      <circle r={gR} />
      {[-0.55, 0, 0.55].map(k => <ellipse key={k} cy={k * gR} rx={gR * Math.sqrt(1 - k * k)} ry={gR * 0.18 * Math.sqrt(1 - k * k)} />)}
      {[0, 1, 2, 3].map(m => <ellipse key={`m${m}`} data-meridian={m} rx={gR} ry={gR} />)}
    </g>,
    ...stars.map((s, i) => <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />),
    <path key="arcBack" d={arc(Math.PI, Math.PI * 2)} fill="none" stroke="#fff" strokeOpacity={0.14} strokeDasharray="2 5" />,
    ...pins.map((p, i) => (
      <g key={`p${i}`}>
        <circle r={4} fill="none" stroke="#fff" strokeWidth={1} opacity={0} />
        <path d={PIN} fill="#fff" />
        <circle cy={-10} r={1.8} fill={ctx.colors[1]} />
        <text y={-19} textAnchor="middle" fontSize={8} fontFamily="var(--font-mono, ui-monospace, monospace)" fill="#fff" opacity={0}>{p.code}</text>
      </g>
    )),
    trail('trailBack'),
    plane('planeBack'),
  ]
  const front: React.ReactNode[] = lite ? [] : [
    <path key="arcFront" d={arc(0, Math.PI)} fill="none" stroke="#fff" strokeOpacity={0.14} strokeDasharray="2 5" />,
    trail('trailFront'),
    plane('planeFront'),
  ]

  const GLOBE = 0, STARS = 1, ARC_B = STARS + stars.length, PINS = ARC_B + 1, TRAIL_B = PINS + pins.length, PLANE_B = TRAIL_B + 1
  const ARC_F = PLANE_B + 1, TRAIL_F = ARC_F + 1, PLANE_F = TRAIL_F + 1

  return {
    back,
    front,
    update: (parts, f) => {
      const sx = -f.par.x * 4, sy = -f.par.y * 2
      // Globe: meridians turn (rx = r·|cos a|) — slow at idle, quicker on hover.
      const globe = parts[GLOBE]
      set(globe, { transform: `translate(${f2(cx - f.par.x * 3)},${f2(cy - f.par.y * 2)})` })
      globe?.querySelectorAll('[data-meridian]').forEach((el, m) => {
        const a = ((f.t * 0.05 + m / 4) % 1) * Math.PI
        set(el, { rx: f2(Math.abs(gR * Math.cos(a))) })
      })
      stars.forEach((s, i) => {
        const tw = 0.5 + 0.5 * Math.sin(f.now * s.hz * 6.28 + s.ph)
        set(parts[STARS + i], { opacity: (s.o * (0.4 + 0.6 * tw)).toFixed(3), transform: `translate(${f2(-f.par.x * 2)},${f2(-f.par.y)})` })
      })
      const shift = `translate(${f2(sx)},${f2(sy)})`
      set(parts[ARC_B], { transform: shift, 'stroke-dashoffset': f2(-f.t * 8) })
      if (!lite) set(parts[ARC_F], { transform: shift, 'stroke-dashoffset': f2(-f.t * 8) })

      const theta = offset + f.t * 0.55
      const p = at(theta)
      const plane = { x: p.x + sx, y: p.y + sy }
      const near = Math.sin(wrap(theta, Math.PI * 2)) > 0   // the lower half of the loop

      // Contrail: 16 samples behind the plane, each drawn in the layer of the half it's on.
      const backPts: string[] = [], frontPts: string[] = []
      for (let k = 0; k < 16; k++) {
        const th = theta - k * 0.06
        const q = at(th)
        const onNearHalf = Math.sin(wrap(th, Math.PI * 2)) > 0
        ;(onNearHalf && !lite ? frontPts : backPts).push(`${f2(q.x + sx)} ${f2(q.y + sy)}`)
      }
      const pathOf = (pts: string[]) => (pts.length > 1 ? `M${pts.join('L')}` : '')
      set(parts[TRAIL_B], { d: pathOf(backPts) })
      if (!lite) set(parts[TRAIL_F], { d: pathOf(frontPts) })

      // Heading along the orbit, with a barrel roll after a click.
      const dx = -rx * Math.sin(theta), dy = ry * Math.cos(theta)
      const heading = (Math.atan2(dx * Math.sin(tilt) + dy * Math.cos(tilt), dx * Math.cos(tilt) - dy * Math.sin(tilt)) * 180) / Math.PI
      const roll = f.sinceClick < 0.6 && !f.reduceMotion && !lite ? Math.cos((f.sinceClick / 0.6) * Math.PI * 2) : 1
      const planeFront = near && !lite
      set(parts[PLANE_B], { transform: place(plane.x, plane.y, heading, 0.75 * u, 0.75 * u * roll), opacity: planeFront ? 0 : lite && near ? 1 : 0.55 })
      if (!lite) set(parts[PLANE_F], { transform: place(plane.x, plane.y, heading, 1.15 * u, 1.15 * u * roll), opacity: planeFront ? overEyes(f, plane) : 0 })

      // Pins pop as the plane passes, and show their city codes on hover.
      pins.forEach((pin, i) => {
        const g = parts[PINS + i]
        const px = pin.x - f.par.x * 4, py = pin.y - f.par.y * 2
        if (Math.hypot(plane.x - px, plane.y - (py - 8)) < 22 * u && f.now - pin.popAt > 1.2) pin.popAt = f.now
        const k = f.now - pin.popAt
        const pop = k < 0.3 ? 0.6 + 0.4 * easeOutBack(k / 0.3) : 1
        set(g, { transform: place(px, py, 0, pop * 0.9 * u) })
        const ring = g?.firstElementChild ?? undefined
        set(ring, { r: f2(4 + clamp01(k / 0.6) * 10), opacity: k < 0.6 ? (0.6 * (1 - k / 0.6)).toFixed(3) : 0 })
        set(g?.lastElementChild ?? undefined, { opacity: (f.hover * 0.6).toFixed(3) })
      })
      return plane
    },
  }
}

// ── Scout (research) ────────────────────────────────────────────────────────────
// Radar: rings pulse out from the orb, a sweep turns round it pinging blips, papers drift up
// the sides and sparkles twinkle. The eyes dart to each blip as it's pinged — scanning — and
// otherwise read the paper nearest the face. A click "reads" that paper into the orb.

const SPARK = 'M0-4Q.6-.6 4 0Q.6.6 0 4Q-.6.6-4 0Q-.6-.6 0-4z'

const scout: Builder = ctx => {
  const { W, H, cx, cy, R, uid, lite } = ctx
  const u = unitOf(R)
  const rings = 3
  const blips = Array.from({ length: lite ? 3 : 6 }, () => {
    const a = ctx.rand() * Math.PI * 2, d = (1.3 + ctx.rand() * 1.1) * R
    return { a, x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.62, pingAt: -9 }
  }).filter(b => b.x > 8 && b.x < W - 8 && b.y > 8 && b.y < H - 8 && !(b.x > W - 48 && b.y < 40))
  const papers = Array.from({ length: lite ? 2 : 3 }, (_, i) => ({
    x: (i % 2 === 0 ? 0.08 + ctx.rand() * 0.2 : 0.72 + ctx.rand() * 0.2) * W,
    offset: ctx.rand(), speed: 10,
  }))
  const sparks = Array.from({ length: lite ? 3 : 8 }, () => ({ ...scatter(ctx, 10, 12), ph: ctx.rand() }))
  const span = H + 40 * u
  const sweepR = 2.2 * R
  const wedge = `M0 0L${f2(sweepR)} 0A${f2(sweepR)} ${f2(sweepR)} 0 0 1 ${f2(sweepR * Math.cos(Math.PI / 6))} ${f2(sweepR * Math.sin(Math.PI / 6))}Z`
  const ringStroke = `color-mix(in srgb, ${ctx.colors[0]} 60%, white)`

  const back: React.ReactNode[] = [
    <path key="sweep" d={wedge} fill={`url(#sw-${uid})`} />,
    ...Array.from({ length: rings }, (_, k) => <circle key={`r${k}`} r={R} fill="none" style={{ stroke: ringStroke }} opacity={0} />),
    ...blips.map((_, i) => <circle key={`b${i}`} r={1.5} fill="#fff" opacity={0.25} />),
    ...papers.map((_, i) => (
      <g key={`p${i}`}>
        <rect x={-6} y={-7.5} width={12} height={15} rx={2} fill="#fff" opacity={0.85} />
        <path d="M3-7.5L6-4.5H3Z" fill={ctx.colors[1]} opacity={0.3} />
        {[-3.5, -0.5, 2.5].map((y, j) => <rect key={j} x={-3.5} y={y} width={j === 2 ? 5 : 7} height={1.2} rx={0.6} fill={ctx.colors[1]} opacity={0.5} />)}
      </g>
    )),
    ...sparks.map((_, i) => <path key={`s${i}`} d={SPARK} fill="#fff" opacity={0} />),
    <circle key="burst" r={R} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0} />,
  ]

  const SWEEP = 0, RINGS = 1, BLIPS = RINGS + rings, PAPERS = BLIPS + blips.length, SPARKS = PAPERS + papers.length, BURST = SPARKS + sparks.length
  let lastSweep = 0
  let pinged: { p: Point; at: number } | null = null

  return {
    defs: (
      <radialGradient id={`sw-${uid}`} cx="0" cy="0" r={sweepR} gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={ctx.colors[0]} stopOpacity={0.14} />
        <stop offset="1" stopColor={ctx.colors[0]} stopOpacity={0} />
      </radialGradient>
    ),
    back,
    update: (parts, f) => {
      const sweep = f.t * 0.8
      set(parts[SWEEP], { transform: `translate(${f2(cx)},${f2(cy)}) rotate(${f2((sweep * 180) / Math.PI)})` })

      const period = 3.2 - f.hover * 1.6
      for (let k = 0; k < rings; k++) {
        const p = wrap(f.now / period + k / rings, 1)
        set(parts[RINGS + k], {
          transform: `translate(${f2(cx)},${f2(cy)})`, r: f2(R + 2 + p * 70 * u),
          'stroke-width': f2(1.2 - p * 0.8), opacity: ((1 - p) * (0.45 + f.hover * 0.15)).toFixed(3),
        })
      }

      // Blips light up as the sweep's leading edge passes over them.
      blips.forEach((b, i) => {
        const a = wrap(b.a, Math.PI * 2), prev = wrap(lastSweep, Math.PI * 2), now = wrap(sweep, Math.PI * 2)
        const crossed = prev <= now ? a > prev && a <= now : a > prev || a <= now
        if (crossed && sweep !== lastSweep) { b.pingAt = f.now; pinged = { p: { x: b.x, y: b.y }, at: f.now } }
        const k = clamp01((f.now - b.pingAt) / 1.2)
        set(parts[BLIPS + i], { cx: f2(b.x - f.par.x * 3), cy: f2(b.y - f.par.y * 2), r: f2(3 - k * 1.5), opacity: (1 - k * 0.75).toFixed(3) })
      })
      lastSweep = sweep

      // Papers drift up the sides; on a click the one nearest the face is "read" into the orb.
      const at: Point[] = papers.map((paper, i) => {
        const y = H + 20 * u - wrap(paper.offset * span + f.t * paper.speed * u, span)
        return { x: paper.x + Math.sin(f.t * 0.7 * 6.28 / 6 + i) * 3 - f.par.x * 6, y: y - f.par.y * 4 }
      })
      const face = { x: cx, y: cy - R * 0.35 }
      const readIdx = at.reduce((best, p, i) => (Math.hypot(p.x - face.x, p.y - face.y) < Math.hypot(at[best].x - face.x, at[best].y - face.y) ? i : best), 0)
      at.forEach((p, i) => {
        let { x, y } = p, scale = u, opacity = 0.85 * clamp01(Math.min((H + 20 - y) / 24, (y + 20) / 24))
        const c = f.sinceClick
        if (i === readIdx && c < 0.8 && !f.reduceMotion && !lite) {
          if (c < 0.5) {
            const q = c / 0.5
            const dir = Math.atan2(p.y - cy, p.x - cx)
            x = p.x + (cx + Math.cos(dir) * R - p.x) * q
            y = p.y + (cy + Math.sin(dir) * R - p.y) * q
            scale = u * (1 - 0.7 * q); opacity *= 1 - q
          } else opacity *= (c - 0.5) / 0.3
        }
        set(parts[PAPERS + i], { transform: place(x, y, Math.sin(f.now * 0.7 * 6.28 + i) * 8, scale), opacity: opacity.toFixed(3) })
      })

      sparks.forEach((s, i) => {
        const live = i < (lite ? 3 : f.hover > 0.5 ? 8 : 5)
        const q = wrap(f.now / 1.4 + s.ph, 1)
        const k = live ? Math.sin(q * Math.PI) : 0
        set(parts[SPARKS + i], { transform: place(s.x - f.par.x * 3, s.y - f.par.y * 2, 0, k * u), opacity: (k * 0.9).toFixed(3) })
      })

      const c = f.sinceClick
      set(parts[BURST], { transform: `translate(${f2(cx)},${f2(cy)})`, r: f2(R + clamp01(c / 0.6) * 40 * u), opacity: c < 0.6 && !lite ? (0.6 * (1 - c / 0.6)).toFixed(3) : 0 })

      // Eyes: dart to the blip just pinged (held a moment), else read the nearest paper.
      if (pinged && f.now - pinged.at < 0.9) return pinged.p
      const reading = at.filter(p => p.y > H * 0.25 && p.y < H * 0.75)
      return reading.length ? reading.reduce((a, b) => (Math.hypot(a.x - face.x, a.y - face.y) < Math.hypot(b.x - face.x, b.y - face.y) ? a : b)) : null
    },
  }
}

// ── Marketing ───────────────────────────────────────────────────────────────────
// A post going live: two stage beams sway down onto the orb while reactions — hearts,
// hashtags, chat, the odd "+24%" trend pill — spawn beside it and float up. A click bursts
// hearts out of the orb with a "+1". The eyes follow the newest reaction.

type Reaction = 'heart' | 'hash' | 'chat' | 'trend'
const HEART = 'M0 4.2C-6-0.5-4.6-6.2 0-3C4.6-6.2 6-0.5 0 4.2Z'

function reactionNode(kind: Reaction, c1: string, key: string) {
  switch (kind) {
    case 'heart': return <g key={key}><circle r={9.5} fill="#fff" stroke="rgba(0,0,0,0.08)" /><path d={HEART} fill="#ff3d71" /></g>
    case 'hash':  return <g key={key}><circle r={9.5} fill="#fff" stroke="rgba(0,0,0,0.08)" /><path d="M-1.6-4.6L-2.6 4.6M1.8-4.6L0.8 4.6M-4.2-1.6H4.4M-4.6 1.6H4" stroke="#6d5dfc" strokeWidth={1.5} strokeLinecap="round" fill="none" /></g>
    case 'chat':  return <g key={key}><path d="M-8-6h16a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-9l-4 3v-3h-3a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="#fff" opacity={0.95} /><g fill={c1}><circle cx={-3.5} r={1} /><circle r={1} /><circle cx={3.5} r={1} /></g></g>
    case 'trend': return (
      <g key={key}>
        <rect x={-17} y={-7} width={34} height={14} rx={7} fill="#fff" opacity={0.95} />
        <path d="M-13 3l4-4 3 3 6-6" stroke="#16a34a" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <text x={4} y={2.5} fontSize={7} fontWeight={700} fill="#16a34a" fontFamily="var(--font-body, sans-serif)">+24%</text>
      </g>
    )
  }
}

const marketing: Builder = ctx => {
  const { W, cx, cy, R, lite } = ctx
  const u = unitOf(R)
  const slots = lite ? 5 : 10
  // Half hearts, a fifth hashtags, the rest chat — and exactly one slot is the trend pill.
  const kinds: Reaction[] = Array.from({ length: slots }, (_, i) => (i === slots - 1 && !lite ? 'trend' : i % 10 < 5 ? 'heart' : i % 10 < 7 ? 'hash' : 'chat'))
  const reactions = kinds.map((kind, i) => ({ kind, life: 3.2 + ctx.rand(), phase: ctx.rand() * 4, side: i % 2 === 0 ? -1 : 1, jitter: ctx.rand() }))
  const burst = lite ? 0 : 8

  const beam = (key: string) => <polygon key={key} points="0,0 0,0 0,0" fill={`url(#mb-${ctx.uid})`} opacity={0.9} />
  const back: React.ReactNode[] = [
    beam('beamL'), beam('beamR'),
    ...reactions.map((r, i) => reactionNode(r.kind, ctx.colors[1], `r${i}`)),
    ...Array.from({ length: burst }, (_, i) => <path key={`h${i}`} d={HEART} fill="#ff5c8a" opacity={0} />),
    <g key="plus" opacity={0}>
      <rect x={-12} y={-8} width={24} height={16} rx={8} fill="#fff" />
      <text y={3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ff3d71" fontFamily="var(--font-body, sans-serif)">+1</text>
    </g>,
  ]
  const BEAMS = 0, REACT = 2, BURST = REACT + reactions.length, PLUS = BURST + burst

  return {
    defs: (
      <linearGradient id={`mb-${ctx.uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.09} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
    ),
    back,
    update: (parts, f) => {
      // Stage beams from the top corners onto the orb, swaying.
      ;[-1, 1].forEach((side, i) => {
        const sway = Math.sin(f.now * 0.25 * 6.28 + i * 2) * 6
        const top = { x: side < 0 ? 0 : W, y: -4 }
        const a = Math.atan2(cy - top.y, cx - top.x) + (sway * Math.PI) / 180
        const len = Math.hypot(cx - top.x, cy - top.y) + R
        const spread = 0.13
        const p1 = { x: top.x + Math.cos(a - spread) * len, y: top.y + Math.sin(a - spread) * len }
        const p2 = { x: top.x + Math.cos(a + spread) * len, y: top.y + Math.sin(a + spread) * len }
        set(parts[BEAMS + i], { points: `${f2(top.x - f.par.x * 2)},${f2(top.y)} ${f2(p1.x)},${f2(p1.y)} ${f2(p2.x)},${f2(p2.y)}` })
      })

      // Reactions: each slot respawns beside the orb every lifetime and floats up.
      let newest: { p: Point; age: number } | null = null
      reactions.forEach((r, i) => {
        const age = wrap(f.t + r.phase, r.life)
        const cycle = Math.floor((f.t + r.phase) / r.life)
        const side = (cycle + i) % 2 === 0 ? r.side : -r.side
        const startX = cx + side * (R + 6 + ((r.jitter * 7 + cycle * 0.37) % 1) * 34) * u
        const x = startX + Math.sin(age * 1.2 * 6.28 + i) * 6 * u - f.par.x * 6
        const y = cy + 0.6 * R - age * 22 * u - f.par.y * 4
        const pop = age < 0.25 ? easeOutBack(age / 0.25) : 1
        const fade = clamp01((r.life - age) / (r.life * 0.3)) * clamp01(y / 20)
        set(parts[REACT + i], { transform: place(x, y, Math.sin(age * 2 + i) * 8, pop * u), opacity: fade.toFixed(3) })
        if (!newest || age < newest.age) newest = { p: { x, y }, age }
      })

      // Click: hearts burst out of the orb's rim and a "+1" rises off its top.
      const c = f.sinceClick
      for (let k = 0; k < burst; k++) {
        const a = (k / burst) * Math.PI * 2 - Math.PI / 2
        const q = clamp01(c / 0.7)
        const d = R + (1 - Math.pow(1 - q, 2)) * 84 * u
        set(parts[BURST + k], { transform: place(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 0, (0.9 + q * 0.4) * u), opacity: c < 0.7 ? (1 - q).toFixed(3) : 0 })
      }
      if (!lite) {
        const q = clamp01(c / 1)
        set(parts[PLUS], { transform: place(cx, cy - R - q * 26 * u, 0, u), opacity: c < 1 ? (Math.min(1, q * 4) * (1 - q)).toFixed(3) : 0 })
      }
      const lead = newest as { p: Point; age: number } | null
      return lead && lead.age < 1.2 ? lead.p : lead?.p ?? null
    },
  }
}

// ── Orbit (plain avatars) ───────────────────────────────────────────────────────
// An aurora drifting behind the orb, and bokeh motes on two tilted orbits — big and bright
// in front of the orb, small and dim behind it. The eyes follow the biggest mote in front.

const orbit: Builder = ctx => {
  const { cx, cy, R, uid, lite } = ctx
  const u = unitOf(R)
  const motes = Array.from({ length: lite ? 4 : 7 }, (_, i) => {
    const outer = i % 2 === 1
    return {
      rx: R * (outer ? 2.1 : 1.5), ry: R * (outer ? 0.5 : 0.35), tilt: ((outer ? 9 : -14) * Math.PI) / 180,
      speed: outer ? -0.22 : 0.35, phase: (i / 7) * Math.PI * 2 + ctx.rand() * 0.6, size: (2 + ctx.rand() * 3) * u,
    }
  })
  const mote = (key: string) => <circle key={key} r={1} fill={`url(#ob-${uid})`} opacity={0} />
  const back: React.ReactNode[] = [
    <circle key="a1" r={1.4 * R} fill={`url(#oa-${uid})`} />,
    <circle key="a2" r={1.4 * R} fill={`url(#oa-${uid})`} />,
    ...motes.map((_, i) => mote(`b${i}`)),
    <circle key="ring" r={R} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0} />,
  ]
  const front = lite ? [] : motes.map((_, i) => mote(`f${i}`))
  const AUR = 0, BACK = 2, RING = BACK + motes.length, FRONT = RING + 1

  return {
    defs: (
      <>
        <radialGradient id={`ob-${uid}`}>
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset="0.45" stopColor={ctx.colors[0]} stopOpacity={0.8} />
          <stop offset="1" stopColor={ctx.colors[0]} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`oa-${uid}`}>
          <stop offset="0" stopColor={ctx.colors[0]} stopOpacity={0.25} />
          <stop offset="1" stopColor={ctx.colors[0]} stopOpacity={0} />
        </radialGradient>
      </>
    ),
    back,
    front,
    update: (parts, f) => {
      const w = f.now * 0.05 * 6.28
      set(parts[AUR], { transform: `translate(${f2(cx + Math.sin(w) * R * 0.9)},${f2(cy + Math.sin(w * 1.7) * R * 0.3)})` })
      set(parts[AUR + 1], { transform: `translate(${f2(cx - Math.sin(w * 1.3) * R)},${f2(cy + Math.cos(w) * R * 0.35)})` })

      let lead: { p: Point; r: number } | null = null
      motes.forEach((m, i) => {
        const a = m.phase + f.t * m.speed
        const ex = m.rx * Math.cos(a), ey = m.ry * Math.sin(a)
        const x = cx + ex * Math.cos(m.tilt) - ey * Math.sin(m.tilt) - f.par.x * 5
        const y = cy + ex * Math.sin(m.tilt) + ey * Math.cos(m.tilt) - f.par.y * 3
        const inFront = Math.sin(wrap(a, Math.PI * 2)) > 0
        const glow = 1 + f.hover * 0.3
        const r = m.size * (inFront ? 1.2 : 0.7)
        set(parts[BACK + i], { cx: f2(x), cy: f2(y), r: f2(r), opacity: inFront && !lite ? 0 : (0.35 * glow).toFixed(3) })
        if (!lite) set(parts[FRONT + i], { cx: f2(x), cy: f2(y), r: f2(r), opacity: inFront ? Math.min(1, 0.8 * glow * overEyes(f, { x, y })).toFixed(3) : 0 })
        if (inFront && (!lead || r > lead.r)) lead = { p: { x, y }, r }
      })
      const c = f.sinceClick
      set(parts[RING], { cx: f2(cx), cy: f2(cy), r: f2(R + clamp01(c / 0.6) * 36 * u), opacity: c < 0.6 && !lite ? (0.5 * (1 - c / 0.6)).toFixed(3) : 0 })
      const best = lead as { p: Point; r: number } | null
      return best ? best.p : null
    },
  }
}

export const SCENES: Record<SceneKind, Builder> = { weather, guide, scout, marketing, orbit }
