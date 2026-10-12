'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
  AiWebBrowsingIcon,
  AlertCircleIcon,
  ArrowExpandOneIcon,
  ArrowShrinkTwoIcon,
  ViewIcon,
} from '@strange-huge/icons'
import { Button, IconButton } from '@/components/ui/button'
import { InputField } from '@/components/InputField'
import { Spinner } from '@/components/Spinner'
import { Tooltip } from '@/components/Tooltip'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import type { BrowserInput, BrowserSession, BrowserSessionStatus } from './use-browser-session'

// The agent's screen: the latest screencast frame, at the tab's own aspect ratio.
// One element plays both roles — a thumbnail in the Context panel and a full-screen
// viewer — so going between them never remounts. Expanding lifts the card to `position: fixed` and
// framer's layout animation flies it from its slot to the centre of the window and back.
// Nothing above the side panel sets a transform/filter, so the fixed card escapes the
// panel's overflow clipping and sits in the root stacking context.

/** Until the first frame says otherwise: Chrome's 1440×900 window less its toolbar. */
const DEFAULT_ASPECT = 1431 / 808

const HEADER_H = 52
const Z_BACKDROP = 50

const CAPTION: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-500)',
}

const BODY: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--neutral-800)',
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS: Record<BrowserSessionStatus, { label: string; color: string }> = {
  idle:       { label: 'Idle',       color: 'var(--neutral-400)' },
  connecting: { label: 'Connecting', color: 'var(--blue-500)' },
  live:       { label: 'Live',       color: 'var(--green-500)' },
  ended:      { label: 'Ended',      color: 'var(--neutral-400)' },
  error:      { label: 'Offline',    color: 'var(--red-400)' },
}

export function StatusPill({ status, overlay }: { status: BrowserSessionStatus; overlay?: boolean }) {
  const reduceMotion = useReducedMotion()
  const { label, color } = STATUS[status]
  const pulsing = !reduceMotion && (status === 'live' || status === 'connecting')
  return (
    <span
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             6,
        height:          24,
        padding:         '0 9px 0 8px',
        borderRadius:    999,
        flexShrink:      0,
        fontFamily:      'var(--font-body)',
        fontWeight:      'var(--font-weight-medium)',
        fontSize:        'var(--font-size-caption)',
        lineHeight:      'var(--line-height-caption)',
        color:           'var(--neutral-800)',
        backgroundColor: overlay ? 'color-mix(in srgb, var(--neutral-white) 88%, transparent)' : 'var(--neutral-100)',
        boxShadow:       'inset 0 0 0 1px var(--neutral-200)',
        backdropFilter:  overlay ? 'blur(6px)' : undefined,
      }}
    >
      <m.span
        aria-hidden
        animate={pulsing ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
        transition={pulsing ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: color }}
      />
      {label}
    </span>
  )
}

// ── Opening a browser of your own ─────────────────────────────────────────────

const HOME_URL = 'https://www.google.com/'

