# FE → BE Handover — New API Requirements (v1.5)

**Date:** 2026-08-27
**Purpose:** Single handover doc for backend — what the current v1.5 front-end looks like for Onboarding, Settings, and Connectors, and the clean list of endpoints that don't exist yet (or exist but need a contract change) to fully back it.
**Source material:** this doc summarizes and re-packages three existing audits for a BE-facing handoff — read them for full rationale, code paths, and edge cases:
- `docs v1.5/onboarding-v1.5-flow.md`
- `docs v1.5/settings-v1.5-pages-audit.md`
- `docs v1.5/connectors-v1.5-migration-plan.md`
- `docs v1.5/frontend-backend-requirements.md` (the full variable-by-variable / endpoint-by-endpoint audit this doc distills)

**Architecture note (read before scoping any of the below):** the org's target architecture (Superhuman Docs "New Architecture" spec) is a **flat Workspace** with **Projects replacing Teams** entirely, and **"Connections are workspace-wide — never scoped by project or member."** The current backend still scopes connector sharing and invites to a `Team` sub-entity. Several rows below exist only because of that unfinished migration — flagged inline as 🎯 **Target fix**, since building one of these two endpoints resolves multiple rows at once rather than patching each symptom separately.

---

## Reference links

| Area | Link |
|---|---|
| Onboarding — Figma | https://www.figma.com/design/9pi6hn4kTeOv11dV9W7E3u/Onboarding-v1?node-id=1-4&p=f&t=NmYG7IGPULxASk6N-0 |
| Settings — Figma | https://www.figma.com/design/EirgiIxJWDEeUNZnKwr3f8/Settings-v1.5?node-id=6-45861&p=f&m=dev |
| Connectors — Storybook (may-day design system) | https://may-day-main.vercel.app/?path=/docs/foundations-colors--docs |

---

## 1. Onboarding — current UI in detail

Four entry cases, all built and live. Shared client state in `context/workspace-onboarding-context.tsx`.

**Case A1 — fresh self-serve signup (creating a new workspace).** 7 pages, exactly this sequence, no forks:
1. Auth0 login/signup, Auth0 terms — hosted, outside this app.
2. `onboarding/setup` — Slack vs. Souvenir-web choice screen.
3. `onboarding/workspace` — collects **workspace name** (required) + **workspace size** (`just_me`/`1-5`/`5-10`/`10+`, defaults to "Just Me").
4. `onboarding/profile` — collects **first name**, **last name**, **role** (Founder/Marketer/Designer/Engineer/Operator/Student-Researcher/Other).
5. `onboarding/invite` — collects invite emails; this is also where `onboarding_completed: true` fires (on both Skip and Next).
6. Lands on the home/new-chat page + an "Add Souvenir to Slack" modal (`_components/add-to-slack-modal.tsx`, `/welcome?slack=1`).

**Case A2 — join an existing workspace.** 3 screens: `onboarding/join` (a "detected workspace" card — org name, member count, avatar stack, Join button, driven by `inviteId`), then the exact same profile and "into the app" screens as A1.

**Case B1 — already signed up, invited to a workspace.** Single pre-login-adjacent screen at `invite/[inviteId]`, "Sign in" variant.

**Case B2 — not signed up, invited to a workspace.** Same route, "Sign up" variant, decided by an `?existingAccount=1` query param the frontend has no real data source for today (see gap table).

**Known live bug, not just a gap:** B1/B2 (`src/app/invite/[inviteId]/page.tsx`) calls `GET /team-invite/{id}` while logged out — that's the entire point of the page — but the route requires `get_current_user` with no anonymous path, so a logged-out request 401s/403s before the handler runs.

**Legacy/dead routes still present in the tree, not part of the v1.5 flow:** `onboarding/account-type`, `onboarding/connectors`, `onboarding/import`, `onboarding/plans`, `onboarding/pricing`, `onboarding/team/*`, `onboarding/tone` — superseded, not extended. Flagging so backend doesn't treat their old contracts as targets to preserve.

---

## 2. Settings — current UI in detail

Shell at `src/app/(app)/settings/(shell)/layout.tsx`. Nav (`SettingsSidebar.tsx`) has three groups:

**PERSONAL**
- **Account** (`/settings/account`) — avatar upload (client-compressed to 256×256 JPEG, sent as a data-URL string), first/last name, read-only role/email, Style (`Direct`/`Balanced`/`Warm`, commits immediately), Default Model tier (`localStorage`-only, no backend field), Delete-account (disabled, "Coming soon").
- **Usage** (`/settings/usage`) — read-only personal credit consumption: total consumed, reset date, per-category (`chat`/`persona`/`workflow`, relabeled Chat/Slackbot/Tasks) bars.

