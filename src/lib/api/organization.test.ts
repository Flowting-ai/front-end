import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchJson } = vi.hoisted(() => ({ apiFetchJson: vi.fn() }))

vi.mock('./client', async importOriginal => {
  const actual = await importOriginal<typeof import('./client')>()
  return { ...actual, apiFetchJson }
})

import { getOrgPlan, listMembers } from './organization'

// Regression coverage for a live ZodError: services/organizations/schemas.py's
// MemberResponse declares a `serialization_alias` on every multi-word field
// (userId, usageTotal, inviteStatus, inviteId, isPendingInvite), and FastAPI
// serializes with `by_alias=True` by default — so the actual wire shape is
// camelCase even though PlanResponse's own top-level fields (organization_id,
// plan_type, ...) have no alias and stay snake_case.

function rawPlan(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: 'org-1',
    plan_type: null,
    billing_model: 'prepaid',
    plan_credits: 0,
    topup_credits: 0,
    total_credits: 0,
    used: 0,
    remaining: 0,
    percent_used: 0,
    pool_status: 'healthy',
    members: [{
      userId: 'user-1',
      name: 'Ada',
      email: 'ada@example.com',
      role: 'owner',
      usageTotal: 12.5,
      inviteStatus: 'active',
      inviteId: null,
      isPendingInvite: false,
    }],
    ...overrides,
  }
}

describe('getOrgPlan', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
  })

  it('parses a null plan_type and camelCase member fields without throwing', async () => {
    apiFetchJson.mockResolvedValue(rawPlan())

    const plan = await getOrgPlan('org-1')

    expect(plan.planType).toBe('teams') // null plan_type falls back to 'teams'
    expect(plan.members).toEqual([expect.objectContaining({
      id:         'user-1',
      email:      'ada@example.com',
      inviteStatus: 'signed_up',
      creditUsed: 12500, // toDisplayCredits(12.5)
    })])
  })

  it('treats a null usageTotal as zero instead of throwing', async () => {
    apiFetchJson.mockResolvedValue(rawPlan({
      members: [{
        userId: 'user-2', name: null, email: null, role: 'member',
        usageTotal: null, inviteStatus: 'pending', inviteId: 'invite-1', isPendingInvite: true,
      }],
    }))

    const plan = await getOrgPlan('org-1')
    expect(plan.members[0].creditUsed).toBe(0)
  })
})

describe('listMembers', () => {
  beforeEach(() => {
    apiFetchJson.mockReset()
  })

  it('parses the same camelCase MemberResponse shape as getOrgPlan', async () => {
    apiFetchJson.mockResolvedValue([{
      userId: 'user-1', name: 'Ada', email: 'ada@example.com', role: 'admin',
      usageTotal: 0, inviteStatus: 'active', inviteId: null, isPendingInvite: false,
    }])

    const members = await listMembers('org-1')
    expect(members[0]).toEqual(expect.objectContaining({ id: 'user-1', email: 'ada@example.com' }))
  })
})
