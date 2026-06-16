# Organization Pages — API Call Tracking

Covers every API call made by `/org/general` and the context providers that wrap it.
All endpoints are proxied through the Next.js route handler at `src/app/api/backend/[...path]/route.ts`
and forwarded to the backend at `SERVER_URL` (e.g. `https://devapi.getsouvenir.com`).
Auth0 Bearer tokens are injected by `apiFetch` in `src/lib/api/client.ts`.

---

## Feature integration status — `/org/general`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Workspace name | Yes | Yes | **Done.** `GET /organizations/{orgId}` returns `name`; loaded on mount into `workspaceName` state. `PATCH /organizations/{orgId}` with `{ name }` saves it. Response is written back to state. Data persists in backend. |
| Workspace URL slug | Yes | Yes — partial | **Implemented but missing validation.** `GET /organizations/{orgId}` returns `slug`; `PATCH /organizations/{orgId}` accepts `slug`. Backend enforces pattern `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase alphanumeric, hyphens only). Frontend has no client-side validation — an invalid slug reaches the backend and returns a 422 error shown via toast as a raw error message. Need to add a regex check before submit and a helper text explaining the format. |
| Workspace ID (read-only) | Yes | Yes | **Done.** `GET /organizations/{orgId}` returns `id`; displayed as a read-only field with a copy-to-clipboard button. Not editable. |
| Avatar / logo display | Yes | No | **Not implemented.** `GET /organizations/{orgId}` returns `logo_url` (nullable string). The frontend never reads this field — `logo_url` is absent from the `useEffect` state setter. The avatar circle always shows a static grey SVG placeholder regardless of whether the org has a logo. Need to: read `logo_url` from the response, store it in state, and conditionally render an `<img>` tag inside the avatar circle when a URL is present. |
| Avatar / logo upload | No | No | **Blocked — no backend endpoint.** `PATCH /organizations/{orgId}` accepts a `logoUrl` string field (max 1024 chars), so a URL can be stored, but there is no file upload endpoint in the spec. The backend does not provide a way to upload an image file and get back a URL. The "Change Avatar" button is hardcoded `disabled`. To implement this, the backend needs to provide an upload endpoint (e.g. `POST /organizations/{orgId}/logo`). |
| Organization-level AI instructions | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `org_instructions`; loaded into `aiInstructions` state. `PATCH /organizations/{orgId}/settings` with `{ orgInstructions }` saves it (null to clear). 3000-char limit enforced in the textarea. Data persists in backend. |
| Allowed email domains — display | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `allowed_email_domains` array; loaded into `allowedDomains` state and rendered as a list. |
| Allowed email domains — add new | Yes | No | **Not implemented.** `PATCH /organizations/{orgId}/settings` accepts `allowedEmailDomains` (string array), so the backend supports it. The "Add domain" button is hardcoded `disabled`. There is no input field, no validation, and no modal. Need to: add a text input with domain format validation (e.g. `example.com`), wire the "Add domain" button to append to local state, then let the existing "Save domains" button send the updated array. |
| Allowed email domains — remove | Yes | Yes — partial | **Partially implemented.** The Remove button filters the domain from local `allowedDomains` state correctly. However, the "Save domains" button is only rendered when `allowedDomains.length > 0` — so if the user removes all domains, the Save button disappears and there is no way to persist the empty list. Need to always show the Save button when the in-memory list differs from what was loaded. |
| Default chat visibility | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `default_chat_visibility`; loaded into `defaultChatVisibility` state. `PATCH /organizations/{orgId}/settings` with `{ defaultChatVisibility }` saves it. Dropdown renders `private / team / public` options. Data persists in backend. |
| Default agent visibility | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `default_persona_visibility`; loaded into `defaultPersonaVisibility` state. `PATCH /organizations/{orgId}/settings` with `{ defaultPersonaVisibility }` saves it. Dropdown renders `private / team / public` options. Data persists in backend. |

---

## Page: `/org/general`

**File:** `src/app/(app)/settings/org/general/page.tsx`  
**Component type:** Client component (`'use client'`)  
**Guard:** Layout at `src/app/(app)/settings/org/layout.tsx` redirects to `/settings` if `orgRole !== 'admin'`

### On mount — data loading

Both calls fire when `orgId` becomes available from `useOrg()`.

| # | Method | Endpoint | Function | State updated | Loading flag |
|---|--------|----------|----------|---------------|--------------|
| 1 | GET | `/organizations/{orgId}` | `getOrg(orgId)` | `workspaceName`, `slugValue`, `orgIdValue` | `identityLoading` |
| 2 | GET | `/organizations/{orgId}/settings` | `getOrgSettings(orgId)` | `aiInstructions`, `allowedDomains`, `defaultChatVisibility`, `defaultPersonaVisibility` | `settingsLoading` |

**Call 1 response shape:**
```ts
{
  id: string
  name: string
  slug: string
  description: string
  logo_url: string | null
  archived: boolean
  my_role: 'owner' | 'admin' | 'member' | null
}
```

**Call 2 response shape:**
```ts
{
  organization_id: string
  org_instructions: string | null
  allowed_email_domains: string[] | null
  default_chat_visibility: 'private' | 'team' | 'public' | null
  default_persona_visibility: 'private' | 'team' | 'public' | null
}
```

Errors are caught with `.catch(console.error)` — not surfaced to the user.

---

### User actions — saves

Each save is independent; only its own section of settings is sent.

| # | Trigger | Method | Endpoint | Function | Request body | Toast on success |
|---|---------|--------|----------|----------|--------------|-----------------|
| 3 | "Save changes" (identity section) | PATCH | `/organizations/{orgId}` | `updateOrg(orgId, params)` | `{ name, slug }` | "Workspace identity saved" |
| 4a | "Save instructions" | PATCH | `/organizations/{orgId}/settings` | `updateOrgSettings(orgId, params)` | `{ orgInstructions }` (max 3000 chars, null to clear) | "Instructions saved" |
| 4b | "Save defaults" (visibility) | PATCH | `/organizations/{orgId}/settings` | `updateOrgSettings(orgId, params)` | `{ defaultChatVisibility, defaultPersonaVisibility }` | "Workspace defaults saved" |
| 4c | "Save domains" | PATCH | `/organizations/{orgId}/settings` | `updateOrgSettings(orgId, params)` | `{ allowedEmailDomains: string[] }` (empty strings filtered) | "Allowed domains saved" |

Save buttons are disabled while `identitySaving || identityLoading` (or `settingsSaving || settingsLoading` for settings saves).
Errors from each save are caught and shown via `err.message` in a toast.

---

## Context providers wrapping `/org/general`

These run independently of the page and load data used across the settings layout.

### `OrgProvider` — `src/context/org-context.tsx`

Mounted in `src/app/(app)/settings/layout.tsx` and `src/app/(app)/layout.tsx`.

| # | Method | Endpoint | Function | Trigger | Purpose |
|---|--------|----------|----------|---------|---------|
| 5 | GET | `/organizations` | `listOrganizations()` | Once on hydration, only if `user.orgId` is absent | Fallback org discovery — picks first org from list |
| 6 | GET | `/organizations/{orgId}` | `getOrg(orgId)` | Once `orgId` resolves | Loads `orgRole` (`my_role`) for admin gating |
| 7 | GET | `/organizations/{orgId}/plan` | `getOrgPlan(orgId)` | Once `orgId` resolves | Loads plan info and `members` array |
| 8 | GET | `/organizations/{orgId}/teams` | `fetchTeams(orgId)` | Once `orgId` resolves | Loads teams list (30-second in-memory cache) |

Call 5 only fires when the Auth0 profile doesn't embed `org_id` — uncommon in normal sessions.
Calls 6–8 always fire once per session when the OrgProvider mounts.

**Note:** `OrgProvider` is instantiated in **two** layout files — `(app)/layout.tsx` and `(app)/settings/layout.tsx`. Within the settings section both instances exist in the tree simultaneously, which means calls 5–8 may fire twice unless React context de-duplication prevents the inner instance from re-fetching.

---

## API client — how tokens are handled

All calls go through `apiFetch` / `apiFetchJson` in `src/lib/api/client.ts`:

1. Reads the in-memory access token via `getInMemoryAccessToken()`
2. If the token is expiring within 60 s, calls `POST /auth/access-token` first to refresh
3. Injects `Authorization: Bearer <token>`, `X-User-Timezone`, `X-User-Locale` headers
4. On 401: refreshes token once and retries the original request
5. On second 401: dispatches `auth:session-expired` DOM event (shows session-expired toast)

Token refresh (`POST /auth/access-token`) is handled server-side by the Auth0 SDK and is transparent to the page components.

---

Endpoint constants are defined in `src/lib/config.ts`:
- `ORG_ENDPOINT(id)` → `/api/backend/organizations/{id}`
- `ORG_SETTINGS_ENDPOINT(id)` → `/api/backend/organizations/{id}/settings`
- `ORG_PLAN_ENDPOINT(id)` → `/api/backend/organizations/{id}/plan`
- `ORG_TEAMS_ENDPOINT(id)` → `/api/backend/organizations/{id}/teams`

---

## Feature integration status — `/org/members`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Total members count | Yes | Yes | **Done.** `members.length` derived from `getOrgPlan()` response. However count inflates after a local invite is added (invite is never sent to backend, so the number is wrong on next reload). |
| Admins count | Yes | Yes — with bug | **Partially correct.** `members.filter(m => m.role === 'admin').length`. `normalizeMember` maps both `owner` and `admin` API roles to the `admin` WorkspaceRole, so the count includes the owner — which is visually acceptable. But the label says "Admins", not "Admins + Owner". |
| Pending invites count | Yes | Yes — with bug | **Broken after invite modal use.** Count comes from `members.filter(m => m.inviteStatus === 'invite_sent').length`. Backend sets `invite_status: 'pending'` for real pending invites and this is mapped correctly by `normalizeMember`. But because `handleInvite` only pushes a fake member into local state (never calls the backend), any invite sent through the modal inflates this count locally and disappears on page reload. |
| Members list | Yes (bundled in plan) | Yes | **Done.** Members come from `GET /organizations/{orgId}/plan` via `OrgProvider`. The response's `members` array is normalized and stored in context. The page reads `members` from `useOrg()`. |
| Member role display | Yes — partial | Yes — with bug | **Mismatch: `owner` not shown as owner.** `normalizeMember` collapses `owner` and `admin` both into the `admin` WorkspaceRole. So the workspace owner is visually indistinguishable from regular admins. The `editor` WorkspaceRole exists in the UI type but has no backend equivalent — the backend's `OrganizationRole` enum is `owner \| admin \| member` only. |
| Assigned team | No (not in plan response) | No | **Not implemented.** `normalizeMember` always sets `teamMemberships: []`. The plan response does not include team membership data per member. There is no separate endpoint that joins members with their teams. The "Teams" column in the table always renders empty. Backend would need to include team data in the plan response or provide a separate members+teams endpoint. |
| Change member role | Yes | Yes — partial | **Wired but role set is wrong.** `PATCH /organizations/{orgId}/members/{memberId}/role` is called via `setMemberRole()`. The role dropdown only offers `['editor', 'member']` — `admin` is missing. When `editor` is selected, `handleChangeRole` sends `role: 'member'` to the API (maps `editor → member`) so the backend actually receives `member` even when the user picks `editor`. `admin` cannot be granted through the UI at all. |
| Remove member | Yes | Yes | **Done.** `DELETE /organizations/{orgId}/members/{memberId}` called via `removeMember()`. Optimistic removal with rollback on error. Owner is protected (`isOwner` check suppresses the Remove button) — but `ownerMemberId` is identified by finding the first member with `role === 'admin'` in the normalized list, which is incorrect if the owner is not first or if the owner is listed after another admin. |
| Invite members (modal + role + email) | Yes | No | **Backend endpoint exists but is never called.** `POST /organizations/{orgId}/teams/{teamId}/invites` is in the OpenAPI spec. The `AppInviteModal` component is rendered. `handleInvite` has a `// TODO: call API` comment and only pushes a fake `OrgMember` into local state. The invite is never sent to the backend. The newly added member disappears on reload. Note: the backend invite endpoint also requires a `teamId`, which adds complexity for a general org-level invite. |
| Search | No | No | **Not implemented.** The search `IconButton` in `MembersTable` has no `onClick` handler and no associated input. Purely decorative. No filtering logic exists anywhere in the component. |
| Filter | No | No | **Not implemented.** The filter `IconButton` has no `onClick` handler. Purely decorative. |
| Pagination | No | No | **Not implemented.** The footer shows "Showing 1–N of N members" and renders Prev/Next buttons and a page-1 pill, but none of the buttons have `onClick` handlers. All members are always shown at once. Hardcoded page 1. |
| Roles & Permissions list | Partial | Yes — missing owner | **Missing `owner` role.** The `ROLES_INFO` constant defines entries for `admin`, `editor`, and `member`. There is no `owner` entry. The owner role exists in the backend (`OrganizationRole: owner`), is acknowledged elsewhere in the codebase, but is absent from this section. Users cannot understand what the owner role means or how it differs from admin. |
| Admin gate (edit permissions) | Yes | Yes — with bug | **Owner cannot edit.** `isAdmin = currentUserRole === 'admin'`. Because `currentUserRole` comes from `useOrg()` which returns `my_role` from `GET /organizations/{orgId}`, an owner gets `currentUserRole === 'owner'`. The `isAdmin` flag is `false` for owners, so owners cannot see the "Invite members" button and cannot change or remove any member's role. The role dropdown also hides for the owner. |

