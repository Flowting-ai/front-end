# Global Search: System Design Audit

Scope: `components/GlobalSearchModal/index.tsx` (778 lines), `context/search-context.tsx` (295 lines, mounted in `app/(app)/layout.tsx`), `lib/highlightMatch.tsx`, entry points in `LeftSidebar`, `Sidebar`, chat pages. About 1,100 lines.
Method: both main files read in full; consumers found by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~40% (11.2 / 28 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.3 | 65% |
| 2. Architecture | 8 | 4.3 | 54% |
| 3. Component Patterns | 2 | 1.0 | 50% |
| 4. Data Model | 4 | 1.7 | 43% |
| 5. Interfaces and APIs | 4 | 1.2 | 30% |
| 6. Optimizations | 8 | 1.7 | 21% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, tRPC, WebSocket, PWA, forms, cookies/storage, real-time state.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Accessibility (#20) | Textbook combobox pattern: `role="dialog" aria-modal`, `role="combobox"` with `aria-controls`, `aria-activedescendant`, `aria-autocomplete="list"`; `role="listbox"` / `option` / `aria-selected`; `tablist` filters; focus trap; focus restored to the previously focused element on close; arrow keys wrap; Enter selects; focused row scrolled into view |
| Global shortcut | Cmd/Ctrl+K opens search from anywhere (listener cleaned up) |
| Bounded rendering (#51 idea) | Every source is capped (`slice(0,20)`, `slice(0,10)`) and `MAX_PER_SECTION` per group, so no virtualisation is needed |
| Provider placement (#24) | Provider at the app layout, modal mounted once |
| Lazy persona data | Personas and agent chats are fetched only after the first open, not at app start |
| Feature flag | `PINS_ENABLED` respected in search and in select handler |
| Match highlighting | `highlightMatch` returns React nodes (no `dangerouslySetInnerHTML`, no XSS risk) |
| Navigation search | Static `NAV_PAGES` with keyword lists makes settings/org pages findable |
| Empty-query recents | Last five non-project chats shown before typing |
| Cancellation | `cancelled` flag in the persona-loading effect |
| Analytics | `trackFeature("search")` on open |
| Clean routing | Result type to route mapping in one `handleSelect` using `lib/routes` constants |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Server state (#30) | The persona/agent-chat load runs on **every** open (`useEffect` depends on `searchOpen`, though the comment says "first time"), with no cache; results can flash empty then fill | Query with `staleTime`, or fetch once and keep (`enabled: searchOpen`) |
| Provider coupling (#24) | `SearchProvider` subscribes to chat-history, projects and pinboard contexts, so it re-renders whenever any of them changes; its context value `{ searchOpen, openSearch }` is a new object every render, re-rendering all `useSearch()` consumers (verify whether React Compiler memoises it) | `useMemo` the value, or split: a tiny open/close context and a lazily mounted search-data component that only subscribes while open |
| Re-render cost (#50) | `searchResults` recomputes over all sources on each keystroke, lower-casing every title each time | Precompute a lowercase index (`useMemo` per source), compute only while open, and defer (see below) |
| Component architecture (#12) | Modal 778 lines holds styles, row component, filters, focus trap, keyboard handling | Split: `useSearchKeyboard`, `useFocusTrap` (the repo already has `use-focus-trap`), `SearchRow`, `SearchFilters` |
| Style management (#16) | Hover tracked with `useState` per row and inline `style` objects with computed shadows | CSS `:hover`/`:focus-visible`, tokens/Tailwind |
| Error boundaries (#19) | Layout-level only | A failure inside search should not take down the layout; wrap the modal |
| Observability (#55) | Open is tracked; no tracking of result type selected, no-result queries (type only, no free text per repo rule), latency | `trackFeature` with result type enum |
| Focus timing | `setTimeout(..., 50)` to focus the input | Use the dialog's `onOpenAutoFocus` or a ref callback |
| Silent no-op | `agent-chat` selection does nothing if the chat is no longer in state | Fall back to the persona chat route |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Client-side substring search over partial data | Searches only chats already loaded by `useChatHistory` (cursor-paged, `hasMore` / `loadMore` exist), so older chats are not findable; project chats and pins are limited to what their contexts hold (verify extent) | Server-side search endpoint (title and message content, paginated); request from backend if missing. Until then, show "Search loaded chats only" or load more on demand |
| Titles only | No search of message content, pin comments, agent descriptions beyond name/handle/tags, connectors, templates, schedules | Add sources once a backend search exists |
| N+1 persona-chats fan-out | `fetchPersonas()` then `fetchPersonaChats(id)` for every persona (same pattern copied in `LeftSidebar` and the highlight context), errors swallowed with `.catch(() => [])` | One aggregated endpoint or a shared cached query used by all three; surface a partial-failure hint |
| No ranking | Results appear in source order (chats, project chats, agent chats, projects, personas, pins, pages); exact or prefix matches are not ahead of mid-string ones | Score: exact > prefix > word-start > substring; recency tie-break; optionally fuzzy matching (e.g. a small lib) |
| Highlight only first match | `highlightMatch` marks the first occurrence by `indexOf`; ignores diacritics and multi-word queries | Normalise (`normalize('NFD')`), highlight each term |
| Provider imports the modal statically | The 778-line modal and its styles load with the app shell even if never opened | `dynamic(() => import(...))` rendered only after first open |
| Search data duplicates other lists | Builds its own maps (`chatNameById`, `projectNameById`, `personaNameById`) from three contexts | Share normalised selectors with the rest of the app |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Debounce / `useDeferredValue` (#53, #54) | `onQuery` writes state on every keystroke into the provider, which recomputes everything; use `useDeferredValue(query)` (and debounce if/when search goes to the server) |
| Loading and error states | No indicator while personas/agent chats load, no error or "partial results" message |
| `aria-live` result count | Announce "N results" for screen readers |
| Tests | None found for search logic or the modal. Extract the matching/ranking into `lib/search.ts` with unit tests; test keyboard navigation, focus restore, filters, flag-disabled pins |
| URL as state (#34) | Optional: `/search?q=` for a full results page and shareable queries |
| Recent searches | Persist the last few queries (storage-keys) and show them on empty query |
| Cancel in-flight on close | Abort persona fetches when the modal closes |
| Core Web Vitals / budget (#8, #56) | INP check on typing with a large chat list; modal chunk budget |
| Query-less browse by filter | Selecting a type tab with no query shows nothing useful; list recents of that type |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 40% → ~58%)
1. `useDeferredValue` for the query; compute results only while open. (+1.0)
2. Fetch personas/agent chats once with `staleTime` (React Query, shared with the sidebar and highlight context); abort on close. (+1.0)
3. Memoise the context value and split the open/close context from the data subscriptions. (+0.8)
4. Lazy-load the modal. (+0.5)
5. Extract matching logic to `lib/search.ts` and add unit tests; add keyboard/focus tests for the modal. (+1.2)
6. Loading, partial-failure and no-results states; `aria-live` count. (+0.6)
7. Typed analytics for selected result type. (+0.3)

### Phase 2: Relevance and completeness (M, → ~76%)
1. Ranking (exact, prefix, word-start, substring; recency tie-break); diacritic-insensitive matching; highlight all terms. (+1.5)
2. Make clear what is searched (loaded chats) or load more chats on demand. (+0.8)
3. Replace the persona fan-out with one shared cached query or an aggregated endpoint. (+0.8)
4. Fall back gracefully for stale `agent-chat` results. (+0.2)
5. Recent searches persisted via `storage-keys.ts`. (+0.5)

### Phase 3: Server-side search (L, → ~92%)
1. Backend search endpoint for chat titles and message content with cursor pagination (request from backend; backend is read-only for us). (+2.0)
2. Query with debounce, cancellation and `keepPreviousData`; server-ranked results merged with local nav pages. (+1.0)
3. Split the modal into hooks and presentational parts; CSS hover/focus states instead of state. (+0.8)
4. Add pins, templates, schedules and connectors as sources through the same endpoint. (+0.4)

### Phase 4: Governance (S, → 100%)
1. INP measurement while typing and a bundle budget for the search chunk. (+0.5)
2. Accessibility audit (axe plus screen reader). (+0.3)
3. Optional `/search` results page with URL state. (+0.4)
4. Error boundary around the modal; structured error logging. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
