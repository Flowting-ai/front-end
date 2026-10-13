# 07 Build plan (production)

Structure follows RADIO from `base-primitive-rules.md`: Requirements (docs 01 to 05), Architecture (sections 2 to 4), Data model (4 to 6), Interface (5 to 6), Optimisations (7 to 11). Principle numbers in brackets refer to `06-principles-application.md`. Estimates are ideal engineer-days for one engineer who knows the codebase; they are planning numbers, not commitments.

## 1. Constraints that shape everything

1. Backend is read-only for us; the contract is `04-backend-requirements.md`. UI is built against a typed mock adapter until each endpoint lands (05 section 2).
2. Token is in browser memory, data layer is client-side through the proxy. No server-side data fetching for Library.
3. React Compiler is on, so no habitual memoisation; follow its rules.
4. Heavy libraries never enter the shell bundle (existing ESLint rule, extended).
5. Authenticated, per-user, private data: nothing is cached publicly, nothing is statically generated.
6. Rendering budget is UX (INP, CLS, scroll), not SEO.

## 2. Architecture

### 2.1 Module map and import rules

```
src/
  app/(app)/library/            routes only: page.tsx, loading.tsx, error.tsx, not-found.tsx (no "use client")
  app/(app)/settings/(shell)/library/page.tsx
  app/(app)/settings/(shell)/(org)/workspace-library/page.tsx
  components/ui/                primitives (shadcn-shaped, tokens only)               <- no imports from Library
  components/Library/           feature components
    FileTable/ FilePreview/ ShareDialog/ TrashList/ Upload/ Picker/ Settings/ Admin/
    screens/ (LibraryScreen, FileScreen, TrashScreen)  client containers
  lib/library/
    api.ts  schemas.ts  normalizers.ts  keys.ts  queries.ts  mutations.ts
    query-params.ts         zod codec for the URL
    access.ts  suggested.ts  format.ts  messages.ts   pure logic
    upload/ store.ts  machine.ts  transport.ts  limits.ts  host.tsx
    viewers/ pdf.ts (lazy wrapper)  sheet-window.ts  audio.ts
    observability.ts  analytics.ts
    mock/                   dev + tests only
  hooks/use-debounced-value.ts   (shared, promoted per rule of three)
```

Import rules (enforced by ESLint `no-restricted-imports` and a CI grep): `components/ui` never imports Library; Library components import `lib/library/*` only through hooks; nothing outside `components/Library` imports `components/Library/**/internal*`; `pdfjs-dist` is imported only from `lib/library/viewers/pdf.ts` (and that file only via dynamic `import()`); no file in `src/context/` or the root layout imports from `components/Library`.

### 2.2 Layering (principle 40)

`component -> feature hook -> data function -> transport`. Components contain no URL, no query key, no `fetch`. Hooks return narrow objects (`{ items, status, error, fetchNextPage, refresh }`), never raw `UseQueryResult`. Data functions parse with zod and throw `ApiError`. Transport is `apiFetch` (control plane) or the dedicated storage transport (part bytes).

### 2.3 Rendering per route

See `06-principles-application.md` rendering table. Rules: `page.tsx` has no request API; `LibraryScreen` reads the URL through `useSearchParams` under `<Suspense>`; File page validates `params.fileId` with `z.uuid()` then renders `FileScreen`; `document.title` is set after load from a sanitised name (truncated to 80 chars, control and bidi characters stripped).

## 3. Shared prerequisites (do first; each is a separate small PR benefiting other features)

