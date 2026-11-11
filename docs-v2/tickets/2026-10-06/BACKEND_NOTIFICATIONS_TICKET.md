# [Backend] In-app Notifications Service (store, API, preferences, model deprecation, team requests)

| Field | Value |
|---|---|
| Type | Feature / new service |
| Area | Backend (FastAPI), consumed by Front-end bell + panel |
| Priority | High (blocks several front-end notification types) |
| Front-end contact | _fill in_ |

---

## 1. Background

The front-end already has a notification bell, a panel ("Needs attention" + feed), toasts, and mark-read/dismiss with undo
(`front-end/src/context/notifications-context.tsx`, `src/lib/notifications/*`, `NotificationBell`, `NotificationPanel`).

Because the backend has **no notification system**, the front-end currently fakes it client-side:

- Polls `listAutomations()` / `getAutomation(id)` every 60s and builds schedule success/failure rows.
- Diffs `fetchPersonas()` against `fetchModelsWithCache()` to detect agents on retired/blocked models.
- `fetchTeamRequests()` is a stub returning `[]`.
- Read/dismissed/seen state lives in **localStorage per browser**, so it is lost across devices and cleared storage.
- Settings > Notifications page (`settings/(shell)/notifications/page.tsx`) is local `useState` only; nothing is persisted or enforced.

### What the backend has today (audit result)
- No Notification model/table/enum, no `/notifications` endpoint, no severity field, no websocket for the front-end.
- Only per-request SSE streams on chat/persona/LLM endpoints (`core/sse_schemas.py`, AG-UI), including prompt-type events (`user_prompt`, `question_prompt`, `permission_prompt`, `approval_prompt`, `tool_connect_prompt`), `RunError`, `stream_heartbeat`, `memory_updated`, `generated_file`, etc. These only exist while a chat stream is open.
- Out-of-band only: email (`core/email.py`, `templates/email/*.html`) and Slack (`services/automations/notify.py`, `services/slack/*`) for: automation run failed (+ auto-pause after 3 consecutive failures), team invitation, persona share, Slack installed, Slack member joined, enterprise invoice prep, assorted Slack notices.
- `EMAIL_UNSUBSCRIBE_URL` points to `{FRONTEND_BASE_URL}/settings/notifications`, but no backend settings endpoint exists behind it.
- Model catalog (`/models`, `/models/all`) has `blocked`, `model_plan_type`, `model_tags`, but **no deprecation date, replacement model, or release date**. Deprecation is only detectable after a model has already vanished from the catalog.

## 2. Goal

Introduce a persistent, per-user, server-side notification system so that:

1. Events that happen while the user is away (chat finished, automation failed, model deprecated, credits low...) are recorded and shown next time, on any device.
2. Read / dismissed state is synced per account, not per browser.
3. Users can control which categories reach them in-app and by email, enforced server-side.
4. Admin-directed requests (connector / credits / permission) have a real backend instead of a stub.
5. The model catalog exposes lifecycle data (deprecation date, replacement, release date) so we can warn **before** a model is removed.

### Non-goals (this ticket)
- Mobile / browser push notifications.
- Replacing the existing email templates. Email stays; we only add preference gating and de-duplication against in-app items.
- Changing existing SSE chat events. They remain as-is (the front-end will additionally create "chat finished/waiting" items from them, see 5.1).

## 3. Data model

