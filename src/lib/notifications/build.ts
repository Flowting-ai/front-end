// ── Notification builders ────────────────────────────────────────────────────
// Pure mapping from the app's existing data into AppNotification rows. Kept
// free of React and fetching so the playground can render the exact rows the
// live bell would, from fixtures.

import { failureReason, type Automation, type AutomationRun } from '@/lib/api/automations'
import type { UnavailableAgentModel } from '@/lib/agent-model-health'
import { parseServerDate } from '@/lib/utils/format-utils'
import {
  AGENTS_ROUTE,
  ORG_CONNECTORS_ROUTE,
  ORG_MEMBERS_ROUTE,
  ORG_PLANS_ROUTE,
  SCHEDULES_ROUTE,
} from '@/lib/routes'
import type { AppNotification, NotificationKind, TeamRequest } from './types'

/** How far back finished schedule runs are shown. */
export const SCHEDULE_RUN_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

/** Most rows the panel ever lists — actionable items are never dropped. */
export const MAX_NOTIFICATIONS = 50

// ── Hrefs ─────────────────────────────────────────────────────────────────────

export function scheduleHref(automationId: string): string {
  return `${SCHEDULES_ROUTE}/${encodeURIComponent(automationId)}`
}

/** Lands on My Agents and opens the single-agent Change model modal. */
export function agentFixModelHref(personaId: string): string {
  return `${AGENTS_ROUTE}?tab=my-personas&fixModel=${encodeURIComponent(personaId)}`
}

const REQUEST_HREF: Record<TeamRequest['type'], string> = {
  connector:  ORG_CONNECTORS_ROUTE,
  credits:    ORG_PLANS_ROUTE,
  permission: ORG_MEMBERS_ROUTE,
}

// ── Text helpers ──────────────────────────────────────────────────────────────

/** A run's answer is markdown and can be pages long — keep the first readable
 *  sentence-ish chunk as plain text for a two-line preview. */
