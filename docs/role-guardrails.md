# Role-Based Feature Guardrails

> **Source priority** (highest → lowest): `guardrails-execution-plan.md` → `organizations-frontend-guide.md` → `frontend-org-connectors.md` → `org-pages-api-tracking.md` → `backend-requirements.md` → `teams-backend-spec.md` (aspirational — overridden wherever it conflicts).
> Generated: 2026-06-18. Update this file when any doc in `/docs` changes a role rule.

---

## 1. Role Architecture

The system has **three layered role layers**. Conflating them is the #1 source of bugs.

| Layer | Source | Values | Scope |
|---|---|---|---|
| **Org Role** | `GET /organizations/{id}` → `my_role` | `owner` \| `admin` \| `member` | Entire org |
| **Team Editor** | `GET /organizations/{id}/teams/{tid}/editors` | grant (boolean) | Per team |
| **Project Member** | per-project grant | grant (boolean) | Per project |

### Role Ladder (each level strictly adds capability)

```
member → editor (any team) → admin → owner
```

### Guard Functions (backend-enforced)

| Guard | Who passes |
|---|---|
| `get_organization_context` | Any org member |
| `require_organization_editor` | `owner` OR `admin` OR any TeamEditor |
| `require_team_editor` | `owner` OR `admin` OR editor of that specific team |
| `require_organization_admin` | `owner` or `admin` |
| `require_organization_owner` | `owner` only |

### RoleBadge Colors (UI)

| Role | Color |
|---|---|
| Owner | Neutral |
| Admin | Neutral |
| Member | Yellow |
| Team Editor | Green |

---

## 2. Critical Code Pattern

```ts
// WRONG — excludes owner
const isAdmin = currentUserRole === 'admin'

// CORRECT — matches live API
const isOwner    = orgRole === 'owner'
const isAdminish = orgRole === 'owner' || orgRole === 'admin'
const isTeamEditor = (teamId: string) => useWorkspaceRole().isTeamEditor(teamId)
```

Use the `useWorkspaceRole()` hook (Phase 0 deliverable) — never read `orgRole` ad-hoc per page.

---

## 3. Org Settings & Navigation

| Feature | Admin (owner + admin) | Editor (TeamEditor) | Member |
|---|---|---|---|
| Org badge in sidebar is interactive | ✅ (`showAdmin` flag) | ❌ | ❌ |
| Access `/settings/org/*` routes | ✅ | ❌ redirect | ❌ redirect |
| View org General settings | ✅ | ❌ | ❌ |
| Edit org settings (`PATCH /organizations/{id}`) | ✅ | ❌ | ❌ |
| View Members page | ✅ | ❌ | ❌ |
| View Teams page | ✅ | ❌ | ❌ |
| View Plans & Usage page | ✅ (full) | ❌ | ❌ |
| View Analytics page | ✅ | ❌ | ❌ |
| View Connectors org page | ✅ (admin tabs) | ❌ | ❌ |
| View Security settings | ✅ | ❌ | ❌ |
| View Activity Log (full org) | ✅ | ❌ | ❌ |

**Guard:** `/settings/org/*` must redirect any `member` (and editor without admin rights) — see `org-settings-api-integration.md`.

---

## 4. Members Management

| Feature | Admin (owner + admin) | Editor (TeamEditor) | Member |
|---|---|---|---|
| View member list | ✅ | ❌ | ❌ |
| Invite member to org | ✅ | ❌ | ❌ |
| Change member org role (`admin` ↔ `member`) | ✅ | ❌ | ❌ |
| Promote member to admin | ✅ | ❌ | ❌ |
| Remove member from org | ✅ | ❌ | ❌ |
| Transfer org ownership (`POST .../transfer-owner`) | Owner only | ❌ | ❌ |
| Set / change member credit cap | ✅ | ❌ | ❌ |
| View own credit usage | ✅ | ✅ | ✅ |
| Change own org role | ❌ (disabled — cannot self-demote) | ❌ | ❌ |

**Role change API notes:**
- `PATCH /organizations/{id}/members/{mid}/role` accepts `"admin" | "member"` **only** — `"owner"` is not valid here.
- Last admin protection: demoting last admin → `409`.
- Demoting yourself triggers `DemoteWarning` UI before confirming.