| ID | Work | Why | Size | Blocks |
|---|---|---|---|---|
| SP-1 | Extend `ApiError` in `lib/api/client.ts`: `kind`, `code`, `fieldErrors` (parse FastAPI `detail[].loc/msg`), `requestId`, `retryable`; stop matching message substrings in `friendlyApiError` | principle 45; audits flag brittle matching | 1.5 d | WP1+ |
| SP-2 | Error infrastructure: `app/global-error.tsx`; make existing `ErrorBoundary` report through `lib/observability` (no-op/console shim now); `useReportWebVitals` component mounted once | audits: no boundaries/reporting/vitals anywhere | 1.5 d | WP0 |
| SP-3 | Tooling: `typecheck` script; add `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `vitest-axe`, `msw`; `vitest` environment per file (`// @vitest-environment jsdom`) so the existing node tests are untouched; ESLint `jsx-a11y` rules (already part of `eslint-config-next`, confirm) | current vitest is node-only and testing-library is not installed | 1 d | tests |
| SP-4 | E2E tooling: add `@playwright/test` as a devDependency, `playwright.config.ts`, login fixture (reuse the live-chat recipe), `@axe-core/playwright` | not installed today | 1.5 d | WP8 |
| SP-5 | CI: `.github/workflows/library.yml` (section 10) | only advisory `react-doctor.yml` exists | 1 d | WP8 |
| SP-6 | Perf: `scripts/perf-library.mjs` + `dynamicRoutes` section in `perf-budget.json` + `perf:library:check` script (section 9) | existing budget cannot see dynamic routes | 2 d | WP8 |
| SP-7 | Platform: CSP additions, bucket CORS (infra ticket), hashed pdf.js worker approach decided and proven in a spike | principle 9, 21 | 1 d (+ infra) | WP2, WP4 |
| SP-8 | shadcn setup: `components.json`, restyled primitives in `components/ui` (dialog, alert-dialog, dropdown-menu, popover, tabs, table, radio-group, breadcrumb, progress), token audit (no shadcn defaults) | 03 section 1 | 2.5 d | WP0 |
| SP-9 | Small utilities: `useDebouncedValue`, safe storage wrapper (if none) and `library:v1:*` keys in `storage-keys.ts`, ESLint restricted-import additions (`pdfjs-dist`) | principles 32, 47, 53 | 0.5 d | WP1 |
| SP-10 | Register analytics: add `library` feature actions to `docs/analytics/mixpanel-setup-notion.txt` then `events.ts` | repo analytics rule | 0.5 d | WP8 |

Total shared prerequisites: about 13.5 days. SP-1, SP-2, SP-3, SP-8, SP-9 gate WP0 to WP1; the rest can overlap.

## 4. State ownership (principle 13)

| State | Owner | Notes |
|---|---|---|
| tab, query `q`, scope, filters, sort, cursor | URL (`libraryQuerySchema`) | debounce only the draft of `q`; `replace` for refinements, `push` for tab change |
| file id, cite locator, page number (optional) | URL (path / query) | `?cite=` highlights; PDF page number optional |
| file lists, detail, grants, usage, trash, storage, settings, prefs, members, limits, flags | React Query | never copied into `useState` |
| upload queue and per-file progress/status | `lib/library/upload/store.ts` (external store, `useSyncExternalStore`) | selectors per upload id; throttled writes; not in context |
| row selection | `FileTable` reducer (ids) | Trash only in Phase 1 (Empty Trash) so selection is minimal |
| menu/dialog open, hover, zoom, audio playhead, search draft | local `useState` | |
| picker config (multi, allowed formats, onConfirm) | scoped context at the dialog | low frequency |
| dialog drafts (rename text, share input) | local state (documented draft-of-prop exception) | |
| view/column prefs | localStorage via safe wrapper | cleared on logout |
| auth/org/workspace | existing contexts | Library keys include `orgId` |

## 5. Data layer design

### 5.1 Keys and defaults

```ts
libraryKeys = {
  all: (org) => ["library", org] as const,
  lists: (org) => [...all(org), "list"],
  list: (org, p: ListParams) => [...lists(org), p],
  suggested: (org) => [...all(org), "suggested"],
  detail: (org, id) => [...all(org), "file", id],
  usage: (org, id) => [...detail(org, id), "usage"],
  access: (org, id) => [...detail(org, id), "access"],
  trash: (org) => [...all(org), "trash"],
  storage: (org) => [...all(org), "storage"],
  picker: (org, p) => [...all(org), "picker", p],
  uploads: (org) => [...all(org), "uploads"],
  prefs: (org) => [...all(org), "prefs"],
  orgSettings: (org) => [...all(org), "org-settings"],
  members: (org) => [...all(org), "members"],
  limits: (org) => [...all(org), "limits"],
  flags: (org) => [...all(org), "flags"],
}
```

| Query | staleTime | gcTime | Notes |
|---|---|---|---|
| list / picker | 30 s | 5 min | `keepPreviousData`, `maxPages: 10` (virtualised), refetch on focus |
| suggested | 60 s | 5 min | |
| detail | 30 s; 0 while `phase !== ready` | 5 min | polling when processing |
| usage / access | 30 s | 5 min | enabled when the panel opens |
| trash | 30 s | 5 min | |
| storage | 60 s | 5 min | |
| limits, flags | 10 min | 30 min | rarely change |
| prefs, org settings, members | 5 min | 30 min | invalidated by mutations |

