// Dev-only fixture builders for /dev/notifications. Every row is produced by
// the same builders the live feed uses (lib/notifications/build.ts), so what
// the playground shows is exactly what real data would render.

import {
  agentModelNotifications,
  requestNotifications,
  scheduleRunNotifications,
} from '@/lib/notifications/build'
import type { AppNotification } from '@/lib/notifications/types'
import type { Persona } from '@/lib/api/personas'

export type FixtureScenario =
  | 'schedule-success'
  | 'schedule-failure'
  | 'schedule-bundle'
  | 'agent-retired'
  | 'agent-blocked'
  | 'request-connector'
  | 'request-credits'
  | 'request-permission'
  | 'long-text'

export interface FixtureContext {
  /** A real schedule id when the user has one, so "open" lands on it. */
  scheduleId:   string
  scheduleName: string
  /** A real agent when the user has one, so "Change model" opens its modal. */
  agent:        Pick<Persona, 'id' | 'name' | 'modelId' | 'activeVersionId' | 'workingVersionId'> | null
}

const MIN = 60_000
const HOUR = 60 * MIN
const iso = (msAgo: number, now: number) => new Date(now - msAgo).toISOString()

function run(id: string, status: 'succeeded' | 'failed', msAgo: number, now: number, answer = '', error: string | null = null) {
  return { id, status, started_at: iso(msAgo + 2 * MIN, now), finished_at: iso(msAgo, now), answer, error }
}

function fakeAgent(ctx: FixtureContext, suffix: string) {
  const agent = ctx.agent
  return {
    id:   agent?.id ?? `fixture-agent-${suffix}`,
    name: agent?.name ?? 'Research Scout',
  }
}

/**
 * Real runs bundle by schedule link. Fixture scenarios that all point at the
 * same real schedule would merge into one bundle, so each scenario tags its
 * link with `&fx=<scenario>` — /schedules ignores it, the bundler doesn't.
 */
export function buildScenario(scenario: FixtureScenario, ctx: FixtureContext, now = Date.now()): AppNotification[] {
  return buildScenarioRows(scenario, ctx, now).map(n =>
    n.kind === 'schedule-succeeded' || n.kind === 'schedule-failed' ? { ...n, href: `${n.href}&fx=${scenario}` } : n,
  )
}

function buildScenarioRows(scenario: FixtureScenario, ctx: FixtureContext, now: number): AppNotification[] {
  const schedule = { id: ctx.scheduleId, name: ctx.scheduleName }
  switch (scenario) {
    case 'schedule-success':
      return scheduleRunNotifications(schedule, [
        run('fx-run-ok', 'succeeded', 12 * MIN, now,
          '## Morning brief\n\n**3 new competitor launches** overnight. Acme shipped *usage-based pricing*; Globex opened a waitlist for their agent builder. Full notes in the thread.'),
      ], now)
    case 'schedule-failure':
      return scheduleRunNotifications(schedule, [
        run('fx-run-fail', 'failed', 26 * HOUR, now, '',
          'Traceback (most recent call last):\n  File "runner.py", line 88, in run\nconnectors.errors.AuthExpiredError: The Google Drive connection expired. Reconnect it to keep this schedule running.'),
      ], now)
    case 'schedule-bundle':
      return scheduleRunNotifications({ ...schedule, name: 'Hourly inbox triage' }, [
        run('fx-bundle-1', 'succeeded', 5 * MIN, now, 'Triaged 14 emails — 2 need a reply today.'),
        run('fx-bundle-2', 'failed', 65 * MIN, now, '', 'TimeoutError: Gmail did not respond within 60s.'),
        run('fx-bundle-3', 'succeeded', 125 * MIN, now, 'Triaged 9 emails — nothing urgent.'),
        run('fx-bundle-4', 'succeeded', 185 * MIN, now, 'Triaged 21 emails — 1 invoice flagged.'),
      ], now)
    case 'agent-retired':
    case 'agent-blocked': {
      const agent = fakeAgent(ctx, scenario)
      const reason = scenario === 'agent-retired' ? 'retired' : 'blocked'
      const modelId = `fixture-model-${reason}`
      const names = new Map(reason === 'blocked' ? [[modelId, 'GPT-4.1']] : [])
      return agentModelNotifications(
        [{ persona: { ...(ctx.agent ?? {}), id: agent.id, name: agent.name } as Persona, versionId: 'fixture', modelId, reason }],
        names,
        { [`agent-model:${agent.id}:${modelId}:${reason}`]: iso(reason === 'retired' ? 3 * HOUR : 2 * 24 * HOUR, now) },
      )
    }
    case 'request-connector':
      return requestNotifications([{ id: 'fx-req-connector', type: 'connector', requesterName: 'Maya Chen', subject: 'Linear', reason: 'Blocking — I need it to sync sprint issues into the weekly report agent.', createdAt: iso(40 * MIN, now) }])
    case 'request-credits':
      return requestNotifications([{ id: 'fx-req-credits', type: 'credits', requesterName: 'Jordan Patel', subject: '500 more credits', reason: 'Ran out mid-way through the Q3 research project.', createdAt: iso(5 * HOUR, now) }])
    case 'request-permission':
      return requestNotifications([{ id: 'fx-req-permission', type: 'permission', requesterName: 'Sam Rivera', subject: 'Admin access', reason: null, createdAt: iso(30 * HOUR, now) }])
    case 'long-text':
      return scheduleRunNotifications({ id: schedule.id, name: 'A deliberately long schedule name that keeps going to test clamping in the panel' }, [
        run('fx-run-long', 'succeeded', 3 * 24 * HOUR, now,
          'Supercalifragilisticexpialidocious_unbroken_token_without_spaces_to_check_overflow_wrapping '.repeat(4)),
      ], now)
  }
}

