import type { ScheduleDetailItem, ScheduleListItem, ScheduleRunRecord } from '@/components/Schedules'
import {
  runSummary,
  type Automation,
  type AutomationDetail,
  type AutomationRun,
  type OrganizationAutomation,
  type ScheduleJson,
} from '@/lib/api/automations'
import { ApiError } from '@/lib/api/client'

/**
 * Pure mapping from automation API rows to the Schedules view models. No side
 * effects: callers that want to remember a schedule's chat do it themselves.
 */

// The schedule sentence the backend built ("Every 5 minutes", "Every weekday at
// 9:30 AM (America/Chicago)"). `CronSpec` owns cron — this page formats none of
// it, so what the user reads is what Pipedream is actually running.
// See services/automations/schedule.py :: describeSchedule.
export function scheduleDescription(json: ScheduleJson): string {
  return json.description || 'On a schedule'
}

// True when the deployed Pipedream timer disagrees with what's stored — see
// services/automations/schedule.py :: driftBetween. Surfaced as a warning
// banner in the detail view rather than left invisible.
export function scheduleDrift(json: ScheduleJson): boolean {
  return json.drift === true
}

function timeOfDay(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function daysApart(date: Date, now: Date): number {
  const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((dayOf(date) - dayOf(now)) / 86_400_000)
}

function validDate(iso: string): Date | null {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNextRun(iso: string, now = new Date()): string | undefined {
  const date = validDate(iso)
  if (!date) return undefined
  const days = daysApart(date, now)
  if (days === 0) return `Today · ${timeOfDay(date)}`
  if (days === 1) return `Tomorrow · ${timeOfDay(date)}`
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${timeOfDay(date)}`
}

// A run already happened, so "Tomorrow" can never be the answer — reusing the
// next-run formatter left yesterday's failures reading as a bare date.
export function formatRunTime(iso: string, now = new Date()): string | undefined {
  const date = validDate(iso)
  if (!date) return undefined
  const days = daysApart(date, now)
  if (days === 0)  return `Today · ${timeOfDay(date)}`
  if (days === -1) return `Yesterday · ${timeOfDay(date)}`
  const sameYear = date.getFullYear() === now.getFullYear()
  return `${date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }),
  })} · ${timeOfDay(date)}`
}

export function formatCreatedAt(iso: string | null | undefined): string | undefined {
  const date = iso ? validDate(iso) : null
  return date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function taskToListItem(task: Automation, chatId?: string): ScheduleListItem {
  return {
    id:          task.id,
    name:        task.name,
    description: task.summary || undefined,
    frequency:   scheduleDescription(task.schedule_json),
    isActive:    task.is_active,
    createdAt:   formatCreatedAt(task.created_at),
    chatId,
    runCount:    task.run_count,
    successRate: task.success_rate,
    isRunning:   task.is_running,
    drift:       scheduleDrift(task.schedule_json),
  }
}

/** Map one backend run into a run-history record for the detail view. A run is
 *  one turn rather than a graph — there are no steps to list, so the card is a
 *  status, a time, and what the run has to say when expanded. */
export function runToRecord(run: AutomationRun, now = new Date()): ScheduleRunRecord {
  const whenIso  = run.finished_at ?? run.started_at ?? null
  const isFailed = run.status === 'failed'
  const isDone   = run.status === 'succeeded'
  // A run the platform ended (restart, dead worker, pause mid-fire) is over but not the routine's failure.
  const isInterrupted = run.status === 'interrupted'
  const summary  = runSummary(run)
  const raw      = (run.error ?? '').trim()
  return {
    id:          run.id,
    label:       (whenIso && formatRunTime(whenIso, now)) || 'Run',
    title:       isFailed ? 'Failed' : isDone ? 'Completed' : isInterrupted ? 'Interrupted' : 'Running',
    status:      isFailed ? 'failed' : isDone ? 'complete' : isInterrupted ? 'skipped' : 'executing',
    summary,
    // Only worth offering when there's more to it than the line above.
    detail:      raw && raw !== summary ? raw : undefined,
    steps:       [],
    completedAt: run.finished_at ? validDate(run.finished_at) ?? undefined : undefined,
  }
}

export function taskDetailToDetail(task: AutomationDetail, chatId?: string, now = new Date()): ScheduleDetailItem {
  return {
    id:           task.id,
    name:         task.name,
    instructions: task.summary,
    frequency:    scheduleDescription(task.schedule_json),
    nextRun:      task.next_run_at ? formatNextRun(task.next_run_at, now) : undefined,
    lastRun:      task.last_run_at ? formatRunTime(task.last_run_at, now) : undefined,
    isActive:     task.is_active,
    createdAt:    formatCreatedAt(task.created_at),
    runHistory:   task.runs.map(run => runToRecord(run, now)),
    // Backend's own chat_id is authoritative — only fall back to the local
    // link-store mapping for schedules the backend doesn't know a chat for yet.
    chatId:       task.chat_id ?? chatId,
    runCount:     task.run_count,
    successRate:  task.success_rate,
    isRunning:    task.is_running,
    drift:        scheduleDrift(task.schedule_json),
  }
}

// Someone else's automation: the org row is all a non-owner can read, so its
// detail view is built from this row alone.
export function organizationToListItem(task: OrganizationAutomation): ScheduleListItem {
  return {
    ...taskToListItem(task),
    ownerName:  task.owner_name,
    connectors: task.connectors.map(connector => ({
      slug:    connector.slug,
      name:    connector.display_name,
      logoUrl: connector.logo_url,
    })),
  }
}

export function listItemToDetail(item: ScheduleListItem): ScheduleDetailItem {
  return {
    id:           item.id,
    name:         item.name,
    instructions: item.description ?? '',
    frequency:    item.frequency,
    isActive:     item.isActive,
    createdAt:    item.createdAt,
    chatId:       item.chatId,
    runCount:     item.runCount,
    successRate:  item.successRate,
    isRunning:    item.isRunning,
    ownerName:    item.ownerName,
    connectors:   item.connectors,
  }
}

/**
 * How to react when GET /automations/{id} fails. Only "not yours" (403) or
 * "no such row" (404) means the org list might have it; anything else
 * (network, 5xx, a malformed body) is a load failure the user can retry.
 */
export function detailFailureKind(error: unknown): 'try_organization' | 'retry' {
  return error instanceof ApiError && (error.status === 403 || error.status === 404)
    ? 'try_organization'
    : 'retry'
}

/** The reason to show in a toast description, when there is a useful one. */
export function errorDetail(error: unknown): string | undefined {
  return error instanceof ApiError && error.message ? error.message : undefined
}