/** What an address bar does with typed text: a URL as is, a bare host over https, anything else searched. */
export function toUrl(text: string): string {
  const typed = text.trim()
  if (!typed) return HOME_URL
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(typed)) return typed
  if (!/\s/.test(typed) && /\.[a-z]{2,}(?:[/:?#]|$)/i.test(typed)) return `https://${typed}`
  return `https://www.google.com/search?q=${encodeURIComponent(typed)}`
}

function OpenForm({ session, large }: { session: BrowserSession; large: boolean }) {
  const [text, setText] = useState('')
  return (
    <form
      onSubmit={event => { event.preventDefault(); void session.open(toUrl(text)) }}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: large ? 420 : 280 }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        <InputField fluid size="small" value={text} onChange={setText} placeholder="Search or enter a URL" aria-label="Search or enter a URL" />
        <Button type="submit" size="sm" disabled={session.opening}>Open</Button>
      </div>
      {session.openError && <p style={{ ...CAPTION, color: 'var(--red-400)' }}>{session.openError}</p>}
    </form>
  )
}

// ── Driving a tab of your own ─────────────────────────────────────────────────

// CDP modifier bits: Alt 1, Ctrl 2, Meta 4, Shift 8.
const modifiersOf = (event: { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) =>
  (event.altKey ? 1 : 0) | (event.ctrlKey ? 2 : 0) | (event.metaKey ? 4 : 0) | (event.shiftKey ? 8 : 0)
const MOUSE_BUTTONS = ['left', 'middle', 'right'] as const
// Windows virtual key codes for the keys Chrome only acts on when they carry one.
const VIRTUAL_KEYS: Record<string, number> = {
  Backspace: 8, Tab: 9, Enter: 13, Shift: 16, Control: 17, Alt: 18, Escape: 27, ' ': 32,
  PageUp: 33, PageDown: 34, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46,
}

/** Catches the pointer, wheel, keys, and pastes over the picture and sends them to the
 * browser in the picture's own coordinates. */
function ControlSurface({ send, screenRef }: { send: (input: BrowserInput) => void; screenRef: React.RefObject<HTMLVideoElement | null> }) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  // Pointer events carry no click count, and Chrome only fires a click when it is at least 1.
  const lastDown = useRef<{ at: number; x: number; y: number; count: number }>({ at: 0, x: 0, y: 0, count: 0 })
  const clickCountFor = (event: React.PointerEvent) => {
    const last = lastDown.current
    const repeat = event.timeStamp - last.at < 400 && Math.abs(event.clientX - last.x) < 6 && Math.abs(event.clientY - last.y) < 6
    const count = repeat ? last.count + 1 : 1
    lastDown.current = { at: event.timeStamp, x: event.clientX, y: event.clientY, count }
    return count
  }
  const pendingMove = useRef<{ x: number; y: number; modifiers: number; buttons: number } | null>(null)

  const pointAt = useCallback((event: { clientX: number; clientY: number }) => {
    const screen = screenRef.current
    if (!screen || !screen.videoWidth || !screen.videoHeight) return null
    const rect = screen.getBoundingClientRect()
    const scale = Math.min(rect.width / screen.videoWidth, rect.height / screen.videoHeight)
    const left = rect.left + (rect.width - screen.videoWidth * scale) / 2
    const top = rect.top + (rect.height - screen.videoHeight * scale) / 2
    return {
      x: Math.round(Math.min(screen.videoWidth, Math.max(0, (event.clientX - left) / scale))),
      y: Math.round(Math.min(screen.videoHeight, Math.max(0, (event.clientY - top) / scale))),
    }
  }, [screenRef])

  const mouse = (type: string, event: React.PointerEvent, extra: Record<string, unknown> = {}) => {
    const point = pointAt(event)
    if (point) send({ mouse: { type, ...point, modifiers: modifiersOf(event), buttons: event.buttons, ...extra } })
  }

  const key = (type: 'keyDown' | 'keyUp', event: React.KeyboardEvent) => {
    // Enter only submits when it carries a carriage return, as Chrome's own key handling sends it.
    const text = event.key === 'Enter' ? '\r' : event.key.length === 1 ? event.key : ''
    const typed = type === 'keyDown' && text !== '' && !event.ctrlKey && !event.metaKey
    const code = VIRTUAL_KEYS[event.key] ?? (event.key.length === 1 ? event.key.toUpperCase().charCodeAt(0) : 0)
    send({ key: {
      type: type === 'keyDown' && !typed ? 'rawKeyDown' : type,
      key: event.key, code: event.code, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
      modifiers: modifiersOf(event), autoRepeat: event.repeat,
      ...(typed ? { text, unmodifiedText: text } : {}),
    } })
  }

  // Wheel must be non-passive to keep the page behind the panel still.
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const point = pointAt(event)
      if (point) send({ mouse: { type: 'mouseWheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY, modifiers: modifiersOf(event) } })
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => surface.removeEventListener('wheel', onWheel)
  }, [pointAt, send])

  return (
    <div
      ref={surfaceRef}
      tabIndex={0}
      aria-label="Your browser. Click, type, and scroll here."
      onPointerDown={event => {
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        mouse('mousePressed', event, { button: MOUSE_BUTTONS[event.button] ?? 'none', clickCount: clickCountFor(event) })
      }}
      onPointerUp={event => mouse('mouseReleased', event, { button: MOUSE_BUTTONS[event.button] ?? 'none', clickCount: lastDown.current.count || 1 })}
      onPointerMove={event => {
        const point = pointAt(event)
        if (!point) return
        const first = pendingMove.current === null
        pendingMove.current = { ...point, modifiers: modifiersOf(event), buttons: event.buttons }
        if (first) requestAnimationFrame(() => {
          const move = pendingMove.current
          pendingMove.current = null
          if (move) send({ mouse: { type: 'mouseMoved', ...move, button: 'none' } })
        })
      }}
      onContextMenu={event => event.preventDefault()}
      onKeyDown={event => { if (event.key === 'Escape') return; event.preventDefault(); key('keyDown', event) }}
      onKeyUp={event => { if (event.key === 'Escape') return; event.preventDefault(); key('keyUp', event) }}
      onPaste={event => {
        event.preventDefault()
        const text = event.clipboardData.getData('text')
        if (text) send({ text })
      }}
      style={{ position: 'absolute', inset: 0, cursor: 'default', outline: 'none', touchAction: 'none' }}
    />
  )
}

// ── Non-live states ───────────────────────────────────────────────────────────

function StateMessage({ icon, title, body, action, large }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode; large: boolean }) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            large ? 12 : 8,
        padding:        16,
        textAlign:      'center',
      }}
    >
      <span style={{ color: 'var(--neutral-500)', display: 'inline-flex' }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: large ? 360 : 240 }}>
        <p style={{ ...BODY, fontWeight: 'var(--font-weight-medium)' }}>{title}</p>
        {body && <p style={CAPTION}>{body}</p>}
      </div>
      {action}
    </m.div>
  )
}

