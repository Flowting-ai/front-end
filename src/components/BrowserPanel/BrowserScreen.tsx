'use client'

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
  AiWebBrowsingIcon,
  AlertCircleIcon,
  ArrowExpandOneIcon,
  ArrowShrinkTwoIcon,
  CursorCircleSelectionTwoIcon,
  ViewIcon,
} from '@strange-huge/icons'
import { Button } from '@/components/Button'
import { IconButton } from '@/components/IconButton'
import { Spinner } from '@/components/Spinner'
import { Tooltip } from '@/components/Tooltip'
import { useFocusTrap } from '@/hooks/use-focus-trap'
import type { BrowserSession, BrowserSessionStatus } from './use-browser-session'

// The agent's screen. One element plays both roles — a thumbnail in the Context panel and a
// full-screen viewer — so going between them never remounts the live-view iframe (a remount
// would drop and re-open the stream). Expanding lifts the card to `position: fixed` and
// framer's layout animation flies it from its slot to the centre of the window and back.
// Nothing above the side panel sets a transform/filter, so the fixed card escapes the
// panel's overflow clipping and sits in the root stacking context.

/** The live view's native resolution; the page is drawn at this size and scaled to fit. */
const SCREEN_W = 1280
const SCREEN_H = 800
const ASPECT = SCREEN_W / SCREEN_H

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

// ── Scaled page ───────────────────────────────────────────────────────────────

