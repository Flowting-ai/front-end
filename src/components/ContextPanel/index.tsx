'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { useChatContext } from '@/lib/chat-context-store'
import { toConnector } from '@/lib/connector'
import { springs } from '@/lib/springs'
import type { ActivityItem, ActivityStatus, UIMessage } from '@/types/chat'

// The "Context" side panel for a chat: what the current turn is doing and which agents,
// connectors and skills it used. Everything here comes from the live activity the chat
// already streams (see use-streaming-chat), so it reflects this session's turns; a chat
// reloaded from history has no tool activity to show until it runs again.

// ── Derivations ───────────────────────────────────────────────────────────────

const RUNNING: ReadonlySet<ActivityStatus> = new Set(['start', 'executing', 'reading'])
const isRunning = (a: ActivityItem) => RUNNING.has(a.status)

type TurnState = 'idle' | 'working' | 'done' | 'stopped' | 'error'

function turnState(message: UIMessage | undefined): TurnState {
  if (!message) return 'idle'
  if (message.isLoading) return 'working'
  if (message.stoppedByUser) return 'stopped'
  if (message.isError) return 'error'
  return 'done'
}

const STATE_LABEL: Record<TurnState, string> = {
  idle:    'Nothing running',
  working: 'Working',
  done:    'Done',
  stopped: 'Stopped',
  error:   'Needs attention',
}

// A connector tool is a lower-cased tool slug prefixed with its connector, e.g.
// `gmail-send-email`. Built-in tools (`read_url`, `web_search`, …) are snake_case, so a hyphen
// is what separates the two. Returns the connector's display name, or null for a built-in.
function connectorOf(activity: ActivityItem): string | null {
  const tool = activity.toolName?.trim().toLowerCase()
  if (!tool || !tool.includes('-')) return null
  return toConnector(tool.split('-')[0]).name
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
}

/** Seconds since `iso`, ticking once a second while `active`. */
function useElapsedSeconds(iso: string | undefined, active: boolean): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [active])
  if (!active || !iso) return null
  const started = Date.parse(iso)
  return Number.isNaN(started) ? null : Math.max(0, Math.round((now - started) / 1000))
}

// ── Building blocks ───────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  display:         'flex',
  flexDirection:   'column',
  gap:             10,
  padding:         12,
  borderRadius:    12,
  backgroundColor: 'var(--neutral-100)',
  boxShadow:       'inset 0px 0px 0px 1px var(--neutral-200)',
}

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section style={CARD}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--neutral-500)' }}>
          {title}
        </h3>
        {aside && (
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
            {aside}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

const DOT_COLOR: Record<'active' | 'done' | 'error' | 'idle', string> = {
  active: 'var(--blue-500)',
  done:   'var(--green-500)',
  error:  'var(--red-400)',
  idle:   'var(--neutral-400)',
}

function rowTone(status: ActivityStatus): 'active' | 'done' | 'error' | 'idle' {
  if (RUNNING.has(status)) return 'active'
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  return 'idle'
}

function Row({ label, detail, tone, right }: { label: string; detail?: string; tone: 'active' | 'done' | 'error' | 'idle'; right?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, backgroundColor: DOT_COLOR[tone] }} />
      <div style={{ flex: '1 1 0', minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </p>
        {detail && (
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detail}
          </p>
        )}
      </div>
      {right && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {right}
        </span>
      )}
    </div>
  )
}

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 20, lineHeight: '24px', color: 'var(--neutral-900)' }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>{label}</span>
    </div>
  )
}

const EmptyLine = ({ children }: { children: React.ReactNode }) => (
  <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-500)' }}>{children}</p>
)

// ── Panel ─────────────────────────────────────────────────────────────────────

