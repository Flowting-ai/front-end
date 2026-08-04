import { describe, expect, it } from 'vitest'
import { resolveOrgBillingRole } from '@/lib/roles'

describe('resolveOrgBillingRole', () => {
  it('uses the billing-scoped owner role for the active organization', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'admin',
      billingRole: 'owner',
      activeOrgId: 'org-1',
      billingOrgId: 'org-1',
    })).toBe('owner')
  })

  it('falls back to the organization role while billing is loading', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'owner',
      billingRole: null,
      activeOrgId: 'org-1',
      billingOrgId: null,
    })).toBe('owner')
  })

  it('does not apply a billing role from a different organization', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'member',
      billingRole: 'owner',
      activeOrgId: 'org-1',
      billingOrgId: 'org-2',
    })).toBe('member')
  })

  it('does not apply an identified billing organization before an organization is active', () => {
    expect(resolveOrgBillingRole({
      orgRole: 'member',
      billingRole: 'owner',
      activeOrgId: null,
      billingOrgId: 'org-1',
    })).toBe('member')
  })
})
