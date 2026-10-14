import type { OrgMember } from '@/types/teams'

/**
 * Everything the org Usage page shows, derived from the plan and the member
 * list (this cycle's totals; there is no per-day series yet). Pure, so the
 * numbers are tested without rendering the page.
 */

export const TOP_USERS_LIMIT = 4

export interface UsagePlanFacts {
  totalCredits?: number | null
  used?: number | null
  isEnterprise?: boolean | null
  monthlyPrice?: number | null
}

export type UsageMember = Pick<OrgMember, 'id' | 'name' | 'email' | 'orgRole' | 'creditUsed' | 'inviteStatus'>

export interface TopUser {
  id: string
  name: string
  email: string
  role: OrgMember['orgRole']
  credits: number
  /** Share of all active members' credits, 0–1. */
  share: number
  you: boolean
}

export interface OrgUsageSummary {
  totalCredits: number
  totalUsed: number
  remaining: number
  isEnterprise: boolean
  monthlyPrice: number
  /** Plan pool used, 0–100. */
  poolPercentUsed: number
  activeCount: number
  pendingCount: number
  /** Share of active members who spent any credits this cycle, 0–100. */
  utilisationPct: number
  avgPerMember: number
  topUsers: TopUser[]
  /** Why member totals differ from the plan total, when they do. */
  topUsersNote?: string
}

export function orgUsageSummary(plan: UsagePlanFacts | null | undefined, members: readonly UsageMember[], viewerEmail?: string | null): OrgUsageSummary {
  const totalCredits = plan?.totalCredits ?? 0
  const totalUsed = plan?.used ?? 0
  const poolPercentUsed = totalCredits > 0 ? Math.min(100, Math.round((totalUsed / totalCredits) * 100)) : 0

  // "Active" = accepted the invite (the Members page's own split).
  const active = members.filter(m => m.inviteStatus !== 'invite_sent')
  const membersUsedSum = active.reduce((sum, m) => sum + m.creditUsed, 0)
  const utilisationPct = active.length > 0 ? Math.round((active.filter(m => m.creditUsed > 0).length / active.length) * 100) : 0

  const topUsers = [...active]
    .filter(m => m.creditUsed > 0)
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .slice(0, TOP_USERS_LIMIT)
    .map(m => ({
      id: m.id,
      name: m.name || m.email,
      email: m.email,
      role: m.orgRole,
      credits: m.creditUsed,
      share: membersUsedSum > 0 ? m.creditUsed / membersUsedSum : 0,
      you: !!viewerEmail && m.email === viewerEmail,
    }))

  // Member totals include metered-but-uncharged background work (titles,
  // summaries, memory), so they usually sum to a bit MORE than the plan total;
  // less means usage from people who have since left.
  const gap = membersUsedSum - totalUsed
  const topUsersNote = gap > 0
    ? `Member totals include background work (chat titles, summaries, memory) that is not charged to your plan, so together they come to ${membersUsedSum.toLocaleString()} credits, ${gap.toLocaleString()} more than the ${totalUsed.toLocaleString()} used above.`
    : gap < 0
      ? `Member totals come to ${membersUsedSum.toLocaleString()} credits, ${Math.abs(gap).toLocaleString()} less than the ${totalUsed.toLocaleString()} used above. The difference is usage from people who have left the workspace.`
      : undefined

  return {
    totalCredits,
    totalUsed,
    remaining: Math.max(0, totalCredits - totalUsed),
    isEnterprise: plan?.isEnterprise ?? false,
    monthlyPrice: plan?.monthlyPrice ?? 0,
    poolPercentUsed,
    activeCount: active.length,
    pendingCount: members.length - active.length,
    utilisationPct,
    avgPerMember: active.length > 0 ? Math.round(totalUsed / active.length) : 0,
    topUsers,
    topUsersNote,
  }
}

const csvCell = (value: string | number) => {
  const s = String(value)
  // Quote when needed, and neutralise spreadsheet formulas (=, +, -, @ at the start).
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** This cycle's per-member usage as CSV (active members, most credits first). */
export function memberUsageCsv(members: readonly UsageMember[], cycleLabel?: string): string {
  const rows = members
    .filter(m => m.inviteStatus !== 'invite_sent')
    .sort((a, b) => b.creditUsed - a.creditUsed)
    .map(m => [m.name || '', m.email, m.orgRole, m.creditUsed])
  const header = ['Name', 'Email', 'Role', `Credits${cycleLabel ? ` (${cycleLabel})` : ' this cycle'}`]
  return [header, ...rows].map(r => r.map(csvCell).join(',')).join('\n') + '\n'
}
