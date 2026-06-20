'use client'

import React, { useEffect, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { LogoIcon } from '@strange-huge/icons'
import { LlmIcon } from '@strange-huge/icons/llm'
import { cn } from '@/lib/utils'

// ── Animation constants ────────────────────────────────────────────────────────
const SPRING        = { type: 'spring', stiffness: 500, damping: 30 } as const
const LABEL_SPRING  = { type: 'spring', stiffness: 520, damping: 32 } as const
const LOGO_SPRING   = { type: 'spring', stiffness: 220, damping: 11, mass: 0.9 } as const

const LABEL_ENTER = { opacity: 0, filter: 'blur(5px)', scale: 0.82, y:  5 }
const LABEL_SHOW  = { opacity: 1, filter: 'blur(0px)', scale: 1,    y:  0 }
const LABEL_EXIT  = { opacity: 0, filter: 'blur(5px)', scale: 0.82, y: -5 }

const WORD_ENTER = { opacity: 0, filter: 'blur(4px)', scale: 0.75 }
const WORD_SHOW  = { opacity: 1, filter: 'blur(0px)', scale: 1    }
const WORD_EXIT  = { opacity: 0, filter: 'blur(4px)', scale: 0.75 }

// Logo swap - smooth crossfade with gentle scale
const LOGO_EXIT  = { opacity: 0, scale: 0.6, filter: 'blur(4px)' }
const LOGO_ENTER = { opacity: 0, scale: 0.6, filter: 'blur(4px)' }
const LOGO_SHOW  = { opacity: 1, scale: 1,   filter: 'blur(0px)' }

// ── Default thinking words ─────────────────────────────────────────────────────
export const THINKING_WORDS = ['Thinking…', 'Analysing…', 'Processing…', 'Considering…'] as const

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * thinking  - Souvenir mark spinning; cycling shimmer label
 * choosing  - Souvenir mark spinning faster; row pulses opacity; shimmer label
 * streaming - Model logo shown; stable label; response generating
 * complete  - Model logo shown; static label
 */
export type StreamingPhase = 'thinking' | 'choosing' | 'streaming' | 'complete'

export interface StreamingIndicatorProps {
  phase: StreamingPhase
  /** Static label shown in choosing / streaming / complete phases */
  label?: string
  /**
   * LLM icon ID from @strange-huge/icons/llm - e.g. "Claude", "Gemini", "OpenAI".
   * Shown once phase reaches "streaming". Souvenir mark shown before that.
   */
  llmId?: string
  /** Optional custom logo for non-model selections, such as a persona avatar. */
  logo?: React.ReactNode
  /** Stable identity used to animate custom-logo swaps. */
  logoKey?: string
  /** Words cycled during thinking phase. Defaults to THINKING_WORDS. */
  thinkingWords?: readonly string[]
  className?: string
  style?: React.CSSProperties
}

// ── CyclingLabel ───────────────────────────────────────────────────────────────
// Exported so consumers can use it standalone (e.g. searching / loading labels).

export interface CyclingLabelProps {
  words: readonly string[]
  textStyle?: React.CSSProperties
  intervalMs?: number
}

export function CyclingLabel({ words, textStyle, intervalMs = 2800, ref }: CyclingLabelProps & { ref?: React.Ref<HTMLSpanElement> }) {
    const [idx, setIdx] = useState(0)

    useEffect(() => {
      const t = setInterval(() => setIdx(i => (i + 1) % words.length), intervalMs)
      return () => clearInterval(t)
    }, [words.length, intervalMs])

    return (
      <span ref={ref} style={{ display: 'block', position: 'relative' }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={words[idx]}
            initial={WORD_ENTER}
            animate={WORD_SHOW}
            exit={WORD_EXIT}
            transition={SPRING}
            style={{ transformOrigin: 'left center', display: 'block', ...textStyle }}
          >
            {words[idx]}
          </m.span>
        </AnimatePresence>
      </span>
    )
}

CyclingLabel.displayName = 'CyclingLabel'

// ── StreamingLogo ──────────────────────────────────────────────────────────────
// Handles the Souvenir mark → LLM model icon swap.
// Exported so it can be used in custom layouts outside StreamingIndicator.

export interface StreamingLogoProps {
  phase: StreamingPhase
  llmId?: string
  logo?: React.ReactNode
  logoKey?: string
  size?: number
}

export function StreamingLogo({ phase, llmId, logo, logoKey, size = 16 }: StreamingLogoProps) {
  const shouldReduceMotion = useReducedMotion() ?? false
  const showModel = phase === 'streaming' || phase === 'complete'

  // Spin speed: faster during choosing
  const spinDuration = phase === 'choosing' ? 1.2 : 2.0

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!showModel ? (
          // Souvenir mark - spins during thinking + choosing
          <m.div
            key="souvenir"
            initial={shouldReduceMotion ? { opacity: 0 } : LOGO_ENTER}
            animate={shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, filter: 'blur(0px)', rotate: [0, 360] }
            }
            exit={shouldReduceMotion ? { opacity: 0 } : LOGO_EXIT}
            transition={shouldReduceMotion
              ? { duration: 0 }
              : {
                  opacity: LOGO_SPRING,
                  scale:   LOGO_SPRING,
                  filter:  LOGO_SPRING,
                  rotate:  { duration: spinDuration, repeat: Infinity, ease: 'linear' },
                }
            }
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <LogoIcon size={size} color="var(--streaming-indicator-label)" />
          </m.div>
        ) : (
          // Model icon - smooth crossfade in
          <m.div
            key={`selected-${logoKey ?? llmId ?? 'default'}`}
            initial={shouldReduceMotion ? { opacity: 0 } : LOGO_ENTER}
            animate={shouldReduceMotion ? { opacity: 1 } : LOGO_SHOW}
            exit={shouldReduceMotion ? { opacity: 0 } : LOGO_EXIT}
            transition={shouldReduceMotion ? { duration: 0 } : LOGO_SPRING}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {logo ?? (llmId
              ? <LlmIcon id={llmId} size={size} variant="color" />
              : <LogoIcon size={size} color="var(--streaming-indicator-label)" />
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── StreamingIndicator ─────────────────────────────────────────────────────────

export function StreamingIndicator(
  { phase, label, llmId, logo, logoKey, thinkingWords = THINKING_WORDS, className, style, ref }: StreamingIndicatorProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const shouldReduceMotion = useReducedMotion() ?? false

    const isShimmering = (phase === 'thinking' || phase === 'choosing') && !shouldReduceMotion
    const isChoosing   = phase === 'choosing'

    const labelBaseStyle: React.CSSProperties = {
      fontFamily:      'var(--font-body)',
      fontWeight:      'var(--font-weight-medium)',
      fontSize:        'var(--font-size-body)',
      lineHeight:      'var(--line-height-body)',
      flexShrink:      0,
      transformOrigin: 'left center',
    }

    const shimmerStyle: React.CSSProperties = {
      backgroundImage:
        'linear-gradient(90deg, var(--streaming-indicator-shimmer-from) 0%, var(--streaming-indicator-shimmer-to) 45%, var(--streaming-indicator-shimmer-to) 55%, var(--streaming-indicator-shimmer-from) 100%)',
      backgroundSize:          '200% 100%',
      WebkitBackgroundClip:    'text',
      backgroundClip:          'text',
      WebkitTextFillColor:     'transparent',
      color:                   'transparent',
      animationName:           'kds-label-shimmer',
      animationDuration:       '2.4s',
      animationTimingFunction: 'ease-in-out',
      animationIterationCount: 'infinite',
    }

    const plainStyle: React.CSSProperties = {
      color: 'var(--streaming-indicator-label)',
    }

    const labelStyle = isShimmering ? shimmerStyle : plainStyle

    return (
      <m.div
        ref={ref}
        className={cn(className)}
        animate={
          isChoosing && !shouldReduceMotion
            ? { opacity: [0.45, 1, 0.45] }
            : { opacity: 1 }
        }
        transition={
          isChoosing && !shouldReduceMotion
            ? { duration: 1.0, repeat: Infinity, ease: 'easeInOut' }
            : { duration: shouldReduceMotion ? 0 : 0.2 }
        }
        style={{
          display:    'flex',
          alignItems: 'center',
          gap:        7,
          minHeight:  20,
          ...style,
        }}
      >
        {/* ── Logo - always shown, handles its own swap internally ── */}
        <StreamingLogo phase={phase} llmId={llmId} logo={logo} logoKey={logoKey} size={16} />

        {/* ── Label ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', minWidth: 0 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {phase === 'thinking' ? (
              <m.div
                key="thinking"
                initial={LABEL_ENTER}
                animate={LABEL_SHOW}
                exit={LABEL_EXIT}
                transition={LABEL_SPRING}
                style={{ flexShrink: 0 }}
              >
                <CyclingLabel
                  words={thinkingWords}
                  textStyle={{ ...labelBaseStyle, ...labelStyle }}
                />
              </m.div>
            ) : (
              <m.span
                key={label ?? phase}
                initial={LABEL_ENTER}
                animate={LABEL_SHOW}
                exit={LABEL_EXIT}
                transition={LABEL_SPRING}
                style={{ ...labelBaseStyle, ...labelStyle, display: 'block' }}
              >
                {label}
              </m.span>
            )}
          </AnimatePresence>
        </div>
      </m.div>
    )
}

StreamingIndicator.displayName = 'StreamingIndicator'
export default StreamingIndicator
