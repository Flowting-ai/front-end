export type WorkspaceRole = 'admin' | 'editor' | 'member'
export type OrgRole = 'owner' | 'admin' | 'member'
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
  /** UI role used by the editable role control: owner+admin collapse to 'admin'. */
  role: WorkspaceRole
  /** Raw backend role ('owner' | 'admin' | 'member') — use for display so the
   *  workspace owner shows as "Owner" rather than "Admin". */
  orgRole: OrgRole
  inviteStatus: InviteStatus
  teamMemberships: TeamMembership[]
  /** Total product usage for this member during the current org billing period. */
  creditUsed: number
  /** Portion of usage consumed from this member's assigned workspace allocation. */
  allocationUsed: number
  creditCap?: number
  joinedAt?: string
}

export interface TeamMembership {
  teamId: string
  teamName: string
  isTeamOwner: boolean
}

/** Matches the API TeamResponse — fields come directly from the backend. */
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

/** A person reference returned by editor/member list endpoints (PersonResponse). */
export interface TeamEditor {
  userId: string
  name: string | null
  email: string | null
  /** Admin-grantable: editor may link/share connector accounts to the team. */
  canLinkAccounts: boolean
}

/** Returned after creating a team invite. */
export interface TeamInvite {
  id: string
  teamId: string
  recipientEmails: string[]
  expiresAt: string
  inviteUrl: string
}

// ── Team-invite onboarding ─────────────────────────────────────────────────────
// The rich payload the backend returns for an invitee landing in the dedicated
// team-invite onboarding flow (distinct from the individual onboarding). It
// describes the org / team / projects and the people the invitee is joining.

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
  /** Per-member monthly credit cap; 0 means uncapped / not set. */
  creditCap: number
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
  // ── Team being joined ─────────────────────────────────────────────────────
  teamId: string
  teamName: string
  teamDescription: string
  // ── Parent organization ───────────────────────────────────────────────────
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
  grantTeamEditor: boolean
  grantTeamViewer: boolean
  /**
   * Monthly credit cap applied to the invitee, in display credits.
   * `null` means no cap was set for this invite (don't surface it at all);
   * a number is the assigned cap.
   */
  creditCap: number | null
  // ── Default project the invite points at (optional) ───────────────────────
  projectId: string | null
  projectName: string | null
  // ── Team roster ───────────────────────────────────────────────────────────
  memberCount: number
  members: InvitedMember[]
  // ── Team projects ─────────────────────────────────────────────────────────
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

export interface AdminBillingPerms {
  /** Admin can see and click "Buy more Credits". */
  canTopUp: boolean
  /** Admin can see the Payment section (card details + Stripe portal). */
  canManagePayment: boolean
  /** Admin can see Invoice history. */
  canViewInvoices: boolean
}

export interface OrgSettings {
  organizationId: string
  orgInstructions: string | null
  allowedEmailDomains: string[] | null
  defaultChatVisibility: string | null
  defaultPersonaVisibility: string | null
  /** What billing sections admins are permitted to see. Defaults to all-on. */
  adminBillingPerms: AdminBillingPerms
}

export interface TeamBurn {
  teamId: string
  teamName: string
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
  members: OrgMember[]
  includedUsageUsd: number
  providerUsageUsd: number
  includedUsageRemainingUsd: number
  overageUsd: number
  projectedInvoiceUsd: number
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cachedTokens: number
  totalTokens: number
  usageEventCount: number
  meteredEventCount: number
}

export interface OrgPlanUsage {
  organizationId: string
  byTeam: TeamBurn[]
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