/** Draws children at SCREEN_W×SCREEN_H and scales them to fit (contain) the box. */
function ScaledPage({ children }: { children: React.ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The page mounts at once (so the live view starts loading) but stays hidden until the
  // box is measured — unscaled, it would flash at full size.
  const scale = box ? Math.min(box.w / SCREEN_W, box.h / SCREEN_H) : 1
  return (
    <div ref={boxRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div
        style={{
          position:        'absolute',
          width:           SCREEN_W,
          height:          SCREEN_H,
          left:            box ? (box.w - SCREEN_W * scale) / 2 : 0,
          top:             box ? (box.h - SCREEN_H * scale) / 2 : 0,
          transform:       `scale(${scale})`,
          transformOrigin: '0 0',
          visibility:      box ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
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

function ScreenBody({ session, large, controlling }: { session: BrowserSession; large: boolean; controlling: boolean }) {
  const iconSize = large ? 28 : 22
  switch (session.status) {
    case 'live': {
      const url = session.liveView?.url
      return (
        <ScaledPage>
          {url ? (
            <iframe
              src={url}
              title="Agent's browser, live"
              referrerPolicy="no-referrer"
              allow="clipboard-read; clipboard-write"
              tabIndex={controlling ? 0 : -1}
              style={{ width: '100%', height: '100%', border: 0, display: 'block', pointerEvents: controlling ? 'auto' : 'none', backgroundColor: 'var(--neutral-white)' }}
            />
          ) : null}
        </ScaledPage>
      )
    }
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
          body="It went to sleep after the agent finished. Resume to keep watching."
          action={<Button variant="secondary" size="sm" onClick={session.reconnect}>Resume</Button>}
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
          body="When the agent opens a web page, you can watch it work here, live."
        />
      )
  }
}

// ── Full-screen header ────────────────────────────────────────────────────────

function displayUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function AddressBar({ url }: { url: string | undefined }) {
  const shown = displayUrl(url)
  return (
    <div
      title={url}
      style={{
        flex:            '1 1 auto',
        minWidth:        0,
        maxWidth:        560,
        height:          32,
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '0 12px',
        borderRadius:    10,
        backgroundColor: 'var(--neutral-100)',
        boxShadow:       'inset 0 0 0 1px var(--neutral-200)',
        color:           shown ? 'var(--neutral-700)' : 'var(--neutral-500)',
      }}
    >
      <AiWebBrowsingIcon size={16} style={{ flexShrink: 0, color: 'var(--neutral-500)' }} />
      <span style={{ ...BODY, color: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {shown ?? 'No page open'}
      </span>
    </div>
  )
}

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

/** The largest 16:10 screen (plus header) that fits the window with a gutter, centred. */
function fullFrame({ w, h }: { w: number; h: number }) {
  const gutter = w < 640 ? 8 : 24
  const width = Math.max(0, Math.min(w - gutter * 2, (h - gutter * 2 - HEADER_H) * ASPECT))
  const height = width / ASPECT + HEADER_H
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
  // Control is taken of one specific live view. Leaving full screen hands it back, and a
  // view that ends or turns view-only can't be driven — nor can the next one, until asked.
  const [controlledUrl, setControlledUrl] = useState<string | null>(null)
  // On minimize the card flies back still `position: fixed`, aimed at its slot. Docking it
  // straight away would put a still-large card inside the side panel, whose overflow clips
  // it for the whole flight. It docks once it lands.
  const [returnRect, setReturnRect] = useState<Rect | null>(null)
  const returnTimer = useRef<number | undefined>(undefined)
  const returning = !expanded && returnRect !== null
  const lifted = expanded || returning

  const canExpand = session.status === 'live' || session.status === 'connecting'
  const canControl = session.status === 'live' && session.liveView !== null && !session.liveView.viewOnly
  const controlling = expanded && canControl && controlledUrl === session.liveView?.url

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
    setControlledUrl(null)
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

  const THUMB_LOOK: React.CSSProperties = { borderRadius: 12, backgroundColor: 'var(--neutral-100)', boxShadow: 'inset 0 0 0 1px var(--neutral-200)' }
  const cardPlacement: React.CSSProperties =
    phase === 'full'      ? { position: 'fixed', zIndex: Z_BACKDROP + 1, ...fullFrame(windowSize), borderRadius: 16, backgroundColor: 'var(--neutral-white)', boxShadow: '0px 8px 32px 0px rgba(26,23,20,0.24), 0px 0px 0px 1px rgba(59,54,50,0.12)' }
    : phase === 'returning' ? { position: 'fixed', zIndex: Z_BACKDROP + 1, ...returnRect, ...THUMB_LOOK }
    : { position: 'absolute', inset: 0, ...THUMB_LOOK }

  return (
    <div ref={slotRef} style={{ position: 'relative', width: '100%', aspectRatio: `${SCREEN_W} / ${SCREEN_H}` }}>
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
            <AddressBar url={session.pageUrl} />
            <div style={{ flex: '1 0 0' }} />
            {session.status === 'live' && session.liveView?.viewOnly && (
              <Tooltip content="You can watch the agent, but not click or type">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 10, ...CAPTION, color: 'var(--neutral-600)', whiteSpace: 'nowrap' }}>
                  <ViewIcon size={16} />
                  View only
                </span>
              </Tooltip>
            )}
            {canControl && (
              <Button
                variant={controlling ? 'default' : 'secondary'}
                size="sm"
                leftIcon={<CursorCircleSelectionTwoIcon />}
                onClick={() => setControlledUrl(controlling ? null : session.liveView?.url ?? null)}
                aria-pressed={controlling}
              >
                {controlling ? 'Hand back' : 'Take control'}
              </Button>
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
          <ScreenBody session={session} large={expanded} controlling={controlling} />

          {/* What the agent is doing, over the page, in full screen. No exit animation:
              it would play mid-flight, stretched by the card's layout transform. */}
          {expanded && session.status === 'live' && session.currentAction && !controlling && (
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

          {/* The control ring is its own element: a boxShadow on the `layout` element above
              would be kept alive by framer's projection after `controlling` turns off. */}
          {controlling && (
            <div aria-hidden style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 2px var(--blue-500)', pointerEvents: 'none' }} />
          )}
          {controlling && (
            <span style={{ ...CAPTION, position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', padding: '4px 10px', borderRadius: 999, color: 'var(--neutral-white)', backgroundColor: 'var(--blue-500)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              You’re controlling the browser
            </span>
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