### 3.1 `notifications` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | fk users | recipient. One row per recipient (fan out admin notifications per admin). |
| `org_id` | fk orgs, nullable | for org-scoped filtering |
| `type` | text/enum | see catalog in section 4 |
| `category` | text/enum | preference category, see 3.3 |
| `severity` | enum | `info`, `success`, `warning`, `error` |
| `actionable` | bool | true = an open problem; shows under "Needs attention" and must auto-resolve when fixed |
| `title` | text | short, plain text, <= 120 chars |
| `body` | text, nullable | <= 500 chars. **Never include secrets, tracebacks, tokens** (keep existing rule from `automations/notify.py`). |
| `href` | text | **relative** front-end route the item opens (e.g. `/agents?tab=my-personas&fixModel=<id>`). Do not store absolute URLs. |
| `dedupe_key` | text | stable key identifying the logical event/state, e.g. `agent-model:<persona>:<model>:<reason>`. Unique per `(user_id, dedupe_key)`. |
| `group_key` | text, nullable | lets the front-end bundle (e.g. all runs of one automation: `automation:<id>`) |
| `entity_type` / `entity_id` | text, nullable | e.g. `automation_run` / run id, `persona` / id, for lookups and resolve |
| `payload` | jsonb | type-specific extras (see catalog). Must be versioned-safe: front-end ignores unknown keys. |
| `created_at` | timestamptz | event time |
| `read_at` | timestamptz, nullable | |
| `dismissed_at` | timestamptz, nullable | |
| `resolved_at` | timestamptz, nullable | set when an actionable condition is fixed; resolved items drop out of "Needs attention" |
| `expires_at` | timestamptz, nullable | TTL, see retention |

Indexes: `(user_id, created_at desc)`, `(user_id, read_at)`, `unique(user_id, dedupe_key)`, `(entity_type, entity_id)`.

### 3.2 Behaviour rules
- **Idempotent create:** inserting with an existing `(user_id, dedupe_key)` updates (`title/body/payload`, bumps `created_at` only if specified by the type) instead of creating a duplicate.
- **Resolve:** actionable notifications are resolved by the owning service when the condition clears (agent model changed, connector reconnected, credits topped up, automation resumed). Resolution sets `resolved_at`; front-end hides it from "Needs attention".
- **Retention:** default `expires_at` = 30 days for non-actionable; actionable items persist until resolved (cap 90 days after resolution). Provide a daily cleanup job.
- **Cap:** list endpoint returns at most 50 items by default; never drop unresolved actionable ones from the page.
- **Fan-out:** admin-directed events create one row per admin recipient.

### 3.3 `notification_preferences` table (one row per user per category)

| Column | Type |
|---|---|
| `user_id` | fk |
| `category` | enum |
| `in_app` | bool |
| `email` | bool |
| `updated_at` | timestamptz |

Defaults and locks (match the existing Settings > Notifications page):

| Category | In-app default | Email default | Notes |
|---|---|---|---|
| `automation-complete` | on | on | |
| `automation-failed` | on | on | |
| `chat` (finished / waiting on you) | on | off | **new** |
| `agent-model` (retired / blocked / deprecating) | on | on | **new** |
| `model-release` (new model available) | on | off | **new** |
| `connector` (reconnect needed, paused) | on | on | **new** |
| `file-processed` | on | off | |
| `memory-updated` | off | on | |
| `budget-alert` | on | off | thresholds configurable: 65 / 90 / 100 % |
| `team-invite`, `persona-invite`, `workflow-invite` | on | on | |
| `requests` (admin: connector / credits / permission) | on | on | **new** |
| `payment-successful`, `payment-failed` | on | **on, locked** | email cannot be disabled |
| `pin-created` | on | off | behind `PINS_ENABLED` flag |

Rule: when creating a notification, check preferences. `in_app=false` -> do not insert (or insert hidden; see open question 9.3). `email=true` -> send email via existing `send_email`, once, using the same `dedupe_key` to avoid duplicates with templates already sent today.

## 4. Notification type catalog

`Priority`: **NA** = needs attention (`actionable=true`), **N** = normal, **L** = low / no toast.
`Producer` = where in the backend the notification should be created.

### 4.1 Automations / schedules
| Type | Sev | Prio | Trigger / producer | dedupe_key | group_key | href | payload |
|---|---|---|---|---|---|---|---|
| `automation.run_succeeded` | success | N | run finishes OK (`services/automations/runner.py`) | `schedule-run:<runId>` | `automation:<id>` | `/schedules?selected=<id>` | `automation_id, run_id, name, duration_s` |
| `automation.run_failed` | error | NA | run fails (`runner.py:~496`, alongside `reportFailure`) | `schedule-run:<runId>` | `automation:<id>` | same | `automation_id, run_id, name, will_retry, one_off` (**no failure detail**) |
| `automation.auto_paused` | warning | NA | `pauseAfterFailures` after `CONSECUTIVE_FAILURE_LIMIT` (3) | `automation-paused:<id>` | `automation:<id>` | same | `automation_id, consecutive_failures`. Resolve when the user resumes it. |
| `automation.stuck` | warning | NA | run in `running` longer than threshold (config, suggest 2x p95 or 30 min) | `automation-stuck:<runId>` | `automation:<id>` | same | `automation_id, run_id, running_since`. Resolve when run ends. |
| `automation.one_off_completed` | info | N | one-off/`once` automation finished | `automation-once:<id>` | n/a | same | `automation_id` |

