import type { PlanItem } from '@/types/chat'

// A turn's plan, from the proposed `plan_updated` stream event: every step up front, each
// moving pending → in_progress → completed (or failed). The backend does not emit it yet;
// see the schema in lib/api/sse-schemas.ts for the contract.

const STATUSES: ReadonlySet<string> = new Set(['pending', 'in_progress', 'completed', 'failed'])

/** The event's items as PlanItems — malformed rows dropped — or null when there are none. */
export function toPlan(items: unknown): PlanItem[] | null {
  if (!Array.isArray(items)) return null
  const plan = items.flatMap((item): PlanItem[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.title !== 'string' || !STATUSES.has(row.status as string)) return []
    const detail = typeof row.detail === 'string' && row.detail.trim() ? row.detail : undefined
    return [{ id: row.id, title: row.title, status: row.status as PlanItem['status'], detail }]
  })
  return plan.length > 0 ? plan : null
}