Retry: `retry: (n, e) => e instanceof ApiError && e.retryable && n < 2`; mutations `retry: false`. No 4xx retries.

### 5.2 Entities (principle 31)
`detail(id)` is canonical. A list/picker `select` seeds `detail(id)` with a merge that never downgrades richer fields. `patchFileEverywhere(qc, id, patch)` is the single multi-key writer (detail + `setQueriesData` over `lists`, `picker`, `trash`, `suggested`) and is covered by tests; prefix invalidation always follows.

### 5.3 Mutations (principle 33)

| Mutation | Optimistic | Rollback | Then |
|---|---|---|---|
| rename | yes | restore snapshot | invalidate detail + lists |
| trash | yes (move to Trash cache, `daysLeft 30`) | restore snapshot | Undo toast calls restore; invalidate storage |
| restore | yes | snapshot | invalidate |
| revoke grant | yes | snapshot | invalidate access + lists |
| settings toggles | yes, idempotent target-state PUT, `mutationKey`, latest value only | snapshot + toast | invalidate settings |
| share (add grant) | **no** (server resolves ways in) | n/a | invalidate access + lists |
| delete forever / empty trash | **no** | n/a | confirm dialog then invalidate trash + storage |
| member removal / transfer / leave | **no** | n/a | invalidate members |
| unsave / save (promotion) | no | n/a | patch the attachment state |

### 5.4 Polling (principle 36)
`useUploadStatus(ids)` calls one batch endpoint `GET /library/uploads?ids=` through a single `refetchInterval` function: 2 s for the first 10 polls, then 5 s, then 10 s, `false` when every id is terminal, paused in a hidden tab. This keeps polling at about 30 requests/min worst case, safely under the `apiRateLimiter` (100/min) that the 10-upload cap would otherwise breach with per-file polling.

## 6. Upload subsystem (the riskiest client code)

State machine (pure reducer, per attachment):
`selected -> validating -> uploading(progress) -> processing(slow?) -> ready | failed(reason) | cancelled`, plus `paused` (offline) and `retrying`.

Design:
- **Store** (`store.ts`): `Map<uploadId, UploadItem>` behind `useSyncExternalStore`; selectors `useUpload(id)`, `useUploadIds(chatId)`; actions `enqueue, progress, setStatus, cancel, remove, retry`. Progress writes are coalesced to one rAF or 100 ms per item. Lives above the route group so navigation never aborts uploads; `LibraryUploadHost` (tiny, mounted in `(app)/layout.tsx`) owns lifecycle: abort all on logout, session expiry or workspace switch.
- **Transport** (`transport.ts`): 1) `POST /library/uploads` (JSON, via `apiFetch`) returns upload id + multipart session; 2) parts of 8 MB, concurrency 3, **plain `XMLHttpRequest`/`fetch` to the presigned URL with no Authorization header**, per-part retry x3 with exponential backoff + jitter, re-presign on `upload_url_expired`; 3) `POST .../complete` (fresh token each time, `Idempotency-Key`); 4) status via the batch poll. Never route part bytes through the Next proxy.
- **Resume**: on `online`, continue from the parts already acknowledged; partial uploads are never `ready`.
- **Validation**: client check against `GET /library/limits` (fallback `FILE_CONSTRAINTS`); duplicates allowed; never hash on the main thread (no client hashing in Phase 1).
- **Failure copy** comes from `messages.ts` keyed by `reason`; the message never names the file.
- **Composer**: `ChatInput` renders `AttachmentCard`s from selectors; Send disabled until every item is `ready` (with tooltip). On send, the chat request carries `libraryFileIds`; the response's `savedFileIds` / `ask_save` drive the invalidations and dialogs (02 section 6).

## 7. Viewer design (principles 21, 46, 47, 49)

| Format | Approach | Library | Notes |
|---|---|---|---|
| PDF | canvas rendering of pages with a virtualised page list | `pdfjs-dist` (already a dependency) behind `lib/library/viewers/pdf.ts` + `next/dynamic({ ssr: false })` | worker via `new URL(..., import.meta.url)` (hashed); scripting disabled; text layer for highlight (`?cite=` page); render only visible pages |
| Document / text / slides / email / web | **extracted text pages** from the preview endpoint (OQ-23), rendered as text | none | never inline HTML; passage highlight with `HighlightMark` |
| Sheet / CSV | **windowed JSON from the API** (`GET /library/files/{id}/preview?sheet=&rowStart=&rowCount=`), rendered in a virtualised table | none (no client spreadsheet parser) | cells rendered as text; row highlight for `?cite=` |
| Image | `<img>` of a presigned (or rendition) URL | none | never inline SVG; SVG treated as an image only; reserved aspect-ratio box |
| Audio | native `<audio controls preload="metadata">` + transcript list (seek on click) | none | `media-src` CSP addition; transcript table accessible |