**Known bugs to fix (from org-pages-api-tracking.md):**
- `normalizeMember` collapses `owner` into `admin` — owner identity is lost.
- `isAdmin = currentUserRole === 'admin'` excludes owners from invite/role-change actions.
- Role dropdown offers only `['editor', 'member']` — missing `admin`; selecting `editor` incorrectly sends `'member'` to API.
- Owner identified by "first member with role === admin" — incorrect.

---

## 5. Teams Management

| Feature | Admin (owner + admin) | Editor (TeamEditor, within own teams) | Member |
|---|---|---|---|
| View all org teams | ✅ | ❌ (own teams only) | ❌ (own teams only) |
| Create team (`POST .../teams`) | ✅ | ❌ | ❌ |
| Archive team (sets 90-day recovery window) | ✅ | ❌ | ❌ |
| Unarchive team (within 90 days) | ✅ | ❌ | ❌ |
| Delete team (requires typing team name) | ✅ | ❌ | ❌ |
| Edit team settings | ✅ | ✅ (own teams) | ❌ |
| Add team editor (`POST .../editors`) | ✅ | ❌ | ❌ |
| Invite member to team (`POST .../invites`) | ✅ | ✅ (own teams) | ❌ |
| Manage team members table | ✅ | ✅ (own teams) | ❌ |
| Request credit overflow | ✅ | ✅ | ❌ |
| Approve credit overflow (`POST .../overflow/{id}/approve`) | ✅ | ❌ | ❌ |

**Team invite notes:**
- `role` in invite payload accepts `"admin" | "member"` only (not `"owner"`).
- 7-day TTL on invites.
- Accepting a team invite **cancels personal Stripe subscription — no refund** (leftover credits preserved).
- Accepting when already in another org → `409`.
- Invite preview (`GET /team-invite/{id}`) is the **only unauthenticated endpoint** in the system.

**Known bugs to fix:**
- `isAdmin = currentUserRole === 'admin'` → owners excluded from Create Team button.
- Route push uses wrong prefix `/org/teams/{id}` instead of `/settings/org/teams/{id}`.

---

## 6. Credit & Billing / Plans

| Feature | Owner only | Admin (non-owner) | Editor (TeamEditor) | Member |
|---|---|---|---|---|
| View Plans & Usage page (full) | ✅ | ✅ | ❌ | ❌ |
| Manage Stripe billing portal (`POST /stripe/portal`) | ✅ | ❌ | ❌ | ❌ |
| Cancel subscription (`DELETE /stripe/subscription`) | ✅ | ❌ | ❌ | ❌ |
| Payment section / billing cycle toggle | ✅ | ❌ | ❌ | ❌ |
| Tier slider | ✅ | ❌ | ❌ | ❌ |
| Admin permissions section | ✅ | ❌ | ❌ | ❌ |
| View invoice history | ✅ | ✅ | ❌ | ❌ |
| View billing data | ✅ | ✅ | ❌ | ❌ |
| Request plan change | ✅ | ✅ | ❌ | ❌ |
| Set default member credit cap | ✅ | ✅ | ❌ | ❌ |
| View own credit remaining | ✅ | ✅ | ✅ | ✅ |

**Credit API shape (live — `org-settings-api-integration.md`):**
```ts
credits.total_credits  // plan allowance + topups
credits.used           // scalar drawdown
credits.remaining      // explicit remaining
credits.by_category    // { chat, persona, brain }
```
> The `PLAN_CREDITS` constant (`starter=5k, pro=12k, power=60k`) in `plan-config.ts` is **stale** — billing page must read `total_credits` from backend.

**Pool status (live field: `pool_status`):**

| Status | Admin UI | Member UI |
|---|---|---|
| `healthy` / `normal` (< 80%) | Normal | Normal |
| `warning_80` | `WorkspaceStatusBanner` (admin CTA) | `InlineCreditNotice` (muted) |
| `warning_95` | `WorkspaceStatusBanner` (admin CTA → add credits) | `InlineCreditNotice` (muted) |
| `paused` / `locked` | `WorkspaceLockedOverlay` → "Add credits →" (`/settings/org/plans`) | `WorkspaceLockedOverlay` → "Contact your workspace admin" |

