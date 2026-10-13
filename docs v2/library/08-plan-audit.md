# 08 Audit of the Library plan against the 56 principles

Method: same format as `fe system design/audits/*.md`. Scope audited: the plan documents `01` to `05` as first written and revised (before this audit), then the corrected set including `06` and `07`. This is a **design-stage** audit: it scores whether the plan makes the principle's checklist achievable and unambiguous, not whether code exists. Each audit after build must re-score from code (target >= 90 %).
Scoring: 1 = applied, 0.5 = partial, 0 = absent or wrong; applicable principles only (46 of 56; the 10 that do not apply are listed in `06`).

## Overall efficiency

| Folder | Applicable | Before (docs 01 to 05) | After (this audit's fixes) |
|---|---|---|---|
| 1. Requirements and Rendering | 7 | 3.5 (50 %) | 6.0 (86 %) |
| 2. Architecture | 8 | 6.0 (75 %) | 7.5 (94 %) |
| 3. Component Patterns | 4 | 2.0 (50 %) | 4.0 (100 %) |
| 4. Data Model | 9 | 6.0 (67 %) | 8.5 (94 %) |
| 5. Interfaces and APIs | 7 | 4.5 (64 %) | 6.0 (86 %) |
| 6. Optimizations | 11 | 5.5 (50 %) | 9.5 (86 %) |
| **Total** | **46** | **27.5 (60 %)** | **41.5 (90 %)** |

The remaining 10 % is dependencies the plan cannot close by itself: CSP and bucket CORS (infra), the backend batch-status and thumbnail endpoints, OpenAPI documenting the Library endpoints, a monitoring SDK, and the new perf script not yet written. Each is tracked as a shared prerequisite (07 section 3) or an open question (OQ-26 to OQ-31).

For context, existing feature audits in this repo range 40 % to 63 % (average about 48 %); the plan is designed to start well above that, but a plan score is not a code score.

## 1. Already applied well (kept)

| Principle | Evidence in the plan |
|---|---|
| CSR interior with leaf boundaries (#2, #6) | Server shell + client islands; locked/gone as states not 404s |
| Cursor pagination (#39) | List, trash, grants all cursor (04 section 5) |
| React Query backbone (#30, #38) | Key factory, invalidation matrix, optimistic helper pattern copied from `optimisticTogglePause` |
| URL as state (#34) | Tab, query, filters, sort, cursor in URL; defined in 02 section 1 |
| Virtualisation (#51) | `@tanstack/react-virtual`, fixed row height |
| Security thinking (#21) | Untrusted names, presigned URLs, server-side authorisation, no content in analytics |
| Accessibility (#20) | Semantic table, labelled controls, live regions, no colour-only status |
| Design-system reuse (#15) | shadcn as a token-restyled layer, reuse of existing Avatar/Badge/Checkbox/Switch/Tooltip |

## 2. Applied but needs improvement (fixed)

| Principle | Gap found | Fix |
|---|---|---|
| Component architecture (#12) | No size limits, import rules or layering written down | 07 sections 2.1 and 13: layers, import rules, 300/150-line limits, props <= 7 |
| Style management (#16) | Dynamic widths/progress not addressed | 06: CSS variables for dynamic values, no dynamic class names, transform/opacity animation only |
| CI/CD (#18) | Gate 3 claimed "vitest + testing library already used"; Playwright "see memory" | Corrected: neither jsdom/Testing Library nor Playwright is in `devDependencies` (vitest is node-only). New SP-3, SP-4, SP-5 and 05 gate wording |
| Error boundaries (#19) | Only route-level mentioned | Component-level boundaries around each viewer, table region, share dialog body; chunk-error retry; ids only in reports; SP-2 for `global-error` and a reporting `ErrorBoundary` |
| Data normalisation (#31) | Single mention of `setQueryData` | `detail(id)` canonical + one `patchFileEverywhere` helper with a no-downgrade merge test |
| Forms (#35) | Dialog validation unspecified | Plain forms + shared zod 4 schemas, aria-linked errors, no RHF until a field array exists |
| REST contract (#37) | Hand-written shapes trusted | Contract test against `back-end/openapi.yaml`; backend asked to document endpoints |
| Custom hooks (#40) | Hooks listed, layering unstated | Four-layer rule in 07 section 2.2; narrow return objects |
| Tree shaking (#47) / images (#49) | Not mentioned | Explicit icon map, no barrels, one pdfjs wrapper, thumbnail renditions only, plain `<img>` for authenticated URLs |
| Lazy loading (#48) | Not specified for thumbnails/audio | `loading="lazy"`, fixed boxes, `preload="none"`, preload viewer chunk on hover/focus |
| Debounce/throttle (#53) | Search debounce only | 250 ms search with abort; throttled scroll save; coalesced progress writes |
| Observability (#55) | Analytics only | `lib/observability` wrapper, ids only, Web Vitals reporter, custom marks, SLOs |

## 3. Applied wrongly (corrected in the earlier docs)

| # | Where | Problem | Principle | Correction made |
|---|---|---|---|---|
| W1 | 02 sections 2 and 6 | Upload state lived in a `library-context` **provider** | 24, 28, 50: high-frequency shared state in context re-renders consumers | Replaced by an external store with selectors plus a tiny `LibraryUploadHost`; 03 and 02 updated |
| W2 | 02 section 6 | Poll `GET /library/uploads/{id}` per attachment | 36 + `apiRateLimiter` (100 req/min): ten uploads at 2 s polling is about 300 req/min | Single **batch** status endpoint and one `refetchInterval` function; added to 04 |
| W3 | 05 section 5 gate 7 | Add `/library` to `perf-budget.json` `pages` | 56: the script only budgets prerendered pages and fails "not prerendered" for dynamic routes | `scripts/perf-library.mjs` + `dynamicRoutes` block (07 section 9) |
| W4 | 02 section 6 | Described part uploads via `uploadRateLimiter`/`directUpload` generically | 41, 42: part bytes must not pass the proxy or carry the bearer token | Control plane via `apiFetch`; part PUTs direct to presigned URLs with no Authorization header; 04 requires CORS and short-lived URLs |
| W5 | 03 / 02 | Audio preview did not mention CSP; PDF worker path unhashed (`public/pdf.worker.min.mjs`) | 9, 21 | `media-src` and `connect-src` additions; hashed worker via `new URL(...)`; no `frame-src` |
| W6 | 05 gates | Claimed Sentry/vitals/boundaries could be verified | 19, 55: none exist | SP-2 prerequisite; reporting through a wrapper |
| W7 | 02 section 3 | "Parse every response" but no `kind/code/fieldErrors` model | 45 | SP-1 extends `ApiError`; UI branches on `code` |

## 4. Missing, added

| Principle | Added |
|---|---|
| Performance budget and CI (#56) | Numeric budgets, measurement method, dynamic-route check, shared-path guard (07 section 9) |
| Core Web Vitals (#8) | Targets, reserved space, `useReportWebVitals`, custom marks |
| React performance (#50) | Compiler rules, selectors for hot state, no habitual memo, react-doctor |
| useTransition (#54) | Specific uses and non-uses |
| Bundle splitting (#52) | Shared-path guard (<= +2 KB), nothing heavy in layout/providers/contexts |
| CDN (#9) | Private caching for thumbnails, CSP, bucket CORS, hashed worker |
| Testing | Test pyramid with the missing infrastructure called out (07 section 10) |
| Security rules | R1 to R10 as testable requirements |
| Backend contract asks | 04 section 5b (batch status, thumbnails, `Retry-After`, `requestId`, cursor binding, OpenAPI coverage) |

## 5. Remaining risks after the fixes (what would lower a re-audit)

1. **Upload contract not agreed** (resumable protocol, batch status): WP4 cannot finish against the real API. Spike first (OQ-26, OQ-27).
2. **Thumbnail renditions** absent: the list would have to show type icons only or load originals (not allowed). Needs backend (OQ-28).
3. **No monitoring SDK**: observability stays a shim; error visibility depends on Sentry adoption (OQ-30).
4. **Perf script is new code** and the CI host for Playwright is undecided (OQ-31); until then budgets are advisory.
5. **Shared-code PRs (SP-1, SP-2)** touch widely used modules; they need their own review and tests to avoid regressions in other features.
6. **Virtualised table accessibility** (`aria-rowcount`/`rowindex` with a real `<table>`) is the trickiest a11y item; keep a manual screen-reader pass in the gates.
7. **`deploymentId`** is unset; many lazy chunks and long-lived tabs increase chunk-mismatch risk (OQ-29).

## 6. Plan to 100 %

| Phase | Work | Principles moved |
|---|---|---|
| 1 | SP-1, SP-2, SP-3, SP-8, SP-9 then WP0 | 19, 45, 18 (partial), 12, 15 |
| 2 | WP1 with the baseline perf measurement and budgets recorded | 8, 46 to 54, 56 |
| 3 | Backend spikes closed (resumable upload, batch status, thumbnails, CORS/CSP) then WP2 to WP4 | 9, 36, 37, 41, 42, 49 |
| 4 | WP8: perf script, CI workflow, Sentry decision, contract test, axe and e2e | 18, 37, 55, 56 |

Re-audit protocol: after WP4 and again before the first flag ramp, re-score every row from code (route table from `next build`, analyzer output, budgets, axe results, test coverage) and update this file with evidence links.