---

## Page: `/org/members`

**File:** `src/app/(app)/settings/org/members/page.tsx`  
**Component type:** Client component (`'use client'`)  
**Guard:** Same org-settings layout as `/org/general` — redirects to `/settings` if not admin (but see bug above: owners bypass guard correctly since the layout check may be separate from the in-page `isAdmin` flag).

### On mount — data loading

All member data is loaded by `OrgProvider` before the page mounts. The page itself makes no direct API calls on mount.

| # | Method | Endpoint | Function | Called by | Purpose |
|---|--------|----------|----------|-----------|---------|
| 1 | GET | `/organizations/{orgId}/plan` | `getOrgPlan(orgId)` | `OrgProvider` | Returns `members` array bundled with plan data. This is the sole data source for the members page. |

The page reads data from context:
```ts
const { orgId, org, members: orgMembers, currentUserRole } = useOrg()
```

There is **no** `GET /organizations/{orgId}/members` standalone endpoint — members are always fetched as part of the plan response.

**Plan response `members` array shape (per member):**
```ts
{
  user_id:       string
  name:          string | null
  email:         string | null
  role:          'owner' | 'admin' | 'member'
  invite_status: 'active' | 'pending'
  credit_used:   number
  credit_cap:    number | null
}
```

`normalizeMember()` transforms this into `OrgMember`:
- `owner` and `admin` → both become `'admin'` WorkspaceRole (owner is lost)
- `invite_status: 'pending'` → `inviteStatus: 'invite_sent'`
- `teamMemberships` → always set to `[]` (not in API response)

---

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|--------------|-------|
| 2 | Role dropdown selection | PATCH | `/organizations/{orgId}/members/{memberId}/role` | `setMemberRole(orgId, id, apiRole)` | `{ role: 'admin' \| 'member' }` | `editor` selection sends `'member'` to backend. Optimistic update with rollback. |
| 3 | Remove button confirm | DELETE | `/organizations/{orgId}/members/{memberId}` | `removeMember(orgId, id)` | — (no body) | Optimistic removal with rollback. Owner protected by `ownerMemberId` check. |
| 4 | Invite modal submit | **(none)** | — | `handleInvite()` only adds local state | — | `// TODO: call API`. Backend endpoint `POST /organizations/{orgId}/teams/{teamId}/invites` exists but is unimplemented. |

---

## Endpoint → source file map (updated)

| Endpoint | Source file |
|----------|------------|
| `GET /organizations` | `src/lib/api/organization.ts` → `listOrganizations()` |
| `GET /organizations/{orgId}` | `src/lib/api/organization.ts` → `getOrg(orgId)` |
| `GET /organizations/{orgId}/settings` | `src/lib/api/organization.ts` → `getOrgSettings(orgId)` |
| `PATCH /organizations/{orgId}` | `src/lib/api/organization.ts` → `updateOrg(orgId, params)` |
| `PATCH /organizations/{orgId}/settings` | `src/lib/api/organization.ts` → `updateOrgSettings(orgId, params)` |
| `GET /organizations/{orgId}/plan` | `src/lib/api/organization.ts` → `getOrgPlan(orgId)` |
| `GET /organizations/{orgId}/teams` | `src/lib/api/teams.ts` → `fetchTeams(orgId)` |
| `PATCH /organizations/{orgId}/members/{memberId}/role` | `src/lib/api/organization.ts` → `setMemberRole(orgId, memberId, role)` |
| `DELETE /organizations/{orgId}/members/{memberId}` | `src/lib/api/organization.ts` → `removeMember(orgId, memberId)` |
| `POST /organizations/{orgId}/teams/{teamId}/invites` | **Not implemented in frontend** — exists in OpenAPI spec |
| `GET /organizations/{orgId}/teams/{teamId}` | `src/lib/api/teams.ts` → `getTeam(orgId, teamId)` |
| `PATCH /organizations/{orgId}/teams/{teamId}` | `src/lib/api/teams.ts` → `updateTeam(orgId, teamId, params)` |
| `DELETE /organizations/{orgId}/teams/{teamId}` | `src/lib/api/teams.ts` → `deleteTeam(orgId, teamId)` |
| `GET /organizations/{orgId}/teams/{teamId}/editors` | `src/lib/api/teams.ts` → `listTeamEditors(orgId, teamId)` |
| `DELETE /organizations/{orgId}/teams/{teamId}/editors/{memberId}` | `src/lib/api/teams.ts` → `removeTeamEditor(orgId, teamId, memberId)` |
| `POST /organizations/{orgId}/teams/{teamId}/invites` | `src/lib/api/teams.ts` → `inviteTeamMembers(orgId, teamId, emails)` |
| `GET /stripe/billing` | `src/lib/api/stripe.ts` → `fetchBilling()` |
| `POST /stripe/portal` | `src/lib/api/stripe.ts` → `openBillingPortal()` |
| `POST /stripe/topup/charge` | `src/lib/api/stripe.ts` → `chargeTopUp({ amount_usd })` |
| `GET /organizations/{orgId}/plan/usage` | `src/lib/api/organization.ts` → `getOrgPlanUsage(orgId)` |

