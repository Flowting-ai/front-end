'use client'

// ── Brain home "Recent activity" bootstrap ──────────────────────────────────
// Extracted from brain/page.tsx (which was flagged giant + high-complexity,
// the single largest file in the whole performance-report audit series — see
// docs v2/performance report/brain-tasks/03-brain-tasks-feature-report.md §7
// item 9 / §9 Phase 9) as one genuinely self-contained piece: it only feeds
// the empty-composer home view's "Active schedules" / "Recent activity"
// rail, has no dependency on the rest of the page's phase/timeline state
// machine, and its own dependency (whether a chat id is present in the URL)
// is passed in rather than read directly, so it stays trivially testable in
// isolation.
import { useEffect, useState } from 'react'
import { getAutomation, listAutomations, runSummary, type Automation } from '@/lib/api/automations'
import type { ActiveSchedule, DigestItem } from '@/templates/Brain'

function brainHomeTime(iso: string): string {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return ''
  const now = new Date()
  const sameDay = value.toDateString() === now.toDateString()
  const day = sameDay
    ? 'Today'
    : value.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${day} · ${value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

/**
 * Fetches the schedules list once (when `skip` is false, i.e. the home/empty
 * composer view is showing, not an existing task's timeline) and derives:
 *   - `homeSchedules` — active schedules with a future run, soonest first.
 *   - `homeDigest`    — up to 3 most-recently-completed schedule runs, newest
 *                       first, each with a human-readable summary.
 * `skip` is the caller's `!!chatIdFromUrl` — this data is only ever shown on
 * the home/empty-composer state, so there's nothing to fetch once a specific
 * task is open.
 */
export function useBrainHomeDigest(skip: boolean) {
  const [homeSchedules, setHomeSchedules] = useState<ActiveSchedule[]>([])
  const [homeDigest, setHomeDigest] = useState<DigestItem[]>([])

  useEffect(() => {
    if (skip) return
    let cancelled = false
    const seenKey = 'brain_schedule_last_seen_at'
    const now = Date.now()
    const storedSeen = Number(window.localStorage.getItem(seenKey) ?? '')
    const cutoff = Number.isFinite(storedSeen) && storedSeen > 0
      ? storedSeen
      : now - 24 * 60 * 60 * 1000

    void listAutomations()
      .then(async (rawTasks) => {
        if (cancelled) return
        const tasks: Automation[] = Array.isArray(rawTasks) ? rawTasks : []
        setHomeSchedules(tasks
          .filter((task) => task.is_active && task.next_run_at)
          .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime())
          .map((task) => ({
            id: task.id,
            name: task.name,
            nextRun: brainHomeTime(task.next_run_at!),
          })))

        const recent = tasks
          .filter((task) => task.last_run_at && new Date(task.last_run_at).getTime() > cutoff)
          .sort((a, b) => new Date(b.last_run_at!).getTime() - new Date(a.last_run_at!).getTime())
          .slice(0, 3)
        const details = await Promise.all(recent.map((task) => getAutomation(task.id).catch(() => null)))
        if (cancelled) return
        setHomeDigest(details.flatMap((task): DigestItem[] => {
          if (!task) return []
          const run = [...(task.runs ?? [])]
            .sort((a, b) => new Date(b.finished_at ?? b.started_at ?? 0).getTime()
              - new Date(a.finished_at ?? a.started_at ?? 0).getTime())[0]
          if (!run) return []
          const ranAt = run.finished_at ?? run.started_at
          return [{
            scheduleId: task.id,
            scheduleName: task.name,
            ranAt: ranAt ? brainHomeTime(ranAt) : 'Recent run',
            summary: runSummary(run),
            status: run.status === 'succeeded' ? 'complete' : run.status === 'failed' ? 'failed' : 'partial',
          }]
        }))
        window.localStorage.setItem(seenKey, String(now))
      })
      .catch(() => {
        if (!cancelled) {
          setHomeSchedules([])
          setHomeDigest([])
        }
      })
    return () => { cancelled = true }
  }, [skip])

  return { homeSchedules, homeDigest }
}
