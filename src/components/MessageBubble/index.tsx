'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { IconButton } from '@/components/IconButton'
import { Button } from '@/components/Button'
import {
  PenOneIcon,
  CopyOneIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { cn } from '@/lib/utils'

// ── Animation constants (KDS in-place swap pattern) ────────────────────────────
const SPRING       = { type: 'spring', stiffness: 500, damping: 30 } as const
const SWAP_INITIAL = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }
const SWAP_ANIMATE = { scale: 1,    opacity: 1, filter: 'blur(0px)' }
const SWAP_EXIT    = { scale: 0.75, opacity: 0, filter: 'blur(4px)' }

// ── Shadow / focus constants ──────────────────────────────────────────────────
const SHADOW_OUTER = 'var(--shadow-message-bubble-user)'
const SHADOW_INNER = 'var(--shadow-message-bubble-user-inner)'
// #4A83BF - blue focus ring for edit mode (specified by design)
const SHADOW_FOCUS = '0 0 0 1.5px #4A83BF'

// ── Canvas font constants (pretext prep) ─────────────────────────────────────
// Resolved values of TEXT_STYLE tokens. Exported so future pretext integration
// can call prepare(content, CANVAS_FONT) without recalculating. Update here
// whenever typography tokens change.
export const CANVAS_FONT      = "16px/22px 'Geist Variable', sans-serif"
export const CANVAS_FONT_MONO = "14px/20px 'Geist Mono', monospace"
export const LINE_HEIGHT_PX   = 22

// ── Edit CTA sizing ───────────────────────────────────────────────────────────
// Both root paddingBottom reservation and the CTA absolute offset derive from
// these two numbers - update here if Button size="sm" height changes.
const CTA_HEIGHT = 36   // Button size="sm" rendered height
const CTA_GAP    = 8    // gap between bubble bottom edge and CTA row
const CTA_ZONE   = CTA_GAP + CTA_HEIGHT  // 44px total reserved in paddingBottom

// ── Width animation ───────────────────────────────────────────────────────────
// CSS cannot transition to/from `fit-content` (keyword → length mismatch).
// We pin to a measured pixel width before animating so both FROM and TO values
// are interpolatable. This duration must match the CSS transition value below.
const WIDTH_MS = 200

