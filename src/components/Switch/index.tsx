'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { motion, useMotionValue, animate, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { springs } from '@/lib/springs'

// ── Geometry (Figma 2794:27440) ────────────────────────────────────────────────
const TRACK_W = 34
const TRACK_H = 20
const THUMB   = 16
const INSET   = 2
const TRAVEL  = TRACK_W - THUMB - INSET * 2   // 14

// Hover/press deformation (fluidfunctionalism interaction)
const HOVER_EXTEND = 2  // thumb grows into a 18×16 pill on hover
const PRESS_EXTEND = 4  // 20×… on press (wider)
const PRESS_SHRINK = 4  // 20×12 on press (shorter)

const DRAG_DEAD_ZONE = 2

// ── Visuals (Figma 2794:27442 / 2794:27440) ───────────────────────────────────
// Shadows live as semantic tokens in semantic.css under `--shadow-switch-*`.

export interface SwitchProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>, 'asChild'> {
  /** Disable hover pill / press squash / drag (still shows colour transition). */
  disableInteractionAnimation?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(function Switch(
  {
    className,
    style,
    checked,
    defaultChecked,
    onCheckedChange,
    disabled,
    disableInteractionAnimation = false,
    ...props
  },
  forwardedRef,
) {
  // OS-level "Reduce motion" preference. When true: skip the spring tweens,
  // the hover-pill, the press-squash, and drag (we still toggle on click).
  // Always sourced from the user's prefers-reduced-motion media query.
  const reduceMotion = useReducedMotion() ?? false

  // Controlled vs uncontrolled
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = React.useState(!!defaultChecked)
  const isOn = isControlled ? !!checked : internalChecked

  const setChecked = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalChecked(next)
      onCheckedChange?.(next)
    },
    [isControlled, onCheckedChange],
  )

  // Internal pointer state
  const [hovered, setHovered] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)

  const dragging  = React.useRef(false)
  const didDrag   = React.useRef(false)
  const pointerStart = React.useRef<{ clientX: number; originX: number } | null>(null)

  const hasMounted = React.useRef(false)
  React.useEffect(() => { hasMounted.current = true }, [])

  // ── Thumb shape (px) ─────────────────────────────────────────────────────────
  const animateShape = !disableInteractionAnimation && !disabled && !reduceMotion
  const thumbWidth =
    animateShape && pressed ? THUMB + PRESS_EXTEND
    : animateShape && hovered ? THUMB + HOVER_EXTEND
    : THUMB
  const thumbHeight = animateShape && pressed ? THUMB - PRESS_SHRINK : THUMB
  const thumbY      = animateShape && pressed ? INSET + PRESS_SHRINK / 2 : INSET
  const extraWidth  = thumbWidth - THUMB
  // When extending, grow inward — keep the edge anchored to the resting side
  const thumbX = isOn ? INSET + TRAVEL - extraWidth : INSET

  // motion value for x (so pointer drag can drive it without re-rendering)
  const motionX = useMotionValue(thumbX)

  React.useEffect(() => {
    if (dragging.current) return
    if (!hasMounted.current || reduceMotion) {
      motionX.set(thumbX)
    } else {
      animate(motionX, thumbX, springs.moderate)
    }
  }, [thumbX, motionX, reduceMotion])

  // ── Pointer / drag handlers (live on the Root) ───────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || disableInteractionAnimation || reduceMotion) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    setPressed(true)
    dragging.current = false
    didDrag.current = false
    pointerStart.current = { clientX: e.clientX, originX: motionX.get() }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerStart.current) return
    const delta = e.clientX - pointerStart.current.clientX
    if (!dragging.current) {
      if (Math.abs(delta) < DRAG_DEAD_ZONE) return
      dragging.current = true
    }
    const pressedThumbW = THUMB + PRESS_EXTEND
    const dragMin = INSET
    const dragMax = TRACK_W - INSET - pressedThumbW
    const rawX = pointerStart.current.originX + delta
    motionX.set(Math.max(dragMin, Math.min(dragMax, rawX)))
  }

  const onPointerUp = () => {
    if (!pointerStart.current) return
    setPressed(false)
    if (dragging.current) {
      didDrag.current = true
      dragging.current = false
      const pressedThumbW = THUMB + PRESS_EXTEND
      const dragMin = INSET
      const dragMax = TRACK_W - INSET - pressedThumbW
      const midpoint = (dragMin + dragMax) / 2
      const shouldBeOn = motionX.get() > midpoint
      if (shouldBeOn !== isOn) {
        setChecked(shouldBeOn)
      } else if (reduceMotion) {
        motionX.set(isOn ? INSET + TRAVEL : INSET)
      } else {
        animate(motionX, isOn ? INSET + TRAVEL : INSET, springs.moderate)
      }
      requestAnimationFrame(() => { didDrag.current = false })
    }
    pointerStart.current = null
  }

  const onPointerCancel = () => {
    setPressed(false)
    dragging.current = false
    pointerStart.current = null
  }

  return (
    <motion.span
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{ display: 'inline-flex', lineHeight: 0 }}
    >
    <SwitchPrimitive.Root
      ref={forwardedRef}
      checked={isOn}
      onCheckedChange={(next) => {
        // Suppress Radix's own click-toggle when a drag just ended
        if (didDrag.current) return
        setChecked(next)
      }}
      disabled={disabled}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        'kds-switch',
        'relative shrink-0 rounded-full cursor-pointer touch-none select-none',
        'transition-[background-color] duration-150 ease-out',
        'disabled:cursor-not-allowed',
        className,
      )}
      style={{
        width:  TRACK_W,
        height: TRACK_H,
        backgroundColor: isOn ? 'var(--switch-track-bg-on)' : 'var(--switch-track-bg-off)',
        boxShadow: isOn ? 'var(--shadow-switch-track-on)' : 'var(--shadow-switch-track-off)',
        opacity:  disabled ? 0.7 : 1,
        ...style,
      }}
      {...props}
    >
      <SwitchPrimitive.Thumb asChild>
        <motion.span
          aria-hidden="true"
          className="absolute top-0 left-0 block rounded-[9.5px]"
          initial={false}
          style={{
            x: motionX,
            backgroundColor: 'var(--switch-thumb-bg)',
            boxShadow: isOn ? 'var(--shadow-switch-thumb-on)' : 'var(--shadow-switch-thumb-off)',
          }}
          animate={{
            y: thumbY,
            width:  thumbWidth,
            height: thumbHeight,
          }}
          transition={reduceMotion || !hasMounted.current ? { duration: 0 } : springs.moderate}
        />
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
    </motion.span>
  )
})

Switch.displayName = 'Switch'

export { Switch }