Each viewer is wrapped in an error boundary (fallback: file info + Download) and a chunk-error retry. The preview chunk is preloaded on row hover/focus and when idle, keyed by format so only the matching viewer loads. A viewer receives data via props from `FileScreen`; it never fetches on its own except for the windowed sheet and PDF page bytes.

## 8. Security rules (principle 21) as testable requirements

R1 File names, titles, uploader names and snippets are untrusted: rendered as JSX text only; truncated and stripped of control/bidi/zero-width characters for display; the original name is used only for the download filename via the server's `Content-Disposition`.
R2 No `dangerouslySetInnerHTML`, no `innerHTML`, no inline SVG from user files, no iframes for previews; text previews are text.
R3 Sheet cells render as text; CSV/XLSX export (if ever added) prefixes cells starting with `= + - @` to neutralise formula injection.
R4 Presigned URLs: fetched at view time, short TTL, never stored in query data beyond their TTL (give those queries `gcTime: 0`/short staleTime), localStorage, URL or logs; opened with `rel="noopener noreferrer"`; never sent our bearer token.
R5 Every permissioned action is enforced server side; the UI only hides or disables. Share/revoke/trash/restore are re-checked on the server; client checks are UX.
R6 Upload validation (type, size) is UX; the server re-validates and sniffs content. The composer never inserts raw file names into rendered markdown.
R7 No file content, names, queries or presigned URLs in analytics, logs, Sentry or `localStorage`.
R8 CSP additions limited to the storage origin (section 06); no `unsafe-eval`; no new `frame-src`.
R9 External links only with scheme allow-list (http, https, mailto) and `rel="noopener noreferrer"`.
R10 Viewer libraries are pinned and audited; lazy-loaded; their CVEs tracked (Dependabot).

## 9. Performance plan and budgets (principles 8, 46 to 56)

Budgets (all start as proposals to be measured in WP1 and then set at measured + 20 %, per the repo convention in `perf-budget.json`; changes require a reason in the PR):

| Budget | Target |
|---|---|
| Library route-specific initial JS (on top of the shared path) | <= 70 KB gz |
| No single initial chunk | <= 350 KB raw (existing `maxInitialChunkKB`) |
| Viewer chunk excluding pdfjs | <= 100 KB gz |
| pdfjs lazy chunk | measure, then +20 %; never in an initial chunk |
| Shared-path (root layout, providers) change | <= +2 KB gz (the upload store and host must be tiny) |
| `/library` LCP / CLS / INP / TBT (5,000-row seed, 4x CPU, 10 Mbps / 40 ms RTT, median of 3) | <= 2.5 s / <= 0.1 / <= 200 ms / <= 300 ms |
| Search keystroke to rendered results p75 | <= 600 ms (excluding backend time over 300 ms) |
| Scroll 5,000 rows | 60 fps, DOM nodes in the table <= ~120 |
| Preview open to first content (PDF page 1, 5 MB) | <= 1.5 s warm chunk |
| Thumbnail bytes in a list | <= 20 KB each, none above the fold marked `preload` |

Virtualisation parameters: row 52 px, `overscan` 8, `getItemKey = id`, `maxPages` 10, load-more at `lastIndex >= count - 5`.

Measurement: `scripts/perf-library.mjs` (Playwright, logged-in fixture, seeded account) records JS transferred per route, LCP, CLS, long tasks, INP proxy (interaction latency for search, tab switch, filter), and DOM node count; writes JSON like `docs/perf/library-latest.json`; `perf:library:check` compares with a new `dynamicRoutes` block in `perf-budget.json`. Existing `perf:bundle:check` still guards the shared path and chunk sizes. If Playwright cannot run in CI, add a prerendered fixture route that renders the table shell and budget it like `/reasoning-verify`.

Rules that protect the budget: no heavy import outside the lazy viewer wrappers (lint); explicit icon map; no barrel for Library; thumbnails lazy with fixed boxes; search debounced 250 ms with abort; filter changes in `startTransition`; no per-row fetches; progress writes coalesced; React Compiler friendly code with no habitual memo; `npm run doctor` clean.

## 10. CI/CD and test plan (principle 18)