---

## Feature integration status — `/settings/org/plans`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Credits remaining / used / total | Yes | Yes | **Done.** `plan.totalCredits`, `plan.used`, `plan.remaining` come from `GET /organizations/{orgId}/plan` via `OrgProvider`. Displayed live in the stat tiles. |
| Seats used (member count) | Yes (bundled in plan) | Yes | **Done.** `orgMembers.length` from the plan response member array. Shows in stat tiles as "Seats used". |
| Next billing date | Yes | Yes — partial | **Done but fallback to computed date.** `billing?.current_period_end` from `GET /stripe/billing`. If billing hasn't loaded or is null, falls back to last day of current calendar month (computed client-side). |
| Plan type (Teams vs Enterprise) | No | No — hardcoded | **Broken — always shows Teams hero.** `isEnterprise = org.plan === 'enterprise'`. `org` is built in `OrgProvider` from `DEFAULT_ORG` which hardcodes `plan: 'teams'`. The `getOrg()` call only returns `id / name / slug / description / logo_url / my_role` — plan type is not in the response. `org.plan` is never updated from any API call. The enterprise billing hero (usage-based, spend cap, auto-recharge) is unreachable in the UI. |
| Current tier matching (slider position) | Partial | Partial | **Works if backend credits match a hardcoded tier.** `currentTierIdx = TIERS.findIndex(t => t.credits === totalCredits)`. `TIERS` has 6 hardcoded tiers (60k, 125k, 250k, 500k, 750k, 1M credits). If the backend's `total_credits` matches one of these, the slider initialises on the right tier. If it doesn't match (e.g. a custom plan), slider defaults to index 0. |
| Billing cycle (annual / monthly) | No read endpoint | No | **Never read from backend.** `annual` state initialised from `org.billingCycle === 'annual'`. `org.billingCycle` is always `'monthly'` (hardcoded `DEFAULT_ORG`). The cycle toggle only updates local state, never calls any API. Selecting "Yearly" changes the displayed price locally but does nothing to the subscription. |
| Tier slider (upgrade plan) | Yes (Stripe portal) | Partial | **Slider is local UI only; upgrade routes through Stripe portal.** Moving the slider updates `tierIdx` in local state and updates the displayed price. Clicking "Upgrade plan" calls `POST /stripe/portal` and opens the Stripe-hosted portal — the selected tier is NOT passed to the portal. User must re-select the desired plan inside Stripe. No direct checkout for a specific tier is wired. |
| "Upgrade plan" button | Yes (via Stripe portal) | Yes | **Done — opens Stripe portal.** `POST /stripe/portal` → redirects to Stripe billing portal in a new tab. Works for both "Upgrade plan" and "Contact Sales Team" buttons (same handler). |
| "Request plan change" button (admin) | Yes (via Stripe portal) | Yes | **Done.** Same `handleStripePortal()` call. Shown to non-owner admins instead of the tier slider. |
| Payment method display | Yes | Yes | **Done.** `billing.payment_method` from `GET /stripe/billing`. Renders `CardBrandLogo`, last 4 digits, expiry. Shows "Loading…" while fetching, "No payment method on file" if null. |
| "Manage on Stripe" button | Yes | Yes | **Done.** `POST /stripe/portal` → opens Stripe portal where user can update card. |
| Invoice history list | Yes | Yes | **Done.** `billing.invoices` from `GET /stripe/billing`. Renders date, amount (in dollars via `amount_paid / 100`), status badge (Paid / red), and a "View" link to `invoice_pdf ?? invoice_url`. Shows "Loading invoices…" during fetch, "No invoices yet." if empty. |
| "Export all" invoices button | No | No | **Not implemented.** Button shows toast `'Exporting all invoices…'` only — no API call, no file download. |
| Buy more credits modal | Yes | Yes | **Done.** Preset TOP_UPS packs (hardcoded: 1k/$2, 5k/$10, 15k/$30, 50k/$100) or a custom dollar amount. "Pay now" calls `POST /stripe/topup/charge` with `{ amount_usd }`. Requires a payment method on file — button disabled when `!pm`. Shows paying state. |
| Buy credits — "Recharge when balance falls below" input | No | No | **Not implemented.** Input field in the modal collects a dollar threshold but its value is never sent to any API. Auto-recharge threshold is local UI state only — it's lost when the modal closes. |
| Admin permissions (toggles) | No | No | **All hardcoded local state.** "Add credits / top up" (on), "Manage payment method" (off), "View invoices" (on) toggles are initialised with hardcoded defaults and never read from or saved to any backend endpoint. Changes survive only for the current session. Shown to owner only. |
| Enterprise: Monthly spend cap | No | No | **Fake save.** `MonthlySpendCapModal.handleSave` calls `await new Promise(r => setTimeout(r, 400))` — a 400ms fake delay — then updates local state. No API call is made. Spend cap value is lost on page refresh. |
| Enterprise: Auto-recharge toggle + threshold | No | No | **Local state only.** `autoRechargeOn`, `autoRechargeAmt`, `autoRechargeBelow` are all hardcoded `useState` values. Toggling or editing never hits the backend. |
| Enterprise: "Add credits" button | Yes (via top-up modal) | Yes | **Opens the buy credits modal.** Same `BuyMoreCreditsModal` as Teams path — calls `POST /stripe/topup/charge`. |
| Enterprise: Current charges / spend cap progress bar | No | Partial | **Charges computed client-side.** `currentCharges = (usedCredits / 1000) * BLENDED_RATE_PER_1K`. `BLENDED_RATE_PER_1K` is hardcoded `2`. Spend cap is hardcoded local state. Progress bar is derived entirely from local values. |

---

## Page: `/settings/org/plans`

**File:** `src/app/(app)/settings/org/plans/page.tsx`  
**Component type:** Client component (`'use client'`)  
**Title shown:** "Billing"

### Role gates

```ts
const isOwner    = orgRole === 'owner'             // exact owner check (correct)
const isAdminish = orgRole === 'owner' || orgRole === 'admin'
```

- **`isOwner` only**: Payment section, Admin permissions section, tier slider, billing cycle toggle.
- **`isAdminish`**: Invoice history, billing data load, "Request plan change" button.

Unlike the members and teams pages, the billing page reads `orgRole` directly (not the `currentUserRole` alias), so the owner gate works correctly here — owners see tier controls; admins do not.

### On mount — data loading

| # | Method | Endpoint | Function | Guard | State updated |
|---|--------|----------|----------|-------|---------------|
| 1 | GET | `/organizations/{orgId}/plan` | `getOrgPlan(orgId)` | none (OrgProvider) | `plan` → `totalCredits`, `used`, `remaining` |
| 2 | GET | `/organizations/{orgId}` | `getOrg(orgId)` | none (OrgProvider) | `orgRole` (owner/admin/member) |
| 3 | GET | `/stripe/billing` | `fetchBilling()` | `isAdminish` | `billing` → payment method, invoices, `current_period_end` |

Call 3 response shape:
```ts
{
  plan_type:            string | null        // e.g. "teams" — NOT used to set org.plan
  subscription_status:  string | null
  current_period_end:   string | null        // ISO timestamp → nextBilling
  cancel_at_period_end: boolean
  payment_method: {
    brand:     string | null                 // e.g. "visa"
    last4:     string | null
    exp_month: number | null
    exp_year:  number | null
    funding:   string | null
  } | null
  invoices: Array<{
    amount_paid: number                      // in cents
    currency:    string
    status:      string | null               // "paid" / "open" / etc.
    created:     string | null               // ISO timestamp
    invoice_url: string | null
    invoice_pdf: string | null
  }>
}
```

Note: `billing.plan_type` contains the real plan type from Stripe (e.g. `"teams"`) but it is **never read** to set `org.plan`. The enterprise/teams branch is decided by `org.plan` which is always `'teams'` from the hardcoded `DEFAULT_ORG`.

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|--------------|-------|
| 4 | "Upgrade plan" / "Contact Sales" / "Manage on Stripe" / "Request plan change" | POST | `/stripe/portal` | `openBillingPortal()` | — (no body) | Returns `{ portal_url }`. Opens in new tab. All four buttons share this handler. |
| 5 | "Pay now" in Buy More Credits modal | POST | `/stripe/topup/charge` | `chargeTopUp({ amount_usd })` | `{ amount_usd: number }` | Direct charge on saved card. Requires `billing.payment_method` to be non-null. |
| — | "Save spend cap" (Enterprise) | **(none)** | — | `setTimeout(400ms)` fake | — | No backend call. Updates `spendCap` local state only. |
| — | Admin permission toggles | **(none)** | — | `setPermXxx(v => !v)` | — | No backend call. Lost on refresh. |
| — | Billing cycle toggle (Annual/Monthly) | **(none)** | — | `setAnnual(v)` | — | Adjusts displayed price by ×0.75 for annual. Not saved. |
| — | "Export all" invoices | **(none)** | — | `toast.success(...)` only | — | No download, no API call. |

