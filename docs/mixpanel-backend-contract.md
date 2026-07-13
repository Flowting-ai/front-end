# Mixpanel — Backend Contract & Implementation Spec

**Audience:** the backend / workflow-engine team.
**Companion to:** `docs/mixpanel-setup-notion.txt` (the product spec / tracking plan) and the
frontend foundation now shipped under `src/lib/analytics/` + `src/components/Analytics/`.

This is the "backend door" of the two-door model. The browser door (screen views,
feature usage, and browser-originating decision events) is implemented in the frontend
repo. This document defines exactly what the **backend** must emit so both doors land in
the same Mixpanel project with identical, consistent stamps.

> The setup doc's order of work puts the **backend door first** — the entire SCS
> migration is scheduled/triggered work that never touches a browser. If we only track
> the browser, an org running 88 automations looks dead in the data.

---

## 1. Projects & environment split

- **DEV project** — all testing. Frontend uses `NEXT_PUBLIC_MIXPANEL_TOKEN` (dev secret
  bundle); backend must use the matching **DEV** project token for non-production.
- **PROD project** — production only. Frontend uses `NEXT_PUBLIC_MIXPANEL_TOKEN_PROD`;
  backend uses the matching **PROD** token. Nothing ships to PROD until the DEV
  verification check below passes.
- **How the frontend selects the token (build-time):** `NEXT_PUBLIC_*` vars are inlined
  by Next.js when the app is built, never at runtime. `src/lib/config.ts` computes
  `isMixpanelProd` from `NEXT_PUBLIC_VERCEL_ENV ?? NODE_ENV === "production"` and reads
  `NEXT_PUBLIC_MIXPANEL_TOKEN_PROD` for production builds, else the dev token. Both
  variables may coexist in the environment — a dev build ignores the prod token. Tokens
  live only in the secret source (AWS Secrets Manager bundle per environment, or Vercel
  env vars scoped per environment), **never in source**. Because the value is baked at
  build time, production must be a *fresh build in the production environment* — do not
  promote a prebuilt staging artifact to prod or it will carry the staging token.
- **Verify Simplified ID Merge** (Mixpanel → Project Settings → Identity Management)
  is enabled on both projects **before** the first event. Do not switch modes after data
  exists. This lets `$device_id` (anonymous browser) and `$user_id` (Auth0 sub) merge.
- **Autocapture OFF, Session Replay OFF** (replay is a later, masked phase).

## 2. Identity — the same person on every surface

`distinct_id` / `$user_id` = the **Auth0 subject (`sub`)** — the same value the frontend
uses (`profile.auth0_id`). **Never** use email as the identifier. For Slack-originated
work, resolve the Slack user to their Auth0 `sub` before emitting (the backend already
maps Slack identities; see `/slack/link`).

- Server-side events set `$user_id` = Auth0 sub and `$insert_id` (dedup) on every event.
- Do **not** create People profiles for anonymous actors.

## 3. The five stamps (required on every backend event)

Send these as event properties on **every** event, no exceptions. Same keys, same enum
values as the browser (defined in `src/lib/analytics/stamps.ts`).

| Key | Meaning | Values | Notes |
|---|---|---|---|
| `distinct_id` | who | Auth0 `sub` | identity, not a property |
| `org_id` | which company | org id, or omit | omit (do not send `""`) for individuals |
| `org_tier` | company tier | `teams` \| `enterprise` | omit for individuals |
| `plan` | individual plan | `starter` \| `pro` \| `power` | **omit** for org members |
| `surface` | where | `web` \| `slack` | backend sets `slack` (or `web` for web-triggered server work) |
| cost stamp | what it cost | see §4 | only on events where compute ran |

Rules (match the doc + the Mixpanel skill):
- **Omit** properties with no value — never send `null` or `""`.
- Numerics unquoted (so they aggregate). Enum values lowercase `snake_case`.
- **No free text ever** — no message content, prompt text, document contents, chat
  titles, plan text, run summaries, or task titles. IDs and enumerated types only.

## 4. Cost stamp — derived from the ledger, never recomputed

Source of truth is the existing **`EnterpriseUsageEvent`** ledger. Mixpanel derives from
it; it must never compute cost in parallel. On any event where compute ran attach:

| Key | Values |
|---|---|
| `model` | model id, e.g. `gemini-3-flash` (enumerated) |
| `tokens` | integer |
| `cost_usd` | number (dollars) |