> `teams-backend-spec.md` uses the field name `tokenStatus` — this is **wrong**. Live API field is `pool_status`.

**Plan downgrade protection (individual plans):**
- `isDowngradeBlockedByUsage(targetPlan, counts)` checks resource counts vs `PLAN_LIMITS`.
- `DowngradeBlockedDialog` is a **hard block** — no "Proceed anyway."
- Limits: `starter: personas=3, pins=100, workflows=0` | `pro: personas=∞, pins=2000, workflows=2` | `power: personas=∞, pins=∞, workflows=∞`.

---

## 7. Connectors

### 7a. Org-Level Connector Controls

| Feature | Admin (owner + admin) | Editor (TeamEditor) | Member |
|---|---|---|---|
| View org connector catalog (`GET .../catalog`) | ✅ | ❌ | ❌ |
| Edit org catalog allowlist (`PUT .../catalog`) | ✅ | ❌ | ❌ |
| View blast-radius for connector (`used-by`) | ✅ | ✅ | ❌ |
| Create org shared connector account | ✅ | ❌ | ❌ |
| Edit org shared connector account | ✅ | ❌ | ❌ |
| Approve / deny personal connector requests | ✅ | ❌ | ❌ |
| View all personal connector requests | ✅ | ❌ | ❌ |
| Submit personal connector request | ✅ | ✅ | ✅ |

**Personal connector request rules:**
- Approved status widens member's allow-list: `org_enabled_slugs ∪ approved_personal_slugs`.
- Admins/owners: unrestricted connector access regardless.
- Still-pending or already-approved → `409` for non-admins trying to re-request.
- Denied → member **can** re-request.

### 7b. Team Connector Controls

| Feature | Admin (owner + admin) | Editor (TeamEditor, own teams) | Member |
|---|---|---|---|
| Attach / detach team connector (`PATCH .../connections/{slug}`) | ✅ | ✅ | ❌ |
| Request team connector access | ✅ (auto-approved) | ✅ (auto-approved) | ✅ (pending) |
| Approve team connector request | ✅ | ❌ | ❌ |
| Deny team connector request | ✅ | ❌ | ❌ |

> Deprecated `POST /link` endpoint always returns `400` — do not use.

### 7c. Personal Connector Linking (Individual Plan Gate)

| Individual Plan | Can link personal connectors |
|---|---|
| `starter` | ❌ (backend returns `403` on `POST /connectors/{slug}/link`) |
| `pro` | ✅ |
| `power` | ✅ |
| `trial` | ✅ |

### 7d. Connector Visibility (`GET /connectors`)

| User context | Sees |
|---|---|
| Non-org user | Full catalog |
| Org admin / owner | Full catalog |
| Org member / editor | Only `org_enabled` slugs + approved personal exceptions |

### 7e. AddAccountScopeDialog (connector scope options)

| Role | Scope options shown |
|---|---|
| Owner / admin | Personal / Shared Workspace / Shared Team |
| Member with TeamEditor | Personal + own teams only |
| Member without TeamEditor | "Request access" form only |

### 7f. Connector Per-Tool Policies

Policy values: `allow | block | ask | allow_once` (default: `ask`).
- `allow_once`: one-shot — flips back to `ask` after next successful execution.
- `tool_permission_prompt` SSE event: fires mid-stream when policy is `ask`; renders Allow / Block / Allow once buttons.
- `tool_connect_prompt` SSE event: fires when connector is not linked at all.

**WorkspaceConnectorCard — admin vs member UI:**
- Admin: Revoke / Connect / Retry / Manage buttons visible.
- Member: buttons hidden.

---

## 8. Personas & Publishing

