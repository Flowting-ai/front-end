# Guardrails Execution Plan — Individual & Team Plans

> **Status:** Updated · 2026-06-14  
> **Scope:** All plan-tier and role-based access enforcement across Individual (Starter/Pro/Power) and Team plans.  
> **Source wireframes:** connector-wireframes-deploy.vercel.app (root + teams-handoff.html)  
> **Live API:** `organizations.yaml`, `connectors.yaml`, `stripe.yaml`, `users.yaml`  
> **Depends on:** `teams-backend-spec.md`, `connectors.md`, `teams-ui-tracker.md`

---

## Table of Contents

1. [Plan Tier Definitions](#1-plan-tier-definitions)
2. [Role System](#2-role-system)
3. [Guardrail Surface Inventory](#3-guardrail-surface-inventory)
4. [Gap Analysis — What Is and Isn't Built](#4-gap-analysis)
5. [Frontend: New Components to Build](#5-frontend-new-components-to-build)
6. [Frontend: Existing Components to Wire](#6-frontend-existing-components-to-wire)
7. [Backend: Enforcement Changes Required](#7-backend-enforcement-changes-required)
8. [Enforcement Architecture](#8-enforcement-architecture)
9. [Phased Implementation Plan](#9-phased-implementation-plan)
10. [Open Questions](#10-open-questions)

---

## 1. Plan Tier Definitions

### 1.1 Individual Plans

Single-user plans; no org, no roles, no credit pools. Plan tier lives on the user record.

**Live source:** `GET /users/me` → `UserAccountResponse.plan.plan_type`  
**Type:** `PlanType: 'starter' | 'pro' | 'power' | 'trial' | 'teams'`

| Tier | Price | Personal Connectors | Notes |
|------|-------|---------------------|-------|
| **starter** | $12/mo | ❌ Paused | Connectors show "⏸ Paused — not on Starter"; settings preserved |
| **pro** | $25/mo | ✅ Active | Personal connectors unlocked |
| **power** | $100/mo | ✅ Active | Everything in Pro + higher credit limits |
| **trial** | $0 | ✅ Active | Time-limited; `usage.trial` has `remaining` + `expires_at` |
| **teams** | see below | N/A | User belongs to an org; org plan drives access |

**Connector rule:** Connecting a personal account requires `plan_type` of `pro`, `power`, or `trial`. A `starter` user who downgrades sees connectors **paused, never deleted**. Re-upgrading immediately restores them.

### 1.2 Team (Org) Plans

Org plans with a shared credit pool, member roles, and admin controls.

**Live source:** `GET /organizations/{org_id}/plan` → `PlanResponse`

| Name | Price | Credits/mo | Notes |
|------|-------|-----------|-------|
| Starter | $125/mo | 60,000 | Entry workspace tier |
| Growth | $250/mo | 130,000 | |
| Scale | $500/mo | 280,000 | |
| Business | $750/mo | 450,000 | |
| Pro | $1,000/mo | 650,000 | |
| Enterprise | $2,000/mo | 1,000,000 | + SAML/SCIM + 12-mo audit + DPA/SLA |

**Top-up:** `POST /stripe/topup` (checkout redirect) or `POST /stripe/topup/charge` (direct charge). Amount is a free `amount_usd: number` — no fixed pack sizes in the API.

### 1.3 Credit Pool States

**Live source:** `GET /organizations/{org_id}/pool-status` → `PoolStatusResponse.status`

| `pool_status` value | Threshold | Behavior |
|---------------------|-----------|----------|
| `normal` | < 80% used | No banner |
| `warning_80` | ≥ 80% used | `TokenPoolBar` color shifts; no banner yet |
| `warning_95` | ≥ 95% used | `WorkspaceStatusBanner` shown |
| `grace` | 100% used | Grace period active — `graceDaysRemaining` shown; workspace still runs |
| `locked` | Grace expired | Workspace locked — all AI features blocked |

> **Field name:** Components must read `pool_status` (from the API), NOT `tokenStatus` (the name used in `teams-backend-spec.md`). The spec was aspirational; the OpenAPI is the source of truth.

### 1.4 Team Credit Overflow

When a team's allocated credits run low, team editors/owners can request overflow from the org pool:

**Live endpoint:** `POST /organizations/{org_id}/teams/{team_id}/overflow`  
Body: `{ amount?: number, note: string }`  
Response: `OverflowResponse` — `status: 'open' | 'resolved'`

This is separate from the org-level top-up. Overflow is a team-scoped request; top-up adds credits to the org pool.

---

## 2. Role System

> **Critical:** The live API has TWO separate role layers. Conflating them is the single biggest source of bugs. Read this section carefully before touching any role-gated UI.

### 2.1 Org-Level Role

**Live source:** `GET /organizations/{org_id}` → `OrganizationResponse.my_role`  
**Type:** `OrganizationRole: 'owner' | 'admin' | 'member'`

| Role | Who | Distinctions |
|------|-----|-------------|
| **owner** | The person who created/purchased the org | Full control including billing/payment card changes. Exactly one per org. |
| **admin** | Elevated org members | All owner capabilities **except** payment method changes. Multiple allowed. |
| **member** | Everyone else | Baseline. All access beyond read-only comes from team/project grants below. |

There is no `editor` at the org level. If a component prop says `role: 'editor'`, it is wrong.

### 2.2 Team-Level Grant

**Live source:** `GET /organizations/{org_id}/teams/{team_id}/editors` → `PersonResponse[]`  
A user in this list is a **TeamEditor** for that specific team. Not a global role — per-team.

**Capabilities granted by TeamEditor:**
- Add/manage shared connector accounts for their teams
- Add/remove team members
- Accept/deny HITL approvals
- Publish personas to team scope
- Manage Slack channel mappings

### 2.3 Project-Level Grant

**Live source:** `GET /organizations/{org_id}/teams/{team_id}/projects/{project_id}/members` → `PersonResponse[]`  
A `ProjectMember` grant gives access to a specific project within a team.

### 2.4 Full Capability Matrix

| Capability | owner | admin | member (+ TeamEditor on team) | member only |
|-----------|-------|-------|-------------------------------|-------------|
| Change billing/payment card | ✅ | ❌ | ❌ | ❌ |
| Update org settings | ✅ | ✅ | ❌ | ❌ |
| Invite members to org | ✅ | ✅ | ❌ | ❌ |
| Remove org members | ✅ | ✅ | ❌ | ❌ |
| Change org member role | ✅ | ✅ | ❌ | ❌ |
| Set per-member credit caps | ✅ | ✅ | ❌ | ❌ |
| Create/archive teams | ✅ | ✅ | ❌ | ❌ |
| Add members to a team | ✅ | ✅ | ✅ (own teams) | ❌ |
| Remove members from a team | ✅ | ✅ | ✅ (own teams) | ❌ |
| View audit log | ✅ | ✅ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ | ❌ |
| Manage security settings | ✅ | ✅ | ❌ | ❌ |
| Manage billing/plan | ✅ | ✅ | ❌ | ❌ |
| **Approve team connector requests** | ✅ | ✅ | ❌ | ❌ |
| **Link OAuth account for team** | ✅ | ✅ | ✅ (own teams) | ❌ |
| Submit connector requests | ✅ | ✅ | ✅ | ✅ |
| Accept/deny HITL approvals | ✅ | ✅ | ✅ (own teams) | ❌ |
| Publish persona to team scope | ✅ | ✅ | ✅ (own teams) | ❌ |
| Publish project to team | ✅ | ✅ | ✅ (own projects) | ✅ (own) |
| Request credit overflow for team | ✅ | ✅ | ✅ (own teams) | ❌ |
| SAML/SCIM management | ✅ (Enterprise only) | ✅ (Enterprise only) | ❌ | ❌ |

### 2.5 How to Detect Role in Frontend

```ts
// Step 1: get current org
const orgs = await GET('/organizations')
const org = orgs[0]  // or whichever org is active

// Step 2: org-level role
const myRole: 'owner' | 'admin' | 'member' = org.my_role

// Step 3: team editor status (per team)
const editors = await GET(`/organizations/${org.id}/teams/${teamId}/editors`)
const isTeamEditor = editors.some(e => e.user_id === currentUserId)
```

`useWorkspaceRole()` hook must expose both layers (see Section 8).

---

## 3. Guardrail Surface Inventory

Every guarded feature, grouped by surface. All API paths use `/organizations/{org_id}` as the base.

### 3.1 Connectors — Two Distinct Flows

The org API has two separate concepts that must not be conflated:

**A. Connector Pool (request/approval layer)**

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Submit connector request | org role | Any role | `POST /organizations/{org_id}/teams/{team_id}/connectors` | ✅ API exists |
| Approve/deny connector request | org role | owner/admin only | `PATCH /organizations/{org_id}/teams/{team_id}/connectors/{slug}` | ❌ Not enforced in FE |
| Remove connector from pool | org role | owner/admin only | `DELETE /organizations/{org_id}/teams/{team_id}/connectors/{slug}` | ❌ Not enforced in FE |
| View pool | org role | All roles (read) | `GET /organizations/{org_id}/teams/{team_id}/connectors` | ❌ Not wired |

**B. Connector Connections (OAuth account layer)**

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Link team OAuth account | org role + TeamEditor | owner/admin, or TeamEditor on that team | `POST /organizations/{org_id}/teams/{team_id}/connections/{slug}/link` | ❌ Not enforced in FE |
| Update team connection permissions | org role + TeamEditor | owner/admin or TeamEditor | `PATCH /organizations/{org_id}/teams/{team_id}/connections/{slug}` | ❌ Not built |
| Unlink team connection | org role + TeamEditor | owner/admin or TeamEditor | `DELETE /organizations/{org_id}/teams/{team_id}/connections/{slug}` | ❌ Not enforced |
| View team connections | All | Read for all members | `GET /organizations/{org_id}/teams/{team_id}/connections` | ❌ Not wired |

**C. Personal Connections**

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Connect personal account | **Individual plan tier** | Requires `pro`, `power`, or `trial` | `POST /connectors/{slug}/link` | ❌ Not enforced |
| Connector paused badge | **Individual plan tier** | `starter` → show paused state | `GET /connectors` → `linked` status | ❌ Not built |
| `workspace_linked` indicator | Team context | `ConnectorCatalogEntry.workspace_linked` already returned | `GET /connectors` | ❌ Not displayed |
| Plan downgrade notice | **Individual plan tier** | Show before confirming downgrade | `GET /stripe/billing` | ❌ Not built |

### 3.2 Workspace Credit / Token System

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| `WorkspaceStatusBanner` | `pool_status` | Show when ≠ `normal` | `GET /organizations/{org_id}/pool-status` | ⚠️ Component built, not placed/wired |
| `InlineCreditNotice` | `pool_status` | `warning_95` / `grace` / `locked` | same | ⚠️ Component built, not wired |
| `TokenPoolBar` | `pool_status` | Color at `warning_80`/`warning_95`/`locked` | `GET /organizations/{org_id}/plan` → `percent_used` | ⚠️ Component built, static data |
| Per-member credit cap display | org role | Members see own cap; owner/admin can edit | `GET /organizations/{org_id}/plan` → `members[].credit_cap` | ❌ Not wired |
| Set per-member credit cap | org role | owner/admin only | `PATCH /organizations/{org_id}/members/{member_id}/cap` | ❌ Not enforced |
| Top-up (redirect checkout) | org role | owner/admin only | `POST /stripe/topup` | ❌ Not role-gated |
| Top-up (direct charge) | org role | owner/admin only | `POST /stripe/topup/charge` | ❌ Not role-gated |
| Credit overflow request | TeamEditor | TeamEditor+ on that team | `POST /organizations/{org_id}/teams/{team_id}/overflow` | ❌ Not built |
| Workspace locked — AI blocked | `pool_status` | Block chat/brain when `locked` | Backend enforcement | ❌ Not enforced |

### 3.3 Personas

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Publish persona to team scope | org role + TeamEditor | owner/admin, or TeamEditor on that team | `PATCH /persona/{repoId}/visibility` | ❌ Not enforced (5a pending) |
| Publish persona to community | org settings | Default allowed; owner/admin can restrict per-member | org settings | ❌ Not enforced |
| Team badge on persona card | Team context | Shown when `visibility === 'team'` | persona visibility field | ❌ Not built |
| Persona visibility selector | org role + TeamEditor | `team` option disabled for member without TeamEditor grant | frontend only | ❌ Not built (tracker 5a) |

### 3.4 Projects

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Create team project | org role + TeamEditor | owner/admin or TeamEditor | backend | ❌ Not enforced |
| Share project chat with team | Any | `POST /chat-shares` with `teamId` | `POST /chat-shares` ✅ exists | ❌ Not wired in UI |
| Fork shared project chat | Any team member | `POST /chat-shares/{share_id}/fork` | ✅ exists | ❌ Not wired |
| List chats shared with me | Any | `GET /chat-shares/shared-with-me` | ✅ exists | ❌ Not wired |

### 3.5 Brain / Automation (HITL)

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| HITL threshold setting | org role | owner/admin only | Security endpoint (not built) | ❌ Backend missing |
| Accept/deny HITL approval | org role + TeamEditor | owner/admin or TeamEditor | `PATCH /workspace/approvals/{id}` (not in live API yet) | ❌ Not built |
| Undo approved action | org role + TeamEditor | Same as above | not in live API yet | ❌ Not built |

### 3.6 Admin Panel (Settings)

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Org settings pages (`/settings/org/*`) | org role | owner/admin only | Route guard | ❌ No route guard; `my_role` not read |
| Activity/audit log | org role | owner/admin | `GET /organizations/{org_id}/audit` ✅ exists | ⚠️ Built; `isAdmin` hardcoded |
| Analytics / usage | org role | owner/admin | `GET /organizations/{org_id}/plan/usage` ✅ exists | ⚠️ Built; static data |
| Plans & billing | org role | owner/admin | `GET /stripe/billing` ✅ exists | ⚠️ Built; static data |
| Payment card change | org role | **owner only** | `POST /stripe/portal` | ❌ Not role-split |
| Security settings | org role | owner/admin | endpoints mostly missing | ❌ Most backend not built |
| SAML / SCIM | org plan + role | Enterprise only + owner/admin | not in live API | ❌ Not built |
| 12-month audit retention | org plan | Enterprise only | not in live API | ❌ Not built |

### 3.7 Context & Navigation

| Surface | Gate | Rule | API | Current State |
|---------|------|------|-----|---------------|
| Sidebar team switcher | Org membership | Shown when `GET /organizations` returns ≥1 org | `GET /organizations` ✅ exists | ❌ Not built |
| Org panel in sidebar | org role | owner/admin only | `my_role` from `GET /organizations` | ❌ Not built |
| `ContextIndicator` in TopBar | Team/project context | Shows when inside a team project | session context | ⚠️ Component built, not wired |

---

## 4. Gap Analysis

### Built and Wired ✅
- `WorkspaceConnectorCard` (connected/not\_connected/auth\_in\_progress/auth\_failed)
- `ApprovalCard` + `UndoToast` (components exist; no live API to wire to yet)
- `InviteModal` + `RoleSelectorDropdown`
- `WorkspaceStatusBanner` (component only)
- `InlineCreditNotice` (component only)
- `TokenPoolBar` (component only)
- `ContextIndicator` (component only)
- `TeamRow` component
- All admin panel settings pages (structure/UI done; data hardcoded)
- Onboarding workspace-setup page

### Built but NOT Wired ⚠️

| Component | What's Missing |
|-----------|---------------|
| `WorkspaceStatusBanner` | Not in layout; needs `GET /organizations/{org_id}/pool-status` → `status` field |
| `InlineCreditNotice` | Not above ChatInput; needs `pool_status` signal |
| `TokenPoolBar` | Receiving static mock; needs `GET /organizations/{org_id}/plan` → `percent_used` |
| `ContextIndicator` | Not wired to team/project session context |
| `ApprovalCard` | No live HITL approval endpoint exists yet |
| `UndoToast` | No live undo endpoint exists yet |
| Activity page | `isAdmin` hardcoded; needs `my_role` from `GET /organizations/{org_id}` |
| Analytics page | All static; needs `GET /organizations/{org_id}/plan/usage` |
| Plans page | All static; needs `GET /stripe/billing` + `GET /organizations/{org_id}/plan` |
| Security page | All static; most backend endpoints missing |
| Members page | `CURRENT_USER_ID` hardcoded; invite flow incomplete (team-level only) |
| Connectors page | Duplicate mock data; pool vs connections not split; role not enforced |
| Teams page | New-team owner hardcoded |

### Not Built ❌

1. `useWorkspaceRole()` hook — org role (`owner|admin|member`) + `isTeamEditor(teamId)` function
2. `useOrgPlan()` hook — credit pool, `pool_status`, member caps
3. `useIndividualPlan()` hook — personal plan tier from `GET /users/me`
4. `PlanGate` — individual plan tier wrapper for connector UI
5. `ConnectorPausedBadge` — "⏸ Paused — not on Starter"
6. `PlanDowngradeModal` — lists connectors that will pause on downgrade (Screen 19)
7. `AddAccountScopeDialog` — role-aware: shows link flow for owner/admin/TeamEditor; request-only for member (Screen E2)
8. `AdminEditorPermissionDialog` — grants/revokes TeamEditor connector rights (Screen E3)
9. `MemberRemovalImpactModal` — connector reassignment preview (Screen 16); needs new backend endpoint
10. `OverflowRequestModal` — team requests credit overflow from org pool
11. `WorkspaceLockedOverlay` — full block when `pool_status === 'locked'`
12. `SidebarTeamSwitcher` — org/team switching in sidebar
13. `PersonaVisibilitySelector` — private/team/community picker (tracker 5a)
14. `TeamBadge` on persona cards
15. `RoleBadge` (tracker 3c)
16. `TeamChip` (tracker 3e)
17. `WorkspaceBadge` (tracker 3f)
18. `EnterpriseFeatureLock` — SAML/SCIM upgrade prompt
19. `RoleGate` — generic role-check wrapper component
20. `ConnectorPoolSection` + `ConnectorConnectionsSection` — separated pool vs OAuth UIs

### Backend Endpoints Missing ❌

| Endpoint | Purpose |
|----------|---------|
| `GET /organizations/{org_id}/members/{member_id}/removal-preview` | Connector reassignment preview before member removal |
| `PATCH /workspace/security/hitl` | HITL threshold (no security endpoints exist) |
| `GET /workspace/approvals` | HITL approval queue |
| `PATCH /workspace/approvals/{id}` | Accept/deny approval |
| `POST /workspace/approvals/{id}/undo` | Undo approval |
| Any security endpoint (SSO, 2FA, SAML, SCIM, domain claim) | Security settings page |
| Plan-tier check in `POST /connectors/{slug}/link` | Block `starter` from linking personal connectors |
| `paused` field in `GET /connectors` response | Individual connector paused state |
| Per-member credit cap enforcement in chat handler | Block usage when `credit_used >= credit_cap` |
| Workspace locked enforcement in chat handler | Block AI calls when `pool_status === 'locked'` |

---

## 5. Frontend: New Components to Build

### 5.1 `PlanGate` — Individual Plan Tier Wrapper

**File:** `src/components/PlanGate/index.tsx`

```tsx
interface PlanGateProps {
  requiredTier: 'pro' | 'power'
  currentTier: PlanType | null       // from useIndividualPlan()
  variant: 'disabled' | 'paused' | 'locked'
  upgradeLabel?: string              // "Upgrade to Pro"
  children: ReactNode
}
```

- `disabled` — gray out + tooltip "Available on Pro ($25/mo)"
- `paused` — render child with `⏸` overlay + "Upgrade to restore" CTA
- `locked` — replace child with upgrade card entirely

**Used on:** Personal connector rows when `plan_type === 'starter'`.

---

### 5.2 `ConnectorPausedBadge`

**File:** `src/components/ConnectorPausedBadge/index.tsx`

```
⏸ Paused · not on Starter   [Upgrade to Pro →]
```

Settings remain read-only; badge replaces the "Connected" indicator.

---

### 5.3 `PlanDowngradeModal` (Screen 19)

**File:** `src/components/PlanDowngradeModal/index.tsx`

Shown before confirming downgrade from `pro`/`power` → `starter`.

```
⚠ Downgrading will pause [N] connector(s)

• Gmail (Personal)     ⏸ will be paused
• Salesforce          ⏸ will be paused

Settings saved. Re-upgrade to restore instantly.

[Cancel]   [Confirm downgrade]
```

**Props:** `connectorsAtRisk: { display_name: string; slug: string }[]`  
**Data source:** `GET /connectors` → filter `linked === true`, then check plan tier.

---

### 5.4 `AddAccountScopeDialog` (Screen E2)

**File:** `src/components/AddAccountScopeDialog/index.tsx`

Role-aware dialog for "+ Add account" on a connector.

| User context | What they see |
|-------------|--------------|
| owner / admin | Full scope: Personal / Shared (Workspace) / Shared (Team) |
| Member with TeamEditor grant | Personal / Shared (own teams only) |
| Member without TeamEditor | "Request access" form — no scope picker |

**Props:**
```tsx
interface AddAccountScopeDialogProps {
  orgRole: OrganizationRole           // 'owner' | 'admin' | 'member'
  teamEditorTeams: { id: string; name: string }[]  // teams where user is TeamEditor
  connectorSlug: string
  onRequestSubmit: (note: string) => void
  onLinkScope: (scope: 'personal' | 'team', teamId?: string) => void
}
```

**API calls:**
- Personal link → `POST /connectors/{slug}/link`
- Team link → `POST /organizations/{org_id}/teams/{team_id}/connections/{slug}/link`
- Request → `POST /organizations/{org_id}/teams/{team_id}/connectors` with `{ slug, note }`

---

### 5.5 `AdminTeamEditorDialog` (Screen E3)

**File:** `src/components/AdminTeamEditorDialog/index.tsx`

Owner/admin dialog to grant or revoke TeamEditor status for a connector on a specific team.

```
Allow [Member Name] to add accounts for [Connector] on [Team Name]?

As a Team Editor, they can add shared accounts for this team.
You'll be notified of all additions.

[Revoke]   [Grant]
```

**API calls:**
- Grant → adds to `editors` (no direct endpoint in current API — see Section 7.1)
- Revoke → `DELETE /organizations/{org_id}/teams/{team_id}/editors/{member_id}`

---

### 5.6 `MemberRemovalImpactModal` (Screen 16)

**File:** `src/components/MemberRemovalImpactModal/index.tsx`

Shown before `DELETE /organizations/{org_id}/members/{member_id}`.

```
Removing [Name] will:

• 2 shared accounts they added    → reassigned to org owner
• 1 personal account              → permanently revoked
• 3 personas using shared accounts → unaffected

[Cancel]   [Remove member]
```

**New backend endpoint required:** `GET /organizations/{org_id}/members/{member_id}/removal-preview`

---

### 5.7 `OverflowRequestModal`

**File:** `src/components/OverflowRequestModal/index.tsx`

Team-level credit overflow request. Shown when a team's allocation is running low and a TeamEditor wants to request more from the org pool.

```
Request additional credits for [Team Name]

Amount needed (optional): [____] credits
Note: [__________________]

[Cancel]   [Submit request]
```

**API:** `POST /organizations/{org_id}/teams/{team_id}/overflow`  
Body: `{ amount?: number, note: string }`  
**Gate:** Only shown to TeamEditor+ on the team.

---

### 5.8 `WorkspaceLockedOverlay`

**File:** `src/components/WorkspaceLockedOverlay/index.tsx`

Shown when `pool_status === 'locked'`. Blocks chat input.

```
Workspace paused

Your team has used all credits this billing cycle.

[Admin]  Add credits →       links to /settings/org/plans
[Member] Contact your workspace admin to add credits.
```

Non-AI surfaces (settings, file uploads) remain accessible.

---

### 5.9 `PersonaVisibilitySelector` (Tracker 5a)

**File:** `src/components/PersonaVisibilitySelector/index.tsx`

Three-state picker for the Sharing tab in agent configure.

```
○ Private      Only you
● Team         [Multi-select team dropdown]
○ Community    Anyone on Souvenir
```

- `team` option **disabled** for members without TeamEditor grant; tooltip: "Editors can publish to teams"
- When `team` selected → show team multi-select (only teams where user has TeamEditor)
- **API:** `PATCH /persona/{repoId}/visibility` + `PATCH /persona/{repoId}/team-access`

---

### 5.10 `SidebarTeamSwitcher`

**File:** `src/components/SidebarTeamSwitcher/index.tsx`

Dropdown/popover in sidebar to switch between personal context and org workspace.

- Shows `OrganizationResponse.name` + `logo_url`
- "Organisation" nav link (owner/admin only) → `/settings/org/`
- Divider separating personal nav from workspace nav

**Data:** `GET /organizations` → pick active org.

---

### 5.11 `EnterpriseFeatureLock`

**File:** `src/components/EnterpriseFeatureLock/index.tsx`

Row-level lock shown in Security settings for features that require the Enterprise plan.

```
[ENTERPRISE]   SAML 2.0 Single Sign-On
               Upgrade to Enterprise to enable.
               [Talk to sales →]
```

**Used on:** SAML row, SCIM row, 12-month audit row.

---

### 5.12 `RoleGate`

**File:** `src/components/RoleGate/index.tsx`

Generic wrapper that hides or disables children based on org role or TeamEditor status.

```tsx
interface RoleGateProps {
  require: 'admin' | 'owner' | 'team-editor'
  teamId?: string                     // required when require === 'team-editor'
  fallback?: ReactNode
  children: ReactNode
}
```

---

### 5.13 `RoleBadge` (Tracker 3c)

**File:** `src/components/RoleBadge/index.tsx`

| Role | Color |
|------|-------|
| Owner | Neutral |
| Admin | Neutral |
| Member | Yellow |
| Team Editor | Green |

---

### 5.14 `TeamChip` (Tracker 3e)

**File:** `src/components/TeamChip/index.tsx`

```
● Marketing
```

Green dot + team name. Used in member rows, persona cards, connector scope labels.

---

### 5.15 `WorkspaceBadge` (Tracker 3f)

**File:** `src/components/WorkspaceBadge/index.tsx`

Compact badge showing org name + `logo_url`. Used in sidebar team switcher and context chips.

---

## 6. Frontend: Existing Components to Wire

### 6.1 Create `useWorkspaceRole()` Hook

**File:** `src/hooks/useWorkspaceRole.ts`

```ts
interface WorkspaceRoleContext {
  orgRole: OrganizationRole | null       // 'owner' | 'admin' | 'member'
  isOwner: boolean
  isAdmin: boolean                        // owner OR admin
  isTeamEditor: (teamId: string) => boolean
  currentUserId: string | null
  isLoading: boolean
}

export function useWorkspaceRole(): WorkspaceRoleContext
```

**Implementation:**
1. Call `GET /organizations` → pick active org → read `my_role` for `orgRole`
2. Call `GET /users/me` → read user ID for `currentUserId`
3. For `isTeamEditor`: lazy-fetch `GET /organizations/{org_id}/teams/{team_id}/editors` per team on first call (cache by teamId)

**Wire to all admin panel pages** — replace every `isAdmin = true` and `CURRENT_USER_ID = 'u1'`:

| File | Change |
|------|--------|
| `settings/org/activity/page.tsx` | `isAdmin` → `useWorkspaceRole().isAdmin`; `CURRENT_USER_ID` → `currentUserId` |
| `settings/org/analytics/page.tsx` | Same |
| `settings/org/plans/page.tsx` | Same + gate top-up + payment card change to `isOwner` |
| `settings/org/security/page.tsx` | Same + gate all toggles |
| `settings/org/general/page.tsx` | Same |
| `settings/org/connectors/page.tsx` | Drive tab visibility (Manage/Requests/Catalog for admin; My Connectors/Browse for member) |
| `settings/org/members/page.tsx` | `CURRENT_USER_ID` → `currentUserId` |
| `settings/org/teams/page.tsx` | New-team creator identity |

---

### 6.2 Create `useOrgPlan()` Hook

**File:** `src/hooks/useOrgPlan.ts`

```ts
interface OrgPlanContext {
  poolStatus: string | null             // pool_status value from API
  percentUsed: number
  remaining: number
  planCredits: number
  topupCredits: number
  totalCredits: number
  used: number
  members: MemberResponse[]
  isLoading: boolean
}

export function useOrgPlan(): OrgPlanContext
```

**Data source:** `GET /organizations/{org_id}/pool-status` (for status/percent) + `GET /organizations/{org_id}/plan` (for full credit breakdown + members).

---

### 6.3 Create `useIndividualPlan()` Hook

**File:** `src/hooks/useIndividualPlan.ts`

```ts
interface IndividualPlanContext {
  planType: PlanType | null             // 'starter' | 'pro' | 'power' | 'trial' | 'teams'
  canUsePersonalConnectors: boolean     // planType in ['pro', 'power', 'trial']
  isTrialing: boolean
  trialRemaining?: number
  trialExpiresAt?: string
  isLoading: boolean
}

export function useIndividualPlan(): IndividualPlanContext
```

**Data source:** `GET /users/me` → `plan.plan_type` + `usage.trial`. **No new endpoint needed.**

---

### 6.4 Wire `WorkspaceStatusBanner`

**Placement:** Workspace layout — insert before page content when `poolStatus !== 'normal'`.

```tsx
const { poolStatus } = useOrgPlan()
const { isAdmin } = useWorkspaceRole()

{poolStatus && poolStatus !== 'normal' && poolStatus !== 'warning_80' && (
  <WorkspaceStatusBanner
    poolStatus={poolStatus}              // was tokenStatus — use pool_status now
    isAdmin={isAdmin}
  />
)}
```

---

### 6.5 Wire `InlineCreditNotice`

**Placement:** Above `ChatInput` in workspace sessions only.

```tsx
{isWorkspaceSession && ['warning_95', 'grace', 'locked'].includes(poolStatus) && (
  <InlineCreditNotice
    poolStatus={poolStatus}
    isAdmin={isAdmin}
    onAddCredits={() => router.push('/settings/org/plans')}
  />
)}
```

When `poolStatus === 'locked'` — render `WorkspaceLockedOverlay` instead and disable the chat input.

---

### 6.6 Wire `TokenPoolBar`

**Placement:** Plans page + Analytics page.  
**Data:** `useOrgPlan().percentUsed` + `poolStatus`.

---

### 6.7 Wire Plans Page to Live Billing

**File:** `settings/org/plans/page.tsx`

Replace all hardcoded values:

| Hardcoded value | Replace with |
|----------------|-------------|
| `$150/month` | `GET /stripe/billing` → `BillingInfo.credits.total_credits` context + plan name |
| Next billing date | `BillingInfo.upcoming_invoice.next_payment_date` |
| Credits included | `GET /organizations/{org_id}/plan` → `plan_credits` |
| Credits remaining | `PlanResponse.remaining` |
| Credits used | `PlanResponse.used` |
| Invoice list | `BillingInfo.invoices[]` — `amount_paid` (dollars), `invoice_url`, `invoice_pdf` |
| Payment card | `BillingInfo.payment_method` — `brand`, `last4`, `exp_month`, `exp_year` |
| Default caps | `PlanResponse.members[].credit_cap` |

**Billing portal:** `POST /stripe/portal` → redirect to `portal_url` for card changes (owner only).  
**Top-up:** `POST /stripe/topup` → redirect to `checkout_url`. Amount is free input in USD, not fixed packs.  
**Upgrade:** `POST /stripe/checkout` → `{ plan_type: PlanType, billing: 'monthly' | 'annual' }` → redirect to `checkout_url`.

**Role split on Plans page:**
- Top-up CTA: `isAdmin` only (owner or admin)
- "Change payment method" → `POST /stripe/portal`: **owner only**

---

### 6.8 Wire Activity/Audit Page

**File:** `settings/org/activity/page.tsx`  
**Data source:** `GET /organizations/{org_id}/audit?limit=100&offset=0` → `AuditEntry[]`

**Schema delta from plan:** `AuditEntry` has:
- `actor_user_id` (not `memberId`)
- `action: string` (free string — not a typed enum; filter dropdown must use distinct `action` values seen in responses, or a hardcoded map)
- `target_type?: string`, `target_id?: string`, `extra?: object`
- No `memberName` — resolve name by joining against `PlanResponse.members[]`

---

### 6.9 Wire Analytics Page

**File:** `settings/org/analytics/page.tsx`

| Hardcoded value | Replace with |
|----------------|-------------|
| Chart series (chat/assistants/brain) | `GET /organizations/{org_id}/plan/usage` → `UsageBreakdownResponse.by_team` + Stripe `CategoryUsage` |
| Credit pool progress bar | `useOrgPlan().percentUsed` |
| Per-team usage | `UsageBreakdownResponse.by_team[].credits_used` |
| Per-member caps | `PlanResponse.members[]` |

---

### 6.10 Wire Connectors Page — Split Pool and Connections

**File:** `settings/org/connectors/page.tsx`

Current page merges pool and connections. They are different API surfaces:

**Admin view — Pool tab:**
- `GET /organizations/{org_id}/teams/{team_id}/connectors` → shows pending/approved/denied slugs
- Approve: `PATCH /organizations/{org_id}/teams/{team_id}/connectors/{slug}` `{ status: 'approved' }`
- Deny: same with `status: 'denied'`

**Admin/TeamEditor view — Connections tab:**
- `GET /organizations/{org_id}/teams/{team_id}/connections` → `ConnectorCatalogEntry[]` with `workspace_linked`, `workspace_linked_by`
- Link OAuth: `POST /organizations/{org_id}/teams/{team_id}/connections/{slug}/link` → `LinkResponse.redirect_url`

**Member view — My Connectors tab:**
- `GET /connectors` → personal connectors; render `ConnectorPausedBadge` when `linked === false` and `plan_type === 'starter'`
- `workspace_linked === true` on an entry → show "Also linked at workspace level" indicator

**Member view — Browse/Request tab:**
- Shows catalog; unapproved connectors show "Request" button
- Request: `POST /organizations/{org_id}/teams/{team_id}/connectors` `{ slug, note }`

---

### 6.11 Wire Invite Flow Correctly

The current `InviteModal` assumes org-level invite with a role picker. The live API only has **team-level invites**.

`POST /organizations/{org_id}/teams/{team_id}/invites` → `{ emails: string[] }`  
Returns `InviteResponse` with `invite_url` and `expires_at`.

**No role field on invite.** Role at the team level is always "member" until explicitly promoted to TeamEditor via `/editors`.

**Org-level member management** (changing roles, setting caps, removing) works via:
- `PATCH /organizations/{org_id}/members/{member_id}/role` — `{ role: OrganizationRole }`
- `PATCH /organizations/{org_id}/members/{member_id}/cap` — `{ creditCap: number | null }`
- `DELETE /organizations/{org_id}/members/{member_id}`

The `InviteModal` must be reworked: it is team-scoped, takes emails only, and no role dropdown.

---

## 7. Backend: Enforcement Changes Required

### 7.1 Individual Plan Tier Check — `POST /connectors/{slug}/link`

**File:** `services/connectors/service.py` → `initiate_link()`

Check `user.plan_type` before initiating OAuth. Return `403` for `starter`.

```python
async def initiate_link(auth0_id: str, slug: str, db: AsyncSession):
    user = await user_service.get_user(auth0_id, db)
    if user.plan_type == 'starter':
        raise HTTPException(
            status_code=403,
            detail={"code": "plan_required", "required_tier": "pro"}
        )
    # existing logic...
```

**Frontend handles `403 plan_required`:** Show `PlanGate` upgrade prompt.

---

### 7.2 `paused` Field on `GET /connectors`

**File:** `services/connectors/service.py` → `list_user_connectors()`

Add `paused: bool` to `ConnectorCatalogEntry`. Set `true` when connector is `linked` in Composio but `user.plan_type === 'starter'`.

Frontend renders `ConnectorPausedBadge` when `paused === true`.

---

### 7.3 Member Removal Preview Endpoint

**New endpoint:** `GET /organizations/{org_id}/members/{member_id}/removal-preview`

```json
{
  "shared_accounts_added": 2,
  "personal_accounts_revoked": 1,
  "personas_using_shared_accounts": 3,
  "shared_accounts_reassign_to": "owner"
}
```

Called by `MemberRemovalImpactModal` before `DELETE /organizations/{org_id}/members/{member_id}`.

---

### 7.4 TeamEditor Grant Endpoint (Add)

The live API has `DELETE /organizations/{org_id}/teams/{team_id}/editors/{member_id}` but **no `POST`** to add a TeamEditor. Need:

**New endpoint:** `POST /organizations/{org_id}/teams/{team_id}/editors`  
Body: `{ userId: string }`  
Response `201`: `PersonResponse`

Used by `AdminTeamEditorDialog` to grant TeamEditor status.

---

### 7.5 Org-Level Member List Endpoint

The live API has no `GET /organizations/{org_id}/members`. Member data is embedded in `PlanResponse.members[]` but that's the credit/cap view, not a full member list with invite status.

**New endpoint:** `GET /organizations/{org_id}/members`  
Returns: `MemberResponse[]` (already defined in schema — `user_id`, `name`, `email`, `role`, `credit_cap`, `credit_used`, `invite_status`)

Used by: Members page, activity page (name resolution), invite flow.

---

### 7.6 Workspace Locked — Block AI Endpoints

**File:** Chat/brain handler middleware

When `org.pool_status === 'locked'`, return `402 Payment Required`:
```json
{ "code": "workspace_locked", "message": "Add credits to continue." }
```

**Frontend:** Catches 402 with `workspace_locked` code → renders `WorkspaceLockedOverlay`.

---

### 7.7 Per-Member Credit Cap Enforcement

**File:** Chat/brain usage tracking

Before processing a chat or brain request, check `member.credit_used >= member.credit_cap` (when `credit_cap !== null`). Return `402`:
```json
{ "code": "credit_cap_exceeded", "cap": 25000, "used": 25001 }
```

**Frontend:** Shows inline notice "You've reached your credit limit — contact your admin."

---

### 7.8 Org Role Enforcement on `/organizations/*` Endpoints

**File:** org router middleware / FastAPI dependency

Add role-check dependencies. The API currently has no documented role enforcement — the backend accepts any authenticated request.

```python
# Require owner or admin
async def require_admin(
    organization_id: UUID,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    member = await get_org_member(org_id=organization_id, user_id=current_user.id, db=db)
    if member.role not in ('owner', 'admin'):
        raise HTTPException(403, detail="Admin required")
    return member

# Applied to:
# PATCH /organizations/{org_id}
# PATCH /organizations/{org_id}/settings
# PATCH /organizations/{org_id}/members/{id}/role
# PATCH /organizations/{org_id}/members/{id}/cap
# DELETE /organizations/{org_id}/members/{id}
# PATCH /organizations/{org_id}/teams/{team_id}/connectors/{slug}  (approve/deny)
```

```python
# Require owner only (billing/payment)
async def require_owner(...)
    if member.role != 'owner':
        raise HTTPException(403, detail="Owner required")

# Applied to:
# POST /stripe/portal  (billing portal = card changes)
# DELETE /stripe/subscription
```

```python
# Require TeamEditor on specific team
async def require_team_editor(team_id: UUID, ...)
    editors = await get_team_editors(team_id=team_id, db=db)
    if current_user.id not in [e.user_id for e in editors]:
        if member.role not in ('owner', 'admin'):
            raise HTTPException(403, detail="Team editor required")

# Applied to:
# POST /organizations/{org_id}/teams/{team_id}/connections/{slug}/link
# PATCH /organizations/{org_id}/teams/{team_id}/connections/{slug}
# DELETE /organizations/{org_id}/teams/{team_id}/connections/{slug}
# POST /organizations/{org_id}/teams/{team_id}/invites
# POST /organizations/{org_id}/teams/{team_id}/overflow
```

---

### 7.9 Enterprise-Only Feature Gates

Return `403 enterprise_required` for SAML/SCIM endpoints when org is not on Enterprise plan. These endpoints don't exist yet — add them as stubs that return this error until the Enterprise rollout.

---

## 8. Enforcement Architecture

### 8.1 Dual-Layer Rule

Frontend gates are UX. Backend enforcement is the real guardrail. **Both must exist for every gate.** Frontend prevents bad requests; backend rejects any that slip through.

```
GET /users/me              → individual plan tier (canUsePersonalConnectors)
GET /organizations         → org list + my_role (isAdmin, isOwner)
GET /organizations/{id}/pool-status → pool_status (credit state)
GET /organizations/{id}/teams/{tid}/editors → isTeamEditor(teamId)
         ↓
  useWorkspaceRole() + useOrgPlan() + useIndividualPlan()
         ↓
  RoleGate / PlanGate wrapper components
         ↓
  API call → backend enforces independently
         ↓
  403 / 402 response → error interceptor → upgrade/permission UI
```

### 8.2 Error Code → UI Mapping

Global API error interceptor catches guardrail errors and routes to the right UI:

| HTTP status + code | UI response |
|--------------------|-------------|
| `403 plan_required` | `PlanGate` upgrade prompt (connect flow) |
| `403 enterprise_required` | `EnterpriseFeatureLock` component |
| `402 credit_cap_exceeded` | Inline "Credit limit reached" notice |
| `402 workspace_locked` | `WorkspaceLockedOverlay` |
| `403` (generic) | Role permission error toast |

### 8.3 Organization Context Provider

Wrap the org section of the app in a context that provides the resolved `organization_id` UUID:

```tsx
// src/contexts/OrgContext.tsx
interface OrgContext {
  orgId: string | null
  org: OrganizationResponse | null
  isLoading: boolean
}
```

All hooks and API calls in org-scoped pages read `orgId` from this context rather than re-fetching `GET /organizations` per component.

---

## 9. Phased Implementation Plan

### Phase 0 — Auth & Identity Wiring (Unblocks Everything)

**Goal:** Replace all hardcoded role/identity values. Every downstream phase depends on this.  
**Effort:** 3–4 days  
**Owner:** Frontend

| # | Task | File(s) |
|---|------|---------|
| 0.1 | Create `OrgContext` provider — resolves `organization_id` from `GET /organizations` | `src/contexts/OrgContext.tsx` |
| 0.2 | Create `useWorkspaceRole()` hook — `orgRole`, `isAdmin`, `isOwner`, `isTeamEditor(teamId)` | `src/hooks/useWorkspaceRole.ts` |
| 0.3 | Replace `isAdmin = true` on all 7 admin panel pages | `settings/org/*/page.tsx` |
| 0.4 | Replace `CURRENT_USER_ID = 'u1'` with `currentUserId` from hook | `settings/org/activity/page.tsx` |
| 0.5 | Replace new-team owner hardcode with authenticated user identity | `settings/org/teams/page.tsx` |
| 0.6 | Add route guard on `/settings/org/*` — redirect `member` without admin rights | Route middleware |

---

### Phase 1 — Team Credit Guardrails

**Goal:** Pool status, credit banners, and locked workspace enforced end-to-end.  
**Effort:** 3–4 days  
**Owner:** Frontend + Backend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 1.1 | Create `useOrgPlan()` hook — `pool_status`, `percent_used`, `remaining`, `members` | FE | `src/hooks/useOrgPlan.ts` |
| 1.2 | Place `WorkspaceStatusBanner` in workspace layout (reads `pool_status`) | FE | `src/app/(app)/layout.tsx` |
| 1.3 | Wire `InlineCreditNotice` above ChatInput — reads `pool_status` | FE | Chat layout |
| 1.4 | Wire `TokenPoolBar` to `useOrgPlan().percentUsed` | FE | Plans + Analytics pages |
| 1.5 | Build `WorkspaceLockedOverlay` component | FE | `src/components/WorkspaceLockedOverlay/` |
| 1.6 | Disable ChatInput + show overlay when `pool_status === 'locked'` | FE | Chat layout |
| 1.7 | Backend: return `402 workspace_locked` on AI endpoints when locked | BE | Chat/brain handler |
| 1.8 | Backend: per-member credit cap enforcement → `402 credit_cap_exceeded` | BE | Chat/brain handler |
| 1.9 | Frontend: handle `402 workspace_locked` → overlay | FE | API interceptor |
| 1.10 | Frontend: handle `402 credit_cap_exceeded` → inline notice | FE | API interceptor |
| 1.11 | Build `OverflowRequestModal` | FE | `src/components/OverflowRequestModal/` |
| 1.12 | Wire `OverflowRequestModal` → `POST /organizations/{org_id}/teams/{team_id}/overflow` | FE | Team credit section |

---

### Phase 2 — Individual Plan Connector Guardrails

**Goal:** Personal connector gating by individual plan tier, end-to-end.  
**Effort:** 3–4 days  
**Owner:** Frontend + Backend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 2.1 | Create `useIndividualPlan()` hook — reads `GET /users/me` → `plan.plan_type` | FE | `src/hooks/useIndividualPlan.ts` |
| 2.2 | Backend: plan tier check in `POST /connectors/{slug}/link` → 403 on `starter` | BE | `services/connectors/service.py` |
| 2.3 | Backend: add `paused: boolean` to `GET /connectors` response | BE | `services/connectors/service.py` |
| 2.4 | Build `ConnectorPausedBadge` component | FE | `src/components/ConnectorPausedBadge/` |
| 2.5 | Build `PlanGate` wrapper component | FE | `src/components/PlanGate/` |
| 2.6 | Render `ConnectorPausedBadge` on connectors where `paused === true` | FE | Connector list |
| 2.7 | Handle `403 plan_required` in API interceptor → show `PlanGate` upgrade prompt | FE | API interceptor |
| 2.8 | Build `PlanDowngradeModal` — reads live `GET /connectors` for at-risk list | FE | `src/components/PlanDowngradeModal/` |
| 2.9 | Trigger `PlanDowngradeModal` before confirming downgrade in Plans page | FE | `settings/org/plans/page.tsx` |
| 2.10 | Display `workspace_linked` indicator on personal connector list entries | FE | Connector list |

---

### Phase 3 — Team Role-Based Connector Controls

**Goal:** Pool/connection split enforced; role-aware add-account and approval flows.  
**Effort:** 4–5 days  
**Owner:** Frontend + Backend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 3.1 | Backend: add role guards on org connector endpoints (admin-only approve/deny) | BE | `services/org/connectors/router.py` |
| 3.2 | Backend: add TeamEditor guard on team connections link/patch/delete | BE | Same |
| 3.3 | Backend: new `POST /organizations/{org_id}/teams/{team_id}/editors` | BE | `services/org/teams/router.py` |
| 3.4 | Backend: new `GET /organizations/{org_id}/members` list endpoint | BE | `services/org/members/router.py` |
| 3.5 | Wire connectors page: split into Pool tab + Connections tab | FE | `settings/org/connectors/page.tsx` |
| 3.6 | Wire Pool tab → `GET /organizations/{org_id}/teams/{team_id}/connectors` | FE | Same |
| 3.7 | Wire Connections tab → `GET /organizations/{org_id}/teams/{team_id}/connections` | FE | Same |
| 3.8 | Build `AddAccountScopeDialog` — role-aware scope picker (E2) | FE | `src/components/AddAccountScopeDialog/` |
| 3.9 | Build `AdminTeamEditorDialog` — grant/revoke TeamEditor for connector (E3) | FE | `src/components/AdminTeamEditorDialog/` |
| 3.10 | Backend: new `GET /organizations/{org_id}/members/{id}/removal-preview` | BE | `services/org/members/router.py` |
| 3.11 | Build `MemberRemovalImpactModal` — connector reassignment preview | FE | `src/components/MemberRemovalImpactModal/` |
| 3.12 | Trigger `MemberRemovalImpactModal` before `DELETE /organizations/{org_id}/members/{id}` | FE | Members page |
| 3.13 | Rework `InviteModal` — team-scoped, emails only, no role dropdown | FE | `src/components/InviteModal/` |

---

### Phase 4 — Plans & Billing Live Wiring

**Goal:** All hardcoded plan/billing values replaced with live API data.  
**Effort:** 2–3 days  
**Owner:** Frontend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 4.1 | Wire Plans page to `GET /stripe/billing` + `GET /organizations/{org_id}/plan` | FE | `settings/org/plans/page.tsx` |
| 4.2 | Wire Analytics page to `GET /organizations/{org_id}/plan/usage` | FE | `settings/org/analytics/page.tsx` |
| 4.3 | Wire audit/activity page to `GET /organizations/{org_id}/audit` | FE | `settings/org/activity/page.tsx` |
| 4.4 | Map `AuditEntry.action` string → display label in activity filters | FE | Same |
| 4.5 | Wire members page to `GET /organizations/{org_id}/members` (new endpoint) | FE | `settings/org/members/page.tsx` |
| 4.6 | Resolve member names on activity page from members list | FE | `settings/org/activity/page.tsx` |
| 4.7 | Gate billing portal CTA to `isOwner` only | FE | `settings/org/plans/page.tsx` |
| 4.8 | Wire top-up to `POST /stripe/topup` (free amount input, not fixed packs) | FE | `settings/org/plans/page.tsx` |

---

### Phase 5 — Persona & Project Publishing Guardrails

**Goal:** Persona team publishing and project sharing gated by role.  
**Effort:** 3–4 days  
**Owner:** Frontend + Backend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 5.1 | Build `PersonaVisibilitySelector` component (tracker 5a) | FE | `src/components/PersonaVisibilitySelector/` |
| 5.2 | Wire to Sharing tab in agent configure | FE | `src/app/(app)/agent/configure/` |
| 5.3 | Backend: role check on `PATCH /persona/{repoId}/visibility` for `team` scope | BE | `services/personas/router.py` |
| 5.4 | Disable `team` option for members without TeamEditor grant | FE | `PersonaVisibilitySelector` |
| 5.5 | Add `TeamBadge` to persona cards for `visibility === 'team'` personas | FE | Persona card component |
| 5.6 | Build `RoleBadge` (tracker 3c) | FE | `src/components/RoleBadge/` |
| 5.7 | Build `TeamChip` (tracker 3e) | FE | `src/components/TeamChip/` |
| 5.8 | Build `WorkspaceBadge` (tracker 3f) | FE | `src/components/WorkspaceBadge/` |
| 5.9 | ✅ Team-project 4-tab view (Your chats / Publish to team / Shared with you / View only), gated by the `caps` ladder; per-chat publish via `PATCH /chats/{id}/visibility`; chats sourced from global `GET /chats` filtered by project | FE | `project/[id]/page.tsx`, `ProjectChatRow`, `lib/roles.ts`, `org-context` |
| 5.10 | ✅ "Shared with you" (editable) + "View only" (read-only) tabs → `GET /chat-shares/shared-with-me` filtered by `targetProjectId` + `mode`; read-only disclaimer row | FE | `project/[id]/page.tsx` |
| 5.11 | ✅ Fork-a-run from an editable share → `POST /chat-shares/{share_id}/fork` (reuses existing fork); view-only opens `/chat-shares/{shareId}` | FE | `project/[id]/page.tsx` |

---

### Phase 6 — Navigation & Enterprise Gates

**Goal:** Sidebar team context, org switcher, Enterprise feature locks.  
**Effort:** 3–4 days  
**Owner:** Frontend

| # | Task | Type | File(s) |
|---|------|------|---------|
| 6.1 | Build `SidebarTeamSwitcher` → `GET /organizations` | FE | `src/components/SidebarTeamSwitcher/` |
| 6.2 | Build `EnterpriseFeatureLock` component | FE | `src/components/EnterpriseFeatureLock/` |
| 6.3 | Apply `EnterpriseFeatureLock` to SAML/SCIM rows in Security settings | FE | `settings/org/security/page.tsx` |
| 6.4 | Apply `EnterpriseFeatureLock` to 12-month audit retention | FE | `settings/org/activity/page.tsx` |
| 6.5 | Wire `ContextIndicator` to team/project session context | FE | TopBar |
| 6.6 | Build `RoleGate` wrapper component | FE | `src/components/RoleGate/` |
| 6.7 | Backend: add Enterprise plan check to SAML/SCIM stubs → `403 enterprise_required` | BE | Security router |

---

### Phase 7 — HITL & Brain Guardrails (Pending Backend)

**Goal:** Approval flow wired end-to-end. Blocked on backend building HITL endpoints.  
**Effort:** 2–3 days (after backend builds endpoints)  
**Owner:** Frontend

| # | Task | Type | Notes |
|---|------|------|-------|
| 7.1 | Wire `ApprovalCard` to HITL approval list endpoint | FE | Backend endpoint TBD |
| 7.2 | Wire accept/deny to HITL approval action endpoint | FE | Backend endpoint TBD |
| 7.3 | Wire `UndoToast` to undo endpoint | FE | Backend endpoint TBD |
| 7.4 | Gate accept/deny to `isAdmin || isTeamEditor(teamId)` | FE | `src/components/ApprovalCard/` |
| 7.5 | Backend: HITL threshold setting endpoint | BE | New security endpoint |
| 7.6 | Gate HITL threshold to `isAdmin` in Security settings | FE | `settings/org/security/page.tsx` |

---

## 10. Open Questions

| # | Question | Impact | Owner |
|---|----------|--------|-------|
| OQ1 | **`pool_status` exact enum values** — The `PoolStatusResponse.status` is typed as `string` in the OpenAPI. Exact values (`normal`, `warning_80`, `warning_95`, `grace`, `locked`) need to be confirmed with the backend team or added to the schema as an enum. | All credit components | Backend |
| OQ2 | **Org-level member invite** — There's no `POST /organizations/{org_id}/members/invite`. Invites are team-scoped only. How do you add someone to the org without a team? Is org membership implicit from team membership? | Members page, invite flow | Product + Backend |
| OQ3 | **HITL API path** — No HITL endpoints exist in any of the OpenAPI specs. Are these under `/organizations`, `/workspace`, or a separate service? Phase 7 is blocked on this. | Brain guardrails | Backend |
| OQ4 | **Security endpoints** — SSO, 2FA, domain claim, SAML, SCIM are all absent from the live API. Are these planned soon, or is the Security settings page purely static for now? | Phase 6 security | Product + Backend |
| OQ5 | **`AuditEntry.action` values** — Typed as free string. Should the backend emit a fixed set of action strings that the frontend can map to labels? Or does the frontend define the mapping? | Activity page filters | Backend |
| OQ6 | **Editor credit-assign capability** — Wireframe deferred this. Can TeamEditors set credit caps for members in their team, or is that owner/admin only? | Phase 4 | Product |
| OQ7 | **Workspace connector re-auth** — When a team OAuth token expires, who re-auths? The TeamEditor who linked it, or any admin? | Phase 3 connector lifecycle | Product + Backend |
| OQ8 | **Persona selector in team context** — Should the persona picker in chat filter to only personas accessible by the current team? | Phase 5 | Product |
| OQ9 | **`warning_80` banner** — `TokenPoolBar` shifts color at 80% but no banner fires. Should there be a dismissible notice at 80% or only at 95%? | Phase 1 credit UI | Product |
| OQ10 | **Project scope connector (Coming Soon in E2)** — The add-account dialog references a "Only a specific project" scope. In scope for V1? | Phase 3 | Product |

---

## Appendix: API Reference Map

Quick lookup of every live endpoint used in this plan.

| Domain | Method + Path | Used For |
|--------|--------------|---------|
| **Users** | `GET /users/me` | Individual plan tier, user identity |
| **Orgs** | `GET /organizations` | Org list, `my_role`, `org_id` |
| | `GET /organizations/{org_id}` | `my_role`, org name/logo |
| | `PATCH /organizations/{org_id}` | Update org name/slug |
| | `GET /organizations/{org_id}/settings` | `org_instructions`, email domains, defaults |
| | `PATCH /organizations/{org_id}/settings` | Update org settings |
| | `GET /organizations/{org_id}/plan` | Credit pool, member caps |
| | `GET /organizations/{org_id}/pool-status` | `pool_status` for banners |
| | `GET /organizations/{org_id}/plan/usage` | Per-team credit usage |
| | `PATCH /organizations/{org_id}/members/{id}/cap` | Set credit cap |
| | `PATCH /organizations/{org_id}/members/{id}/role` | Change org role |
| | `DELETE /organizations/{org_id}/members/{id}` | Remove member |
| | `GET /organizations/{org_id}/audit` | Activity/audit log |
| | `GET /organizations/{org_id}/teams` | List teams |
| | `POST /organizations/{org_id}/teams` | Create team |
| | `GET /organizations/{org_id}/teams/{team_id}/editors` | Check TeamEditor status |
| | `DELETE /organizations/{org_id}/teams/{team_id}/editors/{member_id}` | Revoke TeamEditor |
| | `GET /organizations/{org_id}/teams/{team_id}/connectors` | Connector pool |
| | `POST /organizations/{org_id}/teams/{team_id}/connectors` | Request connector |
| | `PATCH /organizations/{org_id}/teams/{team_id}/connectors/{slug}` | Approve/deny request |
| | `GET /organizations/{org_id}/teams/{team_id}/connections` | Linked OAuth accounts |
| | `POST /organizations/{org_id}/teams/{team_id}/connections/{slug}/link` | Link team connection |
| | `POST /organizations/{org_id}/teams/{team_id}/overflow` | Request credit overflow |
| | `POST /organizations/{org_id}/teams/{team_id}/invites` | Invite to team |
| **Connectors** | `GET /connectors` | Personal connectors + `workspace_linked` |
| | `POST /connectors/{slug}/link` | Link personal connector |
| | `DELETE /connectors/{slug}` | Unlink personal connector |
| **Stripe** | `GET /stripe/billing` | Plan info, invoices, payment method |
| | `POST /stripe/topup` | Add credits (redirect checkout) |
| | `POST /stripe/topup/charge` | Add credits (direct charge) |
| | `POST /stripe/checkout` | Plan upgrade |
| | `POST /stripe/portal` | Billing portal (owner only) |
| | `DELETE /stripe/subscription` | Cancel subscription |
| **Chat shares** | `POST /chat-shares` | Share chat with team |
| | `GET /chat-shares/shared-with-me` | Chats shared with me |
| | `POST /chat-shares/{share_id}/fork` | Fork a shared chat |