---

## Feature integration status — `/settings/org/teams`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Teams list (name + description + created date) | Yes | Yes | **Done.** Teams come from `OrgProvider` via `GET /organizations/{orgId}/teams` (30s in-memory cache). Page reads `teams` from `useOrg()`. Archived teams filtered out (`!t.archived`). Name, optional description, and created date displayed. |
| Team settings button | Yes | Yes — with navigation bug | **Partially broken.** Button exists and navigates on click. But the list page does `router.push(`/org/teams/${team.id}`)` instead of `/settings/org/teams/${team.id}`. The team settings page lives at `src/app/(app)/settings/org/teams/[teamId]/page.tsx` (route: `/settings/org/teams/{teamId}`). The button pushes to `/org/teams/{id}` which is a different page (`src/app/(app)/org/teams/[teamId]/page.tsx`). Needs to match the correct route prefix. |
| Create new team button visibility | Yes | Yes — with bug | **Owner excluded.** `isAdmin = currentUserRole === 'admin'` — same bug as members page. Owners get `currentUserRole === 'owner'` from `useOrg()` and the button is hidden for them. |
| Create new team — inline form | Yes | Yes | **Done.** `CreateTeamForm` slides in below the table. Name field (required) + Description field (optional). Cancel hides the form; Create team calls `createTeam(orgId, name, desc)` → `POST /organizations/{orgId}/teams` with `{ name, description }`. On success: `refreshTeams()`, form collapses. Errors shown via toast. |
| Create team — name validation | Yes (required) | Yes — basic only | **Only empty-string guard.** Create button is disabled when `!name.trim()`. No max-length check, no duplicate-name validation (that would surface as a backend error). |
| Create team — saving state | Yes | Yes | **Done.** `saving` flag disables the Create button and prevents double-submit while the API call is in flight. |

---

## Page: `/settings/org/teams`

**File:** `src/app/(app)/settings/org/teams/page.tsx`  
**Component type:** Client component (`'use client'`)

### On mount — data loading

No direct API calls on mount. All team data is pre-loaded by `OrgProvider`.

| # | Method | Endpoint | Function | Called by | Purpose |
|---|--------|----------|----------|-----------|---------|
| 1 | GET | `/organizations/{orgId}/teams` | `fetchTeams(orgId)` | `OrgProvider` | Returns full teams array (30s cache). Page reads `teams` + `teamsLoading` from `useOrg()`. |

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|--------------|-------|
| 2 | "Create team" button submit | POST | `/organizations/{orgId}/teams` | `createTeam(orgId, name, desc)` | `{ name, description }` | Busts 30s teams cache on success. Then calls `refreshTeams()` to reload from context. |

---

## Feature integration status — `/settings/org/teams/[teamId]`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Team identity — load name + description | Yes | Yes | **Done.** `GET /organizations/{orgId}/teams/{teamId}` via `getTeam()` on mount. Name and description loaded into controlled inputs. Loading state shown. 404 shows "Team not found." message. |
| Team identity — save name + description | Yes | Yes | **Done.** `PATCH /organizations/{orgId}/teams/{teamId}` via `updateTeam()`. Sends `{ name, description }`. Response written back to state. Calls `refreshTeams()` to update the org context. Toast on success/error. Save button shows "Saving…" during flight. |
| Team members — list | Yes | Yes — partial | **Done but missing avatar.** `GET /organizations/{orgId}/teams/{teamId}/editors` via `listTeamEditors()` on mount. Returns `{userId, name, email}`. Name falls back to `userId` if null. Email shown on second line. Avatar is a hardcoded blue circle with a generic user icon — not using real user avatars or initials. |
| Team members — member name display | Yes | Yes — partial | **Falls back to userId.** `editor.name ?? editor.userId` — if the backend returns `name: null` the userId string (a UUID) is shown as the member name. |
| Team members — invite | Yes | Yes | **Done.** Inline `InvitePanel` expands below the member list. Accepts comma/space/semicolon-separated email addresses. Calls `inviteTeamMembers(orgId, teamId, emails)` → `POST /organizations/{orgId}/teams/{teamId}/invites` with `{ emails: string[] }`. Success shows toast with count. Error shown via toast. Panel collapses on success. |
| Team members — remove | Yes | Yes — no confirm | **Wired but no confirmation step.** `DELETE /organizations/{orgId}/teams/{teamId}/editors/{memberId}` via `removeTeamEditor()`. Optimistic: editor removed from local state immediately. On error: state not rolled back (missing rollback — `setEditors(prev => prev.filter(...))` has no catch-revert). No confirmation dialog before removal. |
| Team members — search | No | No | **Not implemented.** Search `IconButton` in the toolbar has no `onClick` and no associated input. Purely decorative. |
| Team members — filter | No | No | **Not implemented.** Filter `IconButton` has no `onClick`. Purely decorative. |
| Connector access section | N/A | Yes — static | **Intentionally static.** Card displays text explaining connectors are managed org-wide. A link button navigates to `/settings/org/connectors`. No API call — correct behaviour by design. |
| Archive team | Yes | Yes — no confirm | **Wired but no confirmation dialog.** Calls `archiveTeam(orgId, teamId)` → `PATCH /organizations/{orgId}/teams/{teamId}` with `{ archived: true }`. On success: `refreshTeams()` + `router.push('/settings/org/teams')`. No "are you sure?" confirmation before archiving. |
| Delete team — name confirmation input | Yes | Yes | **Done.** Input field pre-validates: delete button disabled until `deleteInput === team.name`. Prevents accidental deletion. |
| Delete team — API call | Yes | Yes | **Done.** `DELETE /organizations/{orgId}/teams/{teamId}` via `deleteTeam()`. Busts teams cache. On success: `refreshTeams()` + `router.push('/settings/org/teams')`. |
| Remove-editor error rollback | Yes | No | **Missing rollback on remove.** `handleRemoveEditor` filters the editor from state optimistically but has no `.catch()` to restore state on API failure. If `removeTeamEditor()` throws, the member disappears from the UI but is still on the team in the backend. |

---

## Page: `/settings/org/teams/[teamId]`

**File:** `src/app/(app)/settings/org/teams/[teamId]/page.tsx`  
**Component type:** Client component (`'use client'`)  
**Route param:** `params.teamId` read via `useParams<{ teamId: string }>()`

### On mount — data loading

Two independent calls fire once `orgId` and `params.teamId` are available.

| # | Method | Endpoint | Function | State updated | Loading flag |
|---|--------|----------|----------|---------------|--------------|
| 1 | GET | `/organizations/{orgId}/teams/{teamId}` | `getTeam(orgId, teamId)` | `team`, `teamName`, `teamDesc` | `loading` |
| 2 | GET | `/organizations/{orgId}/teams/{teamId}/editors` | `listTeamEditors(orgId, teamId)` | `editors` | `editorsLoading` |

Call 1 response shape (from `TeamResponse`):
```ts
{
  id: string
  organization_id: string
  name: string
  description: string
  tags: string[]
  archived: boolean
  created_at: string
  updated_at: string
}
```

Call 2 response shape — array of `PersonResponse`:
```ts
{
  user_id: string
  name?: string | null
  email?: string | null
}
```

Note: the member list endpoint is called **`/editors`** (not `/members`). This is the backend's terminology for team members who have write/edit access to the team. There is also a `POST /editors` endpoint to add an existing workspace member directly, but the frontend uses the **invites flow** instead (`POST /invites` with emails), which sends an email invitation.

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|--------------|-------|
| 3 | "Save changes" (team identity) | PATCH | `/organizations/{orgId}/teams/{teamId}` | `updateTeam(orgId, teamId, params)` | `{ name, description }` | Busts cache, calls `refreshTeams()`. |
| 4 | "Send invites" (invite panel) | POST | `/organizations/{orgId}/teams/{teamId}/invites` | `inviteTeamMembers(orgId, teamId, emails)` | `{ emails: string[] }` | Emails parsed from textarea (split on space/comma/semicolon). Returns `{ id, team_id, recipient_emails, expires_at, invite_url }`. |
| 5 | "Remove" button (member row) | DELETE | `/organizations/{orgId}/teams/{teamId}/editors/{memberId}` | `removeTeamEditor(orgId, teamId, memberId)` | — (no body) | No confirmation. Optimistic removal without rollback on failure. |
| 6 | "Archive" button | PATCH | `/organizations/{orgId}/teams/{teamId}` | `archiveTeam(orgId, teamId)` | `{ archived: true }` | Uses same `updateTeam()` function. No confirmation dialog. |
| 7 | "Delete team" button (after name typed) | DELETE | `/organizations/{orgId}/teams/{teamId}` | `deleteTeam(orgId, teamId)` | — (no body) | Guarded by name-match confirmation input. |

---