**WORKSPACE** (owner/admin only)
- **General** (`/settings/general`) — workspace identity (logo, name, slug), org-level AI instructions, allowed email domains, a fully-built-but-disabled "Workspace defaults" card (default chat/agent visibility), Archive-workspace (stub, no endpoint), Delete-workspace (real), Ownership-transfer (fully wired, no button renders it).
- **Members** (`/settings/members`) — member table, role editing (owner-gated promote-to-admin), Remove/Withdraw, Invite modal (email chips, role, optional project-access picker), per-member `credit_cap` (backend field, unused in this UI).
- **Plans & Billing** (`/settings/plans`) — plan/pool totals, overage limit (owner-only), payment method via Stripe portal, admin permission toggles, invoice history (Stripe-hosted links), Buy Credits modal (recharge-threshold field captured but never sent).
- **Usage/Analytics** (`/settings/analytics`) — date-range tabs, credit-usage-by-feature chart (client-fabricated daily series from a hardcoded 68/20/12 split — no real per-feature time series exists), "Utilisation %" (approximated).

**HELP & SUPPORT**
- **Help & Legal** (`/settings/help`) — static legal links; Help Center/Contact Support rendered disabled (no URL); hardcoded version string.

**Orphaned pages (built, reachable only by typing the URL, no nav entry):** `/settings/activity` (still linked from `LeftSidebar` — live), `/settings/billing` (legacy, still linked from several places), `/settings/ai`, `/settings/security`, `/settings/notifications`, `/settings/preferences`, `/settings/files` — the last five have zero backend support for what they render even if re-linked.

**Known live bug:** `LeftSidebar.tsx` still links to `/settings/teams`, which has no page file — a 404 today. The Team backend routes themselves are real and live (`GET/POST /organizations/{id}/teams` etc.) but are being retired per the target architecture, not rebuilt into a page.

---

## 3. Connectors — current UI in detail

Both routes (`/connectors` and `/settings/connectors`) now mount one shared experience, `ConnectorsExperience.tsx`, replacing two previously separate pages. Built 1:1 from `ConnectorLibraryV1` (Storybook, `Teams/Connectors/Connector Flow V1`, states S1–S22).

- **Catalog/Connections** (S1–S3, S14, S17) — search/type/sort-filtered catalog; connected accounts render in full (never paginated), available connectors paginate 10/page; a page-level reconnect banner aggregates any `reconnect_required` accounts.
- **Setup** (S18, S11) — connect/reconnect flow; Shared vs. Private visibility choice at connect time; native MCP connectors navigate the current tab (not a popup) for OAuth.
- **Connector detail** (S19) — merges the old admin account list + personal tool list into one page; three panels — Attention (needs reconnect) → Shared → Private.
- **Account detail** — Permissions tab (S20, optimistic-update tool toggles), Access tab (S21, visibility flip — UI built, Save disabled, no backend support), Settings tab (S22, label + remove).
- **Remove** (S15/S16) — Keep/Remove confirm; shows a dependency panel only when the account has known usage, otherwise a plain confirm.
- **Point screens** (S4–S10, S13) — chat-embedded connector prompts (connect-prompt, permission-ask, scope-panel, etc.) are unfinished placeholders in the design source itself, out of scope for this migration, tracked separately.

Canonical FE data shape: `UnifiedAccount`/`UnifiedConnectorSummary` in `src/lib/connectorsUnified.ts` — reconciles the backend's still-split personal/shared (Team-scoped) model into one shape the UI consumes.

---

## 4. Missing endpoints — clean handover table

Only rows that need real backend work. 🔴 = doesn't exist yet · 🟡 = exists, needs a contract/behavior change. Priority is user-facing impact per the source audits, not engineering effort.