## 5. Vocabulary translation (analytics names ≠ API names)

Analytics uses product language, not API internals:

| Analytics term | API / backend term |
|---|---|
| `agent` | persona |
| `schedule` | task |
| `plan` | subscription tier **only** (Brain "plans" are **runs**) |

## 6. Backend-emitted events

Only events that originate on the backend door are listed here. (Browser-originating
events — `screen_viewed`, `feature_used`, `signup_completed`, `chat_message_sent`,
`agent_created`, etc. — are handled in the frontend; see `src/lib/analytics/events.ts`.)
★ = must be live before the SCS usage watch.

### Brain & workflows
| Event | When | Required props (besides stamps) |
|---|---|---|
| ★ `workflow_run` | any run starts (manual/scheduled/triggered) | `workflow_type`, `initiated_by` (`person`\|`schedule`\|`trigger`), `source` (`brain`\|`schedule`\|`slack_automation`) |
| ★ `workflow_completed` | run ends OK | `workflow_type`, `duration_ms`, cost stamp |
| ★ `workflow_failed` | run ends in error | `workflow_type`, `duration_ms`, `failure_reason` (enum), cost stamp |
| `brain_clarification` | Brain asks a clarifying question | `question_type`, `response` (`answered`\|`skipped`) |
| `automation_approved` / `automation_rejected` | approval gate answered | `risk_tier` |
| `report_generated` | client-ready output produced | `output_type`, `data_sources` (enum list) |

> `brain_run_stopped` (user hits stop mid-run) originates in the **browser** and is
> declared on the frontend; emit it there, not from the backend.

### Chat (backend-side)
| Event | When | Required props |
|---|---|---|
| `memory_referenced` | AI cites a past pin/memory | (stamps only) |
| `response_block_rendered` | a table/chart/steps block persists | `block_type`, `persisted` (bool) — coordinate: fires where the block is finalized |

### Connectors, controls, billing
| Event | When | Required props |
|---|---|---|
| `connector_connect_attempted` | connect flow resolves | `app_name`, `result` (`succeeded`\|`failed`\|`abandoned`) — the Pipedream hosted page often closes without callback; "started, never finished" **must** be recorded |
| `credit_cap_set` | admin sets a member cap | (stamps only) |
| `model_toggled_off` | admin disables a model | `model_name` |
| `plan_changed` | Stripe webhook arrives | `from_plan`, `to_plan` — **fires from the webhook, never the browser success page** |
| `plan_limit_hit` | starter/pro user hits a plan limit | `which_limit` (enum) |

### Open questions to resolve before building the billing events
- **`plan_changed`:** confirm a Stripe webhook exists (none is in the API spec). Build one
  if absent — this event must be webhook-driven, not client-driven.
- **`plan_limit_hit`:** locate the limit-rejection point in code first; emit there.

## 7. Verification gate (the "15-minute check" — hard gate)

Before anything ships to PROD, in the **DEV** project's Live View confirm one of each:
one `workflow_run`, one `connector_connect_attempted`, one `chat_message_sent`, and one
`screen_viewed` — each carrying all applicable stamps (`distinct_id`, `org_id`+`org_tier`
or `plan`, `surface`, and cost stamp where compute ran). Confirm an individual (Pro) user
and an org member show the correct stamp split. Nothing ships to production before this
passes.

## 8. Standing rules
- No events outside `mixpanel-setup-notion.txt`. New need → add the line there first,
  then build. New trackable feature → one name added to the `feature_used` list.
- Annotate every release **and** each SCS migration wave on the Mixpanel timeline.
- Tracking edits ride in the same PR as the behavior change they measure.

---

# What the frontend depends on from the backend

The browser door is now implemented (see `mixpanel-frontend-implementation.md`). For its data
to be correct, the backend must satisfy the following. Ordered by severity.

## Hard dependencies (browser analytics is wrong/blank without these)

