# Notifications: System Design Audit

Scope: `context/notifications-context.tsx` (361), `lib/notifications/{types,build,sources,read-state,dev}.ts` (~490), `components/NotificationBell` (226), `NotificationPanel` (671), `BellRingIcon`, dev playground `app/(app)/dev/notifications` (355). About 2,400 lines. (The Settings "Notifications" preferences page is covered in the Settings audit and is not wired.)
Method: context, read-state, sources head, dev gating, and the toast/derivation sections read in full; Bell and Panel checked by grep metrics. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~57% (16.4 / 29 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.5 | 75% |
| 2. Architecture | 8 | 4.5 | 56% |
| 3. Component Patterns | 2 | 1.3 | 65% |
| 4. Data Model | 8 | 5.1 | 64% |
| 5. Interfaces and APIs | 3 | 1.8 | 60% |
| 6. Optimizations | 6 | 2.2 | 37% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, forms, BFF.

## How it works

There is no notifications backend. The client **derives** notifications from existing sources: schedule runs (`listAutomations`, details only for automations that ran recently), agent model health (`fetchPersonas` + models catalogue), and team requests (typed slot, endpoint not available yet, returns `[]`). It polls every 60 s while the tab is visible (and on focus after 20 s), bundles and caps the result, and keeps read/seen/dismissed state per user in localStorage with cross-tab sync.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| External store for read state (#28, #36) | `useSyncExternalStore` over a localStorage-backed store with a same-tab event and the native `storage` event for other tabs; server snapshot is `null` so SSR is safe |
| Clear data model | `baseline` (older informational rows start read), `seenAt` (bell number vs per-row unread, GitHub/Slack model), `read`/`unread` overrides, `dismissed`, `firstSeen` (stable timestamps for open problems) |
| Bounded storage (#32) | `MAX_IDS = 500` per list; corrupt entries parsed defensively and reset; each storage call wrapped in try/catch |
| Privacy | Storage key uses a short non-reversible hash of the identity so the email is not in key names |
| Efficient polling (#53) | Polls only while `document.visibilityState === 'visible'`, immediate refresh on focus if stale, `pollId` guards against out-of-order responses |
| Cheap steady state | Schedule details fetched only for automations whose run signature changed; cache map per user cleared on user change |
| Pure derivation | `build.ts` (`agentModelNotifications`, `bundleNotifications`, `requestNotifications`, `finalizeNotifications`) separates logic from fetching and rendering |
| Reversible actions (#33) | `markAllRead` and `dismiss` return an undo; mark-unread works on old rows |
| Arrival toasts | New unread items announced once after the first full load: one toast with a direct "View", or one summary toast for several; severity picks `error`/`warning`/default; `readState` omitted from deps so mark-read never re-announces |
| Role-aware sources | Admin-only requests fetched only if `orgRole === 'admin'`; refetch when role changes |
| Decoupled opening | `openNotificationsPanel()` event lets a toast open the bell panel from anywhere, with a fallback when no bell is mounted |
| Guarded navigation | Uses `useGuardedRouter` so clicking a notification respects unsaved-changes prompts |
| Dev tooling (#21) | Dev fixtures and `/dev/notifications` playground are inert/404 in production (`NODE_ENV` checks) |
| Accessibility (#20) | Panel has 13 `aria-*`, roles and focus handling (6 references) |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Server state (#30, #38) | Polling logic, in-flight guards and per-source state are hand-written (`pollIdRef`, `lastPollRef`, `scheduleCacheRef`, `agentsAttempted` flags); sources duplicate fetches other features already make (`fetchPersonas`, `listAutomations`, models catalogue) | Subscribe to the same React Query caches (`["personas"]`, `["automations"]`, `["models"]`) with `refetchInterval` and `refetchOnWindowFocus`; derive notifications from them with `select` |
| Provider design (#24) | 361-line provider with 4 pieces of state, 7+ refs and mirrored-role effects; the value is a large object rebuilt from memos (verify memoisation) | Split `useNotificationSources()` (data) from `NotificationsStore` (read state) and the toast announcer component |
| Component architecture (#12) | `NotificationPanel` 671 lines | Split list, row, header, empty state, settings link |
| Accessibility (#20) | No `aria-live` region: toasts are announced by Sonner but badge changes are not; bell has 2 `aria-*` and no focus management noted (verify focus return after closing the panel) | `aria-live="polite"` for the count, `aria-expanded`/`aria-controls` on the bell, focus return to the trigger |
| Error handling (#45) | Source failures are swallowed (`.catch(() => {})`, `catch { return null }`), so a failing source is silent forever; the agent source can also treat a failed catalogue fetch as "empty" (documented in a comment) | Track per-source error state; show a quiet "some notifications unavailable" row and log |
| Observability (#55) | No analytics (opened panel, clicked notification, dismissed, mark all read) and no tracking of poll failures | Typed events via `trackFeature` with the notification kind enum |
| Multi-tab polling | Every open tab polls independently every 60 s | Leader election (`BroadcastChannel`/`navigator.locks`) so one tab polls and shares |
| Large derived list | The feed is capped and bundled, but built by re-running over all sources on each poll (verify cost on large orgs) | Memoise by source signature; `useDeferredValue` for panel rendering |
| Panel loading (#7) | `loading` flag until first poll; skeleton not evident | Skeleton rows in the panel |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Notifications are client-synthesised and per-browser | Read state lives in localStorage "until notifications have a backend": a user sees different unread states across devices, and a cleared browser re-baselines; events that never touch the polled sources (invite accepted, credits low, share viewed, connector expired) cannot appear | Backend notification feed (id, kind, payload, created_at) plus `PATCH read`; keep the client store for optimistic state. Until then document the limits |
| User key from email | `identity = user?.email` hashed with a simple 32-bit djb2 hash; collisions are possible and the rest of the app keys by Auth0 `sub` | Use the Auth0 `sub` (or backend user id) with a stronger hash; migrate old keys |
| Polling cost | Each poll calls `listAutomations`, `fetchPersonas`, models catalogue, and team requests (when admin) every 60 s per tab, on top of other pages' own fetches of the same data | Share caches (React Query); or a single lightweight `GET /notifications/summary` |
| Mirrored refs for roles | `isAdminRef`, `canSeeRequestsRef` and a `rolesRef` effect re-trigger loads on role change | Query keys including role; the library refetches automatically |
| Render-time state reset | `if (feedUserKey !== userKey) { setFeedUserKey(...); setScheduleRows(null) ... }` during render | Valid React pattern but easy to break; replace by keying the provider with `userKey` (`<NotificationsProvider key={userKey}>`) |
| `fetchTeamRequests` stub | Returns `[]` with a comment to swap the body once an endpoint exists; request notifications are therefore never produced (verify) | Remove from the poll until the endpoint exists, or implement |
| Mixed concerns in the context | Toast announcement lives inside the data provider, tying UI side effects to data loading | Separate `NotificationAnnouncer` |
| Fixtures in prod bundle | Dev fixtures and playground code are in the source tree; inert at runtime but shipped as dead code unless tree-shaken (verify) | Dynamic import under `NODE_ENV !== 'production'` |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | None for notifications: `read-state` (baseline, seen vs read, undo, corrupt storage, `MAX_IDS`), `build` bundling/capping, polling and visibility, announcement dedupe, cross-tab sync, user switch reset |
| Server push (#36, #44) | SSE/WebSocket or Web Push for real-time delivery instead of 60 s polling (needs backend) |
| Preferences (#33) | The Settings > Notifications page should drive which kinds appear and the toast behaviour (it is currently a static UI) |
| Email/Slack digests | Out-of-app delivery tied to the same feed (backend) |
| Code splitting (#46) | Lazy-load `NotificationPanel` on first open (bell stays small) |
| `Notification` API / badge | Optional browser notifications and `navigator.setAppBadge` with permission handling (none today) |
| Retention | Prune `firstSeen` and dismissed ids by age, not only count |
| Grouping and filters | Group by day, filter by kind, "attention only" (an `attentionCount` exists; verify the UI) |
| Web Vitals / budget (#8, #56) | Measure the poll cost and main-thread time of building the list |
| Sound/motion preferences | `BellRingIcon` animation should respect `prefers-reduced-motion` (verify) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 57% → ~68%)
1. Tests for `read-state`, `build`, announcement dedupe and user-switch reset. (+1.2)
2. `aria-live` count, `aria-expanded`/`aria-controls`, focus return; reduced-motion check on the bell. (+0.6)
3. Per-source error state with a quiet "unavailable" row and logging. (+0.5)
4. Typed analytics (panel opened, notification clicked, dismissed, mark all read). (+0.4)
5. Replace render-time reset with a `key={userKey}` boundary. (+0.2)
6. Lazy-load the panel on first open; gate dev fixtures behind a dynamic import. (+0.5)

### Phase 2: Shared data and identity (M, → ~80%)
1. Derive from React Query caches (personas, automations, models) with refetch on interval/focus; delete hand-written polling refs. (+1.8)
2. Key read state by Auth0 `sub`; stronger hash; migrate. (+0.4)
3. Single-tab polling via leader election. (+0.5)
4. Split provider into sources, read-state store and announcer; panel split into list/row/header. (+1.0)
5. Remove or implement `fetchTeamRequests`. (+0.3)

### Phase 3: Backend-backed feed (L, → ~93%)
1. Backend notification endpoints (list, mark read/unread, dismiss) and kinds for invites, credits, connectors, shares (backend request). (+2.0)
2. Client store becomes an optimistic cache over server state; cross-device consistency. (+0.8)
3. Preferences from Settings control kinds and toast behaviour. (+0.6)
4. Grouping, filters, retention by age. (+0.4)

### Phase 4: Governance (S-M, → 100%)
1. Push delivery (SSE or Web Push) and optional browser notifications/app badge. (+0.8)
2. Performance budget for list building and poll cost; Web Vitals. (+0.4)
3. Accessibility audit (axe plus screen reader) of bell and panel. (+0.3)
4. Delivery metrics (time to see, click-through) in analytics. (+0.2)

Re-score after each phase and settle all "(verify)" items first.
