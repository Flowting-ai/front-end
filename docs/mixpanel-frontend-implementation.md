# Mixpanel — Frontend Implementation Tracker

A running record of **everything changed in the frontend** for Mixpanel analytics, so the
team can track scope, review, and extend. Companion docs: `mixpanel-setup-notion.txt` (product
spec) and `mixpanel-backend-contract.md` (the backend door + what the frontend depends on).

Status legend: ✅ done & verified · 🟡 partial · ⛔ deferred (with reason).

---

## 1. Foundation (build-once core)

| File | Change |
|---|---|
| `src/lib/analytics/mixpanel.ts` *(new)* | The ONLY module importing `mixpanel-browser`. Fail-safe wrappers: `initAnalytics`, `track`, `identifyUser`, `registerStamps`, `clearStamps`, `setPeople`, `setOrgGroup`, `resetAnalytics`. No-ops without a token; every call wrapped in try/catch. `autocapture:false`, `track_pageview:false`, `record_sessions_percent:0`, `persistence:'localStorage'`. |
| `src/lib/analytics/stamps.ts` *(new)* | Types + canonical keys for the five stamps (`surface`, `plan`, `org_id`, `org_tier`) + `ORG_GROUP_KEY`. |
| `src/lib/analytics/events.ts` *(new)* | The vocabulary: `ScreenName`, `FeatureName`, `BrowserEvent` unions + `EventProps` type + emit helpers `trackScreenView` / `trackFeature` / `trackBrowserEvent`. |
| `src/lib/analytics/screens.ts` *(new)* | Pure `routeToScreen(pathname)` → screen concept (reconciled to real routes). |
| `src/lib/analytics/screens.test.ts` *(new)* | 10 unit tests for the route→screen map. |
| `src/components/Analytics/MixpanelProvider.tsx` *(new)* | Pass-through provider: init + identity + logout `reset` + `screen_viewed` on every navigation. Identity id resolves from `user.auth0Id` **or** the JWT `sub` (see `jwt-utils`). Dev-only `[analytics] identify → …` diagnostic. Mounted in `src/app/layout.tsx` **inside `AuthProvider`**. |
| `src/components/Analytics/OrgStamps.tsx` *(new)* | Renders `null`; registers `org_id` + `org_tier` as **super properties only** (no `people.set`/`set_group`). Mounted in `src/app/(app)/layout.tsx` **inside `OrgProvider`**. |
| `src/app/dispatch/[...path]/route.ts` *(new)* | First-party analytics **proxy** (see R3). Forwards `/dispatch/*` server-side to `api-js.mixpanel.com`, preserving the client IP (`X-Forwarded-For`) for geolocation and stripping the same-origin session cookie. The SDK is pointed here via `api_host:"/dispatch"`. |
| `src/lib/config.ts` | Added `mixpanelToken` + `analyticsEnabled` + build-time dev/prod token selection. |
| `src/context/auth-context.tsx` | Added optional `auth0Id` to `AuthUser` and mapped `profile.auth0_id`. |
| `src/lib/jwt-utils.ts` | Added `decodeJwtSub(token)` — reads the Auth0 `sub` claim from the access token (mirrors the existing `parseTokenExpiry`), used as the analytics `distinct_id` since `/users/me` omits `auth0_id`. |
| `src/app/layout.tsx` | Wrapped `children` with `<MixpanelProvider>`. |
| `src/app/(app)/layout.tsx` | Mounted `<OrgStamps />` inside `OrgProvider`. |
| `AGENTS.md` | Added an "Analytics (Mixpanel)" section for future agents. |
| `docs/mixpanel-backend-contract.md` *(new)* | Backend door spec + frontend walkthrough. |

**Identity / stamps:** `distinct_id` = Auth0 `sub` (never email). `GET /users/me` does **not**
return `auth0_id`, so `MixpanelProvider` derives the `sub` from the **JWT access token**
(`decodeJwtSub` in `jwt-utils.ts`) — no backend change needed. Individuals carry `plan`;
org members carry `org_id`+`org_tier` (and blank `plan`). `surface:"web"` on every event.

