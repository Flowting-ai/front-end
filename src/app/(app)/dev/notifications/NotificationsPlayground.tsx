'use client'

// ── Dev-only notifications playground ───────────────────────────────────────
// Reachable at /dev/notifications in development only (page.tsx 404s in
// production). Not linked anywhere. Three ways to exercise the bell:
//
//   1. Live bell — inject fixture notifications into the REAL sidebar bell, so
//      badge, toasts, tabs, bundling, hover actions and click-through routing
//      can all be checked end to end. Fixtures point at your real schedule and
//      agent where you have one, so navigation lands somewhere meaningful.
//   2. Model outage — pretend one of your agents' models is retired or turned
//      off. Nothing is written to the backend; the real /agents grid, the
//      agents side panel, the fix modal and the bell all react to it.
//   3. Panel states — inline previews of every panel state with local state.

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Switch } from '@/components/Switch'
import { BellRingIcon } from '@/components/BellRingIcon'
import { NotificationPanel } from '@/components/NotificationPanel'
import { useAuth } from '@/context/auth-context'
import { openNotificationsPanel, useNotifications } from '@/context/notifications-context'
import { listAutomations } from '@/lib/api/automations'
import { fetchPersonas, isDraftPersona, type Persona } from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { buildModelNameMap, patchableVersionId, type ModelUnavailableReason } from '@/lib/agent-model-health'
import { notificationIds } from '@/lib/notifications/build'
import {
  clearDevNotificationState,
  readDevFixtures,
  readDevModelOverrides,
  useDevNotificationsVersion,
  writeDevFixtures,
  writeDevModelOverride,
} from '@/lib/notifications/dev'
import { emptyReadState, notificationReadStateKey, notificationUserKey, saveReadState } from '@/lib/notifications/read-state'
import type { AppNotification } from '@/lib/notifications/types'
import { AGENTS_ROUTE, SCHEDULES_ROUTE } from '@/lib/routes'
import { buildLiveArrival, buildManyRows, buildScenario, SCENARIO_LABELS, type FixtureContext, type FixtureScenario } from './fixtures'

const SCENARIOS = Object.keys(SCENARIO_LABELS) as FixtureScenario[]

/** Fixtures are flagged `dev` when read back; store them without it. */
const stripDev = (n: AppNotification): AppNotification => ({ ...n, dev: undefined })

// ── Layout bits ───────────────────────────────────────────────────────────────

function Card({ title, description, children, actions }: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section
      style={{
        display: 'flex', flexDirection: 'column', gap: 16, padding: 20, borderRadius: 16,
        backgroundColor: 'var(--neutral-white)', boxShadow: '0px 1px 2px 0px var(--neutral-700-12), 0px 0px 0px 1px var(--neutral-100)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 18, lineHeight: '24px', color: 'var(--neutral-900)' }}>{title}</h2>
          {description && <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)' }}>{description}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{actions}</div>}
      </header>
      {children}
    </section>
  )
}

const bodyText: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-body)', lineHeight: 'var(--line-height-body)', color: 'var(--neutral-800)',
}
const captionText: React.CSSProperties = {
  margin: 0, fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', lineHeight: 'var(--line-height-caption)', color: 'var(--neutral-500)',
}

// ── Inline panel preview with its own read state ──────────────────────────────