## Feature integration status — `/settings/org/analytics`

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Credit pool total / used / remaining (stat tiles) | Yes | Yes | **Done.** `plan.totalCredits`, `plan.used`, `plan.remaining` from `GET /organizations/{orgId}/plan` via `OrgProvider`. Progress bar fill derived from `used / totalCredits`. All three tiles update in real time. |
| Member count (stat tile) | Yes (bundled in plan) | Yes | **Done.** `members.length` from plan response. Shows "loading…" sub-label while `membersLoading`. |
| Date range selector (7d / 30d / MTD / QTD) | No | No | **Not implemented end-to-end.** The tab switcher updates local `dateRange` state and re-runs `buildFeatureSeries()` client-side. No API call is triggered on range change. The backend has no date-range parameter on any analytics endpoint called by this page. All four tabs show the same underlying data (the full-cycle `plan.used` total), just re-bucketed differently across the chart X-axis. |
| Credit usage by feature chart (Chat / AI Assistants / Brain) | No | No — synthetic | **Chart is mathematically derived, not from backend data.** The backend provides a single `used` credit total — no per-feature breakdown exists in the API. `buildFeatureSeries()` takes `totalUsed` and applies hardcoded `FEATURE_SPLIT = { chat: 0.68, assistants: 0.20, brain: 0.12 }` ratios, then distributes across buckets using deterministic `Math.sin`/`Math.cos` wave functions. The resulting curves change per org (based on real total credits used) but the Chat/AI Assistants/Brain split is always 68%/20%/12% of that total — not real per-feature data. Hover tooltips show these synthetic values as if they were actual. |
| Per-member credit usage table (name, email, credits used, cap, usage %) | Yes | Yes | **Done.** `members` array from `GET /organizations/{orgId}/plan` via `OrgProvider`. `creditUsed` and `creditCap` are real API fields. Progress bar shows `creditUsed / creditCap * 100`. Renders "No cap" when `creditCap` is null. Avatar is a hardcoded blue circle (not real avatar). |
| Per-member search | No | No | **Not implemented.** Search `IconButton` has no `onClick` and no associated input. Purely decorative. |
| Per-member filter | No | No | **Not implemented.** Filter `IconButton` has no `onClick`. Purely decorative. |
| Top users by credit usage (ranked list) | Yes | Yes | **Done.** Derived from `members` array (same plan response). Sorted descending by `creditUsed`. Share % calculated as `creditUsed / totalUsed * 100`. No separate API call. |
| Usage by team (ranked list) | Yes | Yes | **Done.** `teamUsage` from `GET /organizations/{orgId}/plan/usage` via `getOrgPlanUsage()`. Returns `{ by_team: [{ team_id, team_name, credits_used }] }`. Sorted descending by `creditsUsed`. Share % calculated as `creditsUsed / totalUsed * 100`. Fetched once on mount; no refetch on date range change. |

---

## Page: `/settings/org/analytics`

**File:** `src/app/(app)/settings/org/analytics/page.tsx`  
**Component type:** Client component (`'use client'`)

### On mount — data loading

| # | Method | Endpoint | Function | Called by | State updated |
|---|--------|----------|----------|-----------|---------------|
| 1 | GET | `/organizations/{orgId}/plan` | `getOrgPlan(orgId)` | `OrgProvider` | `plan` → `totalCredits`, `used`, `remaining`; `members` → per-member `creditUsed`, `creditCap` |
| 2 | GET | `/organizations/{orgId}/plan/usage` | `getOrgPlanUsage(orgId)` | Page `useEffect` on mount | `teamUsage` → `byTeam[{ teamId, teamName, creditsUsed }]` |

Call 2 response shape:
```ts
{
  organization_id: string
  by_team: Array<{
    team_id:      string
    team_name:    string
    credits_used: number
  }>
}
```

Call 2 fires once on mount when `orgId` resolves. Errors are swallowed silently via `.catch(console.error)` — if the call fails, `teamUsage` stays `[]` and "Usage by team" shows "No data available".

Neither call accepts a date range parameter. The `dateRange` state (7d/30d/MTD/QTD) is **purely client-side** — it only changes how `buildFeatureSeries()` re-slices the single `plan.used` total across chart buckets. No re-fetch occurs on range change.

### User actions — API calls

**None.** This page is read-only — no user action triggers an API call. The date range tabs, search/filter icons, and hover tooltips are all purely local interactions.

### How the feature chart works

```
totalUsed (real, from plan API)
  × FEATURE_SPLIT[metric]            // hardcoded: chat=0.68, assistants=0.20, brain=0.12
  × windowUsed/totalUsed adjustment  // scales down to selected date window
  × weights[metric][bucketIndex]     // deterministic sin/cos wave — varies per bucket
  = displayed value for that metric/bucket
```

The chart gives a **plausible-looking** per-feature breakdown but the split ratios are fixed constants. Two orgs with identical `totalUsed` will show identical feature split percentages. The wave shape is the same formula for every org — only the Y-axis scale changes.

---

## Feature integration status — `/settings/org/connectors`

This page has two distinct view modes driven by `isAdminView = currentUserRole === 'admin'`:
- **Admin view** — 5 tabs: Manage connectors | Approval request | Permissions | My connectors | Catalog
- **Member view** — 2 tabs: My Connectors | Browse & request

**Shared bug**: `currentUserRole === 'admin'` excludes owners — owners see the member tab set.

### Global: Connector catalog load

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Load connector catalog on mount | Yes | Yes | **Done.** `GET /connectors` fires in a `useEffect` triggered by `refreshToken` state (incremented after any connect/disconnect). Returns `ConnectorCatalogEntry[]` with `slug`, `display_name`, `auth_mode`, `description`, `tools`, `linked`, `icon_url`. All tabs consume this shared list. Errors shown via `toast.error`. |

---

### Tab 1 — Manage Connectors (admin only)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Surface connector suggestions in chat (toggle) | No | No | **Not implemented — no endpoint.** The toggle renders as a hardcoded always-off button (`backgroundColor: 'var(--neutral-200)'`) with no state variable and no `onClick`. Cannot be toggled. No backend setting exists for this. |
| Category tab filtering | N/A | Yes | **Done — client-side only.** Six tabs: All / Productivity / Communication / Design / Interactive / Data. Filters the in-memory `connectors` array via `CONNECTOR_CATEGORY_MAP` lookup. No API call. |
| Search | N/A | Yes | **Done — client-side only.** Inline expandable search bar filters by `display_name` and `slug` on the already-loaded list. No API call. |
| Connected connector tiles ("Manage" button) | Yes | Yes — partial | **Tile displays correctly; drill-down is stub.** Connected tiles show `display_name`, `description`, and `ScopeBadge` components. "Manage" button opens `ConnectorDetailView` (full-page drill-down). However the drill-down's accounts list and "used-by" list are both hardcoded empty (`const accounts: ConnectorAccount[] = []`, `const usedByItems = []`) — there is no endpoint to load per-connector accounts or which personas/Brain automations use them. |
| Scope badges on connected tiles | No | Partial — hardcoded empty | **Not implemented — no data.** `ConnectorCatalogTile` renders `ScopeBadge` components for team/personal/account-count scope. In the Manage tab, scope is passed as `undefined` (no scope prop is provided to `onManage` tiles), so no badges appear. No backend endpoint returns this scope metadata. |
| More options vertical menu on tile | No | No | **Decorative.** The `MoreVerticalIcon` `IconButton` renders on every tile but has no `onClick` — clicking it does nothing. No dropdown/popover appears. |
| Unlinked tiles — "Add account" / connect flow | Yes | Yes | **Done.** "Add account" → `handleConnect(slug)` → `initiateLink(slug)` → `POST /connectors/{slug}/link` → opens OAuth popup at `redirect_url`. Then `pollConnectorUntilActive(slug)` polls `GET /connectors/{slug}` (exponential backoff 2s→30s cap, 2-min timeout) until `linked: true`. Popup closed, `refreshToken` incremented → reload `GET /connectors`. |

---

### WorkspaceManageModal (opened from connected tile "Manage" button)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Tool permission policy per tool (dropdown) | Yes | Yes | **Done.** Dropdown maps UI labels (Always allow / Ask / Never / Allow once) to API values (allow / ask / block / allow_once). `handlePolicyChange(toolSlug, uiPolicy)` → `updateConnector(entry.slug, { permissions: [{ slug: toolSlug, policy: apiPolicy }] })` → `PATCH /connectors/{slug}`. Optimistic update (local state changes immediately) with rollback to original on error. `toast.success('Permission updated')` on success. |
| Disconnect connector (admin) | Yes | Yes | **Done.** Two-step confirmation: first click shows warning text and "Yes, disconnect" button; second click → `unlinkConnector(entry.slug)` → `DELETE /connectors/{slug}`. On success: `onUpdate({ ...entry, linked: false, tools: [] })` updates parent state, modal closes. Error shown via toast. |

---

