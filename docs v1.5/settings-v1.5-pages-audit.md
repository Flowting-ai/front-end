# Settings v1.5 — Page-by-Page Audit & Backend Gaps

**Status:** Audit complete (2026-08-27). Read-only documentation — no code changed as part of this doc.

**Scope:** Every page reachable from the new Settings sidebar (`src/components/layout/SettingsSidebar.tsx`, Figma `Settings-v1.5?node-id=18-27780`), plus every settings-adjacent page that still exists as a route but has no entry point in that new nav — what each contains, what's stubbed/fake, and what the real backend does or doesn't support underneath it.

**Source of truth for the new nav:** `SettingsSidebar.tsx`'s three groups — PERSONAL (Account, Usage), WORKSPACE (General, Members, Plans & Billing, Usage — owner/admin only), HELP & SUPPORT (Help & Legal). The Settings shell itself lives at `src/app/(app)/settings/(shell)/layout.tsx`.

---

## 0. Read this first — the Teams page doesn't exist (and per §0's correction below, it shouldn't be rebuilt)

This is the single most important finding in this audit, and it connects directly to `docs v1.5/connectors-v1.5-migration-plan.md`'s §0a (written the same day, independently).

**What happened:** commit `2c8c1dcb` ("A3b: delete Team CRUD — no backend route has existed since the flattening migration") deleted the entire Teams settings UI — the admin list page, the roster/editor-grants/connectors/archive-delete detail page (~1300 lines), the live team page, both `/org/teams/*` redirect stubs, the "Teams" settings-nav item, the global-search "Teams" result, and the welcome page's "Create your first team" card. A companion commit (`616ba7f`, "Flatten connectors page onto org-level connector access") deleted every team-scoped branch of the old connectors UI on the same premise. Both commit messages assert: *"Team has no backend route left — flatten_teams_into_organizations dropped the Team table."*