/** One brand-new run, finished just now — exercises the badge, the arrival
 *  toast, and the bell's swing. Unique id every call. */
export function buildLiveArrival(ctx: FixtureContext, now = Date.now()): AppNotification {
  const id = `fx-live-${now}`
  const row = scheduleRunNotifications({ id: ctx.scheduleId, name: ctx.scheduleName }, [
    run(id, 'succeeded', 0, now, 'Fresh results just landed — open the schedule to read them.'),
  ], now)[0]!
  return { ...row, href: `${row.href}&fx=live` }
}

export const SCENARIO_LABELS: Record<FixtureScenario, { title: string; detail: string }> = {
  'schedule-success':   { title: 'Schedule finished',        detail: 'Succeeded 12 min ago, markdown answer → plain-text preview.' },
  'schedule-failure':   { title: 'Schedule failed',          detail: 'Yesterday; traceback → last-line failure reason, red tone.' },
  'schedule-bundle':    { title: 'Bundled runs',             detail: '4 runs of one schedule (1 failed) collapse into one row.' },
  'agent-retired':      { title: 'Agent: model retired',     detail: 'Needs attention; "Change model" opens the fix modal.' },
  'agent-blocked':      { title: 'Agent: model turned off',  detail: 'Needs attention; blocked-model copy.' },
  'request-connector':  { title: 'Connector request',        detail: 'Admin-only in the live feed → /connectors.' },
  'request-credits':    { title: 'Credits request',          detail: 'Admin-only in the live feed → Plans & billing.' },
  'request-permission': { title: 'Access request',           detail: 'Admin-only in the live feed → Members. No reason given.' },
  'long-text':          { title: 'Overflow stress test',     detail: 'Long title + unbroken body, 3 days old ("Earlier this week").' },
}

/** `count` finished runs of different schedules, spread ~9 h apart — fills the
 *  panel past its height cap to exercise scrolling, edge fades and day groups. */
export function buildManyRows(ctx: FixtureContext, count: number, now = Date.now()): AppNotification[] {
  return Array.from({ length: count }, (_, i) =>
    buildScenario('schedule-success', { ...ctx, scheduleId: `many-${i}`, scheduleName: `Schedule #${i + 1}` }, now - i * 9 * HOUR),
  ).flat().map((n, i) => ({ ...n, id: `${n.id}-${i}` }))
}
