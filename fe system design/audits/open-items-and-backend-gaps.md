# Open items and backend gaps (all features)

One place for what is still open after each audit's fixes, and what only the backend can do. Each audit's own Status block has the detail; this file is the roll-up. Updated as Phase 2 progresses.

Last updated: Oct 14 2026.

## Shared foundation (Phase 2, Step 0)

- Done: `lib/query-keys.ts`, `lib/query-policy.ts`, `lib/query-invalidation.ts` (see the Credits audit Status).
- Done: `credits:updated` and `MODELS_CACHE_BUSTED_EVENT` are gone (query invalidation, cross-tab).
- Open: `persona:chat-*`, `project:chat-title-updated`, `chat-url-updated` window events (sidebar/chat page; move with a chat detail query).

## Per feature

### Agents
- Open: performance budget; accessibility pass.

### Credits and billing
- Open: org plan query (with Organizations); one credits source (blocked on the `CreditBalance` gap); Phases 3–4. `USAGE_RATIO` kept until the backend serves plans.
- Backend gaps:
  - No plans endpoint (ids, prices, credits per interval); the client keeps the ladder and markup.
  - No idempotency key on `/stripe/checkout`, `/stripe/plan`, `/stripe/enterprise/setup`; the client guard covers one tab only.
  - No single `CreditBalance` shape (Phase 2.4).
  - No server-confirmed checkout state to replace the `souvenir_checkout_complete` cookie (Phase 2.5).

### Projects
- Open: chats normalised by id shared with chat history (with Chat Phase 2), page splits, keyboard test of scope/sort dropdowns, edit rights for shared-project collaborators (needs member list).
- Backend gaps: `size_bytes` on project documents (removes HEAD requests and the localStorage size cache).

### Schedules
- Open: removing the link store (needs `chat_id` on list rows), component split, RHF form, folder rename, analytics, run paging.
- Backend gaps:
  - `schedule_json` should carry structured `hour`/`minute`/`day`.
  - `GET /automations` rows should include `chat_id` (removes the localStorage link store).
  - Paging params for run history on `GET /automations/{id}`.

### Templates
- Open: Phase 3 (analytics event, TTFB budget, size cap, rate limit, `features.md` fix).
- Backend gaps: unescape HTML entities in stored titles; rate limit and size cap on `/templates/{id}/html`.

### Personas and Share
- Open: route-level `loading`/`error`/`not-found` files (with the server-rendered preview), Phases 2–4. The accept page loads the whole model catalogue for one model name.
- Done (Phase 2): shared shares query, server-rendered accept preview, shared Skeleton. Open: chat shares on React Query (with Chat).
- Backend gaps: an unauthenticated preview (name, sender, image) for link unfurls; `model_name` in share preview; snapshot option and live-view flag for chat shares; sender setting for prompt visibility on the preview; rate limits on preview and accept; backend upload limits matching the proxy (10 files, 30 MB each).

### Organizations
- Open: split `OrgProvider` into identity/plan/members contexts, multi-org selection (backend), paging (backend), component splits and forms; `AppLayout` `isAdminPage` `/org` check.
- Backend gaps: confirm whether a user can belong to several orgs (`listOrganizations()[0]` still used); cursor paging and search for members and audit log.

### Connectors
- Done (Phase 2): React Query in place of the three caches, invalidation via `bustConnectorCatalogCache`, poll jitter.
- Open: component splits, `canManage`, setup state-machine tests, budget, reconnect nudges; status badges visual only (a11y pass).
- Backend gaps: lighter link-status endpoint for polling (2.4); dependency counts for an account (Remove modal).

### Chat
- Done (Phase 2): chat list on React Query, provider removed. Open: screen-reader pass with `role="log"`; one UI-state store (needs `npm install zustand` approval); narrower contexts (needs a Profiler pass); chat detail on React Query; Phases 3–4.
- Backend gaps: resumable streams (`Last-Event-ID` or cursor on chat SSE); `Idempotency-Key` on message sends before any send retry.

### Compare
- Done (Phase 2): models via the shared query.
- Waiting for approval (large rework): shared markdown renderer, shared streaming transport, per-model run store.
- Open: component split, fixed width 1212; Esc inside the filter dropdown may close the modal.
- Backend gaps: none so far.

### Global search
- Done (Phase 2): ranking + diacritics + all-term highlight, loaded-chats notice with load-more, shared agent-chat cache, stale result fallback, persisted recents.
- Open: modal keyboard/focus tests, `setTimeout` focus, modal split, CSS hover; highlight-context fan-out (skipped Pinboard area).
- Backend gaps: search endpoint for chat titles and message content with cursor paging; one endpoint for "all my agent chats".

### Prompt enhancement
- Done (Phase 2): Zod limits on the refine payload.
- Waiting for approval (split of the 937-line `EnhancePromptField`): `useEnhanceFlow` reducer, `useMutation`, undo, lazy views.
- Open: focus move into the panel on state change; streaming, per-hunk diff.
- Backend gaps: length limits on `EnhancePromptRequest` (prompt, answers); SSE streaming of the draft (Phase 3); confirm `/persona/enhance-prompt` returns 402 when credits run out.

### AI Models
- Done (Phase 2): `["models"]` query, bust event removed, selection store with cross-tab sync, `model_selected`/`model_fallback` events, one context-window formatter.
- Open: listbox a11y in the four chat selectors (Phase 3.1 merge), selector popover boundaries.
- Backend gaps: confirm which endpoints still emit legacy camelCase model fields; a stable provider slug on each model (for icon mapping); a field for org-enforced blocks (4.3).

### Auth
- Done (Phase 2): route-policy table, deep-redacting `logger.event`, login/refresh/expiry counters, one client profile query, `useAuthReady()`.
- Open (front-end): gate TTFB budget; wider `useAuthReady()` adoption.
- Backend gaps: "profile completed" flag (replaces first/last-name heuristic); server-attached tokens (true BFF) and signed upload URLs (Phase 3); distinct `mfa_required`/`login_required` errors.

### Internal and API routes
- Done (Phase 2): all backend calls through `lib/server/backend.ts`, Zod form schemas, request ids + structured upstream logs, proxy/SSE route tests.
- Open: rate limiting and Origin checks (edge/Vercel config), `/api/health`, startup config validation, OpenAPI types, scripts README, excluding dev routes from the build.
- Backend gap / contract: chat create/stream don't accept `system_prompt` (they take `system_instruction`), `temperature`, `tone_id` or `web_search`, which `/api/chat` sends; decide which side changes.

### Settings
- Done (Phase 2): `["me"]` query followed by AuthProvider (the `credits:updated` event is gone), save seeds the profile, duplicate tone picker removed.
- Open: RHF + Zod forms, `useAccountForm`, lazy avatar tools, URL tab state, duplicate billing confirmation routes.
- Backend gaps: no endpoints for notification preferences, sessions / sign out other devices, file storage usage, custom instructions / default model.

### Analytics
- Done (Phase 2): typed event props, dashboard on React Query via useOrg, UTC cycle labels, `tab` on `org_manage`, `template_view` screen.
- Open: consent gating, retention docs.
- Backend gaps: org usage time series (per day, per feature) for a real chart and date ranges.

### Skipped by request
Pinboard, Slack, Onboarding, Notifications.