**That premise is false.** `back-end/services/organizations/router.py`, read directly (not inferred, not paraphrased), exposes a full, real, currently-exercised Team CRUD surface today: `GET/POST /organizations/{id}/teams`, `GET/PATCH/DELETE /organizations/{id}/teams/{team_id}`, `GET /organizations/{id}/teams/{team_id}/editors` (+ add/update/remove), plus an entire team-scoped connector/connection route family. This was confirmed twice, independently, on the same day: once while debugging a live Connectors v1.5 crash (see the migration doc's §0a), and again by this audit's own backend-mapping pass. `services/connectors/service.py`'s `list_user_connectors` does real repository joins against team membership on every single catalog fetch — this is production logic, not a leftover table nobody reads.

**The practical damage, today:**
- `ORG_TEAMS_ROUTE` (`/settings/teams`) has **no page file at all**, at either the old or new path. The route 404s.
- It is **still linked**, right now, from `LeftSidebar.tsx`'s admin section ("Teams," under the org badge → Organization admin panel) — a currently-reachable broken link an org admin can click today and land on a 404.
- There is **no UI anywhere in the app** to create a team, view team membership, or manage per-team editor grants. For an org with zero teams, this isn't a missing nice-to-have — it's a hard block: the Connectors v1.5 migration's `SetupModal` can only auto-target a team when the org has exactly one (§0a of that doc), and there is no way to create that one team, or a second one, or see who's in it, anywhere in the product today.
- The connectors-side deletion means the "old connectors pages" audited at the start of the Connectors v1.5 migration never showed team-scoped UI — it had already been removed before that migration's own research pass began, so that doc's inventory of "what the old pages did" was itself scoped by an already-incomplete picture.

**What this means for this audit:** every other finding below assumes the Settings v1.5 redesign is a deliberate, mostly-sound simplification. This one isn't — it's a deletion based on a verifiably wrong claim about the *current* backend's route surface, made on the same day (or near it) as `flatten_teams_into_organizations`, and never re-checked against the actual API. That much stands.

**CORRECTION 2026-08-27, later same day — but the fix below was wrong; don't rebuild a Teams page.** This section originally recommended rebuilding a minimal Teams page (create/list/rename/archive) to unblock Connectors sharing. That was based on treating the *current* team-scoped backend as the thing to restore UI for. It isn't — the org's own target-architecture spec (Superhuman Docs "New Architecture" overview, read directly the same day) states the intended model is a **flat Workspace with Projects replacing Teams entirely**, and explicitly: *"Connections are workspace-wide — never scoped by project or member."* There is no Team entity in the target architecture at all.

So the actual, corrected read of this whole finding: the Team deletion commits (`2c8c1dcb`/`616ba7f`) had the right instinct — Team *is* being phased out — they just deleted the frontend UI a step ahead of the backend actually finishing that migration, leaving `services/connectors` (and the org's Team CRUD routes generally) stuck half-migrated: still live, still required for today's connector sharing to function at all, but not the direction anything should move further toward. **The real fix is a backend migration that finishes removing Team and makes connections genuinely workspace-wide** — not new Team-management UI. Until that migration lands, the currently-broken `/settings/teams` link should be removed from `LeftSidebar.tsx` (a real, small, immediate fix — a live link to a 404 is a plain bug regardless of architecture direction) rather than pointed at a rebuilt page.

---

## 1. The new nav, page by page

### 1a. Account — `/settings/account` (PERSONAL)

**File:** `src/app/(app)/settings/(shell)/account/page.tsx`. Figma `node-id=18-27466`.

**Contains:**
- **Profile picture** — click-to-upload avatar (65px circle, initials fallback, hover "Change" overlay), "Change Avatar" / "Remove" buttons. Client-side pipeline: rejects non-images and files >8MB, downscales/center-crops to a 256×256 JPEG data URL before saving.
- **Full Name / Last Name** — wired to real `first_name`/`last_name` fields (Figma's "Full Name" label is cosmetic).
- **Role / Email** — both read-only (`disabled`); no edit-role surface exists anywhere.
- **Save changes** — gated on `isDirty`, standard save/loading state.
- **Personalisation card**: Style (`Direct`/`Balanced`/`Warm`, commits immediately on click, reverts + toasts on failure) and Default Model (`Advanced`/`Standard`/`Basic`) — **the latter is `localStorage`-only, no backend field exists for it, and it does not feed into any chat's actual model selection.** The code has an explicit comment refusing to fake a save call against a contract that doesn't exist.
- **Danger Zone** — Delete account: badged "Coming soon," deliberately disabled; `handleDeleteAccount`'s entire body is `// TODO: open confirmation dialog before proceeding`. A code comment explains this is intentional even though Figma shows it enabled — there's no real confirmation flow to wire it to yet.

**Dirty-tracking**: the only page in the new nav wired into `useSettingsGuard` (`src/context/settings-guard-context.tsx`) — leaving with unsaved name/avatar changes triggers the sidebar's "Unsaved account changes" confirm modal. Style/Model changes are excluded from dirty-tracking since they save immediately.

**Backend reality**: `PATCH /users/me` accepts `first_name/last_name/nickname/phone_number/profile_picture` — but `profile_picture` is a **plain string URL field, not a file-upload endpoint.** There's a real mismatch here worth flagging in §3.

---

### 1b. Usage (personal) — `/settings/usage` (PERSONAL)

**File:** `src/app/(app)/settings/(shell)/usage/page.tsx`. Figma `node-id=17-22980`.

Split out of the old combined "Usage & Billing" page (plan/payment/invoices stayed on `/settings/billing`) — this page is read-only personal credit consumption, sourced entirely from the already-loaded `useAuth().user.usage` (no separate fetch).

**Contains:**
- **Personal summary** — total credits consumed, reset date, a 3-segment stacked progress bar + 3 chips for the categories.
- **This month's usage** — per-category credits + progress bar for each, "N sources" footer.
- **Category labels are a cosmetic remap**: the backend's real 3 tracked categories are `chat`/`persona`/`workflow`; Figma's copy calls them "Chat"/"Slackbot"/"Tasks." The remap is deliberate and documented in a code comment, not a bug.

**Minor issue found**: the page subtitle still says "...monitor credit consumption, and download invoices" — stale copy carried over from the old combined page; this page has no invoice UI at all (that's on `/settings/billing`).

**Data note**: each category's progress bar denominator is the *overall* balance total, not a per-category cap (there is no such cap in the data model) — the "Monthly Limits" heading is a little misleading given that.

---

### 1c. General — `/settings/general` (WORKSPACE, owner/admin)

**File:** `src/app/(app)/settings/(shell)/(org)/general/page.tsx` (1385 lines).

**Contains:**
- **Workspace Identity** — logo upload (client-compressed to 512×512 JPEG before upload), workspace name, URL slug (live preview `souvenir.ai/workspace/{slug}`), read-only Workspace ID with copy button. Save button.
- **Organization-level AI instructions** — textarea, 3000-char cap, live counter, "Overrides personal" badge, Clear/Save. Save has a real safeguard: it trusts only the server's echoed value, not the request, to decide whether to show "saved" — and shows an error if the two don't match (guards against a silent backend drop).
- **Allowed email domains** — add/remove pill list, saved only on explicit Save (client-local array until then).
- **Workspace defaults card — fully built but permanently disabled.** Default chat/agent visibility dropdowns, full state/save handler, entirely wrapped in `{false && (...)}` with no comment explaining why it's off.
- **Slack channel mapping** — only shown if Slack is connected; per-channel "map to project ID" (raw ID text input, no picker).
- **Danger Zone** — Archive workspace: enabled per Figma, but the click handler is a pure stub (toasts "not available yet," no API call — a code comment explains there's no archive endpoint in `lib/api/organization.ts` yet). Delete workspace: real, type-the-workspace-name-to-confirm, calls `deleteOrg`.
- **Ownership-transfer flow**: full state and handlers (`handleOpenTransfer`, `handleTransferOwnership`, calling the real `transferOrgOwnership` API) exist in the file **but no button or UI anywhere renders/triggers them.** Fully wired, completely unreachable — an orphaned feature within an otherwise-live page.

**Role-gating nuance worth flagging**: the Danger Zone's `canDeleteOrg` check is `caps.canManageOrg`, which is true for **both admin and owner** — there is no owner-only distinction on archiving or deleting the entire workspace, despite that being the single most destructive action on the page. (Compare Members, below, where several actions genuinely are owner-only.)

No `useSettingsGuard` — every section has its own inline Save, no unsaved-changes navigation guard.

---

### 1d. Members — `/settings/members` (WORKSPACE, owner/admin)

**File:** `src/app/(app)/settings/(shell)/(org)/members/page.tsx` (1242 lines).

**Contains:**
- **Stat row** — total members, admins, pending invites.
- **Members table** — search (collapsible), Invite members button, per-row role control and actions.
  - **Role editing**: owner can manage anyone except the owner; a plain admin can only manage members whose role is already `member` — never another admin. **Only the owner can promote someone to Admin** — a plain admin's dropdown only offers "Member." Demoting Admin→Member requires a confirm modal; promotions commit immediately.
  - **Remove/Withdraw**: active members get "Remove" (inline confirm, no modal); pending invites get "Withdraw" instead, hitting the invite-specific DELETE endpoint (falls back to `removeMember` only if invite metadata is missing).
- **Roles & Permissions modal** — static explainer (Owner/Admin/Member ladder) → **Role comparison modal**, whose 4-row capability table is explicitly sourced from the real `src/lib/roles.ts` ladder (mirrors the backend's `roles.py`) rather than hand-written marketing copy — a good practice worth noting positively.
- **Invite flow** (`AppInviteModal`/`InviteModal`) — email chip input (comma/space/paste-splitting, per-chip pending/invalid/error states with tooltip reasons), role selector (Member/Admin only, no Owner), optional project-access picker for Member invites, domain-restriction hint. Pre-validates locally (already-a-member, disallowed domain) before any network call; reports per-email success/failure back so only genuinely-sent emails clear from the chip list.
- **Self-name backfill**: a quiet `useEffect` detects a stale/placeholder name (`""`/`"Someone"`) on the viewer's own row and silently PATCHes it from the auth context. Non-fatal on failure.

**Two small correctness notes for future cleanup, not urgent**: (1) `membersVersionRef`, described in a comment as a staleness-guard against a stale background resync clobbering an in-flight optimistic edit, is incremented but never actually read/compared anywhere — the guard the comment describes isn't enforced. (2) Several comments reference a "Team-derived 'editor'" role concept as fully removed from the backend ("Team has no backend route left at all") — this is the **same false premise** as §0's Teams-page deletion, just applied narrowly here to a per-project "Editor" role rather than Team CRUD itself. Worth a maintainer pass to confirm whether the narrower claim (no team-derived per-project editor role feeding into a member's *org role* display) still holds even though the broader one (Team has no backend route) does not.

No `useSettingsGuard` here either.

---

### 1e. Plans & Billing — `/settings/plans` (WORKSPACE, owner/admin)

**File:** `src/app/(app)/settings/(shell)/(org)/plans/page.tsx`, plus a `plans/confirmation/page.tsx` sub-route. Figma nodes cited precisely in the file header (Teams Owner/Admin, Enterprise Owner/Admin, two modals).

Explicitly a single-source-of-truth page: everything renders from `getOrgPlan()`'s response, no merge with `/stripe/billing`, no business-default fallbacks papering over a still-loading state.

**Contains (varies by plan tier and role):**
- **Enterprise**: gradient hero (next billing date, monthly fee, remaining credits, progress bar, overage/projected-invoice badges), a stat row (shared credits, credits remaining, seats, a "Manage caps" link to Members), and an owner-only **Overage spend limit** card (edit modal; non-owners get a "Request change" toast instead of a dead control).
- **Teams (non-Enterprise)**: a Plan card (price, active/canceling badge, Upgrade/Cancel/Resume — owner-only actions; non-owners get a "Request plan change" toast) and a Credits Remaining card (Buy credits modal, View usage link).
- **Payment section** (owner, or admin with the `canManagePayment` permission) — card brand/last4/expiry, "Manage on Stripe" (opens the Stripe-hosted portal — there's no in-app card-edit form, by backend design, see §3).
- **Admin permissions panel** (owner-only) — three real toggles (top-up, manage payment, view invoices) gating what admins can do on this same page, plus a static "Change plan — Owner only" row.
- **Invoice history** — table + "Export all" (opens every invoice's Stripe-hosted PDF/URL in new tabs — there's no backend-generated export, see §3).
- **Buy More Credits modal** — four fixed top-up packs + custom amount. Two real UI-only gaps found here: the "Recharge when balance falls below $X" threshold input is captured in state but **never sent to any API** (no backend field exists for an auto-recharge threshold), and the payment row's "Edit payment method" pencil icon's `onClick` just closes the modal — it does not open an edit flow.
- Derived math is unusually well-commented: the client deliberately **recomputes** true overage/remaining rather than trusting the backend's `overage_usd` field directly, because that field is server-side capped at the owner's overage limit for invoicing purposes and would otherwise silently under-report once usage exceeds the cap. Worth knowing if this page and the backend's own invoice math ever seem to disagree — that's expected, not a bug.

**Confirmation sub-route** (`?plan=&type=topup|plan`) shows a success screen and refreshes billing/credits/members app-wide on landing.

---

### 1f. Usage (workspace/Analytics) — `/settings/analytics` (WORKSPACE, owner/admin, labelled "Usage" in the sidebar)

**File:** `src/app/(app)/settings/(shell)/(org)/analytics/page.tsx`.

Makes **zero page-level API calls** — everything comes from `useOrg()` context, already populated elsewhere.

**Contains:**
- Date-range tabs (7d/30d/MTD/QTD).
- Stat row: monthly-limit tile (price, credits, progress bar) and active-members tile (count + utilisation badge).
- "Credit usage by feature" stacked bar chart + legend.
- "Top users" ranked list (avatar, credits, share%, "View all" → Members).

**The chart is the clearest fabricated-but-labeled-honestly content in the whole audit**: the backend exposes org credit *totals* (and per-member/per-team breakdowns) but **no per-feature time series at all**. The daily, per-feature curve shown is derived from the real `used` total, apportioned across a hardcoded `{chat: 0.68, assistants: 0.20, brain: 0.12}` split and distributed across days using deterministic sine/cosine shaping (explicitly not `Math.random()`, so it's stable per render) — not a frozen static mock, but not real telemetry either. The "utilisation %" stat has a similar note: no direct backend field, approximated as "share of members who spent any credits this period." Both are clearly commented as approximations in the source, which is good practice, but worth surfacing here since a reader of the *rendered page* would have no way to know the chart's shape isn't real.

---

### 1g. Help & Legal — `/settings/help` (HELP & SUPPORT)

**File:** `src/app/(app)/settings/(shell)/help/page.tsx`.

**Contains:**
- Feature Request / Report a Bug cards (open the shared modals also reachable from the sidebar nav directly).
- Help resources: Help Center and Contact Support rows are **rendered disabled (no `href`)** — visually present, not clickable. Community Slack is live.
- Legal: Terms, Privacy, Cookie Policy — all live external links. A commented-out (dead, never rendered) "Data Processing Agreement" row sits in the source.
- Footer: hardcoded `"Souvenir v1.1 · © 2026 Souvenir AI"` — not pulled from any build/package metadata, so it will silently drift out of sync with the real app version.

No API calls at all beyond a `trackFeature('settings_help_opened')` analytics ping.

---

## 2. Pages that still exist but have no entry point in the new nav

| Page | Route | Status |
|---|---|---|
| **Teams** | `/settings/teams` | **Deleted entirely — no page file exists.** Still linked from `LeftSidebar.tsx`'s org-admin section → currently 404s when clicked. See §0. |
| **Activity** | `/settings/activity` | Dropped from the new Settings sidebar only ("no slot in the new design," per its own removal comment) — **still fully reachable** via `LeftSidebar.tsx`'s org-admin section and the global search palette. Fully functional: audit log table, search, action-type filter, 90-day retention note. Non-admins are client-side-scoped to their own actions ("the API has no role-aware filtering, so we scope it here"). |
| **Billing (legacy)** | `/settings/billing` | **Reachable** from several places (`LeftSidebar`, command palette as "Usage & Billing," credit-exhaustion banners, `AccountMenu`'s "Upgrade plan"). This is the pre-split "Usage & Billing" page the new personal Usage page (§1b) was carved out of — now effectively duplicate/overlapping with Plans & Billing (§1e) rather than truly legacy; worth a product decision on whether both should keep existing. |
| **AI** | `/settings/ai` | **Fully orphaned.** No incoming links anywhere; `AiModelsView` (the component it renders) isn't imported anywhere else either. |
| **Security** | `/settings/security` | **Fully orphaned.** No route constant exists at all (bare string literal), no incoming links except a test file's route→screen-name mapping. Fully built: sign-in methods (Google), devices/sessions list. |
| **Notifications** | `/settings/notifications` | **Fully orphaned.** No route constant, no incoming links. Fully built: in-app/email preference matrix with hardcoded category defaults (automation-complete, pin-created, budget-alert, team-invite, payment-successful, etc.) — see §3, there's no backend for any of it regardless of reachability. |
| **Preferences** | `/settings/preferences` | **Fully orphaned.** No route constant, no incoming links. Fully built: theme selection (light/dark/system with preview thumbnails) + a tone preference UI. |
| **Files** | `/settings/files` | **Fully orphaned.** No route constant, no incoming links. Fully built: file-management card with sort/filter controls. |

Five pages (AI, Security, Notifications, Preferences, Files) are complete, working React components with zero way to reach them short of typing the URL — the same "dropped, flagged for follow-up" pattern `SettingsSidebar.tsx`'s own code comment uses for Connectors, just without an equivalent comment anywhere explaining *these* five removals or whether they're intentional.

---

## 3. Backend gaps

"Precise" is the literal technical gap; "Plain-English" is what to tell a non-engineer about why something doesn't fully work. Severity reflects user-facing impact, not engineering effort.

| # | Area | Precise gap | Plain-English | Severity |
|---|---|---|---|---|
| 1 | **`/settings/teams` is a live, clickable 404** (§0, corrected) | Not a "missing Team UI" gap — per the org's target-architecture spec (read directly, see §0's correction), Team is being phased out in favor of a flat Workspace/Project model, and connections are meant to be workspace-wide. The real gap is narrower: `LeftSidebar.tsx` still links to a route with no page behind it, and `services/connectors` still depends on the (soon-to-be-removed) Team model for sharing, so it hasn't been migrated to workspace-wide connections yet. | Clicking "Teams" in the admin sidebar goes to a broken page today — that link should be removed. Separately, connector sharing still silently depends on teams existing, which will need a real backend migration before it can work the way the target architecture intends (not by adding more team-management screens). | **Highest** — the dead link is a real, immediate front-end bug; the connectors dependency is a backend migration to schedule, not a UI to build. |
| 2 | **No personal avatar file upload** | `PATCH /users/me`'s `profile_picture` field is a plain string URL — there's no multipart/`UploadFile` route for a personal avatar (contrast: the org logo upload *does* accept a real file via `PATCH /organizations/{id}`). The front-end works around this by encoding the compressed image as a data URL and sending that as the "URL" string. | Profile pictures technically work today, but they're stored as embedded image data disguised as a URL rather than a real uploaded file — that's fragile (size limits, no CDN, no real asset lifecycle) even though the feature functions. | Medium — works today, but is a workaround, not a real upload path. |
| 3 | **No password-change route** | Confirmed: no route anywhere in `services/users`. Auth (and therefore password) is entirely Auth0-managed — this is a deliberate architecture choice, not an oversight. | You can't change your password from inside the app because the app was built to never handle passwords at all — that's expected, not missing. | None (informational) — flagged only so nobody spends time building a Security page's password field against a route that will never exist by design. |
| 4 | **Account deletion is a soft deactivate, not a real delete** | `DELETE /users/me` sets `active=False` and commits — no data purge, no anonymization. The front-end's Account page already reflects this honestly (button badged "Coming soon," disabled). | "Delete my account" today would just flip a flag, not actually erase anything — which is why the front-end correctly refuses to expose it as a working button yet. | Low — front-end already handles this correctly by not overpromising; noted for whoever eventually builds real deletion. |
| 5 | **No notification-preferences backend at all** | Confirmed via full-repo grep: no `notifications`/`preferences` module, no fields on the `User` model, no route anywhere. The front-end's `/settings/notifications` page (fully built, orphaned per §2) has nothing to save to even if it were linked back into the nav. | The notification settings screen that already exists in the code has no server-side home for the choices someone would make on it — turning on that page today would be pure decoration. | Medium — only matters if/when that orphaned page gets re-linked; not a regression today since nobody can reach it. |
| 6 | **No theme/preference persistence backend** | Same grep, same result — no backend field for theme (light/dark/system) or other persisted preferences. `/settings/preferences` (orphaned) would face the same problem as #5 if re-linked. | Same story as notifications — the built UI has nowhere real to save its choices. | Medium — same caveat, dormant until re-linked. |
| 7 | **No CSV/PDF export for activity or usage** | Both `GET /organizations/{id}/audit` and every usage endpoint (`/plan`, `/plan/usage`, `/pool-status`, `/plan/enterprise-usage`) are JSON-only, paginated, no export route. Invoice PDFs are Stripe-hosted links only, not backend-generated exports. | There's no "download my usage report" or "export the activity log" button possible today, because the backend has nowhere to generate that file from — it only ever returns raw paginated data. | Low — nice-to-have, not blocking any currently-promised feature. |
| 8 | **Buy-credits "recharge threshold" is UI-only** | The Plans & Billing page's Buy More Credits modal captures a "recharge when balance falls below $X" value in component state but never sends it anywhere — no backend field for an auto-recharge threshold exists. | You can type a number into that field, but nothing happens with it — there's no auto-recharge feature behind it yet. | Low — the field arguably shouldn't be shown as functional if it does nothing; a quick front-end fix (disable it or add a "coming soon" note) is cheaper than the backend work to make it real. |
| 9 | **"Edit payment method" pencil icon is a no-op** | In the same modal, the pencil icon next to the payment-method summary just calls `onClose()` — it doesn't open any edit flow. The real path (`POST /stripe/portal`, Stripe-hosted) is the "Manage on Stripe" button elsewhere on the page. | That little pencil icon looks like it should let you fix your card details inline, but clicking it just closes the window — the real "change your card" button is a different one, elsewhere on the page. | Low — confusing UX, one-line front-end fix (route it to the same portal call, or remove the icon). |
| 10 | **Workspace defaults, Archive workspace — built but inert** | General's "Workspace defaults" card (default chat/agent visibility) is fully implemented client-side (state, loader, save handler, markup) but statically disabled (`{false && (...)}`). "Archive workspace" is enabled and clickable but its handler is a pure stub with no API call — there's genuinely no archive endpoint in `lib/api/organization.ts` to call. | The workspace-defaults settings exist and work in the code but were switched off before shipping, for a reason nothing in the code explains. Archiving a workspace looks like a real button but currently just tells you it's not ready yet. | Low-Medium — Workspace defaults is a mystery worth a 5-minute question to whoever turned it off; Archive is honestly labeled as unavailable, just needs a real backend endpoint eventually. |
| 11 | **Ownership-transfer flow is fully wired but unreachable** | General's page defines complete, working state/handlers calling the real `POST /organizations/{id}/transfer-owner` endpoint — but no button or UI in the current render tree ever triggers them. | The feature to hand off "owner" to someone else is basically finished in the code, just missing the button that would let you actually open it. | Low — cheapest fix in this whole document: the backend and front-end logic both already exist, this needs only a UI trigger to be wired back in. |