| Feature | Admin (owner + admin) | Editor (TeamEditor) | Member (no team edit) |
|---|---|---|---|
| Create persona | ✅ | ✅ | ✅ |
| Edit own persona | ✅ | ✅ | ✅ |
| Set persona visibility to `private` | ✅ (owner only) | ✅ (owner only) | ✅ (owner only) |
| Publish persona to team (`team` visibility) | ✅ (owner + TeamEditor) | ✅ (owner + TeamEditor) | ❌ |
| Publish persona to community | ✅ | ✅ | ❌ |
| Share persona via SuperLink | ✅ | ✅ | ✅ (own, non-private personas) |
| Pause persona | ✅ (owner) | ✅ (owner) | ✅ (owner) |
| Use shared persona | ✅ | ✅ | ✅ |

**PersonaVisibilitySelector rules:**
- `team` option is **disabled** for members without TeamEditor grant.
- Tooltip on disabled state: `"Editors can publish to teams."`
- Only the **resource owner** may change visibility (not any admin).

**Individual plan gates on personas:**

| Plan | Persona limit |
|---|---|
| `starter` | 3 |
| `pro` | Unlimited |
| `power` | Unlimited |

**Persona sharing billing:**
- Credits for shared persona chats billed to the **sharer** (not the chat user).
- If share credit limit exceeded → `402`; if share inactive/expired → `410`.

---

## 9. Projects

| Feature | Admin (owner + admin) | Editor (TeamEditor) | Member |
|---|---|---|---|
| Create project | ✅ | ✅ | ✅ |
| Publish project to team | ✅ | ✅ | ✅ (own projects only) |
| Edit project | ✅ | ✅ (own projects) | ✅ (own projects) |
| Archive project | ✅ | ✅ (own) | ✅ (own) |
| Delete project | ✅ | ✅ (own) | ✅ (own) |

---

## 10. Chat & Chat Sharing

| Feature | Admin | Editor | Member | Notes |
|---|---|---|---|---|
| Start a chat | ✅ | ✅ | ✅ | Any logged-in user |
| Share chat (make public) | ✅ | ✅ | ✅ | Sharer must be chat owner |
| Share chat to team/project | ✅ | ✅ | ✅ | Requires `can-act-in-team` permission |
| Fork a shared chat | ✅ | ✅ | ✅ | Creates editable copy |
| Compare responses (multi-model) | Pro + Power plans only | Pro + Power plans | Pro + Power plans | Plan gate, not role gate |
| Use Mistral OCR | Power plan only | Power plan | Power plan | Plan gate |
| Power-only models | Power plan only | Power plan | Power plan | Lock icon shown for Starter/Pro |

**Chat share modes:** `'read_only' | 'editable'`.

---

## 11. SuperLinks

| Feature | Admin | Editor (TeamEditor) | Member |
|---|---|---|---|
| List all workspace SuperLinks | ✅ | ✅ | ❌ |
| List own-persona SuperLinks | ✅ | ✅ | ✅ (own only) |
| Create SuperLink | ✅ | ✅ | ❌ |
| Pause / resume SuperLink | ✅ | ✅ (own) | ❌ |
| Edit token limit | ✅ | ✅ (own) | ❌ |
| Revoke SuperLink | ✅ | ✅ (own) | ❌ |
| View SuperLink sessions | ✅ | ✅ (own) | ❌ |
| View SuperLink analytics | ✅ | ✅ | ❌ |

**SuperLink prerequisites:**
- Persona must be published (`visibility !== 'private'`) before a SuperLink can be created.
- `limit-reached` status: auto-set when `tokenUsed >= tokenLimit`; to re-enable → PATCH with higher `tokenLimit`.
- Public chat via SuperLink URL requires **no authentication**.
- `budget_warning` and `budget_exhausted` SSE events fire during SuperLink sessions.

---

## 12. Security Settings

| Feature | Admin | Editor | Member |
|---|---|---|---|
| View Security page | ✅ | ❌ | ❌ |
| HITL Threshold setting | ✅ (owner + admin — see bug note) | ❌ | ❌ |
| Google SSO / MS SSO toggle | ✅ | ❌ | ❌ |
| 2FA toggle | ✅ | ❌ | ❌ |
| Domain claiming | ✅ | ❌ | ❌ |
| SAML / SCIM | ❌ (enterprise only — currently hardcoded disabled) | ❌ | ❌ |

