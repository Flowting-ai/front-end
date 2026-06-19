// ── Role capability ladder ──────────────────────────────────────────────────
// Frontend mirror of the backend permission ladder in
// SouvenirAI/services/organizations/roles.py.
//
//   Member → Editor → Admin → Owner
//
// Each capability is introduced exactly once, at the level that grants it —
// there are no `false` stubs on lower classes. All-or-nothing capabilities are
// gated by the class itself (Admin for org management, Owner for billing);
// methods that depend on a specific team/project carry the grant sets they need.
//
// `editor` is NOT a stored role: a plain `member` who holds at least one live
// TeamEditor grant resolves to Editor. This matches resolve_role() on the
// backend, so the two stay in lockstep.

/** A user's stored org-wide standing — mirrors OrganizationRole. */
export type OrgRole = 'owner' | 'admin' | 'member'

/** The resolved role including the derived `editor` rung. */
export type EffectiveRole = 'owner' | 'admin' | 'editor' | 'member'

export interface RoleGrants {
  userId: string
  /** Projects the user holds a ProjectMember grant on. */
  projectIds?: Iterable<string>
  /** Parent teams of those member projects — affiliation, not content access. */
  projectTeamIds?: Iterable<string>
  /** Teams the user holds a live TeamEditor grant on. */
  editorTeamIds?: Iterable<string>
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

  /** Publish a chat to the team — editor+ only. */
  canPublishToTeam(_teamId: string): boolean {
    return false
  }

  /** Edit project details / instructions / files, archive, delete — editor+. */
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

/** Adds full rights inside granted teams. Publishing IS can_edit_team. */
export class Editor extends Member {
  protected readonly editorTeamIds: ReadonlySet<string>

  constructor(grants: RoleGrants) {
    super(grants)
    this.editorTeamIds = new Set(grants.editorTeamIds ?? [])
  }

  override get label(): EffectiveRole {
    return 'editor'
  }

  canEditTeam(teamId: string): boolean {
    return this.editorTeamIds.has(teamId)
  }

  override canPublishToTeam(teamId: string): boolean {
    return this.canEditTeam(teamId)
  }

  override canEditProject(teamId: string): boolean {
    return this.canEditTeam(teamId)
  }

  override canActInTeam(teamId: string): boolean {
    return this.editorTeamIds.has(teamId) || super.canActInTeam(teamId)
  }
}

/** Adds the whole org: every team and project, team CRUD, member management. */
export class Admin extends Editor {
  override get label(): EffectiveRole {
    return 'admin'
  }

  override canEditTeam(_teamId: string): boolean {
    return true
  }

  override canActInTeam(_teamId: string): boolean {
    return true
  }

  override get canManageOrg(): boolean {
    return true
  }
}

/** Adds billing and payment authority. Exactly one per org. */
export class Owner extends Admin {
  override get label(): EffectiveRole {
    return 'owner'
  }

  override get canManageBilling(): boolean {
    return true
  }
}

// ── Resolution ───────────────────────────────────────────────────────────────

/** Concrete role for one org. Editor iff a plain member holds at least one live
 *  TeamEditor grant. Owner/Admin skip the grant check. Mirrors resolve_role(). */
export function resolveRole(orgRole: OrgRole, grants: RoleGrants): Member {
  if (orgRole === 'owner') return new Owner(grants)
  if (orgRole === 'admin') return new Admin(grants)
  const hasEditorGrant = grants.editorTeamIds != null && [...grants.editorTeamIds].length > 0
  if (hasEditorGrant) return new Editor(grants)
  return new Member(grants)
}