function Shimmer() {
  const reduceMotion = useReducedMotion()
  return (
    <m.div
      aria-hidden
      initial={{ backgroundPosition: '100% 0' }}
      animate={reduceMotion ? undefined : { backgroundPosition: ['100% 0', '-100% 0'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
      style={{
        position:       'absolute',
        inset:          0,
        backgroundImage: 'linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--neutral-white) 55%, transparent) 50%, transparent 70%)',
        backgroundSize: '200% 100%',
      }}
    />
  )
}

function ScreenBody({ session, large, onFrameSize, videoRef }: { session: BrowserSession; large: boolean; onFrameSize: (aspect: number) => void; videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const iconSize = large ? 28 : 22
  switch (session.status) {
    case 'live':
      return session.frame ? (
        <video
          ref={videoRef}
          src={session.frame}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={event => {
            const { videoWidth, videoHeight } = event.currentTarget
            if (videoWidth && videoHeight) onFrameSize(videoWidth / videoHeight)
            event.currentTarget.muted = true
            void event.currentTarget.play().catch(() => {})
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', objectFit: 'contain', pointerEvents: 'none', backgroundColor: 'var(--neutral-white)' }}
        />
      ) : null
    case 'connecting':
      return (
        <>
          <Shimmer />
          <StateMessage large={large} icon={<Spinner size={iconSize - 2} />} title="Starting the browser…" body={large ? 'The agent’s screen will appear here in a moment.' : undefined} />
        </>
      )
    case 'ended':
      return (
        <StateMessage
          large={large}
          icon={<AiWebBrowsingIcon size={iconSize} />}
          title="Browser session ended"
          body="The browser went to sleep. Open it again, or wait for the agent's next browser turn."
        />
      )
    case 'error':
      return (
        <StateMessage
          large={large}
          icon={<AlertCircleIcon size={iconSize} />}
          title="Couldn’t connect to the browser"
          body="The live view didn’t respond."
          action={<Button variant="secondary" size="sm" onClick={session.reconnect}>Try again</Button>}
        />
      )
    case 'idle':
    default:
      return (
        <StateMessage
          large={large}
          icon={<AiWebBrowsingIcon size={iconSize} />}
          title="No browser running"
          body="Your own Chrome, kept between chats. Sign in to a site here once and the agent is signed in too."
          action={<OpenForm session={session} large={large} />}
        />
      )
  }
}

// ── Full-screen header ────────────────────────────────────────────────────────

// ── Screen ────────────────────────────────────────────────────────────────────

/** Window size, tracked only while `active`. */
function useWindowSize(active: boolean) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    if (!active) return
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [active])
  return size
}

/** The largest screen of this aspect (plus header) that fits the window with a gutter, centred. */
function fullFrame({ w, h }: { w: number; h: number }, aspect: number) {
  const gutter = w < 640 ? 8 : 24
  const width = Math.max(0, Math.min(w - gutter * 2, (h - gutter * 2 - HEADER_H) * aspect))
  const height = width / aspect + HEADER_H
  return { top: (h - height) / 2, left: (w - width) / 2, width, height }
}

export interface BrowserScreenProps {
  session:          BrowserSession
  expanded:         boolean
  onExpandedChange: (expanded: boolean) => void
}

type Rect = { top: number; left: number; width: number; height: number }

export function BrowserScreen({ session, expanded, onExpandedChange }: BrowserScreenProps) {
  const reduceMotion = useReducedMotion()
  const slotRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)
  const windowSize = useWindowSize(expanded)
  const videoRef = useRef<HTMLVideoElement>(null)
  // The frame's own aspect, read from the first decoded frame, so nothing is letterboxed.
  const [aspect, setAspect] = useState(DEFAULT_ASPECT)
  // On minimize the card flies back still `position: fixed`, aimed at its slot. Docking it
  // straight away would put a still-large card inside the side panel, whose overflow clips
  // it for the whole flight. It docks once it lands.
  const [returnRect, setReturnRect] = useState<Rect | null>(null)
  const returnTimer = useRef<number | undefined>(undefined)
  const returning = !expanded && returnRect !== null
  const lifted = expanded || returning

  const canExpand = session.status === 'live' || session.status === 'connecting'
  // A tab of your own is driven in full screen; the thumbnail only watches.
  const driving = expanded && session.control && session.status === 'live'

  const dock = useCallback(() => {
    window.clearTimeout(returnTimer.current)
    setReturnRect(null)
    // The thumbnail's expand button unmounts while the card is out, so the focus trap
    // can't hand focus back to it — do it here, once it exists again.
    requestAnimationFrame(() => expandButtonRef.current?.focus({ preventScroll: true }))
  }, [])

  // Stable: useFocusTrap re-runs (and re-moves focus) whenever its onEscape changes.
  const collapse = useCallback(() => {
    const slot = slotRef.current?.getBoundingClientRect()
    onExpandedChange(false)
    if (!slot) return
    setReturnRect({ top: slot.top, left: slot.left, width: slot.width, height: slot.height })
    // Backstop in case the layout animation is skipped and never reports completion.
    window.clearTimeout(returnTimer.current)
    returnTimer.current = window.setTimeout(dock, 1000)
  }, [onExpandedChange, dock])

  const expand = () => {
    window.clearTimeout(returnTimer.current)
    setReturnRect(null)
    onExpandedChange(true)
  }

  useEffect(() => () => window.clearTimeout(returnTimer.current), [])

  // Esc minimizes; Tab stays inside the viewer.
  useFocusTrap(cardRef, expanded, collapse)

  const transition = reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 34, mass: 0.9 }
  const phase = expanded ? 'full' : returning ? 'returning' : 'docked'

  const THUMB_LOOK: React.CSSProperties = { borderRadius: 12, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--border-default)' }
  const cardPlacement: React.CSSProperties =
    phase === 'full'      ? { position: 'fixed', zIndex: Z_BACKDROP + 1, ...fullFrame(windowSize, aspect), borderRadius: 16, backgroundColor: 'var(--neutral-white)', boxShadow: '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)' }
    : phase === 'returning' ? { position: 'fixed', zIndex: Z_BACKDROP + 1, ...returnRect, ...THUMB_LOOK }
    : { position: 'absolute', inset: 0, ...THUMB_LOOK }

  return (
    <div ref={slotRef} style={{ position: 'relative', width: '100%', aspectRatio: `${aspect}` }}>
      {/* What stays in the panel while the screen is out — so the panel doesn't jump. */}
      {lifted && (
        <div
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            borderRadius:   12,
            border:         '1px dashed var(--neutral-300)',
          }}
        >
          <p style={CAPTION}>Showing in full screen</p>
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <m.div
            key="browser-backdrop"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            onClick={collapse}
            style={{
              position:        'fixed',
              inset:           0,
              zIndex:          Z_BACKDROP,
              backgroundColor: 'color-mix(in srgb, var(--yellow-950) 40%, transparent)',
              backdropFilter:  'blur(2px)',
            }}
          />
        )}
      </AnimatePresence>

      <m.div
        ref={cardRef}
        layout
        layoutDependency={phase}
        transition={transition}
        onLayoutAnimationComplete={() => { if (phase === 'returning') dock() }}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? 'Agent’s browser' : undefined}
        tabIndex={expanded ? -1 : undefined}
        style={{
          ...cardPlacement,
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
          outline:       'none',
        }}
      >
        {expanded && (
          <m.div
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.08 }}
            style={{ height: HEADER_H, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 0 14px' }}
          >
            <StatusPill status={session.status} />
            <div style={{ flex: '1 0 0' }} />
            {session.status === 'live' && !session.control && (
              <Tooltip content="You can watch the agent, but not click or type">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 10, ...CAPTION, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                  <ViewIcon size={16} />
                  View only
                </span>
              </Tooltip>
            )}
            {session.control && session.status === 'live' && (
              <Button variant="secondary" size="sm" onClick={session.close}>Close browser</Button>
            )}
            <Tooltip content="Minimize (Esc)">
              <IconButton variant="ghost" size="sm" icon={<ArrowShrinkTwoIcon size={20} />} aria-label="Minimize browser" onClick={collapse} />
            </Tooltip>
          </m.div>
        )}

        {/* The screen itself. `layout` keeps it from stretching while the card's aspect changes mid-flight. */}
        <m.div
          layout
          layoutDependency={phase}
          transition={transition}
          style={{
            position:        'relative',
            flex:            '1 1 0',
            minHeight:       0,
            backgroundColor: 'var(--neutral-100)',
          }}
        >
          <ScreenBody session={session} large={expanded} onFrameSize={setAspect} videoRef={videoRef} />
          {driving && <ControlSurface send={session.send} screenRef={videoRef} />}

          {/* What the agent is doing, over the page, in full screen. No exit animation:
              it would play mid-flight, stretched by the card's layout transform. */}
          {expanded && session.status === 'live' && session.currentAction && (
              <m.div
                key="action"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.15 }}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}
              >
                <span
                  style={{
                    ...BODY,
                    display:         'inline-flex',
                    alignItems:      'center',
                    gap:             8,
                    maxWidth:        '80%',
                    padding:         '6px 14px 6px 10px',
                    borderRadius:    999,
                    color:           'var(--neutral-900)',
                    backgroundColor: 'color-mix(in srgb, var(--neutral-white) 90%, transparent)',
                    backdropFilter:  'blur(8px)',
                    boxShadow:       '0px 2px 8px 0px rgba(26,23,20,0.16), 0px 0px 0px 1px rgba(59,54,50,0.10)',
                  }}
                >
                  <Spinner size={14} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.currentAction}</span>
                </span>
              </m.div>
          )}

          {/* Thumbnail chrome: the whole screen is the expand button. Only once docked —
              mid-flight it would be drawn stretched. */}
          {!lifted && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.15 }}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <div style={{ position: 'absolute', top: 8, left: 8 }}>
                {session.status !== 'idle' && <StatusPill status={session.status} overlay />}
              </div>
              {canExpand && <ExpandOverlay ref={expandButtonRef} onExpand={expand} />}
            </m.div>
          )}
        </m.div>
      </m.div>
    </div>
  )
}