### 4.2 Agents (personas) and models
| Type | Sev | Prio | Trigger / producer | dedupe_key | href | payload |
|---|---|---|---|---|---|---|
| `agent.model_retired` | error | NA | persona's `modelId` no longer in catalog (on model removal job + nightly reconcile) | `agent-model:<personaId>:<modelId>:retired` | `/agents?tab=my-personas&fixModel=<personaId>` | `persona_id, persona_name, model_id, model_name, replacement_model_id?` |
| `agent.model_blocked` | error | NA | model `blocked=true` (org admin block endpoint) | `agent-model:<personaId>:<modelId>:blocked` | same | same |
| `agent.model_deprecating` | warning | NA | model has `deprecation_date` within N days (default 30, then 7, then 1: three distinct notifications) | `agent-model:<personaId>:<modelId>:deprecating:<window>` | same | `..., deprecation_date, days_left, replacement_model_id?` |
| `model.deprecating_selected` | warning | N | user's default / last-used chat model is deprecating | `model-selected:<modelId>:deprecating:<window>` | `/settings/ai` | `model_id, deprecation_date, replacement_model_id?` |
| `model.auto_switched` | info | N | user's selected model removed and fallback applied (`model-fallback` path) | `model-switch:<modelId>:<ts-bucket>` | `/settings/ai` | `from_model_id, to_model_id` |
| `model.released` | info | L | new model added to catalog and visible to the user's plan | `model-released:<modelId>` | `/settings/ai` | `model_id, model_name, company, tags` |
| `model.access_changed` | info | L | plan/org change locks or unlocks models (`model_plan_type`) | `model-access:<modelId>:<state>` | `/settings/ai` | `model_id, state` |
| `agent.shared_with_me` | info | N | persona share created (`services/persona_share`) | `persona-share:<shareId>` | `/agents?tab=shared` | `share_id, persona_name, sharer_name` |
| `agent.share_update` | info | L | a share you sent was accepted / revoked | `persona-share:<shareId>:<state>` | same | `share_id, state` |

Resolve rules: `agent.model_*` resolves when the persona's `modelId` changes to a healthy model or the persona is deleted. Notify the **persona owner**, and for org-shared agents also org admins (open question 9.4).

### 4.3 Connectors
| Type | Sev | Prio | Trigger | dedupe_key | href | payload |
|---|---|---|---|---|---|---|
| `connector.reconnect_required` | warning | NA | account status becomes disconnected / not active / token refresh fails | `connector:<accountId>:reconnect` | `/connectors?reconnect=<slug>` | `connector_slug, display_name, account_label`. Resolve on successful reconnect. |
| `connector.paused` | info | N | admin pauses a connector for the workspace | `connector:<slug>:paused` | `/connectors` | `connector_slug, paused_by` |

### 4.4 Team, sharing, requests
| Type | Sev | Prio | Trigger | dedupe_key | href | payload |
|---|---|---|---|---|---|---|
| `team.invite_received` | info | N | org/team invite to an existing user (`organizations/service.py:636`) | `team-invite:<inviteId>` | `/team-invite/<id>` | `invite_id, team_name, inviter_name, role` |
| `team.member_joined` | info | L | invite accepted (to admins) | `member-joined:<userId>` | `/settings/members` | `member_name` |
| `team.role_changed` / `team.removed` | info / warning | N | role change or removal | `role:<userId>:<ts>` | `/settings/members` | `new_role` |
| `chat.shared_with_me` | info | N | chat share created | `chat-share:<shareId>` | `/chat-shares/<shareId>` | `sharer_name, title` |
| `project.shared_with_me` | info | N | added as project member | `project-member:<projectId>:<userId>` | `/project/<id>` | `project_name, inviter_name` |
| `request.connector` | info | NA | teammate requests a connector (to admins) | `request:<requestId>` | `/settings/requests/<id>` | `requester_name, connector_slug, reason?` |
| `request.credits` | info | NA | teammate requests credits (to billing admins; **replaces the Slack-DM-only flow**, keep the DM as a secondary channel) | `request:<requestId>` | same | `requester_name, amount?, reason?` |
| `request.permission` | info | NA | teammate requests a permission | `request:<requestId>` | same | `requester_name, subject, reason?` |
| `request.resolved` | success / info | N | requester's request approved / denied | `request:<requestId>:resolved` | origin page | `state, decided_by` |

