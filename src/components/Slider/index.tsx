'use client'

import React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SliderVariant = 'default' | 'pips' | 'scrubber'

export interface SliderProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>, 'onValueChange' | 'defaultValue' | 'value'> {
  value?:         number[]
  defaultValue?:  number[]
  onValueChange?: (value: number[]) => void
  min?:           number
  max?:           number
  step?:          number
  /** Renders the snapped value above the active thumb. */
  showValue?:     boolean
  /** Optional prefix in front of the rendered value (e.g. "$"). */
  valuePrefix?:   string
  /** Optional formatter for the rendered value (overrides default `toString`). */
  valueFormat?:   (n: number) => string
  /** Optional inline label rendered above the track. */
  label?:         React.ReactNode
  variant?:       SliderVariant
  fluid?:         boolean
  /** CSS color for the filled (active) portion of the track. Defaults to `var(--neutral-700)`. */
  fillColor?:     string
}

// ── Tokens ────────────────────────────────────────────────────────────────────
// Adapted from fluidfunctionalism/slider.json - re-skinned with KDS warm
// neutrals + focus-ring. Track is neutral-100, fill is neutral-700, thumb is
// white with a 1.5px neutral-700 ring + the Secondary Button puck shadow.

const TRACK_HEIGHT      = 6
const SCRUBBER_HEIGHT   = 10
const THUMB_SIZE        = 18
const PIP_SIZE          = 4

// ── Component ─────────────────────────────────────────────────────────────────

export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  SliderProps
>(function Slider(
  {
    className,
    style,
    value,
    defaultValue,
    onValueChange,
    min  = 0,
    max  = 100,
    step = 1,
    showValue   = false,
    valuePrefix = '',
    valueFormat,
    label,
    variant = 'default',
    fluid     = true,
    fillColor = 'var(--neutral-700)',
    disabled,
    ...props
  },
  ref,
) {
  // Track the value internally for tooltip / step-dot rendering.
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState<number[]>(
    () => value ?? defaultValue ?? [min],
  )
  const current = isControlled ? (value as number[]) : internalValue
  const handleChange = (next: number[]) => {
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
  }

  const trackHeight = variant === 'scrubber' ? SCRUBBER_HEIGHT : TRACK_HEIGHT
  const pipCount    = variant === 'pips' ? Math.floor((max - min) / step) + 1 : 0
  const format      = valueFormat ?? ((n: number) => String(n))

  return (
    <div
      className={cn(className)}
      style={{
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        width:         fluid ? '100%' : 240,
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize:   'var(--font-size-body)',
            fontWeight: 'var(--font-weight-regular)',
            color:      'var(--neutral-900)',
          }}
        >
          {label}
        </span>
      )}

      <SliderPrimitive.Root
        ref={ref}
        value={isControlled ? value : undefined}
        defaultValue={isControlled ? undefined : defaultValue}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{
          position:      'relative',
          display:       'flex',
          alignItems:    'center',
          userSelect:    'none',
          touchAction:   'none',
          width:         '100%',
          height:        THUMB_SIZE + 4,
          opacity:       disabled ? 0.5 : 1,
          cursor:        disabled ? 'not-allowed' : 'pointer',
        }}
        {...props}
      >
        <SliderPrimitive.Track
          style={{
            position:        'relative',
            flexGrow:        1,
            height:          trackHeight,
            borderRadius:    999,
            backgroundColor: 'var(--neutral-100)',
            overflow:        'hidden',
          }}
        >
          <SliderPrimitive.Range
            style={{
              position:        'absolute',
              height:          '100%',
              backgroundColor: fillColor,
              borderRadius:    999,
            }}
          />
        </SliderPrimitive.Track>

        {/* Step pips - purely decorative, sit on top of the track */}
        {variant === 'pips' && (
          <div
            aria-hidden
            style={{
              position:       'absolute',
              inset:          0,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              pointerEvents:  'none',
            }}
          >
            {Array.from({ length: pipCount }).map((_, i) => {
              const pipValue = min + i * step
              const active   = current[0] >= pipValue
              return (
                <span
                  key={i}
                  style={{
                    width:           PIP_SIZE,
                    height:          PIP_SIZE,
                    borderRadius:    999,
                    backgroundColor: active ? 'var(--neutral-700)' : 'var(--neutral-300)',
                    transition:      'background-color 120ms ease',
                  }}
                />
              )
            })}
          </div>
        )}

        {current.map((_, i) => (
          <SliderPrimitive.Thumb
            key={i}
            aria-label={props['aria-label'] ?? 'Value'}
            className="kds-slider-thumb"
            style={{
              display:         'block',
              width:           THUMB_SIZE,
              height:          THUMB_SIZE,
              borderRadius:    '50%',
              backgroundColor: 'var(--neutral-white)',
              border:          '1.5px solid var(--neutral-700)',
              boxShadow:       'var(--shadow-button-secondary-outer)',
              cursor:          disabled ? 'not-allowed' : 'grab',
              outline:         'none',
              position:        'relative',
            }}
          >
            {showValue && (
              <span
                aria-hidden
                style={{
                  position:        'absolute',
                  left:            '50%',
                  bottom:          'calc(100% + 6px)',
                  transform:       'translateX(-50%)',
                  padding:         '2px 6px',
                  borderRadius:    6,
                  backgroundColor: 'var(--neutral-900)',
                  color:           'var(--neutral-white)',
                  fontFamily:      'var(--font-body)',
                  fontSize:        'var(--font-size-caption)',
                  fontWeight:      'var(--font-weight-medium)',
                  lineHeight:      1,
                  whiteSpace:      'nowrap',
                  pointerEvents:   'none',
                }}
              >
                {valuePrefix}{format(current[i])}
              </span>
            )}
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
    </div>
  )
})

Slider.displayName = 'Slider'

export default Slider