function ExpandOverlay({ ref, onExpand }: { ref?: React.Ref<HTMLButtonElement>; onExpand: () => void }) {
  const [hot, setHot] = useState(false)
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Expand browser to full screen"
      onClick={onExpand}
      onPointerEnter={() => setHot(true)}
      onPointerLeave={() => setHot(false)}
      onFocus={event => setHot(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setHot(false)}
      style={{
        position:        'absolute',
        inset:           0,
        padding:         0,
        border:          0,
        borderRadius:    12,
        cursor:          'zoom-in',
        pointerEvents:   'auto',
        background:      hot ? 'color-mix(in srgb, var(--neutral-950) 6%, transparent)' : 'transparent',
        transition:      'background-color 150ms ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position:        'absolute',
          top:             8,
          right:           8,
          width:           28,
          height:          28,
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          borderRadius:    8,
          color:           'var(--neutral-800)',
          backgroundColor: 'color-mix(in srgb, var(--neutral-white) 88%, transparent)',
          backdropFilter:  'blur(6px)',
          boxShadow:       'inset 0 0 0 1px var(--neutral-200)',
          transform:       hot ? 'scale(1.06)' : 'scale(1)',
          transition:      'transform 150ms ease',
        }}
      >
        <ArrowExpandOneIcon size={16} />
      </span>
    </button>
  )
}
