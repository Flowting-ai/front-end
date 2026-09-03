export type WorkspaceRole = 'admin' | 'member'
/** The current viewer's own org-wide standing — never 'service' (a machine
 *  principal can't be the one loading this UI). */
export type OrgRole = 'admin' | 'member'
/** Raw per-member role as the backend can report it on any OTHER member row —
 *  includes 'owner' (the org's creator; folds into 'admin' for UI purposes,
 *  same as the viewer-role fold in org-context.tsx) and 'service' (e.g. a
 *  Slack bot member that never signed up). */
export type MemberOrgRole = 'admin' | 'member' | 'service' | 'owner'
export type InviteStatus = 'not_invited' | 'invite_sent' | 'signed_up'
export type TokenStatus = 'normal' | 'warning_80' | 'warning_95' | 'grace' | 'locked'
export type ConnectorAuthority = 'workspace_only' | 'member_required' | 'both_possible'
export type HITLThreshold = 'auto' | 'tier_3_plus' | 'everything'
export type ApprovalStatus = 'pending' | 'accepted' | 'denied'

export interface WorkspaceOrg {
  id: string
  name: string
  domain?: string
  avatarUrl?: string
  plan: 'teams' | 'enterprise'
  monthlyPrice: number
  billingCycle: 'monthly' | 'annual'
  creditPool: CreditPool
  tokenStatus: TokenStatus
  hitlThreshold: HITLThreshold
}

export interface CreditPool {
  total: number
  used: number
  remaining: number
  percentUsed: number
  graceDaysRemaining?: number
}

export interface OrgMember {
  id: string
  name: string
  email: string
  avatarUrl?: string
  /** UI role used by the editable role control. */
  role: WorkspaceRole
  /** Raw backend role for this member row ('admin' | 'member' | 'service'). */
  orgRole: MemberOrgRole
  inviteStatus: InviteStatus
  teamMemberships: TeamMembership[]
  /** Total product usage for this member during the current org billing period. */
  creditUsed: number
  joinedAt?: string
  /** Backend invite ID for pending members — used to call the revoke endpoint. */
  inviteId?: string | null
}

export interface TeamMembership {
  teamId: string
  teamName: string
  isTeamOwner: boolean
}

/**
 * Matches the API TeamResponse — fields come directly from the backend.
 * `org-context.tsx`'s `teams` can never be non-empty any more (the Team
 * table is dropped), so every consumer of this type is provably dead code
 * still to be cleaned up — tracked as A5 in backend-alignment-execution-map.md,
 * not touched here.
 */
export interface Team {
  id: string
  organizationId: string
  name: string
  description: string
  tags: string[]
  archived: boolean
  canEdit: boolean
  /** The caller's role in this team: owner/admin (org-wide) or editor/member (per-team). */
  myRole: 'owner' | 'admin' | 'editor' | 'member'
  createdAt: string
  updatedAt: string
}

/** Returned after creating an org-level invite. */
export interface Invite {
  id: string
  organizationId: string
  recipientEmails: string[]
  expiresAt: string
  inviteUrl: string
}

// ── Team-invite onboarding ─────────────────────────────────────────────────────
// The rich payload the backend returns for an invitee landing in the dedicated
// team-invite onboarding flow (distinct from the individual onboarding). Despite
// the name (kept for route/flow continuity — `onboarding/team/[inviteId]/*`),
// there is no Team entity any more: this describes the organization/projects and
// the people the invitee is joining, straight off the real `InvitePreview` shape.

/** A person reference inside the invite onboarding payload. */
export interface InvitedMember {
  userId: string
  name: string
  /** Pre-computed display initials (e.g. "JS"). */
  initials: string
  email: string
  /** Avatar URL; null when the member has no image. */
  image: string | null
  role: OrgRole
}

/** A project the invitee will (or may) be a member of. */
export interface InvitedProject {
  id: string
  title: string
  description: string
  memberCount: number
  members: InvitedMember[]
}

/** Full context for the team-invite onboarding flow. */
export interface TeamInviteOnboarding {
  inviteId: string
  // ── Organization being joined ─────────────────────────────────────────────
  organizationId: string
  organizationName: string
  organizationDescription: string
  organizationLogoUrl: string | null
  // ── Who invited them ──────────────────────────────────────────────────────
  invitedByName: string
  invitedByEmail: string
  invitedByImage: string | null
  // ── What the invite grants ────────────────────────────────────────────────
  role: OrgRole
  // ── Default project the invite points at (optional) ───────────────────────
  projectId: string | null
  projectName: string | null
  // ── Org's projects (a capped preview; projectCount is the true total) ────
  projectCount: number
  projects: InvitedProject[]
  // ── Organization roster ───────────────────────────────────────────────────
  organizationMemberCount: number
  organizationMembers: InvitedMember[]
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  expiresAt: string
}

export interface TeamProject {
  id: string
  teamId: string
  name: string
  slackChannelMapping?: string
}

export interface WorkspaceConnector {
  id: string
  name: string
  iconSlug: string
  authority: ConnectorAuthority
  status: 'connected' | 'not_connected' | 'auth_in_progress' | 'auth_failed'
  connectedBy?: string
  connectedAt?: string
}

export interface SlackChannelMapping {
  channelName: string
  teamId: string
  teamName: string
  projectId?: string
  projectName?: string
  botPermissions: 'read_only' | 'brain_runs' | 'write_actions'
}

export interface ActivityEntry {
  id: string
  timestamp: string
  memberId: string
  memberName: string
  actionType:
    | 'connector_connected' | 'connector_disconnected'
    | 'automation_run' | 'settings_changed'
    | 'member_invited' | 'member_removed' | 'role_changed'
    | 'team_created' | 'team_archived' | 'persona_published'
  detail: string
}

export interface OrgSettings {
  organizationId: string
  orgInstructions: string | null
  allowedEmailDomains: string[] | null
  defaultChatVisibility: string | null
  defaultPersonaVisibility: string | null
}

export interface MemberBurn {
  userId: string
  name: string | null
  email: string | null
  creditsUsed: number
}

export interface OrgPlan {
  organizationId: string
  planType: 'teams' | 'enterprise'
  billingModel: 'prepaid' | 'postpaid'
  planCredits: number
  topupCredits: number
  totalCredits: number
  used: number
  remaining: number
  percentUsed: number
  poolStatus: string
  poolCapUsd: number | null
  members: OrgMember[]
  includedUsageUsd: number
  providerUsageUsd: number
  includedUsageRemainingUsd: number
  overageUsd: number
  projectedInvoiceUsd: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  totalTokens: number
  usageEventCount: number
}

export interface OrgPlanUsage {
  organizationId: string
  byMember: MemberBurn[]
}

export interface AuditLogEntry {
  id: string
  actorUserId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  targetName: string | null
  extra: Record<string, unknown> | null
  createdAt: string
}

export interface ApprovalRequest {
  id: string
  tier: 3 | 4 | 5 | 6
  actionType: 'update' | 'delete' | 'send' | 'publish'
  connectorName: string
  targetName: string
  description: string
  reversible: boolean
  reversalDescription?: string
  status: ApprovalStatus
}
