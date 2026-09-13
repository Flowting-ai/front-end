# Frontend ↔ Backend Requirements — v1.5

**Status:** Complete (2026-08-27), revised same day after confirming the actual target architecture directly (Superhuman Docs "New Architecture" spec — flat Workspace, Projects replace Teams, connections workspace-wide). All Team-scoped rows below are marked 🟡 *transitional* (works against today's backend, not something to extend) rather than 🟢 existing-and-fine. The closing "Summary" states the two concrete new endpoints that replace every team-scoped requirement in this doc at once.

**How to read these tables:**
- **Frontend — Variables**: every field/value a screen needs, and whether the frontend already has a typed place for it or needs one added.
- **Backend — Endpoints & Architecture**: every route a screen depends on, and whether it already exists as-is, already exists but needs a field/behavior change, or needs to be built from scratch.
- **Status legend**: 🟢 Existing, works as-is · 🟡 Existing, needs a change · 🔴 New — doesn't exist yet.

---

# 1. Connectors

Full detail and rationale: `docs v1.5/connectors-v1.5-migration-plan.md` (§0a, plus its later correction, are both required reading before touching any of this). Short version: connector sharing is *currently* scoped to a **Team** sub-entity within an org, not the org directly — the front-end's original schema had that wrong. But per the org's target-architecture spec, Team is being retired entirely and connections are meant to be **workspace-wide**, so treat everything below marked "Team-dependent" as describing today's transitional backend state, not something to build more UI around.

## 1a. Frontend — Variables

Canonical shape: `UnifiedAccount`/`UnifiedConnectorSummary` in `src/lib/connectorsUnified.ts` — the one place old and new backend shapes get reconciled. Everything below is either already a field on that type or is called out as missing.

| Variable | Type | Used on | Status | Notes |
|---|---|---|---|---|
| `UnifiedConnectorSummary.slug` | string | Connections, ConnectorDetail | 🟢 Existing | `ConnectorCatalogEntry.slug` |
| `.name` | string | all screens | 🟢 Existing | `display_name` |
| `.description` | string | ConnectorDetail | 🟢 Existing | `description` |
| `.logoUrl` | string\|null | catalog cards | 🟢 Existing | `logo_url` |
| `.authMode` | `'oauth2'\|'api_key'` | Setup | 🟢 Existing | `auth_mode` |
| `.apiKeyFields` | `ApiKeyField[]` | Setup credential form | 🟢 Existing | `api_key_fields` |
| `.tools` | `ConnectorTool[]` | Permissions tab (private only) | 🟢 Existing | `tools` |
| `.accounts` | `UnifiedAccount[]` | everywhere | 🟢 Existing | built from `account_options` |
| `UnifiedAccount.id` | string | account rows | 🟡 Synthesized | `personal:{slug}` for private (no real id exists for a personal link); real `shared_account_id` for shared |
| `.nickname` | string | AccountRow, Settings tab | 🟢 Existing | `account_label` |
| `.email` | string | AccountRow | 🟢 Existing | `account_identifier` |
| `.visibility` | `'shared'\|'private'` | everywhere | 🟢 Existing | derived from `scope` (`'personal'`\|`'shared_team'`) |
| `.status` | `'connected'\|'reconnect_required'` | everywhere | 🟢 Existing | derived from `connected`+`status` |
| `.permission` | `'always'\|'ask'\|'blocked'\|'custom'` | AccountRow, Permissions tab | 🟡 Partial | real for private (`entry.tools`); always `'custom'` for shared — **no backend storage exists for shared-account tool permissions at all** (Gap #11) |
| `.canManage` | boolean | Manage/Settings/Remove gating | 🟢 Existing | `can_manage` (shared) / always `true` (private) |
| `.ownerId` | string\|undefined | private-account display | 🟢 Existing | `linked_by_user_id` |
| `.teamNames` | string[] | AccountDetail subtitle | 🟡 Existing, to be removed | `team_names` — correct against today's backend, but per the target architecture there's no Team to name; this field (and the subtitle line that reads it) should disappear once sharing is workspace-wide, not be kept around as extra metadata. |
| **`teamId` (the team a Shared account targets)** | string | Setup's Shared path | 🟡 **Temporary, to be deleted** | `src/lib/useDefaultTeam.ts` resolves this today only because the current backend still requires it. **Target requirement: this field shouldn't exist at all.** Once connections are workspace-wide, `.visibility` alone (`'shared'` = visible to the whole workspace, gated to Owner/Admin per the role matrix) is sufficient — no id to resolve, no picker to build, no "zero or multiple teams" edge case to handle. |
| **MCP endpoint URL** | string | ConnectorDetail's endpoint row (S19) | 🔴 **New — not built** | No backend field exists (Gap #1); the row was omitted entirely rather than faked. |
| **Dependency detail** (`"used by N agents · M automations"`) | structured list | Remove modal (S15) | 🔴 **New — not built** | Backend's `getConnectorUsedBy` only returns a coarse yes/no per team (Gap #3); shipped as a generic "may be in use" warning instead. |
| **Tool group** (`'read-only'\|'write'`) | enum | Permissions tab grouping | 🟡 **Client-side heuristic** | No backend field (Gap #4); `AccountDetailView.tsx`'s `toolGroupOf()` keyword-matches the tool slug instead — a real field would remove this maintenance burden. |
| **Editorial catalog tags** (Recommended/Trending/New) | enum | Catalog Type filter | 🟡 **Approximated** | No curated field exists (Gap #12); backed by `catalog_metadata.featured_weight`, a weak proxy. |

## 1b. Backend — Endpoints & Architecture Changes

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/connectors` | GET | 🟢 Existing | Personal catalog. **Intentionally filtered** per viewer (`org_enabled \| team_approved \| personal_approved \| personally_linked`) — not a bug, by-design allowlist (Gap #15 in the connectors doc). |
| `/connectors/{slug}` | GET | 🟢 Existing | Long-tail tool-list backfill. |
| `/connectors/{slug}/link` | POST | 🟢 Existing | Personal OAuth/API-key connect. |
| `/connectors/{slug}` | PATCH | 🟢 Existing | Personal tool-permission + credential updates. **No `accountLabel` field** — private accounts can't be renamed post-connect (Gap #13). |
| `/connectors/{slug}` | DELETE | 🟢 Existing | Personal disconnect. |
| `/organizations/{id}/connectors/catalog` | GET | 🟢 Existing | Full, unfiltered catalog — admin-only. Now wired into the frontend (was dropped, then restored same day — Gap #15). |
| `/organizations/{id}/connectors/{slug}/accounts` | GET/POST | 🟡 Existing, transitional shape | Shared-account list/create — works today, but see the target requirement row below: creation shouldn't need a prior team-approval step. |
| `/organizations/{id}/connectors/accounts/{id}` | PATCH/DELETE | 🟢 Existing | Shared-account update/remove. **No `permissions` field on PATCH** — shared accounts have zero tool-permission storage (Gap #11, highest severity alongside Gap #2). This gap is independent of the Team question — fix it either way. |
| `/organizations/{id}/connectors/{slug}/used-by` | GET | 🟡 Needs a change | Returns one coarse `surface:"team"` entry, never a real per-agent/automation breakdown (Gap #3). Should become `surface:"workspace"` once the migration lands. |
| `/organizations/{id}/teams` | GET | 🟡 Existing, to be removed | Used by `useDefaultTeam` only because today's backend still requires a team. Delete this call along with `useDefaultTeam` once the target requirement below ships. |
| `/organizations/{id}/teams/{teamId}/connectors` | GET/POST | 🟡 Existing, to be removed | Today's approval gate. Frontend only just got this call correct (was hitting a 404'ing org-level route before today's fix) — don't invest further in it; it's slated for removal, not extension. |
| `/organizations/{id}/teams/{teamId}/connectors/{slug}` | PATCH/DELETE | 🟡 Existing, to be removed | Same. |
| **🎯 Target requirement — workspace-wide connector sharing** (replaces the 4 team-scoped rows above) | POST/PATCH `/organizations/{id}/connectors/{slug}/accounts` (or equivalent) | 🔴 **New — the actual fix** | Per the architecture's own invariant ("Connections are workspace-wide — never scoped by project or member") and role matrix (Admin/Owner have "connections" as a plain capability, no separate approval workflow mentioned), the target shape is: an Owner or Admin creates a shared account directly, it's immediately visible workspace-wide — **no team, no request/approve step at all.** This one endpoint replaces `/teams` (team resolution), `/teams/{id}/connectors` (approval request), and `/teams/{id}/connectors/{slug}` (approval decision) simultaneously. Also resolves Gap #7 (no approval-queue screen) by removing the need for one, not by building one. |
| **Account visibility PATCH** (flip an existing account between shared/private) | — | 🔴 **New — doesn't exist** | Gap #2, highest severity, independent of the Team question. `scope` is immutable once set; Account Access tab's "Save" is permanently disabled with an explanation rather than faking it. Once accounts are workspace-scoped (not team-scoped), this becomes a simple `scope` field flip — no team re-resolution needed either. |
| **Shared-account OAuth re-auth in place** | — | 🔴 **New — doesn't exist** | Gap #14. Only `credentials` PATCH works for `api_key` shared accounts; OAuth shared accounts can only be deleted and recreated. |
| **Custom connector creation** | — | 🔴 **New — doesn't exist** | Gap #1. The story's own "Add custom connector" is an unfinished placeholder in the source design too — not just a backend gap. |
| **Tool grouping field** (`ToolEntry.group` or similar) | — | 🔴 **New — doesn't exist** | Gap #4. Currently a hand-maintained frontend keyword heuristic. |
| **Personal account rename** (`accountLabel` on `PATCH /connectors/{slug}`) | — | 🔴 **New field on existing endpoint** | Gap #13. Small, mechanical addition — the shared-account equivalent already exists. |

---

# 2. Settings Pages

Full detail: `docs v1.5/settings-v1.5-pages-audit.md`. §0 of that doc: **the Teams page was deleted** on a false "no backend route" premise — the backend route is real and live *today*, but per the target-architecture spec (see the closing Summary), Team is being retired in favor of workspace-wide connections and Project-based org structure. So the fix isn't rebuilding the Teams page — it's finishing that migration and removing the one dead `/settings/teams` link that still points at it.

## 2a. Frontend — Variables (by page)

### Account (`/settings/account`)
| Variable | Status | Notes |
|---|---|---|
| `first_name`, `last_name` | 🟢 Existing | `PATCH /users/me` |
| `role` (display only) | 🟢 Existing | read-only, no edit surface |
| `email` (display only) | 🟢 Existing | read-only |
| `profile_picture` | 🟡 Existing field, wrong shape | Backend field is a plain URL string; frontend sends a base64 data-URL disguised as one — works, but no real file-upload path exists |
| `ai_tone` (Style) | 🟢 Existing | commits immediately |
| **Default Model tier** | 🔴 New — no backend field | `localStorage`-only today, doesn't feed any real chat behavior |
| **Delete-account confirmation** | 🔴 New — no UI, and underlying delete is soft-only | See backend row below |

### Usage — personal (`/settings/usage`)
| Variable | Status | Notes |
|---|---|---|
| `user.usage.by_category` (`chat`/`persona`/`workflow`) | 🟢 Existing | remapped to Slackbot/Tasks/Chat labels cosmetically |
| `user.currentPeriodEnd` / `nextBillingDate` | 🟢 Existing | reset-date display |
| Per-category cap | 🔴 Doesn't exist | "Monthly Limits" heading implies one; bars actually show share of the *overall* total |

### General (`/settings/general`)
| Variable | Status | Notes |
|---|---|---|
| `name`, `slug`, `logo` (org identity) | 🟢 Existing | `PATCH /organizations/{id}` (multipart for logo) |
| `org_instructions` | 🟢 Existing | `PATCH /organizations/{id}/settings` |
| `allowed_email_domains` | 🟢 Existing | same endpoint |
| `default_chat_visibility`, `default_persona_visibility` | 🟢 Existing field, 🔴 UI disabled | Both state + save handler are built; card is statically `{false && ...}`'d off with no explanation |
| **Archive-workspace flag** | 🔴 New — no endpoint | Button is enabled, stub handler only |
| Ownership transfer target user id | 🟢 Existing (`transferOrgOwnership`) | Handler works; **no button renders it** — pure frontend wiring gap, zero backend work needed |

### Members (`/settings/members`)
| Variable | Status | Notes |
|---|---|---|
| Member list, role, invite status | 🟢 Existing | `GET /organizations/{id}/members` |
| `role` (set) | 🟢 Existing | `PATCH .../members/{id}/role` |
| Invite `emails`, `role`, `project_id` | 🟡 Existing, wrong scope | Real endpoint today is `POST /organizations/{id}/teams/{teamId}/invites` — team-scoped. **Target requirement**: this should be a workspace-level invite (`POST /organizations/{id}/invites`) with an *optional* `project_id` — which the UI already models correctly (`InviteModal`'s "Project access (optional)" picker only shows for Member invites); it's the backend endpoint that's scoped one level too narrow relative to where the architecture is headed. |
| Revoke invite | 🟡 Existing, wrong scope | `DELETE .../teams/{teamId}/invites/{id}` today — same target-scope correction as above, should be `DELETE /organizations/{id}/invites/{id}` |
| `credit_cap` (per member) | 🟢 Existing (`PATCH .../members/{id}/cap`) | Not currently exposed in the Members table UI at all (present on the backend model, unused on this page) |

### Plans & Billing (`/settings/plans`)
| Variable | Status | Notes |
|---|---|---|
| Plan/pool totals, remaining, projected invoice | 🟢 Existing | `GET /organizations/{id}/plan` |
| `pool_cap` (Enterprise overage limit) | 🟢 Existing | `PATCH .../plan/pool-cap`, owner-only |
| `adminBillingPerms` (top-up/payment/invoices toggles) | 🟢 Existing | `PATCH .../settings` |
| Payment method, invoices | 🟢 Existing | via `/stripe/billing`, `/stripe/portal` |
| **Auto-recharge threshold** | 🔴 New — no backend field | UI captures it, never sent anywhere |
| **Usage/invoice CSV export** | 🔴 New — no endpoint | Invoice PDFs are Stripe-hosted links only |

### Usage/Analytics — workspace (`/settings/analytics`)
| Variable | Status | Notes |
|---|---|---|
| Org credit totals, `by_team` breakdown | 🟡 Existing, breakdown dimension will need to change | `GET .../plan/usage` — the totals are fine (workspace-level already, matches "billing lives at the workspace level only"); the `by_team` split specifically will need to become `by_member` or `by_project` once Team is retired, since there'll be no team to group by. |
| **Per-feature daily time series** | 🔴 New — no backend field | Chart is client-fabricated from the real total + a hardcoded 68/20/12 split + deterministic noise — clearly commented in source, invisible on the rendered page |
| **"Utilisation %" stat** | 🟡 Approximated | No direct backend field; computed as share of members who spent any credit |

### Help & Legal (`/settings/help`)
| Variable | Status | Notes |
|---|---|---|
| Static legal links | 🟢 Existing | no backend involvement |
| Help Center / Contact Support destination | 🔴 New — rendered disabled, no URL | |
| App version string | 🟡 Hardcoded | `"v1.1"` in source, not build metadata |

### Teams — the page that doesn't exist (and, per the target architecture, shouldn't be rebuilt)
| Variable | Status | Notes |
|---|---|---|
| Team `name`, `description`, `tags` | 🟢 Backend exists, transitional | `POST/PATCH /organizations/{id}/teams` are real and live today, but Team is being retired per the target-architecture spec — not something to build new UI against. |
| Team roster / editors | 🟢 Backend exists, transitional | Same caveat. |
| **The `/settings/teams` link** | 🔴 **Bug — remove it, don't rebuild the page** | `LeftSidebar.tsx` links to a route with no page (404). The fix is deleting the link, not rebuilding a Teams settings page — see the closing Summary. |

## 2b. Backend — Endpoints & Architecture Changes

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/users/me` | GET/PATCH | 🟢 Existing | Profile read/update |
| `/users/me/onboarding` | PATCH | 🟢 Existing | see Onboarding section |
| `/users/me` | DELETE | 🟡 Needs a change | Soft-deactivate only (`active=False`) — no real purge/anonymization |
| **Personal avatar file upload** | — | 🔴 New | Currently a string-URL field repurposed for base64 data |
| **Password change** | — | ⚪ Not applicable | Auth0-managed by design, not a gap |
| `/organizations/{id}` | PATCH | 🟢 Existing | Multipart, includes logo file — this one's done right |
| `/organizations/{id}/settings` | GET/PATCH | 🟢 Existing | |
| `/organizations/{id}/transfer-owner` | POST | 🟢 Existing | Owner-only; frontend just needs a button |
| **Archive organization** | — | 🔴 New | No endpoint at all |
| `/organizations/{id}/members` | GET | 🟢 Existing | |
| `/organizations/{id}/members/{id}/role` | PATCH | 🟢 Existing | |
| `/organizations/{id}/members/{id}` | DELETE | 🟢 Existing | |
| `/organizations/{id}/members/{id}/cap` | PATCH | 🟢 Existing | Unused by current Members UI |
| `/organizations/{id}/teams` | GET/POST | 🟡 Existing, not a target | **No frontend page calls these directly** (only `useDefaultTeam`, transitionally). Per the architecture, Team CRUD isn't something to build UI for — see §0's correction. |
| `/organizations/{id}/teams/{id}` | GET/PATCH/DELETE | 🟡 Existing, not a target | Same |
| `/organizations/{id}/teams/{id}/editors` | GET/POST/PATCH/DELETE | 🟡 Existing, not a target | Same |
| `/organizations/{id}/teams/{id}/invites` | POST/DELETE | 🟡 Existing, wrong scope | Blocked without a team to invite into today. **Target requirement: `POST/DELETE /organizations/{id}/invites`** (workspace-scoped, optional `project_id`) — see the Members row in §2a; this is the one concrete new endpoint this section actually needs built. |
| `/organizations/{id}/plan` | GET | 🟢 Existing | |
| `/organizations/{id}/plan/pool-cap` | PATCH | 🟢 Existing | Owner-only |
| `/organizations/{id}/plan/usage` | GET | 🟢 Existing | Per-team breakdown only, no per-feature series |
| `/organizations/{id}/pool-status` | GET | 🟢 Existing | |
| `/organizations/{id}/plan/enterprise-usage` | GET | 🟢 Existing | Paginated JSON only |
| `/organizations/{id}/audit` | GET | 🟢 Existing | No role-aware filtering server-side (frontend scopes it client-side); no upper `limit` clamp unlike enterprise-usage |
| `/stripe/checkout`, `/topup`, `/topup/charge`, `/trial`, `/subscription`, `/portal`, `/billing` | various | 🟢 Existing | Full Stripe integration, personal-scoped |
| **Auto-recharge threshold field** | — | 🔴 New | On billing/plan model |
| **Usage/activity CSV or PDF export** | — | 🔴 New | No route on any usage/audit endpoint |
| **Notification preferences** | — | 🔴 New — entire domain | Confirmed zero backend support by full-repo grep; frontend page exists (orphaned) with nothing to save to |
| **Theme/preference persistence** | — | 🔴 New — entire domain | Same — frontend page exists (orphaned), no backend field |

---

# 3. Onboarding

Full detail: `docs v1.5/onboarding-v1.5-flow.md`. **One finding here is a live, currently-shipping bug, not just a gap**: the B1/B2 pre-login invite landing page (`src/app/invite/[inviteId]/page.tsx`) calls `GET /team-invite/{id}` while the visitor is logged out — that's the entire point of the page — but the backend route requires `get_current_user` with no anonymous path. A logged-out request 401s/403s before ever reaching the handler. This needs a backend fix (either a real anonymous preview route, or relaxing this one's auth), not a frontend one.

## 3a. Frontend — Variables (by screen)

### Setup — Slack/Souvenir choice (`onboarding/setup`)
No fields — pure choice screen, two client-only actions (Slack redirect via `getSlackInstallUrl()`, or `push` to the next step).

### Workspace name + size (`onboarding/workspace`)
| Variable | Status | Notes |
|---|---|---|
| `workspaceName` | 🟢 Existing | sent as `name` via `createOrganization`/`updateOrg` |
| `workspaceSize` (4 UI buckets: `just_me`/`1-5`/`5-10`/`10+`) | 🟡 Partially wired | Only reaches the backend as a 3-value `role_fit` enum (`just_me`/`small_team`/`large_team`) via `deriveRoleFitFromSize()` — the org's own `company_size` field (which the backend already accepts) is never actually set |

### Profile (`onboarding/profile`)
| Variable | Status | Notes |
|---|---|---|
| `firstName`, `lastName` | 🟢 Existing | `PATCH /users/me` |
| `role` (7 options: Founder/Marketer/Designer/Engineer/Operator/Student-Researcher/Other) | 🟢 Existing | `user_role` on `updateOnboarding`, translated through `ROLE_API_MAP` |
| **`ai_tone`** | 🔴 **Missing from this flow entirely** | The old flow had a dedicated `/onboarding/tone` step; v1.5 has none. See backend row below — this isn't just an unused field, it silently breaks the backend's own onboarding-completion heuristic. |

### Invite (`onboarding/invite`)
| Variable | Status | Notes |
|---|---|---|
| `emails` (local `useState`, parsed from a textarea) | 🟡 Works, but disconnected from context | `WorkspaceOnboardingData.inviteEmails` is tracked in the shared context and never read or written by this screen — dead field |
| `onboarding_completed: true` | 🟢 Existing | the actual gating flag; fires on both Skip and Next |

### Join — A2 "detected workspace" (`onboarding/join`)
| Variable | Status | Notes |
|---|---|---|
| `inviteId` (URL param) | 🟢 Existing | feeds `getTeamInviteOnboarding` |
| **Domain-based match** (no invite link, pure email-domain join) | 🔴 **New — no backend support** | A2 today works *only* via an explicit invite link; there is no endpoint that takes an email/domain and returns a matching org |

### Invite landing — B1/B2 (`invite/[inviteId]`)
| Variable | Status | Notes |
|---|---|---|
| `inviteId` (route param) | 🟡 Existing endpoint, broken for this use case | See the auth bug above |
| `existingAccount` query param (decides Sign-in vs. Sign-up copy) | 🔴 **New — entirely unbacked** | No field anywhere in `InvitePreview` (20 fields, checked directly) indicates whether the invited email already has an account; the frontend param has no real data source today |

### Shared context (`workspace-onboarding-context.tsx`)
| Field | Status | Notes |
|---|---|---|
| `workspaceName`, `workspaceSize`, `firstName`, `lastName`, `role`, `entryFlow` | 🟢 Used | |
| `inviteEmails` | 🔴 Dead | tracked but never read/written by the actual invite screen |

## 3b. Backend — Endpoints & Architecture Changes

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `/users/me` | PATCH | 🟢 Existing | name fields |
| `/users/me/onboarding` | PATCH | 🟡 **Needs a change** | Two real issues: (1) request field is `onboarding_completed`, response field is `completed` — a naming mismatch that costs nothing to keep but is worth knowing about; (2) the backend's own server-side auto-complete logic (`repository.py`) requires `user_role` **and** `ai_tone` **and** `role_fit` all present — but no v1.5 screen ever sets `ai_tone`, so that auto-complete path can never fire for anyone going through the new flow. Either add an `ai_tone` step back, or change the backend heuristic to not require it. |
| `/organizations` | POST | 🟡 **Underused, not broken** | Backend already accepts `allowed_email_domains` and `company_size` at creation time — the frontend's `createOrganization()` doesn't expose either param, so workspace size never reaches the org record (only the disconnected `role_fit` enum does), and A2's domain-based joining has no domain value to match against even if a matching endpoint existed. |
| `/team-invite/{id}` | GET | 🔴 **Needs a change — currently broken for its actual use case** | Requires `get_current_user` (`HTTPBearer(auto_error=True)`) — rejects any request with no `Authorization` header before the handler runs. B1/B2's whole purpose is serving this to a logged-out visitor. Needs either a genuinely anonymous variant or a relaxed/optional auth dependency. |
| `/team-invite/{id}/accept` | POST | 🟢 Existing | Returns `TeamResponse`, not `OrganizationResponse` as a frontend code comment guesses — harmless since the frontend discards the body either way, but worth correcting the comment. |
| **Workspace-level invite endpoint** (`POST /organizations/{id}/invites`) | — | 🔴 **New — the actual fix, not just a frontend bug** | `inviteMembers()` in `lib/api/teams.ts` already POSTs here — the backend just needs to build it. This isn't a case of "frontend called the wrong thing by mistake": a flat, workspace-scoped invite endpoint (optional `project_id`, no `teamId`) is exactly what the target architecture calls for, and it's the *same* endpoint the Settings Members page needs (§2b) — one build fixes both call sites. Don't reach for option (b) from the pre-correction version of this row ("pass a teamId") — that moves the wrong direction. |
| **Domain-matching endpoint** (email/domain → candidate org) | — | 🔴 **New — doesn't exist** | Needed for A2's join-by-domain concept to work without requiring an explicit invite link every time. |
| **"Does this email already have an account" signal** | — | 🔴 **New — doesn't exist** | Needed to decide B1 vs. B2 copy at invite-link-generation time. No field on `InvitePreview` or anywhere else in the invite flow answers this today. |
| **Workspace/team terminology rename** | — | ⚪ Confirmed unresolved, informational | `role_fit`'s backing enum is a Python class literally named `TeamSizeType` with values `small_team`/`large_team` — the "team → workspace" rename discussed in the onboarding doc has not happened anywhere in the backend; it is a frontend copy-layer relabeling only, today. Worth an explicit decision (rename backend enums, or accept the permanent copy/data mismatch) rather than leaving it implicit. |

---

## Summary — what's actually blocking, across all three areas

**Corrected 2026-08-27, after this doc was first written.** The original version of this summary recommended rebuilding a Team-creation UI. That was wrong — it assumed the current team-scoped backend was the thing to build toward. It isn't. The org's own target-architecture spec (Superhuman Docs "New Architecture" overview — Workspace Model v2 / Project & Chat Model / Billing & Credits, read directly) states the intended model outright: **one flat Workspace, Projects replace Teams as the sole organizing unit, and "Connections are workspace-wide — never scoped by project or member."** There is no Team entity in the target architecture at all.

So the real, corrected picture: the same dependency on Team shows up in all three sections above — Connectors' "Shared" visibility can only auto-resolve when exactly one team already exists (§1a), the Teams settings page 404s while still being linked (§2a), and onboarding's invite flow calls a team-scoped endpoint (§3b) — but that's not three symptoms of "nobody built team-management UI." It's three symptoms of **one unfinished backend migration**: `services/connectors` (and org invites) still depend on the Team model the rest of the architecture doc says is being retired in favor of workspace-wide connections and Project-based invites. Building more Team UI would move the product away from its own stated direction, not toward it.

### The concrete backend requirement (replaces "rebuild Teams" everywhere above)

Two new endpoints, built once, unblock all three sections simultaneously:

1. **Workspace-wide connector sharing** — `POST`/`PATCH` on `/organizations/{id}/connectors/{slug}/accounts` (or equivalent), no `team_id` anywhere in the request or response. An Owner or Admin creates a shared account and it's immediately visible workspace-wide — no approval step (the architecture's role matrix gives Owner/Admin "connections" as a plain capability, with no separate request/approve workflow described). This one endpoint replaces the `/teams`, `/teams/{id}/connectors`, and `/teams/{id}/connectors/{slug}` calls in §1b entirely. Once it exists: delete `useDefaultTeam.ts`, delete the `teamId` threading through `SetupModal`/`useConnectorSetupFlow`, drop `.teamNames` from `UnifiedAccount`.
2. **Workspace-level invites** — `POST`/`DELETE` on `/organizations/{id}/invites`, with an optional `project_id` (no `teamId`). Replaces `/teams/{teamId}/invites` in both §2b (Members page) and §3b (onboarding) — the frontend's `inviteMembers()` and `InviteModal` already assume roughly this shape (project access is already modeled as optional), the backend just needs to build the flat route.

**Independently of both of those**, three things are plain bugs today, worth fixing regardless of migration timing:
1. Remove the dead `/settings/teams` link from `LeftSidebar.tsx` — it points at a route with no page, a live 404 today.
2. Fix `GET /team-invite/{id}`'s auth requirement so the B1/B2 pre-login landing page can actually call it while logged out, as intended.
3. Backend's `PATCH /users/me/onboarding` completion heuristic requires `ai_tone`, which no v1.5 onboarding screen collects — either add the field back to a screen or drop it from the heuristic (§3b).

