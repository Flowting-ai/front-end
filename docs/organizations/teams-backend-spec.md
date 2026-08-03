# Teams Backend Implementation Spec

> **Scope:** Workspace-level (Teams plan) endpoints — none of these are shared with individual-user flows.
> **Reference:** Existing API at `docs/openapi/openapi.yaml`. All new endpoints follow the same REST + JSON conventions.
> **Auth:** Every endpoint requires `Authorization: Bearer <token>` unless noted as public.

---

## Table of Contents

1. [Data Models](#1-data-models)
2. [Authentication & Role Matrix](#2-authentication--role-matrix)
3. [Workspace Endpoints](#3-workspace-endpoints)
4. [Members Endpoints](#4-members-endpoints)
5. [Teams Endpoints](#5-teams-endpoints)
6. [Activity Log Endpoints](#6-activity-log-endpoints)
7. [Analytics Endpoints](#7-analytics-endpoints)
8. [Security Endpoints](#8-security-endpoints)
9. [Plans & Billing Endpoints](#9-plans--billing-endpoints)
10. [Connectors (Workspace) Endpoints](#10-connectors-workspace-endpoints)
11. [Approval Gates (HITL) Endpoints](#11-approval-gates-hitl-endpoints)
12. [Slack Integration Endpoints](#12-slack-integration-endpoints)
13. [Persona Visibility Endpoints](#13-persona-visibility-endpoints)
14. [Project Team Publishing Endpoints](#14-project-team-publishing-endpoints)
15. [Onboarding Endpoints](#15-onboarding-endpoints)
16. [Hardcoded Values → Dynamic API Mapping](#16-hardcoded-values--dynamic-api-mapping)

---

## 1. Data Models

### WorkspaceOrg

```typescript
interface WorkspaceOrg {
  id: string                        // e.g. "ws_01HXN3K7Y2BVQTM4Z"
  name: string                      // e.g. "Acme Inc"
  slug: string                      // URL-safe identifier, e.g. "acme-inc"
  domain?: string                   // Primary verified domain
  avatarUrl?: string                // Workspace logo URL
  plan: 'teams' | 'enterprise'
  monthlyPrice: number              // e.g. 150
  billingCycle: 'monthly' | 'annual'
  creditPool: CreditPool
  tokenStatus: TokenStatus          // 'normal' | 'warning_80' | 'warning_95' | 'grace' | 'locked'
  hitlThreshold: HITLThreshold      // 'auto' | 'tier_3_plus' | 'everything'
  aiInstructions?: string           // Workspace-level AI instructions (max 3000 chars)
  createdAt: string                 // ISO 8601
}
```

### CreditPool

```typescript
interface CreditPool {
  total: number                     // Total credits this cycle
  used: number                      // Credits consumed
  remaining: number                 // total - used
  percentUsed: number               // 0–100
  graceDaysRemaining?: number       // Present when tokenStatus === 'grace'
}
```

### OrgMember

```typescript
interface OrgMember {
  id: string
  name: string
  email: string
  avatarUrl?: string
  role: WorkspaceRole               // 'admin' | 'editor' | 'member'
  inviteStatus: InviteStatus        // 'not_invited' | 'invite_sent' | 'signed_up'
  teamMemberships: TeamMembership[]
  creditUsed: number
  creditCap?: number                // null = unlimited
  joinedAt?: string                 // ISO 8601, absent for pending invites
}

interface TeamMembership {
  teamId: string
  teamName: string
  isTeamOwner: boolean
}
```

### Team

```typescript
interface Team {
  id: string
  name: string
  description?: string
  status: TeamStatus                // 'active' | 'archived' | 'tombstone'
  memberCount: number
  owners: { id: string; name: string }[]
  projects: TeamProject[]
  creditUsed: number
  createdAt: string                 // ISO 8601
  archivedAt?: string               // ISO 8601, present when status === 'archived'
  permanentDeleteAt?: string        // ISO 8601, scheduled hard-delete date (tombstone)
  permanentlyDeletedAt?: string     // ISO 8601, set after hard deletion
}

interface TeamProject {
  id: string
  teamId: string
  name: string
  slackChannelMapping?: string      // Slack channel ID
}
```

### WorkspaceConnector

```typescript
interface WorkspaceConnector {
  id: string
  name: string
  iconSlug: string                  // matches connector slug in catalog
  authority: ConnectorAuthority     // 'workspace_only' | 'member_required' | 'both_possible'
  status: 'connected' | 'not_connected' | 'auth_in_progress' | 'auth_failed'
  connectedBy?: string              // Display name of admin who connected it
  connectedAt?: string              // ISO 8601
}
```

### SlackChannelMapping

```typescript
interface SlackChannelMapping {
  id: string
  channelId: string                 // Slack channel ID
  channelName: string               // e.g. "#marketing"
  teamId: string
  teamName: string
  projectId?: string
  projectName?: string
  botPermissions: 'read_only' | 'brain_runs' | 'write_actions'
}
```

### ActivityEntry

```typescript
interface ActivityEntry {
  id: string
  timestamp: string                 // ISO 8601
  memberId: string
  memberName: string
  actionType: ActivityActionType
  detail: string                    // Human-readable description
}

type ActivityActionType =
  | 'connector_connected'
  | 'connector_disconnected'
  | 'automation_run'
  | 'settings_changed'
  | 'member_invited'
  | 'member_removed'
  | 'role_changed'
  | 'team_created'
  | 'team_archived'
  | 'persona_published'
```

### ApprovalRequest

```typescript
interface ApprovalRequest {
  id: string
  tier: 3 | 4 | 5 | 6              // HITL action tier
  actionType: 'update' | 'delete' | 'send' | 'publish'
  connectorName: string
  targetName: string
  description: string
  reversible: boolean
  reversalDescription?: string
  status: ApprovalStatus            // 'pending' | 'accepted' | 'denied'
  requestedBy: string               // memberId
  requestedAt: string               // ISO 8601
  resolvedAt?: string               // ISO 8601
  resolvedBy?: string               // memberId
  denyReason?: DenyReason
}

type DenyReason = 'Wrong target' | 'Not right time' | 'Needs editing' | 'Other'
```

### Plan & Billing Types

```typescript
interface WorkspacePlan {
  id: string
  name: string                      // e.g. "Teams", "Enterprise"
  monthlyPrice: number
  billingCycle: 'monthly' | 'annual'
  nextBillingDate: string           // ISO 8601
  creditsIncluded: number           // e.g. 84000
  creditsUsed: number
  creditsRemaining: number
  creditsResetAt: string            // ISO 8601
  seatsUsed: number
  seatsLimit?: number               // null = unlimited
  features: string[]
  defaultMemberCreditCap?: number
  defaultAdminCreditCap?: number
}

interface Invoice {
  id: string
  date: string                      // ISO 8601
  amount: number                    // in cents
  seats: number
  status: 'paid' | 'pending' | 'failed'
  downloadUrl?: string
}

interface PaymentMethod {
  id: string
  brand: string                     // 'visa' | 'mastercard' | 'amex' | ...
  lastFour: string
  expiryMonth: number
  expiryYear: number
}
```

### Security Settings

```typescript
interface WorkspaceSecuritySettings {
  googleSSOEnabled: boolean
  msSSOEnabled: boolean
  twoFAEnforced: boolean
  hitlThreshold: HITLThreshold
  domainClaim?: DomainClaim
  samlEnabled: boolean              // enterprise only
  scimEnabled: boolean              // enterprise only
}

interface DomainClaim {
  domain: string
  status: 'idle' | 'verifying' | 'verified' | 'failed'
  txtRecord?: string                // DNS TXT value to set, e.g. "souvenir-verify=sv_<id>"
  verifiedAt?: string               // ISO 8601
}
```

### Email Domain

```typescript
interface EmailDomain {
  id: string
  domain: string
  status: 'allowed' | 'blocked'
  verificationStatus: 'verified' | 'pending' | 'failed'
  createdAt: string
}
```

### Connector Request

```typescript
interface ConnectorRequest {
  id: string
  name: string                      // Tool/service name
  websiteUrl?: string
  description: string               // What the member needs it to do
  priority: 'blocking' | 'important' | 'nice_to_have'
  requestedBy: string               // memberId
  requestedByName: string
  requestedAt: string               // ISO 8601
  upvotes: number
  upvotedByIds: string[]            // memberIds who upvoted
  status: 'pending' | 'approved' | 'declined'
  resolvedAt?: string
  resolvedBy?: string
}
```

### Persona Visibility

```typescript
type PersonaVisibility = 'private' | 'team' | 'community'

interface PersonaVisibilitySettings {
  repoId: string
  visibility: PersonaVisibility
  teamIds: string[]                 // Which teams have access (when visibility === 'team')
}
```

### Type Aliases

```typescript
type WorkspaceRole   = 'admin' | 'editor' | 'member'
type TeamRole        = 'editor' | 'member'
type InviteStatus    = 'not_invited' | 'invite_sent' | 'signed_up'
type TokenStatus     = 'normal' | 'warning_80' | 'warning_95' | 'grace' | 'locked'
type ConnectorAuthority = 'workspace_only' | 'member_required' | 'both_possible'
type TeamStatus      = 'active' | 'archived' | 'tombstone'
type HITLThreshold   = 'auto' | 'tier_3_plus' | 'everything'
type ApprovalStatus  = 'pending' | 'accepted' | 'denied'
```

---

## 2. Authentication & Role Matrix

All teams endpoints live under the authenticated user's workspace context. The workspace is resolved from the bearer token's associated organization.

| Action | admin | editor | member |
|--------|-------|--------|--------|
| Read workspace details | ✅ | ✅ | ✅ |
| Update workspace settings | ✅ | ❌ | ❌ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ (non-admin) | ❌ |
| Change member roles | ✅ | ✅ (non-admin) | ❌ |
| Set credit caps | ✅ | ❌ | ❌ |
| Create/archive teams | ✅ | ✅ | ❌ |
| Manage team members | ✅ | ✅ (own teams) | ❌ |
| View activity log | ✅ | ✅ | ❌ |
| View analytics | ✅ | ✅ | ❌ |
| Manage security settings | ✅ | ❌ | ❌ |
| Manage billing/plan | ✅ | ❌ | ❌ |
| Connect workspace connectors | ✅ | ❌ | ❌ |
| Approve/decline connector requests | ✅ | ❌ | ❌ |
| Submit connector requests | ✅ | ✅ | ✅ |
| Accept/deny HITL approvals | ✅ | ✅ | ❌ |
| Manage Slack integrations | ✅ | ✅ | ❌ |
| Publish persona to team | ✅ | ✅ | ❌ |
| Publish project to team | ✅ | ✅ | ✅ (own projects) |

---

## 3. Workspace Endpoints

### `GET /workspace`

Returns the current user's workspace details.

**Response `200`:**
```json
{
  "id": "ws_01HXN3K7Y2BVQTM4Z",
  "name": "Souvenir_Core",
  "slug": "souvenir-core",
  "domain": "getsouvenir.com",
  "avatarUrl": null,
  "plan": "teams",
  "monthlyPrice": 150,
  "billingCycle": "monthly",
  "creditPool": {
    "total": 60000,
    "used": 41200,
    "remaining": 18800,
    "percentUsed": 68.67
  },
  "tokenStatus": "normal",
  "hitlThreshold": "tier_3_plus",
  "aiInstructions": "",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

---

### `PATCH /workspace`

Update workspace identity, AI instructions, or default settings.

**Request body:**
```json
{
  "name": "string",
  "slug": "string",
  "avatarUrl": "string | null",
  "aiInstructions": "string (max 3000 chars)",
  "defaultChatVisibility": "private | team",
  "defaultPersonaId": "string | null"
}
```

**Response `200`:** Updated `WorkspaceOrg` object.

**Notes:**
- `slug` must be globally unique, URL-safe (`[a-z0-9-]+`)
- `aiInstructions` changes take up to 1 hour to propagate to active sessions
- Logo upload is handled separately via `POST /workspace/avatar` (multipart)

---

### `POST /workspace/avatar`

Upload a workspace logo.

**Request:** `multipart/form-data`  
- `file`: image (PNG, JPG, GIF — max 2MB, recommended 512×512px)

**Response `200`:**
```json
{ "avatarUrl": "https://..." }
```

---

### `GET /workspace/email-domains`

List allowed/blocked email domains for auto-join.

**Response `200`:**
```json
[
  {
    "id": "dom_01",
    "domain": "getsouvenir.com",
    "status": "allowed",
    "verificationStatus": "verified",
    "createdAt": "2024-01-15T10:00:00Z"
  }
]
```

---

### `POST /workspace/email-domains`

Add an email domain.

**Request body:**
```json
{
  "domain": "string",
  "status": "allowed | blocked"
}
```

**Response `201`:** Created `EmailDomain` object.

---

### `PATCH /workspace/email-domains/{domainId}`

Change the status of a domain.

**Request body:**
```json
{ "status": "allowed | blocked" }
```

---

### `DELETE /workspace/email-domains/{domainId}`

Remove a domain from the list.

**Response `200`:** `{}`

---

## 4. Members Endpoints

### `GET /workspace/members`

List all workspace members including pending invites.

**Query params:**
- `role` — filter by `admin | editor | member`
- `inviteStatus` — filter by `not_invited | invite_sent | signed_up`

**Response `200`:**
```json
[
  {
    "id": "usr_01",
    "name": "Chai Landge",
    "email": "chai@getsouvenir.com",
    "avatarUrl": null,
    "role": "admin",
    "inviteStatus": "signed_up",
    "teamMemberships": [],
    "creditUsed": 4200,
    "creditCap": null,
    "joinedAt": "2024-01-15T10:00:00Z"
  }
]
```

---

### `POST /workspace/members/invite`

Invite a new member to the workspace.

**Request body:**
```json
{
  "email": "string",
  "role": "admin | editor | member"
}
```

**Response `201`:**
```json
{
  "id": "usr_new_abc",
  "name": "jane",
  "email": "jane@example.com",
  "role": "member",
  "inviteStatus": "invite_sent",
  "teamMemberships": [],
  "creditUsed": 0,
  "creditCap": null
}
```

**Notes:**
- Sends invitation email
- Name is derived from the email local part until user signs up
- Duplicate invites for already-pending email return `409 Conflict`

---

### `PATCH /workspace/members/{memberId}/role`

Change a member's workspace role.

**Request body:**
```json
{ "role": "admin | editor | member" }
```

**Response `200`:** Updated `OrgMember` object.

**Notes:**
- Only `admin` can promote to `admin`
- Demoting the last `admin` returns `409 Conflict`
- Demoting yourself as admin is allowed but triggers a confirmation in the UI (DemoteWarning)

---

### `PATCH /workspace/members/{memberId}/credit-cap`

Set or clear a per-member credit cap.

**Request body:**
```json
{
  "creditCap": 25000
}
```

Set `creditCap` to `null` to remove the cap (unlimited).

**Response `200`:** Updated `OrgMember` object.

---

### `DELETE /workspace/members/{memberId}`

Remove a member from the workspace.

**Response `200`:** `{}`

**Notes:**
- Removing a member preserves their chats and pins under a tombstoned user record
- Cannot remove yourself; use account deletion instead
- Removing an admin requires `admin` role

---

### `POST /workspace/members/{memberId}/resend-invite`

Re-send an invitation email to a pending member.

**Response `200`:** `{}`

---

## 5. Teams Endpoints

### `GET /workspace/teams`

List all teams in the workspace.

**Query params:**
- `status` — `active | archived | tombstone` (default: `active`)

**Response `200`:**
```json
[
  {
    "id": "team_01",
    "name": "Marketing",
    "description": "Growth and brand",
    "status": "active",
    "memberCount": 2,
    "owners": [{ "id": "usr_01", "name": "Chai Landge" }],
    "projects": [],
    "creditUsed": 2840,
    "createdAt": "2024-02-01T00:00:00Z"
  }
]
```

---

### `POST /workspace/teams`

Create a new team.

**Request body:**
```json
{
  "name": "string",
  "description": "string (optional)"
}
```

**Response `201`:** Created `Team` object with `status: "active"`, `memberCount: 0`, the creator auto-added as owner.

**Notes:**
- The creating user is automatically added as team owner (`isTeamOwner: true`)
- The front-end currently hardcodes the owner as `{ id: 'usr_01', name: 'Alex Rivera' }` — this must be replaced with the authenticated user from the token

---

### `GET /workspace/teams/{teamId}`

Get full team details including members and projects.

**Response `200`:** Full `Team` object.

---

### `PATCH /workspace/teams/{teamId}`

Update a team's name or description.

**Request body:**
```json
{
  "name": "string",
  "description": "string | null"
}
```

**Response `200`:** Updated `Team` object.

---

### `POST /workspace/teams/{teamId}/archive`

Archive a team (status → `archived`).

**Response `200`:** Updated `Team` with `archivedAt` set.

**Notes:**
- Sets a `permanentDeleteAt` date 30 days out
- Archived teams can be recovered before `permanentDeleteAt`

---

### `POST /workspace/teams/{teamId}/recover`

Recover an archived team back to `active`.

**Response `200`:** Updated `Team` with `status: "active"`, `archivedAt` cleared.

**Notes:**
- Not allowed for `tombstone` teams

---

### `DELETE /workspace/teams/{teamId}`

Hard-delete a team (only after `permanentDeleteAt` has passed, or admin force-delete).

**Response `200`:** `{}`

---

### `GET /workspace/teams/{teamId}/members`

List members of a team with their team-level roles.

**Response `200`:**
```json
[
  {
    "memberId": "usr_01",
    "name": "Chai Landge",
    "email": "chai@getsouvenir.com",
    "avatarUrl": null,
    "workspaceRole": "admin",
    "teamRole": "editor",
    "isTeamOwner": true
  }
]
```

---

### `POST /workspace/teams/{teamId}/members`

Add a workspace member to a team.

**Request body:**
```json
{
  "memberId": "string",
  "teamRole": "editor | member"
}
```

**Response `201`:** Created team-member record.

---

### `PATCH /workspace/teams/{teamId}/members/{memberId}`

Change a member's team-level role.

**Request body:**
```json
{ "teamRole": "editor | member" }
```

**Response `200`:** Updated team-member record.

---

### `DELETE /workspace/teams/{teamId}/members/{memberId}`

Remove a member from a team.

**Response `200`:** `{}`

---

### `GET /workspace/teams/{teamId}/projects`

List projects assigned to a team.

**Response `200`:** Array of `TeamProject` objects.

---

### `POST /workspace/teams/{teamId}/projects`

Add a project to a team.

**Request body:**
```json
{ "projectId": "string" }
```

**Response `201`:** Created `TeamProject` object.

---

### `DELETE /workspace/teams/{teamId}/projects/{projectId}`

Remove a project from a team.

**Response `200`:** `{}`

---

## 6. Activity Log Endpoints

### `GET /workspace/activity`

Fetch the workspace activity log. Retained for 90 days.

**Query params:**
- `memberId` — filter by member (default: all members)
- `actionType` — filter by action type (default: all)
- `since` — ISO 8601 timestamp (default: 90 days ago)
- `until` — ISO 8601 timestamp (default: now)
- `limit` — integer (default: `50`, max: `200`)
- `cursor` — pagination cursor (opaque string from previous response)

**Response `200`:**
```json
{
  "entries": [
    {
      "id": "act_01",
      "timestamp": "2026-06-09T08:00:00Z",
      "memberId": "usr_01",
      "memberName": "Chai Landge",
      "actionType": "connector_connected",
      "detail": "Connected GitHub to workspace"
    }
  ],
  "nextCursor": "cursor_abc123",
  "hasMore": true
}
```

**Notes:**
- `isAdmin` is currently hardcoded `true` in the front-end activity page — must be derived from the token
- `CURRENT_USER_ID` is hardcoded as `'u1'` — must come from the token's subject claim

---

## 7. Analytics Endpoints

### `GET /workspace/analytics/summary`

Returns top-level summary stats for the workspace.

**Query params:**
- `range` — `7d | 30d | mtd | qtd` (default: `7d`)

**Response `200`:**
```json
{
  "period": { "from": "2026-05-06", "to": "2026-05-12" },
  "plan": "Teams · $150/mo",
  "creditsTotal": 60000,
  "creditsUsed": 41200,
  "burnRatePerDay": 255,
  "activeMembers": 6
}
```

**Notes:**
- `$125/mo · 60,000 credits` is hardcoded in the analytics page — this must come from the plan data merged with credit pool data

---

### `GET /workspace/analytics/usage`

Time-series credit usage broken down by feature type.

**Query params:**
- `range` — `7d | 30d | mtd | qtd`

**Response `200`:**
```json
{
  "days": ["2026-05-06", "2026-05-07", "..."],
  "series": {
    "chat":       [116, 94, 142, 72, 158, 104, 132],
    "assistants": [18, 22, 28, 16, 34, 24, 30],
    "brain":      [10, 14, 18, 8, 20, 12, 16]
  },
  "totals": {
    "chat": 818,
    "assistants": 172,
    "brain": 98
  }
}
```

---

### `GET /workspace/analytics/members`

Per-member usage and credit caps.

**Query params:**
- `range` — `7d | 30d | mtd | qtd`
- `topN` — integer (default: `10`)

**Response `200`:**
```json
{
  "topUsers": [
    {
      "memberId": "usr_01",
      "name": "Harsh Kirdolia",
      "avatarUrl": null,
      "creditsUsed": 2840,
      "percentOfPool": 37
    }
  ],
  "memberCaps": [
    {
      "memberId": "usr_02",
      "name": "Alex Rivera",
      "creditCap": 12500,
      "creditUsed": 0,
      "percentOfCap": 0
    }
  ]
}
```

---

### `GET /workspace/analytics/teams`

Per-team credit usage.

**Query params:**
- `range` — `7d | 30d | mtd | qtd`

**Response `200`:**
```json
{
  "teams": [
    {
      "teamId": "team_01",
      "name": "Marketing",
      "creditsUsed": 2840,
      "percentOfPool": 41
    }
  ]
}
```

---

## 8. Security Endpoints

### `GET /workspace/security`

Get current security settings.

**Response `200`:**
```json
{
  "googleSSOEnabled": false,
  "msSSOEnabled": false,
  "twoFAEnforced": false,
  "hitlThreshold": "tier_3_plus",
  "samlEnabled": false,
  "scimEnabled": false,
  "domainClaim": {
    "domain": "getsouvenir.com",
    "status": "verified",
    "txtRecord": "souvenir-verify=sv_01abcdef1234",
    "verifiedAt": "2024-03-01T00:00:00Z"
  }
}
```

---

### `PATCH /workspace/security/sso`

Toggle SSO providers.

**Request body:**
```json
{
  "provider": "google | microsoft",
  "enabled": true
}
```

**Response `200`:** Updated security settings object.

---

### `PATCH /workspace/security/2fa`

Enforce or relax 2FA for all workspace members.

**Request body:**
```json
{ "enforced": true }
```

**Response `200`:** Updated security settings object.

---

### `PATCH /workspace/security/hitl`

Set the HITL (Human-in-the-Loop) approval threshold.

**Request body:**
```json
{ "hitlThreshold": "auto | tier_3_plus | everything" }
```

**Response `200`:** Updated `WorkspaceOrg` with new `hitlThreshold`.

**HITL Tier Reference:**
- `auto` — Brain never pauses; all actions proceed automatically
- `tier_3_plus` — Pauses for Tier 3+ actions: `delete`, `send`, `publish` (recommended)
- `everything` — Pauses before any write action

---

### `POST /workspace/security/domain-claim`

Initiate DNS domain verification. Returns the TXT record to add.

**Request body:**
```json
{ "domain": "getsouvenir.com" }
```

**Response `200`:**
```json
{
  "domain": "getsouvenir.com",
  "status": "idle",
  "txtRecord": "souvenir-verify=sv_01abcdef1234"
}
```

**Notes:**
- `txtRecord` must be deterministic for a given `(workspaceId, domain)` pair — do not generate a new token on every call
- The `sv_01abcdef1234` value is currently hardcoded in the security page; this must be generated server-side and returned here

---

### `POST /workspace/security/domain-claim/verify`

Trigger a DNS lookup to confirm the TXT record is live.

**Request body:**
```json
{ "domain": "getsouvenir.com" }
```

**Response `200`:**
```json
{
  "domain": "getsouvenir.com",
  "status": "verified | verifying | failed",
  "verifiedAt": "2026-06-09T12:00:00Z"
}
```

**Notes:**
- The front-end currently uses a hardcoded 2000ms `setTimeout` to fake this — replace with a real async DNS check
- Consider async polling: return `status: "verifying"` immediately and have the client poll `GET /workspace/security` until `status: "verified" | "failed"`

---

## 9. Plans & Billing Endpoints

### `GET /workspace/plan`

Get the current plan details and credit usage.

**Response `200`:**
```json
{
  "id": "plan_teams_monthly",
  "name": "Teams",
  "monthlyPrice": 150,
  "billingCycle": "monthly",
  "nextBillingDate": "2026-03-01T00:00:00Z",
  "creditsIncluded": 84000,
  "creditsUsed": 720,
  "creditsRemaining": 83280,
  "creditsResetAt": "2026-03-01T00:00:00Z",
  "seatsUsed": 6,
  "seatsLimit": null,
  "features": ["Unlimited seats", "Priority support", "Advanced AI models"],
  "defaultMemberCreditCap": 8000,
  "defaultAdminCreditCap": 20000
}
```

**Notes:**
- `$150/month` and all credit values on the Plans page are hardcoded — must come from this endpoint
- Next billing date `Mar 1, 2026` is hardcoded — must be dynamic

---

### `PATCH /workspace/plan/credit-caps`

Update default credit caps for roles.

**Request body:**
```json
{
  "defaultMemberCreditCap": 8000,
  "defaultAdminCreditCap": 20000
}
```

Set either value to `null` for unlimited.

**Response `200`:** Updated plan object.

---

### `GET /workspace/billing/invoices`

List billing invoices.

**Query params:**
- `limit` — integer (default: `12`)
- `cursor` — pagination cursor

**Response `200`:**
```json
{
  "invoices": [
    {
      "id": "inv_01",
      "date": "2026-01-01T00:00:00Z",
      "amount": 15000,
      "seats": 6,
      "status": "paid",
      "downloadUrl": "https://..."
    }
  ],
  "nextCursor": null
}
```

**Notes:**
- Invoice list is currently hardcoded with 3 entries — must be fetched from Stripe
- Amount is in cents (e.g. `15000` = `$150.00`)

---

### `GET /workspace/billing/payment-method`

Get the current payment method on file.

**Response `200`:**
```json
{
  "id": "pm_01",
  "brand": "visa",
  "lastFour": "1234",
  "expiryMonth": 6,
  "expiryYear": 2024
}
```

**Notes:**
- `brand: "Visa"`, `lastFour: "1234"`, `expiry: "06/2024"` are all hardcoded in the Plans page — must come from Stripe

---

### Plan Tier Reference

The following tiers are selectable during plan upgrade flows:

| Tier | Price | Credits/mo |
|------|-------|-----------|
| Starter | $125/mo | 60,000 |
| Growth | $250/mo | 130,000 |
| Scale | $500/mo | 280,000 |
| Business | $750/mo | 450,000 |
| Pro | $1,000/mo | 650,000 |
| Enterprise | $2,000/mo | 1,000,000 |

Top-up packs (one-time):

| Pack | Credits | Price |
|------|---------|-------|
| Small | 10,000 | $20 |
| Medium | 30,000 | $55 |
| Large | 75,000 | $120 |
| XL | 150,000 | $220 |

---

## 10. Connectors (Workspace) Endpoints

### `GET /workspace/connectors`

List all workspace-level connectors and their status.

**Response `200`:**
```json
[
  {
    "id": "wconn_01",
    "name": "GitHub",
    "iconSlug": "github",
    "authority": "workspace_only",
    "status": "connected",
    "connectedBy": "Chai Landge",
    "connectedAt": "2024-03-01T00:00:00Z"
  }
]
```

**Notes:**
- The Connectors page uses 2× duplicate GitHub and 2× duplicate Gmail entries from mock data — this must be real data from the server

---

### `GET /workspace/connectors/catalog`

List all available connectors with category metadata.

**Query params:**
- `category` — `all | productivity | communication | design | interactive | data`

**Response `200`:**
```json
[
  {
    "slug": "github",
    "name": "GitHub",
    "iconSlug": "github",
    "category": "interactive",
    "description": "Access repositories, PRs, and issues",
    "authority": "workspace_only"
  }
]
```

**Notes:**
- The categories array is currently hardcoded in the front-end — must come from this endpoint or a config endpoint
- 18 available connectors: googledrive, notion, github, linear, slack, gmail, figma, webflow, hubspot, airtable, mixpanel, stripe, jira, asana, zapier, zendesk, intercom, vercel

---

### `POST /workspace/connectors/{slug}/connect`

Initiate OAuth connection for a workspace connector.

**Response `200`:**
```json
{
  "authUrl": "https://...",
  "state": "oauth_state_token"
}
```

Redirect the user to `authUrl`. After OAuth completes, the connector status updates to `connected`.

---

### `DELETE /workspace/connectors/{connectorId}`

Revoke a workspace connector.

**Response `200`:** `{}`

---

### `GET /workspace/connectors/requests`

List pending connector requests from members.

**Response `200`:**
```json
[
  {
    "id": "req_01",
    "name": "HubSpot",
    "websiteUrl": "https://hubspot.com",
    "description": "Need this to pull deal stages into the sales brain for weekly reports.",
    "priority": "important",
    "requestedBy": "usr_05",
    "requestedByName": "Priya Nair",
    "requestedAt": "2026-06-07T10:00:00Z",
    "upvotes": 4,
    "upvotedByIds": ["usr_02", "usr_03", "usr_04"],
    "status": "pending"
  }
]
```

**Notes:**
- The request queue (HubSpot/Notion) is fully hardcoded in the Connectors page — must be server-driven
- The admin requests tab badge shows a hardcoded `"5"` count — must come from `requests.length` on the response

---

### `POST /workspace/connectors/requests`

Submit a connector request.

**Request body:**
```json
{
  "name": "HubSpot",
  "websiteUrl": "https://hubspot.com",
  "description": "Need this to pull deal stages...",
  "priority": "important"
}
```

Priority options: `"blocking" | "important" | "nice_to_have" | "would_help_workflow"`

**Response `201`:** Created `ConnectorRequest` object.

---

### `POST /workspace/connectors/requests/{requestId}/upvote`

Upvote an existing connector request.

**Response `200`:** Updated `ConnectorRequest` with incremented `upvotes`.

---

### `PATCH /workspace/connectors/requests/{requestId}`

Approve or decline a connector request (admin only).

**Request body:**
```json
{
  "status": "approved | declined"
}
```

**Response `200`:** Updated `ConnectorRequest` object.

---

## 11. Approval Gates (HITL) Endpoints

### `GET /workspace/approvals`

List approval requests for the workspace.

**Query params:**
- `status` — `pending | accepted | denied | all` (default: `pending`)
- `limit` — integer (default: `50`)
- `cursor` — pagination cursor

**Response `200`:**
```json
{
  "approvals": [
    {
      "id": "appr_01",
      "tier": 4,
      "actionType": "delete",
      "connectorName": "Gmail",
      "targetName": "Q3 Campaign Report",
      "description": "Permanently delete email thread with 14 messages",
      "reversible": false,
      "status": "pending",
      "requestedBy": "usr_02",
      "requestedAt": "2026-06-09T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

---

### `PATCH /workspace/approvals/{approvalId}`

Accept or deny an approval request.

**Request body:**
```json
{
  "status": "accepted | denied",
  "denyReason": "Wrong target | Not right time | Needs editing | Other"
}
```

`denyReason` is required when `status === "denied"`.

**Response `200`:** Updated `ApprovalRequest` object.

---

### `POST /workspace/approvals/{approvalId}/undo`

Undo an accepted action (only for reversible actions within the undo window).

**Response `200`:** `{}`

**Notes:**
- The UndoToast component shows a 5-second countdown before dismissal; the server must also enforce a time window for undo eligibility
- `reversalDescription` in `ApprovalRequest` describes what the undo will do

---

## 12. Slack Integration Endpoints

### `GET /workspace/slack/channels`

List all Slack channel-to-team/project mappings.

**Response `200`:**
```json
[
  {
    "id": "scmap_01",
    "channelId": "C01234ABCD",
    "channelName": "#marketing",
    "teamId": "team_01",
    "teamName": "Marketing",
    "projectId": "proj_01",
    "projectName": "Q3 Campaign",
    "botPermissions": "brain_runs"
  }
]
```

---

### `POST /workspace/slack/channels`

Create a new channel mapping.

**Request body:**
```json
{
  "channelId": "string",
  "channelName": "string",
  "teamId": "string",
  "projectId": "string | null",
  "botPermissions": "read_only | brain_runs | write_actions"
}
```

**Response `201`:** Created `SlackChannelMapping` object.

---

### `PATCH /workspace/slack/channels/{mappingId}`

Update a channel mapping.

**Request body:** Same fields as POST, all optional.

**Response `200`:** Updated mapping.

---

### `DELETE /workspace/slack/channels/{mappingId}`

Remove a Slack channel mapping.

**Response `200`:** `{}`

---

### `GET /workspace/slack/available-channels`

List Slack channels available to map (from the connected Slack workspace).

**Response `200`:**
```json
[
  {
    "channelId": "C01234ABCD",
    "channelName": "#general",
    "memberCount": 42
  }
]
```

---

## 13. Persona Visibility Endpoints

### `PATCH /persona/{repoId}/visibility`

Set a persona's visibility level.

**Request body:**
```json
{
  "visibility": "private | team | community"
}
```

**Response `200`:** Updated persona summary with `visibility` field.

---

### `PATCH /persona/{repoId}/team-access`

Set which teams can access a team-scoped persona.

**Request body:**
```json
{
  "teamIds": ["team_01", "team_03"]
}
```

**Response `200`:** Updated `PersonaVisibilitySettings` object.

**Notes:**
- `teamIds` replaces the entire list (not an append/remove operation)
- Changing `visibility` away from `team` clears `teamIds` server-side

---

### `GET /workspace/personas`

List all personas in the workspace visible to the current user (respects visibility rules).

**Query params:**
- `visibility` — filter by `private | team | community`

**Response `200`:** Array of persona summaries with `visibility` and `teamIds` fields.

---

## 14. Project Team Publishing Endpoints

### `POST /projects/{projectId}/publish`

Publish a project to a team, making it visible to all team members.

**Request body:**
```json
{ "teamId": "string" }
```

**Response `200`:** Updated project object with `publishedToTeamId` field.

---

### `POST /projects/{projectId}/unpublish`

Unpublish a project from a team.

**Response `200`:** Updated project object with `publishedToTeamId: null`.

---

### `GET /projects/{projectId}/shared-chats`

List chats in a project that have been shared with the team.

**Response `200`:** Array of shared chat summaries.

---

## 15. Onboarding Endpoints

### `POST /workspace/setup`

Complete the workspace onboarding flow (two-step: Basics + Configure).

**Request body:**
```json
{
  "name": "Acme Inc",
  "description": "Our company workspace",
  "tags": ["startup", "saas"],
  "inviteEmails": ["alice@acme.com", "bob@acme.com"],
  "connectorSlugs": ["github", "slack", "notion"]
}
```

**Response `200`:**
```json
{
  "workspaceId": "ws_01",
  "pendingInvites": 2,
  "connectedConnectors": 1,
  "failedConnectors": ["notion"]
}
```

**Notes:**
- The workspace-setup page handles invites as inline chips and connects up to 8 connectors during onboarding
- Connector connections that require OAuth may return a list of `oauthPendingConnectors` that need separate redirect flows

---

### `PATCH /users/me/onboarding`

Mark the workspace onboarding as complete (existing endpoint, extend with teams fields).

**Request body:**
```json
{
  "workspaceSetupComplete": true
}
```

**Response `200`:** Updated user object.

---

## 16. Hardcoded Values → Dynamic API Mapping

This section lists every hardcoded value in the front-end that must become a dynamic API response before production.

### Activity Page (`settings/org/activity/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| 12 mock activity entries | `GET /workspace/activity` |
| `isAdmin = true` | Token → `currentUser.role === 'admin'` |
| `CURRENT_USER_ID = 'u1'` | Token → `currentUser.id` |
| Member names (Chai, Alex, Jordan) | `GET /workspace/members` |
| 90-day retention note | Config or `GET /workspace/activity` metadata |

### Analytics Page (`settings/org/analytics/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| Chart data: 7 days, chat/assistants/brain series | `GET /workspace/analytics/usage?range=7d` |
| `$125/mo · 60,000 credits` | `GET /workspace/plan` (monthlyPrice + creditsIncluded) |
| Burn rate `255/day` | `GET /workspace/analytics/summary` |
| Active members `6` | `GET /workspace/analytics/summary` |
| Progress `41,200 / 60,000` | `GET /workspace` (creditPool.used / creditPool.total) |
| Top users (Harsh, Alex, Jordan, Sam with % values) | `GET /workspace/analytics/members?range=30d` |
| Team usage (Marketing 41%, Engineering 41%, Design 18%) | `GET /workspace/analytics/teams` |
| Member caps (Alex 12,500, Jordan 3,000) | `GET /workspace/analytics/members` |

### Plans Page (`settings/org/plans/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| `$150/month` | `GET /workspace/plan` (monthlyPrice) |
| Next billing `Mar 1, 2026` | `GET /workspace/plan` (nextBillingDate) |
| Credits `84,000` | `GET /workspace/plan` (creditsIncluded) |
| Credits remaining `76,340` | `GET /workspace/plan` (creditsRemaining) |
| Credits used `720` | `GET /workspace/plan` (creditsUsed) |
| Seats `6` | `GET /workspace/plan` (seatsUsed) |
| Invoice list (3 entries, Jan/Dec/Nov) | `GET /workspace/billing/invoices` |
| Card `Visa · 1234 · 06/2024` | `GET /workspace/billing/payment-method` |
| Default caps (`20,000 credits` admin, `8,000 credits` member) | `GET /workspace/plan` (defaultAdminCreditCap, defaultMemberCreditCap) |

### Teams Page (`settings/org/teams/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| New team owner `{ id: 'usr_01', name: 'Alex Rivera' }` | Token → authenticated user identity |

### Connectors Page (`settings/org/connectors/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| 2× duplicate GitHub workspace connectors | `GET /workspace/connectors` |
| 2× duplicate Gmail account connectors | `GET /connectors` (existing individual endpoint) |
| 3× Google Drive managed connectors | `GET /workspace/connectors` |
| 9× / 12× GitHub catalog entries | `GET /workspace/connectors/catalog` |
| Categories array | `GET /workspace/connectors/catalog` (distinct categories) |
| Request queue (HubSpot/Notion entries) | `GET /workspace/connectors/requests` |
| Requests tab badge `"5"` | `GET /workspace/connectors/requests` (count of pending) |

### Security Page (`settings/org/security/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| DNS TXT record `"souvenir-verify=sv_01abcdef1234"` | `POST /workspace/security/domain-claim` (server-generated) |
| `setTimeout(2000ms)` fake verify | `POST /workspace/security/domain-claim/verify` (real DNS check) |
| Security toggles initial state | `GET /workspace/security` |
| HITL threshold initial value | `GET /workspace` (hitlThreshold) |

### General Page (`settings/org/general/page.tsx`)

| Hardcoded Value | Should Come From |
|-----------------|-----------------|
| Workspace ID `"ws_01HXN3K7Y2BVQTM4Z"` | `GET /workspace` (id) |
| Workspace name `"Souvenir_Core"` | `GET /workspace` (name) |
| Slug `"souvenir-core"` | `GET /workspace` (slug) |
| Domain list (getsouvenir.com allowed, opent3st.com blocked, cca.edu pending) | `GET /workspace/email-domains` |
| Default chat visibility | `GET /workspace` (defaultChatVisibility) |
| Default persona | `GET /workspace` (defaultPersonaId) |
