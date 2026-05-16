'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// ── Shadow / text-shadow constants ────────────────────────────────────────────

const SHADOW_DEFAULT_OUTER  = 'var(--shadow-model-featured-default-outer)'
const SHADOW_DEFAULT_INNER  = 'var(--shadow-model-featured-default-inner)'
const SHADOW_HOVER_OUTER    = 'var(--shadow-model-featured-hover-outer)'
const SHADOW_HOVER_INNER    = 'var(--shadow-model-featured-hover-inner)'
const SHADOW_SELECTED_OUTER = 'var(--shadow-model-featured-selected-outer)'
const SHADOW_SELECTED_INNER = 'var(--shadow-model-featured-selected-inner)'

// Selected-state text shadow - emboss letters on the dark gradient.
const TEXT_SHADOW_SELECTED =
  '0px -0.5px 0.364px rgba(0,0,0,0.25), 0px 0.5px 0.364px rgba(255,255,255,0.25)'

// Blurred rainbow gradient - persistent selected layer and gradient fill flood.
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
  /** Model name - rendered in the title font */
  title: string
  /** Short description below the title */
  description: React.ReactNode
  /** URL for the "Learn more" inline link - omit to hide the link */
  learnMoreHref?: string
  /** Controlled selected state. Pair with `onSelectedChange`. */
  selected?: boolean
  /** Initial selected state - component manages its own state after mount */
  defaultSelected?: boolean
  /** Callback fired when the selected state changes */
  onSelectedChange?: (selected: boolean) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ModelFeaturedCard = React.forwardRef<HTMLDivElement, ModelFeaturedCardProps>(
  function ModelFeaturedCard(
    {
      title,
      description,
      learnMoreHref,
      selected,
      defaultSelected = false,
      onSelectedChange,
      className,
      style,
      onClick,
      ...props
    },
    ref,
  ) {
    const isControlled = selected !== undefined
    const [internalSelected, setInternalSelected] = useState(defaultSelected)
    const isSelected = isControlled ? !!selected : internalSelected

    const [isHovered, setIsHovered] = useState(false)
    const [ripples, setRipples]     = useState<Ripple[]>([])

    const selectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
    const rippleTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    useEffect(() => {
      return () => {
        if (selectTimerRef.current)  clearTimeout(selectTimerRef.current)
        rippleTimersRef.current.forEach(clearTimeout)
        rippleTimersRef.current.clear()
      }
    }, [])

    const setSelected = (next: boolean) => {
      if (!isControlled) setInternalSelected(next)
      onSelectedChange?.(next)
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isSelected) {
        setSelected(false)
        onClick?.(e)
        return
      }

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
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

      if (selectTimerRef.current) clearTimeout(selectTimerRef.current)
      selectTimerRef.current = setTimeout(() => {
        setSelected(true)
        selectTimerRef.current = null
      }, 480)

      onClick?.(e)
    }

    // Resolve current visual state
    const showHover = isHovered && !isSelected
    const outerShadow = isSelected
      ? SHADOW_SELECTED_OUTER
      : showHover
        ? SHADOW_HOVER_OUTER
        : SHADOW_DEFAULT_OUTER
    const innerShadow = isSelected
      ? SHADOW_SELECTED_INNER
      : showHover
        ? SHADOW_HOVER_INNER
        : SHADOW_DEFAULT_INNER

    // Background per state. Selected uses an absolute gradient overlay (so the
    // ripple effects above it can blend correctly); default/hover are flat fills.
    const baseBg = isSelected
      ? 'transparent'
      : showHover
        ? 'var(--neutral-100-60)'
        : '#FFFFFF'

    const titleColor = isSelected ? 'var(--neutral-50)'  : 'var(--neutral-700)'
    const descColor  = isSelected ? 'var(--neutral-200)' : 'var(--neutral-600)'

    return (
      <div
        ref={ref}
        className={cn('kds-model-featured-card', className)}
        data-selected={isSelected ? 'true' : 'false'}
        style={{
          position:        'relative',
          borderRadius:    '12px',
          overflow:        'clip',
          padding:         '12px',
          width:           '100%',
          flexShrink:      0,
          backgroundColor: baseBg,
          boxShadow:       outerShadow,
          cursor:          'pointer',
          transition:      'background-color 150ms ease, box-shadow 150ms ease',
          ...style,
        }}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...props}
      >
        {/* ── Selected: dark gradient base ── */}
        {isSelected && (
          <div
            aria-hidden
            style={{
              position:      'absolute',
              inset:         0,
              background:    'linear-gradient(180deg, var(--neutral-700) 0%, var(--neutral-900) 100%)',
              borderRadius: 'inherit',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Persistent selected gradient (rainbow) ── */}
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

        {/* ── Click effects - clipped by overflow: clip on the container ── */}
        <AnimatePresence>
          {ripples.flatMap(({ key, x, y, r }) => [
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
                boxShadow:       '0 0 32px 12px rgba(220,195,140,0.6), inset 0 0 24px 8px rgba(220,195,140,0.25)',
                pointerEvents:   'none',
                transformOrigin: 'center',
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.4, 1] }}
            />,
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

        {/* ── Content (Text Block) ── */}
        <div
          style={{
            position:      'relative',
            display:       'flex',
            flexDirection: 'column',
            gap:           '4px',
            textShadow:    isSelected ? TEXT_SHADOW_SELECTED : 'none',
          }}
        >
          <p
            style={{
              fontFamily:  'var(--font-title)',
              fontWeight:  400,
              fontSize:    '24px',
              lineHeight:  '32px',
              color:       titleColor,
              margin:      0,
              width:       '100%',
            }}
          >
            {title}
          </p>

          <p
            style={{
              fontFamily:    'var(--font-body)',
              fontWeight:    400,
              fontSize:      '11px',
              lineHeight:    '16px',
              color:         descColor,
              margin:        0,
              overflow:      'hidden',
              textOverflow:  'ellipsis',
              width:         '100%',
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

        {/* ── Inner depth shadow - sits above all effect layers ── */}
        <div
          aria-hidden
          style={{
            position:      'absolute',
            inset:         0,
            borderRadius:  'inherit',
            boxShadow:     innerShadow,
            pointerEvents: 'none',
          }}
        />
      </div>
    )
  },
)

ModelFeaturedCard.displayName = 'ModelFeaturedCard'

export default ModelFeaturedCard
