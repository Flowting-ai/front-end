'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Switch } from '@/components/Switch'
import { cn } from '@/lib/utils'

// ── Shadow / text-shadow constants ────────────────────────────────────────────

const SHADOW_OUTER = 'var(--shadow-preset-featured-outer)'
const SHADOW_INNER = 'var(--shadow-preset-featured-inner)'

const TEXT_SHADOW =
  '0px -0.5px 0.364px rgba(0,0,0,0.25), 0px 0.5px 0.364px rgba(255,255,255,0.25)'

// Blurred rainbow gradient — persistent selected layer and gradient fill flood
const SELECTED_GRADIENT =
  'linear-gradient(180deg, rgba(221,221,221,0.5) 0%, rgba(143,116,39,0.5) 21.635%, rgba(104,61,27,0.5) 36.058%, rgba(39,13,42,0.5) 63.462%, rgba(11,53,127,0.5) 82.212%, rgba(13,110,178,0.5) 97.115%)'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Ripple {
  key: number
  x: number
  y: number
  r: number
}

export interface ModelFeaturedCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Model name — rendered in the title font */
  title: string
  /** Short description below the title */
  description: React.ReactNode
  /** URL for the "Learn more" inline link — omit to hide the link */
  learnMoreHref?: string
  /** Initial selected state — component manages its own state after mount */
  defaultSelected?: boolean
  /** Callback fired when the selected state changes */
  onSelectedChange?: (selected: boolean) => void
  /**
   * Show the trailing "Pro switch" cluster in the header (label + Switch).
   * Per Figma `1609:2415`, this lives at the right edge of the title row.
   */
  proSwitch?: boolean
  /** Label rendered before the Pro switch. Default "Advanced". */
  advancedLabel?: string
  /** Controlled "advanced" toggle state. Pair with `onAdvancedChange`. */
  advanced?: boolean
  /** Initial uncontrolled state of the advanced toggle. */
  defaultAdvanced?: boolean
  /** Callback fired when the advanced toggle changes. */
  onAdvancedChange?: (next: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ModelFeaturedCard = React.forwardRef<HTMLDivElement, ModelFeaturedCardProps>(
  function ModelFeaturedCard(
    {
      title,
      description,
      learnMoreHref,
      defaultSelected = false,
      onSelectedChange,
      proSwitch        = false,
      advancedLabel    = 'Advanced',
      advanced,
      defaultAdvanced  = false,
      onAdvancedChange,
      className,
      style,
      onClick,
      ...props
    },
    ref,
  ) {
    const [isSelected, setIsSelected] = useState(defaultSelected)
    const [ripples, setRipples]       = useState<Ripple[]>([])
    const selectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const rippleTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    useEffect(() => {
      return () => {
        if (selectTimerRef.current)  clearTimeout(selectTimerRef.current)
        rippleTimersRef.current.forEach(clearTimeout)
        rippleTimersRef.current.clear()
      }
    }, [])

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isSelected) {
        setIsSelected(false)
        onSelectedChange?.(false)
        onClick?.(e)
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // Radius to reach the farthest corner from the click point
      const r = Math.sqrt(
        Math.max(x, rect.width  - x) ** 2 +
        Math.max(y, rect.height - y) ** 2,
      )
      const key = Date.now()
      setRipples(prev => [...prev, { key, x, y, r }])

      const rippleTimer = setTimeout(() => {
        setRipples(prev => prev.filter(rp => rp.key !== key))
        rippleTimersRef.current.delete(rippleTimer)
      }, 1000)
      rippleTimersRef.current.add(rippleTimer)

      // Lock in selected state just before the fill starts fading (~480ms),
      // so the persistent gradient is seamlessly beneath the retreating ripple.
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
      selectTimerRef.current = setTimeout(() => {
        setIsSelected(true)
        onSelectedChange?.(true)
        selectTimerRef.current = null
      }, 480)

      onClick?.(e)
    }

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position:     'relative',
          borderRadius: '12px',
          overflow:     'clip',
          padding:      '12px',
          width:        '100%',
          flexShrink:   0,
          boxShadow:    SHADOW_OUTER,
          cursor:       'pointer',
          ...style,
        }}
        onClick={handleClick}
        {...props}
      >
        {/* ── Base gradient background ── */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            background:    'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
            borderRadius:  'inherit',
            pointerEvents: 'none',
          }}
        />

        {/* ── Persistent selected gradient ── */}
        {isSelected && (
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           '1px',
              borderRadius:    '8.727px',
              filter:          'blur(7.273px)',
              backgroundImage: SELECTED_GRADIENT,
              pointerEvents:   'none',
            }}
          />
        )}

        {/* ── Click effects — clipped by overflow: clip on the container ── */}
        <AnimatePresence>
          {ripples.flatMap(({ key, x, y, r }) => [

            // Layer 1 — Gradient fill flood (behind the warp ring)
            <motion.div
              key={`${key}-fill`}
              aria-hidden
              style={{
                position:        'absolute',
                left:            x - r,
                top:             y - r,
                width:           r * 2,
                height:          r * 2,
                borderRadius:    '50%',
                backgroundImage: SELECTED_GRADIENT,
                filter:          'blur(7.273px)',
                pointerEvents:   'none',
                transformOrigin: 'center',
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
              transition={{ scale: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } }}
            />,

            // Layer 2 — Warp shockwave ring (runs ahead of the fill, creates spatial distortion feel)
            <motion.div
              key={`${key}-warp`}
              aria-hidden
              style={{
                position:        'absolute',
                left:            x - r,
                top:             y - r,
                width:           r * 2,
                height:          r * 2,
                borderRadius:    '50%',
                background:      'transparent',
                // Glowing ring edge — no fill, just the luminous border
                boxShadow:       '0 0 32px 12px rgba(220,195,140,0.6), inset 0 0 24px 8px rgba(220,195,140,0.25)',
                pointerEvents:   'none',
                transformOrigin: 'center',
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.4, 1] }}
            />,

            // Layer 3 — Point burst at the click origin (the initial "tear" through space)
            <motion.div
              key={`${key}-burst`}
              aria-hidden
              style={{
                position:        'absolute',
                left:            x - 56,
                top:             y - 56,
                width:           112,
                height:          112,
                borderRadius:    '50%',
                background:      'radial-gradient(circle, rgba(255,248,215,0.9) 0%, rgba(210,165,75,0.5) 40%, transparent 70%)',
                filter:          'blur(7px)',
                pointerEvents:   'none',
                transformOrigin: 'center',
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.2, 0.65, 0.4, 1] }}
            />,

          ])}
        </AnimatePresence>

        {/* ── Content ── */}
        <div
          style={{
            position:      'relative',
            display:       'flex',
            flexDirection: 'column',
            gap:           '4px',
            textShadow:    TEXT_SHADOW,
          }}
        >
          {/* ── Header row: title + optional Pro switch ── */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '8px',
              width:      '100%',
            }}
          >
            <p
              style={{
                flex:        '1 0 0',
                minWidth:    0,
                fontFamily:  'var(--font-title)',
                fontWeight:  400,
                fontSize:    '24px',
                lineHeight:  '32px',
                color:       'var(--neutral-50)',
                margin:      0,
              }}
            >
              {title}
            </p>

            {proSwitch && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        '4px',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontFamily:    'var(--font-body)',
                    fontWeight:    400,
                    fontSize:      '11px',
                    lineHeight:    '16px',
                    color:         'var(--neutral-200)',
                    whiteSpace:    'nowrap',
                  }}
                >
                  {advancedLabel}
                </span>
                <Switch
                  {...(advanced !== undefined
                    ? { checked: advanced }
                    : { defaultChecked: defaultAdvanced })}
                  onCheckedChange={onAdvancedChange}
                  aria-label={advancedLabel}
                />
              </div>
            )}
          </div>

          <p
            style={{
              fontFamily:  'var(--font-body)',
              fontWeight:  400,
              fontSize:    '11px',
              lineHeight:  '16px',
              color:       'var(--neutral-200)',
              margin:      0,
            }}
          >
            {description}
            {learnMoreHref && (
              <>
                {' '}
                <a href={learnMoreHref} style={{ color: 'inherit', textDecoration: 'underline' }}>
                  Learn more
                </a>
              </>
            )}
          </p>
        </div>

        {/* ── Inner depth shadow — sits above all effect layers ── */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            borderRadius:  'inherit',
            boxShadow:     SHADOW_INNER,
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  },
)

ModelFeaturedCard.displayName = 'ModelFeaturedCard'

export default ModelFeaturedCard
