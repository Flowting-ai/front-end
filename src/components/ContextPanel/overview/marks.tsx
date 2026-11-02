'use client'

import React, { useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { AlertCircleIcon, StopCircleIcon, TickTwoIcon } from '@strange-huge/icons'
import { Spinner } from '@/components/Spinner'
import type { ActivityItem, ActivityStatus, PlanItem } from '@/types/chat'
import { ItemRow } from './blocks'
import { formatElapsed, isRunning, RUNNING, stepText, type TurnState } from './derive'
import { CAPTION, EASE } from './styles'

// Status marks and the to-do list: the pieces that show how a step or turn is going.

/** The turn's status pill: its word, the tint behind it, and its mark's colour. */
const STATUS: Record<Exclude<TurnState, 'idle'>, { label: string; tint: string; color: string }> = {
  working: { label: 'Working', tint: 'color-mix(in srgb, var(--blue-500) 14%, transparent)',  color: 'var(--blue-500)' },
  done:    { label: 'Done',    tint: 'color-mix(in srgb, var(--green-500) 16%, transparent)', color: 'var(--green-500)' },
  stopped: { label: 'Stopped', tint: 'var(--neutral-200)',                                     color: 'var(--neutral-500)' },
  error:   { label: 'Failed',  tint: 'color-mix(in srgb, var(--red-400) 14%, transparent)',   color: 'var(--red-400)' },
}

/** A row's right edge: a spinner while running, the outcome when it didn't finish, else `done`. */
export function statusAside(activity: { status: ActivityStatus }, done?: React.ReactNode): React.ReactNode {
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
  completed:   { color: 'var(--neutral-500)', textDecoration: 'line-through' },
  failed:      { color: 'var(--neutral-800)' },
}

/** No strikethrough: a finished step simply settles back, the running one leads. */
export function stepLabelStyle(status: ActivityStatus): React.CSSProperties {
  if (RUNNING.has(status)) return { color: 'var(--neutral-900)', fontWeight: 'var(--font-weight-medium)' }
  if (status === 'error') return { color: 'var(--neutral-800)' }
  return { color: 'var(--neutral-600)' }
}

// ── To-dos ────────────────────────────────────────────────────────────────────

// The to-do list the model writes is the only progress shown. Status lives in the header
// (a pill that stays visible when collapsed, plus a hairline loading sweep while working);
// without a list the body is empty — tool calls are not progress.


/** The header's status: what the turn is doing, how far along, and for how long. */
export function TurnStatus({ state, seconds, count }: { state: TurnState; seconds: number | null; count: { done: number; total: number } | null }) {
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

/** The to-do list: every item from the start, each loading then ticking off in place. */
export function PlanList({ plan, steps }: { plan: PlanItem[]; steps: ActivityItem[] }) {
  // What the agent is doing right now gives the current item its live detail line.
  const live = steps.findLast(isRunning)
  const liveText = live ? stepText(live) : null
  const reduceMotion = useReducedMotion()
  return (
    // The list arrives whole: one soft fade for the list, never row by row.
    <m.ol
      aria-label="To-dos"
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      {plan.map(item => {
        const current = item.status === 'in_progress'
        const detail = current && liveText ? liveText.label : undefined
        return (
          <li
            key={item.id}
            aria-current={current ? 'step' : undefined}
            // Waiting items sit faded and brighten as their turn comes.
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

export function Favicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false)
  if (!domain || failed) {
    return <span style={{ ...CAPTION, width: 16, height: 16, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--border-default)', color: 'var(--neutral-600)', fontSize: 10 }}>{(domain[0] ?? '?').toUpperCase()}</span>
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- external favicon, same source as ActivityRow
    <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" width={16} height={16} onError={() => setFailed(true)} style={{ borderRadius: 4 }} />
  )
}