| # | Area | Endpoint (proposed/existing) | Method | Status | What's needed | Priority |
|---|---|---|---|---|---|---|
| 1 | Connectors 🎯 | `/organizations/{id}/connectors/{slug}/accounts` (or equivalent) | POST/PATCH | 🔴 New | **Target fix.** Owner/Admin creates a shared account, immediately visible workspace-wide — no `team_id`, no approval step. Replaces `/teams`, `/teams/{id}/connectors`, `/teams/{id}/connectors/{slug}` in one build. | Highest |
| 2 | Onboarding + Settings 🎯 | `/organizations/{id}/invites` | POST/DELETE | 🔴 New | **Target fix.** Flat, workspace-scoped invite (optional `project_id`, no `teamId`). Replaces `/teams/{teamId}/invites` for both Settings→Members and Onboarding→Invite/Join. FE already calls this shape (`inviteMembers()` in `lib/api/teams.ts`) — only the route needs building. | Highest |
| 3 | Connectors | Account visibility flip (shared ↔ private, post-creation) | PATCH | 🔴 New | `scope` is immutable once set. Access tab's Save is permanently disabled. Needs a real scope-conversion endpoint (or a unified account object). | Highest |
| 4 | Connectors | Shared-account tool permissions | PATCH `/organizations/{id}/connectors/accounts/{id}` | 🔴 New field | No `permissions` field exists on this PATCH — shared accounts have **zero** tool-permission storage today (private accounts work fine via the personal PATCH). Blocks half of the Permissions tab entirely. | Highest |
| 5 | Connectors | Shared OAuth re-authorize in place | — | 🔴 New | Only `credentials` PATCH works for `api_key` shared accounts. OAuth shared accounts can only be deleted and recreated — real dead-end for expired shared Slack/Notion/etc. tokens. | Medium |
| 6 | Connectors | Custom connector creation | — | 🔴 New | The design's own "Add custom connector" is an unfinished placeholder — backend has no route either. | Low |
| 7 | Connectors | MCP endpoint / "what this connection can reach" field | — | 🔴 New | No field on `ConnectorCatalogEntry`/`LinkResponse` exposes an inbound endpoint URL or scope-reachability description. Blocks the S13 scope panel and S19's endpoint row (currently omitted rather than faked). | High |
| 8 | Connectors | `ToolEntry.group` (read-only / write classification) | — | 🔴 New field | Tools are a flat per-slug list; grouping is currently a hand-maintained frontend keyword map across ~150 connectors. | Medium |
| 9 | Connectors | Personal account rename | PATCH `/connectors/{slug}` | 🔴 New field | No `accountLabel` field — private accounts can't be renamed post-connect (shared accounts already can via a different endpoint). Small, mechanical addition. | Medium |
| 10 | Connectors | `/organizations/{id}/connectors/{slug}/used-by` | GET | 🟡 Needs a change | Returns one coarse yes/no per team, never a real per-agent/automation breakdown. Should become `surface:"workspace"` and return actual counts once the Team migration lands. | Medium |
| 11 | Connectors | Editorial catalog tags (Recommended/Trending/New) | — | 🟡 Approximated | No curated field; backed today by `catalog_metadata.featured_weight`, a weak proxy. | Low |
| 12 | Settings | Personal avatar upload | — | 🔴 New | `PATCH /users/me`'s `profile_picture` is a plain string URL, no multipart/file route — org logo upload already does this correctly for comparison. | Medium |
| 13 | Settings | Archive workspace | — | 🔴 New | Button is enabled in the UI; handler is a stub — no endpoint exists at all. | Low-Medium |
| 14 | Settings | Auto-recharge threshold field | — | 🔴 New | Buy-Credits modal captures a "recharge below $X" value; nothing sends it anywhere today. | Low |
| 15 | Settings | Usage/invoice export (CSV or PDF) | — | 🔴 New | Every usage/audit endpoint is JSON-only, paginated, no export route. Invoice PDFs are Stripe-hosted links only. | Low |
| 16 | Settings | Notification preferences (entire domain) | — | 🔴 New | Confirmed zero backend support by full-repo grep — no module, no fields, no route. FE page exists (orphaned), nothing to save to. | Medium (only if re-linked) |
| 17 | Settings | Theme/preference persistence (entire domain) | — | 🔴 New | Same story as #16 — FE page exists (orphaned), no backend field. | Medium (only if re-linked) |
| 18 | Settings | `DELETE /users/me` | DELETE | 🟡 Needs a change | Soft-deactivate only (`active=False`) — no real purge/anonymization. FE already labels this "Coming soon" rather than overpromise. | Low |
| 19 | Onboarding | `GET /team-invite/{id}` | GET | 🟡 Needs a change | Requires `get_current_user`, no anonymous path — but B1/B2's whole purpose is serving this to a logged-out visitor. Needs a genuinely anonymous variant or relaxed/optional auth. | High (live bug) |
| 20 | Onboarding | Domain-matching (email/domain → candidate org) | — | 🔴 New | A2 "join by detected workspace" today only works via an explicit invite link; no endpoint takes an email/domain and returns a matching org. | Medium |
| 21 | Onboarding | "Does this email already have an account" signal | — | 🔴 New | Needed to decide B1 (sign in) vs. B2 (sign up) copy at invite-link-generation time. No field anywhere in `InvitePreview` answers this today. | Medium |
| 22 | Onboarding | `PATCH /users/me/onboarding` completion heuristic | PATCH | 🟡 Needs a change | Backend's auto-complete logic requires `user_role` **and** `ai_tone` **and** `role_fit` all present — no v1.5 screen collects `ai_tone` any more, so auto-complete can never fire. Either add the field back to a screen or drop it from the heuristic. Also: request field is `onboarding_completed`, response field is `completed` — worth aligning, low cost. | High |

---

### Notes for backend scoping

- Rows 1 and 2 are explicitly called out as **one build each** that resolves several other rows simultaneously (see the target-architecture note at the top) — worth prioritizing over the narrower Team-scoped patches they replace.
- Rows 16/17 (notification prefs, theme persistence) only matter if/when those orphaned Settings pages get re-linked into nav — not a regression today since nothing currently reaches them.
- Full rationale, exact request/response shapes referenced in code, and file-level pointers for every row above live in the three source docs linked at the top of this document.
