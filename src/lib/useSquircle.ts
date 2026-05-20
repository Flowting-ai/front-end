'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { getSvgPath } from 'figma-squircle'

// Module-level cache: most buttons share identical dimensions and radius, so
// getSvgPath (which does non-trivial math) is called once per unique shape.
const squirclePathCache = new Map<string, string>()

function getCachedPath(width: number, height: number, cornerRadius: number, smoothing: number): string {
  const key = `${width}x${height}r${cornerRadius}s${smoothing}`
  const cached = squirclePathCache.get(key)
  if (cached) return cached
  const d = getSvgPath({ width, height, cornerRadius, cornerSmoothing: smoothing })
  squirclePathCache.set(key, d)
  return d
}

export function useSquircle(cornerRadius: number, smoothing = 0.6, strokeWidth = 0) {
  const ref = useRef<HTMLButtonElement>(null)
  const [clipPath, setClipPath] = useState('')
  const [strokeClipPath, setStrokeClipPath] = useState('')

  const compute = useCallback(() => {
    const el = ref.current
    if (!el) return
    // Use offsetWidth/offsetHeight (layout box) rather than getBoundingClientRect
    // which includes ancestor transforms and gives wrong sizes when mounted inside
    // animating parents (e.g. PinboardExpanded inside Pinboard's scale animation).
    const width  = el.offsetWidth
    const height = el.offsetHeight
    if (!width || !height) return

    const d = getCachedPath(width, height, cornerRadius, smoothing)
    setClipPath(`path("${d}")`)

    if (strokeWidth > 0) {
      const s = strokeWidth
      const sd = getCachedPath(width + s * 2, height + s * 2, cornerRadius + s, smoothing)
      setStrokeClipPath(`path("${sd}")`)
    }
  }, [cornerRadius, smoothing, strokeWidth])

  useEffect(() => {
    compute()
    const ro = new ResizeObserver(compute)
    if (ref.current) ro.observe(ref.current)
    return () => ro.disconnect()
  }, [compute])

  return { ref, clipPath, strokeClipPath }
}
