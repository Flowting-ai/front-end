# Internal and API Routes: System Design Audit

Scope: every server route handler and dev route: `app/api/chat` (165), `api/persona-chat` (140), `api/backend/[...path]` (123), `api/template/[uuid]` (72, see Templates audit), `api/download` (77), `api/lab/[...path]` (27), `api/onboarding/logout` (30), `app/dispatch/[...path]` (134, Mixpanel proxy), `app/auth/*` (3 files, see Auth audit), `app/(app)/dev/{notifications,greetings}`, `app/reasoning-verify`, `scripts/*.mjs`. About 1,800 lines. These are the only server-side code besides `proxy.ts`.
Method: all route handlers read (the large ones in full or near full); dev routes by header comments and guards. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~54% (7.0 / 13 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.0 | 50% |
| 2. Architecture | 3 | 1.3 | 43% |
| 4. Data Model | 1 | 0.4 | 40% |
| 5. Interfaces and APIs | 4 | 2.5 | 63% |
| 6. Optimizations | 3 | 1.8 | 60% |

Small applicable set: routes have no UI, so Component Patterns and most rendering/state principles do not apply.

## Headline finding: `/api/*` is not behind the login gate

In `proxy.ts`, requests to `/api/*` go straight to `auth0.middleware(request)` before the session check ("API routes must never be blocked by the onboarding guard"). So **authentication is each handler's own job**, and it is inconsistent:

| Route | Session/token check | Notes |
|---|---|---|
| `/api/chat`, `/api/persona-chat`, `/api/template/[uuid]` | Yes, `auth0.getAccessToken` → 401 | token attached server-side |
| `/api/backend/[...path]` | No check in the handler; forwards the browser's `Authorization` header | the backend enforces; an anonymous caller can reach any backend path through our origin |
| `/api/download` | **None** | open proxy for any `*.amazonaws.com` file (see below) |
| `/api/lab/[...path]` | **None** | forwards to `http://127.0.0.1:8777`; a dev tool for the compare page, present in production builds |
| `/dispatch/*` | None, by design (analytics beacons) | forwards to `api-js.mixpanel.com` |
| `/api/onboarding/logout` | None | GET that logs the user out |

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Streaming proxies (#41, #44) | `chat`, `persona-chat`, `backend` pass `upstream.body` through unbuffered, set `X-Accel-Buffering: no` and `Cache-Control: no-cache, no-transform` for SSE; `duplex: 'half'` for request bodies; Node runtime chosen for undici streaming |
| Long-running limits documented | `maxDuration = 800` with a comment explaining the Vercel Fluid ceiling and why (300 s default was killing SSE turns) |
| Header hygiene | `backend` proxy drops `cookie` (so the Auth0 session never reaches the API), hop-by-hop headers and `content-length`; `dispatch` additionally drops `authorization` and `referer` so ids in page URLs and sessions never reach Mixpanel; ACAO headers stripped from upstream responses |
| Download safety | `isAllowedUrl`: `https` only, hostname must end with `.amazonaws.com` (the leading dot defeats `evilamazonaws.com`), filename sanitised against path/quote characters, `Content-Disposition: attachment`, `nosniff` |
| Fail-quiet analytics | `dispatch` returns 502 with an empty body on upstream failure; analytics never surfaces errors; real client IP forwarded for geolocation |
| Input validation where done | Template route validates `z.uuid()` and the upstream payload with Zod |
| Pass-through of upstream errors | `chat` logs the upstream body and returns its status, so the client sees the real failure class |
| Geo headers | `forwardGeoHeaders` shared by chat routes |
| Dev routes gated | `/dev/*` call `notFound()` in production; `/reasoning-verify` is bypassed in `proxy.ts` only when `NODE_ENV !== 'production'` |
| Test | `chat/route.test.ts` checks endpoint selection and that an explicit model tier beats a stale `modelId` |
| Tooling | `scripts/sse-probe.mjs` documents how to debug streams with a token and never prints it |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Architecture (#12) | `BACKEND_BASE`, audience lookup, `getAccessToken` with try/catch, 401 mapping and `forwardGeoHeaders` are repeated across `chat`, `persona-chat`, `template`, `proxy.ts`; the two chat routes build near-identical multipart bodies | `lib/server/backend.ts`: `withSession(handler)` (401 if none), `backendUrl(path)`, `backendHeaders(req, token)`; one `buildChatForm()` |
| Auth consistency (#42) | See table above; the choice is per file and undocumented | Decide a policy: every `/api/*` handler (except an explicit public list) wraps `withSession`; add a unit test that enumerates `app/api/**/route.ts` and asserts it |
| Error handling (#45) | `backend`: logs the full target URL and error with `console.error`; `download`: returns plain text; `chat`: returns backend text bodies verbatim (see Templates audit on leaking upstream bodies) | Shared JSON error shape (`{ error: { code, message } }`), log server-side, return fixed messages |
| Observability (#55) | Mixed `logger.error` (chat), `console.error` (backend, dispatch), none in download/lab; no request ids, no timing, no upstream status metrics | One `logger` with request id; metrics for upstream latency and status by route |
| Timeouts | Only `maxDuration` bounds requests; `download` and `lab` fetches have no `AbortSignal` timeout | `AbortSignal.timeout()` on non-streaming calls; first-byte timeout on streams |
| Caching (#9) | `download` sets `Cache-Control: private, max-age=3600` on content fetched with no auth; `backend` forwards upstream cache headers verbatim | `private, no-store` for authenticated content; explicit cache policy per route |
| Validation | `chat`: `systemPrompt`, `temperature`, `pinIds`, `toneId` accepted as raw strings and forwarded; `temperature` is not range-checked | Zod schema for the form (types, lengths, ranges) |
| Tests | One test file for one route | Tests per route: auth required, validation errors, header stripping, SSE pass-through headers |
| Scripts | `scripts/` mixes build helpers (`generate-dark-theme`, `migrate-inline-colors`, `split-openapi`) and a debugging probe, no README | Document in `scripts/README.md`; add npm script entries |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Unauthenticated `/api/download` | Anyone can use our origin to download any file from any `*.amazonaws.com` host (any customer's bucket, an attacker's bucket), with the upstream `Content-Type`, cached for an hour; useful for bandwidth abuse and for hosting content under our domain. With `redirect: "follow"` a redirect from an allowed host to elsewhere is followed (an S3 website bucket can redirect), which defeats the allowlist | Require a session; allow only the app's own bucket host(s) (exact hostnames from env); `redirect: "manual"` (re-validate each hop); cap content length; force `Content-Type: application/octet-stream` for non-allowlisted types |
| Unauthenticated, unconditional `/api/lab` | Forwards any client-chosen path to `http://127.0.0.1:8777` in every environment, no session; in production it targets the server's own loopback (fails on serverless, but exposes anything listening on a self-hosted node) | Gate on `NODE_ENV !== 'production'` (or a flag) and require a session; return 404 otherwise; validate `path` against known routes (`route/old`, `route/new`, `cost/<id>`) |
| Unvalidated path parameters | `chat` and `persona-chat` interpolate `chatId`, `repoId` into backend URLs without format checks (see Personas and Share audit); `backend` joins arbitrary path segments | `z.uuid()` plus `encodeURIComponent`; allowlist of top-level backend prefixes in the generic proxy |
| Generic `/api/backend` open relay | Any HTTP method to any backend path, unauthenticated at our layer, no rate limit, no size limit beyond the 320 MB body setting in `next.config.ts` (`proxyClientMaxBodySize: '320mb'`) | Require a session for everything except an explicit public list; per-route body limits; rate limit at the edge |
| GET logout | `/api/onboarding/logout` is a GET that ends the session (cross-site `<img src>` can log a user out) and hard-codes the production return URL and cookie names (see Onboarding audit) | Use the SDK logout (POST or CSRF token), env-driven return URL |
| Debug routes in the bundle | `/dev/*` and `/reasoning-verify` ship in production builds (only guarded at runtime); `/reasoning-verify` is only bypassed in dev by `proxy.ts`, in production it still renders for logged-in users unless the page itself guards (verify) | Exclude via `next.config.ts` page extensions or env-gated dynamic imports; guard the page with `notFound()` like `dev/*` |
| Dead route | `app/auth/access-token/route.ts` duplicates what the SDK middleware serves (see Auth audit) | Delete if unused |
| Public analytics relay | `/dispatch` accepts any path and method (`GET, POST, OPTIONS`) and forwards unknown segments unchanged; no size cap on `arrayBuffer()` | Allowlist the four known paths; cap body to ~1 MB; basic rate limit |
| Mixed 4xx/5xx semantics | Missing token returns 401 in some routes, 403 for disallowed download domain, 502 vs 503 for upstream failure across routes | One mapping table in the shared helper |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Rate limiting | Per-user and per-IP limits on chat, download, dispatch (edge middleware or Vercel firewall) |
| Request size and file limits | Chat and persona-chat file count/size checks server-side (client limits only today) |
| Idempotency and retries | Do not retry non-idempotent POSTs through the proxy; add an idempotency key header pass-through for chat creation |
| CORS/origin checks | Verify `Origin` on state-changing proxy calls (CSRF defence in depth) |
| Health and readiness | `/api/health` for deploy checks (upstream reachability, secrets present) |
| OpenAPI-driven types | `split-openapi.mjs` exists; generate route request/response types from the spec to avoid hand-copied field names |
| Request tracing | Propagate a trace id header to the backend and into logs |
| Config validation | Validate `SERVER_URL`, `AUTH0_*` at startup (some code uses `!` assertions, `|| "http://localhost:8000"` fallbacks); fail fast |
| Security headers on API responses | `nosniff` on all, `Cache-Control: no-store` default |
| Route inventory doc | One table of routes, auth, upstream, limits (this audit's table is a start) |
| Contract tests | Mock-backend tests for each proxy path covering forwarded fields |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Close the open routes (S, 54% → ~72%)
1. Require a session on `/api/download` and restrict to exact bucket hostnames with `redirect: "manual"` and a size cap. (+1.0)
2. Gate `/api/lab` to non-production with a session and an allowlist of paths. (+0.5)
3. Add a session requirement (or explicit public allowlist) to `/api/backend`; add a test that enumerates all route files and asserts each is wrapped or listed as public. (+0.8)
4. Validate `chatId`/`repoId` (`z.uuid()`, encode) in both chat routes. (+0.4)
5. Replace GET logout with the SDK's logout; env-driven URLs. (+0.3)
6. `notFound()` guard on `/reasoning-verify`; remove the dead `auth/access-token` route if confirmed. (+0.3)

### Phase 2: Shared server layer (M, → ~86%)
1. `lib/server/backend.ts` (`withSession`, `backendUrl`, headers, error shape, timeouts); migrate all routes. (+1.0)
2. Zod request schemas for chat and persona-chat forms (ranges, lengths, file counts and sizes). (+0.6)
3. Structured logging with request id and upstream status/latency; one logger. (+0.5)
4. Allowlist and size cap for `/dispatch`. (+0.3)
5. Route tests: auth, validation, header stripping, SSE headers. (+0.6)

### Phase 3: Platform controls (M, → ~95%)
1. Rate limiting (edge) for chat, download, dispatch. (+0.5)
2. Origin checks and CSRF defence in depth on state-changing calls. (+0.3)
3. Health/readiness route and startup config validation. (+0.3)
4. Generated types from OpenAPI for forwarded fields. (+0.3)
5. Trace id propagation to backend and logs. (+0.2)

### Phase 4: Governance (S, → 100%)
1. Route inventory doc kept in `docs/`; CI check that new routes declare auth policy. (+0.3)
2. Scripts README and npm script entries; exclude dev routes from production builds. (+0.3)
3. Periodic review of proxy allowlists (download hosts, backend prefixes). (+0.2)

Re-score after each phase and settle all "(verify)" items first.