Resolve rule for `request.*`: resolved the moment any admin approves/denies it (resolve for **all** admins who were notified).

### 4.5 Billing and credits
| Type | Sev | Prio | Trigger | dedupe_key | href | payload |
|---|---|---|---|---|---|---|
| `credits.low` | warning | NA | remaining credits <= 10% (matches front-end `use-credit-status`), plus `budget-alert` thresholds 65 / 90 / 100 % of budget | `credits:<scope>:<threshold>:<period>` | `/settings/plans-and-billing` | `scope(user/org), remaining_pct, threshold` |
| `credits.exhausted` | error | NA | credits reach 0 | `credits:<scope>:exhausted:<period>` | same | same |
| `payment.failed` | error | NA | Stripe `invoice.payment_failed` webhook | `payment:<invoiceId>:failed` | `/settings/billing` | `invoice_id, amount, reason_code` (no card data) |
| `payment.succeeded` | success | L | Stripe `invoice.paid` | `payment:<invoiceId>:paid` | `/settings/billing` | `invoice_id, amount` |
| `plan.changed` / `plan.trial_ending` | info / warning | N | plan change / trial ends in 3 days | `plan:<ts>` | `/settings/plans-and-billing` | `old_plan, new_plan, trial_end?` |

Credits resolve on top-up / new period.

### 4.6 Slack, files, memory
| Type | Sev | Prio | Trigger | dedupe_key | href | payload |
|---|---|---|---|---|---|---|
| `slack.link_required` | warning | NA | user in a linked workspace has not linked their account | `slack-link:<teamId>` | `/slack/link` | `team_name` |
| `slack.disconnected` | warning | N | workspace disconnected | `slack-disc:<teamId>:<ts>` | `/souvenir-slack` | `team_name` |
| `file.processed` / `file.failed` | success / error | L / NA | knowledge indexing finished/failed. **Requires a processing-status field on files (currently none).** | `file:<fileId>:<state>` | file location | `file_name, project_id?` |
| `memory.updated` | info | L | memory written outside an open chat (SSE `memory_updated` only reaches open streams) | `memory:<scope>:<version>` | `/settings/preferences` | `scope, version` |

### 4.7 Chat
Chat events (`chat.finished`, `chat.waiting_on_you`, `chat.failed`) are **created by the front-end** from the SSE stream while the tab is open (see 5.1), so the minimum backend ask is only that the stream **persists the outcome** (turn status). Server-side creation is a follow-up if we want these when **no tab is open** (long background tasks). See open question 9.5.

## 5. API specification

All endpoints authenticated as the current user; scoped to the caller only. JSON, snake_case (match existing API style). Errors follow existing error format.

### 5.1 List
`GET /notifications`

