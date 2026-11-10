# Pinboard and Highlights: System Design Audit

Scope: `components/Pinboard` (1,900 lines), `Pin` (1,674), `PinboardExpanded` (1,299), `PinboardHeader`, `PinCategory`, `PinCommentField`, `PinInsert`, `PinSkeleton`, `PinboardSkeleton`, `HighlightCard`, `HighlightPanel` (599), `HighlightMark`, `context/pinboard-context.tsx` (602), `context/highlight-context.tsx` (305), `lib/api/pins.ts`, `lib/api/highlights.ts`, `lib/highlight*.ts`, `lib/rendered-highlights.ts`, `lib/apply-marks.ts`, `lib/export-pins.ts`, `hooks/use-pin-mentions.ts`. About 9,700 lines.
Method: structural scan plus reading the pinboard context, API modules and highlight loading. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~47% (17.4 / 37 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.7 | 57% |
| 2. Architecture | 8 | 3.4 | 43% |
| 3. Component Patterns | 3 | 1.5 | 50% |
| 4. Data Model | 8 | 3.4 | 43% |
| 5. Interfaces and APIs | 6 | 3.6 | 60% |
| 6. Optimizations | 9 | 3.8 | 42% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination, real-time state.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Feature flags as a guard | `PINS_ENABLED` / `HIGHLIGHTS_ENABLED` with `assertPinsEnabled()` backstops in the API layer and a no-op context value (`noop`) when disabled, so hidden features never hit the backend |
| Stale-while-revalidate (#10 idea) | Pin context hydrates instantly from a localStorage snapshot, then refreshes; cache writes are debounced 500 ms |
| Demand-driven fetching (#48) | Pins load only on real demand: panel open, toggle, open-for-chat, hover `prefetch()`; `fetchingRef` blocks duplicate in-flight loads |
| Optimistic add (#33) | `addPin` inserts a temp-id pin, swaps in the server pin on success, rolls back on failure |
| Context split (#24) | Highlight context is split into `HighlightDataContext` and `HighlightActionsContext`, so action-only consumers do not re-render on data changes |
| Stale request cancellation | Highlight loads use an `AbortController`; aborted loads do not set error state |
| Anti-corruption layer | `normalizePin` maps varying backend shapes (`pins_title` / `title` / first line, `content` / `text` / `formattedContent`, tag formats) to one `Pin` type |
| Lazy heavy deps (#46) | `export-pins` dynamically imports `jspdf` and `html2canvas` only when exporting |
| Virtualisation (#51) | Pin list uses `useVirtualizer` (estimate 120, overscan 4) |
| Loading UX | Dedicated `PinSkeleton` and `PinboardSkeleton` |
| Accessibility (#20) | About 36 `aria-*` across Pinboard and PinboardExpanded; stops key propagation in the comment field; touch pointers excluded from mouse-drag logic |
| Pure logic split out | `highlight-offsets`, `apply-marks`, `highlight-order`, `pin-drag`, `export-pins` are separate libs |
| Tests | `export-pins`, `highlight-offsets`, `pin-markdown` have tests |
| Analytics | `trackFeature`-style calls in Pinboard (3) and PinboardExpanded (4) |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `Pinboard` 1,900 lines (24 `useState`, 7 `useEffect`, 32 drag references), `Pin` 1,674, `PinboardExpanded` 1,299 | Split into list, row, drag controller (`usePinDrag`), category strip, comment editor, toolbar; target under ~400 lines each |
| Optimistic updates (#33) | `addPin` rolls back, but several mutations (tags, comment delete, comment update) are fire-and-forget `.catch(...)` (lines ~488-523): rollback behaviour must be confirmed (verify) | One mutation helper: apply, call, revert and toast on error |
| Server state (#30, #38) | Pins, folders and highlights fetched imperatively with refs, flags and a hand-written snapshot cache | React Query with `persistQueryClient` or `placeholderData` from the snapshot |
| Virtualisation (#51) | `PinboardExpanded` (the large view) is not virtualised (verify) | Reuse the same virtualised list |
| Error boundaries (#19) | Layout-level only | Boundary around the pin panel and highlight panel; failure should not blank chat |
| Accessibility (#20) | Pointer-based drag with capture; keyboard alternative for reordering/moving pins not evident (verify); no live region for add/remove | Keyboard move (arrow + modifier), `aria-live` announcements |
| Storage (#32) | `CACHE_KEY` snapshot stores pins and folders in localStorage (size and privacy: pin content is user data left on shared machines) | Move to IndexedDB or sessionStorage; clear on logout; version the key |
| Observability (#55) | A few events; errors go to `console` | Track add/delete/move/export failures |
| Style management (#16) | Many inline styles with `pointerEvents` and layout objects (verify) | Move to tokens/Tailwind |

## 3. Applied but wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Highlight loading fan-out | `loadAll` fetches personas, then `fetchPersonaChats` for every persona, then `getHighlights` for every chat: N+1 requests, each with `.catch(() => [])` | Backend endpoint `GET /highlights` without `chat_id` (the code comment says the backend requires it, so request it) or lazy-load per open chat only |
| Silent partial failure | `.catch(() => [])` and `.catch(() => [])` on persona chats make a failed chat look like "no highlights" | Collect errors; show "some highlights could not load" with retry |
| No runtime validation | `RawPin` is `Record<string, unknown>` with manual `typeof` branches; highlight responses cast to `HighlightResponse[]` | Zod schemas (with the alternative field names as `.or()`/preprocess) at the API boundary |
| Highlight anchors as character offsets | Highlights store `start_offset`/`end_offset` against rendered text and `selected_text`; if markdown rendering or message content changes, anchors drift (verify how `highlight-offsets` re-validates) | Store a text-quote selector (`exact`, `prefix`, `suffix`) alongside offsets and re-anchor on mismatch |
| Soft-delete via PATCH | Comment says `PATCH /highlights` creates and `PATCH /highlights/{id}` soft-deletes | Not changeable on our side (backend read-only); wrap in clearly named functions and document |
| Mirror refs for state | `highlightsRef`/`filterModeRef` are synced with `useEffect` each render to avoid stale closures | Use functional state updates or `useEffectEvent`-style handlers, or a store with selectors |
| Dual context fetches personas | `highlight-context` imports `fetchPersonas` directly (a third consumer path next to React Query's `usePersonas`) | Use the shared persona query |
| Hand-rolled drag | Pointer-capture drag with long inline logic inside the component | Extract `usePinDrag` (and consider `@dnd-kit` for keyboard support) |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46) | Lazy-load `PinboardExpanded`, `HighlightPanel`, `PinInsert` and `PinCommentField` (opened on demand) |
| `useTransition` / `useDeferredValue` (#54) | Pin search/filter and category switch |
| Debounce (#53) | Verify search and comment autosave are debounced (only the cache write is) |
| Form state (#35) | RHF + Zod for pin title/comments/tags (length limits, trimming) |
| URL as state (#34) | Open pin, folder and filter in search params (shareable, back-button friendly) |
| Pagination (#39) | Pins are loaded in full; add cursor paging if users accumulate hundreds |
| Core Web Vitals / budget (#8, #56) | INP during drag and list scroll; bundle budget for the panel chunk |
| Normalisation (#31) | Pins by id with folder/tag indices (moving between folders currently touches arrays) |
| Tests | Pin context optimistic rollback, normalisation shapes, drag logic, highlight re-anchoring, flag-disabled no-op behaviour |
| Suspense / `error.tsx` | Skeletons exist; add route-level states |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 47% → ~58%)
1. Zod schemas for pins, folders, comments, highlights (including the alternate field names). (+1.2)
2. Make every pin mutation revert and toast on failure through one helper. (+0.6)
3. Boundaries around pin and highlight panels. (+0.5)
4. Lazy-load expanded view, highlight panel, insert and comment components. (+0.8)
5. Show partial-failure state for highlight loading instead of swallowing errors. (+0.4)
6. Tests for normalisation, rollback and disabled-flag no-ops. (+0.8)

### Phase 2: Data layer (M, → ~72%)
1. React Query for pins, folders and highlights; keep instant hydration via persisted cache; mutations with `onMutate`/rollback. (+2.0)
2. Replace highlight N+1 with a single call or per-chat lazy loading (request backend change if needed). (+1.0)
3. Move the localStorage snapshot to a cleared-on-logout store; version keys in `storage-keys.ts`. (+0.5)
4. Normalise pins by id; selectors for folder/tag views. (+0.5)
5. Cursor pagination for pins. (+0.4)
6. Use the shared persona query in the highlight context. (+0.3)

### Phase 3: Components and interaction (L, → ~90%)
1. Split `Pinboard`, `Pin`, `PinboardExpanded` into controller hooks and presentational parts. (+2.0)
2. Extract `usePinDrag` and add a keyboard path for move/reorder, plus live-region announcements. (+1.0)
3. Virtualise the expanded view. (+0.4)
4. Re-anchoring for highlights via text-quote selectors. (+0.6)
5. RHF + Zod for pin forms; URL state for open pin/folder/filter. (+0.6)

### Phase 4: Governance (S, → 100%)
1. Failure analytics for add/delete/move/export; structured error logging. (+0.7)
2. `useTransition`/debounce on search and filtering; INP check during drag. (+0.6)
3. Bundle budget for the panel chunks; Web Vitals on pin routes. (+0.5)
4. Accessibility audit (axe plus screen reader). (+0.4)

Re-score after each phase and settle all "(verify)" items first.