**HITL Threshold values (live API):** `'auto_proceed' | 'ask_tier_3_plus' | 'ask_everything'`
> `teams-backend-spec.md` used different strings (`'auto' | 'tier_3_plus' | 'everything'`) — these are **wrong**. Live API strings are above.

**HITL approval access:**

| Feature | Admin | Editor (TeamEditor) | Member |
|---|---|---|---|
| Accept / deny HITL approvals | ✅ | ✅ | ❌ |

**Known bugs to fix (org-pages-api-tracking.md):**
- All auth toggles (SSO, 2FA) are local state only — no backend calls.
- Domain claiming is mocked (setTimeout 2000ms, hardcoded TXT record).
- HITL Threshold never loaded from or saved to backend; always defaults to `'tier_3_plus'` from `DEFAULT_ORG`.
- SAML/SCIM permanently hardcoded disabled regardless of plan.
- `isAdmin = currentUserRole === 'admin'` → owners excluded from HITL section.

---

## 13. Activity Log & Analytics

| Feature | Admin | Editor | Member |
|---|---|---|---|
| View full org activity log | ✅ | ❌ | ❌ (own actions only, server-enforced) |
| View analytics page | ✅ | ❌ | ❌ |

**Activity log enforcement is server-side** — `actor_name` is included directly in the response. Frontend cannot override scope.

**Known bug:** Owner currently sees member subtitle ("Your activity") even though they should see the full org log.

---

## 14. Individual Plan Feature Gates

These gates apply to all users regardless of org role.

| Feature | Starter | Pro | Power |
|---|---|---|---|
| Model Compare panel | ❌ | ✅ | ✅ |
| Advanced models (Pro tier) | ❌ | ✅ | ✅ |
| Advanced routing | ❌ | ✅ | ✅ |
| Shared personas | ❌ | ✅ | ✅ |
| Unlimited web search | ❌ | ✅ | ✅ |
| Mistral OCR | ❌ | ❌ | ✅ |
| Workflow sharing | ❌ | ❌ | ✅ |
| Advanced analytics | ❌ | ❌ | ✅ |
| Priority compute | ❌ | ❌ | ✅ |
| Personal connector linking | ❌ (403) | ✅ | ✅ |
| Advanced Souvenir algorithm | ❌ (greyed, upgrade tooltip) | ✅ | ✅ |
| Power-only models | ❌ (lock icon) | ❌ (lock icon) | ✅ |

**Rule:** All plan gates must use `canAccessFeature(plan, 'featureKey')` from `plan-config.ts` — never inline `if (plan === 'power')`.

**Error HTTP responses and UI:**

| Error | Component shown |
|---|---|
| `403 plan_required` | `PlanGate` |
| `403 enterprise_required` | `EnterpriseFeatureLock` |
| `402 credit_cap_exceeded` | Inline credit notice |
| `402 workspace_locked` | `WorkspaceLockedOverlay` |
| `403` generic | Toast |

---

## 15. App Access Gate

A user can enter the main app only when **either**:
- `onboarding.completed === true`, **OR**
- `plan_type ∈ { starter, pro, power }` AND `subscription_status ∈ { active, trialing }`

Users with neither → blocked (redirected to onboarding/paywall).

**Stripe-gated routes:** return `401` if `session.user` is absent.

---

## 16. Hooks Reference (Phase 0 — must be wired before any guardrail logic)

```ts
useWorkspaceRole()     // exposes: orgRole, isOwner, isAdmin, isTeamEditor(teamId), currentUserId
useOrgPlan()           // exposes: poolStatus, percentUsed, remaining, members
useIndividualPlan()    // exposes: planType, canUsePersonalConnectors
```

All org settings pages currently have `isAdmin = true` **hardcoded** — replace with `useWorkspaceRole()` across the board before shipping any guardrail.

---

## 17. Known Aspirational vs Live API Conflicts

| Topic | Aspirational (teams-backend-spec.md) | Live API (authoritative) |
|---|---|---|
| Org roles | `admin \| editor \| member` | `owner \| admin \| member` |
| Pool status field | `tokenStatus` | `pool_status` |
| Pool status values | 3 states | 5 states (`healthy`, `warning_80`, `warning_95`, `paused`, `locked`) |
| HITL threshold strings | `auto \| tier_3_plus \| everything` | `auto_proceed \| ask_tier_3_plus \| ask_everything` |
| Invite role dropdown | Shown (role selector) | Not shown — role always `member` until TeamEditor promotion |
| Credit amounts | `PLAN_CREDITS` constant | `total_credits` from backend |