Query: `limit` (default 50, max 100), `cursor`, `unread_only` (bool), `type`, `category`, `include_dismissed` (default false), `include_resolved` (default false), `since` (ISO timestamp).

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "agent.model_retired",
      "category": "agent-model",
      "severity": "error",
      "actionable": true,
      "title": "Agent \"Sales Helper\" uses a retired model",
      "body": "gpt-x was removed. Pick a new model to keep it working.",
      "href": "/agents?tab=my-personas&fixModel=p_123",
      "group_key": null,
      "payload": { "persona_id": "p_123", "model_id": "gpt-x", "replacement_model_id": "gpt-y" },
      "created_at": "2026-10-06T09:12:00Z",
      "read_at": null,
      "dismissed_at": null,
      "resolved_at": null
    }
  ],
  "next_cursor": null,
  "counts": { "unread": 4, "unseen": 2, "needs_attention": 1 }
}
```
Ordering: newest first; unresolved actionable items always included regardless of limit.

### 5.2 Counts (cheap poll for the bell badge)
`GET /notifications/counts` -> `{ "unread": n, "unseen": n, "needs_attention": n, "last_seen_at": "..." }`

### 5.3 State changes
| Method + path | Body | Effect |
|---|---|---|
| `POST /notifications/{id}/read` | none | set `read_at` |
| `POST /notifications/{id}/unread` | none | clear `read_at` |
| `POST /notifications/read-all` | `{ "before": ts? }` | mark all read; returns `{ "ids": [...] }` so the front-end can **undo** |
| `POST /notifications/{id}/dismiss` | none | set `dismissed_at` |
| `POST /notifications/{id}/restore` | none | clear `dismissed_at` (undo) |
| `POST /notifications/seen` | none | set `last_seen_at = now` (bell badge "unseen" reset when panel opens) |

All idempotent. Return the updated item (or ids list for bulk).

### 5.4 Preferences
- `GET /notifications/preferences` -> `{ "categories": [{ "category": "...", "in_app": true, "email": true, "email_locked": false }] , "budget_thresholds": [65,90,100] }`
- `PUT /notifications/preferences` -> body is the same shape; reject attempts to disable locked flags (`payment-*` email) with 422.
- Unsubscribe link in emails (`EMAIL_UNSUBSCRIBE_URL`) should be a signed one-click endpoint `GET /notifications/unsubscribe?token=...` that disables email for that category without login, plus keeps the front-end route `/settings/notifications` for the UI.

### 5.5 Real-time delivery (phase 2)
Add one SSE (or websocket) endpoint, `GET /notifications/stream`, emitting `notification.created`, `notification.updated`, `notification.resolved` with the same item shape, so the front-end can drop the 60s polling. Until then the front-end polls `GET /notifications/counts` every 60s and refetches the list when counts change. Include `Last-Event-ID` resume support.

### 5.6 Team requests
| Method + path | Notes |
|---|---|
| `POST /requests` | body `{ "type": "connector\|credits\|permission", "subject": "...", "reason": "...", "amount"?: n }`; creates request + notifies admins (fan-out) |
| `GET /requests` | admin: pending/all in org; member: own requests |
| `POST /requests/{id}/approve` and `/deny` | admin only; optional `note`; resolves all admin notifications for it and notifies requester |

Replaces the `fetchTeamRequests()` stub. Credit requests keep the Slack DM as a secondary channel.

## 6. Model catalog changes (required for deprecation / new-model notifications)

Extend `/models` and `/models/all` items with (all nullable, backwards compatible):

| Field | Type | Meaning |
|---|---|---|
| `released_at` | timestamptz | when the model became available |
| `deprecation_date` | timestamptz | announced retirement date |
| `status` | enum `active\|deprecating\|retired` | derived or stored |
| `replacement_model_id` | text | recommended migration target |

Also add admin tooling (or a seed/config path) to set these, and:

- **Scheduled job** (daily): for each model with `deprecation_date`, find affected personas (`persona.modelId`), users' default models, and automations/agents using it; emit the windowed notifications (30 / 7 / 1 days) with dedupe so each window fires once.
- **On model removal / block**: immediately emit `agent.model_retired` / `agent.model_blocked` and resolve the earlier `deprecating` items.
- **On new model**: emit `model.released` to users whose plan can access it (respect `model_plan_type`), rate-limited to avoid spamming if many models are added at once (bundle into one "N new models" item via `group_key`).
- **Nightly reconcile job**: recompute actionable `agent.model_*` items against current state to self-heal missed events.

## 7. Implementation notes

- Add a `NotificationService.create(user_ids, type, ...)` used by all producers; it handles preference lookup, dedupe, email dispatch, and (phase 2) SSE publish. Producers must **never raise** because of notification failures (same contract as `core/email.py:send_email`).
- Producers to wire (existing code locations): `services/automations/runner.py` + `notify.py`, `services/persona_share/service.py`, `services/organizations/service.py`, `services/slack/service.py`, billing/Stripe webhook handler, model catalog/block endpoints, connectors service, files processing.
- Email: keep existing templates; route them through the service so the preference check and `dedupe_key` apply. Do not send an email for a notification the user already read in-app within a short grace period (optional, see 9.6).
- Security/privacy: notification text must not contain secrets, tokens, tracebacks, or other users' private content. Org notifications only to members of that org. Validate `href` is a relative path starting with `/`.
- Performance: counts endpoint must be an index-only query; the list endpoint paginated by cursor.
- Migration: new tables + Alembic migration; backfill is **not** required (front-end can derive history). On deploy, run the reconcile job once to seed actionable model-health items.
- Observability: log creates/dedupe hits per type; Sentry on service errors; metric for notification creation rate per type.

## 8. Acceptance criteria

1. `notifications` and `notification_preferences` tables exist with the constraints above; migration is reversible.
2. `GET /notifications`, `/counts`, read / unread / read-all / dismiss / restore / seen all work, are idempotent, and only return the caller's own data. Bulk endpoints return ids for undo.
3. Creating the same logical event twice (same `dedupe_key`) yields one row.
4. Actionable notifications are resolved automatically when the condition clears and no longer appear in "Needs attention".
5. Preferences are persisted; disabling in-app for a category stops new in-app items; locked email flags (`payment-*`) cannot be disabled (422).
6. The following types are produced end to end: `automation.run_succeeded`, `automation.run_failed`, `automation.auto_paused`, `agent.model_retired`, `agent.model_blocked`, `agent.model_deprecating`, `connector.reconnect_required`, `credits.low`, `credits.exhausted`, `payment.failed`, `team.invite_received`, `agent.shared_with_me`, `request.*`. The remaining types in section 4 may follow in a second iteration.
7. `/models` returns `released_at`, `deprecation_date`, `status`, `replacement_model_id`; the daily job emits 30 / 7 / 1-day deprecation notices exactly once per window per affected agent owner.
8. `POST /requests` + approve/deny replace the front-end stub; admins are notified, the requester is told the outcome, all admin copies resolve on first decision.
9. No notification contains secrets/tracebacks; `href` always relative.
10. Unit tests for dedupe, preference gating, resolve, fan-out; API tests for each endpoint; documented in OpenAPI so the front-end can generate types.

## 9. Open questions (need a decision before / during implementation)

1. **Naming/casing:** confirm `snake_case` + dotted `type` strings are acceptable (front-end currently uses kebab-case kinds like `schedule-failed`; it will map).
2. **Quiet hours / digest:** out of scope now. OK to defer?
3. When `in_app=false`, do we skip insertion entirely, or insert as hidden so enabling the preference later shows history?
4. **Who is notified for agent model issues** on org-shared agents: owner only, or owner plus org admins?
5. **Chat completion when no tab is open:** do we want server-side `chat.finished` / `chat.waiting_on_you` creation (needs turn-completion hook), or front-end only for now?
6. Email de-dupe grace period (e.g. skip email if read in-app within 10 min)?
7. Retention values (30 days / 90 days) and per-user cap.
8. Deprecation windows (30 / 7 / 1) and the "stuck run" threshold: confirm product values.
9. Where do `released_at` / `deprecation_date` come from: manual admin entry or synced from model providers?

## 10. Suggested delivery plan

1. **Phase 1 (core):** tables, `NotificationService`, list/counts/state/preferences endpoints, automation + persona-share + invite producers, model catalog fields, `/requests`.
2. **Phase 2:** model deprecation job + reconcile job, connector, credits and billing producers, email routing through the service, signed unsubscribe endpoint.
3. **Phase 3:** `/notifications/stream` (SSE), server-side chat events, files/memory/Slack types, digest/quiet hours.

## 11. Front-end follow-ups (tracked separately, for reference)

- Replace `src/lib/notifications/sources.ts` polling/derivation with the new API; keep `build.ts` bundling by `group_key`.
- Replace localStorage read state (`read-state.ts`) with server state.
- Wire Settings > Notifications to the preferences API; add the new categories.
- Chat finished / waiting / failed items created from SSE.