| # | Dependency | Why | Where |
|---|---|---|---|
| 1 | **The Auth0 `sub`** identifies the user | It is the `distinct_id` for every browser event. **Confirmed:** `GET /users/me` (`UserAccountResponse`) does **not** return it, so the frontend derives it from the **JWT access token's `sub` claim** (`decodeJwtSub` in `jwt-utils.ts`) — no backend change required to unblock the browser. The backend's job: **emit its own events under the *same* Auth0 `sub`** so both doors join. (Optional nicety: add `auth0_id` to `/users/me` so the frontend doesn't have to decode the token — not required.) | JWT `sub` (frontend) / your `auth0_id` (backend events) |
| 2 | **`plan_type` on `/users/me`** = `starter` \| `pro` \| `power` | Drives the individual `plan` stamp. Note it currently returns `undefined` for org members (correct — they use `org_tier` instead) but must be present for individuals. | `/users/me` → `plan` |
| 3 | **Org tier on org endpoints** = `teams` \| `enterprise` | Drives `org_tier` (and `org_id`). Frontend reads it from `GET /organizations/{id}` and `/organizations/{id}/plan`. Verified working. | `getOrg` / `getOrgPlan` → `planType` |

The critical one is **#1 identity consistency**: browser events use the JWT `sub`; backend
events MUST use the identical Auth0 `sub` as `distinct_id`, or the two doors won't join into
one user. If #2/#3 change shape or enum values, coordinate — the stamps drift otherwise.

## Dashboard / project settings (not code, but gating)

| Setting | Why |
|---|---|
| **Simplified ID Merge = ON** (both DEV + PROD projects) | Pre-auth `screen_viewed` events fire under an anonymous `$device_id`; merge links them to the Auth0 `sub` once the user logs in. Without it, the anonymous → identified history is lost. Must be set **before** first events. |
| **Group Analytics add-on** (optional) | The frontend calls `set_group("org_id", …)` for org rollups. Harmless if the add-on is off; org-level reports only light up with it on. |

## Events the frontend deliberately does NOT emit — backend must own them

To avoid double-counting, the browser never fires these; the backend is the sole source:

- `plan_changed` — must come from the **Stripe webhook**, not the browser. The browser only
  fires `checkout_started` (intent); the backend fires `plan_changed` (confirmed outcome).
  *(Open question from §6: confirm/build the webhook.)*
- `plan_limit_hit` — fire at the backend limit-rejection point.
- `workflow_run/completed/failed`, `brain_clarification`, `automation_approved/rejected`,
  `memory_referenced`, `report_generated`, `agent_used`, `connector_connect_attempted`.
- The **cost stamp** on all compute events, and `surface: "slack"` for Slack-originated work.

⚠️ Do not also emit the browser-owned events (`chat_message_sent`, `share_created`,
`agent_shared`, `agent_published`, `checkout_started`, `pin_created`, etc.) from the backend —
they are already sent from the browser and would double-count.

## Optional — needed only if we wire the deferred browser events

These frontend events are **deferred** specifically because the browser can't produce the data;
the backend must supply a signal if we want them:

| Deferred event | What the backend would need to provide |
|---|---|
| `activation_milestone` (first connector / agent / workflow / pin, per user & per org) | An `is_first_*` flag on the relevant create responses (or emit the milestone from the backend directly — recommended). |
| `response_block_rendered` (persisted yes/no) | The response payload must indicate whether each structured block was persisted. |

## Consistency contract (the non-negotiables)

1. Same `distinct_id` = Auth0 `sub` on both doors.
2. Same stamp **keys and enum values** as `src/lib/analytics/stamps.ts` (`surface`, `plan`,
   `org_id`, `org_tier`) with the omit-when-blank rule (§3).
3. Same vocabulary/translation (`persona`→`agent`, `task`→`schedule`, `plan`=tier only, §5).

---

# Appendix A — How the browser door is implemented (complete walkthrough)

This appendix is the full story of the **frontend** implementation so the backend has
zero-gap context: what runs, in what order, which properties are set, from which files
and functions, and exactly how the stamps you must mirror are produced on the browser
side. If a term here (`org_tier`, `surface`, distinct_id) also appears in your backend
events, it must carry the **same key and the same enum values** — that consistency is the
entire point.

## A.0 Map of the code

| File | Responsibility |
|---|---|
| `src/lib/config.ts` | Reads the env token; exposes `mixpanelToken`, `analyticsEnabled`, and the build-time dev/prod selection. |
| `src/lib/analytics/stamps.ts` | Types + canonical keys for the five stamps. |
| `src/lib/analytics/mixpanel.ts` | The **only** file importing `mixpanel-browser`. Fail-safe wrappers. |
| `src/lib/analytics/events.ts` | The vocabulary: event names + property types + emit helpers. |
| `src/lib/analytics/screens.ts` | Pure `routeToScreen(pathname)` mapping for Layer 1. |
| `src/components/Analytics/MixpanelProvider.tsx` | Init + identity + logout-reset + `screen_viewed`. Mounted in the root layout inside `AuthProvider`. |
| `src/components/Analytics/OrgStamps.tsx` | Adds org stamps + Group Analytics. Mounted in the `(app)` layout inside `OrgProvider`. |
| `src/context/auth-context.tsx` | Surfaces `auth0Id` (the Auth0 `sub`) onto the client user object. |

## A.1 The exact SDK initialization

`initAnalytics()` in `mixpanel.ts` runs **once**, in the browser, only if a token exists:

```ts
mixpanel.init(mixpanelToken, {
  autocapture: false,          // named coverage only — NO autocapture
  track_pageview: false,       // we emit screen_viewed ourselves
  persistence: "localStorage", // SPA-friendly
  record_sessions_percent: 0,  // Session Replay is a later, masked phase
  debug: isDev,
});
mixpanel.register({ surface: "web" }); // constant stamp on EVERY event
```

Guarantees the backend can rely on: no autocapture noise pollutes the project; no
`$mp_web_page_view` auto events; every browser event carries `surface: "web"`.

## A.2 The five stamps as they exist on the browser (mirror these exactly)

Defined in `stamps.ts` and attached as Mixpanel **super properties** (`register`) so they
ride on every event automatically:

| Key | Type / values | Who sets it | When |
|---|---|---|---|
| `surface` | `"web"` (browser) / `"slack"` (yours) | `initAnalytics()` | at init + re-applied after `reset()` |
| `plan` | `"starter" \| "pro" \| "power"` | `MixpanelProvider` | identified user **with no org** |
| `org_id` | org id string | `MixpanelProvider` + `OrgStamps` | identified user **in an org** |
| `org_tier` | `"teams" \| "enterprise"` | `OrgStamps` | once the org plan fetch settles |

Rule enforced in code: an org member has `org_id`+`org_tier` and **no `plan`**; an
individual has `plan` and **no** org stamps. We `unregister` the opposite set rather than
sending blanks — so you will never see `plan: ""` or a stale org id.

## A.3 Identity — the exact call order (matches the Mixpanel skill)

`distinct_id` = **Auth0 `sub`**, surfaced as `user.auth0Id` in `auth-context.tsx`
(`profile.auth0_id`). Email is **never** the identifier. The identity effect in
`MixpanelProvider` runs when `auth0Id` becomes available:

```
identify(auth0Id)                      // ALWAYS first
  ├─ if NO org:  register({plan})      +  people.set({plan})   +  unregister(org_id, org_tier)
  └─ if in org:  register({org_id})    +  unregister(plan)      (org_tier added by OrgStamps)
```

People profiles are only ever set **after** `identify` and never for anonymous users.

## A.4 The lifecycle, start to finish (story mode)

1. **Boot.** Root layout renders → `MixpanelProvider` mounts (inside `AuthProvider`) →
   effect #1 calls `initAnalytics()`. SDK initializes; `surface: "web"` registered.
   distinct_id is anonymous (`$device_id`) at this point.
2. **Pre-auth screens.** On `/welcome`, `/onboarding/*`, login, etc., effect #4 fires
   `screen_viewed { screen }` for each navigation — carrying only `surface: "web"` (no
   identity yet). These anonymous events will merge into the user once identified
   (requires **Simplified ID Merge**, §1).
3. **Auth resolves.** `useAuth()` yields `auth0Id`, `planType`, `orgId`. Effect #2 runs:
   `identify(auth0Id)`; individuals get `plan` (super prop + People); org members get
   `org_id` and have `plan` cleared.
4. **Inside the app.** The `(app)` layout mounts `OrgStamps` (inside `OrgProvider`). It
   registers `org_id` as soon as it resolves, clears `plan`, calls
   `set_group("org_id", orgId)` (Group Analytics), and — once `orgPlanSettled` is true so
   an enterprise org is never transiently mis-stamped as `teams` — registers `org_tier`
   (super prop + People).
5. **Every navigation.** Effect #4 (`usePathname`) maps the path via `routeToScreen()` and
   fires `screen_viewed { screen }`; all current super properties attach automatically.
6. **Feature / decision events.** Call sites (wired incrementally) use `trackFeature(...)`
   / `trackBrowserEvent(...)`; same stamps attach automatically.
7. **Logout.** `isAuthenticated` flips false → effect #3 calls `resetAnalytics()` →
   `mixpanel.reset()` (drops identity + super props) then re-registers `surface: "web"`.
   The next anonymous session is not merged with the previous user.

## A.5 Event property schemas emitted by the browser today

- `screen_viewed` → `{ screen: <ScreenName> }` (+ stamps). Fires on the initial load and
  every client-side navigation. Screen names are **concepts, not routes**.
- `feature_used` → `{ feature: <FeatureName>, ...metadata }` (+ stamps). One event, one
  controlled `feature` enum (the Layer 4 list).
- Browser decision events (names declared, call-site wiring incremental): `signup_completed`,
  `onboarding_step_completed`, `activation_milestone`, `chat_message_sent`, `pin_created`,
  `highlight_created`, `agent_created`, `agent_wizard_abandoned`, `agent_published`,
  `agent_shared`, `brain_run_stopped`, `project_created`, `team_member_invited`,
  `share_created`, `connector_connect_attempted`, `credit_cap_set`, `model_toggled_off`,
  `checkout_started`.

`EventProps` is typed `Record<string, string | number | boolean | undefined>` — the type
system nudges toward IDs/enums; the **no-free-text** rule is a hard convention on top.

## A.6 Layer 1 screen registry (route → concept, as implemented)

`routeToScreen()` in `screens.ts`. Anything not listed returns `null` → **no event** (and
a dev-only console note). Trailing slashes are ignored.

| Route(s) | `screen` |
|---|---|
| `/chat` | `chat` |
| `/chats` | `chat_history` |
| `/brain`, `/brain/*` | `brain` |
| `/agents`, `/agents/templates`, `/agents/published`, `/agents/new` | `agent_library` |
| `/agents/basics/*` | `agent_onboarding` |
| `/agents/[id]/chat`, `/project/[id]/chat/*` | `chat` |
| `/agent/configure`, `/agent/configure/*` | `agent_configure` |
| `/projects`, `/projects/new` | `projects` |
| `/project/[id]` | `project_detail` |
| `/teams/[id]` | `teams` |
| `/org`, `/org/*` | `org_manage` |
| `/settings`, `/settings/account` | `settings_profile` |
| `/settings/connectors` | `settings_connectors` |
| `/settings/ai` | `settings_models` |
| `/settings/billing`, `/settings/billing/*` | `settings_billing` |
| `/settings/{help,files,preferences,notifications,security}` | `settings_<tab>` |
| `/onboarding` | `onboarding_start` |
| `/onboarding/team/*` | `onboarding_team_join` |
| `/onboarding/<step>` | `onboarding_<step>` (hyphens → underscores) |
| `/welcome` | `welcome` |
| `/slack/link` | `slack_setup` |
| `/share/[id]`, `/chat-shares/[id]` | `share_view` |

Pinboard is a **panel**, not a route — it is tracked via an event property later, not as
a screen.

## A.7 Safety model (why turning this on can't break the app)

- **No token ⇒ full no-op.** `analyticsEnabled` is false; `initAnalytics()` returns early;
  every helper short-circuits. This is exactly production's state until the PROD token is
  added.
- **Browser-only.** `ready()` checks `typeof window !== "undefined"`; SSR/RSC calls do
  nothing. The SDK is imported only in one `"use client"` module.
- **Fail-closed.** Every SDK call in `mixpanel.ts` is wrapped in `try/catch`; failures are
  swallowed (logged in dev only) so analytics can never throw into React.
- **Pass-through providers.** `MixpanelProvider` renders `children` unchanged;
  `OrgStamps` renders `null`. No existing component behavior changes.

## A.8 What this means for you (backend)

To make browser + backend events line up in one project:
1. Use the **same** `distinct_id` (Auth0 `sub`).
2. Emit the **same stamp keys/values** (`org_id`, `org_tier`, `plan`, `surface`) with the
   same omit-when-blank rule (§3).
3. Set `surface: "slack"` for Slack-originated work (or `web` for web-triggered server
   work), so the two doors remain distinguishable but joined by identity.
4. Attach the cost stamp (§4) on compute events — the browser never has this data.
