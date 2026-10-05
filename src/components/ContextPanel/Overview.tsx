'use client'

import React, { useEffect, useId, useMemo, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
  AlertCircleIcon,
  ArrowDownOneIcon,
  BubbleChatIcon,
  DownloadOneIcon,
  FileTwoIcon,
  ImageTwoIcon,
  ShapesOneIcon,
  StopCircleIcon,
  TickTwoIcon,
} from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'
import { Tooltip } from '@/components/Tooltip'
import { useChatContext, turnTiming, type TurnTiming } from '@/lib/chat-context-store'
import { ACTIVITY_VERB } from '@/lib/activity'
import { toConnector } from '@/lib/connector'
import type { ActivityItem, ActivityStatus, PlanItem, UIMessage } from '@/types/chat'
import { AgentFace, ConnectorLogo, connectorSpecialistSlug, useConnectorIdentities } from './identity'

// The Context panel's overview: one card of collapsible sections — what the latest turn
// is doing, and the agents, connectors, sources, documents and skills the chat has used.
// Everything comes from the activity the chat already streams (see use-streaming-chat),
// so it reflects this session's turns; a chat reloaded from history shows what its saved
// messages carry (sources, files) but no tool activity until it runs again.

// ── Derivations ───────────────────────────────────────────────────────────────

const RUNNING: ReadonlySet<ActivityStatus> = new Set(['start', 'executing', 'reading'])
export const isRunning = (activity: { status: ActivityStatus }) => RUNNING.has(activity.status)

export type TurnState = 'idle' | 'working' | 'done' | 'stopped' | 'error'

export function turnState(message: UIMessage | undefined): TurnState {
  if (!message) return 'idle'
  if (message.isLoading) return 'working'
  if (message.stoppedByUser) return 'stopped'
  if (message.isError) return 'error'
  return 'done'
}

/** The turn's status pill: its word, the tint behind it, and its mark's colour. */
const STATUS: Record<Exclude<TurnState, 'idle'>, { label: string; tint: string; color: string }> = {
  working: { label: 'Working', tint: 'color-mix(in srgb, var(--blue-500) 14%, transparent)',  color: 'var(--blue-500)' },
  done:    { label: 'Done',    tint: 'color-mix(in srgb, var(--green-500) 16%, transparent)', color: 'var(--green-500)' },
  stopped: { label: 'Stopped', tint: 'var(--neutral-200)',                                     color: 'var(--neutral-500)' },
  error:   { label: 'Failed',  tint: 'color-mix(in srgb, var(--red-400) 14%, transparent)',   color: 'var(--red-400)' },
}

// A connector tool is a lower-cased tool slug prefixed with its connector, e.g.
// `gmail-send-email`. Built-in tools (`read_url`, `web_search`, …) are snake_case, so a hyphen
// is what separates the two. Returns the connector's slug, or null for a built-in.
function connectorSlugOf(activity: ActivityItem): string | null {
  const tool = activity.toolName?.trim().toLowerCase()
  if (!tool || !tool.includes('-')) return null
  return tool.split('-')[0]
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/**
 * How long the turn has run, ticking while it works and holding its final time after —
 * until a new turn (or another chat) takes over the panel. Null when this tab never saw
 * the turn run, e.g. a chat opened from history.
 */
function useExecutionSeconds(timing: TurnTiming | undefined, working: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!working) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [working])
  if (!timing) return null
  const end = timing.finishedAt ?? (working ? now : undefined)
  return end === undefined ? null : Math.max(0, Math.round((end - timing.startedAt) / 1000))
}

function domainOf(url: string | undefined): string {
  if (!url) return ''
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const sourceKey = (url: string) => url.replace(/[#?].*$/, '').replace(/\/$/, '').toLowerCase()

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,6})$/i.exec(name)
  return match ? match[1].toUpperCase() : ''
}

