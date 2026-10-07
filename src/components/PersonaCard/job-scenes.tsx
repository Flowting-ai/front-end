import React from 'react'
import {
  clamp01, easeOutBack, f2, overEyes, place, scatter, set, unitOf, wrap,
  type Builder, type Point,
} from './scenes'

// Banners for the agent templates — one living scene per job, in the same language as the
// themed scenes (./scenes): white scenery tinted by the avatar's colours, built once for the
// banner's size from a seeded source, positioned every frame by `update`, quicker on hover,
// a burst on click, and a point for the avatar's eyes to follow.
//
// The orb sits in the middle of the banner, so each scene lives mostly in the two side
// panels either side of it (about 90px each on the main card).

export type JobSceneKind =
  | 'support' | 'sales' | 'legal' | 'writer' | 'code' | 'onboarding' | 'data'
  | 'hr' | 'exec' | 'education' | 'productivity' | 'tutoring' | 'webqa'

/** Start index of each run of parts, given how many parts each run has. */
function starts(...counts: number[]): number[] {
  const out: number[] = []
  let n = 0
  for (const c of counts) { out.push(n); n += c }
  return out
}

/** Centre x of the left / right side panel. */
const sideX = (W: number, cx: number, R: number, side: -1 | 1) =>
  side < 0 ? Math.max(18, (cx - R) / 2) : Math.min(W - 18, cx + R + (W - cx - R) / 2)