**Post-verification fixes (from live console testing):**
- `OrgStamps` registers `org_id`/`org_tier` as **super properties only** — removed the
  premature `people.set` (before-identify) and `set_group` (its group key turned the scalar
  `org_id` stamp into an array). Group Analytics can be re-added deliberately once the add-on
  is confirmed.
- Identity id now falls back to the JWT `sub` (above), since `/users/me` lacks `auth0_id`.
- Dev-only console diagnostics: `[analytics] identify → …` on success.

---

## 2. Layer 1 — screen views ✅
`screen_viewed { screen }` fires automatically on every client-side navigation via
`MixpanelProvider` + `routeToScreen()`. No per-page wiring needed.

## 3. Layer 4 + Layer 3 — event call sites wired this pass

Every property below is IDs / enums / booleans only — **no free text** (message content,
titles, names, filenames, prompt text are all excluded by design).

| Event | Type | File | Trigger | Properties |
|---|---|---|---|---|
| `chat_message_sent` | L3 | `components/chat/ChatInterface.tsx` (`handleSend`) | message sent | `has_agent`, `model_pick`, `model_id?`, `web_search`, `reasoning`, `attachment_count`, `pin_count` |
| `regenerate` | L4 | `components/chat/ChatInterface.tsx` (`handleRegenerate`) | regenerate response | `model_pick`, `model_id?`, `reasoning` |
| `model_selector_manual` | L4 | `components/chat/PresetModelSelectorDialog.tsx` | pick a model by hand | `model_id`, `model_type` |
| `effort_level_changed` | L4 | `components/chat/ModelMenu.tsx` | toggle adaptive thinking | `enabled` |
| `voice_input` | L4 | `components/chat/ChatInput.tsx` (`startRecording`) | start mic dictation | — |
| `search` | L4 | `context/search-context.tsx` (`openSearch` + ⌘K) | open global search | — |
| `output_viewed` | L4 | `templates/Brain/ExternalOutputCard.tsx` | click "View" on a run output | `connector`, `verb` |
| `document_download` | L4 | `components/chat/ChatMessage.tsx` | download an attachment | `file_ext` |
| `compare_models` | L4 | `context/compare-context.tsx` (`open`) | open compare panel | — |
| `pin_created` | L3 | `components/chat/ChatMessage.tsx`; `components/compare/CompareModels.tsx` | pin a message | `source` (`chat`/`brain`) |
| `highlight_created` | L3 | `components/chat/ChatMessage.tsx` | create a highlight | `source` (`chat`) |
| `highlight_filter` | L4 | `components/HighlightPanel/index.tsx` | change highlight filter | `filter_mode` |
| `pin_folder_organize` | L4 | `components/PinboardExpanded/index.tsx` | move pins into a folder | `action`, `folder_kind`, `pin_count` |
| `agent_created` | L3 | `app/(app)/agents/basics/tone/page.tsx` | wizard completes | `from_template`, `template_slug?` |
| `agent_wizard_abandoned` | L3 | `app/(app)/agents/_components/WizardShell.tsx` | wizard exited early | `last_step` |
| `agent_published` | L3 | `lib/api/personas.ts` (`publishPersonaVersion`) | publish (all tabs) | — |
| `agent_edited` | L4 | `lib/api/personas.ts` (`updateVersion`) | save config (all tabs) | — |
| `agent_shared` | L3 | `lib/api/persona-shares.ts` (`createShare`) | share an agent | `share_type` |
| `agent_template_browsed` | L4 | `app/(app)/agents/templates/page.tsx` | open template gallery | — |
| `agent_enhance_instructions` | L4 | `components/EnhancePromptField/index.tsx` | open the enhance flow | — |
| `project_created` | L3 | `context/projects-context.tsx` (`createProject`) | new project | `team_shared` |
| `project_instructions_added` | L4 | `context/projects-context.tsx` (`updateProject`) | save project instructions | `has_instructions` |
| `project_agent_attached` | L4 | `app/(app)/project/[id]/page.tsx` | attach an agent in a project | `persona_id` |
| `team_member_invited` | L3 | `app/(app)/org/teams/[teamId]/page.tsx` (`handleInvite`) | send invites | `role`, `count` |
| `share_created` | L3 | `lib/api/chat-shares.ts` (`createChatShare`) | share a chat/project | `kind` (`user`/`team`/`project`/`link`) |
| `permission_level_changed` | L4 | `app/(app)/org/teams/[teamId]/page.tsx` | add/remove editor | `role_changed_to` |
| `signup_completed` | L3 | `app/(onboarding)/onboarding/import/page.tsx` | onboarding completes | `account_type?`, `invited_by_org` |
| `onboarding_step_completed` | L3 | `app/(onboarding)/onboarding/import/page.tsx` | 🟡 completion step only | `step` |
| `checkout_started` | L3 | `app/(app)/settings/billing/change-plan/page.tsx` | open Stripe checkout (3 paths) | `from_plan?`, `to_plan` |
| `schedule_created` | L4 | `templates/Brain/ScheduleEditModal.tsx` | save a schedule | `frequency_type` |
| `settings_help_opened` | L4 | `app/(app)/settings/(shell)/help/page.tsx` | open Help page | — |

