'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PlusSignIcon, MicTwoIcon, ArrowDownOneIcon, StopCircleIcon, ArrowUpTwoIcon } from '@strange-huge/icons'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

// ── Shadow tokens ──────────────────────────────────────────────────────────────

const SHADOW_DEFAULT = 'var(--shadow-chat-input)'
const SHADOW_HOVER   = 'var(--shadow-chat-input-hover)'
const SHADOW_FOCUS   = 'var(--shadow-chat-input-focus)'

// ── Audio-reactive waveform ────────────────────────────────────────────────────
// Mirrors the AudioWaveOneIcon shape (7 bars, same x positions and default heights)
// but animates bar heights in real time from a live AnalyserNode.

const BAR_X       = [3, 6, 9, 12, 15, 18, 21]
const BAR_DEFAULT = [2, 10, 18, 12, 6, 10, 2]  // heights at rest (matches icon)
const CENTER_Y    = 12
const LERP        = 0.35  // smoothing factor (higher = snappier)

function AudioWaveDisplay({ analyser, color = 'currentColor', size = 20 }: {
  analyser: AnalyserNode | null
  color?: string
  size?: number
}) {
  const pathRefs  = useRef<(SVGPathElement | null)[]>([])
  const heightsRef = useRef<number[]>([...BAR_DEFAULT])
  const rafRef     = useRef<number>(0)

  // Direct DOM mutation — no setState, no re-renders.
  // RAF-driven setState inside Framer Motion's composited subtree gets batched/dropped.
  const updatePaths = (heights: number[]) => {
    heights.forEach((h, i) => {
      const el = pathRefs.current[i]
      if (el) el.setAttribute('d', `M${BAR_X[i]} ${(CENTER_Y - h / 2).toFixed(2)}V${(CENTER_Y + h / 2).toFixed(2)}`)
    })
  }

  useEffect(() => {
    cancelAnimationFrame(rafRef.current)

    if (!analyser) {
      // Decay back to resting heights
      const decay = () => {
        const next = heightsRef.current.map((h, i) => h + (BAR_DEFAULT[i] - h) * LERP)
        heightsRef.current = next
        updatePaths(next)
        if (!next.every((h, i) => Math.abs(h - BAR_DEFAULT[i]) < 0.1))
          rafRef.current = requestAnimationFrame(decay)
      }
      rafRef.current = requestAnimationFrame(decay)
      return () => cancelAnimationFrame(rafRef.current)
    }

    const bufferLength = analyser.frequencyBinCount
    const dataArray    = new Uint8Array(bufferLength)
    const voiceBins    = Math.floor(bufferLength * 0.4)
    const binPerBar    = Math.floor(voiceBins / BAR_X.length)

    const tick = () => {
      analyser.getByteFrequencyData(dataArray)

      const targets = BAR_X.map((_, i) => {
        const start = 1 + i * binPerBar
        const end   = start + binPerBar
        let sum = 0
        for (let j = start; j < end; j++) sum += dataArray[j] ?? 0
        return 2 + (sum / binPerBar / 255) * 18
      })

      const next = heightsRef.current.map((h, i) => h + (targets[i] - h) * LERP)
      heightsRef.current = next
      updatePaths(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  const p = {
    stroke:         color,
    strokeWidth:    1.5,
    strokeLinecap:  'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {BAR_X.map((x, i) => {
        const h  = BAR_DEFAULT[i]
        const y1 = CENTER_Y - h / 2
        const y2 = CENTER_Y + h / 2
        return (
          <path
            key={x}
            ref={el => { pathRefs.current[i] = el }}
            d={`M${x} ${y1.toFixed(2)}V${y2.toFixed(2)}`}
            {...p}
          />
        )
      })}
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Textarea placeholder text */
  placeholder?: string
  /**
   * Accessible label for the textarea. Required for screen reader users —
   * the animated placeholder is aria-hidden and not a valid label.
   * @example "Message Souvenir"
   */
  textareaLabel?: string
  /** Controlled value */
  value?: string
  /** Called on every keystroke with the current value */
  onChange?: (value: string) => void
  /** Called when the message is sent (Enter key or send button). Receives the current text value. */
  onSend?: (value: string) => void
  /** Called when the + (add) button is clicked */
  onAdd?: () => void
  /** Model name shown in the selector button */
  modelName?: string
  /** Called when the model selector button is clicked */
  onModelClick?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Chip(s) to display in the left footer slot, between the add button and
   * the model selector. Accepts any ReactNode — typically one or more `<Chip>`
   * components.
   */
  chips?: React.ReactNode
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ChatInput = React.forwardRef<HTMLDivElement, ChatInputProps>(
  function ChatInput(
    {
      placeholder = 'How can I help you today?',
      textareaLabel = 'Message',
      value: controlledValue,
      onChange,
      onSend,
      onAdd,
      modelName = 'Souvenir',
      onModelClick,
      chips,
      className,
      onMouseEnter: externalMouseEnter,
      onMouseLeave: externalMouseLeave,
      ...props
    },
    ref,
  ) {
    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState('')
    const value = isControlled ? controlledValue : internalValue

    const [isFocused,    setIsFocused]    = useState(false)
    const [isHovered,    setIsHovered]    = useState(false)
    const [isRecording,  setIsRecording]  = useState(false)
    const [analyser,     setAnalyser]     = useState<AnalyserNode | null>(null)
    const [isMicHovered, setIsMicHovered] = useState(false)

    const audioCtxRef = useRef<AudioContext | null>(null)
    const streamRef   = useRef<MediaStream | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // ── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
      return () => {
        streamRef.current?.getTracks().forEach(t => t.stop())
        audioCtxRef.current?.close()
      }
    }, [])

    // ── Auto-grow textarea ───────────────────────────────────────────────────
    useEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [value])

    // ── Recording toggle ─────────────────────────────────────────────────────
    const startRecording = async () => {
      // Set recording state immediately for instant UI feedback (icon + placeholder).
      setIsRecording(true)

      // Create AudioContext synchronously while still inside the user-gesture call
      // stack. If created after an `await`, Chrome starts it suspended and
      // getByteFrequencyData returns all zeros.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        // Resume in case the context was auto-suspended (e.g. tab in background)
        if (ctx.state === 'suspended') await ctx.resume()

        const source       = ctx.createMediaStreamSource(stream)
        const analyserNode = ctx.createAnalyser()
        analyserNode.fftSize               = 256
        analyserNode.smoothingTimeConstant = 0.75
        source.connect(analyserNode)

        setAnalyser(analyserNode)
      } catch {
        // Mic permission denied or unavailable — revert
        ctx.close()
        audioCtxRef.current = null
        setIsRecording(false)
      }
    }

    const stopRecording = () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close()
      streamRef.current  = null
      audioCtxRef.current = null
      setAnalyser(null)
      setIsRecording(false)
      onSend?.('')
    }

    const handleMicClick = () => {
      if (isRecording) stopRecording()
      else if (value) handleSend()
      else startRecording()
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) setInternalValue(e.target.value)
      onChange?.(e.target.value)
    }

    const handleSend = () => {
      if (!value) return
      const text = value
      // Clear the textarea
      if (!isControlled) setInternalValue('')
      onChange?.('')
      // Reset height manually since auto-grow won't fire until next render
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      onSend?.(text)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && value) {
        e.preventDefault()
        handleSend()
      }
    }

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(true)
      externalMouseEnter?.(e)
    }

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      setIsHovered(false)
      externalMouseLeave?.(e)
    }

    const shadow = isFocused ? SHADOW_FOCUS : isHovered ? SHADOW_HOVER : SHADOW_DEFAULT

    return (
      <div
        ref={ref}
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          gap:             '24px',
          width:           '100%',
          maxWidth:        '674px',
          padding:         '20px',
          borderRadius:    '24px',
          backgroundColor: 'var(--chat-input-bg)',
          boxShadow:       shadow,
          overflow:        'hidden',
          transition:      'box-shadow 150ms',
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >

        {/* ── Recording state announcer (screen readers only) ── */}
        <span
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: 'absolute',
            width: 1, height: 1,
            padding: 0, margin: -1,
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {isRecording ? 'Recording started. Listening.' : ''}
        </span>

        {/* ── Main content — textarea + animated placeholder ── */}
        <div style={{ position: 'relative' }}>
          {/* Custom animated placeholder — fades out when user starts typing */}
          <AnimatePresence initial={false}>
            {!value && (
              <motion.div
                key="placeholder"
                aria-hidden
                initial={{ opacity: 0, filter: 'blur(2px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.2 } }}
                exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.15 } }}
                style={{
                  position:      'absolute',
                  top:           0,
                  left:          0,
                  right:         0,
                  pointerEvents: 'none',
                  fontFamily:    'var(--font-body)',
                  fontWeight:    'var(--font-weight-regular)',
                  fontSize:      'var(--font-size-body-lg)',
                  lineHeight:    'var(--line-height-body-lg)',
                  color:         'var(--chat-input-placeholder)',
                }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={isRecording ? 'listening' : 'default'}
                    initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                    exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={{ display: 'block', transformOrigin: 'left center' }}
                  >
                    {isRecording ? 'Listening...' : placeholder}
                  </motion.span>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={textareaRef}
            className="kaya-chat-textarea"
            rows={1}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            aria-label={textareaLabel}
            aria-multiline="true"
            style={{
              width:               '100%',
              maxHeight:           '396px', // 18 lines × 22px line-height
              background:          'transparent',
              border:              'none',
              outline:             'none',
              resize:              'none',
              overflowY:           'auto',
              overscrollBehaviorY: 'none',
              fontFamily:          'var(--font-body)',
              fontWeight:          'var(--font-weight-regular)',
              fontSize:            'var(--font-size-body-lg)',
              lineHeight:          'var(--line-height-body-lg)',
              color:               'var(--chat-input-text)',
              caretColor:          'var(--focus-ring)',
            }}
          />
        </div>

        {/* ── Footer bar ── */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            width:          '100%',
          }}
        >
          {/* Left: attach button + chips slot */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconButton
              variant="ghost"
              size="md"
              icon={<PlusSignIcon size={20} />}
              aria-label="Add attachment"
              onClick={onAdd}
            />
            {chips && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {chips}
              </div>
            )}
          </div>

          {/* Right: model selector + mic/send button */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Button
              variant="ghost"
              size="md"
              rightIcon={<ArrowDownOneIcon size={16} />}
              onClick={onModelClick}
            >
              {modelName}
            </Button>

            <span
              onMouseEnter={() => setIsMicHovered(true)}
              onMouseLeave={() => setIsMicHovered(false)}
              style={{ display: 'inline-flex' }}
            >
              <IconButton
                variant="default"
                size="md"
                aria-label={isRecording ? 'Stop recording' : value ? 'Send message' : 'Start recording'}
                icon={
                  <AnimatePresence mode="popLayout" initial={false}>
                    {(() => {
                      const iconKey = isRecording
                        ? (isMicHovered ? 'stop' : 'wave')
                        : value ? 'send' : 'mic'
                      const isWave = iconKey === 'wave'
                      // Wave state: no filter on enter — any filter creates a GPU compositing
                      // layer that kills SVG path updates inside AudioWaveDisplay.
                      return (
                        <motion.span
                          key={iconKey}
                          initial={isWave ? { scale: 0.5, opacity: 0 }               : { scale: 0.5, opacity: 0, filter: 'blur(4px)' }}
                          animate={isWave ? { scale: 1,   opacity: 1 }               : { scale: 1,   opacity: 1, filter: 'blur(0px)' }}
                          exit={{           scale: 0.5, opacity: 0, filter: 'blur(4px)' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {isRecording
                            ? isMicHovered
                              ? <StopCircleIcon size={20} />
                              : <AudioWaveDisplay analyser={analyser} size={20} />
                            : value
                              ? <ArrowUpTwoIcon size={20} animated triggered={isMicHovered} />
                              : <MicTwoIcon size={20} />
                          }
                        </motion.span>
                      )
                    })()}
                  </AnimatePresence>
                }
                onClick={handleMicClick}
              />
            </span>
          </div>
        </div>

      </div>
    )
  },
)

ChatInput.displayName = 'ChatInput'

export default ChatInput