export function ContextPanelContent() {
  const { messages } = useChatContext()
  const reduceMotion = useReducedMotion()

  const { latest, activities, agents, connectors, skills, models, replies, searches, files } = useMemo(() => {
    const assistant = messages.filter(message => message.role === 'assistant')
    const latestMessage = assistant[assistant.length - 1]
    const all = assistant.flatMap(message => message.activities ?? [])

    const connectorMap = new Map<string, { name: string; used: number; active: boolean; failed: boolean }>()
    for (const activity of all) {
      const name = connectorOf(activity)
      if (!name) continue
      const entry = connectorMap.get(name) ?? { name, used: 0, active: false, failed: false }
      entry.used += 1
      entry.active ||= isRunning(activity)
      entry.failed ||= activity.status === 'error'
      connectorMap.set(name, entry)
    }

    return {
      latest: latestMessage,
      activities: latestMessage?.activities ?? [],
      agents: all.filter(activity => activity.type === 'agent'),
      connectors: [...connectorMap.values()],
      skills: all.filter(activity => activity.type === 'skills'),
      models: [...new Set(assistant.map(message => message.modelName || message.model_name).filter((name): name is string => Boolean(name)))],
      replies: assistant.length,
      searches: all.filter(activity => activity.type === 'web-search').length,
      files: assistant.reduce((sum, message) => sum + (message.generatedFiles?.length ?? 0) + (message.images?.length ?? 0), 0),
    }
  }, [messages])

  const state = turnState(latest)
  const working = state === 'working'
  const elapsed = useElapsedSeconds(latest?.created_at, working)

  const total = activities.length
  const finished = activities.filter(activity => !isRunning(activity)).length
  const fraction = total > 0 ? finished / total : state === 'done' ? 1 : 0
  const current = activities.find(isRunning)

  if (messages.length === 0) {
    return (
      <div style={{ ...CARD, alignItems: 'flex-start' }}>
        <EmptyLine>Nothing here yet. Progress, agents and connectors for this chat show up as soon as it starts working.</EmptyLine>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Section title="Progress" aside={elapsed !== null ? formatElapsed(elapsed) : undefined}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-medium)', fontSize: 20, lineHeight: '24px', color: 'var(--neutral-900)' }}>
            {STATE_LABEL[state]}
          </span>
          {total > 0 && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)', whiteSpace: 'nowrap' }}>
              {finished} of {total} steps
            </span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--neutral-200)', overflow: 'hidden' }}>
          <m.div
            initial={false}
            animate={{ width: `${Math.round(fraction * 100)}%` }}
            transition={reduceMotion ? { duration: 0 } : springs.moderate}
            style={{ height: '100%', borderRadius: 3, backgroundColor: state === 'error' ? DOT_COLOR.error : state === 'done' ? DOT_COLOR.done : DOT_COLOR.active }}
          />
        </div>
        {working && (
          <EmptyLine>{current ? (current.progressMessage || current.label || current.detail || 'Working…') : 'Thinking…'}</EmptyLine>
        )}
      </Section>

      <Section title="Agents" aside={agents.length > 0 ? `${agents.filter(isRunning).length} active / ${agents.length}` : undefined}>
        {agents.length === 0 ? (
          <EmptyLine>No agents involved.</EmptyLine>
        ) : (
          agents.map(agent => (
            <Row key={agent.id} label={agent.label || 'Agent'} detail={agent.detail} tone={rowTone(agent.status)} right={agent.durationS ? formatElapsed(Math.round(agent.durationS)) : undefined} />
          ))
        )}
      </Section>

      <Section title="Connectors">
        {connectors.length === 0 ? (
          <EmptyLine>No connectors used.</EmptyLine>
        ) : (
          connectors.map(connector => (
            <Row key={connector.name} label={connector.name} tone={connector.failed ? 'error' : connector.active ? 'active' : 'done'} right={connector.active ? 'active' : connector.failed ? 'failed' : `used${connector.used > 1 ? ` ×${connector.used}` : ''}`} />
          ))
        )}
      </Section>

      {skills.length > 0 && (
        <Section title="Skills">
          {skills.map(skill => (
            <Row key={skill.id} label={skill.label || skill.detail || 'Skill'} tone={rowTone(skill.status)} />
          ))}
        </Section>
      )}

      <Section title="Usage">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          <StatPair label={replies === 1 ? 'reply' : 'replies'} value={String(replies)} />
          <StatPair label={searches === 1 ? 'search' : 'searches'} value={String(searches)} />
          <StatPair label={files === 1 ? 'file' : 'files'} value={String(files)} />
        </div>
        {models.length > 0 && <EmptyLine>{models.join(', ')}</EmptyLine>}
      </Section>
    </div>
  )
}