export function downloadFile(url: string, filename: string) {
  // Proxied so the browser always saves instead of navigating (see /api/download).
  const anchor = document.createElement('a')
  anchor.href = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export interface SourceItem { key: string; url: string; title: string; domain: string }
export interface DocumentItem { key: string; url: string; name: string; kind: 'created' | 'uploaded'; image: boolean }

// ── Typography ────────────────────────────────────────────────────────────────

const TEXT: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-body)',
  lineHeight: 'var(--line-height-body)',
  color:      'var(--neutral-800)',
}

const CAPTION: React.CSSProperties = {
  margin:     0,
  fontFamily: 'var(--font-body)',
  fontSize:   'var(--font-size-caption)',
  lineHeight: 'var(--line-height-caption)',
  color:      'var(--neutral-500)',
}

const ONE_LINE: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }

const TWO_LINES: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }

// ── Building blocks ───────────────────────────────────────────────────────────

/** The one card every section sits in, divided by hairlines. */
export function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:         'flex',
        flexDirection:   'column',
        borderRadius:    16,
        backgroundColor: 'var(--neutral-100)',
        boxShadow:       'inset 0 0 0 1px var(--neutral-200)',
        overflow:        'hidden',
      }}
    >
      {children}
    </div>
  )
}

const EASE = [0.32, 0.72, 0, 1] as const

