'use client'

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { AvatarTheme } from './AnimatedPersonaAvatar'
import type { GazeChannel } from './gaze'
import { SCENES, type SceneKind } from './scenes'

// The living banner around an agent's avatar — the "Vegas Sphere": the avatar's theme spills
// out of the orb into the space around it (clouds drifting past a weather agent, a plane
// looping a travel guide, reactions rising round a marketer). Each scene (./scenes) builds
// its elements once for the banner's size and positions them every frame from one rAF loop,
// imperatively — never through React state.
//
// Layers inside the hero: scenery behind the orb (z 0), the orb (z 2, rendered by the card),
// scenery in front of it (z 3). It also tells the avatar's eyes where to look (the scene's
// lead element), and writes the eased pointer offset to the hero as --px/--py for the orb's
// sheen.

export function sceneFor(theme: AvatarTheme | null): SceneKind {
  return theme ?? 'orbit'
}

export interface HeroSceneProps {
  kind:       SceneKind
  /** The avatar's [highlight, shadow] colours, for tinting. */
  colors:     [string, string]
  seed:       string
  /** The orb's rendered size (px); the scene keeps clear of it and scales with it. */
  avatarSize: number
  hovered:    boolean
  /** Increment to play the scene's click burst. */
  bounceKey?: number
  /** Paused / unavailable agents: the scene holds still. */
  inert?:     boolean
  /** Where the scene reports its lead element; its pointer drives parallax. */
  gaze?:      GazeChannel
  /** Speed multiplier (drafts drift slower). */
  pace?:      number
  /** CSS filter over the scenery (e.g. desaturated while paused). */
  filter?:    string
  opacity?:   number
  /** Small heroes: fewer elements, no front layer, no bursts. */
  lite?:      boolean
}

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Small, fast, seeded PRNG — the same agent always gets the same scene layout. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Scenery fades out at the side edges (no hard cut-offs) and under the ⋮ menu's corner.
const EDGE_MASK = 'linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent)'
const MENU_MASK = 'radial-gradient(circle at calc(100% - 26px) 26px, transparent 20px, #000 46px)'
const layerStyle = (z: number, filter?: string, opacity = 1): React.CSSProperties => ({
  position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit', zIndex: z,
  maskImage: `${EDGE_MASK}, ${MENU_MASK}`, WebkitMaskImage: `${EDGE_MASK}, ${MENU_MASK}`,
  maskComposite: 'intersect', WebkitMaskComposite: 'source-in',
  filter, opacity, transition: 'opacity 0.3s ease, filter 0.3s ease',
})

