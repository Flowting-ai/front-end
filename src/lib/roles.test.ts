import { describe, expect, it } from 'vitest'
import { resolveOrgBillingRole } from '@/lib/roles'

describe('resolveOrgBillingRole', () => {
  it('uses the billing-scoped role for the active organization', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'member',
      billingRole: 'admin',
      activeOrgId: 'org-1',
      billingOrgId: 'org-1',
    })).toBe('admin')
  })

  it('falls back to the organization role while billing is loading', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'admin',
      billingRole: null,
      activeOrgId: 'org-1',
      billingOrgId: null,
    })).toBe('admin')
  })

  it('does not apply a billing role from a different organization', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'member',
      billingRole: 'admin',
      activeOrgId: 'org-1',
      billingOrgId: 'org-2',
    })).toBe('member')
  })

  it('does not apply an identified billing organization before an organization is active', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'member',
      billingRole: 'admin',
      activeOrgId: null,
      billingOrgId: 'org-1',
    })).toBe('member')
  })
})
