# Organizations Module — Frontend Integration Guide

A complete, scenario-by-scenario reference for everything the **Organizations** module
exposes: organizations, teams, projects, members, connectors, invites, credit pools,
sharing, visibility, and the audit log. Every endpoint is documented with its
permission gate, request payload, response shape, and the error cases the FE must
handle.

This is a reference document. Use the table of contents to jump to a flow.

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Conventions (auth, casing, errors)](#2-conventions)
3. [Roles & permission matrix](#3-roles--permission-matrix)
4. [Organization lifecycle](#4-organization-lifecycle)
5. [Organization settings](#5-organization-settings)
6. [Plan, usage & the credit pool](#6-plan-usage--the-credit-pool)
7. [Members](#7-members)
8. [Connector catalog (org allow-list)](#8-connector-catalog-org-allow-list)
9. [Org shared connector accounts](#9-org-shared-connector-accounts)
10. [Personal connector requests](#10-personal-connector-requests)
11. [Teams](#11-teams)
12. [Team editors](#12-team-editors)
13. [Projects & project members](#13-projects--project-members)
14. [Team connectors — approval facet](#14-team-connectors--approval-facet)
15. [Team connections — shared-account facet](#15-team-connections--shared-account-facet)
16. [Invites](#16-invites)
17. [Credit overflow](#17-credit-overflow)
18. [Slack channel mapping](#18-slack-channel-mapping)
19. [Chat shares](#19-chat-shares)
20. [Visibility / publishing](#20-visibility--publishing)
21. [Audit log](#21-audit-log)
22. [End-to-end scenarios](#22-end-to-end-scenarios)
23. [Appendix: enums & error catalog](#23-appendix-enums--error-catalog)

---

## 1. Mental model

### The tree

```
Organization                     ← the tenant; exactly one owner
 ├── OrganizationMember (1/user) ← the ONLY place a role lives (owner|admin|member)
 ├── Team                        ← a group inside the org; no owner of its own
 │    ├── TeamEditor (grant)     ← who can edit this team's content & publish to it
 │    ├── Project                ← narrowest scope
 │    │    └── ProjectMember     ← who can access this one project
 │    ├── TeamConnector          ← connector approval + optional shared account
 │    └── TeamInvite             ← link-based invitation to join as editor
 └── OrganizationUsage           ← the shared credit pool (= the owner's wallet)
```

A person's **role** (owner / admin / member) is org-wide and lives on their single
`OrganizationMember` row. A plain **member** starts with *no* content access — their
real reach comes from **grant rows**:

- a **`TeamEditor`** grant makes them an *editor* of that team (edit content, publish, manage its projects' members);
- a **`ProjectMember`** grant gives them access to one project only.

Owners and admins implicitly act in every team; they need no grants.

### Credits

- An org has **one shared pool**. Physically it is the **owner's personal wallet**
  (`OrganizationUsage` mirrors it). It is funded per billing period by the Teams plan,
  sized by the purchased **volume tier**.
- An admin **assigns** a slice of the pool to each member as their `credit_cap`. A member
  spends against their cap; `credit_used` tracks it.
- **Carryover:** when someone joins an org while holding leftover personal credits, those
  ride along as the member's own balance and are **spent before** their assigned team credits.
- **Pool status** is derived from total % used: `healthy` < 95% ≤ `warning_95` < 100% = `paused`.
  At 100% the pool pauses immediately (no grace window).

### Two ways an org comes into being

1. **`POST /organizations`** — a user creates one manually and becomes its owner.
   *No team and no credits are provisioned by this call.* (Used for self-serve setup.)
2. **Stripe Teams purchase** (backend webhook → `provision_organization`) — idempotently
   creates the org, the owner membership, a default **"General"** team, and **funds the
   pool** for the period. This is the funded path.

The FE drives (1) and reads the result of (2); it never calls provisioning directly.

---

## 2. Conventions

### Base URLs

There is **no global API prefix**. Routers mount at their own roots:

| Router | Prefix |
|---|---|
| Organizations (the bulk of this guide) | `/organizations` |
| Team invite (public preview + accept) | `/team-invite` |
| Chat shares | `/chat-shares` |
| Visibility setters | `/chats`, `/projects`, `/persona` |

### Authentication

Every endpoint requires an **Auth0 JWT** as `Authorization: Bearer <token>`, **except**
`GET /team-invite/{invite_id}` (public preview). The backend maps the JWT to the user's
`auth0_id` (referred to as `user_id` / `sub` throughout). Authorization is entirely
DB-driven — Auth0 only authenticates.

### Casing — read this carefully

The API is **asymmetric** by design:

- **Responses are always `snake_case`.** No response body uses camelCase.
- **Requests accept `snake_case` field names, and several fields *also* accept a
  `camelCase` alias** (the models set `populate_by_name=True`). Either spelling is valid
  on input. This guide shows the camelCase form for aliased fields and flags them with
  **(alias)**.

Fields that have a camelCase input alias: `logoUrl`, `allowedEmailDomains`, `companySize`,
`confirmName`, `orgInstructions`, `defaultChatVisibility`, `defaultPersonaVisibility`,
`hitlThreshold`, `creditCap`, `userId`, `newOwnerUserId`, `connectorSlugs`, `accountLabel`,
`accountIdentifier`, `expectedVersion`, `sharedAccountId`, `teamId`, `teamIds`, `chatId`,
`projectId`. All other request fields are plain `snake_case`.

### IDs

- Organization, team, project, invite, account, share, request, audit IDs are **UUID** strings.
- User IDs are **Auth0 subject strings** (e.g. `"auth0|6630f…"`), not UUIDs.
- Connector identifiers are **slugs** (e.g. `"gmail"`, `"shopify"`).

### Error shape

FastAPI's standard envelope:

```json
{ "detail": "Human-readable message" }
```

Status codes used across the module: `400` (validation/business rule), `402` (credits
exhausted), `403` (permission denied), `404` (not found / not a member), `409` (conflict —
duplicate, slug taken, version mismatch), `410` (invite expired). A full catalog is in the
[appendix](#23-appendix-enums--error-catalog).

### Timestamps

ISO-8601 (`created_at`, `updated_at`, `expires_at`, `recovery_deadline`).

---

## 3. Roles & permission matrix

`OrganizationMember.role` is resolved into a class ladder
**Member → Editor → Admin → Owner** (each strictly adds capability). The dependency that
guards each endpoint is one of:

| Gate | Who passes |
|---|---|
| **member** (`get_organization_context`) | any member of the org |
| **editor (any team)** (`require_organization_editor`) | owner/admin, or an editor of *any* team |
| **team editor** (`require_team_editor`) | owner/admin, or an editor of *that specific* team |
| **admin** (`require_organization_admin`) | owner or admin |
| **owner** (`require_organization_owner`) | owner only |

Capability summary:

| Capability | member | editor (of team) | admin | owner |
|---|:--:|:--:|:--:|:--:|
| See org, settings, plan, members, audit (own) | ✅ | ✅ | ✅ | ✅ |
| Edit a team's content / publish to it / manage its projects' members | — | ✅ (granted team) | ✅ (all) | ✅ |
| Request a team connector | ✅ (affiliated) | ✅ | ✅ (auto-approved) | ✅ |
| Attach a shared account to a team | — | ✅ (granted team) | ✅ | ✅ |
| Create/update/delete teams, invites, member cap/role, connector catalog, shared accounts, Slack mapping | — | — | ✅ | ✅ |
| See the **full** audit log (vs. only your own actions) | — | — | ✅ | ✅ |
| Transfer ownership / change payment method | — | — | — | ✅ |

> "affiliated" = owner/admin, an editor of the team, or a member of one of its projects.

---

## 4. Organization lifecycle

### 4.1 List my organizations

```
GET /organizations
```
**Gate:** any authenticated user. Returns every org the caller belongs to (each annotated
with `my_role`).

**Response `200` — `OrganizationResponse[]`:**
```json
[
  {
    "id": "8f2c…",
    "name": "Acme Inc",
    "slug": "acme-inc",
    "description": "",
    "logo_url": "https://…/logo.png",
    "tags": ["ecommerce"],
    "company_size": "11-50",
    "archived": false,
    "my_role": "owner",
    "owner_user_id": "auth0|owner123",
    "owner_name": "Dana Lee",
    "owner_email": "dana@acme.com",
    "created_at": "2026-06-01T12:00:00",
    "updated_at": "2026-06-10T09:30:00"
  }
]
```

### 4.2 Create an organization

```
POST /organizations            → 201
```
**Gate:** any authenticated user, subject to **plan exclusivity**.

**Request — `CreateOrganizationRequest`:**
```json
{
  "name": "Acme Inc",                        // required, 1–255 chars
  "description": "",
  "logoUrl": "https://…/logo.png",           // (alias) nullable, ≤1024
  "tags": ["ecommerce"],
  "allowedEmailDomains": ["acme.com"],       // (alias) nullable
  "companySize": "11-50"                      // (alias) nullable, ≤32
}
```

**Behaviour:** generates a unique `slug` from the name, makes the caller the **owner**,
writes an `organization_created` audit row. **Does not** create a team or fund credits.

**Response `201` — `OrganizationResponse`** (as above, `my_role: "owner"`).

**Errors:**
| Code | When |
|---|---|
| `409` | Caller already belongs to an organization. |
| `409` | Caller has a live personal plan — *"Cancel your personal plan first…"*. Must cancel first. |

> **Plan exclusivity:** a user is in **one** org *or* on a personal plan, never both. The FE
> should surface the cancel-personal-plan path when it gets this 409.

### 4.3 Get one organization

```
GET /organizations/{organization_id}
```
**Gate:** member. **Response `200` — `OrganizationResponse`.** `404` if the org doesn't
exist; `403` if the caller isn't a member.

### 4.4 Update an organization

```
PATCH /organizations/{organization_id}
```
**Gate:** admin. All fields optional; only those present are changed.

**Request — `UpdateOrganizationRequest`:**
```json
{
  "name": "Acme International",
  "slug": "acme-intl",            // lowercase, kebab; pattern ^[a-z0-9]+(-[a-z0-9]+)*$
  "description": "New tagline",
  "logoUrl": "https://…/new.png", // (alias)
  "tags": ["ecommerce", "global"],
  "archived": false
}
```

**Response `200` — `OrganizationResponse`.**
**Errors:** `409` if `slug` is already taken; `400` if `slug` violates the pattern; `403` non-admin.

### 4.5 Delete (soft) an organization

```
DELETE /organizations/{organization_id}    → 204
```
**Gate:** admin. Requires typing the org name to confirm.

**Request — `DeleteOrganizationRequest`:**
```json
{ "confirmName": "Acme Inc" }     // (alias) must equal the org's exact name
```
**Behaviour:** soft-deletes (sets `deleted_at`). **Response `204`.**
**Errors:** `400` *"Confirmation name does not match…"* when `confirmName` ≠ the org name.

### 4.6 Transfer ownership

```
POST /organizations/{organization_id}/transfer-owner
```
**Gate:** **owner only.** Moves the single owner role to another member; the outgoing owner
becomes an **admin** (demote-then-promote keeps the one-owner constraint valid throughout).

**Request — `TransferOwnerRequest`:**
```json
{ "newOwnerUserId": "auth0|member456" }   // (alias)
```
**Response `200` — `OrganizationResponse`** (now reflects the new owner; caller's
`my_role` is `"admin"`).
**Errors:** `400` if you target yourself; `404` if the target isn't a member.

---

## 5. Organization settings

Settings are org-wide defaults that shape chat behaviour and content visibility.

### 5.1 Get settings

```
GET /organizations/{organization_id}/settings
```
**Gate:** member. **Response `200` — `OrganizationSettingsResponse`:**
```json
{
  "organization_id": "8f2c…",
  "org_instructions": "Always cite sources.",
  "allowed_email_domains": ["acme.com"],
  "company_size": "11-50",
  "default_chat_visibility": "private",      // "private" | "team"
  "default_persona_visibility": "private",   // "private" | "team"
  "hitl_threshold": "ask_tier_3_plus"        // see enum below
}
```

### 5.2 Update settings

```
PATCH /organizations/{organization_id}/settings
```
**Gate:** admin. All fields optional.

**Request — `UpdateOrganizationSettingsRequest`:**
```json
{
  "orgInstructions": "Always cite sources.",     // (alias)
  "allowedEmailDomains": ["acme.com"],           // (alias)
  "companySize": "11-50",                         // (alias)
  "defaultChatVisibility": "team",                // (alias) "private" | "team"
  "defaultPersonaVisibility": "private",          // (alias) "private" | "team"
  "hitlThreshold": "ask_everything"               // (alias) enum
}
```
- **`hitl_threshold`** (human-in-the-loop) governs when the agent pauses for approval:
  `auto_proceed` | `ask_tier_3_plus` | `ask_everything`.

**Response `200` — `OrganizationSettingsResponse`.**
**Errors:** `400` if a visibility value isn't `private`/`team`.

---

## 6. Plan, usage & the credit pool

### 6.1 Plan (pool totals + per-member allocation)

```
GET /organizations/{organization_id}/plan
```
**Gate:** member. **Response `200` — `PlanResponse`:**
```json
{
  "organization_id": "8f2c…",
  "plan_credits": 420.0,       // unassigned pool + members' unspent assigned credits
  "topup_credits": 50.0,       // purchased, permanent
  "total_credits": 600.0,      // everything granted this period (= remaining + used)
  "used": 130.0,               // cumulative spend (owner pool + all members)
  "remaining": 470.0,          // plan_credits + topup_credits
  "percent_used": 21.67,
  "pool_status": "healthy",    // "healthy" | "warning_95" | "paused"
  "members": [ /* MemberResponse[] — see §7 */ ]
}
```
This is the data for the **Plans & Usage** screen: the pool gauge plus the per-member
allocation table.

### 6.2 Usage breakdown by team

```
GET /organizations/{organization_id}/plan/usage
```
**Gate:** member. Rolls up each member's `credit_used` to the team(s) they belong to (a
team's editors + its projects' members).

**Response `200` — `UsageBreakdownResponse`:**
```json
{
  "organization_id": "8f2c…",
  "by_team": [
    { "team_id": "11…", "team_name": "Growth",  "credits_used": 88.5 },
    { "team_id": "22…", "team_name": "Support", "credits_used": 41.5 }
  ]
}
```

### 6.3 Pool status (lightweight gauge)

```
GET /organizations/{organization_id}/pool-status
```
**Gate:** member. A cheaper call than `/plan` for a header badge.

**Response `200` — `PoolStatusResponse`:**
```json
{
  "organization_id": "8f2c…",
  "status": "warning_95",
  "percent_used": 96.4,
  "remaining": 21.6
}
```

> **FE guidance:** show a warning banner at `warning_95`; when `paused`, members'
> team turns will 402 — surface "ask an admin to assign more credits / top up".

---

## 7. Members

`MemberResponse` shape (used by all member endpoints and embedded in `PlanResponse`):
```json
{
  "user_id": "auth0|member456",
  "name": "Sam Rivera",
  "email": "sam@acme.com",
  "role": "member",            // "owner" | "admin" | "member"
  "credit_cap": 100.0,         // assigned credits (null = none assigned)
  "credit_extra": 0.0,         // legacy one-time grants (kept for back-compat)
  "credit_used": 37.25,
  "invite_status": "active"    // "active" | "pending"
}
```

### 7.1 List members

```
GET /organizations/{organization_id}/members          → all members
GET /organizations/{organization_id}/members/admins    → owner + admin only
GET /organizations/{organization_id}/members/regular   → role == member only
```
**Gate:** member (all three). **Response `200` — `MemberResponse[]`.**

### 7.2 Set / raise a member's assigned credits

```
PATCH /organizations/{organization_id}/members/{member_id}/cap
```
**Gate:** admin. `member_id` is the member's Auth0 user id.

**Request — `SetCapRequest`:**
```json
{ "creditCap": 150.0 }    // (alias) positive number
```
**Rules:**
- Cap must be **positive** and **strictly greater** than the current cap — caps can only be
  *raised* during the current period (no mid-period clawback).
- The delta is drawn from the pool; if the pool lacks unassigned credits, it fails.

**Response `200` — `MemberResponse`.**
**Errors:**
| Code | When |
|---|---|
| `404` | Member not found. |
| `400` | Cap ≤ 0, or ≤ current cap, or the owner can't be resolved. |
| `400` | *"Not enough unassigned team credits to allocate"*. |

### 7.3 Change a member's role

```
PATCH /organizations/{organization_id}/members/{member_id}/role
```
**Gate:** admin.

**Request — `SetRoleRequest`:**
```json
{ "role": "admin" }    // "admin" | "member" only
```
**Response `200` — `MemberResponse`.**
**Errors:** `400` if you try to set or remove `owner` via this endpoint — ownership moves
**only** through [transfer-owner](#46-transfer-ownership); `404` member not found.

### 7.4 Remove a member

```
DELETE /organizations/{organization_id}/members/{member_id}   → 204
```
**Gate:** admin. **Response `204`.**
**Errors:** `404` not found; `400` *"The owner cannot be removed…"*.

---

## 8. Connector catalog (org allow-list)

The **catalog** is the org-wide allow-list of which connectors members may use at all.
Nothing downstream (team approval, shared accounts, member solo turns) works for a slug
that isn't in the catalog.

### 8.1 List the catalog

```
GET /organizations/{organization_id}/connectors/catalog
```
**Gate:** admin. Returns **every** active connector with an `org_enabled` flag and any org
shared accounts grouped under it.

**Response `200` — `ConnectorCatalogEntry[]`** (key fields):
```json
[
  {
    "slug": "shopify",
    "display_name": "Shopify",
    "auth_mode": "oauth2",            // "oauth2" | "api_key"
    "description": "…",
    "tools": [ { "slug": "SHOPIFY_PULL_ORDERS", "policy": "ask" } ],
    "api_key_fields": [ { "name": "subdomain", "label": "Store subdomain", "secret": false, "required": true } ],
    "linked": false,
    "org_enabled": true,
    "accounts": [ /* OrganizationConnectorAccountResponse[] — see §9 */ ]
  }
]
```

### 8.2 Replace the catalog (enable/disable connectors)

```
PUT /organizations/{organization_id}/connectors/catalog
```
**Gate:** admin. **Full replace** — send the complete desired set of enabled slugs.

**Request — `UpdateConnectorCatalogRequest`:**
```json
{ "connectorSlugs": ["gmail", "shopify", "slack"] }   // (alias)
```
**Response `200` — `ConnectorCatalogEntry[]`** (the refreshed catalog).
**Errors:** `400` *"Unknown or inactive connectors: …"* if any slug isn't an active connector.

> **Disabling cascades:** removing a slug from the catalog blocks new team approvals/links
> and removes it from members' allowed set on the chat path. Use
> [`/connectors/{slug}/used-by`](#83-disconnect-blast-radius) first to see who's affected.

### 8.3 Disconnect blast-radius

```
GET /organizations/{organization_id}/connectors/{slug}/used-by
```
**Gate:** editor (any team). Lists the teams that would lose the connector if you disable/disconnect it.

**Response `200` — `ConnectorUsedByEntry[]`:**
```json
[ { "surface": "team", "id": "11…", "name": "Growth" } ]
```

---

## 9. Org shared connector accounts

A **shared account** is one connector login owned by the org that many teams can reuse
(e.g. the company Shopify store). Admins create them at the org level, then *attach* them to
teams (see [§15](#15-team-connections--shared-account-facet)).

`OrganizationConnectorAccountResponse` shape:
```json
{
  "id": "acc-77…",
  "organization_id": "8f2c…",
  "connector_slug": "shopify",
  "account_label": "Main Store",
  "account_identifier": "ops@acme.com",   // nullable; provider login/email
  "connected": true,                       // provider handshake completed?
  "scope": "shared_team",                  // always "shared_team" on this table
  "status": "active",                      // "active" | "disabled" | "expired"
  "version": 3,                            // optimistic-concurrency counter
  "team_ids": ["11…", "22…"],              // teams this account is attached to
  "linked_by_user_id": "auth0|admin1",
  "created_at": "…",
  "updated_at": "…"
}
```

### 9.1 List shared accounts for a connector

```
GET /organizations/{organization_id}/connectors/{slug}/accounts
```
**Gate:** editor (any team). **Response `200` — `OrganizationConnectorAccountResponse[]`.**

### 9.2 Create / start linking a shared account

```
POST /organizations/{organization_id}/connectors/{slug}/accounts   → 201
```
**Gate:** admin. The slug must be enabled in the catalog.

**Request — `OrganizationConnectionLinkRequest`:**
```json
{
  "accountLabel": "Main Store",          // (alias) required, 1–255
  "accountIdentifier": "ops@acme.com",   // (alias) optional, ≤255
  "init_data": { "subdomain": "acme" }   // per-tenant OAuth / BYOA fields, when required
}
```

**Behaviour depends on `auth_mode` / provider:**
- **OAuth2** → returns a `redirect_url`; the user completes the provider handshake there.
  If `init_data` carries `client_id` + `client_secret`, a BYOA (bring-your-own-app) S2S link
  is created instead.
- **api_key / custom** → no redirect; the row is created "not connected". Submit credentials
  via the PATCH below.
- **Nango proxy** → returns a Nango connect `redirect_url`.

**Response `201` — `LinkResponse`:**
```json
{
  "connector_slug": "shopify",
  "redirect_url": "https://…oauth…",   // null for api_key/custom
  "shared_account_id": "acc-77…"
}
```
**Errors:** `404` unknown connector; `403` *"… is not enabled in this organization's
connector catalog."*; `400` missing required `init_data` fields; `502` provider failure.

> **FE flow for OAuth:** POST → receive `redirect_url` → open it (popup/redirect) → on
> return, poll `GET …/accounts` until `connected: true`.

### 9.3 Update a shared account (label, identifier, status, credentials)

```
PATCH /organizations/{organization_id}/connectors/accounts/{account_id}
```
**Gate:** admin. Any subset of fields.

**Request — `UpdateOrganizationConnectionRequest`:**
```json
{
  "accountLabel": "Main Store (US)",     // (alias)
  "accountIdentifier": "ops@acme.com",   // (alias)
  "credentials": { "api_key": "sk_live_…" },   // api_key/custom connectors only
  "status": "disabled",                   // "active" | "disabled" | "expired"
  "expectedVersion": 3                    // (alias) optimistic lock — omit to write unconditionally
}
```
**Optimistic concurrency:** if `expectedVersion` is sent and the row has moved on, the
write **409s** (*"This shared account was changed by someone else. Reload it and retry."*).
Re-fetch and retry.

**Response `200` — `OrganizationConnectorAccountResponse`** (with bumped `version` and
re-synced `team_ids`).
**Errors:** `404` account not found / wrong org; `409` version conflict; `400` wrong
auth-mode for the operation (e.g. credentials on an OAuth connector); `502` provider failure.

### 9.4 Delete a shared account

```
DELETE /organizations/{organization_id}/connectors/accounts/{account_id}   → 204
```
**Gate:** admin. Detaches the account from every team, then deletes it. **Response `204`**;
`404` if not found.

---

## 10. Personal connector requests

A member can ask an admin to grant them a **personal** exception for a connector that isn't
broadly enabled, so they can use their *own* login on solo (non-team) turns.

`PersonalConnectorRequestResponse` shape:
```json
{
  "id": "req-90…",
  "organization_id": "8f2c…",
  "user_id": "auth0|member456",
  "user_name": "Sam Rivera",
  "user_email": "sam@acme.com",
  "connector_slug": "gmail",
  "status": "pending",                  // "pending" | "approved" | "denied"
  "note": "Need this for outreach",
  "requested_by_user_id": "auth0|member456",
  "reviewed_by_user_id": null,
  "created_at": "…",
  "updated_at": "…"
}
```

### 10.1 Request a personal connector

```
POST /organizations/{organization_id}/connectors/{slug}/personal-request   → 201
```
**Gate:** member. Body optional.

**Request — `PersonalConnectorRequestBody`:**
```json
{ "note": "Need this for outreach" }
```
**Response `201` — `PersonalConnectorRequestResponse`.** `404` unknown connector.
Re-requesting upserts the existing row.

### 10.2 List pending/all personal requests (admin queue)

```
GET /organizations/{organization_id}/connectors/personal-requests
```
**Gate:** admin. **Response `200` — `PersonalConnectorRequestResponse[]`.**

### 10.3 Review a personal request

```
PATCH /organizations/{organization_id}/connectors/personal-requests/{request_id}
```
**Gate:** admin.

**Request — `ReviewPersonalConnectorRequest`:**
```json
{ "status": "approved" }    // "approved" | "denied" | "pending"
```
**Response `200` — `PersonalConnectorRequestResponse`.** `404` if the request isn't in this org.

> Approved personal slugs widen that member's **solo-turn** connector allow-list (org-enabled
> ∪ approved-personal). Admins/owners are unrestricted regardless.

---

## 11. Teams

`TeamResponse` shape:
```json
{
  "id": "11…",
  "organization_id": "8f2c…",
  "name": "Growth",
  "description": "Acquisition & lifecycle",
  "tags": ["marketing"],
  "archived": false,
  "recovery_deadline": null,          // set when archived: now + 90 days
  "created_at": "…",
  "updated_at": "…"
}
```

### 11.1 List teams

```
GET /organizations/{organization_id}/teams
```
**Gate:** member — but the list is **filtered to teams the caller can act in** (owner/admin
see all; editors/members see their teams). **Response `200` — `TeamResponse[]`.**

### 11.2 Create a team

```
POST /organizations/{organization_id}/teams    → 201
```
**Gate:** admin.

**Request — `CreateTeamRequest`:**
```json
{ "name": "Growth", "description": "Acquisition & lifecycle", "tags": ["marketing"] }
```
**Response `201` — `TeamResponse`.**

### 11.3 Get one team

```
GET /organizations/{organization_id}/teams/{team_id}
```
**Gate:** **team editor** (owner/admin or an editor of this team). **Response `200` —
`TeamResponse`.** `404` if the team isn't in this org.

### 11.4 Update a team

```
PATCH /organizations/{organization_id}/teams/{team_id}
```
**Gate:** admin. All fields optional.

**Request — `UpdateTeamRequest`:**
```json
{ "name": "Growth EU", "description": "…", "tags": ["marketing","eu"], "archived": false }
```
Setting `archived: true` stamps a `recovery_deadline` of **now + 90 days**; setting it back
to `false` clears the deadline. **Response `200` — `TeamResponse`.**

### 11.5 Delete (archive) a team

```
DELETE /organizations/{organization_id}/teams/{team_id}   → 204
```
**Gate:** admin. **Soft delete:** if not already archived, the team is archived with a
90-day `recovery_deadline` (it is not hard-deleted). **Response `204`.**

> Archiving hides everything published to the team (personas/projects/chats fall back to
> private behaviour in list queries). Within the recovery window an admin can un-archive via
> [Update](#114-update-a-team).

---

## 12. Team editors

Editors are members granted edit rights on a specific team.

### 12.1 List a team's editors

```
GET /organizations/{organization_id}/teams/{team_id}/editors
```
**Gate:** team editor. **Response `200` — `PersonResponse[]`:**
```json
[ { "user_id": "auth0|member456", "name": "Sam Rivera", "email": "sam@acme.com" } ]
```

### 12.2 Add a team editor

```
POST /organizations/{organization_id}/teams/{team_id}/editors    → 201
```
**Gate:** admin. The target must already be an org member.

**Request — `AddTeamEditorRequest`:**
```json
{ "userId": "auth0|member456" }    // (alias)
```
**Response `201` — `PersonResponse`.**
**Errors:** `400` *"User is not a member of this organization"*; `404` team not found.

### 12.3 Remove a team editor

```
DELETE /organizations/{organization_id}/teams/{team_id}/editors/{member_id}   → 204
```
**Gate:** admin. **Response `204`.**

---

## 13. Projects & project members

Projects live under teams (the `Project` model carries `team_id` + `visibility`). The
Organizations module manages **who is a member of a project**; project CRUD itself lives in
the `/projects` router. Project membership is how editors move people between their team's
projects.

`PersonResponse` is the shape for project members too (see §12.1).

### 13.1 List project members

```
GET /organizations/{organization_id}/teams/{team_id}/projects/{project_id}/members
```
**Gate:** team editor. **Response `200` — `PersonResponse[]`.**
**Errors:** `404` if the team isn't in the org, or the project isn't in the team.

### 13.2 Add a project member

```
POST /organizations/{organization_id}/teams/{team_id}/projects/{project_id}/members   → 201
```
**Gate:** team editor. Target must be an org member.

**Request — `AddProjectMemberRequest`:**
```json
{ "userId": "auth0|member456" }    // (alias)
```
**Response `201` — `PersonResponse`.**
**Errors:** `400` not an org member; `404` team/project not found.

### 13.3 Remove a project member

```
DELETE /organizations/{organization_id}/teams/{team_id}/projects/{project_id}/members/{member_id}   → 204
```
**Gate:** team editor. **Response `204`.**

> A `ProjectMember` grant makes the user a **Member**-level actor affiliated with the parent
> team (they can see the team name, file connector requests, receive team chat shares) and
> gives them access to that one project's content. It does **not** make them a team editor.

---

## 14. Team connectors — approval facet

A team connector has **two facets** on one `TeamConnector` row:
1. **Approval** (this section) — request → `pending` → admin `approved`/`denied`. Only
   `approved` rows count on the chat path.
2. **Shared account** (next section) — attaching an org shared account so the whole team can
   execute on it.

`TeamConnectorResponse` shape:
```json
{
  "team_id": "11…",
  "connector_slug": "shopify",
  "status": "pending",                 // "pending" | "approved" | "denied"
  "requested_by_user_id": "auth0|member456",
  "requested_by_name": "Sam Rivera",
  "requested_by_email": "sam@acme.com",
  "note": "Need order data",
  "created_at": "…",
  "updated_at": "…"
}
```

### 14.1 List a team's connector requests

```
GET /organizations/{organization_id}/teams/{team_id}/connectors
```
**Gate:** member (affiliated with the team). **Response `200` — `TeamConnectorResponse[]`.**
**Errors:** `404` team not in org; `403` not affiliated.

### 14.2 Request a connector for the team

```
POST /organizations/{organization_id}/teams/{team_id}/connectors    → 201
```
**Gate:** member (affiliated). The slug must be in the **catalog**.

**Request — `RequestConnectorRequest`:**
```json
{ "slug": "shopify", "note": "Need order data" }
```
**Behaviour:**
- An **editor/member** request lands as `pending` and emails the owner.
- An **admin/owner** request is **auto-approved** (`approved`).
- A previously **denied** slug can be re-requested. A still-`pending`/`approved` slug 409s
  for non-admins.

**Response `201` — `TeamConnectorResponse`.**
**Errors:** `404` unknown connector / team; `403` slug not in catalog, or not affiliated;
`409` already pending/approved.

### 14.3 Approve / deny / reset a request

```
PATCH /organizations/{organization_id}/teams/{team_id}/connectors/{slug}
```
**Gate:** admin.

**Request — `SetConnectorStatusRequest`:**
```json
{ "status": "approved" }    // "approved" | "denied" | "pending"
```
Approving requires the slug to still be in the catalog (else `403`).
**Response `200` — `TeamConnectorResponse`.** `404` if the request row doesn't exist.

### 14.4 Remove a team connector

```
DELETE /organizations/{organization_id}/teams/{team_id}/connectors/{slug}   → 204
```
**Gate:** admin. Deletes the approval row entirely. **Response `204`.**

---

## 15. Team connections — shared-account facet

This is how an **approved** team connector gets an executable account so the whole team can
use it. Two layers exist here; read the deprecation note.

`list_team_connections` returns `ConnectorCatalogEntry[]` (the same shape as §8.1) showing,
per approved slug, whether a shared account is attached and which one.

### 15.1 List a team's connections

```
GET /organizations/{organization_id}/teams/{team_id}/connections
```
**Gate:** member (affiliated). Returns approved-and-catalog-enabled slugs with their
attachment state. Account-management fields are populated only when the caller can manage
the team (editor of it / admin). **Response `200` — `ConnectorCatalogEntry[]`.**

### 15.2 Attach a shared account to the team ✅ (the supported path)

```
PATCH /organizations/{organization_id}/teams/{team_id}/connections/{slug}
```
**Gate:** team editor (editor of this team, or admin). The slug must be **approved** for the
team **and** enabled in the catalog.

**Request — `UpdateConnectorRequest`:**
```json
{
  "sharedAccountId": "acc-77…",     // (alias) attach this org shared account to the team
  "permissions": [ { "slug": "SHOPIFY_PULL_ORDERS", "policy": "allow" } ]
}
```
- **`sharedAccountId`** — attaches the org shared account (must be the same connector and
  already `connected`). This is what makes the team able to execute.
- **`permissions`** — per-tool policy for the team (`allow` | `block` | `ask` | `allow_once`).
- **`credentials`** here is **rejected** with `400` — shared-account credentials are managed
  at the org level ([§9.3](#93-update-a-shared-account-label-identifier-status-credentials)).

**Response `200` — `ConnectorCatalogEntry`** (the refreshed entry).
**Errors:** `403` slug not approved / not enabled / not a team editor; `404` shared account
not found; `400` connector mismatch, *"Shared account is not connected yet"*, or credentials
supplied.

### 15.3 Unlink a team's connection

```
DELETE /organizations/{organization_id}/teams/{team_id}/connections/{slug}   → 204
```
**Gate:** team editor. Revokes the team's provider account / clears the attachment (the
**approval row stays** — re-attach later without re-approving). **Response `204`**; `404`
*"No linked team account for {slug}"* if nothing was attached.

### 15.4 ⚠️ Deprecated: the team link endpoint

```
POST /organizations/{organization_id}/teams/{team_id}/connections/{slug}/link
```
This **always returns `400`** now:

> *"Team links now attach an existing org shared account. Create the shared account at the
> organization level, then PATCH the team connection with `sharedAccountId`."*

**Do not use it.** The correct sequence is:
1. Admin creates the shared account ([§9.2](#92-create--start-linking-a-shared-account)) and
   completes the connection.
2. Admin/editor attaches it to the team with the PATCH in [§15.2](#152-attach-a-shared-account-to-the-team--the-supported-path).

---

## 16. Invites

Invites are **link-based**: an admin generates a link (optionally emailed); anyone holding
the link can preview and accept. Accepting makes the user an org member and a **team editor**
of the invite's team.

### 16.1 Create an invite

```
POST /organizations/{organization_id}/teams/{team_id}/invites    → 201
```
**Gate:** admin.

**Request — `InviteRequest`:**
```json
{
  "emails": ["new1@acme.com", "new2@acme.com"],
  "role": "member"     // optional: "admin" | "member" (NOT "owner"); default member
}
```
**Behaviour:** creates one invite (7-day TTL), emails the link to each address, audits
`invite_sent`. **Response `201` — `InviteResponse`:**
```json
{
  "id": "inv-aa…",
  "team_id": "11…",
  "recipient_emails": ["new1@acme.com", "new2@acme.com"],
  "expires_at": "2026-06-23T12:00:00",
  "invite_url": "https://app…/team-invite/inv-aa…"
}
```
**Errors:** `400` role `owner` rejected; `409` *"{email} is already an editor"* or
*"Invite already sent to {email}"*; `404` team not in org.

### 16.2 Preview an invite (PUBLIC — no auth)

```
GET /team-invite/{invite_id}
```
**Gate:** **none** — this is the only unauthenticated endpoint, so the landing page can render
before login.

**Response `200` — `InvitePreview`:**
```json
{
  "invite_id": "inv-aa…",
  "team_id": "11…",
  "team_name": "Growth",
  "invited_by_name": "Dana Lee",
  "expires_at": "2026-06-23T12:00:00"
}
```
**Errors:** `404` invite not found / inactive; `410` *"Invite has expired"*.

### 16.3 Accept an invite

```
POST /team-invite/{invite_id}/accept
```
**Gate:** authenticated. The accepting user becomes a member + team editor.

**Behaviour & exclusivity:** if the user has a **live personal plan**, accepting **cancels
the Stripe subscription immediately** (no refund) but **keeps the leftover personal credits**
as their own balance (spent before team credits). Any promotional **trial** is retired. If
the user already belongs to **another** org, accept **409s**.

**Response `200` — `TeamResponse`** (the team they joined).
**Errors:** `404` invite/team gone; `410` expired; `409` already in another org.

> **FE flow:** unauthenticated user opens `/team-invite/{id}` → preview → "Accept" routes
> through login → POST accept → land them in the team. If they have a personal plan, warn
> *before* accept that it will be canceled.

---

## 17. Credit overflow

A lightweight "we're running low" request from a team to its admins. Approving it **raises
the requester's member cap** by the granted amount.

`OverflowResponse` shape:
```json
{
  "id": "ovf-bb…",
  "team_id": "11…",
  "requested_by_user_id": "auth0|member456",
  "requested_by_name": "Sam Rivera",
  "requested_by_email": "sam@acme.com",
  "amount": 50.0,
  "note": "Big campaign week",
  "status": "open",            // "open" | "resolved"
  "created_at": "…"
}
```

### 17.1 Request overflow

```
POST /organizations/{organization_id}/teams/{team_id}/overflow
```
**Gate:** team editor. Emails the owner.

**Request — `OverflowRequestBody`:**
```json
{ "amount": 50.0, "note": "Big campaign week" }   // amount optional
```
**Response `200` — `OverflowResponse`** (`status: "open"`). `404` team not in org.

### 17.2 Approve overflow

```
POST /organizations/{organization_id}/overflow/{request_id}/approve
```
**Gate:** admin. Grants extra **assigned** credits to the requester for the current period
(internally raises their cap), then marks the request `resolved`.

**Request — `OverflowApproveBody`:**
```json
{ "amount": 50.0 }    // optional; defaults to the request's requested amount
```
**Response `200` — `OverflowResponse`** (`status: "resolved"`).
**Errors:** `404` request/member not found; `409` already resolved; `400` no positive amount
available to grant, or the pool lacks unassigned credits (bubbles up from the cap raise).

---

## 18. Slack channel mapping

Bind Slack channels (where the org's bot is installed) to projects, so messages route to the
right project.

### 18.1 List channels

```
GET /organizations/{organization_id}/slack/channels
```
**Gate:** admin. **Response `200` — `SlackChannelsResponse`:**
```json
{
  "team_id": "T0123",                 // Slack workspace id (not an org team)
  "team_name": "Acme HQ",
  "channels": [
    { "channel_id": "C01", "channel_name": "growth", "is_member": true,
      "project_id": "pr-33…", "project_title": "Q3 Launch" },
    { "channel_id": "C02", "channel_name": "random", "is_member": false,
      "project_id": null, "project_title": null }
  ]
}
```

### 18.2 Set / clear a channel→project mapping

```
PUT /organizations/{organization_id}/slack/channels/{channel_id}/mapping
```
**Gate:** admin.

**Request — `SetChannelMappingRequest`:**
```json
{ "projectId": "pr-33…" }    // (alias) or null to clear the mapping
```
**Response `200` — `SlackChannelItem`** (the updated channel row).

---

## 19. Chat shares

Share one of **your** chats with a same-org person, a whole team, or a project. Recipients
read the **live** chat in place; an **editable** share becomes the recipient's own copy only
when they fork it (their first message).

These endpoints are **chat-scoped** under `/chat-shares` (no org path param).

`ChatShareResponse` shape:
```json
{
  "id": "shr-cc…",
  "chat_id": "ch-44…",
  "mode": "read_only",                 // "read_only" | "editable"
  "shared_by_user_id": "auth0|owner123",
  "shared_by_name": "Dana Lee",
  "shared_by_email": "dana@acme.com",
  "target_user_id": "auth0|member456", // exactly one target set
  "target_user_name": "Sam Rivera",
  "target_user_email": "sam@acme.com",
  "target_team_id": null,
  "target_project_id": null,
  "created_at": "…"
}
```

### 19.1 Create a share

```
POST /chat-shares    → 201
```
**Gate:** authenticated **chat owner**. Provide **exactly one** of `userId` / `teamId` /
`projectId`.

**Request — `CreateChatShareRequest`:**
```json
{
  "chatId": "ch-44…",      // (alias) required
  "mode": "editable",      // "read_only" (default) | "editable"
  "userId": "auth0|member456"   // (alias) — OR "teamId" — OR "projectId" (exactly one)
}
```
**Validation:**
- Exactly one target, else `400`.
- Not the chat owner → `403`. Sharing to yourself → `400`.
- **User target:** recipient must share an org with you (`400` otherwise); duplicate share `409`.
- **Team target:** you must be able to act in the team (`403`); duplicate `409`.
- **Project target:** publishes the chat into the project (links it); `409` if already linked
  elsewhere or already shared there.

**Response `201` — `ChatShareResponse`.**

### 19.2 List shares you created for a chat

```
GET /chat-shares?chat_id={chat_id}
```
**Gate:** chat owner. **Response `200` — `ChatShareResponse[]`.** `403` if not the owner.

### 19.3 Shared with me

```
GET /chat-shares/shared-with-me
```
**Gate:** authenticated. Everything shared *to* you (directly, or via a team/project you're in).

**Response `200` — `SharedChatItem[]`:**
```json
[
  {
    "share_id": "shr-cc…",
    "chat_id": "ch-44…",
    "chat_title": "Pricing analysis",
    "mode": "editable",
    "shared_by": { "user_id": "auth0|owner123", "name": "Dana Lee", "email": "dana@acme.com" },
    "target_team_id": null,
    "target_project_id": null,
    "forked_chat_id": null,        // your copy's id once you've forked, else null
    "created_at": "…"
  }
]
```

### 19.4 View a shared chat (live, read-in-place)

```
GET /chat-shares/{share_id}
```
**Gate:** the sharer, the direct target, or anyone in the target team/project.

**Response `200` — `SharedChatView`:**
```json
{
  "share_id": "shr-cc…",
  "chat_id": "ch-44…",
  "chat_title": "Pricing analysis",
  "mode": "editable",
  "messages": [
    { "id": "m1", "input": "…", "output": "…", "reasoning": null,
      "model_name": "claude-opus-4-8", "created_at": "…" }
  ]
}
```
`403` if you're not a recipient; `404` if the chat was deleted.

### 19.5 Fork an editable share (materialize your copy)

```
POST /chat-shares/{share_id}/fork    → 201
```
**Gate:** recipient. Call this when the recipient sends their **first** message on an
editable share. **Idempotent** — re-forking returns the existing copy.

**Response `201` — `ForkResponse`:**
```json
{ "chat_id": "ch-99…", "chat_title": "Pricing analysis (copy)" }
```
**Errors:** `403` share is read-only; `400` you already own the original; `404` chat gone.

### 19.6 Revoke a share

```
DELETE /chat-shares/{share_id}   → 204
```
**Gate:** the **sharer** only. If it was a project share, the chat is unlinked from the
project. **Response `204`.** `403` if you didn't create it.

---

## 20. Visibility / publishing

Publishing a **chat**, **project**, or **persona** to a team is how content becomes visible
to that team's people. These live on their own routers but use the org permission model.

Shared request body — `SetVisibilityRequest`:
```json
{
  "visibility": "team",     // "private" | "team"
  "teamId": "11…",          // (alias) single-team form (chats & projects)
  "teamIds": ["11…","22…"]  // (alias) multi-team form (personas only; takes precedence)
}
```

**Common rules:** only the **owner** of the resource may change its visibility; publishing to
a team requires **editor rights on that team** (owner/admin or its editor). All three return
`204`.

### 20.1 Chat visibility

```
PATCH /chats/{chat_id}/visibility    → 204
```
Uses `teamId` (single team). `400` invalid visibility / missing `teamId` for team scope;
`403` not the owner or no publish rights; `404` chat not found.

### 20.2 Project visibility

```
PATCH /projects/{project_id}/visibility    → 204
```
Uses `teamId` (single team). Same rules as 20.1.

### 20.3 Persona visibility (multi-team)

```
PATCH /persona/{repo_id}/visibility    → 204
```
Accepts **`teamIds`** to deploy one persona to several teams at once (or `teamId` for one).
Members of any target team can then see and copy it. `400` if `team` scope with no teams;
`403` owner/publish checks; the first team is kept for the legacy single-team billing path.

> **Reverting:** send `{"visibility":"private"}` to unpublish (clears team links). For
> personas this also clears the full deploy set.

---

## 21. Audit log

```
GET /organizations/{organization_id}/audit?limit=100&offset=0
```
**Gate:** member — but **scope differs by role**: admins/owners see the **whole org's** log;
a plain member sees **only their own** actions (server-enforced, not a client filter).

**Query params:** `limit` (default 100), `offset` (default 0).

**Response `200` — `AuditEntry[]`:**
```json
[
  {
    "id": "aud-dd…",
    "actor_user_id": "auth0|admin1",
    "actor_name": "Dana Lee",
    "actor_email": "dana@acme.com",
    "action": "cap_changed",
    "target_type": "member",
    "target_id": "auth0|member456",
    "extra": { "previous_credit_cap": 100.0, "credit_cap": 150.0, "delta": 50.0 },
    "created_at": "…"
  }
]
```

**Common `action` values** the FE may want to render with friendly copy:
`organization_created`, `organization_updated`, `settings_updated`, `organization_deleted`,
`ownership_transferred`, `cap_changed`, `role_changed`, `member_removed`, `team_created`,
`team_updated`, `team_deleted`, `team_editor_added`, `team_editor_removed`,
`project_member_added`, `project_member_removed`, `invite_sent`, `invite_accepted`,
`connector_catalog_updated`, `connector_requested`, `connector_status_changed`,
`connector_removed`, `connector.account.added`, `team_connection_linked`,
`team_connection_unlinked`, `connector_personal_requested`,
`connector_personal_status_changed`, `overflow_requested`, `overflow_approved`,
`resource_published`, `chat_shared`, `plan_granted`.

---

## 22. End-to-end scenarios

### Scenario A — Stand up a team and onboard a member

1. **Create the org** (if not via Stripe): `POST /organizations` → you're the owner.
2. **Enable connectors:** `PUT /organizations/{id}/connectors/catalog` with the slugs you allow.
3. **Create a team:** `POST /organizations/{id}/teams`.
4. **Assign credits to yourself/others:** `PATCH …/members/{member_id}/cap`.
5. **Invite people:** `POST …/teams/{team_id}/invites` → share/await the `invite_url`.
6. Recipient: `GET /team-invite/{id}` (public) → `POST /team-invite/{id}/accept` → now a member + team editor.
7. **Make them an editor of another team** if needed: `POST …/teams/{team_id}/editors`.

### Scenario B — Connect a shared connector account end-to-end

1. Ensure the slug is in the catalog (Scenario A.2).
2. **Create the shared account** (admin): `POST …/connectors/{slug}/accounts` → open `redirect_url` for OAuth.
3. **Poll** `GET …/connectors/{slug}/accounts` until `connected: true`.
4. **Approve the connector for the team:** team requests via `POST …/teams/{team_id}/connectors`;
   admin approves via `PATCH …/teams/{team_id}/connectors/{slug}` (`approved`). (Admin requests auto-approve.)
5. **Attach the account to the team:** `PATCH …/teams/{team_id}/connections/{slug}` with `sharedAccountId`
   (+ optional `permissions`). *(Do not use the deprecated `/link` endpoint.)*
6. Team members can now execute the connector on team turns; their own personal connection
   wins first if they have one.

### Scenario C — A member runs low on credits

1. Member/editor: `POST …/teams/{team_id}/overflow` with an `amount`.
2. Admin sees it (and the email), approves: `POST …/overflow/{request_id}/approve` → the
   member's cap is raised, request `resolved`.
3. If the **pool** itself is exhausted, the cap raise 400s — the owner must top up / upgrade
   the Teams plan (billing flow, outside this module).

### Scenario D — Share a chat with a teammate

1. Owner of the chat: `POST /chat-shares` with `chatId` + `userId` (or `teamId`/`projectId`)
   and `mode`.
2. Recipient: `GET /chat-shares/shared-with-me` → `GET /chat-shares/{share_id}` to read live.
3. If `editable`, on the recipient's first reply call `POST /chat-shares/{share_id}/fork`
   to get their own copy (`forked_chat_id` then appears in their shared-with-me list).
4. Sharer can `DELETE /chat-shares/{share_id}` to revoke.

---

## 23. Appendix: enums & error catalog

### Enums

| Enum | Values | Where |
|---|---|---|
| `OrganizationRole` | `owner`, `admin`, `member` | member role |
| `InviteStatus` | `active`, `pending` | `MemberResponse.invite_status` |
| `OverflowStatus` | `open`, `resolved` | overflow |
| `ConnectorRequestStatus` | `pending`, `approved`, `denied` | team & personal connectors |
| `HitlThreshold` | `auto_proceed`, `ask_tier_3_plus`, `ask_everything` | settings |
| `PoolStatus` | `healthy`, `warning_95`, `paused` | plan / pool |
| `ChatShareMode` | `read_only`, `editable` | chat shares |
| `auth_mode` | `oauth2`, `api_key` | connector catalog |
| `AccountStatus` | `active`, `disabled`, `expired` | shared accounts |
| `AccountScope` | `personal`, `shared_team` | shared accounts (always `shared_team` here) |
| tool `policy` | `allow`, `block`, `ask`, `allow_once` | connector permissions |
| visibility | `private`, `team` | settings & publishing |

### Status-code catalog

| Code | Meaning in this module | Representative cases |
|---|---|---|
| `200` | OK | reads, updates |
| `201` | Created | org, team, invite, editor, project member, share, shared account, connector request |
| `204` | No content | deletes, visibility setters |
| `400` | Business-rule / validation failure | bad slug pattern, cap ≤ current, wrong delete confirm name, role `owner` via role/invite, >1 or 0 share targets, share to self, credentials on team connection, missing connector init fields, invalid visibility |
| `402` | Credits exhausted | a member's team turn when assigned credits are spent (chat path) |
| `403` | Permission denied | wrong role gate, slug not in catalog, slug not approved for team, not a share recipient, not the resource owner |
| `404` | Not found / not a member | unknown org/team/project/member/connector/account/request/share, or caller not a member |
| `409` | Conflict | slug taken, already in an org, duplicate invite/editor/share, connector already pending/approved, shared-account version mismatch, overflow already resolved |
| `410` | Gone | expired invite |
| `502` | Upstream provider failure | Composio/Nango handshake errors on shared-account create/update |

### Quick endpoint index

| # | Method & path | Gate |
|---|---|---|
| 1 | `GET /organizations` | auth |
| 2 | `POST /organizations` | auth (+exclusivity) |
| 3 | `GET /organizations/{id}` | member |
| 4 | `PATCH /organizations/{id}` | admin |
| 5 | `DELETE /organizations/{id}` | admin |
| 6 | `POST /organizations/{id}/transfer-owner` | owner |
| 7 | `GET /organizations/{id}/settings` | member |
| 8 | `PATCH /organizations/{id}/settings` | admin |
| 9 | `GET /organizations/{id}/plan` | member |
| 10 | `GET /organizations/{id}/plan/usage` | member |
| 11 | `GET /organizations/{id}/pool-status` | member |
| 12 | `GET /organizations/{id}/members` | member |
| 13 | `GET /organizations/{id}/members/admins` | member |
| 14 | `GET /organizations/{id}/members/regular` | member |
| 15 | `PATCH /organizations/{id}/members/{mid}/cap` | admin |
| 16 | `PATCH /organizations/{id}/members/{mid}/role` | admin |
| 17 | `DELETE /organizations/{id}/members/{mid}` | admin |
| 18 | `GET /organizations/{id}/connectors/catalog` | admin |
| 19 | `PUT /organizations/{id}/connectors/catalog` | admin |
| 20 | `GET /organizations/{id}/connectors/{slug}/used-by` | editor |
| 21 | `POST /organizations/{id}/connectors/{slug}/personal-request` | member |
| 22 | `GET /organizations/{id}/connectors/personal-requests` | admin |
| 23 | `PATCH /organizations/{id}/connectors/personal-requests/{rid}` | admin |
| 24 | `GET /organizations/{id}/connectors/{slug}/accounts` | editor |
| 25 | `POST /organizations/{id}/connectors/{slug}/accounts` | admin |
| 26 | `PATCH /organizations/{id}/connectors/accounts/{aid}` | admin |
| 27 | `DELETE /organizations/{id}/connectors/accounts/{aid}` | admin |
| 28 | `GET /organizations/{id}/slack/channels` | admin |
| 29 | `PUT /organizations/{id}/slack/channels/{cid}/mapping` | admin |
| 30 | `GET /organizations/{id}/teams` | member |
| 31 | `POST /organizations/{id}/teams` | admin |
| 32 | `GET /organizations/{id}/teams/{tid}` | team editor |
| 33 | `PATCH /organizations/{id}/teams/{tid}` | admin |
| 34 | `DELETE /organizations/{id}/teams/{tid}` | admin |
| 35 | `GET /organizations/{id}/teams/{tid}/editors` | team editor |
| 36 | `POST /organizations/{id}/teams/{tid}/editors` | admin |
| 37 | `DELETE /organizations/{id}/teams/{tid}/editors/{mid}` | admin |
| 38 | `GET …/teams/{tid}/projects/{pid}/members` | team editor |
| 39 | `POST …/teams/{tid}/projects/{pid}/members` | team editor |
| 40 | `DELETE …/teams/{tid}/projects/{pid}/members/{mid}` | team editor |
| 41 | `GET …/teams/{tid}/connectors` | member (affiliated) |
| 42 | `POST …/teams/{tid}/connectors` | member (affiliated) |
| 43 | `PATCH …/teams/{tid}/connectors/{slug}` | admin |
| 44 | `DELETE …/teams/{tid}/connectors/{slug}` | admin |
| 45 | `GET …/teams/{tid}/connections` | member (affiliated) |
| 46 | `POST …/teams/{tid}/connections/{slug}/link` | team editor — **deprecated (400)** |
| 47 | `PATCH …/teams/{tid}/connections/{slug}` | team editor |
| 48 | `DELETE …/teams/{tid}/connections/{slug}` | team editor |
| 49 | `POST …/teams/{tid}/invites` | admin |
| 50 | `GET /team-invite/{iid}` | **public** |
| 51 | `POST /team-invite/{iid}/accept` | auth |
| 52 | `POST …/teams/{tid}/overflow` | team editor |
| 53 | `POST /organizations/{id}/overflow/{rid}/approve` | admin |
| 54 | `GET /organizations/{id}/audit` | member (self-scoped) |
| 55 | `POST /chat-shares` | auth (chat owner) |
| 56 | `GET /chat-shares?chat_id=` | auth (chat owner) |
| 57 | `GET /chat-shares/shared-with-me` | auth |
| 58 | `GET /chat-shares/{sid}` | auth (recipient) |
| 59 | `POST /chat-shares/{sid}/fork` | auth (recipient) |
| 60 | `DELETE /chat-shares/{sid}` | auth (sharer) |
| 61 | `PATCH /chats/{cid}/visibility` | resource owner + publish |
| 62 | `PATCH /projects/{pid}/visibility` | resource owner + publish |
| 63 | `PATCH /persona/{rid}/visibility` | resource owner + publish |

---

*Generated from the `services/organizations` module (router, schemas, service, roles,
dependencies, models) plus the connector/slack schemas and the visibility endpoints on the
chat/persona/projects routers. If an endpoint's behaviour here ever disagrees with the code,
the code wins — re-check `services/organizations/`.*