**Design choices worth noting:**
- `agent_published` / `agent_edited` / `agent_shared` and `project_created` / `project_instructions_added` / `share_created` were wired at their **API/context choke points** — one edit covers every UI entry point and avoids duplicate call sites.
- `agent_shared` (persona shares) and `share_created` (chat/project shares) are intentionally **split by kind** so they don't double-fire on the same action.

---

## 4. Deferred (with reason) ⛔

| Event | Reason |
|---|---|
| `brain_run_stopped` | Needs the live run *phase* from UI state; wiring it to the generic chat-stop would mislabel data. Follow-up. |
| `response_block_rendered` | Render-lifecycle hook — needs care to fire once per block (not on every re-render). |
| `context_panel_opened` | Needs a panel-visibility state hook. |
| `activation_milestone` | Browser can't reliably know "first ever" — **depends on a backend `is_first` flag** (see contract doc). |
| `onboarding_step_completed` (intermediate steps) | Only the completion step is wired; hello/account-type/tone/workspace follow the same one-line pattern. |
| `flashcards`, `pin_drag` | No such feature/handler exists in the codebase. |

Backend-owned (never fired by the browser, to avoid double-counting): `plan_changed`,
`plan_limit_hit`, `workflow_*`, `brain_clarification`, `automation_*`, `memory_referenced`,
`report_generated`, `connector_connect_attempted`, cost stamps, Slack `surface`.

---

## 5. Verification
- `npx tsc --noEmit` — clean.
- `npx vitest run src/lib/analytics/screens.test.ts` — 10/10 pass.
- `npm run build` — success (exit 0).
- ESLint: only **pre-existing** repo errors (`react-hooks/set-state-in-effect`, `no-img-element`) in files we touched but on lines we didn't change; Next 16 build doesn't gate on ESLint.

## 6. How to add a new event (standing rule)
1. Add the name to `mixpanel-setup-notion.txt` first.
2. Add it to the union in `src/lib/analytics/events.ts` (`FeatureName` or `BrowserEvent`).
3. Call `trackFeature(...)` / `trackBrowserEvent(...)` at the handler — IDs/enums/booleans only.

## 7. Revision log

**R1 — Foundation + event wiring.** Shipped the core (init, stamps, identity, `screen_viewed`)
and wired 26 browser events (§3). Verified: tsc / tests / build all green.

**R2 — Live dev-testing fixes.** Confirmed in the browser that events flow to the DEV project
with full stamps (`feature_used`, `screen_viewed` carrying `org_id`, `org_tier: teams`,
`surface: web`, correct token). Three corrections from that session:

