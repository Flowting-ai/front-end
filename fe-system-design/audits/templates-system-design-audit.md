# Templates Feature: System Design Audit

> **Status (Oct 14 2026): Phases 1–3 done** (2.3 decided against; rate limiting is decision D4).
>
> Done (Phase 1):
> 1. Both fetches have `AbortSignal.timeout(15s)`. The page reports a timeout state; the route returns 504. `upstream.json()` is in try/catch, so invalid JSON becomes the error state instead of a throw.
> 2. The HTML route no longer forwards backend error bodies. It returns fixed `{ error: { code, message } }` responses (403/404/410 kept, others 502, timeout 504; `TEMPLATE_ROUTE_ERRORS`) and logs the uuid, status and the first 500 characters of the body on the server.
> 3. Added `loading.tsx` (header skeleton) and `not-found.tsx`. An invalid uuid and a backend 404 now call `notFound()`; `(app)/error.tsx` covers throws.
> 4. Pure logic moved to `lib/templates/template-view.ts`: schema, `loadTemplate` (fetch is injectable), status mapping, `decodeEntities` (out-of-range code points like `&#x110000;` are now left as written instead of throwing `RangeError`), `formatBytes`, `formatBuilt` (returns a fallback for an invalid date).
> 5. Tests: 16 in `lib/templates/template-view.test.ts` and 8 in `app/api/template/[uuid]/route.test.ts`, covering 400, 401, the sandbox CSP, nosniff and no-store headers, 403/404/410/500 mapping without body leakage, 504 and 502.
> 6. `TemplateNotice` (now a separate file) has `role="status"`, or `role="alert"` for timeout and error. Its heading is an `h1`.
> 7. (Phase 2.1) The page uses `BACKEND_BASE` and `getSessionToken` from `lib/server/backend.ts` instead of its own copies. `RouteErrorCode` gained `timeout`.
>
> Open (was): Phase 3 (analytics event, TTFB budget, size cap and rate limit, `features.md` correction).
>
> Phase 2 (Oct 14 2026):
> - 2.2: new shared `components/RouteState` (heading, body, actions, `status`/`alert` role; Tailwind with design tokens, server-safe). `TemplateNotice` is now a thin wrapper over it, and `ScheduleRouteStates` and `ProjectNotFound` use it too. The template header, frame and `loading.tsx` moved from inline styles to Tailwind classes; `--legacy-1a1916` is replaced by `--neutral-900` (a slightly warmer near-black, same in dark mode).
> - 2.3: decided against. The not-found / no-access / revoked / timeout states replace the frame, so metadata has to be known before the frame renders; loading the HTML in parallel would fetch (and show) an error body behind the notice. The metadata call is one small request with a timeout. Recorded in the page comment.
> - 2.4: decided and documented in the page comment and the route: `sandbox="allow-scripts allow-popups allow-forms"` with no `allow-same-origin` (opaque origin) and no `allow-popups-to-escape-sandbox` (popups inherit the sandbox); the route's CSP mirrors it and `next.config.ts` relaxes framing only for `/api/template`.
>
> Phase 3 (Oct 14 2026):
> - 3.1: every non-200 outcome is one structured line: `template_view_failed` (page, with the state) and `template_html_failed` (route: state, status, first 500 characters of the backend body; no ids). Views are counted by `screen_viewed` with the new `template_view` screen (Analytics Phase 2).
> - 3.2: TTFB, LCP and the other Web Vitals arrive as `web_vital` events tagged `template_view` (shared reporter, decision D6); a hard budget needs a CI build (D8).
> - 3.3: size cap on `/api/template/[uuid]`: 10 MB (`TEMPLATE_MAX_BYTES`), refused up front from `Content-Length` and enforced while streaming (`capStream`), with a new `too_large` state and notice. Rate limiting is decision D4. Revoke and audience controls live in the backend's share flow (Slack), not in this app.
> - 3.4: `features.md` already describes the feature correctly; the tests run in CI (`npm test`). 3 tests in `template-size.test.ts`.
>
> Backend gaps: (a) the title is stored with HTML entities still in it; the backend should unescape it when it extracts `<title>`, so the frontend decoder can go. (b) Rate limiting and a size cap for `/templates/{id}/html` belong on the backend.