const tint = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, white)`

/** A green tick in a white disc — shared "done" badge. */
const TickBadge = ({ r = 7 }: { r?: number }) => (
  <>
    <circle r={r} fill="#fff" />
    <path d={`M${-r * 0.45} 0l${r * 0.3} ${r * 0.32} ${r * 0.6}-${r * 0.62}`} stroke="#16a34a" strokeWidth={r * 0.26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </>
)

/** A pop-in scale for something `age` seconds old. */
const popIn = (age: number, d = 0.25) => (age < d ? Math.max(0, easeOutBack(age / d)) : 1)

// ── Customer support ────────────────────────────────────────────────────────────
// A headset round the orb; a conversation scrolls up either side — the customer's tinted
// bubbles on the left (typing dots), the agent's white replies on the right. A click
// resolves the ticket: a green tick pops over the orb. The eyes follow the newest message.

const BUBBLE = 'M-15-8h30a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-3l2 6-9-6h-20a5 5 0 0 1-5-5v-6a5 5 0 0 1 5-5z'

const support: Builder = ctx => {
  const { cx, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const n = lite ? 3 : 6
  const period = 4.4
  const bubbles = Array.from({ length: n }, (_, i) => ({ side: (i % 2 === 0 ? -1 : 1) as -1 | 1, phase: (i / n) * period, jitter: ctx.rand() }))
  const hr = R * 1.08

  const back: React.ReactNode[] = [
    <g key="headset" opacity={0.75}>
      <path d={`M${f2(-hr)} 0A${f2(hr)} ${f2(hr)} 0 0 1 ${f2(hr)} 0`} fill="none" stroke="#fff" strokeWidth={4 * u} strokeLinecap="round" />
      <rect x={-hr - 7 * u} y={-4 * u} width={10 * u} height={20 * u} rx={4 * u} fill="#fff" />
      <rect x={hr - 3 * u} y={-4 * u} width={10 * u} height={20 * u} rx={4 * u} fill="#fff" />
    </g>,
    ...bubbles.map((b, i) => b.side < 0 ? (
      <g key={`b${i}`} opacity={0}>
        <g transform="scale(-1,1)"><path d={BUBBLE} style={{ fill: tint(c0, 55) }} /></g>
        {[-6, 0, 6].map(x => <circle key={x} data-dot cx={x} cy={0} r={1.6} fill={c1} />)}
      </g>
    ) : (
      <g key={`b${i}`} opacity={0}>
        <path d={BUBBLE} fill="#fff" />
        <rect x={-11} y={-3.5} width={20} height={1.8} rx={0.9} fill={c1} opacity={0.55} />
        <rect x={-11} y={0.8} width={13} height={1.8} rx={0.9} fill={c1} opacity={0.4} />
      </g>
    )),
    <g key="tick" opacity={0}><TickBadge r={9} /></g>,
  ]
  const [HEAD, BUB, TICK] = starts(1, n, 1)

  return {
    back,
    update: (parts, f) => {
      set(parts[HEAD], { transform: `translate(${f2(cx - f.par.x * 2)},${f2(cy - 0.08 * R + Math.sin(f.now * 1.2) * 1.2)})` })
      let newest: { p: Point; age: number } | null = null
      bubbles.forEach((b, i) => {
        const age = wrap(f.t + b.phase, period)
        const x = sideX(f.W, cx, R, b.side) + (b.jitter - 0.5) * 10 * u - f.par.x * 6
        const y = cy + 0.75 * R - age * ((cy + 0.75 * R + 10) / period) - f.par.y * 4
        const fade = clamp01((period - age) / 1.1) * clamp01(y / 18)
        set(parts[BUB + i], { transform: place(x, y, 0, popIn(age) * 0.95 * u), opacity: fade.toFixed(3) })
        parts[BUB + i]?.querySelectorAll('[data-dot]').forEach((dot, k) => {
          set(dot, { opacity: (0.35 + 0.65 * Math.max(0, Math.sin(f.now * 5 - k * 0.8))).toFixed(3) })
        })
        if (!newest || age < newest.age) newest = { p: { x, y }, age }
      })
      const c = f.sinceClick
      set(parts[TICK], { transform: place(cx, cy - R - 4 * u - clamp01(c / 1) * 10 * u, 0, popIn(c, 0.3) * u), opacity: c < 1.1 && !lite ? Math.min(1, (1.1 - c) * 3).toFixed(3) : 0 })
      const lead = newest as { p: Point; age: number } | null
      return lead?.p ?? null
    },
  }
}

// ── Sales ───────────────────────────────────────────────────────────────────────
// A bar chart climbs across the banner with a trend line and arrow riding the tops, and
// coins rise off the bars. Hover pushes the numbers up; a click is a burst of coins.

const Coin = () => (
  <>
    <circle r={6} fill="#ffd76a" stroke="#e0a400" strokeWidth={1} />
    <text y={2.6} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="#a86f00" fontFamily="var(--font-body, sans-serif)">$</text>
  </>
)

const sales: Builder = ctx => {
  const { W, H, cx, cy, R, lite } = ctx
  const u = unitOf(R)
  const nb = lite ? 4 : 8
  const bars = Array.from({ length: nb }, (_, i) => ({ x: (W * (i + 0.5)) / nb, base: 0.16 + (0.34 * i) / (nb - 1), ph: ctx.rand() * 6 }))
  const nc = lite ? 2 : 6
  const coins = Array.from({ length: nc }, (_, i) => ({ bar: Math.floor(ctx.rand() * nb), phase: (i / nc) * 3 }))
  const burst = lite ? 0 : 8
  const bw = Math.max(6, 11 * u)

  const back: React.ReactNode[] = [
    ...bars.map((_, i) => <rect key={`bar${i}`} width={bw} rx={3 * u} fill="#fff" opacity={0.32} />),
    <polyline key="trend" points="" fill="none" stroke="#fff" strokeWidth={2 * u} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />,
    <path key="arrow" d="M-5-5L5 0-5 5z" fill="#fff" />,
    ...coins.map((_, i) => <g key={`c${i}`} opacity={0}><Coin /></g>),
    ...Array.from({ length: burst }, (_, i) => <g key={`k${i}`} opacity={0}><Coin /></g>),
  ]
  const [BARS, TREND, ARROW, COINS, BURST] = starts(nb, 1, 1, nc, burst)

  return {
    back,
    update: (parts, f) => {
      const tops: Point[] = bars.map((b, i) => {
        const h = H * b.base * (0.85 + 0.15 * Math.sin(f.t * 1.3 + b.ph)) * (1 + f.hover * 0.3)
        const x = b.x - f.par.x * 4
        set(parts[BARS + i], { x: f2(x - bw / 2), y: f2(H - h), height: f2(h) })
        return { x, y: H - h - 6 * u }
      })
      set(parts[TREND], { points: tops.map(p => `${f2(p.x)},${f2(p.y)}`).join(' ') })
      const a = tops[tops.length - 1], b = tops[tops.length - 2] ?? a
      set(parts[ARROW], { transform: place(a.x, a.y, (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI, u) })

      let newest: { p: Point; age: number } | null = null
      coins.forEach((coin, i) => {
        const age = wrap(f.t + coin.phase, 3)
        const from = tops[coin.bar]
        const x = from.x + Math.sin(age * 3 + i) * 3 * u
        const y = from.y - age * 20 * u
        set(parts[COINS + i], { transform: place(x, y, 0, popIn(age) * u), opacity: (clamp01((3 - age) / 0.8) * clamp01(y / 14)).toFixed(3) })
        if (!newest || age < newest.age) newest = { p: { x, y }, age }
      })
      const c = f.sinceClick
      for (let k = 0; k < burst; k++) {
        const ang = (k / burst) * Math.PI * 2 - Math.PI / 2
        const q = clamp01(c / 0.8)
        const d = R + (1 - Math.pow(1 - q, 2)) * 70 * u
        set(parts[BURST + k], { transform: place(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.7, q * 180, u), opacity: c < 0.8 ? (1 - q).toFixed(3) : 0 })
      }
      const lead = newest as { p: Point; age: number } | null
      return lead?.p ?? null
    },
  }
}

// ── Legal ───────────────────────────────────────────────────────────────────────
// The scales of justice stand behind the orb, weighing gently; sealed documents drift down
// the sides. A click is a gavel strike: a ring rings out and the scales settle level.

const legal: Builder = ctx => {
  const { W, H, cx, cy, R, lite, colors: [, c1] } = ctx
  const u = unitOf(R)
  const L = Math.min(1.75 * R, W / 2 - 22)
  const pivotY = cy - 0.95 * R
  const nd = lite ? 2 : 4
  const docs = Array.from({ length: nd }, (_, i) => ({ side: (i % 2 === 0 ? -1 : 1) as -1 | 1, offset: ctx.rand(), jitter: ctx.rand() }))
  const span = H + 40 * u

  const pan = (key: string) => (
    <g key={key} opacity={0.9}>
      <line x1={0} y1={0} x2={-10} y2={24} stroke="#fff" strokeWidth={1} />
      <line x1={0} y1={0} x2={10} y2={24} stroke="#fff" strokeWidth={1} />
      <path d="M-13 24Q0 35 13 24Z" fill="#fff" />
    </g>
  )
  const back: React.ReactNode[] = [
    <rect key="post" x={cx - 2.5 * u} y={pivotY} width={5 * u} height={H - pivotY} fill="#fff" opacity={0.4} />,
    <line key="beam" x1={-L} y1={0} x2={L} y2={0} stroke="#fff" strokeWidth={3 * u} strokeLinecap="round" opacity={0.85} />,
    <circle key="pivot" r={4.5 * u} fill="#fff" />,
    pan('panL'), pan('panR'),
    ...docs.map((_, i) => (
      <g key={`d${i}`}>
        <rect x={-8} y={-10} width={16} height={20} rx={2} fill="#fff" opacity={0.9} />
        {[-6, -3, 0].map((y, j) => <rect key={j} x={-5} y={y} width={j === 2 ? 6 : 10} height={1.3} rx={0.6} fill={c1} opacity={0.45} />)}
        <circle cx={3} cy={5} r={3} fill="#c0392b" />
      </g>
    )),
    <circle key="ring" r={R} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0} />,
  ]
  const [, BEAM, PIVOT, PAN, DOCS, RING] = starts(1, 1, 1, 2, nd, 1)

  return {
    back,
    update: (parts, f) => {
      const c = f.sinceClick
      const settle = c < 1.2 ? clamp01(c / 1.2) : 1
      const tiltDeg = Math.sin(f.t * 0.7) * (5 + f.hover * 5) * settle
      const tilt = (tiltDeg * Math.PI) / 180
      const px = cx - f.par.x * 3
      set(parts[BEAM], { transform: `translate(${f2(px)},${f2(pivotY)}) rotate(${f2(tiltDeg)})` })
      set(parts[PIVOT], { transform: `translate(${f2(px)},${f2(pivotY)})` })
      const ends: Point[] = [-1, 1].map(s => ({ x: px + s * L * Math.cos(tilt), y: pivotY + s * L * Math.sin(tilt) }))
      ends.forEach((e, i) => set(parts[PAN + i], { transform: place(e.x, e.y, 0, u) }))

      docs.forEach((d, i) => {
        const y = wrap(d.offset * span + f.t * 8 * u, span) - 20 * u
        const x = sideX(W, cx, R, d.side) + (d.jitter - 0.5) * 30 * u + Math.sin(f.t * 0.8 + i) * 4 - f.par.x * 6
        set(parts[DOCS + i], { transform: place(x, y, Math.sin(f.t * 0.6 + i) * 10, 0.9 * u), opacity: (0.85 * clamp01(Math.min(y + 10, H + 10 - y) / 24)).toFixed(3) })
      })
      set(parts[RING], { transform: `translate(${f2(cx)},${f2(cy)})`, r: f2(R + clamp01(c / 0.6) * 40 * u), opacity: c < 0.6 && !lite ? (0.6 * (1 - c / 0.6)).toFixed(3) : 0 })
      return ends[0].y > ends[1].y ? { x: ends[0].x, y: ends[0].y + 24 * u } : { x: ends[1].x, y: ends[1].y + 24 * u }
    },
  }
}

// ── Content writer ──────────────────────────────────────────────────────────────
// Two pages either side of the orb fill line by line as a pencil writes across them, while
// letters drift up. A click flips the pages fresh. The eyes follow the pencil.

const writer: Builder = ctx => {
  const { W, cx, cy, R, lite, colors: [, c1] } = ctx
  const u = unitOf(R)
  const pw = 46 * u, ph = 58 * u
  const lines = 6
  const pages = ([-1, 1] as const).map((side, i) => ({ side, x: sideX(W, cx, R, side), offset: i * 0.5 }))
  const glyphs = Array.from({ length: lite ? 2 : 5 }, (_, i) => ({ ch: ['A', 'a', '¶', '“', 'Aa'][i % 5], ...scatter(ctx, 12, 16), ph: ctx.rand() }))
  const lineW = (k: number) => (k === lines - 1 ? 0.55 : 0.82 - (k % 3) * 0.08) * (pw - 12 * u)

  const back: React.ReactNode[] = [
    ...pages.map((_, i) => (
      <g key={`pg${i}`}>
        <rect x={-pw / 2} y={-ph / 2} width={pw} height={ph} rx={4 * u} fill="#fff" opacity={0.92} />
        <rect x={-pw / 2 + 6 * u} y={-ph / 2 + 7 * u} width={pw * 0.45} height={3 * u} rx={1.5 * u} fill={c1} opacity={0.7} />
        {Array.from({ length: lines }, (_, k) => (
          <rect key={k} data-line x={-pw / 2 + 6 * u} y={-ph / 2 + 16 * u + k * 6.5 * u} width={0} height={2 * u} rx={u} fill={c1} opacity={0.4} />
        ))}
      </g>
    )),
    ...glyphs.map((g, i) => <text key={`g${i}`} textAnchor="middle" fontSize={11} fontFamily="Georgia, serif" fontStyle="italic" fill="#fff" opacity={0}>{g.ch}</text>),
    <g key="pencil">
      <path d="M0 0l-3-8 14-14 6 6-14 14z" fill="#ffd76a" />
      <path d="M0 0l-3-8 5 2z" fill="#3b2f2f" />
      <path d="M11-22l6 6 2-2a2 2 0 0 0 0-3l-3-3a2 2 0 0 0-3 0z" fill="#ff8fa3" />
    </g>,
  ]
  const [PAGES, GLYPHS, PENCIL] = starts(2, glyphs.length, 1)

  return {
    back,
    update: (parts, f) => {
      const c = f.sinceClick
      const flip = c < 0.5 && !f.reduceMotion ? Math.abs(Math.cos((c / 0.5) * Math.PI)) : 1
      let pencil: Point | null = null
      pages.forEach((pg, i) => {
        const x = pg.x - f.par.x * 5, y = cy - f.par.y * 3
        set(parts[PAGES + i], { transform: place(x, y, pg.side * 3, u > 0 ? flip : 1, 1) })
        const p = wrap(f.t * 0.16 + pg.offset, 1)
        const writing = p < 0.88
        const prog = clamp01(p / 0.85) * lines
        parts[PAGES + i]?.querySelectorAll('[data-line]').forEach((line, k) => {
          set(line, { width: f2(lineW(k) * clamp01(prog - k)) })
        })
        if (writing && (!pencil || pg.offset === 0)) {
          const k = Math.min(lines - 1, Math.floor(prog))
          pencil = { x: x - pw / 2 + 6 * u + lineW(k) * clamp01(prog - k), y: y - ph / 2 + 16 * u + k * 6.5 * u + u }
        }
      })
      const pen = pencil as Point | null
      set(parts[PENCIL], { transform: pen ? place(pen.x, pen.y + Math.sin(f.now * 18) * 0.6, 0, 0.8 * u) : 'scale(0)' })
      glyphs.forEach((g, i) => {
        const q = wrap(f.now / 5 + g.ph, 1)
        set(parts[GLYPHS + i], { transform: place(g.x - f.par.x * 3, g.y - q * 18 * u, 0, u), opacity: (Math.sin(q * Math.PI) * 0.7).toFixed(3) })
      })
      return pen
    },
  }
}

// ── Code review ─────────────────────────────────────────────────────────────────
// A diff scrolls up both sides of the orb — added lines on green, removed on red — and the
// reviewer ticks lines off as they pass the middle. A click approves the lot.

const code: Builder = ctx => {
  const { W, H, cx, cy, R, lite, colors: [c0] } = ctx
  const u = unitOf(R)
  const rows = lite ? 5 : 9
  const gap = 11 * u
  const colW = Math.min(76 * u, cx - R - 10)
  const sides = [-1, 1] as const
  const kinds = sides.flatMap(() => Array.from({ length: rows }, () => (ctx.rand() < 0.25 ? 'add' : ctx.rand() < 0.3 ? 'del' : 'ctx')))
  const tokens = kinds.map(() => [0.2 + ctx.rand() * 0.25, 0.15 + ctx.rand() * 0.3])
  const span = rows * gap
  const syntax = ['#ffd76a', tint(c0, 40), '#9be7c4']

  const back: React.ReactNode[] = [
    ...kinds.map((kind, i) => (
      <g key={`r${i}`}>
        <rect x={0} y={-4 * u} width={colW} height={8 * u} rx={2 * u} fill={kind === 'add' ? '#22c55e' : kind === 'del' ? '#ef4444' : '#fff'} opacity={kind === 'ctx' ? 0.08 : 0.28} />
        <text x={3 * u} y={2.6 * u} fontSize={7 * u} fontWeight={700} fill="#fff" fontFamily="var(--font-mono, ui-monospace, monospace)" opacity={0.85}>{kind === 'add' ? '+' : kind === 'del' ? '−' : ' '}</text>
        <rect x={11 * u} y={-1.2 * u} width={colW * tokens[i][0]} height={2.4 * u} rx={1.2 * u} fill={syntax[i % 3]} opacity={0.9} />
        <rect x={13 * u + colW * tokens[i][0]} y={-1.2 * u} width={colW * tokens[i][1]} height={2.4 * u} rx={1.2 * u} fill="#fff" opacity={0.7} />
        <g data-check opacity={0} transform={`translate(${f2(colW - 5 * u)},0) scale(${(0.55 * u).toFixed(3)})`}><TickBadge /></g>
      </g>
    )),
    <text key="tag" textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" fontFamily="var(--font-mono, ui-monospace, monospace)" opacity={0.8}>{'</>'}</text>,
    <rect key="flash" width={W} height={H} fill="#22c55e" opacity={0} />,
  ]
  const [ROWS, TAG, FLASH] = starts(kinds.length, 1, 1)

  return {
    back,
    update: (parts, f) => {
      let lead: Point | null = null
      kinds.forEach((kind, i) => {
        const side = sides[Math.floor(i / rows)]
        const k = i % rows
        const y = cy + span / 2 - wrap(k * gap + f.t * 9 * u, span) - f.par.y * 3
        const x0 = side < 0 ? Math.max(6, cx - R - 6 - colW) : Math.min(W - 6 - colW, cx + R + 6)
        const x = x0 - f.par.x * 5
        const fade = clamp01(Math.min(y - (cy - span / 2), cy + span / 2 - y) / (gap * 1.2))
        set(parts[ROWS + i], { transform: `translate(${f2(x)},${f2(y)})`, opacity: fade.toFixed(3) })
        const passed = y < cy && kind !== 'ctx'
        set(parts[ROWS + i]?.querySelector('[data-check]') ?? undefined, { opacity: passed ? 1 : 0 })
        if (kind !== 'ctx' && y > cy - gap && y < cy + gap && !lead) lead = { x: x + (side < 0 ? colW : 0), y }
      })
      set(parts[TAG], { transform: place(cx - f.par.x * 2, cy - R - 2 * u + Math.sin(f.now * 1.5) * 2, 0, u), opacity: 0.8 })
      const c = f.sinceClick
      set(parts[FLASH], { opacity: c < 0.4 && !lite ? (0.18 * (1 - c / 0.4)).toFixed(3) : 0 })
      return lead
    },
  }
}

// ── Onboarding ──────────────────────────────────────────────────────────────────
// A dotted journey winds across the banner past four milestones to a flag; a traveller
// walks it, ticking each milestone off as it arrives. A click sends confetti up at the flag.

const onboarding: Builder = ctx => {
  const { W, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const x0 = 14, x1 = W - 22
  const pathY = (x: number) => cy + 0.5 * R * Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 2.2 + 0.4)
  const marks = [0.12, 0.27, 0.73, 0.88].map(q => x0 + q * (x1 - x0))
  const confetti = lite ? 0 : 10
  const pts = Array.from({ length: 40 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / 39; return `${f2(x)} ${f2(pathY(x))}` })

  const back: React.ReactNode[] = [
    <path key="path" d={`M${pts.join('L')}`} fill="none" stroke="#fff" strokeWidth={2.2 * u} strokeLinecap="round" strokeDasharray={`0.1 ${f2(6 * u)}`} opacity={0.7} />,
    ...marks.map((_, i) => (
      <g key={`m${i}`}>
        <circle r={8} fill="#fff" opacity={0.95} />
        <circle data-fill r={6} fill={c1} opacity={0} />
        <path data-tick d="M-3 0l2 2 4-4" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0} />
        <text data-num y={3} textAnchor="middle" fontSize={8} fontWeight={700} fill={c1} fontFamily="var(--font-body, sans-serif)">{i + 1}</text>
      </g>
    )),
    <g key="flag">
      <line x1={0} y1={0} x2={0} y2={-22} stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M0-22h13l-3 4 3 4H0z" fill="#ff8fa3" />
    </g>,
    <g key="walker"><circle r={5.5} fill="#fff" /><circle r={3} fill={c0} /></g>,
    ...Array.from({ length: confetti }, (_, i) => <rect key={`c${i}`} x={-1.5} y={-3} width={3} height={6} rx={1} fill={['#ffd76a', '#ff8fa3', '#9be7c4', '#a8dcf5'][i % 4]} opacity={0} />),
  ]
  const [PATH, MARKS, FLAG, WALKER, CONF] = starts(1, 4, 1, 1, confetti)

  return {
    back,
    update: (parts, f) => {
      const sx = -f.par.x * 4, sy = -f.par.y * 2
      set(parts[PATH], { transform: `translate(${f2(sx)},${f2(sy)})`, 'stroke-dashoffset': f2(-f.t * 6) })
      const p = wrap(f.t * 0.11, 1.15)
      const wx = x0 + clamp01(p) * (x1 - x0)
      const walker = { x: wx + sx, y: pathY(wx) + sy - 2 * u + Math.abs(Math.sin(f.t * 7)) * -2 * u }
      set(parts[WALKER], { transform: place(walker.x, walker.y, 0, u) })
      marks.forEach((mx, i) => {
        const done = wx >= mx
        const g = parts[MARKS + i]
        const since = done ? (wx - mx) / ((x1 - x0) * 0.11) : 9
        set(g, { transform: place(mx + sx, pathY(mx) + sy, 0, (done ? popIn(since, 0.3) : 1) * u) })
        set(g?.querySelector('[data-fill]') ?? undefined, { opacity: done ? 1 : 0 })
        set(g?.querySelector('[data-tick]') ?? undefined, { opacity: done ? 1 : 0 })
        set(g?.querySelector('[data-num]') ?? undefined, { opacity: done ? 0 : 1 })
      })
      const flag = { x: x1 + sx, y: pathY(x1) + sy }
      set(parts[FLAG], { transform: place(flag.x, flag.y, Math.sin(f.now * 3) * 3, u) })
      const c = f.sinceClick
      for (let k = 0; k < confetti; k++) {
        const q = clamp01(c / 1.2)
        const a = -Math.PI / 2 + ((k / confetti) - 0.5) * 2.2
        const d = q * 60 * u
        set(parts[CONF + k], {
          transform: place(flag.x + Math.cos(a) * d, flag.y - 18 * u + Math.sin(a) * d + q * q * 40 * u, q * 540 + k * 40, u),
          opacity: c < 1.2 ? (1 - q).toFixed(3) : 0,
        })
      }
      return walker
    },
  }
}

// ── Data analyst ────────────────────────────────────────────────────────────────
// A line chart draws itself across a faint grid, points popping as the line reaches them,
// beside a turning pie. A click redraws the chart from the start.

const data: Builder = ctx => {
  const { W, H, cx, cy, R, lite, colors: [c0] } = ctx
  const u = unitOf(R)
  const n = lite ? 6 : 10
  const pts: Point[] = Array.from({ length: n }, (_, i) => {
    const x = 12 + ((W - 24) * i) / (n - 1)
    const trend = 0.78 - (0.5 * i) / (n - 1)
    return { x, y: H * Math.max(0.12, Math.min(0.88, trend + (ctx.rand() - 0.5) * 0.22)) }
  })
  const pie = { x: Math.max(22, (cx - R) / 2), y: Math.max(20, cy - R * 0.55) }

  const back: React.ReactNode[] = [
    ...[0.25, 0.5, 0.75].map((q, i) => <line key={`g${i}`} x1={8} x2={W - 8} y1={H * q} y2={H * q} stroke="#fff" strokeOpacity={0.14} strokeDasharray="3 4" />),
    <path key="area" d="" fill={`url(#da-${ctx.uid})`} />,
    <polyline key="line" points="" fill="none" stroke="#fff" strokeWidth={2.2 * u} strokeLinecap="round" strokeLinejoin="round" />,
    ...pts.map((_, i) => <circle key={`p${i}`} r={3.2 * u} fill="#fff" stroke={c0} strokeWidth={1.4} opacity={0} />),
    <g key="pie">
      <circle r={12 * u} fill="#fff" opacity={0.92} />
      <path data-wedge d={`M0 0L${f2(12 * u)} 0A${f2(12 * u)} ${f2(12 * u)} 0 0 1 ${f2(-6 * u)} ${f2(10.4 * u)}Z`} style={{ fill: tint(c0, 70) }} />
      <path d={`M0 0L${f2(-6 * u)} ${f2(10.4 * u)}A${f2(12 * u)} ${f2(12 * u)} 0 0 1 ${f2(-11.3 * u)} ${f2(4 * u)}Z`} fill="#ffd76a" />
    </g>,
  ]
  const [, AREA, LINE, PTS, PIE] = starts(3, 1, 1, n, 1)

  return {
    defs: (
      <linearGradient id={`da-${ctx.uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity={0.28} />
        <stop offset="1" stopColor="#fff" stopOpacity={0} />
      </linearGradient>
    ),
    back,
    update: (parts, f) => {
      const c = f.sinceClick
      const p = c < 2.5 && !lite ? clamp01(c / 2.5) : clamp01(wrap(f.t * 0.13, 1.25))
      const reach = p * (n - 1)
      const shown: Point[] = []
      const sx = -f.par.x * 4, sy = -f.par.y * 2
      for (let i = 0; i < n; i++) {
        if (i <= reach) shown.push({ x: pts[i].x + sx, y: pts[i].y + sy })
        else {
          const a = pts[i - 1], b = pts[i], q = reach - (i - 1)
          if (q > 0) shown.push({ x: a.x + (b.x - a.x) * q + sx, y: a.y + (b.y - a.y) * q + sy })
          break
        }
      }
      set(parts[LINE], { points: shown.map(q => `${f2(q.x)},${f2(q.y)}`).join(' ') })
      const head = shown[shown.length - 1]
      set(parts[AREA], { d: shown.length > 1 ? `M${f2(shown[0].x)} ${f2(H)}L${shown.map(q => `${f2(q.x)} ${f2(q.y)}`).join('L')}L${f2(head.x)} ${f2(H)}Z` : '' })
      pts.forEach((pt, i) => {
        const since = (reach - i) / ((n - 1) * 0.13)
        set(parts[PTS + i], { transform: place(pt.x + sx, pt.y + sy, 0, i <= reach ? popIn(since, 0.3) : 0), opacity: i <= reach ? 1 : 0 })
      })
      set(parts[PIE], { transform: place(pie.x + sx, pie.y + sy, f.t * 25, 1) })
      return head ?? null
    },
  }
}

// ── HR & recruiting ─────────────────────────────────────────────────────────────
// Candidate cards glide past behind the orb on two lanes; each comes out the other side
// stamped — shortlisted with a star, or a tick. A click shortlists everyone in view.

const hr: Builder = ctx => {
  const { W, cx, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const per = lite ? 2 : 4
  const lanes = [{ y: cy - 0.42 * R, speed: 15, dir: 1 }, { y: cy + 0.48 * R, speed: 11, dir: -1 }]
  const cards = lanes.flatMap((lane, l) => Array.from({ length: per }, (_, i) => ({ lane: l, offset: i / per + ctx.rand() * 0.08, star: ctx.rand() < 0.45 })))
  const cw = 40 * u, ch = 22 * u
  const span = W + cw * 2

  const back: React.ReactNode[] = cards.map((card, i) => (
    <g key={`c${i}`}>
      <rect x={-cw / 2} y={-ch / 2} width={cw} height={ch} rx={5 * u} fill="#fff" opacity={0.95} />
      <circle cx={-cw / 2 + 9 * u} cy={0} r={6 * u} style={{ fill: tint(c0, 60) }} />
      <circle cx={-cw / 2 + 9 * u} cy={-1.6 * u} r={2.2 * u} fill="#fff" />
      <path d={`M${f2(-cw / 2 + 5 * u)} ${f2(4 * u)}a${f2(4 * u)} ${f2(3 * u)} 0 0 1 ${f2(8 * u)} 0`} fill="#fff" />
      <rect x={-cw / 2 + 18 * u} y={-4.5 * u} width={cw * 0.42} height={2.4 * u} rx={1.2 * u} fill={c1} opacity={0.6} />
      <rect x={-cw / 2 + 18 * u} y={1 * u} width={cw * 0.28} height={2.2 * u} rx={1.1 * u} fill={c1} opacity={0.35} />
      <g data-stamp opacity={0} transform={`translate(${f2(cw / 2 - 2 * u)},${f2(-ch / 2 + 2 * u)}) scale(${(0.7 * u).toFixed(3)})`}>
        {card.star
          ? <><circle r={7} fill="#ffd76a" /><path d="M0-4.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4z" fill="#fff" /></>
          : <TickBadge />}
      </g>
    </g>
  ))

  return {
    back,
    update: (parts, f) => {
      const shortlistAll = f.sinceClick < 1.5 && !lite
      let lead: Point | null = null
      cards.forEach((card, i) => {
        const lane = lanes[card.lane]
        const run = wrap(card.offset * span + f.t * lane.speed * u, span) - cw
        const x = (lane.dir > 0 ? run : W - run) - f.par.x * 6
        const y = lane.y + Math.sin(f.t + i) * 1.2 - f.par.y * 3
        set(parts[i], { transform: place(x, y, 0, 1) })
        const pastOrb = lane.dir > 0 ? x > cx + R * 0.6 : x < cx - R * 0.6
        set(parts[i]?.querySelector('[data-stamp]') ?? undefined, { opacity: pastOrb || shortlistAll ? 1 : 0 })
        const approaching = lane.dir > 0 ? x < cx - R * 0.6 : x > cx + R * 0.6
        if (approaching && (!lead || Math.abs(x - cx) < Math.abs(lead.x - cx))) lead = { x, y }
      })
      return lead
    },
  }
}

// ── Executive assistant ─────────────────────────────────────────────────────────
// A calendar on one side books itself up, a clock on the other keeps time, and mail flies
// between them over the orb. A click sends a burst of envelopes.

const Envelope = ({ c1 }: { c1: string }) => (
  <>
    <rect x={-8} y={-5.5} width={16} height={11} rx={1.5} fill="#fff" />
    <path d="M-8-5l8 6 8-6" fill="none" stroke={c1} strokeOpacity={0.55} strokeWidth={1.2} strokeLinejoin="round" />
  </>
)

const exec: Builder = ctx => {
  const { W, cx, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const cal = { x: sideX(W, cx, R, -1), y: cy }
  const clk = { x: sideX(W, cx, R, 1), y: cy }
  const cols = 4, rowsN = 3
  const cw = 50 * u, chh = 46 * u
  const cell = { w: (cw - 10 * u) / cols, h: (chh - 18 * u) / rowsN }
  const order = Array.from({ length: cols * rowsN }, (_, i) => i).sort(() => ctx.rand() - 0.5)
  const mails = lite ? 1 : 3
  const burst = lite ? 0 : 6
  const cr = 17 * u

  const back: React.ReactNode[] = [
    <g key="cal">
      <rect x={-cw / 2} y={-chh / 2} width={cw} height={chh} rx={5 * u} fill="#fff" opacity={0.95} />
      <rect x={-cw / 2} y={-chh / 2} width={cw} height={10 * u} rx={5 * u} fill={c1} opacity={0.75} />
      <rect x={-cw / 2} y={-chh / 2 + 5 * u} width={cw} height={5 * u} fill={c1} opacity={0.75} />
      {Array.from({ length: cols * rowsN }, (_, i) => (
        <rect key={i} data-cell x={-cw / 2 + 5 * u + (i % cols) * cell.w + 1} y={-chh / 2 + 13 * u + Math.floor(i / cols) * cell.h + 1}
          width={cell.w - 2} height={cell.h - 2} rx={1.5} style={{ fill: tint(c0, 65) }} opacity={0.15} />
      ))}
    </g>,
    <g key="clock">
      <circle r={cr} fill="#fff" opacity={0.95} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <line key={i} x1={Math.cos(a) * cr * 0.78} y1={Math.sin(a) * cr * 0.78} x2={Math.cos(a) * cr * 0.9} y2={Math.sin(a) * cr * 0.9} stroke={c1} strokeOpacity={0.4} strokeWidth={1} />
      })}
      <line data-hour x1={0} y1={0} x2={0} y2={-cr * 0.45} stroke={c1} strokeWidth={2} strokeLinecap="round" />
      <line data-min x1={0} y1={0} x2={0} y2={-cr * 0.7} stroke={c1} strokeWidth={1.4} strokeLinecap="round" />
      <circle r={1.8} fill="#ff8fa3" />
    </g>,
    ...Array.from({ length: mails + burst }, (_, i) => <g key={`m${i}`} opacity={0}><Envelope c1={c1} /></g>),
  ]
  const [CAL, CLOCK, MAIL] = starts(1, 1, mails + burst)

  return {
    back,
    update: (parts, f) => {
      const sx = -f.par.x * 5, sy = -f.par.y * 3
      set(parts[CAL], { transform: place(cal.x + sx, cal.y + sy, -3, 1) })
      const booked = Math.floor(wrap(f.t * 0.9, cols * rowsN + 3))
      parts[CAL]?.querySelectorAll('[data-cell]').forEach((el, i) => {
        set(el, { opacity: order.indexOf(i) < booked ? 0.95 : 0.15 })
      })
      const clock = parts[CLOCK]
      set(clock, { transform: place(clk.x + sx, clk.y + sy, 0, 1) })
      set(clock?.querySelector('[data-min]') ?? undefined, { transform: `rotate(${f2(f.t * 60)})` })
      set(clock?.querySelector('[data-hour]') ?? undefined, { transform: `rotate(${f2(f.t * 5)})` })

      let lead: Point | null = null
      for (let i = 0; i < mails; i++) {
        const q = wrap(f.t * 0.3 + i / mails, 1)
        const from = { x: cal.x + sx + cw / 2, y: cal.y + sy - 6 * u }, to = { x: clk.x + sx - cr, y: clk.y + sy - 6 * u }
        const x = from.x + (to.x - from.x) * q
        // Arcs over the orb but peaks inside the banner, so the envelope is never clipped.
        const y = from.y + (to.y - from.y) * q - Math.sin(q * Math.PI) * Math.max(0, from.y - 14 * u)
        set(parts[MAIL + i], { transform: place(x, y, (q - 0.5) * 40, u), opacity: (Math.min(1, q * 6, (1 - q) * 6)).toFixed(3) })
        if (q > 0.05 && q < 0.95 && (!lead || y < lead.y)) lead = { x, y }
      }
      const c = f.sinceClick
      for (let k = 0; k < burst; k++) {
        const a = -Math.PI * (0.15 + (0.7 * k) / Math.max(1, burst - 1))
        const q = clamp01(c / 0.9)
        const d = R + q * 60 * u
        set(parts[MAIL + mails + k], { transform: place(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, (a * 180) / Math.PI + 90, u), opacity: c < 0.9 ? (1 - q).toFixed(3) : 0 })
      }
      return lead
    },
  }
}

// ── Education ───────────────────────────────────────────────────────────────────
// Graduation caps are tossed up the sides and tumble back down past a stack of books, while
// letters and numbers float by. A click throws every cap at once.

const Cap = ({ c1 }: { c1: string }) => (
  <>
    <path d="M-11-1l11-5 11 5-11 5z" fill="#2b2b2b" />
    <path d="M-6 1.5v4c0 2 12 2 12 0v-4l-6 2.7z" fill="#3a3a3a" />
    <path d="M0-1l7 2v6" stroke="#ffd76a" strokeWidth={1} fill="none" />
    <circle cx={7} cy={7} r={1.3} fill="#ffd76a" />
    <circle cx={0} cy={-1} r={0.9} fill={c1} />
  </>
)

const education: Builder = ctx => {
  const { W, H, cx, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const n = lite ? 2 : 5
  const caps = Array.from({ length: n }, (_, i) => {
    const side = (i % 2 === 0 ? -1 : 1) as -1 | 1
    return { side, x0: sideX(W, cx, R, side) + (ctx.rand() - 0.5) * 30 * u, drift: (ctx.rand() - 0.5) * 18 * u, phase: (i / n) * 3.2, spin: (ctx.rand() < 0.5 ? -1 : 1) * (180 + ctx.rand() * 200) }
  })
  const letters = Array.from({ length: lite ? 2 : 6 }, (_, i) => ({ ch: ['A', 'B', 'C', '1', '2', '3'][i], ...scatter(ctx, 10, 14), ph: ctx.rand() }))
  const books = { x: sideX(W, cx, R, -1), y: H - 10 * u }
  const bookColors = [tint(c0, 70), '#ffd76a', '#ff8fa3']

  const back: React.ReactNode[] = [
    <g key="books">
      {bookColors.map((col, i) => (
        <g key={i} transform={`translate(${f2((i - 1) * 2 * u)},${f2(-i * 7 * u)})`}>
          <rect x={-16 * u} y={-6 * u} width={32 * u} height={6.5 * u} rx={1.5 * u} style={{ fill: col }} />
          <rect x={-13 * u} y={-4.3 * u} width={20 * u} height={1.2 * u} fill="#fff" opacity={0.6} />
        </g>
      ))}
    </g>,
    ...letters.map((l, i) => <text key={`l${i}`} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff" fontFamily="var(--font-title, sans-serif)" opacity={0}>{l.ch}</text>),
    ...caps.map((_, i) => <g key={`c${i}`}><Cap c1={c1} /></g>),
  ]
  const [BOOKS, LETTERS, CAPS] = starts(1, letters.length, n)

  return {
    back,
    update: (parts, f) => {
      set(parts[BOOKS], { transform: place(books.x - f.par.x * 4, books.y - f.par.y * 2, 0, 1) })
      letters.forEach((l, i) => {
        const q = wrap(f.now / 6 + l.ph, 1)
        set(parts[LETTERS + i], { transform: place(l.x - f.par.x * 3, l.y - q * 16 * u, Math.sin(q * 6) * 8, u), opacity: (Math.sin(q * Math.PI) * 0.55).toFixed(3) })
      })
      const c = f.sinceClick
      const together = c < 1.6 && !lite
      let lead: Point | null = null
      caps.forEach((cap, i) => {
        const T = 3.2
        const age = together ? (c / 1.6) * T : wrap(f.t + cap.phase, T)
        const q = age / T
        const y = H + 8 * u - Math.sin(q * Math.PI) * (H + 4 * u) - f.par.y * 3
        const x = cap.x0 + cap.drift * q - f.par.x * 5
        set(parts[CAPS + i], { transform: place(x, y, q * cap.spin, 1.05 * u), opacity: (clamp01((H + 6 - y) / 14)).toFixed(3) })
        if (!lead || y < lead.y) lead = { x, y }
      })
      return lead
    },
  }
}

// ── Productivity ────────────────────────────────────────────────────────────────
// A to-do column on the left, done on the right: cards hop over the orb from one to the
// other and land ticked, while a focus timer fills round the orb. A click clears the board.

const productivity: Builder = ctx => {
  const { W, cx, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const colW = 40 * u, colH = 66 * u
  const left = { x: sideX(W, cx, R, -1), y: cy }, right = { x: sideX(W, cx, R, 1), y: cy }
  const slots = 4
  const cardH = 10 * u
  const slotY = (k: number) => -colH / 2 + 13 * u + k * (cardH + 3.5 * u) + cardH / 2
  const ringR = R + 7 * u
  const circ = 2 * Math.PI * ringR

  const card = (key: string, ticked: boolean) => (
    <g key={key}>
      <rect x={-colW / 2 + 4 * u} y={-cardH / 2} width={colW - 8 * u} height={cardH} rx={2.5 * u} fill="#fff" />
      <rect x={-colW / 2 + 8 * u} y={-1 * u} width={(colW - 8 * u) * 0.5} height={2 * u} rx={u} fill={c1} opacity={0.5} />
      {ticked && <g transform={`translate(${f2(colW / 2 - 10 * u)},0) scale(${(0.5 * u).toFixed(3)})`}><TickBadge /></g>}
    </g>
  )
  const column = (key: string, label: string) => (
    <g key={key}>
      <rect x={-colW / 2} y={-colH / 2} width={colW} height={colH} rx={6 * u} fill="#fff" opacity={0.18} />
      <text x={-colW / 2 + 5 * u} y={-colH / 2 + 8 * u} fontSize={6 * u} fontWeight={700} fill="#fff" opacity={0.85} fontFamily="var(--font-body, sans-serif)">{label}</text>
    </g>
  )
  const back: React.ReactNode[] = [
    <circle key="track" cx={cx} cy={cy} r={ringR} fill="none" stroke="#fff" strokeOpacity={0.15} strokeWidth={3 * u} />,
    <circle key="timer" cx={cx} cy={cy} r={ringR} fill="none" style={{ stroke: tint(c0, 50) }} strokeWidth={3 * u} strokeLinecap="round" strokeDasharray={`0 ${f2(circ)}`} transform={`rotate(-90 ${f2(cx)} ${f2(cy)})`} />,
    column('todo', 'TO DO'), column('done', 'DONE'),
    ...Array.from({ length: slots }, (_, k) => card(`t${k}`, false)),
    ...Array.from({ length: slots }, (_, k) => card(`d${k}`, true)),
    card('moving', false),
  ]
  const [, TIMER, COLS, TODO, DONE, MOVING] = starts(1, 1, 2, slots, slots, 1)

  return {
    back,
    update: (parts, f) => {
      const sx = -f.par.x * 5, sy = -f.par.y * 3
      set(parts[TIMER], { 'stroke-dasharray': `${f2(circ * wrap(f.t * 0.06, 1))} ${f2(circ)}` })
      set(parts[COLS], { transform: place(left.x + sx, left.y + sy, 0, 1) })
      set(parts[COLS + 1], { transform: place(right.x + sx, right.y + sy, 0, 1) })
      const T = 2.6
      const cycle = Math.floor(f.t / T)
      const age = wrap(f.t, T) / T
      const cleared = f.sinceClick < 1 && !lite
      const done = cleared ? 0 : cycle % (slots + 1)
      const todo = slots - done
      for (let k = 0; k < slots; k++) {
        // The top to-do card is the one in flight, so it leaves the column while it moves.
        const showTodo = k < todo - (done < slots ? 1 : 0) || (k === todo - 1 && age < 0.15)
        set(parts[TODO + k], { transform: place(left.x + sx, left.y + sy + slotY(slots - 1 - k), 0, 1), opacity: showTodo ? 1 : 0 })
        set(parts[DONE + k], { transform: place(right.x + sx, right.y + sy + slotY(slots - 1 - k), 0, 1), opacity: k < done ? 1 : 0 })
      }
      let lead: Point | null = null
      if (done < slots && !cleared) {
        const q = clamp01((age - 0.15) / 0.7)
        const from = { x: left.x + sx, y: left.y + sy + slotY(slots - todo) }
        const to = { x: right.x + sx, y: right.y + sy + slotY(slots - 1 - done) }
        const x = from.x + (to.x - from.x) * q
        const y = from.y + (to.y - from.y) * q - Math.sin(q * Math.PI) * Math.max(0, (from.y + to.y) / 2 - (cy - R - 14 * u))
        set(parts[MOVING], { transform: place(x, y, Math.sin(q * Math.PI) * 8, 1), opacity: age < 0.9 ? 1 : 0 })
        lead = { x, y }
      } else set(parts[MOVING], { opacity: 0 })
      return lead
    },
  }
}

// ── Tutoring ────────────────────────────────────────────────────────────────────
// Maths symbols drift up a chalkboard-dark banner while a question mark beside the orb turns
// into a lit bulb now and then — the penny dropping. Hover or a click lights it straight away.

const tutoring: Builder = ctx => {
  const { W, H, cx, cy, R, lite } = ctx
  const u = unitOf(R)
  const symbols = Array.from({ length: lite ? 4 : 10 }, (_, i) => ({ ch: ['+', '−', '×', '÷', '=', 'π', '√', 'x²', '∑', '%'][i % 10], ...scatter(ctx, 8, 12), ph: ctx.rand(), spin: (ctx.rand() - 0.5) * 30 }))
  const bulb = { x: Math.min(W - 20, cx + R + 22 * u), y: cy - R * 0.45 }

  const back: React.ReactNode[] = [
    <rect key="board" width={W} height={H} fill="#1f3b2d" opacity={0.18} />,
    ...symbols.map((s, i) => <text key={`s${i}`} textAnchor="middle" fontSize={14} fontWeight={600} fill="#fff" fontFamily="var(--font-title, sans-serif)" opacity={0}>{s.ch}</text>),
    <g key="bulb">
      <circle data-glow r={20} fill={`url(#tb-${ctx.uid})`} opacity={0} />
      <path d="M0-12a8 8 0 0 0-5 14c1.5 1.3 2 2.5 2 4h6c0-1.5.5-2.7 2-4a8 8 0 0 0-5-14z" fill="#fff" data-glass />
      <rect x={-3} y={6.5} width={6} height={3.5} rx={1} fill="#c9c9c9" />
      <text data-q y={1.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1f3b2d" fontFamily="var(--font-body, sans-serif)">?</text>
    </g>,
  ]
  const [, SYM, BULB] = starts(1, symbols.length, 1)

  return {
    defs: (
      <radialGradient id={`tb-${ctx.uid}`}>
        <stop offset="0" stopColor="#ffe680" stopOpacity={0.9} />
        <stop offset="1" stopColor="#ffe680" stopOpacity={0} />
      </radialGradient>
    ),
    back,
    update: (parts, f) => {
      symbols.forEach((s, i) => {
        const q = wrap(f.t / 7 + s.ph, 1)
        set(parts[SYM + i], { transform: place(s.x - f.par.x * 4, s.y + 10 * u - q * 24 * u, s.spin * Math.sin(q * 3), u), opacity: (Math.sin(q * Math.PI) * 0.6).toFixed(3) })
      })
      const cyclePos = wrap(f.t, 4)
      const lit = cyclePos > 2.6 || f.hover > 0.5 || f.sinceClick < 1.5
      const g = parts[BULB]
      const bx = bulb.x - f.par.x * 3, by = bulb.y - f.par.y * 2 + Math.sin(f.now * 1.6) * 1.5
      set(g, { transform: place(bx, by, lit ? 0 : Math.sin(f.now * 2) * 6, (lit ? 1.1 : 1) * u) })
      set(g?.querySelector('[data-glow]') ?? undefined, { opacity: lit ? (0.75 + 0.25 * Math.sin(f.now * 6)).toFixed(3) : 0 })
      set(g?.querySelector('[data-glass]') ?? undefined, { fill: lit ? '#ffe680' : '#fff' })
      set(g?.querySelector('[data-q]') ?? undefined, { opacity: lit ? 0 : 1 })
      if (lit) return { x: bx, y: by }
      const near = symbols.map(s => ({ x: s.x, y: s.y })).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0]
      return near ? overEyes(f, near) > 0.5 ? near : null : null
    },
  }
}

// ── Web QA ──────────────────────────────────────────────────────────────────────
// Two browser windows either side of the orb are swept by a scan line, and bugs crawl along
// the bottom until they're caught — circled, crossed out and gone. A click squashes them all.

const webqa: Builder = ctx => {
  const { W, H, cx, cy, R, lite, colors: [c0, c1] } = ctx
  const u = unitOf(R)
  const ww = 54 * u, wh = 44 * u
  const wins = ([-1, 1] as const).map(side => ({ side, x: sideX(W, cx, R, side), y: cy - 8 * u }))
  const nb = lite ? 1 : 3
  const bugs = Array.from({ length: nb }, (_, i) => ({ offset: i / nb, y: H - (8 + ctx.rand() * 10) * u, dir: (i % 2 === 0 ? 1 : -1) as 1 | -1 }))
  const T = 4.5

  const win = (key: string) => (
    <g key={key}>
      <rect x={-ww / 2} y={-wh / 2} width={ww} height={wh} rx={4 * u} fill="#fff" opacity={0.95} />
      <rect x={-ww / 2} y={-wh / 2} width={ww} height={8 * u} rx={4 * u} style={{ fill: tint(c0, 55) }} />
      <rect x={-ww / 2} y={-wh / 2 + 4 * u} width={ww} height={4 * u} style={{ fill: tint(c0, 55) }} />
      {['#ff6b6b', '#ffd76a', '#4ade80'].map((col, i) => <circle key={i} cx={-ww / 2 + (5 + i * 4.5) * u} cy={-wh / 2 + 4 * u} r={1.5 * u} fill={col} />)}
      <rect x={-ww / 2 + 5 * u} y={-wh / 2 + 13 * u} width={ww * 0.5} height={3 * u} rx={1.5 * u} fill={c1} opacity={0.55} />
      <rect x={-ww / 2 + 5 * u} y={-wh / 2 + 20 * u} width={ww - 10 * u} height={10 * u} rx={2 * u} fill={c1} opacity={0.12} />
      <rect x={-ww / 2 + 5 * u} y={-wh / 2 + 33 * u} width={ww * 0.35} height={5 * u} rx={2.5 * u} style={{ fill: tint(c0, 40) }} />
      <rect data-scan x={-ww / 2} y={0} width={ww} height={2 * u} fill="#22c55e" opacity={0.6} />
    </g>
  )
  const bug = (key: string) => (
    <g key={key}>
      <g data-body>
        {[-3, 0, 3].map(y => <path key={y} d={`M-6 ${y}h12`} stroke="#3b2f2f" strokeWidth={1} strokeLinecap="round" />)}
        <ellipse rx={4.5} ry={5.5} fill="#ef4444" />
        <path d="M0-5.5v11" stroke="#7f1d1d" strokeWidth={0.8} />
        <circle cy={-6.5} r={2.6} fill="#3b2f2f" />
      </g>
      <circle data-ring r={10} fill="none" stroke="#22c55e" strokeWidth={1.6} opacity={0} />
      <path data-x d="M-5-5l10 10M5-5L-5 5" stroke="#22c55e" strokeWidth={2} strokeLinecap="round" opacity={0} />
    </g>
  )
  const back: React.ReactNode[] = [...wins.map((_, i) => win(`w${i}`)), ...bugs.map((_, i) => bug(`b${i}`))]
  const [WINS, BUGS] = starts(2, nb)

  return {
    back,
    update: (parts, f) => {
      const sx = -f.par.x * 5, sy = -f.par.y * 3
      wins.forEach((w, i) => {
        set(parts[WINS + i], { transform: place(w.x + sx, w.y + sy, w.side * 2, 1) })
        const q = wrap(f.t * 0.45 + i * 0.5, 1)
        set(parts[WINS + i]?.querySelector('[data-scan]') ?? undefined, { y: f2(-wh / 2 + 8 * u + q * (wh - 10 * u)), opacity: (0.6 * Math.sin(q * Math.PI)).toFixed(3) })
      })
      const squashAll = f.sinceClick < 1 && !lite
      let lead: Point | null = null
      bugs.forEach((b, i) => {
        const age = wrap(f.t + b.offset * T, T)
        const crawl = Math.min(age, 3.2) / 3.2
        // Stays 22u in from the sides, so the catch ring (r 14) never runs off the banner.
        const run = (W - 44 * u) * crawl + 22 * u
        const x = (b.dir > 0 ? run : W - run) + sx
        const y = b.y + Math.sin(f.t * 9 + i) * 0.8 + sy
        const caught = squashAll || age > 3.2
        const k = squashAll ? clamp01(f.sinceClick / 1) : clamp01((age - 3.2) / (T - 3.2))
        const g = parts[BUGS + i]
        set(g, { transform: place(x, y, b.dir > 0 ? 90 : -90, u), opacity: caught ? (1 - clamp01((k - 0.6) / 0.4)).toFixed(3) : clamp01(age / 0.3).toFixed(3) })
        set(g?.querySelector('[data-body]') ?? undefined, { transform: caught ? '' : `rotate(${f2(Math.sin(f.t * 14 + i) * 6)})` })
        set(g?.querySelector('[data-ring]') ?? undefined, { opacity: caught ? 1 : 0, r: f2(caught ? 14 - k * 4 : 14) })
        set(g?.querySelector('[data-x]') ?? undefined, { opacity: caught && k > 0.25 ? 1 : 0 })
        if (!caught && (!lead || Math.abs(x - cx) < Math.abs(lead.x - cx))) lead = { x, y }
      })
      return lead
    },
  }
}

export const JOB_SCENES: Record<JobSceneKind, Builder> = {
  support, sales, legal, writer, code, onboarding, data, hr, exec, education, productivity, tutoring, webqa,
}