export function plainExcerpt(markdown: string, max = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// ── Schedules ─────────────────────────────────────────────────────────────────

/** One row per finished run (succeeded or failed) inside the lookback window. */
export function scheduleRunNotifications(
  automation: Pick<Automation, 'id' | 'name'>,
  runs: readonly AutomationRun[],
  nowMs: number = Date.now(),
): AppNotification[] {
  const rows: AppNotification[] = []
  for (const run of runs) {
    if (run.status !== 'succeeded' && run.status !== 'failed') continue
    if (!run.finished_at) continue
    // Backend timestamps can arrive without a zone — parseServerDate reads
    // those as UTC, where Date.parse would read them as local time.
    const finished = parseServerDate(run.finished_at)
    if (!finished || nowMs - finished.getTime() > SCHEDULE_RUN_LOOKBACK_MS) continue
    const failed = run.status === 'failed'
    const name = automation.name || 'Scheduled task'
    rows.push({
      id:         `schedule-run:${run.id}`,
      kind:       failed ? 'schedule-failed' : 'schedule-succeeded',
      title:      failed ? `${name} failed` : `${name} finished`,
      body:       failed
        ? failureReason(run.error ?? '')
        : run.answer ? plainExcerpt(run.answer) : 'Completed without an answer.',
      at:         finished.toISOString(),
      href:       scheduleHref(automation.id),
      actionable: false,
    })
  }
  return rows
}

// ── Agents ────────────────────────────────────────────────────────────────────

export function agentModelNotificationId(row: Pick<UnavailableAgentModel, 'modelId' | 'reason'> & { persona: { id: string } }): string {
  return `agent-model:${row.persona.id}:${row.modelId}:${row.reason}`
}

/**
 * One persistent "needs attention" row per agent whose model can't run.
 * `firstSeen` (id → ISO) keeps each row's timestamp stable across polls —
 * the catalog doesn't say when a model went away.
 */
export function agentModelNotifications(
  rows: readonly UnavailableAgentModel[],
  modelNames: ReadonlyMap<string, string>,
  firstSeen: Readonly<Record<string, string>>,
  nowIso: string = new Date().toISOString(),
): AppNotification[] {
  return rows.map(row => {
    const id = agentModelNotificationId(row)
    // A retired model is gone from the catalog, so its name usually is too —
    // same fallback wording PersonaCard's scrim uses.
    const modelName = modelNames.get(row.modelId)
    const subject = modelName ?? 'This agent’s model'
    const agentName = row.persona.name || 'An agent'
    return {
      id,
      kind:       'agent-model',
      title:      `${agentName} needs attention`,
      body:       row.reason === 'blocked'
        ? `${subject} is turned off for your account, so this agent can’t run. Choose another model to bring it back.`
        : `${subject} is no longer available, so this agent can’t run. Choose a new model to bring it back.`,
      at:         firstSeen[id] ?? nowIso,
      href:       agentFixModelHref(row.persona.id),
      actionable: true,
      agent:      { id: row.persona.id, name: agentName },
    }
  })
}

// ── Team requests (admins) ────────────────────────────────────────────────────

const REQUEST_KIND: Record<TeamRequest['type'], NotificationKind> = {
  connector:  'request-connector',
  credits:    'request-credits',
  permission: 'request-permission',
}

export function requestNotifications(requests: readonly TeamRequest[]): AppNotification[] {
  return requests.map(request => {
    const who = request.requesterName || 'A team member'
    // subject: "Linear" / "500 more credits" / "Admin access"
    const title = request.type === 'connector'
      ? `${who} requested the ${request.subject} connector`
      : `${who} requested ${request.subject.charAt(0).toLowerCase()}${request.subject.slice(1)}`
    return {
      id:         `request:${request.type}:${request.id}`,
      kind:       REQUEST_KIND[request.type],
      title,
      body:       request.reason?.trim() || undefined,
      at:         request.createdAt,
      href:       REQUEST_HREF[request.type],
      actionable: true,
    }
  })
}

// ── Bundling ──────────────────────────────────────────────────────────────────
// An hourly schedule would otherwise fill the whole panel with near-identical
// rows. Runs of the same schedule collapse into one row that shows the latest
// run, with a count of the rest ("4 runs this week · 1 failed") — the same
// "bundle by object" pattern GitHub, Linear and Slack use.

/** The member ids a row stands for (itself, unless it's a bundle). */
export function notificationIds(n: AppNotification): string[] {
  return n.memberIds ?? [n.id]
}

export function bundleNotifications(list: readonly AppNotification[]): AppNotification[] {
  const groups = new Map<string, AppNotification[]>()
  const out: Array<AppNotification | string> = []
  for (const n of list) {
    const isRun = n.kind === 'schedule-succeeded' || n.kind === 'schedule-failed'
    if (!isRun) { out.push(n); continue }
    const key = n.href
    const group = groups.get(key)
    if (group) group.push(n)
    else { groups.set(key, [n]); out.push(key) }
  }
  return out.map(entry => {
    if (typeof entry !== 'string') return entry
    const runs = [...groups.get(entry)!].sort((a, b) => atMs(b) - atMs(a))
    if (runs.length === 1) return runs[0]!
    const latest = runs[0]!
    const failed = runs.filter(r => r.kind === 'schedule-failed').length
    const parts = [`${runs.length} runs this week`]
    if (failed > 0) parts.push(failed === runs.length ? 'all failed' : `${failed} failed`)
    return {
      ...latest,
      memberIds: runs.map(r => r.id),
      summary:   parts.join(' · '),
    }
  })
}

// ── Ordering ──────────────────────────────────────────────────────────────────

function atMs(n: AppNotification): number {
  return parseServerDate(n.at)?.getTime() ?? 0
}

/** Newest first, de-duplicated by id, capped at MAX_NOTIFICATIONS — the cap
 *  only ever drops informational rows, never an open problem. */
export function finalizeNotifications(list: readonly AppNotification[]): AppNotification[] {
  const byId = new Map<string, AppNotification>()
  for (const n of list) if (!byId.has(n.id)) byId.set(n.id, n)
  const sorted = [...byId.values()].sort((a, b) => atMs(b) - atMs(a))
  const actionable = sorted.filter(n => n.actionable)
  const rest = sorted.filter(n => !n.actionable).slice(0, Math.max(0, MAX_NOTIFICATIONS - actionable.length))
  return [...actionable, ...rest].sort((a, b) => atMs(b) - atMs(a))
}
