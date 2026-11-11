import { describe, expect, it } from 'vitest'
import { memberUsageCsv, orgUsageSummary, type UsageMember } from './org-usage'

const m = (id: string, creditUsed: number, extra: Partial<UsageMember> = {}): UsageMember =>
  ({ id, name: id.toUpperCase(), email: `${id}@x.com`, orgRole: 'member', creditUsed, inviteStatus: 'accepted', ...extra }) as UsageMember

describe('orgUsageSummary', () => {
  const members = [m('a', 600), m('b', 300), m('c', 0), m('p', 0, { inviteStatus: 'invite_sent' } as Partial<UsageMember>)]

  it('derives the headline numbers from the plan and active members', () => {
    const s = orgUsageSummary({ totalCredits: 2000, used: 900, monthlyPrice: 100 }, members, 'b@x.com')
    expect(s).toMatchObject({ poolPercentUsed: 45, remaining: 1100, activeCount: 3, pendingCount: 1, utilisationPct: 67, avgPerMember: 300 })
    expect(s.topUsers.map(u => [u.id, u.share, u.you])).toEqual([['a', 600 / 900, false], ['b', 300 / 900, true]])
    expect(s.topUsersNote).toBeUndefined()
  })

  it('explains when member totals differ from the plan total', () => {
    expect(orgUsageSummary({ totalCredits: 2000, used: 800 }, members).topUsersNote).toMatch(/background work.*900 credits, 100 more/)
    expect(orgUsageSummary({ totalCredits: 2000, used: 1000 }, members).topUsersNote).toMatch(/left the workspace/)
  })

  it('is all zeros without a plan or members', () => {
    expect(orgUsageSummary(null, [])).toMatchObject({ poolPercentUsed: 0, activeCount: 0, utilisationPct: 0, avgPerMember: 0, topUsers: [] })
  })
})

describe('memberUsageCsv', () => {
  it('lists active members by credits and defuses spreadsheet formulas', () => {
    const csv = memberUsageCsv([m('a', 5), m('b', 9, { name: '=HYPERLINK("x")' }), m('p', 1, { inviteStatus: 'invite_sent' } as Partial<UsageMember>)], 'Sep 19 – Oct 19, 2026')
    const lines = csv.trim().split('\n')
    // The label has a comma, so that header cell is quoted.
    expect(lines[0]).toBe('Name,Email,Role,"Credits (Sep 19 – Oct 19, 2026)"')
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")",b@x.com,member,9`)
    expect(lines[2]).toBe('A,a@x.com,member,5')
    expect(lines).toHaveLength(3)
  })
})