| Symptom in console | Root cause | Fix |
|---|---|---|
| `distinct_id` stuck at `$device:…` (anonymous) | `GET /users/me` (`UserAccountResponse`) does not return `auth0_id` — verified against `docs/openapi/api_yaml/devapi.json` | Derive the Auth0 `sub` from the JWT access token via `decodeJwtSub` (`jwt-utils.ts`); `MixpanelProvider` prefers `user.auth0Id` then falls back to the token `sub`. No backend change needed. |
| `org_id` sent as `Array(1)` | `set_group("org_id", …)` (Group Analytics) collided with the scalar `org_id` super property | Removed the `set_group` call in `OrgStamps`; `org_id` stays a clean string. Group Analytics deferred until the add-on is confirmed. |
| `People request … PENDING IDENTIFY` | `OrgStamps` called `people.set` before `identify` (skill violation / anonymous profile) | `OrgStamps` now registers super properties only; People profiles are set only after `identify` in `MixpanelProvider`. |

**Security note (JWT decode):** `decodeJwtSub` only *reads* the `sub` claim; it does not verify
the signature (correct here — the value is a non-sensitive analytics label, and the backend
remains the signature-verifying security boundary). It mirrors the existing `parseTokenExpiry`.
The token is never logged or transmitted; only the opaque `sub` reaches Mixpanel.

**R3 — First-party proxy (browser-proof ingestion).** The SDK was talking to
`api-js.mixpanel.com`, a third-party domain on every tracker/ad blocklist — so events
from users on uBlock / Brave / Dia / EasyPrivacy (e.g. an agency ops person) were dropped
before ingestion, making them invisible in the data. Fix: route all traffic through our own
origin so blockers see the app talking to itself.

> **Full write-up:** `docs/mixpanel-browser-proof.md` — task, methodology, every gotcha,
> and the real-browser verification. The summary below is the changelog view.

| Change | File | Detail |
|---|---|---|
| Proxy route | `src/app/dispatch/[...path]/route.ts` *(new)* | Node route handler forwarding `/dispatch/*` → `https://api-js.mixpanel.com/*`. We use a handler, **not a `next.config` rewrite**, because this repo removed rewrites (Turbopack buffers them — see `next.config.ts`) and a handler lets us explicitly forward the client IP and strip the cookie. |
| SDK init | `src/lib/analytics/mixpanel.ts` | `api_host:"/dispatch"` + a full `api_routes` alias map (`track→evt`, `engage→usr`, `groups→grp`; `record`/`flags` kept). The alias also drops the SDK's default trailing slash (which would 308-redirect and break `sendBeacon`). `api_routes` must be a **complete** object — the SDK shallow-merges it. |
| Proxy matcher | `src/proxy.ts` | Excluded `dispatch` from the middleware matcher. It is extension-less, so otherwise every beacon would hit the onboarding/auth gate — pre-auth events 302'd to `/auth/login` (lost) and authed events triggering a `/users/me` fetch each. Middleware runs **before** the route handler, so it must be skipped here. |

**Path choice (important — learned the hard way):** the endpoint and aliases are deliberately
generic (`/dispatch/evt|usr|grp`). Same-origin is **not** sufficient on its own — uBlock/
EasyPrivacy match tracking paths (`/ingest`, `/e/`, `/track`, `/collect`) **by path,
regardless of domain**. A first attempt used `/ingest/e` and uBlock in Chrome blocked it
(observed live: `(blocked)`, 0 B). Renaming to a non-tracking path fixed it. **Never** rename
these back to tracking-flavoured tokens.

Verified against the SDK source (`mixpanel-browser@2.78`): default `api_host` is
`api-js.mixpanel.com`; the `settings`/`flags`/`record` endpoints are **not** fetched under
our config (`remote_settings_mode: disabled`, flags off, record 0), so only `track`/`engage`/
`groups` fire. **No CSP change needed** — `connect-src 'self'` already covers `/dispatch`.

**Privacy note (proxy):** because `/dispatch` is same-origin, the browser auto-attaches the
Auth0 session cookie to every beacon; the route handler **strips** `cookie` (and
`authorization`/`referer`) before forwarding, so nothing sensitive reaches Mixpanel — only
the client IP (for geolocation) and the SDK payload.

**Prod token (unrelated to this code):** production still no-ops until
`NEXT_PUBLIC_MIXPANEL_TOKEN_PROD` is provisioned (env only — no code change). The proxy works
identically in dev and prod.