Correction to `features.md`: the `template` route is not "reusable chat/prompt templates". It serves **stored, model-written HTML pages** (dashboards, reports) that people share by link (often from Slack). The folder `src/templates` is unrelated: it holds Schedules and SuperLinks UI. Agent/chat "template cards" (`agents/templates`, `TemplateCardList`) are separate features.

Scope: `app/(app)/template/[uuid]/page.tsx` (229 lines), `app/api/template/[uuid]/route.ts` (72 lines), the `/api/template` header override in `next.config.ts`.
Method: both files read in full; config checked by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~63% (12.0 / 19 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 4 | 3.15 | 79% |
| 2. Architecture | 7 | 3.6 | 51% |
| 3. Component Patterns | 1 | 0.6 | 60% |
| 4. Data Model | 2 | 2.0 | 100% |
| 5. Interfaces and APIs | 3 | 2.65 | 88% |
| 6. Optimizations | 2 | 0.0 | 0% |

Not applicable: SSG, ISR, CSR state patterns, global/local state, optimistic updates, forms, virtualisation, code splitting, WebSocket, PWA, monorepo, HOC.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Server rendering / RSC (#1, #6) | Page is an async server component: validates the id, fetches metadata with the token on the server, renders the shell with no client JS and no loading flash |
| Frontend security (#21) | Model-written HTML is isolated: iframe `sandbox="allow-scripts allow-popups allow-forms"` (no `allow-same-origin`), matching `Content-Security-Policy: sandbox ...; frame-ancestors 'self'` and `nosniff` on the route, plus a path-scoped override in `next.config.ts` for the otherwise app-wide `X-Frame-Options: DENY` |
| Defence in depth | Same headers repeated in the route handler so isolation holds even if the config rule is skipped |
| Runtime validation (#35) | Route param validated with `z.uuid()`; backend response parsed with a Zod schema that mirrors the backend model |
| BFF (#41) | Browser never sees the backend URL or token; the handler adds `Authorization` server-side |
| Authentication (#42) | Missing session redirects to `/auth/login?returnTo=/template/<uuid>`, so a Slack-link visitor lands back on the page after sign-in |
| Authorisation | Delegated to the backend; the route passes its status through unchanged rather than re-implementing rules |
| Error states (#45) | Explicit 403/404/410/error branches with human messages (`NOTICES`); revoked pages distinct from missing ones |
| Streaming (#7) | HTML body is piped straight from upstream (`upstream.body`), not buffered |
| Caching correctness (#9) | `Cache-Control: private, no-store` plus `force-dynamic`, correct for per-user authorised content |
| URL as state (#34) | The uuid in the path is the whole state |
| Small, readable code | Two short files with comments that explain why |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Error boundaries (#19) | Errors are handled inline, but there is no `error.tsx`, `not-found.tsx` or `loading.tsx`; an unexpected throw (e.g. `upstream.json()` on invalid JSON) falls to the generic error | Add `error.tsx`/`loading.tsx` for the route; wrap `upstream.json()` in try/catch (it throws before `safeParse` runs) |
| Accessibility (#20) | `iframe title` and `h1` present; no skip link, no focus handling, notices are not announced (`role="status"`/`alert`) | Add roles to `Notice`; make the iframe keyboard-reachable and document focus behaviour |
| Style management (#16) / design system (#15) | Inline style objects (including a full-screen `Notice`) and `--legacy-*` token use, unlike shared components | Reuse an empty-state component and Tailwind/tokens; drop the legacy colour token |
| Core Web Vitals (#8) | Page waits for the metadata fetch, then the iframe starts its own request: two sequential round trips before content | Start the HTML request in parallel (render the iframe immediately and let the metadata header stream via Suspense), or add `<link rel="preload">` |
| Network robustness (#45) | Both `fetch` calls have no timeout or abort; a hung backend holds the request open | `AbortSignal.timeout(...)`; map to 504 |
| Duplicated server plumbing | `BACKEND_BASE`, audience and token retrieval are repeated in the page and the route (and again in other API routes) | One `serverBackendFetch()` helper in `lib/` |
| Container/Presentation (#22) | Data loading, entity decoding, formatting helpers and markup share one file | Move `decodeEntities`, `formatBytes`, `formatBuilt` to `lib/` with unit tests; keep page presentational |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Title decoding | The backend leaves HTML entities in the title and the frontend patches that with a hand-written entity decoder (numeric code points, a six-entry table) | Fix at source: decode in the backend; short term use a small tested library; at minimum cap `String.fromCodePoint` input (invalid code points throw `RangeError`, e.g. `&#x110000;`) (verify) |
| Error text leakage | `new Response(await upstream.text(), { status })` forwards backend error bodies to the browser verbatim | Return a fixed message per status; log the body server-side |
| `allow-popups` without `allow-popups-to-escape-sandbox` question | Popups opened from the sandboxed page inherit the sandbox (links may behave oddly) (verify intent) | Decide explicitly and document |
| Docs mismatch | `features.md` description of Templates is wrong | Update it (this audit's correction) |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Observability (#55) | Nothing is logged or tracked: no event for view, 403/404/410, 502, load time. Add server logging with the uuid and status, and a typed analytics event for page views |
| Performance budget (#56) | No measurement of time to first byte for the HTML route |
| Tests | No test files for the page or route. Add: invalid uuid 400, unauthenticated 401/redirect, 403/404/410 mapping, schema failure, header assertions (CSP, nosniff, no-store), `decodeEntities` cases |
| Rate limiting / abuse | Public-link style access to large HTML: consider size cap and rate limit on the route (`byte_size` already known) |
| CSP for the shell page | The shell page itself relies on the app-wide CSP; confirm it permits the framed same-origin route and nothing more (verify) |
| Share management UI | Revoked state exists server-side; check that creators have a way to revoke and see who can view (verify in Share feature) |
| Copy/share affordances | Title bar lacks copy-link, open-in-new-tab, report (optional product work) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week.

### Phase 1: Hardening (S, 63% → ~80%)
1. Wrap `upstream.json()` in try/catch; add request timeouts to both fetches. (+0.5)
2. Return fixed error messages per status; log backend bodies server-side. (+0.5)
3. Add `error.tsx`, `loading.tsx`, `not-found.tsx` for `/template/[uuid]`. (+0.7)
4. Guard `String.fromCodePoint` against invalid code points; extract helpers to `lib/` with unit tests. (+0.5)
5. Add route and page tests covering all status branches and security headers. (+1.0)
6. Add `role="status"`/`alert` to `Notice`. (+0.3)

### Phase 2: Consistency (S-M, → ~92%)
1. One shared `serverBackendFetch()` (base URL, audience, token, timeout) used by this page, the route and the other API routes. (+0.8)
2. Replace inline styles and legacy tokens with the shared empty-state component and Tailwind/tokens. (+0.8)
3. Fetch metadata and HTML in parallel (or Suspense the header) to remove the sequential round trip. (+0.5)
4. Confirm popup sandbox policy and the shell CSP; document both. (+0.3)

### Phase 3: Observability and governance (S, → 100%)
1. Server logs for each non-200 outcome; typed analytics event for views. (+1.0)
2. Time-to-first-byte and page-load metrics with a budget. (+0.5)
3. Size cap and rate limit on the HTML route; confirm revoke/audience controls in the Share UI. (+0.5)
4. Update `features.md` description and keep this feature's tests in CI. (+0.2)

Re-score after each phase and settle all "(verify)" items first.
