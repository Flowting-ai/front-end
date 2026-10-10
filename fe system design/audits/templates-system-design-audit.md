# Templates Feature: System Design Audit

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
