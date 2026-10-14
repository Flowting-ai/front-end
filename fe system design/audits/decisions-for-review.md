# Decisions for review

Choices made (or left open) while implementing the audits' Phases 3–4. Each has options; **bold** is what the code does today. Reply with the letter you want, and I'll switch it where it differs.

| # | Feature | Decision | Status |
|---|---|---|---|
| D1 | Auth | Where the backend access token lives | Needs you + backend |
| D2 | Auth | Idle / absolute session limits | Shipped off by default |
| D3 | Auth | Inline scripts in the CSP | Kept `'unsafe-inline'` |
| D4 | Internal/API | Rate limiting for `/api/chat`, `/api/download`, `/dispatch` | Not added |
| D5 | Internal/API | Generated types from the backend OpenAPI spec | Not added (needs a dev dependency) |
| D6 | All (Phase 4) | Web Vitals sample rate | 10% of page loads |
| D7 | All (Phase 4) | Automated accessibility checks (axe) | Not added (needs a dev dependency) |
| D8 | All (Phase 4) | Build + bundle budget in CI | Not added (CI has no secrets) |
| D9 | All (Phase 3) | Form library for the "RHF + Zod" items | In-house `useZodForm` |
| D20 | Connectors | `next/image` for vendor logos | Kept plain `<img>` |
| D21 | Analytics | Consent gating for product analytics | No gate (unchanged) |

---

## D1. Access token in the browser (Auth Phase 3.1)

On deployed origins the browser calls the backend directly with a bearer token (`API_BASE_URL = SERVER_ORIGIN` in `lib/config.ts`). That avoids Vercel's serverless limits (300/800 s stream cut-off, 4.5 MB body cap) but means any script running in the page could read the token.

- **A. Keep as is** (token in memory only, never in storage; current code). Lowest effort; relies on CSP and dependency hygiene. ← current
- B. Backend accepts a `Secure; HttpOnly; SameSite` session cookie on its own domain (e.g. `api.getsouvenir.com` sharing a parent domain with the app). The browser never sees a token. Needs backend auth middleware + CSRF protection.
- C. Token exchange: the Next server mints short-lived (≈5 min), narrowly scoped tokens per call. Shrinks the blast radius; still a token in the page. Needs a backend/Auth0 change.
- D. Long-running proxy (not serverless, e.g. a Node service on Fly/Render) that attaches the token server-side for every call, including streams and uploads. Infra change.

Recommendation: B long term; A until then.

## D2. Session limits (Auth Phase 3.4)

Implemented in `lib/auth/session-policy.ts` + a "session ending" dialog, synced across tabs. Off unless `NEXT_PUBLIC_SESSION_IDLE_MINUTES` / `NEXT_PUBLIC_SESSION_MAX_HOURS` are set, because a forced sign-out in a chat app people leave open all day is a product call. Activity = pointer, keyboard, scroll or focus in any tab.