### Tab 2 — Approval Request (admin only)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| "From your team" — pending request list | No | No | **Not implemented — no endpoint.** `PENDING_FROM_TEAM = []` is a hardcoded empty constant with a comment: "Connector requests have no backend endpoint yet." The tab always shows "No pending requests" empty state. Approval request count badge on the tab always shows 0. |
| Approve a request (connect for team) | Yes — connect only | Partial | **Approve flow wired; request source not.** `handleApprove(slug)` calls `initiateLink(slug)` → `POST /connectors/{slug}/link` → OAuth popup → `pollConnectorUntilActive` → removes from local list. The connect flow itself works. But there is no endpoint to load the request list, so in practice this handler is never triggered. |
| Decline a request | No | No | **Local only — not persisted.** `handleDecline(slug)` filters the slug from `teamRequests` local state. No API call — decline is not saved to any backend. |
| "Your accounts" — per-member pending requests | No | No | **Not implemented — no endpoint.** `PENDING_YOUR_ACCOUNTS = []` is a hardcoded empty constant. |
| Dismiss a member account request | No | No | **Local only.** `handleDismiss(slug)` filters from `accountRequests` local state. No API call. |
| "Request from Souvenir" (escalation) | No | No | **Decorative.** Opens `RequestFromSouvenirDialog` (see below). |

---

### Tab 3 — Permissions (admin only)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Editors can add team accounts (toggle) | No | No | **Not implemented — no endpoint.** `canAddAccounts` local state, defaults to `true`. `Switch` renders and toggles visually. No API call on change — setting is not persisted. Refreshing the page resets to `true`. |
| Editors can approve member requests (toggle) | No | No | **Not implemented — no endpoint.** `canApprove` local state, defaults to `true`. Same as above — toggle works visually, nothing is saved. |
| Recent editor activity list | No | No | **Not implemented — no endpoint.** `RECENT_ACTIVITY = []` is a hardcoded empty constant with comment: "No activity data yet — replace with a real fetch once an endpoint exists." Always shows "No recent activity". |

---

### Tab 4 — My Connectors (both admin and member)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Filter tabs (All / Shared by your workspace / Your accounts) | N/A | Yes | **Done — client-side only.** Filters the `connectors` array: Shared = `auth_mode !== 'oauth2' && linked`; Accounts = `auth_mode === 'oauth2'`. No API call. |
| Search | N/A | Yes | **Done — client-side only.** Filters by `display_name` and `slug`. No API call. |
| Workspace badge / member label | Partial | No | **Hardcoded.** Badge shows `"Souvenir Inc. · Member"` — the org name is hardcoded, the role label is always "Member" even for admins. Should dynamically use `org.name` and the user's actual role. |
| Shared connectors list (workspace-enabled) | Yes | Yes | **Done.** Derived from `GET /connectors` — shows entries where `auth_mode !== 'oauth2' && linked`. These show "Active" badge. Disconnect → `unlinkConnector(slug)` → `DELETE /connectors/{slug}` → reload. |
| Your accounts list (per-member OAuth connectors) | Yes | Yes | **Done.** Shows `auth_mode === 'oauth2'` entries. Status badges: connected → "Private to you" + "Connected"; not connected → "Private to you" + "Not connected". Connect → OAuth flow; Disconnect → `DELETE /connectors/{slug}` → reload. |
| "Browse & request" CTA | N/A | Yes | **Done.** Admin: `setTab('catalog')`; member: `setTab('browse')`. Client navigation only. |

---

### Tab 5 — Catalog

**Admin view** (`AdminCatalog`):

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Category tabs + search | N/A | Yes | **Done — client-side only.** Same client-side filter pattern as other tabs. |
| Connected tiles (Manage) | Yes | Yes — partial | **Same stub as Manage tab.** "Manage" → `ConnectorDetailView` drill-down with empty accounts and used-by lists. |
| Unlinked tiles (Add account) | Yes | Yes | **Done.** Same OAuth flow as Manage tab — `initiateLink` → popup → poll → reload. |
| "Request from Souvenir" CTA | No | No | **Decorative form — no submission.** Opens `RequestFromSouvenirDialog`. |

**Member view** (`CatalogCard`):

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Category tabs + search | N/A | Yes | **Done — client-side only.** |
| Request a connector | Yes — partial | Mislabeled | **Bug: "Request" triggers direct connect, not a request.** Member CatalogCard tiles show "Request" button, but `onAction` calls `handleConnect(slug)` → `initiateLink(slug)` → full OAuth connect flow. This is identical to what admins do. Members should not be able to directly link workspace connectors — there is no "notify admin of request" API call. Backend provides `POST /connectors/{slug}/link` but no "request for approval" endpoint. |
| NoticeCard (informational banner) | N/A | Yes | **Done.** Static banner: "Members don't connect workspace tools directly — request it and your admin enables it for everyone." Correctly informs members of the intended flow, but the actual button behavior contradicts it. |

---

### RequestFromSouvenirDialog (modal)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Request form (tool name, URL, description, priority) | No | No | **Decorative — no submission.** `InputField` and `textarea` elements collect values into local state (`toolName`, `url`, `details`). "Send request to Souvenir" button has no `onClick` handler. No API call — the form data is never sent anywhere. |

---

### ConnectorDetailView drill-down (Manage → connected tile)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Accounts list (Accounts tab) | No | No | **Not implemented — no endpoint.** `accounts = []` hardcoded. Empty state "No accounts connected yet" always shows. |
| Used by list (Used by tab — agents/Brain) | No | No | **Not implemented — no endpoint.** `usedByItems = []` hardcoded. Empty state always shows. |
| Add account button | Yes — partial | Partial | **Connect fires but ignores form inputs.** "Add account" opens `AddAccountModal` which collects `label` (text) and `scope` (Personal/Shared Team) in local state. "Continue with Google" calls `onConnect(connector.slug)` → `initiateLink(slug)` with no body — `label` and `scope` are silently discarded. No backend parameter for account label or scope exists on the link endpoint. |

### AccountDetailView (sub-drill-down from Accounts tab)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Tools tab — policy dropdown | No (per-account) | No | **Decorative.** Shows `connector.tools` from the catalog entry. `PolicyDropdown` renders but `onChange={() => {}}` — no API call. This is distinct from the WorkspaceManageModal which DOES save policies; this per-account view does not. |
| Access tab — Change scope | No | No | **Decorative.** Opens `ChangeScopeModal`. "Disconnect & continue" calls `onClose()` only — no API call. The impact table (showing affected agents/Brain automations) uses hardcoded sample data (`Q3 Launch`, `Weekly digest`). |
| Settings tab — Enable connection toggle | No | No | **Local only.** `Switch` with `enabled` local state. No API call. |
| Settings tab — Disconnect account | No | No | **Decorative.** Opens `DisconnectAccountModal`. "Disconnect" calls `onClose()` only — no API call. Same hardcoded impact table. |

---

## Page: `/settings/org/connectors`

**File:** `src/app/(app)/settings/org/connectors/page.tsx`  
**Component type:** Client component (`'use client'`)

### On mount — data loading

| # | Method | Endpoint | Function | Called by | State updated |
|---|--------|----------|----------|-----------|---------------|
| 1 | GET | `/connectors` | `listConnectors()` | Page `useEffect` on mount (and on `refreshToken` change) | `connectors: ConnectorCatalogEntry[]` |

`refreshToken` is a counter incremented after every connect or disconnect — it re-triggers the `useEffect` to reload the full catalog.

