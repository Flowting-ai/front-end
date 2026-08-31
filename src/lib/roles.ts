// ── Role capability ladder ──────────────────────────────────────────────────
// Frontend mirror of the backend permission ladder in
// SouvenirAI/services/organizations/roles.py.
//
//   Member → Admin
//
// Each capability is introduced exactly once, at the level that grants it —
// there are no `false` stubs on lower classes. All-or-nothing capabilities are
// gated by the class itself (Admin for org management AND billing — any
// number of admins per org, all equal, no separate owner tier); methods that
// depend on a specific project carry the grant sets they need.

/** A user's stored org-wide standing — mirrors OrganizationRole. */
export type OrgRole = 'admin' | 'member'

/** The resolved role. */
export type EffectiveRole = 'admin' | 'member'

export interface RoleGrants {
  userId: string
  /** Projects the user holds a ProjectMember grant on. */
  projectIds?: Iterable<string>
  /** Parent teams of those member projects — affiliation, not content access. */
  projectTeamIds?: Iterable<string>
}

/**
 * Resolve the role used for organization billing controls.
 *
 * The billing snapshot is authoritative for billing actions because it is
 * resolved against the same billing entity as the Stripe portal endpoint.
 * Fall back to the general organization role while that snapshot is loading,
 * or when a snapshot explicitly belongs to a different organization.
 */
export function resolveOrgBillingRole({
  orgRole,
  billingRole,
  activeOrgId,
  billingOrgId,
}: {
  orgRole: OrgRole
  billingRole: string | null | undefined
  activeOrgId: string | null
  billingOrgId: string | null | undefined
}): OrgRole {
  const billingMatchesActiveOrg =
    !billingOrgId || (activeOrgId !== null && billingOrgId === activeOrgId)
  const isKnownBillingRole =
    billingRole === 'admin' || billingRole === 'member'

  return billingMatchesActiveOrg && isKnownBillingRole ? billingRole : orgRole
}

// ── The ladder ───────────────────────────────────────────────────────────────

/** Baseline: access comes only from ProjectMember grant rows. */
export class Member {
  readonly userId: string
  protected readonly projectIds: ReadonlySet<string>
  protected readonly projectTeamIds: ReadonlySet<string>

  constructor(grants: RoleGrants) {
    this.userId = grants.userId
    this.projectIds = new Set(grants.projectIds ?? [])
    this.projectTeamIds = new Set(grants.projectTeamIds ?? [])
  }

  /** The badge/label to show for this role. */
  get label(): EffectiveRole {
    return 'member'
  }

  /** Affiliation: can see the team's name, file connector requests, target
   *  chat shares at it. NOT content access. */
  canActInTeam(teamId: string): boolean {
    return this.projectTeamIds.has(teamId)
  }

  /** Access to a specific project via a ProjectMember grant. */
  canAccessProject(projectId: string): boolean {
    return this.projectIds.has(projectId)
  }

  /** Publish a chat to the team — admin+ only. */
  canPublishToTeam(_teamId: string): boolean {
    return false
  }

  /** Edit project details / instructions / files, archive, delete — admin+. */
  canEditProject(_teamId: string): boolean {
    return false
  }

  /** Org-wide management: invites, members, caps, roles, connectors. */
  get canManageOrg(): boolean {
    return false
  }

  /** Billing & payment authority: plans, top-ups, invoices, card on file. */
  get canManageBilling(): boolean {
    return false
  }
}

/** Adds the whole org: every team and project, team CRUD, member management,
 *  and billing/payment authority — any number of admins per org, all equal. */
export class Admin extends Member {
  override get label(): EffectiveRole {
    return 'admin'
  }

  override canPublishToTeam(_teamId: string): boolean {
    return true
  }

  override canEditProject(_teamId: string): boolean {
    return true
  }

  override canActInTeam(_teamId: string): boolean {
    return true
  }

  override get canManageOrg(): boolean {
    return true
  }

  override get canManageBilling(): boolean {
    return true
  }
}

// ── Resolution ───────────────────────────────────────────────────────────────

/** Concrete role for one org. Mirrors resolve_role() on the backend. */
export function resolveRole(orgRole: OrgRole, grants: RoleGrants): Member {
  if (orgRole === 'admin') return new Admin(grants)
  return new Member(grants)
}