- **A. Off (no idle or absolute limit beyond Auth0's defaults).** ← current
- B. Idle 30 min, absolute 12 h, warn 2 min before.
- C. Idle 8 h (one working day), absolute 7 days.
- D. Absolute only (e.g. 24 h), no idle limit.

## D3. `script-src 'unsafe-inline'` (Auth Phase 4.2)

The CSP review removed the unused Google Tag Manager origin and added `object-src 'none'`, `base-uri 'self'` and `form-action 'self' <auth0>`. Scripts still allow `'unsafe-inline'`, which Next's inline bootstrap and the theme init script (`app/layout.tsx`) need. With D1-A (token in page memory), this is the main thing between an injected script and the token.

- **A. Keep `'unsafe-inline'`.** ← current
- B. Per-request nonces: `proxy.ts` sets a nonce header, the root layout reads it and passes it to Next and the theme script; `script-src 'self' 'nonce-…' 'strict-dynamic'`. Every page becomes dynamically rendered (no static HTML caching for app pages).
- C. Hash the theme init script and keep Next's scripts external (`'sha256-…'`); possible only if no other inline script remains — needs a check per Next upgrade.

## D4. Rate limiting (Internal/API Phase 3.1)

Serverless instances don't share memory, so an in-process limiter would only limit per instance. Note that deployed chat traffic goes browser → backend directly (D1), so the backend is where per-user limits really belong.

- **A. None in the front-end; ask the backend for per-user limits on chat and uploads.** ← current
- B. Vercel Firewall rate-limit rules on `/api/*` and `/dispatch/*` (dashboard config, no code).
- C. `@upstash/ratelimit` + Upstash Redis in `proxy.ts` (new dependency and service; per-user sliding window).

## D5. OpenAPI-generated types (Internal/API Phase 3.4)

`docs/openapi/openapi.yaml` exists (and `scripts/split-openapi.mjs`), but the client's request/response types are hand-written with Zod at the boundary.

- **A. Keep hand-written Zod schemas.** ← current
- B. Add `openapi-typescript` (dev dependency) and an `npm run gen:api-types` script writing `src/types/api.generated.ts`; use it for request bodies and as a check that Zod schemas match.
- C. Contract test only: a test that parses `openapi.yaml` and fails when a field the client sends is not in the spec (no new dependency; `js-yaml` is already used by `split-openapi.mjs`).

## D6. Web Vitals sampling (shared Phase 4)

`components/Analytics/WebVitalsReporter.tsx` sends LCP, INP, CLS, FCP and TTFB as `web_vital` events tagged with the screen concept (never the URL). One keep/drop decision per page load; `NEXT_PUBLIC_WEB_VITALS_SAMPLE` overrides.

- A. 100% (most precise; ~5 events per page view in Mixpanel).
- **B. 10%.** ← current
- C. 1% (enough for p75 on busy screens only).
- D. Send to a different sink (Vercel Speed Insights, which needs `@vercel/speed-insights`).

## D7. Automated accessibility checks (shared Phase 4)

`axe-core` is in `node_modules` only as a transitive dependency (via `eslint-plugin-jsx-a11y`), so tests can't rely on it. `eslint-plugin-jsx-a11y` already runs static checks in lint.

- **A. Static lint only (jsx-a11y) plus the manual screen-reader passes listed in each audit.** ← current
- B. Add `axe-core` as a dev dependency and an `expectNoA11yViolations(container)` helper for jsdom component tests (dialogs, selectors, tables first).
- C. B plus Playwright + `@axe-core/playwright` page scans of the main routes in CI (needs a running app in CI).

## D8. Build and bundle budget in CI (shared Phase 4)

`npm run perf:bundle:check` and `perf-budget.json` exist, but CI skips `next build` because `prebuild` loads secrets from AWS that CI doesn't have (`.github/workflows/ci.yml`). App-route budgets (chat, settings, agents) need one measured build to set.

- **A. Leave CI at type-check + lint + tests; run `perf:bundle:check` locally before releases.** ← current
- B. Give CI read-only build secrets (GitHub OIDC → AWS role) and add a build + budget job.
- C. Make `prebuild` skip `load-secrets` when `CI=true` and build with dummy public env; budgets then measure real bundles without real secrets.

## D9. Forms: react-hook-form or in-house (all "RHF + Zod" items)

react-hook-form isn't installed. Eight audits ask for it. I wrote `hooks/use-zod-form.ts` (values, per-field errors shown after touch or submit, `isDirty`, `reset`, `handleSubmit` with parsed data; ~70 lines, pure core tested) and use it for the forms I rebuild. Callers only see that API, so switching later touches one file.

- **A. In-house `useZodForm`.** ← current (Schedules edit modal first)
- B. Install `react-hook-form` + `@hookform/resolvers` and swap the hook's internals (better for large forms with many fields and field arrays).

## D10. Enhance calls without React Query (Prompt enhancement Phase 2.2)

The audit asked for `useMutation` for the first pass and refine. `EnhancePromptField` is a reusable field rendered in places with no `QueryClientProvider` (the agent editor tests, 35 of them, broke when it used one), and its reducer (`lib/enhance/enhance-flow.ts`) already models loading, failure and cancel, with a request-id guard and an abort signal.

- **A. Plain promises inside `useEnhanceFlow`.** ← current
- B. `useMutation`, and wrap every test and story that renders the field in a `QueryClientProvider`.

## D20. `next/image` for connector logos (Connectors Phase 3.4)

Logos come from each vendor's own host (catalog `logoUrl`), so `next/image` would need `images.remotePatterns` for every host, or a wildcard that turns the Next server into an open image proxy. `ConnectorGlyph` renders a plain `<img>` with fixed size and lazy loading.

- **A. Keep `<img>`.** ← current
- B. Backend mirrors logos to one bucket/CDN host; allow only that host in `remotePatterns` and switch to `next/image`.
- C. `next/image` with `unoptimized` (no gain beyond lazy loading, which `<img loading="lazy">` already gives).

## D21. Consent gating for product analytics (Analytics Phase 4.2)

Mixpanel initialises for everyone today (`lib/analytics/mixpanel.ts` has a TODO to gate it before EU/UK users). What is collected is IDs and enums only (`docs/analytics/data-governance.md`), but a device id and identity are still personal data under GDPR.

- **A. No gate (current behaviour).** ← current
- B. Honour Global Privacy Control / Do Not Track: skip `init` when `navigator.globalPrivacyControl` (or DNT) is set. No banner.
- C. Consent banner for EU/UK only, using the existing geo headers (`lib/geo-headers.ts`); analytics starts after "Accept".
- D. Consent banner for everyone.

Also set the Mixpanel project retention period and write it into `docs/analytics/data-governance.md`.