---

## 18. Implementation Status Audit

> Audited: 2026-06-18 against `d:\WJP Souvenir\front-end\src\`.
> Legend: ✅ Done · ⚠️ Partial · ❌ Not started

### Summary Dashboard

| Area | Status | Done / Total |
|---|---|---|
| Hooks | ⚠️ | 1 / 3 |
| Route guards | ✅ | 1 / 1 |
| Org settings pages (role-aware) | ⚠️ | 7 / 7 pages wired, but wrong pattern on 6 of them |
| Workspace status components | ⚠️ | Built, not wired to pool_status |
| Role UI components | ⚠️ | 3 / 5 |
| Plan gate helpers | ⚠️ | Defined, not called |
| Connectors (catalog split) | ✅ | 1 / 3 items |
| Persona visibility gate | ❌ | 0 / 1 |
| Security / HITL wiring | ❌ | Hardcoded |
| Members page bugs | ⚠️ | 1 / 3 fixed |

---

### 18.1 Hooks

| Hook | Status | File | Notes |
|---|---|---|---|
| `useWorkspaceRole()` | ❌ | — | Does not exist. Closest equivalent: `useOrg()` in `src/context/org-context.tsx`, which exposes `orgRole` and `currentUserRole` but **not** `isOwner`, `isAdmin`, `isTeamEditor()`, or `currentUserId`. |
| `useOrgPlan()` | ❌ | — | Does not exist. `useOrg()` exposes `plan: OrgPlan \| null` but not the clean hook interface. |
| `useIndividualPlan()` | ✅ | `src/hooks/use-individual-plan.ts` | Exposes `planType`, `isStarter`, `isPro`, `isPower`, `canUsePersonalConnectors`, `canUseAnalytics`, `isTeamMember`. |

---

### 18.2 Route Guards

| Guard | Status | File | Notes |
|---|---|---|---|
| `/settings/org/*` → redirect non-admins | ✅ | `src/app/(app)/org/layout.tsx:8–17` | Uses `useOrg()` → `currentUserRole`. Redirects to `/chat` if not admin. **Exception:** members can access `/org/connectors` (line 11 intentional bypass). |

---

### 18.3 Org Settings Pages — `orgRole` usage

All 7 pages are role-aware but **6 of 7 use the broken `isAdmin = currentUserRole === 'admin'` pattern**, which excludes owners. Only `/org/plans` uses the correct `isOwner` / `isAdminish` split.

| Page | Status | File | Pattern used |
|---|---|---|---|
| `/org/members` | ⚠️ | `src/app/(app)/org/members/page.tsx:708` | `isAdmin = currentUserRole === 'admin'` ← **excludes owner** |
| `/org/teams` | ⚠️ | `src/app/(app)/org/teams/page.tsx:193` | `isAdmin = currentUserRole === 'admin'` ← **excludes owner** |
| `/org/plans` | ✅ | `src/app/(app)/org/plans/page.tsx:365–366` | `isOwner = orgRole === 'owner'` + `isAdminish = orgRole === 'owner' \|\| orgRole === 'admin'` — correct |
| `/org/connectors` | ⚠️ | `src/app/(app)/org/connectors/page.tsx:2003` | `isAdminView = currentUserRole === 'admin'` ← **excludes owner** |
| `/org/security` | ⚠️ | `src/app/(app)/org/security/page.tsx:149` | `isAdmin = currentUserRole === 'admin'` ← **excludes owner** |
| `/org/activity` | ⚠️ | `src/app/(app)/org/activity/page.tsx:134` | `isAdmin = currentUserRole === 'admin'` ← **excludes owner** |
| `/org/analytics` | ⚠️ | `src/app/(app)/org/analytics/page.tsx` | Role checks present via `useOrg()` context — full wiring unconfirmed |

**Fix needed everywhere except `/org/plans`:**
```ts
// Replace this:
const isAdmin = currentUserRole === 'admin'
// With this:
const isAdminish = orgRole === 'owner' || orgRole === 'admin'
```

---

### 18.4 Workspace Status Components

All three display components are built. None are actively wired to the live `pool_status` API field.

| Component | Status | File | Notes |
|---|---|---|---|
| `WorkspaceLockedOverlay` | ⚠️ | `src/components/WorkspaceLockedOverlay/index.tsx` | Built. Accepts `isAdmin?`. Admin → "Add credits" link. Member → "Contact admin." Not wired to pool_status events. |
| `WorkspaceStatusBanner` | ⚠️ | `src/components/WorkspaceStatusBanner/index.tsx` | Built. Accepts `tokenStatus: 'warning_95' \| 'grace' \| 'locked'`. Field name mismatch: component uses `tokenStatus`, live API emits `pool_status`. |
| `InlineCreditNotice` | ⚠️ | `src/components/InlineCreditNotice/index.tsx` | Built. Accepts `isAdmin?`. Not rendered in any layout. |
| `TokenPoolBar` | ✅ | `src/components/TokenPoolBar/index.tsx` | Built. Computes status from `CreditPool` prop (`normal` / `warning_80` / `warning_95` / `grace` / `locked`). |
| `pool_status` consumed in layout | ❌ | — | `pool_status` exists in `src/types/teams.ts:142` and org context, but no layout/page renders the banner based on it. `DEFAULT_ORG` hardcodes `tokenStatus: 'normal'`. |

---

### 18.5 Role UI Components

| Component | Status | File | Notes |
|---|---|---|---|
| `RoleGate` | ✅ | `src/components/RoleGate/index.tsx` | Accepts `allow: OrgRole[]`. Uses `useOrg()` → `orgRole`. |
| `PlanGate` | ✅ | `src/components/PlanGate/index.tsx` | Accepts `allowed: boolean` computed by parent. |
| `RoleBadge` | ✅ | `src/components/RoleBadge/index.tsx` | Accepts `role: 'admin' \| 'editor' \| 'member'`. Note: `'owner'` not handled. |
| `PersonaVisibilitySelector` | ❌ | — | Does not exist. No TeamEditor check for `team` visibility option anywhere. |
| `AddAccountScopeDialog` | ❌ | — | Does not exist. No role-conditional connector scope options. |

---

### 18.6 Plan Gate Helpers

| Item | Status | File | Notes |
|---|---|---|---|
| `canAccessFeature()` defined | ✅ | `src/lib/plan-config.ts:129–135` | Function exists and is correct. |
| `canAccessFeature()` called in UI | ❌ | — | No active call sites found in UI components. Plan gating not enforced at render time. |
| `requiresModelUpgrade()` defined | ✅ | `src/lib/plan-config.ts:143–151` | Function exists. |
| `requiresModelUpgrade()` called in model picker | ❌ | — | No confirmed active call site. |
| Power-only model lock icons | ❌ | — | Not implemented in model dropdown. |
| Starter plan → `canUsePersonalConnectors: false` | ✅ | `src/hooks/use-individual-plan.ts` | Field derived and exposed. Frontend gate on link action: **not implemented**. |

---

### 18.7 Connectors

| Feature | Status | File | Notes |
|---|---|---|---|
| Org catalog page: admin tabs vs member view | ✅ | `src/app/(app)/org/connectors/page.tsx:2082–2104` | Admin: Catalog / Permissions / Manage tabs. Member: browse + request view. |
| Frontend gate: block starter from `POST /connectors/{slug}/link` | ❌ | — | `canUsePersonalConnectors` is exposed by `useIndividualPlan()` but no UI check blocks the link action. |
| `ConnectorCatalogEntry.personal_access_status` consumed in UI | ⚠️ | — | Field defined in API types. Minimal confirmed UI consumption. |

---

### 18.8 SuperLinks

| Feature | Status | File | Notes |
|---|---|---|---|
| SuperLinks list filters by role (admin sees all, member sees own) | ⚠️ | `src/templates/SuperLinks/index.tsx` | Component exists. No confirmed role-based filter on the list. Server-side enforcement unknown from frontend audit. |

---

### 18.9 Activity Log

| Feature | Status | File | Notes |
|---|---|---|---|
| Admin sees full org log; member sees own only (label) | ✅ | `src/app/(app)/org/activity/page.tsx:208` | Correct copy per role. Server enforces scope; frontend reflects it. |
| Owner still shown "Your activity" instead of full log | ❌ Bug | `src/app/(app)/org/activity/page.tsx:134` | `isAdmin = currentUserRole === 'admin'` excludes owner from the admin label. |

---

### 18.10 Security Page

| Feature | Status | File | Notes |
|---|---|---|---|
| HITL threshold loaded from backend | ❌ | `src/app/(app)/org/security/page.tsx:157` | Reads `org.hitlThreshold` from context but context is never fetched — `DEFAULT_ORG` hardcodes `'tier_3_plus'`. Correct live API strings are `auto_proceed \| ask_tier_3_plus \| ask_everything`; types file uses wrong strings (`auto \| tier_3_plus \| everything`). |
| HITL threshold saved to backend | ❌ | — | No API call on change. |
| Google SSO / MS SSO / 2FA toggles wired | ❌ | `src/app/(app)/org/security/page.tsx:151–156` | Local state only. No API calls. |
| Domain claiming wired | ❌ | — | Mocked with `setTimeout(2000)` and hardcoded TXT record. |
| SAML / SCIM available for enterprise | ❌ | — | Permanently disabled regardless of plan. |

---

### 18.11 Persona Sharing

| Feature | Status | File | Notes |
|---|---|---|---|
| `PersonaVisibilitySelector` with TeamEditor gate | ❌ | — | Component does not exist. |
| `team` visibility option disabled without TeamEditor | ❌ | — | No check anywhere in persona UI. |
| Persona billing resolution (`require_persona_budget`) | ❌ | — | No frontend call found. Backend-only concern, but no error handling for `402`/`410` from persona-share credit exhaustion. |

---

### 18.12 Members Page Bugs

| Bug | Status | File | Notes |
|---|---|---|---|
| `normalizeMember` collapses owner into admin | ✅ Fixed | `src/lib/api/organization.ts:96–109` | `orgRole` (raw `'owner' \| 'admin' \| 'member'`) stored separately from display `role`. |
| Role dropdown offers only `['editor', 'member']` | ❌ Still broken | `src/app/(app)/org/members/page.tsx:47` | `ROLES` array shows `['editor', 'member']` — `'admin'` option missing; `'editor'` should not appear at org level. |
| Invite API never called (TODO) | ✅ Fixed | `src/app/(app)/org/members/page.tsx:832` | `inviteTeamMembers(orgId, teamId, [email])` is now called. |

---

### 18.13 Outstanding Critical Gaps (Priority Order)

1. **`isAdmin` pattern** — Replace `currentUserRole === 'admin'` with `orgRole === 'owner' || orgRole === 'admin'` across `/org/members`, `/org/teams`, `/org/connectors`, `/org/security`, `/org/activity` (5 files).
2. **`useWorkspaceRole()` hook** — Build it wrapping `useOrg()` to expose `isOwner`, `isAdmin`, `isTeamEditor(teamId)`.
3. **pool_status wiring** — Connect `pool_status` from org context to `WorkspaceStatusBanner` / `WorkspaceLockedOverlay` in the org layout.
4. **`WorkspaceStatusBanner` field name** — Rename prop from `tokenStatus` → `poolStatus` to match live API field.
5. **HITL threshold** — Fetch from `GET /organizations/{id}/settings`, fix type strings, wire save call.
6. **`canAccessFeature()` call sites** — Add plan gate render logic in model dropdown, compare panel, and advanced algorithm toggle.
7. **`PersonaVisibilitySelector`** — Build component; disable `team` option when `!isTeamEditor(teamId)`.
8. **Role dropdown on Members page** — Replace `['editor', 'member']` with `['admin', 'member']`.
9. **Starter connector gate** — Check `canUsePersonalConnectors` before allowing link action; surface `PlanGate` if false.
10. **`RoleBadge`** — Add `'owner'` as a handled role variant.