export function PanelSection({
  title,
  count,
  aside,
  action,
  open,
  onToggle,
  first,
  loading,
  children,
}: {
  title:    string
  count?:   number
  /** Shown in the header, so it stays visible while the section is collapsed. */
  aside?:   React.ReactNode
  /** A header control of its own, e.g. "Download all". */
  action?:  React.ReactNode
  open:     boolean
  onToggle: () => void
  first?:   boolean
  /** Sweep a hairline along the header's bottom edge — visible open or collapsed. */
  loading?: boolean
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const bodyId = useId()
  // A body already open on first paint appears in place; every later open slides. This is
  // per element on purpose — AnimatePresence initial={false} would also block the mount
  // animation of everything inside the body for its whole life, freezing spinners and the
  // progress sweep.
  const [animateEntry, setAnimateEntry] = useState(!open)
  const toggle = () => {
    setAnimateEntry(true)
    onToggle()
  }
  return (
    <section style={{ borderTop: first ? undefined : '1px solid var(--neutral-200)' }}>
      {/* The toggle covers the whole header; the visible pieces sit over it, inert, so only
          `action` is a separate target. */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 10px 0 14px' }}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggle}
          className="bg-transparent hover:bg-[color-mix(in_srgb,var(--neutral-200)_50%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue-500)]"
          style={{ position: 'absolute', inset: 0, border: 0, padding: 0, margin: 0, cursor: 'pointer', transition: 'background-color 150ms ease' }}
        >
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{title}</span>
        </button>
        <h3 aria-hidden style={{ ...TEXT, color: 'var(--neutral-600)', pointerEvents: 'none', position: 'relative' }}>{title}</h3>
        {count !== undefined && count > 0 && (
          <span aria-hidden style={{ ...CAPTION, position: 'relative', pointerEvents: 'none', minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-600)' }}>
            {count}
          </span>
        )}
        <div style={{ flex: '1 1 0' }} />
        {aside && <span style={{ ...CAPTION, position: 'relative', pointerEvents: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{aside}</span>}
        {action && <span style={{ position: 'relative', display: 'inline-flex' }}>{action}</span>}
        <m.span
          aria-hidden
          initial={false}
          animate={{ rotate: open ? 0 : -90 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: EASE }}
          style={{ position: 'relative', pointerEvents: 'none', display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-500)' }}
        >
          <ArrowDownOneIcon size={16} />
        </m.span>
        {loading && <LoadingLine />}
      </div>

      <AnimatePresence>
        {open && (
          <m.div
            key="body"
            id={bodyId}
            initial={animateEntry ? { height: 0, opacity: 0 } : false}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { height: { duration: 0.28, ease: EASE }, opacity: { duration: 0.18 } }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px 10px' }}>
              {children}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}

const ROW_CLASS = 'bg-transparent hover:bg-[var(--neutral-200)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--blue-500)]'

/** One line item. A link when given `href`, a button when given `onClick`. */
export function ItemRow({
  icon,
  label,
  detail,
  right,
  href,
  onClick,
  labelStyle,
  wrap,
}: {
  icon:        React.ReactNode
  label:       React.ReactNode
  detail?:     string
  right?:      React.ReactNode
  href?:       string
  onClick?:    () => void
  labelStyle?: React.CSSProperties
  /** Let the label run to two lines instead of one. */
  wrap?:       boolean
}) {
  const body = (
    <>
      <span aria-hidden style={{ minWidth: 20, minHeight: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--neutral-500)' }}>
        {icon}
      </span>
      <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ ...TEXT, ...(wrap ? TWO_LINES : ONE_LINE), ...labelStyle }}>{label}</span>
        {detail && <span style={{ ...CAPTION, ...ONE_LINE }}>{detail}</span>}
      </span>
      {right && <span style={{ ...CAPTION, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>{right}</span>}
    </>
  )
  const style: React.CSSProperties = {
    display:        'flex',
    alignItems:     wrap ? 'flex-start' : 'center',
    gap:            10,
    width:          '100%',
    minWidth:       0,
    padding:        '6px 6px',
    borderRadius:   8,
    border:         0,
    textAlign:      'left',
    textDecoration: 'none',
    color:          'inherit',
    transition:     'background-color 150ms ease',
  }
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={`group ${ROW_CLASS}`} style={style}>{body}</a>
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={`group ${ROW_CLASS}`} style={{ ...style, cursor: 'pointer' }}>{body}</button>
  }
  return <div style={style}>{body}</div>
}

/** Rows that slide in as they arrive. Rows present on first paint don't animate — decided
 *  per row, not with AnimatePresence initial={false} (see PanelSection for why). */
export function AnimatedList({ children }: { children: React.ReactNode[] }) {
  const reduceMotion = useReducedMotion()
  const [firstKeys] = useState(() => new Set<React.Key | null>(React.Children.map(children, child => (React.isValidElement(child) ? child.key : null))))
  return (
    <AnimatePresence>
      {React.Children.map(children, child => {
        if (!React.isValidElement(child)) return child
        return (
          <m.div
            key={child.key}
            initial={firstKeys.has(child.key) ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EASE }}
          >
            {child}
          </m.div>
        )
      })}
    </AnimatePresence>
  )
}

export const EmptyHint = ({ children }: { children: React.ReactNode }) => (
  <p style={{ ...CAPTION, padding: '4px 6px 2px' }}>{children}</p>
)

function MoreButton({ hidden, expanded, onClick, noun }: { hidden: number; expanded: boolean; onClick: () => void; noun: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={ROW_CLASS}
      style={{ ...CAPTION, alignSelf: 'flex-start', marginTop: 2, padding: '4px 6px', border: 0, borderRadius: 6, cursor: 'pointer', color: 'var(--neutral-600)' }}
    >
      {expanded ? 'Show less' : `Show ${hidden} ${noun}`}
    </button>
  )
}

/** A row's right edge: a spinner while running, the outcome when it didn't finish, else `done`. */
function statusAside(activity: { status: ActivityStatus }, done?: React.ReactNode): React.ReactNode {
  if (RUNNING.has(activity.status)) return <Spinner size={12} color="var(--blue-500)" />
  if (activity.status === 'error') return <span style={{ color: 'var(--red-400)' }}>Failed</span>
  if (activity.status === 'stopped') return 'Stopped'
  return done
}

export function StepIcon({ status }: { status: ActivityStatus }) {
  if (RUNNING.has(status)) return <Spinner size={14} color="var(--blue-500)" />
  if (status === 'error') return <AlertCircleIcon size={16} color="var(--red-400)" />
  if (status === 'stopped') return <StopCircleIcon size={16} color="var(--neutral-400)" />
  return <PopIn status={status}><TickTwoIcon size={16} color="var(--green-500)" /></PopIn>
}

/** A step's mark that pops in when its status changes while watched — not on first paint. */
function PopIn({ status, children }: { status: string; children: React.ReactNode }) {
  const reduceMotion = useReducedMotion()
  const [firstStatus] = useState(status)
  return (
    <m.span
      key={status}
      initial={status === firstStatus || reduceMotion ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      style={{ display: 'inline-flex' }}
    >
      {children}
    </m.span>
  )
}

/** A plan step's mark: a hollow ring waiting, a spinner working, a check or alert after. */
function PlanMark({ status }: { status: PlanItem['status'] }) {
  if (status === 'pending') {
    return <span style={{ width: 13, height: 13, borderRadius: 999, boxShadow: 'inset 0 0 0 1.5px var(--neutral-300)', display: 'inline-block' }} />
  }
  if (status === 'in_progress') return <Spinner size={14} color="var(--blue-500)" />
  return (
    <PopIn status={status}>
      {status === 'failed' ? <AlertCircleIcon size={16} color="var(--red-400)" /> : <TickTwoIcon size={16} color="var(--green-500)" />}
    </PopIn>
  )
}

// A waiting step is faded as a whole row (see PlanList), so its label keeps the done colour.
const PLAN_LABEL: Record<PlanItem['status'], React.CSSProperties> = {
  pending:     { color: 'var(--neutral-700)' },
  in_progress: { color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-medium)' },
  completed:   { color: 'var(--neutral-700)' },
  failed:      { color: 'var(--neutral-800)' },
}

/** No strikethrough: a finished step simply settles back, the running one leads. */
export function stepLabelStyle(status: ActivityStatus): React.CSSProperties {
  if (RUNNING.has(status)) return { color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-medium)' }
  if (status === 'error') return { color: 'var(--neutral-800)' }
  return { color: 'var(--neutral-600)' }
}

function stepText(activity: ActivityItem): { label: string; detail?: string } {
  const label = activity.label || ACTIVITY_VERB[activity.type] || 'Working'
  const detail = RUNNING.has(activity.status) && activity.progressMessage ? activity.progressMessage : activity.detail
  // The stream often sends one string as both label and detail, sometimes re-cased.
  return { label, detail: detail && detail.trim().toLowerCase() !== label.trim().toLowerCase() ? detail : undefined }
}

// ── Progress ──────────────────────────────────────────────────────────────────

// The backend streams no upfront plan — a step exists only once it starts — so there is no
// total to fill a bar towards. Status lives in the header instead (a pill that stays visible
// when collapsed, plus a hairline loading sweep while working); the body is just the steps.

/** Finished / total: plan steps when there is a plan, else tool steps. Null with none. */
export function stepCount(steps: ActivityItem[], plan: PlanItem[] | null): { done: number; total: number } | null {
  if (plan) return { done: plan.filter(item => item.status === 'completed').length, total: plan.length }
  if (steps.length === 0) return null
  return { done: steps.filter(step => step.status === 'done').length, total: steps.length }
}

/** The header's status: what the turn is doing, how far along, and for how long. */
function TurnStatus({ state, seconds, count }: { state: TurnState; seconds: number | null; count: { done: number; total: number } | null }) {
  if (state === 'idle') return null
  const { label, tint, color } = STATUS[state]
  const mark =
    state === 'working' ? <Spinner size={11} color={color} />
    : state === 'done' ? <TickTwoIcon size={12} color={color} />
    : state === 'error' ? <AlertCircleIcon size={12} color={color} />
    : <StopCircleIcon size={12} color={color} />
  return (
    <span
      role="status"
      style={{
        display:         'inline-flex',
        alignItems:      'center',
        gap:             5,
        height:          22,
        padding:         '0 8px 0 7px',
        borderRadius:    999,
        backgroundColor: tint,
        color:           'var(--neutral-700)',
        fontWeight:      'var(--font-weight-medium)',
      }}
    >
      {mark}
      {label}
      {count && (
        <span aria-label={`${count.done} of ${count.total} steps done`} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {count.done}/{count.total}
        </span>
      )}
      {seconds !== null && (
        <span style={{ color: 'var(--neutral-500)', fontWeight: 'var(--font-weight-regular)', fontVariantNumeric: 'tabular-nums' }}>
          · {formatElapsed(seconds)}
        </span>
      )}
    </span>
  )
}

/** A hairline sweep along a section header's bottom edge — "this is still loading". */
function LoadingLine() {
  const reduceMotion = useReducedMotion()
  return (
    <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* x is a share of the segment's own width (30% of the line): -100% starts it just off
          the left edge, 334% just off the right. A transform, not `left`, which framer won't
          sweep between percentage keyframes. */}
      <m.span
        initial={{ x: reduceMotion ? '0%' : '-100%' }}
        animate={reduceMotion ? { x: '0%' } : { x: ['-100%', '334%'] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position:        'absolute',
          top:             0,
          bottom:          0,
          left:            0,
          width:           '30%',
          borderRadius:    2,
          backgroundImage: 'linear-gradient(90deg, transparent, var(--blue-500), transparent)',
          opacity:         reduceMotion ? 0.5 : 0.9,
        }}
      />
    </span>
  )
}

/** The running step's label: a soft highlight sweeping across the text. */
function Shimmer({ children }: { children: string }) {
  const reduceMotion = useReducedMotion()
  if (reduceMotion) return <>{children}</>
  return (
    <m.span
      initial={{ backgroundPosition: '100% 0' }}
      animate={{ backgroundPosition: ['100% 0', '0% 0'] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
      style={{
        backgroundImage:      'linear-gradient(90deg, var(--neutral-900) 0%, var(--neutral-900) 40%, var(--neutral-400) 50%, var(--neutral-900) 60%, var(--neutral-900) 100%)',
        backgroundSize:       '250% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip:       'text',
        color:                'transparent',
      }}
    >
      {children}
    </m.span>
  )
}

/** What the body says when the turn ran no steps — one row, in the same shape as a step. */
const NO_STEPS: Record<Exclude<TurnState, 'idle' | 'working'>, { icon: React.ReactNode; text: string }> = {
  done:    { icon: <BubbleChatIcon size={16} />, text: 'Answered directly — no tools needed' },
  stopped: { icon: <StopCircleIcon size={16} color="var(--neutral-400)" />, text: 'Stopped before any steps ran' },
  error:   { icon: <AlertCircleIcon size={16} color="var(--red-400)" />, text: 'Something went wrong before any steps ran' },
}

/** The plan card: every step from the start, each loading then ticking off in place. */
function PlanList({ plan, steps }: { plan: PlanItem[]; steps: ActivityItem[] }) {
  // What the agent is doing right now gives the current step its live detail line.
  const live = steps.findLast(isRunning)
  const liveText = live ? stepText(live) : null
  const reduceMotion = useReducedMotion()
  return (
    // The plan arrives whole: one soft fade for the list, never row by row.
    <m.ol
      aria-label="Plan"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {plan.map(item => {
        const current = item.status === 'in_progress'
        const detail = item.detail ?? (current && liveText ? liveText.label : undefined)
        return (
          <li
            key={item.id}
            aria-current={current ? 'step' : undefined}
            // Waiting steps sit faded and brighten as their turn comes.
            style={{ opacity: item.status === 'pending' ? 0.45 : 1, transition: reduceMotion ? undefined : 'opacity 320ms ease' }}
          >
            <ItemRow
              wrap
              icon={<PlanMark status={item.status} />}
              label={current ? <Shimmer>{item.title}</Shimmer> : item.title}
              detail={detail}
              labelStyle={PLAN_LABEL[item.status]}
            />
          </li>
        )
      })}
    </m.ol>
  )
}

function ProgressBody({ state, steps, plan }: { state: TurnState; steps: ActivityItem[]; plan: PlanItem[] | null }) {
  if (plan) return <PlanList plan={plan} steps={steps} />
  if (steps.length === 0) {
    if (state === 'working') {
      return <ItemRow icon={<Spinner size={14} color="var(--blue-500)" />} label={<Shimmer>Thinking…</Shimmer>} labelStyle={stepLabelStyle('executing')} />
    }
    if (state === 'idle') return null
    const { icon, text } = NO_STEPS[state]
    return <ItemRow icon={icon} label={text} labelStyle={{ color: 'var(--neutral-600)' }} />
  }

  return (
    <>
      <AnimatedList>
        {steps.map(step => {
          const { label, detail } = stepText(step)
          return (
            <ItemRow
              key={step.id}
              wrap
              icon={<StepIcon status={step.status} />}
              label={isRunning(step) ? <Shimmer>{label}</Shimmer> : label}
              detail={detail}
              labelStyle={stepLabelStyle(step.status)}
            />
          )
        })}
      </AnimatedList>
    </>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────

type SectionKey = 'progress' | 'agents' | 'connectors' | 'sources' | 'documents' | 'skills'

const VISIBLE_ITEMS = 6

/** Collapsed/expanded per list, without each list keeping its own state shape. */
function useShowAll() {
  const [all, setAll] = useState<Partial<Record<SectionKey, boolean>>>({})
  return {
    limit: <T,>(key: SectionKey, items: T[]) => (all[key] ? items : items.slice(0, VISIBLE_ITEMS)),
    more:  (key: SectionKey, items: unknown[], noun: string) => items.length > VISIBLE_ITEMS && (
      <MoreButton hidden={items.length - VISIBLE_ITEMS} expanded={!!all[key]} noun={`more ${items.length - VISIBLE_ITEMS === 1 ? noun.replace(/s$/, '') : noun}`} onClick={() => setAll(current => ({ ...current, [key]: !current[key] }))} />
    ),
  }
}

export interface OverviewData {
  latest:     UIMessage | undefined
  /** The latest turn's activity, in order. */
  steps:      ActivityItem[]
  /** The latest turn's plan, when the backend sent one. */
  plan:       PlanItem[] | null
  agents:     ActivityItem[]
  connectors: { slug: string; name: string; used: number; active: boolean; failed: boolean }[]
  sources:    SourceItem[]
  documents:  DocumentItem[]
  skills:     { name: string; activity: ActivityItem }[]
}

/** Everything the overview lists, from the chat's messages. Pure, so it can be tested. */
export function deriveOverview(messages: UIMessage[]): OverviewData {
    const assistant = messages.filter(message => message.role === 'assistant')
    const latest = assistant[assistant.length - 1]
    const all = assistant.flatMap(message => message.activities ?? [])

    const connectorMap = new Map<string, { slug: string; name: string; used: number; active: boolean; failed: boolean }>()
    for (const activity of all) {
      const slug = connectorSlugOf(activity)
      if (!slug) continue
      const entry = connectorMap.get(slug) ?? { slug, name: toConnector(slug).name, used: 0, active: false, failed: false }
      entry.used += 1
      entry.active ||= isRunning(activity)
      entry.failed ||= activity.status === 'error'
      connectorMap.set(slug, entry)
    }

    // Newest first: while a turn runs, what it just read is what's worth seeing.
    const sources = new Map<string, SourceItem>()
    const addSource = (url: string | undefined, title: string | undefined) => {
      if (!url || !/^https?:\/\//i.test(url)) return
      const key = sourceKey(url)
      if (sources.has(key)) return
      sources.set(key, { key, url, title: title?.trim() || domainOf(url) || url, domain: domainOf(url) })
    }
    for (const message of [...assistant].reverse()) {
      for (const citation of message.webCitations ?? []) addSource(citation.url, citation.title)
      for (const source of message.sources ?? []) addSource(source.url, source.title)
      for (const activity of [...(message.activities ?? [])].reverse()) {
        if (activity.type === 'web-search') for (const result of activity.results ?? []) addSource(result.url, result.title)
      }
    }

    const documents: DocumentItem[] = []
    for (const message of [...messages].reverse()) {
      if (message.role === 'assistant') {
        for (const file of message.generatedFiles ?? []) {
          documents.push({ key: `g:${file.url}`, url: file.url, name: file.filename, kind: 'created', image: !!file.mimeType?.startsWith('image/') })
        }
        ;(message.images ?? []).forEach((image, index) => {
          documents.push({ key: `i:${image.url}`, url: image.url, name: `Image ${index + 1}.png`, kind: 'created', image: true })
        })
      } else if (message.role === 'user') {
        for (const file of message.attachments ?? []) {
          if (!file.url || file.uploading) continue
          documents.push({ key: `u:${file.id}`, url: file.url, name: file.file_name, kind: 'uploaded', image: file.file_type.startsWith('image/') })
        }
      }
    }

    const skills = new Map<string, ActivityItem>()
    for (const activity of all.filter(item => item.type === 'skills')) {
      skills.set(activity.label || activity.detail || activity.id, activity)
    }

    return {
      latest,
      steps:      latest?.activities ?? [],
      plan:       latest?.plan ?? null,
      agents:     all.filter(activity => activity.type === 'agent'),
      connectors: [...connectorMap.values()],
      sources:    [...sources.values()],
      documents,
      skills:     [...skills.entries()].map(([name, activity]) => ({ name, activity })),
    }
}

/** The overview for the open chat. */
export function OverviewTab() {
  const { messages } = useChatContext()
  const latest = messages.filter(message => message.role === 'assistant').at(-1)
  return <OverviewView messages={messages} timing={turnTiming(latest)} />
}

export function OverviewView({ messages, timing }: { messages: UIMessage[]; timing: TurnTiming | undefined }) {
  const showAll = useShowAll()
  const data = useMemo(() => deriveOverview(messages), [messages])

  const state = turnState(data.latest)
  const seconds = useExecutionSeconds(timing, state === 'working')

  // Catalog names + logos for every app used, and for connector-specialist agents.
  const identities = useConnectorIdentities([
    ...data.connectors.map(connector => connector.slug),
    ...data.agents.flatMap(agent => connectorSpecialistSlug(agent.agentHandle) ?? []),
  ])

  const counts: Record<SectionKey, number> = {
    progress:   data.steps.length,
    agents:     data.agents.length,
    connectors: data.connectors.length,
    sources:    data.sources.length,
    documents:  data.documents.length,
    skills:     data.skills.length,
  }

  // A section opens on its own once it has something in it; after the viewer toggles it,
  // their choice sticks.
  const [toggled, setToggled] = useState<Partial<Record<SectionKey, boolean>>>({})
  const isOpen = (key: SectionKey) => toggled[key] ?? (key === 'progress' || counts[key] > 0)
  const section = (key: SectionKey) => ({
    open:     isOpen(key),
    onToggle: () => setToggled(current => ({ ...current, [key]: !isOpen(key) })),
  })

  if (messages.length === 0) {
    return (
      <PanelCard>
        <p style={{ ...TEXT, color: 'var(--neutral-500)', padding: 14 }}>
          Nothing here yet. Progress, agents, connectors, sources and documents for this chat show up as soon as it starts working.
        </p>
      </PanelCard>
    )
  }

  const downloadable = data.documents.filter(doc => doc.kind === 'created')

  return (
    <PanelCard>
      <PanelSection
        first
        title="Progress"
        aside={<TurnStatus state={state} seconds={seconds} count={stepCount(data.steps, data.plan)} />}
        loading={state === 'working'}
        {...section('progress')}
      >
        <ProgressBody state={state} steps={data.steps} plan={data.plan} />
      </PanelSection>

      <PanelSection title="Agents" count={counts.agents} {...section('agents')}>
        {data.agents.length === 0 ? <EmptyHint>No agents were asked to help.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('agents', data.agents).map(agent => (
              <ItemRow
                key={agent.id}
                icon={<AgentFace name={agent.label || 'Agent'} handle={agent.agentHandle} connector={identities.get(connectorSpecialistSlug(agent.agentHandle) ?? '')} />}
                label={agent.label || 'Agent'}
                detail={agent.detail !== agent.label ? agent.detail : undefined}
                right={statusAside(agent, agent.durationS ? formatElapsed(Math.round(agent.durationS)) : undefined)}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('agents', data.agents, 'agents')}
      </PanelSection>

      <PanelSection title="Connectors" count={counts.connectors} {...section('connectors')}>
        {data.connectors.length === 0 ? <EmptyHint>No connected apps were used.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('connectors', data.connectors).map(connector => (
              <ItemRow
                key={connector.slug}
                icon={<ConnectorLogo connector={identities.get(connector.slug) ?? toConnector(connector.slug)} />}
                label={identities.get(connector.slug)?.name ?? connector.name}
                right={connector.active ? <Spinner size={12} color="var(--blue-500)" />
                  : connector.failed ? <span style={{ color: 'var(--red-400)' }}>Failed</span>
                  : connector.used > 1 ? `${connector.used} calls` : '1 call'}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('connectors', data.connectors, 'connectors')}
      </PanelSection>

      <PanelSection title="Sources" count={counts.sources} {...section('sources')}>
        {data.sources.length === 0 ? <EmptyHint>No web pages were read.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('sources', data.sources).map(source => (
              <ItemRow key={source.key} href={source.url} icon={<Favicon domain={source.domain} />} label={source.title} detail={source.domain} />
            ))}
          </AnimatedList>
        )}
        {showAll.more('sources', data.sources, 'sources')}
      </PanelSection>

      <PanelSection
        title="Documents"
        count={counts.documents}
        action={downloadable.length > 1 && (
          <Tooltip content={`Download all ${downloadable.length}`}>
            <button
              type="button"
              aria-label={`Download all ${downloadable.length} documents`}
              onClick={() => downloadable.forEach((doc, index) => window.setTimeout(() => downloadFile(doc.url, doc.name), index * 250))}
              className={ROW_CLASS}
              style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 8, cursor: 'pointer', color: 'var(--neutral-500)' }}
            >
              <DownloadOneIcon size={16} />
            </button>
          </Tooltip>
        )}
        {...section('documents')}
      >
        {data.documents.length === 0 ? <EmptyHint>No files were created or shared.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('documents', data.documents).map(doc => (
              <ItemRow
                key={doc.key}
                onClick={() => downloadFile(doc.url, doc.name)}
                icon={doc.image ? <ImageTwoIcon size={16} /> : <FileTwoIcon size={16} />}
                label={doc.name}
                detail={[doc.kind === 'created' ? 'Created' : 'Uploaded', extensionOf(doc.name)].filter(Boolean).join(' · ')}
                right={<span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" style={{ display: 'inline-flex' }}><DownloadOneIcon size={16} /></span>}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('documents', data.documents, 'documents')}
      </PanelSection>

      <PanelSection title="Skills" count={counts.skills} {...section('skills')}>
        {data.skills.length === 0 ? <EmptyHint>No skills were loaded.</EmptyHint> : (
          <AnimatedList>
            {showAll.limit('skills', data.skills).map(({ name, activity }) => (
              <ItemRow
                key={name}
                icon={<ShapesOneIcon size={16} />}
                label={name}
                right={statusAside(activity)}
              />
            ))}
          </AnimatedList>
        )}
        {showAll.more('skills', data.skills, 'skills')}
      </PanelSection>
    </PanelCard>
  )
}

function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false)
  if (!domain || failed) {
    return <span style={{ ...CAPTION, width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--neutral-200)', color: 'var(--neutral-600)', fontSize: 10 }}>{(domain[0] ?? '?').toUpperCase()}</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, same source as ActivityRow
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" width={16} height={16} onError={() => setFailed(true)} style={{ borderRadius: 4 }} />
  )
}
