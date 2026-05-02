'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { getSvgPath } from 'figma-squircle'

export function useSquircle(cornerRadius: number, smoothing = 0.6, strokeWidth = 0) {
  const ref = useRef<HTMLButtonElement>(null)
  const [clipPath, setClipPath] = useState('')
  const [strokeClipPath, setStrokeClipPath] = useState('')

  const compute = useCallback(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (!width || !height) return

    const d = getSvgPath({ width, height, cornerRadius, cornerSmoothing: smoothing })
    setClipPath(`path("${d}")`)

    if (strokeWidth > 0) {
      const s = strokeWidth
      const sd = getSvgPath({
        width: width + s * 2,
        height: height + s * 2,
        cornerRadius: cornerRadius + s,
        cornerSmoothing: smoothing,
      })
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
