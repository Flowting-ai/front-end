# Library Feature: System Design Audit

> **Status (Oct 14 2026): Phases 1–2 done; Phase 3 item 1 partly done (Web Vitals, no budget numbers yet); the rest is blocked outside the front-end.** Written against `ds-dev` at `cd15cde5`.
>
> Done (Phase 1):
> 1. Dead leftovers of the removed settings pages: the `autosave_changed` and `import_started` actions (never emitted) are gone from `analytics.ts` and the Mixpanel setup doc, and the stale `NEXT_PUBLIC_ENABLE_LIBRARY` comment is gone from `SettingsSidebar.tsx`. `useStorage`/`useLibraryLimits` stay (the header and the upload limits use them). Feature flag: decided (Oct 14) to leave Library visible to everyone, no flag.
> 2. Static inline styles moved to CSS modules in `FileTable` (17 → 2 computed: virtual offset, body height), `TrashScreen` (18 → 0, new `TrashScreen.module.css`), `LibrarySkeletons` (39 → 2 computed fades, new `LibrarySkeletons.module.css`), `ShareDialog` (30 → 2, new `ShareDialog.module.css`), `PickerDialog` (22 → 2, new `PickerDialog.module.css`). The overrides that remain go to `ui/dialog` primitives, which style themselves inline (a class cannot beat them). Side effect: the Share dialog title now uses the standard dialog title font; before, its `style` prop replaced the primitive's whole style.
> 3. Tests: `mutations.test.ts` (8) drives rename, trash, share and revoke through exported option factories (`renameFileOptions` etc.) with a real `QueryClient`, checking the optimistic state mid-request, rollback and toasts. `FileTable.test.tsx` (11) covers ARIA counts, sort state, columns per list, busy and load-more states, and `FileRow`.
> 4. `/library/trash/error.tsx` ("Couldn't load Trash", via a new `title` prop on `LibraryRouteError`). `FileThumb` falls back to the type icon when a signed thumbnail URL fails, in the table and on Suggested cards.
>
> Done (Phase 2):
> 1. Keyboard focus survives virtualisation: the focused row is always rendered (`withFocusedRow` in `table-focus.ts`), and Arrow Up/Down, Home and End move between rows, rendering the target before focusing it. The picker list is one tab stop with the same keys (it had a tab stop per file). Not done: an axe and screen-reader pass (needs a browser).
> 2. Already applied (verified): filter and sort URL writes run in `startTransition` (`use-library-query.ts`). Rows are now `React.memo` with a numeric `offset` prop instead of a fresh style object; `FileTable` itself is skipped by React Compiler because of `useVirtualizer`, so this memo is what stops rows re-rendering on every scroll tick.
> 3. Already applied (verified): a 403 from storage asks for a fresh part URL and retries, and going offline pauses and resumes only the missing parts; both are covered in `upload/controller.test.ts`.
> 4. `api.renameFile` sends its body through the form's `renameSchema`, so form and request share one contract; `forms.test.ts` (5).
>
> Phase 3:
> 1. Web Vitals: `LibraryVitals` (mounted by the new `library/layout.tsx`) sends LCP, CLS and INP as `web_vital` events with metric, rating and page (list, trash, file) only. Budget numbers: left out for now (Oct 14, by request); adding them needs one measured `next build`.
> 2. Blocked: no monitoring SDK yet (OQ-30); `captureError` is the single place to wire it.
> 3. Blocked: the end-to-end upload → chat → citation test needs the running app and back end.
>
> Phase 4 is blocked on the back end (settings endpoints, sized thumbnails) or needs a design (bulk actions).

