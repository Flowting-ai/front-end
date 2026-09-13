# Automations Endpoints — Frontend Usage Map

Cross-references every `/automations` backend endpoint against how the front-end calls it: wrapper function (in `src/lib/api/automations.ts`) and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md), [`brain-endpoints-usage.md`](./brain-endpoints-usage.md), and [`slack-endpoints-usage.md`](./slack-endpoints-usage.md).

Like `brain.ts`, `automations.ts` builds its own endpoint path strings locally rather than importing shared `config.ts` constants — there's no `config.ts` entry for any of these. In the UI, "automations" are branded as **Schedules** — the backend/API name and the user-facing name differ, which is worth knowing before searching the codebase for one and not finding the other.

5 endpoints exist in this group. **All 5 are actively used** — a fifth fully-live group, alongside `highlights`, `stripe`, `projects`, and `brain`.

---

## `GET /automations` (List)
- **Path builder**: `AUTOMATIONS_BASE`
- **Wrapper**: `listAutomations()` (`automations.ts`)
- **Used by**:
  - `brain/schedules/page.tsx` — loading the full Schedules list on the dedicated Schedules page.
  - `brain/page.tsx` and `brain/threads/page.tsx` — lighter-weight loads used to show scheduled-task chips/badges in the Brain chat UI and thread list.
  - `components/layout/LeftSidebar.tsx` — populating the sidebar's Schedules section.

## `GET /automations/{automation_id}` (Get)
- **Path builder**: `AUTOMATION_BY_ID(id)`
- **Wrapper**: `getAutomation(id)` (`automations.ts`) — returns the automation plus its run history.
- **Used by**:
  - `brain/schedules/page.tsx` — loading a single schedule's full detail (run history included) when the user selects it from the list, and again after **Run now** (below) to refresh `run_count`/history with the new run.
  - `brain/page.tsx` and `LeftSidebar.tsx` — fetching detail for a small set of recent scheduled tasks to render richer previews (name/status) than the list endpoint alone provides.

## `PATCH /automations/{automation_id}` (Update)
- **Path builder**: `AUTOMATION_BY_ID(id)`
- **Wrapper**: `updateAutomation(id, body)` (`automations.ts`) — typed to accept `is_active`/`name`/`prompt`, i.e. pause/resume, rename, or rewrite what the automation does.
- **Used by**: `brain/schedules/page.tsx`'s `handleToggleActive()` — clicking the **Pause**/**Resume** toggle on a schedule's detail view. Applied optimistically, with rollback + a toast (e.g. "resuming a schedule with no future run" surfaces as a 409) on failure.
- **Nuance**: the only real call site ever sends `{ is_active }`. The `name`/`prompt` fields the wrapper and backend both support are never actually populated by any current UI — there's no "rename this schedule" or "edit its prompt" control wired up yet, even though the endpoint and its typed payload are ready for one.

## `DELETE /automations/{automation_id}` (Delete)
- **Path builder**: `AUTOMATION_BY_ID(id)`
- **Wrapper**: `deleteAutomation(id)` (`automations.ts`) — drops the trigger and retires the schedule; past runs are kept.
- **Used by**: `brain/schedules/page.tsx`'s delete flow — removing a schedule from the list. Optimistically removed from state first; a schedule that only exists locally (never yet persisted to the backend) is dropped with no network call at all, and a real deletion that fails restores the row with an error toast.

## `POST /automations/{automation_id}/run` (Run Now)
- **Path builder**: `AUTOMATION_RUN(id)`
- **Wrapper**: `runAutomationNow(id)` (`automations.ts`)
- **Used by**: `brain/schedules/page.tsx`'s `handleRunNow()` — clicking **Run now** on a schedule's detail view to trigger an out-of-band run immediately rather than waiting for its next scheduled time. Local-only (unsaved) schedules are blocked client-side with an info toast instead of attempting the call.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /automations` | Live — `listAutomations()` |
| `GET /automations/{id}` | Live — `getAutomation()` |
| `PATCH /automations/{id}` | Live — `updateAutomation()`; only the `is_active` field is ever sent, `name`/`prompt` are unused by any current UI |
| `DELETE /automations/{id}` | Live — `deleteAutomation()` |
| `POST /automations/{id}/run` | Live — `runAutomationNow()` |

All 5 endpoints are actively used. The only nuance: `PATCH /automations/{id}` supports renaming and prompt-rewriting, but the sole call site (the pause/resume toggle on the Schedules page) only ever exercises the `is_active` field.
