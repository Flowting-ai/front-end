'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { motion } from 'framer-motion'
import { TickTwoIcon } from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Geometry (Figma 2870:44159 / 2870:44160) ──────────────────────────────────
const SIZE = 16
const RADIUS = 4

// Delay (ms) before the tick draws after the box flips checked. The fill
// cross-fade plays first, then the stroke draws on top — reads as a confident
// two-beat snap rather than everything happening at once.
const TICK_DRAW_DELAY_MS = 120

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'asChild'> {}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(function Checkbox(
  { className, style, checked, defaultChecked, onCheckedChange, disabled, ...props },
  forwardedRef,
) {
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = React.useState<boolean>(!!defaultChecked)
  const isOn = isControlled ? checked === true : internalChecked

  // Delayed mirror of `isOn` that drives the TickTwoIcon's `triggered` prop.
  // Off → on: wait TICK_DRAW_DELAY_MS, then trigger the draw.
  // On → off: undraw immediately so the tick is gone before the box fades back.
  const [tickOn, setTickOn] = React.useState(isOn)
  React.useEffect(() => {
    if (isOn) {
      const id = window.setTimeout(() => setTickOn(true), TICK_DRAW_DELAY_MS)
      return () => window.clearTimeout(id)
    }
    setTickOn(false)
  }, [isOn])

  return (
    <motion.span
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{ display: 'inline-flex', lineHeight: 0 }}
    >
    <CheckboxPrimitive.Root
      ref={forwardedRef}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(next) => {
        const v = next === true
        if (!isControlled) setInternalChecked(v)
        onCheckedChange?.(next)
      }}
      disabled={disabled}
      className={cn(
        'kds-checkbox',
        'shrink-0 cursor-pointer select-none',
        'transition-[background-color] duration-150 ease-out',
        'disabled:cursor-not-allowed',
        className,
      )}
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: RADIUS,
        // Tick is centered via flex on the Root itself — no absolute overlay.
        // This guarantees the full 16×16 button surface receives clicks; an
        // overlay span can intercept events even with pointer-events: none if
        // a descendant attaches its own listeners.
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isOn ? 'var(--checkbox-bg-on)' : 'var(--checkbox-bg-off)',
        boxShadow: isOn ? 'var(--shadow-checkbox-on)' : 'var(--shadow-checkbox-off)',
        opacity: disabled ? 0.7 : 1,
        ...style,
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator forceMount asChild>
        <span
          aria-hidden="true"
          style={{
            lineHeight: 0,
            pointerEvents: 'none',
            opacity: tickOn ? 1 : 0,
          }}
        >
          <TickTwoIcon
            size={16}
            color="var(--checkbox-tick)"
            triggered={tickOn}
            style={{ pointerEvents: 'none', display: 'block' }}
          />
        </span>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    </motion.span>
  )
})

Checkbox.displayName = 'Checkbox'

export { Checkbox }
