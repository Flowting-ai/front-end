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
  role: WorkspaceRole
  inviteStatus: InviteStatus
  teamMemberships: TeamMembership[]
  creditUsed: number
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
  createdAt: string
  updatedAt: string
}

/** A person reference returned by editor/member list endpoints (PersonResponse). */
export interface TeamEditor {
  userId: string
  name: string | null
  email: string | null
}

/** Returned after creating a team invite. */
export interface TeamInvite {
  id: string
  teamId: string
  recipientEmails: string[]
  expiresAt: string
  inviteUrl: string
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
