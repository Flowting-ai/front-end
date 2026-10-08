// ── Notification sources ─────────────────────────────────────────────────────
// Fetch side of the bell. Each loader returns null when its data couldn't be
// read this cycle, so the provider keeps the previous rows instead of
// flashing everything away on a transient error.

import { getAutomation, listAutomations, type Automation } from '@/lib/api/automations'
import { fetchPersonas, isPersonaOwnedByViewer, type Persona } from '@/lib/api/personas'
import { fetchModelsWithCache } from '@/lib/ai-models'
import { buildModelBlockedMap, buildModelNameMap, findUnavailableAgentModels, type UnavailableAgentModel } from '@/lib/agent-model-health'
import { parseServerDate } from '@/lib/utils/format-utils'
import { SCHEDULE_RUN_LOOKBACK_MS, scheduleRunNotifications } from './build'
import type { AppNotification, TeamRequest } from './types'

// ── Schedules ─────────────────────────────────────────────────────────────────
// GET /automations has counts but no runs; runs only come with the per-
// automation detail. So detail is fetched only for automations that ran inside
// the lookback window AND whose run counters moved since the last poll — a
// steady state costs one list call per poll.

export interface ScheduleCacheEntry {
  signature: string
  rows:      AppNotification[]
}

const DETAIL_CONCURRENCY = 4

function runSignature(a: Automation): string {
  return [a.last_run_at ?? '', a.run_count, a.success_count, a.failure_count, a.running_count].join('|')
}

function ranRecently(a: Automation, nowMs: number): boolean {
  const last = parseServerDate(a.last_run_at)
  return !!last && nowMs - last.getTime() <= SCHEDULE_RUN_LOOKBACK_MS && a.run_count > 0
}

/** Mutates `cache` (automation id → last signature + rows) and returns the
 *  combined rows, or null if the list itself couldn't be fetched. */
export async function loadScheduleNotifications(
  cache: Map<string, ScheduleCacheEntry>,
  nowMs: number = Date.now(),
): Promise<AppNotification[] | null> {
  let automations: Automation[]
  try {
    const list = await listAutomations()
    automations = Array.isArray(list) ? list : []
  } catch {
    return null
  }

  const recent = automations.filter(a => ranRecently(a, nowMs))
  const live = new Set(recent.map(a => a.id))
  for (const id of [...cache.keys()]) if (!live.has(id)) cache.delete(id)

  const stale = recent.filter(a => cache.get(a.id)?.signature !== runSignature(a))
  for (let i = 0; i < stale.length; i += DETAIL_CONCURRENCY) {
    await Promise.all(stale.slice(i, i + DETAIL_CONCURRENCY).map(async a => {
      try {
        const detail = await getAutomation(a.id)
        cache.set(a.id, {
          signature: runSignature(a),
          rows:      scheduleRunNotifications({ id: a.id, name: detail.name || a.name }, detail.runs ?? [], nowMs),
        })
      } catch {
        // Keep whatever we had; the unchanged signature check retries next poll.
      }
    }))
  }

  return recent.flatMap(a => cache.get(a.id)?.rows ?? [])
}

// ── Agents whose model can't run ──────────────────────────────────────────────

export interface AgentModelSnapshot {
  rows:       UnavailableAgentModel[]
  modelNames: Map<string, string>
}

/** Same visibility rule as the /agents library: team-shared agents only
 *  count for the viewer who owns them (see isPersonaOwnedByViewer). */
export async function loadAgentModelSnapshot(viewerIsAdmin: boolean): Promise<AgentModelSnapshot | null> {
  try {
    const [personas, models] = await Promise.all([fetchPersonas(), fetchModelsWithCache()])
    // An empty catalog means the fetch failed (fetchModelsWithCache swallows
    // errors) — every agent would read as "retired". Treat as unknown.
    if (!models.length) return null
    const isVisible = (p: Persona) => p.visibility !== 'team' || isPersonaOwnedByViewer(p, {}, null, viewerIsAdmin)
    return {
      rows:       findUnavailableAgentModels(personas, buildModelBlockedMap(models), isVisible),
      modelNames: buildModelNameMap(models),
    }
  } catch {
    return null
  }
}

// ── Team requests (admins) ────────────────────────────────────────────────────

/**
 * Pending connector / credit / permission requests from team members.
 *
 * No backend stores these yet — credit requests only exist as a Slack DM to
 * the billing admin, and the connector-request UI was never wired to an
 * endpoint. Returns an empty list until a list endpoint exists; swap the body
 * for that call (it should return TeamRequest[]) and the bell, routing and
 * admin gating already handle the rest. The dev playground covers the UI.
 */
export async function fetchTeamRequests(): Promise<TeamRequest[]> {
  return []
}
