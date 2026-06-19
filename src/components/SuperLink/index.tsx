'use client'

import React, { useCallback, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { Slot } from '@radix-ui/react-slot'
import { LinkSixIcon } from '@strange-huge/icons'
import { Switch } from '@/components/Switch'
import { Button } from '@/components/Button'
import { Slider } from '@/components/Slider'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

// ── Animation ─────────────────────────────────────────────────────────────────

const EASE   = [0.25, 0.46, 0.45, 0.94] as const
const REVEAL = { duration: 0.18, ease: EASE }

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuperLinkProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Toggle state — controls whether Super Link is on. */
  enabled?: boolean
  /**
   * The live shareable URL.
   * - absent + enabled  → "generate" state (placeholder URL + Generate link button)
   * - present + enabled → "open" state (live URL + Revoke + Copy + token bar)
   */
  url?: string
  /** Dimmed placeholder URL shown before a link is generated. */
  urlPlaceholder?: string
  /** Caption below the title. */
  description?: string
  /** Tokens consumed so far. */
  tokenUsed?: number
  /** Editable token budget ceiling — controlled by the slider and input. */
  tokenLimit?: number
  /** Maximum value the slider can reach. */
  tokenLimitMax?: number
  /** Shows a loading spinner on the Generate link button while generating. */
  loading?: boolean
  /** Disables all interaction. */
  disabled?: boolean
  onEnabledChange?: (on: boolean) => void
  onGenerate?: () => void
  onRevoke?: () => void
  onCopy?: () => void
  onTokenLimitChange?: (limit: number) => void
  asChild?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuperLink(
  {
    ref,
    enabled          = false,
    url,
    urlPlaceholder   = 'souvenir.app/p/your-persona-a8b2c3',
    description      = 'Generate a shareable URL anyone can chat without a Souvenir account. You cover the token cost.',
    tokenUsed        = 0,
    tokenLimit       = 10_000,
    tokenLimitMax    = 50_000,
    loading          = false,
    disabled         = false,
    onEnabledChange,
    onGenerate,
    onRevoke,
    onCopy,
    onTokenLimitChange,
    asChild          = false,
    className,
    style,
    ...props
  }: SuperLinkProps & { ref?: React.Ref<HTMLDivElement> },
) {
    const Comp    = (asChild ? Slot : 'div') as React.ElementType
    const hasLink = enabled && !!url
    const pct     = tokenLimit > 0
      ? Math.min(100, Math.round((tokenUsed / tokenLimit) * 100))
      : 0

    // Local display value for the token limit input —
    // shows formatted ("10,000") at rest, raw number while focused.
    const [limitRaw, setLimitRaw]     = useState(false)
    const [limitDraft, setLimitDraft] = useState(String(tokenLimit))
    const [copied,   setCopied]       = useState(false)
    const [revoking, setRevoking]     = useState(false)

    const handleLimitFocus = useCallback(() => {
      setLimitRaw(true)
      setLimitDraft(String(tokenLimit))
    }, [tokenLimit])

    const handleLimitChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setLimitDraft(e.target.value)
      },
      [],
    )

    const handleLimitBlur = useCallback(() => {
      setLimitRaw(false)
      const val = parseInt(limitDraft.replace(/\D/g, ''), 10)
      const clamped = Math.min(Math.max(val || tokenLimit, 1), tokenLimitMax)
      if (!Number.isNaN(val) && val > 0) onTokenLimitChange?.(clamped)
      setLimitDraft(fmt(Number.isNaN(val) || val <= 0 ? tokenLimit : clamped))
    }, [limitDraft, tokenLimit, tokenLimitMax, onTokenLimitChange])

    const handleSliderChange = useCallback(
      ([v]: number[]) => {
        onTokenLimitChange?.(v)
        if (!limitRaw) setLimitDraft(fmt(v))
      },
      [onTokenLimitChange, limitRaw],
    )

    const handleCopy = useCallback(() => {
      onCopy?.()
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }, [onCopy])

    const handleRevoke = useCallback(() => {
      onRevoke?.()
      setRevoking(false)
    }, [onRevoke])

    // Keep display in sync when tokenLimit changes externally
    React.useEffect(() => {
      if (!limitRaw) setLimitDraft(fmt(tokenLimit))
    }, [tokenLimit, limitRaw])

    // Reset transient UI state when the link goes away
    React.useEffect(() => {
      if (!hasLink) { setRevoking(false); setCopied(false) }
    }, [hasLink])

    return (
      <Comp
        ref={ref}
        className={cn(className)}
        style={{
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
          width:         '100%',
          opacity:       disabled ? 0.5 : 1,
          pointerEvents: disabled ? 'none' : undefined,
          ...style,
        }}
        {...props}
      >

        {/* ── Upper group: header + URL input (31px gap between them) ──── */}
        <div
          style={{
            display:       'flex',
            flexDirection: 'column',
            gap:           31,
          }}
        >

          {/* Header: title + description left, Switch right */}
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'flex-start',
              gap:            16,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  fontFamily:    'var(--font-body)',
                  fontSize:      'var(--font-size-body-lg)',  // 14px
                  fontWeight:    500,
                  lineHeight:    1.5,
                  letterSpacing: '0.07px',
                  color:         'var(--neutral-950)',
                  whiteSpace:    'nowrap',
                }}
              >
                Super Link
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',     // 11px
                  fontWeight: 500,
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-600)',
                  maxWidth:   560,
                }}
              >
                {description}
              </span>
            </div>

            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
              disabled={disabled}
              aria-label="Enable Super Link sharing"
              style={{ flexShrink: 0, marginTop: 2 }}
            />
          </div>

          {/* URL input row — reveals when enabled */}
          <AnimatePresence initial={false}>
            {enabled && (
              <m.div
                key="url-row"
                initial={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
                exit={{   opacity: 0, y: -4,  filter: 'blur(4px)' }}
                transition={REVEAL}
                style={{
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'space-between',
                  backgroundColor: 'var(--neutral-white)',
                  border:          '1px solid var(--neutral-200)',
                  borderRadius:    10,
                  height:          46,
                  padding:         '8px 7px',
                  overflow:        'hidden',
                  boxSizing:       'border-box' as const,
                  gap:             8,
                }}
              >
                {/* URL / placeholder */}
                <span
                  style={{
                    fontFamily:   'var(--font-body)',
                    fontSize:     'var(--font-size-body-lg)',
                    fontWeight:   500,
                    lineHeight:   'var(--line-height-body-lg)',
                    color:        hasLink ? 'var(--neutral-800)' : 'var(--neutral-300)',
                    paddingLeft:  8,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                    flex:         1,
                    minWidth:     0,
                    userSelect:   hasLink ? 'text' : 'none',
                  }}
                >
                  {hasLink ? url : urlPlaceholder}
                </span>

                {/* Generate OR Revoke + Copy */}
                {!hasLink ? (
                  <Button
                    variant="default"
                    size="sm"
                    loading={loading}
                    onClick={onGenerate}
                    style={{ flexShrink: 0 }}
                  >
                    Generate link
                  </Button>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {!revoking ? (
                      <m.div
                        key="actions"
                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{   opacity: 0, filter: 'blur(4px)' }}
                        transition={REVEAL}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<LinkSixIcon size={16} />}
                          style={{ color: 'var(--red-400)', flexShrink: 0 }}
                          onClick={() => setRevoking(true)}
                        >
                          Revoke link
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleCopy}
                          style={{ flexShrink: 0, minWidth: 56 }}
                        >
                          <AnimatePresence mode="popLayout" initial={false}>
                            <m.span
                              key={copied ? 'copied' : 'copy'}
                              initial={{ scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                              animate={{ scale: 1,    opacity: 1, filter: 'blur(0px)' }}
                              exit={{    scale: 0.75, opacity: 0, filter: 'blur(4px)' }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                              style={{ display: 'block', transformOrigin: 'center' }}
                            >
                              {copied ? 'Copied!' : 'Copy'}
                            </m.span>
                          </AnimatePresence>
                        </Button>
                      </m.div>
                    ) : (
                      <m.div
                        key="confirm"
                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{   opacity: 0, filter: 'blur(4px)' }}
                        transition={REVEAL}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRevoking(false)}
                          style={{ flexShrink: 0 }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRevoke}
                          style={{ color: 'var(--red-500)', flexShrink: 0 }}
                        >
                          Confirm revoke
                        </Button>
                      </m.div>
                    )}
                  </AnimatePresence>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>{/* /upper group */}

        {/* ── Token usage row — separate 12px-gap item ─────────────────── */}
        <AnimatePresence initial={false}>
          {hasLink && (
            <m.div
              key="token-usage"
              initial={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
              exit={{   opacity: 0, y: -4,  filter: 'blur(4px)' }}
              transition={REVEAL}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize:   'var(--font-size-caption)',   // 11px — smaller as requested
                  fontWeight: 400,
                  lineHeight: 'var(--line-height-caption)',
                  color:      'var(--neutral-700)',
                  whiteSpace: 'nowrap',
                }}
              >
                {pct}% used · {fmt(tokenUsed)} / {fmt(tokenLimit)} credits
              </span>

              {/* Editable token budget */}
              <input
                type="text"
                inputMode="numeric"
                value={limitRaw ? limitDraft : fmt(tokenLimit)}
                aria-label="Credit budget limit"
                onChange={handleLimitChange}
                onFocus={handleLimitFocus}
                onBlur={handleLimitBlur}
                style={{
                  width:           96,
                  padding:         7,
                  border:          '1px solid var(--neutral-200)',
                  borderRadius:    8,
                  fontFamily:      'var(--font-body)',
                  fontSize:        12,
                  fontWeight:      400,
                  lineHeight:      'normal',
                  color:           'var(--neutral-800)',
                  backgroundColor: 'var(--neutral-white)',
                  outline:         'none',
                  boxSizing:       'border-box' as const,
                  textAlign:       'right' as const,
                }}
              />
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Token budget slider — drag to set limit ──────────────────── */}
        <AnimatePresence initial={false}>
          {hasLink && (
            <m.div
              key="slider"
              initial={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0,  filter: 'blur(0px)' }}
              exit={{   opacity: 0, y: -4,  filter: 'blur(4px)' }}
              transition={REVEAL}
            >
              <Slider
                value={[tokenLimit]}
                min={1000}
                max={tokenLimitMax}
                step={100}
                fluid
                fillColor="var(--blue-600)"
                onValueChange={handleSliderChange}
                aria-label="Credit budget limit"
              />
            </m.div>
          )}
        </AnimatePresence>

      </Comp>
    )
}

SuperLink.displayName = 'SuperLink'
export default SuperLink