Scope: `app/(app)/library` (`page.tsx`, `files/[fileId]/page.tsx`, `trash/page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`), `src/components/Library/*` (screens, `FileTable`, dialogs, picker, viewers, upload host, chat parts, routines), `src/lib/library/*` (API, schemas, queries, mutations, cache, keys, query params, upload controller and state machine, analytics, observability). About 11,300 lines across ~110 files, including 17 test files. The Library chat integration (`AddMenu`, `use-streaming-chat`, `/api/chat` and `/api/persona-chat` `libraryFileIds`) is included where it touches Library.
Method: structural scan plus reading the route files, the API module, the query and mutation hooks, `FileTable`, the dialogs and the upload transport. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~78% (32.0 / 41 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 5 | 4.0 | 80% |
| 2. Architecture | 8 | 5.8 | 73% |
| 3. Component Patterns | 1 | 0.8 | 80% |
| 4. Data Model | 9 | 7.5 | 83% |
| 5. Interfaces and APIs | 7 | 6.2 | 89% |
| 6. Optimizations | 11 | 7.7 | 70% |

Not applicable: SSG, ISR, CDN/edge logic, service workers, PWA, micro-frontends, monorepo, HOC, compound and polymorphic components, Redux vs MobX, GraphQL, tRPC, WebSocket.

This is the highest score of any audited feature. Library was built after the principles were written and follows them by design: one query layer, Zod at the boundary, URL state, cursor paging, virtualisation and lazy dialogs were there from the start. The gaps are mostly in styling, component tests, performance budgets and leftovers from removing the mock and settings pages.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Hybrid rendering / RSC shell (#5, #6) | Route files are server shells that read no request data, so they stay static; the screens are client islands. The file route validates the id on the server (`isValidFileId` → `notFound()`) and leaves missing/locked/deleted files to the client, which holds the token |
| Streaming and route states (#7) | `loading.tsx` for `/library`, `/library/trash`, `/library/files/[fileId]`; `error.tsx` for `/library` and the file route; `not-found.tsx` with a way back; `Suspense` around each screen (needed for `useSearchParams`); dedicated `LibrarySkeletons.tsx` |
| Server state (#30, #38) | All reads in `lib/library/queries.ts` on React Query: `useInfiniteQuery` for list, picker and trash, `keepPreviousData` while filters change, per-query `staleTime`, `libraryRetry` policy. Hooks return narrow objects (never a raw `UseQueryResult`) and no data is copied into `useState` |
| Workspace-scoped keys | `libraryKeys` include the org key (`useLibraryViewer`), so switching workspace shows a clean slate instead of the other workspace's files |
| Cursor pagination (#39) | `nextCursor` → `getNextPageParam`, page size 50, `flattenPages` helper |
| Optimistic updates (#33) | Rename, trash, restore, mark-opened, share and revoke in `mutations.ts` patch every cached list (`patchFileEverywhere`, `removeFileFromLists`) with `onMutate`/`onError` rollback (8 `onMutate`, 9 `onError`) |
| Data normalisation (#31) | One wire type (`FileRowWire`) mapped to one `LibraryFile` (`file.ts`); cache helpers patch the same row across paged lists and Suggested |
| Real-time state (#36) | The file detail polls every 3 s only while the file is still processing (`phase !== "ready"`) and stops when ready |
| URL as state (#34) | Tab, search, sources, types, sort, direction and unread-first live in the URL (`query-params.ts`, 191 lines of tests); each file has its own route; `return-to.ts` keeps the way back |
| Runtime validation (#35 / #45) | Every API response parsed with Zod (`schemas.ts`); a contract mismatch becomes one `ApiError("contract_error")` with a user message, reported once |
| API layer (#40, #45) | HTTP isolated in `lib/library/api.ts`; ids URL-encoded; user-facing copy centralised in `messages.ts`; toasts in `file-toasts.ts` (tested) |
| Upload design (#21) | Bytes go straight to presigned storage URLs with a plain XHR and no `Authorization` header (the bearer never reaches the storage origin) and never through the Next proxy. Upload is a tested state machine (`upload/machine.ts`) with a controller, store and transport split, abort signals and per-part progress |
| Frontend security (#21) | `viewers/safe-url.ts` and `pdf-source.ts` (tested) guard what viewers load; `sanitizeDisplayText` on names; chat proxies validate `libraryFileIds` with Zod |
| List virtualisation (#51) | `FileTable` is a virtualised ARIA table (`@tanstack/react-virtual`) with fixed row height and `aria-rowindex`/`aria-rowcount` so assistive tech knows the position |
| Accessibility (#20) | 153 `aria-*` and 73 `role` across 39 files; `aria-sort` on sortable column headers; `aria-busy` while refreshing; 24 live regions/status nodes; dialogs on the shared `ui/dialog` primitive |
| Code splitting / lazy loading (#46, #48) | Share, rename and delete dialogs, the picker, the upload host, `FilePreview` and `PdfViewer` are `next/dynamic` with `ssr: false`, loaded on first use |
| Debounce (#53) | Search and the people lookup in Share use `useDebouncedValue` (250 ms) |
| Error boundaries (#19) | `PreviewBoundary` isolates a crashing viewer from the rest of the file screen |
| Analytics (#55) | `trackLibrary` with a closed `LibraryAction` union and enum/bucket-only properties (never file names, titles, search text or URLs) |
| Unit tests | 17 test files over cache, citations, query params, return-to, sources, suggested, format, upload (controller, machine, send, store, remaining slots) and viewers |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Style management (#16) | 281 inline `style={{…}}` across 38 files next to 17 CSS modules. Worst: `LibrarySkeletons.tsx` (39), `ShareDialog.tsx` (30), `PickerDialog.tsx` (22), `TrashScreen.tsx` (18), `FileTable.tsx` (17, including per-cell `style` on every virtualised row) | Move static styles to the existing CSS modules and tokens; keep inline style only for computed values (virtual row offset, sizes) |
| Observability (#55) | `observability.ts` is a console shim (`captureError` → `console.error` in dev, a stub otherwise); no monitoring SDK (OQ-30) | Wire the reporter to the app's chosen monitoring tool once adopted; nothing else changes thanks to the single entry point |
| Accessibility (#20) | Strong structure, but no keyboard-navigation tests on the virtualised table (rows leaving the DOM while focused) (verify) and no axe run | Roving focus that survives virtualisation; axe and screen reader pass on list, file screen, Share and picker |
| CI and testing (#18) | Logic is well tested; components are not (0 component tests in `components/Library`). Hooks in `queries.ts`/`mutations.ts` have no tests for optimistic rollback | Testing Library tests for `FileTable` (sort, load more, empty and error states), Share (grant, revoke, rollback), the upload host, and mutation rollback tests like `schedule-queries.test.ts` |
| React performance (#50) | `useMemo`/`useCallback`/`memo` in only 2 files. Virtualisation covers the big list; row components re-render on every scroll tick of the parent (verify with the profiler) | Memoise `FileRow` and its handlers; measure before adding more |
| useTransition (#54) | Filter and sort changes update the URL and refetch with `keepPreviousData`, but the URL write is not in a transition (verify) | Wrap filter/sort URL updates in `startTransition` so typing and clicks stay responsive |
| Real-time (#36) | Upload progress and processing use polling; list rows of other people's newly shared files appear only on refetch | Fine for now; revisit if the backend adds events (notifications channel) |
| Image optimisation (#49) | Thumbnails and avatars are raw `<img>` with width/height, `loading="lazy"` and `decoding="async"` (good), but no `srcset` and no fallback on a broken presigned URL (verify) | Ask the backend for sized thumbnails; add an `onError` fallback to `FormatGlyph`. `next/image` is not a fit for short-lived signed URLs |
| Form state (#35) | Rename and Share hand-manage input state and validation; rules (name length, forbidden characters) live in the component (verify) | Zod schema for rename shared with the API body; RHF only if the forms grow |
| BFF (#41) | Library calls `API_BASE_URL` directly with the bearer from browser memory (same model as the rest of the app; see the Auth audit note) | Partial credit, matching other audits; changes only if the app moves to a token-hiding BFF |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Library is no longer behind a flag | `579f2b94` removed `NEXT_PUBLIC_ENABLE_LIBRARY`; the sidebar shows **Library** to everyone (`LeftSidebar.tsx`) and the routes are live in every environment | Confirm this is intended for production; if not, restore a flag that hides the nav row and 404s the routes |
| Stale comment after settings removal | `SettingsSidebar.tsx:104` still says Library settings are "off until NEXT_PUBLIC_ENABLE_LIBRARY=true", but the settings pages and flag were deleted | Delete the comment, or replace it with a pointer to where auto-save, AI use and storage settings will live |
| Settings removed, features still referenced | The personal and admin Library settings (auto-save, AI use of files, storage) were deleted with the mock API, while `trackLibrary` still has `autosave_changed` and `useStorage`/`useLibraryLimits` remain (verify where they are shown) | Either rebuild the settings on the real API or drop the dead action names and hooks |
| Inline style on every virtual row | `FileTable` rows set `style={{ height, ...style }}` and per-cell inline styles, so each row allocates new style objects every render | Static styles in `FileTable.module.css`; only the virtual `transform`/`top` stays inline |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Component and integration tests | See section 2; plus an end-to-end path: upload → processing → ready → ask about it in chat → citation opens the file |
| Performance budget (#56) | Per-route JS budget for `/library` and `/library/files/[id]` in CI; check that PDF and sheet viewers stay out of the list route's chunk |
| Core Web Vitals (#8) | `useReportWebVitals` data for the Library routes (LCP is the table or Suggested grid) |
| `error.tsx` for trash | `/library/trash` relies on the parent `/library/error.tsx`. That works, but a trash-specific message ("Couldn't load Trash") is clearer |
| Offline and retry for uploads | Resume after a network drop or an expired presigned URL (`PartTransportError` 403) (verify what the controller does today) |
| Bulk actions | Multi-select trash, restore and share are common in file managers; plan them with selection kept in local state, not the URL |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 78% → ~85%)
1. Decide on the feature flag; remove the stale `SettingsSidebar` comment and dead settings leftovers (`autosave_changed`, unused hooks). (+0.5)
2. Move static inline styles in `FileTable`, `ShareDialog`, `PickerDialog`, `TrashScreen` and `LibrarySkeletons` to CSS modules. (+0.5)
3. Mutation rollback tests for rename, trash and share; `FileTable` component tests. (+0.8)
4. Trash `error.tsx`; thumbnail `onError` fallback. (+0.3)

### Phase 2: Interaction quality (M, → ~92%)
1. Accessibility pass: keyboard focus that survives virtualisation, axe and screen reader on list, file, Share, picker. (+0.6)
2. `startTransition` for filter/sort URL updates; memoised rows, verified in the profiler. (+0.6)
3. Upload resume and presigned-URL refresh on 403, with tests. (+0.5)
4. Zod rename schema shared with the API body. (+0.3)

### Phase 3: Governance (S, → ~97%)
1. Performance budget and Web Vitals for the Library routes in CI. (+1.0)
2. Wire `captureError` to the monitoring SDK once chosen. (+0.4)
3. End-to-end test for upload → chat → citation. (+0.4)

### Phase 4: Product completeness (M, → 100%)
1. Rebuild Library settings (auto-save, AI use, storage) on the real API. (+0.4)
2. Sized thumbnails from the backend; bulk actions. (+0.4)

Re-score after each phase and settle all "(verify)" items first.

## Backend gaps
(a) Sized thumbnail URLs (or `srcset` variants) for list and Suggested. (b) An event or notification when a file is shared with you, so lists don't depend on refetch. (c) Settings endpoints for auto-save, AI use of files and storage, if the settings pages come back.