function PanelPreview({ label, notifications, loading = false }: { label: string; notifications: AppNotification[]; loading?: boolean }) {
  const [read, setRead] = useState<Set<string>>(() => new Set())
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const visible = notifications.filter(n => !dismissed.has(n.id))
  const isUnread = (n: AppNotification) => notificationIds(n).some(id => !read.has(id))
  const setIds = (n: AppNotification, unread: boolean) => setRead(prev => {
    const next = new Set(prev)
    for (const id of notificationIds(n)) { if (unread) next.delete(id); else next.add(id) }
    return next
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ ...captionText, fontWeight: 'var(--font-weight-medium)', color: 'var(--neutral-700)' }}>{label}</p>
      <div role="menu" aria-label={label}>
        <NotificationPanel
          notifications={visible}
          isUnread={isUnread}
          unreadCount={visible.filter(isUnread).length}
          loading={loading}
          maxHeight={420}
          onSelect={n => setIds(n, false)}
          onMarkRead={n => setIds(n, false)}
          onMarkUnread={n => setIds(n, true)}
          onDismiss={n => setDismissed(prev => new Set(prev).add(n.id))}
          onMarkAllRead={() => setRead(new Set(visible.flatMap(notificationIds)))}
          onOpenSettings={() => {}}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

// Client-only: fixtures, overrides and read state all live in localStorage,
// which the server render can't see — rendering it there would mismatch on
// hydration (switch states, counts).
export function NotificationsPlayground() {
  const mounted = useMounted()
  return mounted ? <PlaygroundContent /> : null
}

function PlaygroundContent() {
  const { user } = useAuth()
  const { push } = useRouter()
  const feed = useNotifications()
  const devVersion = useDevNotificationsVersion()

  const [schedules, setSchedules] = useState<Array<{ id: string; name: string }>>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [modelNames, setModelNames] = useState<Map<string, string>>(() => new Map())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([listAutomations(), fetchPersonas(), fetchModelsWithCache()]).then(([s, p, m]) => {
      if (cancelled) return
      if (s.status === 'fulfilled' && Array.isArray(s.value)) setSchedules(s.value.map(a => ({ id: a.id, name: a.name })))
      if (p.status === 'fulfilled') setPersonas(p.value)
      if (m.status === 'fulfilled') setModelNames(buildModelNameMap(m.value))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  const fixableAgents = useMemo(
    () => personas.filter(p => !isDraftPersona(p) && p.modelId && patchableVersionId(p)),
    [personas],
  )

  const ctx: FixtureContext = useMemo(() => ({
    scheduleId:   schedules[0]?.id ?? 'fixture-schedule',
    scheduleName: schedules[0]?.name ?? 'Morning competitor brief',
    agent:        fixableAgents[0] ?? null,
  }), [schedules, fixableAgents])

  // Which scenarios are currently injected into the live bell.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fixtures = useMemo(() => readDevFixtures(), [devVersion])
  const activeScenarios = useMemo(() => {
    const ids = new Set(fixtures.map(n => n.id))
    return new Set(SCENARIOS.filter(s => buildScenario(s, ctx).every(n => ids.has(n.id))))
  }, [fixtures, ctx])

  const setScenario = (scenario: FixtureScenario, on: boolean) => {
    const rows = buildScenario(scenario, ctx)
    const ids = new Set(rows.map(n => n.id))
    const rest = readDevFixtures().filter(n => !ids.has(n.id)).map(stripDev)
    writeDevFixtures(on ? [...rest, ...rows] : rest)
  }
  const setAllScenarios = (on: boolean) => {
    const live = readDevFixtures().filter(n => n.id.startsWith('schedule-run:fx-live-')).map(stripDev)
    writeDevFixtures(on ? [...live, ...SCENARIOS.flatMap(s => buildScenario(s, ctx))] : live)
  }
  const sendLiveArrival = () => {
    const current = readDevFixtures().map(stripDev)
    writeDevFixtures([...current, buildLiveArrival(ctx)])
  }

  // ── Model outage simulation ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const overrides = useMemo(() => readDevModelOverrides(), [devVersion])
  const models = useMemo(() => {
    const byModel = new Map<string, Persona[]>()
    for (const p of fixableAgents) {
      const list = byModel.get(p.modelId!) ?? []
      list.push(p)
      byModel.set(p.modelId!, list)
    }
    return [...byModel.entries()].map(([modelId, agents]) => ({ modelId, agents, name: modelNames.get(modelId) ?? 'Unknown model (already retired?)' }))
  }, [fixableAgents, modelNames])

  const userKey = user?.email ? notificationUserKey(user.email) : null
  const resetReadState = () => {
    if (!userKey) return
    try { window.localStorage.removeItem(notificationReadStateKey(userKey)) } catch { /* ignore */ }
    window.location.reload()
  }
  const markEverythingUnseen = () => {
    if (!userKey) return
    // Baseline + seenAt at the epoch: every row counts as new and unread.
    const epoch = new Date(0)
    saveReadState(userKey, emptyReadState(epoch))
    window.location.reload()
  }

  // ── Static previews ──
  const allRows = useMemo(() => SCENARIOS.flatMap(s => buildScenario(s, ctx)), [ctx])
  const manyRows = useMemo(() => buildManyRows(ctx, 14), [ctx])

  return (
    <div style={{ height: '100%', overflowY: 'auto', backgroundColor: 'var(--neutral-50)' }} className="kaya-scrollbar">
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', color: 'var(--neutral-700)' }}><BellRingIcon size={28} animated /></span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-title)', fontWeight: 'var(--font-weight-regular)', fontSize: 28, lineHeight: '34px', color: 'var(--neutral-900)' }}>
            Notifications playground
          </h1>
          <Badge label="Dev only" color="Purple" />
        </div>
        <p style={captionText}>
          Live feed right now: {feed.notifications.length} rows · {feed.unreadCount} unread (badge) · {feed.unseenCount} new since last open (rings) · {feed.attentionCount} need attention
          {feed.loading ? ' · loading…' : ''}. Using schedule “{ctx.scheduleName}”{schedules.length ? '' : ' (fixture — you have no schedules, so its link won’t open anything)'}
          {' '}and agent “{ctx.agent?.name ?? 'none — create one to test the fix flow'}”.
        </p>

        {/* 1 ── Live bell ── */}
        <Card
          title="1 · Live bell fixtures"
          description="Injected into the real sidebar bell (stored in this browser only). Toggle on, then use the bell bottom-left — or click Open bell."
          actions={<>
            <Button size="sm" variant="secondary" onClick={() => setAllScenarios(true)}>Add all</Button>
            <Button size="sm" variant="secondary" onClick={() => setAllScenarios(false)}>Remove all</Button>
            <Button size="sm" variant="outline" onClick={sendLiveArrival}>Send a live arrival</Button>
            <Button size="sm" onClick={() => openNotificationsPanel()}>Open bell</Button>
          </>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
            {SCENARIOS.map(s => (
              <label
                key={s}
                style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  boxShadow: '0px 0px 0px 1px var(--neutral-100)',
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={bodyText}>{SCENARIO_LABELS[s].title}</span>
                  <span style={captionText}>{SCENARIO_LABELS[s].detail}</span>
                </span>
                <Switch checked={activeScenarios.has(s)} onCheckedChange={on => setScenario(s, on)} aria-label={SCENARIO_LABELS[s].title} />
              </label>
            ))}
          </div>
          <p style={captionText}>
            “Send a live arrival” adds a run that finished just now: expect the bell to ring, the red badge to pop and count up, and a toast with <em>View</em>.
            Send two quickly to see them bundle into one row.
          </p>
        </Card>

        {/* 2 ── Model outage ── */}
        <Card
          title="2 · Simulate a model outage"
          description="Pretends a model your agents use is retired or turned off — nothing is sent to the backend. The /agents cards fade, the agents side panel fades with “Fix model”, the bell raises “needs attention”, and clicking it opens the Change model modal."
          actions={<Button size="sm" variant="secondary" onClick={() => push(AGENTS_ROUTE)}>Open /agents</Button>}
        >
          {!loaded ? (
            <p style={captionText}>Loading your agents…</p>
          ) : models.length === 0 ? (
            <p style={captionText}>No published agents with a model yet — create one on /agents to test this.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {models.map(({ modelId, agents, name }) => {
                const state: ModelUnavailableReason | 'ok' = overrides[modelId] ?? 'ok'
                return (
                  <div key={modelId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', borderRadius: 10, boxShadow: '0px 0px 0px 1px var(--neutral-100)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={bodyText}>{name}</span>
                      <span style={{ ...captionText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Used by {agents.map(a => a.name).join(', ')}
                      </span>
                    </div>
                    <div role="group" aria-label={`Simulated state of ${name}`} style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {(['ok', 'retired', 'blocked'] as const).map(option => (
                        <Button
                          key={option}
                          size="sm"
                          variant={state === option ? 'default' : 'outline'}
                          aria-pressed={state === option}
                          onClick={() => writeDevModelOverride(modelId, option === 'ok' ? null : option)}
                        >
                          {option === 'ok' ? 'Available' : option === 'retired' ? 'Retired' : 'Turned off'}
                        </Button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* 3 ── Panel states ── */}
        <Card title="3 · Panel states" description="The real NotificationPanel with local state — hover rows for actions, press U / ⌫ on a focused row, switch tabs.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 24, alignItems: 'start' }}>
            <PanelPreview label="Every type (actionable + grouped by day)" notifications={allRows} />
            <PanelPreview label="Many rows (scroll + edge fade)" notifications={manyRows} />
            <PanelPreview label="Empty — try the Unread tab too" notifications={[]} />
            <PanelPreview label="First load (skeleton)" notifications={[]} loading />
          </div>
        </Card>

        {/* 4 ── Read state ── */}
        <Card
          title="4 · Read state"
          description="Read/unread, seen and dismissed marks live in localStorage per user. Reset to test first-run behaviour."
          actions={<>
            <Button size="sm" variant="secondary" onClick={markEverythingUnseen}>Make everything new</Button>
            <Button size="sm" variant="secondary" onClick={() => { clearDevNotificationState() }}>Clear all dev overrides</Button>
            <Button size="sm" variant="danger" onClick={resetReadState}>Reset read state</Button>
          </>}
        >
          <p style={captionText}>
            “Reset” starts fresh: rows older than now start read, so the badge only counts what arrives next (and open problems).
            “Make everything new” backdates the baseline so every row is unread and counted.
          </p>
        </Card>

        {/* 5 ── Checklist ── */}
        <Card title="5 · What to check" description="Manual pass — each line is one behaviour.">
          <ol style={{ ...bodyText, margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>The bell sits right of the settings icon; collapsed sidebar → above the avatar. Hovering swings it.</li>
            <li>Clicking the bell never opens the account menu, and opening one closes the other.</li>
            <li>The panel opens to the right of the sidebar, bottom-aligned with the bell; Esc closes it; ↑/↓ move between rows.</li>
            <li>The red badge shows the unread count (same as “Unread · N”); it drops as rows are opened or marked read, and goes away at zero.</li>
            <li>Schedule row → <Link href={SCHEDULES_ROUTE}>/schedules</Link> with that schedule open (back, then click the same row again — it reopens).</li>
            <li>Agent row / “Change model” → /agents opens the Change model modal; saving clears the row within a second.</li>
            <li>Connector / credits / access requests → /connectors, Plans & billing, Members.</li>
            <li>Hover a row → mark read/unread and dismiss; “Mark all as read” and dismiss each offer Undo.</li>
            <li>Unread tab: reading a row dims it in place; it leaves when you switch tabs.</li>
            <li>“Send a live arrival” with the panel closed → toast with View; with the panel open → no toast.</li>
            <li>Simulated outage → the card on /agents and in the chat Agents panel go grey with the reason.</li>
            <li>Dark mode, and a narrow window: the panel never runs off-screen.</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}