Workflow `library.yml` on PRs touching Library paths (and nightly): install with `npm ci` and cache; parallel jobs `lint` (ESLint incl. jsx-a11y), `typecheck` (`tsc --noEmit`), `unit` (vitest, jsdom for component tests); then `build` (`next build --webpack`) and `perf:bundle:check`; then against the preview deployment `e2e` (Playwright smoke + axe) and `perf-library`. Required for merge: lint, typecheck, unit, build, bundle check, 1 review. `concurrency` cancels superseded runs; action versions pinned; least-privilege permissions; no `continue-on-error`; flaky tests quarantined with an owner.

Test pyramid:
- **Unit (vitest, node)**: pure logic listed in 02 section 11; reducers; URL codec; `patchFileEverywhere`; suggested selection; access helpers; sort/filter; upload machine; backoff; `messages.ts` coverage; coverage >= 90 % on `lib/library/**`.
- **Hook tests (jsdom + renderHook + MSW)**: `useLibraryFiles` pagination and keepPreviousData, optimistic rename/trash rollback with forced 500, polling stop at terminal, error mapping for 401/403/404/409/413/415/422/429/500/timeout/malformed JSON, workspace switch clears keys, logout aborts uploads.
- **Component tests (jsdom + Testing Library + vitest-axe)**: table semantics and `aria-sort`, row menu permissions, Send hold, dialog focus trap/return, filter chips, locked/gone states, empty/loading/error states.
- **Contract test**: our zod schemas vs `back-end/openapi.yaml`.
- **E2E (Playwright)**: flows A to H from `05` section 5 including sad paths; axe on `/library`, `/library/files/[id]`, `/settings/library`; keyboard-only run of flows A and E.
- **Perf (Playwright)**: section 9.
- **Manual before each flag ramp**: NVDA/VoiceOver, dark mode, reduced motion, slow network, 4x CPU.

## 11. Observability (principle 55)

`lib/library/observability.ts` wraps reporting (`captureError(err, { fileId?, route, boundary })`), file ids only, no names, no content. Mixpanel through `trackFeature("library", { action, tab?, format?, source?, scope?, sizeBucket?, durationBucket?, reason? })` using enums only: `open_tab, open_file, search, filter, sort, share, revoke, trash, restore, delete_forever, empty_trash, rename, download, ask_about, pick_from_library, request_access, upload_started, upload_completed, upload_failed, preview_rendered, autosave_changed, citation_opened, import_started`. Search events fire on the debounced value, record length bucket and result-count bucket, never the text. Custom marks: `library:first-rows`, `library:preview-open`, `library:search-latency`. Web Vitals via the global reporter, segmented by route. Alerts: preview render failure rate, upload failure rate by reason, p75 INP on `/library`. Add the monitoring endpoint to CSP `connect-src` when chosen.

## 12. Work packages

Dependencies: SP-1/2/3/8/9 -> WP0 -> WP1 -> (WP2, WP3) -> WP4 -> (WP5, WP6) -> WP7 -> WP8. Backend steps (04 section 10) gate real-API integration; the mock adapter lets UI proceed.

### WP0 Foundations (4 d)
Tasks: route skeletons with `loading/error/not-found`; `lib/library` skeleton (schemas, keys, api interface, mock adapter with fixtures from the prototype); `libraryQuerySchema` + `useLibraryQuery`; feature flag `LIBRARY_ENABLED`; sidebar item; dev page `app/(app)/dev/library` rendering every component state; `FormatGlyph`, `EmptyState`, `InfoTip`, `AccessAvatars`, `GeneratedMark`, `UnreadDot`, skeletons.
Acceptance: flag off hides everything; dev page shows all states in light and dark; unit tests for codec.

### WP1 Browse (6 d)
Tasks: `FileTable` (virtualised, fixed rows, semantics, sort headers), header, tabs, search with scope chip and debounce, filter panel/chips, sort menu, Suggested view, `StorageLabel`, empty/error/loading, URL sync, scroll restoration, prefetch viewer chunk on hover, perf measurement baseline recorded.
Acceptance: 5,000-row mock holds 60 fps; INP within budget; axe clean; budgets recorded.

### WP2 File page and previews (7 d)
Tasks: `FileScreen`, info card, provenance, Used in, Who has access, state banners, locked/gone, viewers (PDF, text pages, sheet window, image, audio + transcript), error boundaries, `?cite=` highlight, `document.title`, Ask-about handoff, opened tracking.
Acceptance: each viewer in lazy chunk; corrupt-file fallback shows Download; pdfjs only in lazy chunk (analyzer); R1 to R4 tests.