// ── Shared text style (view <p> + edit <textarea> + mirror <div> must match) ──
const TEXT_STYLE: React.CSSProperties = {
  fontFamily:   'var(--font-body)',
  fontWeight:   'var(--font-weight-regular)',
  fontSize:     'var(--font-size-body-lg)',
  lineHeight:   'var(--line-height-body-lg)',
  color:        'var(--message-bubble-user-text)',
  overflowWrap: 'break-word',
  whiteSpace:   'pre-wrap',
  margin:       0,
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MessageBubbleRole = 'user' | 'assistant'

export interface MessageBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  role:         MessageBubbleRole
  content:      string
  timestamp?:   string
  onRetry?:     () => void
  /** Called when the user saves an edit - parent handles re-submission */
  onEditSave?:  (newContent: string) => void
  onCopy?:      () => void
  maxWidth?:    string | number
  /** Hides the hover action bar (edit / copy / retry) on user bubbles */
  hideActions?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MessageBubble({
    ref,
    role, content, timestamp, onRetry, onEditSave, onCopy, maxWidth, hideActions, className, ...props
  // eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
  }: MessageBubbleProps & { ref?: React.Ref<HTMLDivElement> }) {
    const shouldReduceMotion = useReducedMotion() ?? false

    const [hovered,     setHovered]     = useState(false)
    const [copied,      setCopied]      = useState(false)
    const [editing,     setEditing]     = useState(false)
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [editDraft,   setEditDraft]   = useState(content)
    // Drives the CSS width during animated transitions. Normally 'fit-content';
    // briefly set to a measured px value so CSS can interpolate.
    const [bubbleWidth, setBubbleWidth] = useState<string>('fit-content')

    const textareaRef     = useRef<HTMLTextAreaElement>(null)
    const bubbleCardRef   = useRef<HTMLDivElement>(null)
    // Pixel width captured just before entering edit mode - used to animate back on exit.
    const naturalWidthRef = useRef<number>(0)
    const timers          = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
    const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => {
      timers.current.forEach(clearTimeout)
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
    }, [])

    // Focus + move cursor to end when entering edit mode
    useEffect(() => {
      if (!editing || !textareaRef.current) return
      const el = textareaRef.current
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, [editing])

    const isUser = role === 'user'

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleCopy = () => {
      navigator.clipboard?.writeText(content).then(() => {
        setCopied(true)
        onCopy?.()  // fire only after clipboard write resolves
        const t = setTimeout(() => {
          setCopied(false)
          timers.current.delete(t)  // prune Set when timer fires, not just on unmount
        }, 1500)
        timers.current.add(t)
      })
    }

    const handleEditStart = () => {
      const natural = bubbleCardRef.current?.offsetWidth ?? 0
      naturalWidthRef.current = natural
      setEditDraft(content)
      setHovered(false)

      if (shouldReduceMotion || !natural) {
        setBubbleWidth('100%')
        setEditing(true)
      } else {
        // Pin to current px (no visual jump), then expand in next frame so
        // CSS transition sees two interpolatable values: ${n}px → 100%.
        setBubbleWidth(`${natural}px`)
        requestAnimationFrame(() => {
          setBubbleWidth('100%')
          setEditing(true)
        })
      }
    }

    // Shared exit logic for both Cancel and Save paths
    const exitEditMode = (resetDraft: boolean) => {
      setEditing(false)
      if (resetDraft) setEditDraft(content)

      if (!shouldReduceMotion && naturalWidthRef.current) {
        // Animate from 100% back to the captured natural width (px → px, interpolatable),
        // then release to fit-content after the transition completes.
        setBubbleWidth(`${naturalWidthRef.current}px`)
        const t = setTimeout(() => {
          setBubbleWidth('fit-content')
          timers.current.delete(t)
        }, WIDTH_MS + 10)
        timers.current.add(t)
      } else {
        setBubbleWidth('fit-content')
      }
    }

    const handleEditCancel = () => exitEditMode(true)

    const handleEditSave = () => {
      const trimmed = editDraft.trim()
      if (trimmed && trimmed !== content) onEditSave?.(trimmed)
      exitEditMode(false)
    }

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') { e.preventDefault(); handleEditCancel() }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleEditSave() }
    }

    const handleHoverEnter = () => {
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
      if (!editing) setHovered(true)
    }
    const handleHoverLeave = () => {
      hoverLeaveTimer.current = setTimeout(() => setHovered(false), 80)
    }

    const fadeDuration = shouldReduceMotion ? 0 : 0.15

    // ── Assistant bubble ───────────────────────────────────────────────────────
    if (!isUser) {
      return (
        <div ref={ref} className={cn('flex flex-col items-start', className)} style={{ maxWidth }} {...props}>
          <div
            style={{
              padding:         '10px 16px',
              borderRadius:    '16px 16px 16px 4px',
              backgroundColor: 'var(--neutral-100)',
              boxShadow:       '0px 1px 2px rgba(59,54,50,0.08), 0px 0px 0px 1px var(--neutral-200)',
            }}
          >
            <p style={{ ...TEXT_STYLE, color: 'var(--neutral-900)', margin: 0 }}>{content}</p>
          </div>
        </div>
      )
    }

    // ── User bubble ────────────────────────────────────────────────────────────
    return (
      <div
        ref={ref}
        className={cn('relative flex flex-col items-end', className)}
        style={{
          maxWidth,
          // Reserve space for absolute-positioned CTAs so siblings never shift
          paddingBottom: editing ? CTA_ZONE : 0,
          transition:    shouldReduceMotion ? 'none' : `padding-bottom ${fadeDuration}s ease-out`,
        }}
        onMouseEnter={handleHoverEnter}
        onMouseLeave={handleHoverLeave}
        {...props}
      >
        {/* ── Bubble card ── */}
        {/*                                                                          */}
        {/* Width is driven by bubbleWidth state rather than a static value so that  */}
        {/* CSS transition always sees two interpolatable px/% values. See WIDTH_MS. */}
        <div
          ref={bubbleCardRef}
          style={{
            position:        'relative',
            display:         'flex',
            flexDirection:   'column',
            alignItems:      'flex-start',
            overflow:        'hidden',
            padding:         '10px 16px',
            borderRadius:    '16px 16px 4px 16px',
            boxShadow:       editing ? SHADOW_FOCUS : SHADOW_OUTER,
            backgroundColor: 'var(--message-bubble-user-bg)',
            width:           bubbleWidth,
            maxWidth:        '100%',
            transition:      shouldReduceMotion
              ? 'none'
              : `width ${WIDTH_MS}ms ease-out, box-shadow 0.15s ease-out`,
          }}
        >
          {/* White bg overlay - per Figma node structure */}
          <div
            aria-hidden
            style={{
              position:        'absolute',
              inset:           0,
              borderRadius:    'inherit',
              backgroundColor: 'white',
              pointerEvents:   'none',
            }}
          />

          {/* ── Content area - CSS grid trick ──────────────────────────────────── */}
          {/*                                                                        */}
          {/* A hidden mirror <div> always occupies gridArea 1/1 driving the cell   */}
          {/* dimensions. The visible <p> or <textarea> overlays it in the same     */}
          {/* cell. On edit entry the textarea sees identical dimensions to the <p>  */}
          {/* - zero jump. As user types, the mirror updates and the cell grows.     */}
          <div style={{ display: 'grid', position: 'relative', width: '100%' }}>
            {/* Mirror - always hidden, always rendered, drives cell size */}
            <div
              aria-hidden
              style={{
                ...TEXT_STYLE,
                gridArea:   '1/1',
                visibility: 'hidden',
              }}
            >
              {editing ? editDraft + '​' : content}
            </div>

            {/* View mode */}
            {!editing && (
              <p style={{ ...TEXT_STYLE, gridArea: '1/1' }}>{content}</p>
            )}

            {/* Edit mode */}
            {editing && (
              <textarea
                ref={textareaRef}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={handleEditKeyDown}
                style={{
                  ...TEXT_STYLE,
                  gridArea:   '1/1',
                  padding:    0,
                  border:     'none',
                  // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                  outline:    'none',
                  resize:     'none',
                  overflow:   'hidden',
                  background: 'transparent',
                  width:      '100%',
                }}
              />
            )}
          </div>

          {/* Inner depth shadow - hidden in edit mode */}
          {!editing && (
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
          )}
        </div>

        {/* ── Edit CTAs - Cancel + Save ── */}
        {/* Absolute so bubble never shifts when CTAs appear/disappear. Root       */}
        {/* wrapper's paddingBottom reserves CTA_ZONE px to protect page siblings. */}
        <AnimatePresence>
          {editing && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{    opacity: 0 }}
              transition={{ duration: fadeDuration, ease: 'easeOut' }}
              style={{
                position:   'absolute',
                top:        `calc(100% - ${CTA_ZONE}px + ${CTA_GAP}px)`,
                right:      0,
                display:    'flex',
                gap:        6,
                alignItems: 'center',
              }}
            >
              <Button variant="outline" size="sm" onClick={handleEditCancel}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={!editDraft.trim() || editDraft.trim() === content}
                onClick={handleEditSave}
              >
                Save
              </Button>
              {/* Keyboard shortcut hint - discoverable but unobtrusive */}
              <kbd
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  lineHeight: 1,
                  color:      'var(--neutral-400)',
                  userSelect: 'none',
                  marginLeft: 2,
                  background: 'none',
                  border:     'none',
                  padding:    0,
                }}
              >
                ⌘↵
              </kbd>
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Hover action bar ── */}
        {/* Always in-flow so its area is inside the root wrapper's border box -   */}
        {/* hovering directly over the buttons triggers onMouseEnter on the root   */}
        {/* wrapper without needing to hover the bubble first (same pattern as the */}
        {/* AI actions bar in ChatMessage). opacity/pointerEvents gate visibility. */}
        {!hideActions && (
          <m.div
            animate={{ opacity: !editing && hovered ? 1 : 0 }}
            transition={{ duration: fadeDuration, ease: 'easeOut' }}
            onMouseEnter={handleHoverEnter}
            onMouseLeave={handleHoverLeave}
            style={{
              display:       'flex',
              alignItems:    'center',
              alignSelf:     'flex-end',
              gap:           2,
              marginTop:     4,
              pointerEvents: !editing && hovered ? 'auto' : 'none',
            }}
          >
            {timestamp && (
              <span
                style={{
                  fontFamily:   'var(--font-body)',
                  fontWeight:   'var(--font-weight-regular)',
                  fontSize:     'var(--font-size-caption)',
                  lineHeight:   'var(--line-height-caption)',
                  color:        'var(--message-bubble-action-timestamp)',
                  paddingRight: 4,
                  userSelect:   'none',
                }}
              >
                {timestamp}
              </span>
            )}

            <IconButton
              variant="ghost" size="xs"
              aria-label="Edit message"
              icon={<PenOneIcon size={16} />}
              onClick={handleEditStart}
            />
            <IconButton
              variant="ghost" size="xs"
              aria-label={copied ? 'Copied' : 'Copy message'}
              icon={
                <AnimatePresence mode="popLayout" initial={false}>
                  {copied ? (
                    <m.span key="check" initial={SWAP_INITIAL} animate={SWAP_ANIMATE} exit={SWAP_EXIT} transition={SPRING} style={{ display: 'block', lineHeight: 0 }}>
                      <TickTwoIcon size={16} />
                    </m.span>
                  ) : (
                    <m.span key="copy" initial={SWAP_INITIAL} animate={SWAP_ANIMATE} exit={SWAP_EXIT} transition={SPRING} style={{ display: 'block', lineHeight: 0 }}>
                      <CopyOneIcon size={16} />
                    </m.span>
                  )}
                </AnimatePresence>
              }
              onClick={handleCopy}
            />
          </m.div>
        )}
      </div>
    )
}

MessageBubble.displayName = 'MessageBubble'
export default MessageBubble
