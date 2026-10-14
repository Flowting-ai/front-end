import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api/organization', () => ({ getOrg: vi.fn(), listOrganizations: vi.fn(), listMembers: vi.fn(), listAudit: vi.fn() }))
vi.mock('@/lib/api/plan', () => ({ Plan: { fetch: vi.fn() } }))

import { QueryClient } from '@tanstack/react-query'
import { listMembers } from '@/lib/api/organization'
import { Plan } from '@/lib/api/plan'
import { queryKeys } from '@/lib/query-keys'
import { deriveOrg, orgMembersQuery, refreshOrgMembers, type OrgInfo } from './org-queries'

const info = { id: 'o1', name: 'Acme', planType: 'teams', role: 'admin' } as OrgInfo

describe('deriveOrg', () => {
  it('is null until the org record or plan loads, and with no org', () => {
    expect(deriveOrg(null, info, null)).toBeNull()
    expect(deriveOrg('o1', undefined, null)).toBeNull()
  })
  it("prefers the plan's type over the org record's", () => {
    expect(deriveOrg('o1', info, null)).toEqual({ id: 'o1', name: 'Acme', plan: 'teams' })
    expect(deriveOrg('o1', info, { planType: 'enterprise' } as Plan)).toEqual({ id: 'o1', name: 'Acme', plan: 'enterprise' })
  })
})

describe('orgMembersQuery', () => {
  it('falls back to the members bundled in the plan when /members fails', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(listMembers).mockRejectedValueOnce(new Error('down'))
    vi.mocked(Plan.fetch).mockResolvedValueOnce({ members: [{ id: 'm1' }] } as unknown as Plan)
    await expect(qc.fetchQuery(orgMembersQuery(qc, 'o1'))).resolves.toEqual([{ id: 'm1' }])
  })

  it('refreshOrgMembers invalidates plan and members only', () => {
    const qc = new QueryClient()
    for (const key of [queryKeys.orgs.plan('o1'), queryKeys.orgs.members('o1'), queryKeys.orgs.info('o1')]) qc.setQueryData(key, {})
    refreshOrgMembers(qc, 'o1')
    expect(qc.getQueryState(queryKeys.orgs.plan('o1'))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.orgs.members('o1'))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.orgs.info('o1'))?.isInvalidated).toBe(false)
  })
})
