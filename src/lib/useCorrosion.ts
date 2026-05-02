'use client'

import { useEffect, useRef } from 'react'

const STIFFNESS = 752
const DAMPING   = 50.2
const MASS      = 1
const HEAL_RATE = 1 / 0.2

type State = 'idle' | 'spreading' | 'healing'

interface Point { x: number; y: number }

function maxRadius(p: Point, w: number, h: number): number {
  return Math.sqrt(
    Math.max(p.x, w - p.x) ** 2 +
    Math.max(p.y, h - p.y) ** 2
  )
}

export function useCorrosion(circleRef: React.RefObject<SVGCircleElement | null>) {
  const stateRef = useRef<State>('idle')

  const posRef   = useRef(0)
  const velRef   = useRef(0)
  const entryRef = useRef<Point>({ x: 0, y: 0 })
  const maxRRef  = useRef(0)

  const healPRef   = useRef(0)
  const healRRef   = useRef(0)
  const healDirRef = useRef<Point>({ x: 1, y: 0 })

  const rafRef      = useRef<number>(0)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const setCircle = (r: number, cx: number, cy: number) => {
      const el = circleRef.current
      if (!el) return
      el.setAttribute('r',  Math.max(0, r).toFixed(1))
      el.setAttribute('cx', cx.toFixed(1))
      el.setAttribute('cy', cy.toFixed(1))
    }

    const tick = (now: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = now
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = now

      const state = stateRef.current

      if (state === 'spreading') {
        const force = STIFFNESS * (1 - posRef.current) - DAMPING * velRef.current
        velRef.current += (force / MASS) * dt
        posRef.current += velRef.current * dt

        const r = maxRRef.current * Math.max(0, posRef.current)
        setCircle(r, entryRef.current.x, entryRef.current.y)

      } else if (state === 'healing') {
        healPRef.current = Math.min(1, healPRef.current + HEAL_RATE * dt)
        const hp  = healPRef.current
        const dir = healDirRef.current

        const slide = healRRef.current * 2.5 * hp
        const cx = entryRef.current.x + dir.x * slide
        const cy = entryRef.current.y + dir.y * slide

        setCircle(healRRef.current, cx, cy)

        if (hp >= 1) {
          const el = circleRef.current
          if (el) el.setAttribute('visibility', 'hidden')
          stateRef.current = 'idle'
          posRef.current   = 0
          velRef.current   = 0
          healPRef.current = 0
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTimeRef.current = null
    }
  }, [circleRef])

  const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect()
    const entry = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    entryRef.current = entry
    maxRRef.current  = maxRadius(entry, rect.width, rect.height)

    const el = circleRef.current
    if (el) el.removeAttribute('visibility')

    if (stateRef.current === 'healing') {
      const currentR  = healRRef.current * (1 - healPRef.current)
      posRef.current  = currentR / maxRRef.current
      velRef.current  = 0
      healPRef.current = 0
    }

    stateRef.current = 'spreading'
  }

  const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (stateRef.current === 'idle') return

    const rect = e.currentTarget.getBoundingClientRect()
    const ex   = e.clientX - rect.left
    const ey   = e.clientY - rect.top

    const dx  = ex - rect.width  / 2
    const dy  = ey - rect.height / 2
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    healDirRef.current = { x: dx / len, y: dy / len }

    healRRef.current  = maxRRef.current * Math.min(1.05, Math.max(0, posRef.current))
    healPRef.current  = 0
    velRef.current    = 0
    stateRef.current  = 'healing'
  }

  return { onMouseEnter, onMouseLeave }
}
