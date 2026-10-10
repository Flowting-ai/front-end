# Connectors: System Design Audit

Scope: `app/(app)/connectors/page.tsx`, `components/connectors/*` (ConnectorsExperience 324, ConnectionsView 731, AccountDetailView 537, ConnectorDetailView, SetupModal, CustomApiModal, RemoveModal), `components/ConnectorBrowse|Card|CatalogCard|Row|RequestModal`, `lib/api/connectors.ts` (585), `lib/api/connector-schemas.ts`, `lib/useConnectorSetupFlow.ts` (274), `lib/connect-apps-cache.ts`, `lib/connector*.ts`. About 3,600 lines (UI plus lib).
Method: API module, schemas, setup-flow hook, page and the browse/cache sections of `ConnectionsView` read; the rest by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~55% (19.2 / 35 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.7 | 57% |
| 2. Architecture | 8 | 4.2 | 53% |
| 3. Component Patterns | 2 | 1.0 | 50% |
| 4. Data Model | 8 | 4.6 | 58% |
| 5. Interfaces and APIs | 6 | 4.7 | 78% |
| 6. Optimizations | 8 | 3.0 | 38% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, list virtualisation (paged lists).

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Runtime validation (#35) | `connector-schemas.ts` Zod wire schemas (exact snake_case field names, backend defaults only); responses parsed with `.parse` in `ConnectorCatalog`/`ConnectorConnection` classes that expose camelCase domain getters (`ownedConnections`, `needsReconnect`, `authMode`) |
| Anti-corruption layer | Wire shape never leaks into components; domain objects carry the rules (e.g. which connections are owned, which need reconnect) |
| Cursor pagination (#39) | `listConnectors({ q, cursor, limit, linked, category })` returns `{ connectors, nextCursor, hasMore }`; the browse view keeps a cursor stack |
| In-flight dedupe and memo | `listInFlight` map dedupes identical list calls; `catalogBySlug` remembers entries; `bustConnectorCatalogCache()` for invalidation |
| Polling done right (#36) | `pollConnectorUntilActive`: exponential backoff (2 s to 30 s), hard timeout, `AbortSignal` support, and a documented, correct completion rule (new owned account not in the `known` set, or the specific account healthy again) instead of the org-wide `linked` flag |
| OAuth popup safety (#21) | Popup opened with `window.open('', ...)` first (so popup blockers allow it), then navigated; `noopener` on opener-free paths; popup closed on unmount; `closedCheck` interval treats closing as cancel |
| State machine (#40) | `useConnectorSetupFlow` is a named-state hook (`idle`, `opening`, `polling`, `submitting`, `error`) with abort refs and a StrictMode guard |
| Debounced search (#53) | 300 ms debounce on the browse query |
| Lazy visibility | `IntersectionObserver` gate for discover rows; falls back to rendering if unsupported |
| Stale-while-revalidate | `connect-apps-cache.ts` loads only what the "Connect an app" menu shows, in parallel, with a 5-minute stale window and warm-up from the app shell (replaced an earlier ~20-request crawl) |
| URL as state (#34) | `?q=` initial search from the route |
| Tests | `connectors.test.ts`, `connectorProvider.test.ts`, `connectorCategories.test.ts` |
| Pure helpers | `connectorCategories`, `connectorNames`, `connectorProvider`, `connector-owner` are small modules |
| Accessibility (#20) | `aria-label` on tabs and icon buttons; named tab list |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `ConnectionsView` 731 lines (20 `useState`, 10 `useEffect`), `AccountDetailView` 537 (15, 4), `ConnectorsExperience` 324 (15, 5), `CustomApiModal` 12 `useState` | Container hooks (`useConnectorBrowse`, `useAccountDetail`) plus presentational sections |
| Server state (#30, #38) | Three separate hand-rolled caches: `catalogBySlug` (API module), `pageCache` keyed by q/category/cursor (ConnectionsView), and `connect-apps-cache` (featured and search maps). Each has its own TTL and invalidation | One React Query layer: `["connectors", {q, category, linked}]` (infinite), `["connector", slug]`, `["connectors","featured"]`; mutations invalidate; remove the three caches |
| Suspense (#7) | Route `Suspense fallback={null}`, so a blank screen while `useSearchParams` resolves | Use a skeleton fallback or `loading.tsx` |
| Error boundaries (#19) | Layout-level only; an exception in `AccountDetailView` blanks the page | Boundary per panel and modal |
| Accessibility (#20) | Only ~4 `aria-*` in the large views; status badges (paused, expired, needs reconnect) and polling states are visual; modals need focus return (verify) | Live region for "Waiting for authorization", roles, focus management |
| Observability (#55) | One analytics call in the whole feature (ConnectionsView) and one in the setup hook; no events for connect started/succeeded/failed/timed-out, unlink, share toggle | Typed events with slug/status enums, plus failure reasons |
| Image handling (#49) | Raw `<img>` for provider icons in `ConnectorCard` (inline sized); remote logos from `logo_url` | `next/image` with `sizes`, or the existing `ConnectorGlyph`/`IconWithFallback` everywhere; cache headers |
| Style management (#16) | Mix of CSS modules and inline styles (verify) | Consistent tokens |
| Optimistic updates (#33) | Share/disable/permission edits go through `updateAccount` then state update (verify rollback) | Optimistic with rollback for permission and share toggles |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Polling re-fetches the whole catalog entry | Each tick calls `getConnector(slug)`, which also writes to `catalogBySlug`; the result is parsed fully each poll | Fine for correctness; add jitter and use a lighter status endpoint if one exists (request from backend); keep the 120 s cap with a user-visible retry |
| Module-level mutable caches | `catalogBySlug`, `listInFlight`, `categoriesRequest`, `featured`, `searches` are module singletons: shared across users after sign-out/org switch unless busted, and impossible to reset in tests | Move into the query client (cleared on logout/org change) |
| Cache busting by convention | `bustConnectorCatalogCache()` must be called manually after mutations; a missed call shows stale linked state | Invalidate automatically in mutations |
| Duplicate UI generations | `components/connectors/*` (v1.5, unified experience) coexists with `ConnectorBrowse`, `ConnectorCatalogCard`, `ConnectorRow`, `ConnectorRequestModal`; docs say the old split was removed (verify which are still used) | Delete unused legacy components; one catalog card |
| Long UI comments as documentation | Behavioural rules live in code comments (e.g. why `entry.linked` is wrong) and in `docs v1.5` | Keep, but add unit tests that encode each rule (poll satisfied cases) |
| Error surface | Poll timeout throws a generic `Error`; connect failures set `errorMsg` strings | Typed error classes (`ConnectTimeout`, `PopupBlocked`, `ProviderDenied`) so UI shows the right recovery action |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests for UI and flow | The setup state machine, abort/unmount behaviour, popup-blocked path, shared-connection poll correctness (partially covered in `connectors.test.ts`; verify) |
| `useTransition` / `useDeferredValue` (#54) | Category and view switches |
| Code splitting (#46, #48) | Lazy-load `SetupModal`, `CustomApiModal`, `AccountDetailView`, `RemoveModal`, request modal |
| `error.tsx` / `loading.tsx` | Route-level states |
| Permissions helper | One `canManage(connection)` from `owned`/`shared`/role instead of inline checks |
| Normalisation (#31) | Connections by account id across catalog entries so one update refreshes list, detail and chat menus |
| Core Web Vitals / budget (#8, #56) | Budget for the connectors chunk; INP on filter and search |
| Cross-tab sync | After connecting in another tab, refresh via `BroadcastChannel` or window focus refetch |
| Reconnect nudges | Surface `needsReconnect` in the chat connect menu and notifications |
| Telemetry for OAuth failures | Capture provider error codes (no free text) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 55% → ~66%)
1. Replace `Suspense fallback={null}` with a skeleton; add route `error.tsx`/`loading.tsx` and panel boundaries. (+0.8)
2. Typed analytics for connect started/succeeded/failed/timeout, unlink, share, reconnect. (+0.8)
3. Typed connect errors with distinct recovery UI. (+0.6)
4. Lazy-load setup, custom API, detail, remove and request modals. (+0.7)
5. Live region and focus handling for the connect flow; modal focus return. (+0.6)
6. Delete legacy connector components that are no longer imported. (+0.4)

### Phase 2: One data layer (M, → ~80%)
1. Move browse, detail, featured and search to React Query (infinite query for the catalog); remove `pageCache`, `connect-apps-cache` and `catalogBySlug`. (+2.0)
2. Mutations (link complete, update account, unlink, custom API) invalidate precisely; optimistic updates with rollback for share and permission toggles. (+1.0)
3. Clear caches on logout and org switch; refetch on window focus for cross-tab connect. (+0.6)
4. Keep `pollConnectorUntilActive` but run it as a query with `refetchInterval` and the same completion rule, plus jitter. (+0.4)

### Phase 3: Components (M, → ~92%)
1. Split `ConnectionsView`, `AccountDetailView`, `ConnectorsExperience` into container hooks and presentational parts, none above ~350 lines. (+1.5)
2. Shared `canManage` permission helper; one catalog card. (+0.4)
3. React Hook Form + Zod for `CustomApiModal` using the same field schema as the API. (+0.5)
4. `useDeferredValue`/`useTransition` for view and category switches; `next/image` for logos. (+0.6)

### Phase 4: Governance (S, → 100%)
1. Tests for the setup state machine, popup-blocked, abort on unmount and the poll completion rule. (+0.8)
2. Performance budget and Web Vitals on the connectors route. (+0.5)
3. Accessibility audit (axe plus screen reader), including status badges. (+0.4)
4. Surface reconnect-needed state in chat and notifications. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