Response shape:
```ts
{
  connectors: Array<{
    slug:            string
    display_name:    string
    auth_mode:       'oauth2' | 'api_key'
    description:     string
    tools?:          Array<{ slug: string; policy: 'allow' | 'block' | 'ask' | 'allow_once' }>
    api_key_fields?: Array<{ name: string; label: string; help?: string; secret: boolean; required: boolean }>
    linked:          boolean
    icon_url?:       string
  }>
}
```

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|-------------|-------|
| 1 | Add account / Connect button (any tab) | POST | `/connectors/{slug}/link` | `initiateLink(slug)` | `{}` (or `{ init_data: {...} }` for per-tenant OAuth) | Returns `{ connector_slug, redirect_url }`. Opens OAuth popup at `redirect_url`. |
| 2 | OAuth polling (after connect popup) | GET | `/connectors/{slug}` | `getConnector(slug)` via `pollConnectorUntilActive(slug)` | — | Exponential backoff 2s→30s, 120s timeout. Resolves when `linked: true`. |
| 3 | Reload after connect | GET | `/connectors` | `listConnectors()` | — | Triggered by `setRefreshToken(t => t + 1)` after poll resolves. |
| 4 | Update tool permission (WorkspaceManageModal) | PATCH | `/connectors/{slug}` | `updateConnector(slug, body)` | `{ permissions: [{ slug: toolSlug, policy }] }` | Returns full updated `ConnectorCatalogEntry` with new `tools`. |
| 5 | Disconnect connector (WorkspaceManageModal or MyConnectors) | DELETE | `/connectors/{slug}` | `unlinkConnector(slug)` | — | 204 expected. Errors on non-204/non-ok status. |
| 6 | Approve approval request (RequestQueue) | POST | `/connectors/{slug}/link` | `initiateLink(slug)` (same as #1) | `{}` | Followed by same poll/reload flow. In practice never triggered (empty request list). |

### Endpoints used — summary

| Endpoint | Method | Source file | When called |
|----------|--------|-------------|-------------|
| `/connectors` | GET | `src/lib/api/connectors.ts` → `listConnectors()` | Mount + after every connect/disconnect |
| `/connectors/{slug}` | GET | `src/lib/api/connectors.ts` → `getConnector(slug)` | Polling loop after OAuth popup |
| `/connectors/{slug}/link` | POST | `src/lib/api/connectors.ts` → `initiateLink(slug)` | Connect button, approve button |
| `/connectors/{slug}` | PATCH | `src/lib/api/connectors.ts` → `updateConnector(slug, body)` | Tool permission change in WorkspaceManageModal |
| `/connectors/{slug}` | DELETE | `src/lib/api/connectors.ts` → `unlinkConnector(slug)` | Disconnect in modal or MyConnectors |

### Key bugs and gaps

1. **Owner exclusion**: `isAdminView = currentUserRole === 'admin'` — owners see the member tab set (My Connectors + Browse & request) instead of the admin set. Same root cause as members/teams pages.
2. **Connector suggestions toggle**: `SwitchRow` toggle is fully hardcoded — no state, no API, always off. No backend setting exists.
3. **Approval requests**: Both `PENDING_FROM_TEAM` and `PENDING_YOUR_ACCOUNTS` are hardcoded empty arrays. No backend endpoint for connector request workflow. Entire Approval Request tab always shows empty.
4. **Permissions tab**: Both editor permission toggles are local state only — not persisted. Recent activity list is a hardcoded empty constant. No backend endpoints for any of these.
5. **RequestFromSouvenirDialog**: "Send request to Souvenir" button has no `onClick`. The form silently discards all input.
6. **Member "Request" button calls `initiateLink`**: Members see "Request" in the catalog but the handler triggers the full OAuth connect flow — same as admins. There is no "submit a request for admin approval" endpoint.
7. **ConnectorDetailView accounts/used-by**: Both lists are hardcoded empty. No endpoints exist to list accounts connected to a specific connector or which agents/Brain automations use it.
8. **AddAccountModal discards label and scope**: Collects label text and Personal/Shared Team scope in local state; "Continue" calls `initiateLink(slug)` with no body — both values are silently ignored.
9. **AccountDetailView completely decorative**: Tools policy dropdowns use `onChange={() => {}}`. Change scope, enable toggle, and disconnect all close modals without making any API calls. Hardcoded impact table rows (`Q3 Launch`, `Weekly digest`) in ChangeScopeModal and DisconnectAccountModal.
10. **MoreVerticalIcon menu on tiles**: No `onClick` handler — clicking the icon does nothing.

---

## Feature integration status — `/settings/org/security`

This page has three sections: **Workspace defaults**, **Authentication**, and **Approval Threshold (HITL)**.

Only two fields are loaded from or saved to the backend. Everything else is purely local state.

### Section 1 — Workspace Defaults

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Workspace instructions — display | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `org_instructions`. Loaded into `instructions` state on mount. Textarea disabled for non-admins and while loading. |
| Workspace instructions — save | Yes | Yes | **Done.** "Save changes" → `updateOrgSettings(orgId, { orgInstructions: instructions \|\| null, allowedEmailDomains: [...] })` → `PATCH /organizations/{orgId}/settings`. `null` sent when field is empty (clears value). `toast.success('Settings saved')` on success. |
| Allowed email domains — display | Yes | Yes | **Done.** `GET /organizations/{orgId}/settings` returns `allowed_email_domains` (string array). Joined with `', '` into a single comma-separated string for the text input. |
| Allowed email domains — save | Yes | Yes | **Done.** On "Save changes", `emailDomains.split(',').map(d => d.trim()).filter(Boolean)` converts the comma string back to an array and sends it in the same `PATCH /organizations/{orgId}/settings` call as workspace instructions. |
| Save changes button (admin only) | Yes | Yes | **Done.** Rendered only when `isAdmin`. Disabled while `savingSettings` or `settingsLoading`. Sends both instructions and email domains in one PATCH. Error shown via toast. |
| Note — duplicate of `/org/general` | — | — | **Duplicate fields.** Workspace instructions and allowed email domains are identical to what `/org/general` manages. Both pages call `GET /organizations/{orgId}/settings` on mount and both call `PATCH /organizations/{orgId}/settings` on save. Changes made on one page are not reflected on the other until reload. The backend has one canonical endpoint; the frontend has two UIs for it. |

---

### Section 2 — Authentication

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Google OAuth SSO (toggle) | No | No | **Not implemented — no endpoint.** `googleSSO` local state, defaults to `false`. Toggle visible and clickable for admins (`onToggle: isAdmin ? () => setGoogleSSO(v => !v) : undefined`), but no API call fires on change. State is lost on page reload. |
| Microsoft OAuth SSO (toggle) | No | No | **Not implemented — no endpoint.** `msSSO` local state, defaults to `false`. Same pattern as Google SSO — local state only, no API call, not persisted. |
| Domain Claiming (toggle + verification) | No | No | **Not implemented — no endpoint. DNS verification is mocked.** `domainOn` local state, defaults to `false`. Toggle works locally. When enabled, an input + "Verify domain" button appear. `handleVerify()` uses `setTimeout(() => setDomainStatus('verified'), 2000)` — there is no actual DNS lookup or API call. The TXT record shown is hardcoded: `souvenir-verify=sv_01abcdef1234` (not generated per-domain or per-org). After 2 seconds the UI shows "verified" regardless of whether any DNS record exists. Nothing is persisted. |
| 2FA Enforcement (toggle) | No | No | **Not implemented — no endpoint.** `twoFA` local state, defaults to `false`. Toggle visible and clickable for admins, no API call on change, not persisted. |
| SAML 2.0 / SCIM | No | No | **Hardcoded disabled.** Rendered with `isEnabled={false}` and `status="disabled"` — the row is always muted and non-interactive (`pointerEvents: 'none'`). No `onToggle` prop. Described as "Enterprise only — upgrade to access". Cannot be toggled regardless of plan. |

---

### Section 3 — Approval Threshold (HITL)

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| HITL Threshold — display current value | No | No | **Not loaded from backend.** `hitl` is initialized as `useState<HITLThreshold>(org.hitlThreshold)`. `org.hitlThreshold` comes from `OrgContext`, which hardcodes it as `'tier_3_plus'` in `DEFAULT_ORG` — it is never overridden by any API response. `OrganizationSettingsResponse` has no `hitl_threshold` field. The radio always starts on "Ask for Tier 3+ actions" regardless of what the org actually has set. |
| HITL Threshold — save on change | No | No | **Not implemented — no endpoint.** The radio `onChange` calls `setHitl(v as HITLThreshold)` — local state only. `updateOrgSettings` does not accept a `hitlThreshold` parameter. There is no separate endpoint for HITL settings. Changes are lost on reload. |
| Admin gate on HITL section | N/A | Yes — partial | **Gate renders but blocks owners.** The entire Approval Threshold card applies `opacity: isAdmin ? 1 : 0.5` and `pointerEvents: isAdmin ? 'auto' : 'none'`. Since `isAdmin = currentUserRole === 'admin'` (same owner exclusion bug), owners see the section grayed out and non-interactive. |

---

## Page: `/settings/org/security`

**File:** `src/app/(app)/settings/org/security/page.tsx`  
**Component type:** Client component (`'use client'`)

### On mount — data loading

| # | Method | Endpoint | Function | Called by | State updated |
|---|--------|----------|----------|-----------|---------------|
| 1 | GET | `/organizations/{orgId}/settings` | `getOrgSettings(orgId)` | Page `useEffect` when `orgId` resolves | `instructions` (from `org_instructions`), `emailDomains` (from `allowed_email_domains` joined with `', '`) |

Response shape (same as `/org/general`):
```ts
{
  organization_id:            string
  org_instructions:           string | null
  allowed_email_domains:      string[] | null
  default_chat_visibility:    string | null
  default_persona_visibility: string | null
}
```

Only `org_instructions` and `allowed_email_domains` are consumed on this page.  
`settingsLoading` dims the workspace defaults section while the fetch is in flight.  
Errors are swallowed via `.catch(console.error)` — if the call fails the fields stay empty with no user-visible error.

### User actions — API calls

| # | Trigger | Method | Endpoint | Function | Request body | Notes |
|---|---------|--------|----------|----------|-------------|-------|
| 1 | "Save changes" button | PATCH | `/organizations/{orgId}/settings` | `updateOrgSettings(orgId, params)` | `{ orgInstructions: string\|null, allowedEmailDomains: string[] }` | Only visible to admins. Sends both instructions and email domains in one call. `toast.success` on success, `toast.error` on failure. |

### Endpoints used — summary

| Endpoint | Method | Source file | When called |
|----------|--------|-------------|-------------|
| `/organizations/{orgId}/settings` | GET | `src/lib/api/organization.ts` → `getOrgSettings()` | Mount |
| `/organizations/{orgId}/settings` | PATCH | `src/lib/api/organization.ts` → `updateOrgSettings()` | "Save changes" |

### Key bugs and gaps

1. **Owner exclusion**: `isAdmin = currentUserRole === 'admin'` — owners cannot edit workspace defaults or view the HITL section interactively. Same root cause as all other org pages.
2. **All authentication toggles are local only**: Google SSO, Microsoft SSO, and 2FA toggles have no backend endpoints. State is lost on reload. The `OrganizationSettingsResponse` type has no fields for any of these.
3. **Domain claiming is entirely mocked**: `handleVerify()` is a 2-second `setTimeout`. The TXT record displayed (`souvenir-verify=sv_01abcdef1234`) is a hardcoded constant — not generated per domain. No API call is made. Nothing is persisted.
4. **HITL Threshold is never loaded or saved**: `org.hitlThreshold` is hardcoded `'tier_3_plus'` in `DEFAULT_ORG`. No API response sets this field. `updateOrgSettings` has no `hitlThreshold` parameter. The radio group is fully interactive visually but changes are lost on reload.
5. **SAML 2.0 / SCIM is permanently hardcoded disabled**: No plan check is performed — even enterprise orgs would see it disabled. No upgrade path is wired (no link, no modal, no portal call).
6. **Duplicate fields with `/org/general`**: Workspace instructions and allowed email domains are managed identically on both pages. No sync between them in-session (changing on one page doesn't update the other without a full reload).

---

## Feature integration status — `/settings/org/activity`

This is a read-only page. There are no write actions. The page makes one API call on mount and all filtering is client-side.

| Feature | Backend endpoint provided | Frontend implemented | Status |
|---------|:---:|:---:|--------|
| Audit log list — fetch on mount | Yes | Yes | **Done.** `GET /organizations/{orgId}/audit?limit=100` fired once when `orgId` resolves. Returns up to 100 entries. Loading state shown while in flight. Errors swallowed via `.catch(console.error)` — page silently shows empty state on failure. |
| Action dropdown filter | Yes — partial | Partial | **Client-side only — no server filter param sent.** `<select>` options are built dynamically from `new Set(entries.map(e => e.action))` — every distinct action type in the loaded 100 entries. Selecting a value filters the in-memory `entries` array; no new API call is made. The `listAudit` function accepts `limit` and `offset` only — there is no `action` filter param sent to the backend. Useful only within the loaded 100 entries. |
| Clear filter button | N/A | Yes | **Done.** Appears only when `filterAction !== 'all'`. Resets `filterAction` to `'all'`. No API call. |
| Time column — relative timestamp | Yes | Yes | **Done.** `relativeTime(entry.createdAt)` converts UTC timestamp to human relative string: `just now` / `Xm ago` / `Xh ago` / `Xd ago` / `Xmo ago` / `Xy ago`. `parseServerDate` handles UTC timestamps that may lack a `'Z'` suffix (prevents future-date misparse). |
| Time column — full date on hover | Yes | Yes | **Done.** `title={formatServerDateTime(entry.createdAt, ...)}` renders full date/time as a native tooltip on hover. |
| Actor column — name resolution | Partial | Yes | **Done with fallback.** `actorLabel(entry.actorUserId)` looks up `memberNameById` map (built from `members` in OrgContext — loaded by `getOrgPlan()`). Falls back to `shortenId(id)`: strips `auth0|` prefix, truncates to 12 chars with ellipsis. Full raw `actorUserId` shown on hover via `title` attribute. Works for current members; fails gracefully for deleted members or service accounts. |
| Action column — human-readable label | Yes | Yes | **Done.** `humanizeAction(entry.action)` replaces underscores with spaces and capitalises the first character. e.g. `invite_sent` → `Invite sent`. |
| Action column — target resolution | Partial | Partial | **Teams resolved; other target types fall back to shortened ID.** If `entry.targetType === 'team'`, `targetLabel` looks up `teamNameById` (from OrgContext `teams` state). All other `targetType` values (users, projects, connectors, etc.) fall back to `shortenId(entry.targetId)`. The `extra` field (which may contain richer context) is mapped but never displayed. |
| Pagination / load more | Yes — offset supported | No | **Not implemented.** `listAudit` accepts `{ limit, offset }` and the endpoint supports `?limit=X&offset=Y`. The page always calls with `{ limit: 100 }` and no `offset`. There is no "Load more" button, infinite scroll, or page control. The log is capped at 100 entries with no way to see older events. |
| Virtualization | N/A | No | **Not implemented.** All `filtered` entries are rendered with a plain `.map()` into the DOM. No `react-window`, `react-virtual`, or similar library is used. At the current `limit: 100` cap this is acceptable, but if pagination were added without virtualization the DOM would grow linearly. |
| Admin vs member scoping | Yes — assumed backend | Partial | **Subtitle differs; API call is identical.** Admins see "All workspace actions across all members." Members see "Your activity in this workspace." However, both roles call `listAudit(orgId, { limit: 100 })` with no actor filter. Whether the backend scopes results to the requesting user for non-admins is not visible from frontend code. No `actor_id` filter param is passed for members. |
| "90 days of history" retention label | No | N/A | **Hardcoded.** Footer reads `"Activity log retains 90 days of history"`. This is a static string — no API field confirms the retention window. If the backend policy changes, the UI will be stale. |
| `isAdmin` gate | N/A | Partial — buggy | **Owner exclusion.** `isAdmin = currentUserRole === 'admin'`. Owners see the member subtitle ("Your activity") even though they are workspace owners. No functional impact since both roles call the same endpoint, but owners may see incomplete activity if the backend scopes by role. |

---

## Page: `/settings/org/activity`

**File:** `src/app/(app)/settings/org/activity/page.tsx`  
**Component type:** Client component (`'use client'`)

### On mount — data loading

| # | Method | Endpoint | Function | Called by | State updated |
|---|--------|----------|----------|-----------|---------------|
| 1 | GET | `/organizations/{orgId}/audit?limit=100` | `listAudit(orgId, { limit: 100 })` | Page `useEffect` when `orgId` resolves | `entries: AuditLogEntry[]` |

The page also consumes `members` and `teams` from `OrgContext` — both already loaded by `OrgProvider` via `getOrgPlan()` and `fetchTeams()`. No additional API calls are made for those.

Raw response shape (array of entries):
```ts
Array<{
  id:            string
  actor_user_id: string
  action:        string          // e.g. "invite_sent", "team_created", "member_removed"
  target_type:   string | null   // e.g. "team", "member", null
  target_id:     string | null
  extra:         Record<string, unknown> | null   // additional context — never displayed
  created_at:    string          // UTC ISO-8601, may lack 'Z' suffix
}>
```

After normalization (`normalizeAuditEntry`):
```ts
AuditLogEntry {
  id, actorUserId, action, targetType, targetId, extra, createdAt
}
```

### User actions — API calls

**None.** The page is fully read-only. The action dropdown filter, clear button, and all row interactions are client-side only. No user action triggers an API call.

### How the filter dropdown works

```
entries (100 from API)
  → new Set(entries.map(e => e.action))   // unique action types in this batch
  → sorted + prepended with 'all'         // dropdown options
  → filterAction state (local)            // selected value
  → entries.filter(...)                   // filtered: no re-fetch
  → rendered rows
```

Because options are derived from the loaded batch, the dropdown only shows action types that appear in the most recent 100 entries. Older action types that aren't in the current page are invisible.

### How actor and target labels are resolved

```
entry.actorUserId
  → memberNameById.get(actorUserId)       // Map built from OrgContext members
  → fallback: shortenId(actorUserId)      // strips "auth0|" prefix, truncates to 12 chars

entry.targetType + entry.targetId
  → if type === 'team': teamNameById.get(targetId)   // Map built from OrgContext teams
  → all other types:    shortenId(targetId)
```

No network request is made for resolution — both maps are pre-built from already-loaded context data using `useMemo`.

### Endpoints used — summary

| Endpoint | Method | Source file | When called |
|----------|--------|-------------|-------------|
| `/organizations/{orgId}/audit` | GET | `src/lib/api/organization.ts` → `listAudit()` | Mount only |

### Key bugs and gaps

1. **No pagination**: The log is always fetched with `limit: 100` and no `offset`. The endpoint supports `?limit=X&offset=Y` but the frontend never uses `offset`. Events older than the most recent 100 are inaccessible.
2. **No server-side action filter**: The dropdown filter is entirely client-side. If an action type appears only in events 101+ (outside the loaded batch), it will never appear as a filter option and those events can't be found.
3. **`extra` field is silently discarded**: The backend returns a freeform `extra: Record<string, unknown>` on each entry — potentially containing changed fields, IP address, user-agent, or other audit details. `normalizeAuditEntry` maps it to `AuditLogEntry.extra` but the UI never reads or renders it.
4. **No virtualization**: All visible rows are rendered into the DOM at once. Fine at 100 entries but will not scale if pagination is added without a windowing strategy.
5. **Non-team targets show shortened IDs**: Only `targetType === 'team'` gets a human-readable label. Member, project, connector, persona, and other target types show a truncated raw ID — not user-friendly.
6. **Owner exclusion**: `isAdmin = currentUserRole === 'admin'` — owners see the member subtitle. If the backend scopes results by role, owners would also see only their own activity instead of the full log.
7. **Hardcoded retention label**: "90 days of history" is a static string. The actual backend retention window is not surfaced in any API response.