### WP3 Mutations, sharing, trash (5 d)
Tasks: rename, share dialog (typeahead, ways in), revoke, delete with usage dialog, Trash screen (restore, delete forever, Empty Trash), optimistic helpers, Undo toasts, `patchFileEverywhere`, request access.
Acceptance: rollback tests with forced 500; permission matrix tests; focus return on dialogs.

### WP4 Composer upload and picker (8 d)
Tasks: upload store/machine/transport, `LibraryUploadHost`, `AttachmentCard`, notices (paused, slow, save retry, Undo), failure strip, Send hold, `ChatInput` integration (flagged), picker dialog, auto-save ask dialog, batch status polling.
Acceptance: uploads survive navigation; offline pause/resume; no bearer to storage origin (test); progress writes <= 10/s per item; flows A edge cases pass.

### WP5 Chat integration: citations and sources (4 d)
Tasks: citation resolver and chips (locked/deleted/current name), Sources panel changes, Sources used, not-in-files marker, files_truncated notice, `ApprovalCard` source file, delete-chat "Also delete these files".
Acceptance: unverifiable-citation tolerance, mid-chat removal events handled.

### WP6 Routines (3 d)
Tasks: attach from Library in the routine editor, pane notes from `runInputs`, skipped/lost-access/size-limit notes, delete routine with outputs dialog.

### WP7 Settings and Admin (4 d)
Tasks: personal settings, Admin settings with versioned PATCH and Changed-by notice, members table, remove/leave with transfer question and last-Admin guard, kill-switch states, Import dialog, storage block, static Audit/Inventory pages.

### WP8 Hardening and rollout (5 d)
Tasks: perf script and budgets locked, CI workflow, axe and e2e suites, analytics events, security review, manual a11y pass, bundle analyzer verification, flag ramp plan, docs (`docs/api/library-endpoints-usage.md`, SSE additions), remove mock adapter once the real contract passes.

Total feature work about 46 days plus about 13.5 days of shared prerequisites (about 60 engineer-days; roughly 6 weeks with two engineers). Critical path: SP-1/SP-3 -> WP0 -> WP1 -> WP4 (composer) because it depends on the backend upload contract.

## 13. Code standards for this feature

- TypeScript strict, no `any` at boundaries; wire types come from zod (`z.infer`); `import type` for types; discriminated unions for status; exhaustive `switch` with a `never` check.
- Files: components <= 300 lines, hooks <= 150, one exported component per file where practical; named exports; no default exports except Next route files.
- Props <= 7; slots/children over boolean flags; callbacks named by intent (`onOpen`, `onShare`).
- No `useEffect` for derived state or data fetching; effects only for subscriptions, timers and imperative APIs with cleanup (abort, disconnect, clear).
- No manual memoisation without a measured reason noted in a comment; no `"use no memo"` without a comment.
- Comments explain why (a constraint, an invariant, a gotcha), not what; match the surrounding file's density.
- Strings through `messages.ts` (keys, not inline); no raw colours; tokens only.
- Every `"use client"` file has a one-line reason comment.
- PR template checklist: rendering table updated, state owner named, loading/empty/error/offline states, a11y checks, budget numbers, security rules R1 to R10, analytics registered, tests added, flag behaviour.

## 14. Rollout

Flag ladder: `LIBRARY_ENABLED` internal org -> opted-in orgs -> default; server flags in 04 section 9; kill switch hides UI and falls back to the legacy attach path without data loss. Each ramp step requires: quality gates green, p75 INP and upload failure rate within SLO for 3 days, no permission incidents. Flag removal date set at launch.

## 15. Definition of done (feature level)

1. Every DoD item in `06-principles-application.md` ticked.
2. Gates in `05` section 5 and section 10 above are green.
3. Budgets recorded in `perf-budget.json` and enforced in CI.
4. Security review signed (R1 to R10).
5. EC register (01 section 14) covered.
6. Docs and analytics registration updated; mock adapter removed.
7. Audit in `08-plan-audit.md` re-scored after build (target >= 90 %).

## 16. Open questions added by this plan

Logged in `05-delivery-plan-and-qa.md` section 8 as OQ-26 to OQ-31 (spike results needed before WP4): resumable-upload protocol (S3 multipart vs tus), batch status endpoint, thumbnail rendition field, `deploymentId`, Sentry adoption, CI hosting for Playwright.