export function HeroScene({
  kind, colors, seed, avatarSize, hovered, bounceKey = 0, inert = false, gaze,
  pace = 1, filter, opacity = 1, lite = false,
}: HeroSceneProps) {
  const reduceMotion = useReducedMotion() ?? false
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const rootRef   = useRef<HTMLDivElement>(null)
  const backRef   = useRef<SVGGElement>(null)
  const frontRef  = useRef<SVGGElement>(null)
  const shadowRef = useRef<SVGEllipseElement>(null)
  const [box, setBox] = useState<{ W: number; H: number } | null>(null)

  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setBox(prev => (prev && prev.W === el.clientWidth && prev.H === el.clientHeight ? prev : { W: el.clientWidth, H: el.clientHeight }))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [c0, c1] = colors
  const built = useMemo(() => {
    if (!box || box.W === 0) return null
    const { W, H } = box
    return SCENES[kind]({ W, H, cx: W / 2, cy: H / 2, R: avatarSize / 2, colors: [c0, c1], rand: mulberry32(hashSeed(seed)), uid, lite })
  }, [box, kind, c0, c1, seed, avatarSize, uid, lite])

  const st = useRef({ hover: false, inert: false, pace: 1, hv: 0, ct: -9, lastBurst: -9, t: (hashSeed(seed) % 1000) / 37, px: 0, py: 0 })
  useEffect(() => { st.current.hover = hovered && !inert; st.current.inert = inert; st.current.pace = pace }, [hovered, inert, pace])
  useEffect(() => {
    if (bounceKey === 0 || inert) return
    const now = performance.now() / 1000
    // At most one burst per 1.2s — lightning flashes stay well under the photosensitivity limit.
    if (now - st.current.lastBurst < 1.2) return
    st.current.ct = now
    st.current.lastBurst = now
  }, [bounceKey, inert])

  useEffect(() => {
    if (!built || !box) return
    const parts = [
      ...Array.from(backRef.current?.children ?? []),
      ...Array.from(frontRef.current?.children ?? []),
    ] as SVGElement[]
    const s = st.current
    const { W, H } = box
    const S = avatarSize
    const R = S / 2
    const hero = rootRef.current?.parentElement ?? null
    let raf = 0
    let last = performance.now() / 1000
    let visible = true
    let skip = false

    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting) }, { rootMargin: '100px' })
    if (rootRef.current) observer.observe(rootRef.current)

    const draw = (now: number, dt: number) => {
      const ease = (rate: number) => (dt > 0 ? 1 - Math.exp(-dt * rate) : 1)
      s.hv += ((s.hover ? 1 : 0) - s.hv) * ease(4)
      const sinceClick = now - s.ct
      const burst = sinceClick < 1 ? 1 - sinceClick : 0
      // The scene clock: frozen while paused, quicker on hover, surging after a click.
      if (!s.inert) s.t += dt * s.pace * (1 + s.hv * 1.5 + burst * 2)

      // Parallax: where the pointer is over the banner, −1…1 each way, eased.
      let tx = 0, ty = 0
      const pointer = gaze?.pointer
      if (pointer && rootRef.current && !reduceMotion) {
        const r = rootRef.current.getBoundingClientRect()
        tx = clamp((pointer.x - (r.left + r.width / 2)) / (r.width / 2), -1, 1)
        ty = clamp((pointer.y - (r.top + r.height / 2)) / (r.height / 2), -1, 1)
      }
      s.px += (tx - s.px) * ease(5)
      s.py += (ty - s.py) * ease(5)
      hero?.style.setProperty('--px', s.px.toFixed(3))
      hero?.style.setProperty('--py', s.py.toFixed(3))

      // The orb's contact shadow, a touch smaller while the avatar hops.
      const hop = sinceClick < 0.75 ? Math.sin(Math.PI * Math.min(sinceClick / 0.6, 1)) : 0
      shadowRef.current?.setAttribute('transform', `translate(${(W / 2).toFixed(1)},${(H / 2 + R + 5).toFixed(1)}) scale(${(1 - hop * 0.2).toFixed(3)})`)
      shadowRef.current?.setAttribute('opacity', (1 - hop * 0.4).toFixed(3))

      const focus = built.update(parts, {
        t: s.t, now, dt, W, H, cx: W / 2, cy: H / 2, R,
        hover: s.hv, sinceClick, par: { x: s.px, y: s.py }, reduceMotion,
      })

      // Hand the eyes the focus, in the avatar's 64-unit box (the orb is centred).
      gaze?.setAmbient(focus
        ? { x: (focus.x - (W / 2 - R)) * 32 / R, y: (focus.y - (H / 2 - R)) * 32 / R }
        : null)
    }

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now() / 1000
      if (!visible || document.hidden) { last = now; return }
      // At rest every other frame is plenty for drifting scenery; hover and bursts run full.
      skip = !skip
      if (skip && !s.hover && now - s.ct > 1) return
      draw(now, Math.min(now - last, 0.1))
      last = now
    }

    draw(last, 0)
    if (!reduceMotion) raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [built, box, avatarSize, gaze, reduceMotion])

  const R = avatarSize / 2
  return (
    <>
      <div ref={rootRef} aria-hidden style={layerStyle(0, filter, opacity)}>
        {box && built && (
          <svg width={box.W} height={box.H} viewBox={`0 0 ${box.W} ${box.H}`} style={{ display: 'block' }}>
            <defs>
              <radialGradient id={`cs-${uid}`}>
                <stop offset="0" stopColor="#000" stopOpacity={0.45} />
                <stop offset="1" stopColor="#000" stopOpacity={0} />
              </radialGradient>
              {built.defs}
            </defs>
            <g ref={backRef}>{built.back}</g>
            <ellipse ref={shadowRef} rx={R * 0.64} ry={R * 0.09} fill={`url(#cs-${uid})`} />
          </svg>
        )}
      </div>
      {box && built?.front && built.front.length > 0 && (
        <div aria-hidden style={layerStyle(3, filter, opacity)}>
          <svg width={box.W} height={box.H} viewBox={`0 0 ${box.W} ${box.H}`} style={{ display: 'block' }}>
            <g ref={frontRef}>{built.front}</g>
          </svg>
        </div>
      )}
    </>
  )
}
