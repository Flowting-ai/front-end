# Auth: System Design Audit

Scope: `proxy.ts` (326, Next 16 proxy, formerly middleware: session gate plus onboarding gate), `proxy.test.ts`, `lib/auth0.ts`, `app/auth/[auth0]`, `app/auth/access-token`, `app/auth/logout`, `context/auth-context.tsx` (356), `lib/jwt-utils.ts` (103), `lib/api/client.ts` (297, token injection and 401 recovery), `lib/api-client.ts`, `lib/http-errors.ts`, `lib/onboarding-access.ts`, `lib/roles.ts`, `app/api/backend/[...path]`, CSP/header config in `next.config.ts`. About 2,200 lines.
Method: `proxy.ts`, `auth0.ts`, route handlers, `jwt-utils`, the token parts of `auth-context` and `api/client` read; config checked by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~59% (12.4 / 21 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 2.2 | 73% |
| 2. Architecture | 5 | 2.3 | 46% |
| 3. Component Patterns | 1 | 0.6 | 60% |
| 4. Data Model | 5 | 2.9 | 58% |
| 5. Interfaces and APIs | 5 | 3.5 | 70% |
| 6. Optimizations | 2 | 0.9 | 45% |

Not applicable: SSG, ISR, RSC data patterns, styling, virtualisation, forms, WebSocket, PWA, Monorepo, HOC.

## Correction to earlier audits

The Chat, Compare, Agents, Projects, Pinboard, Connectors and Slack audits credit the `/api/backend` proxy as a "BFF that keeps tokens off the client". That is only half true. The proxy gives same-origin streaming and avoids CORS, but the **access token is fetched into browser memory** (`getAuth0AccessToken` then `setInMemoryAccessToken`) and `apiFetch` adds `Authorization: Bearer` in client JS; the proxy forwards that header. Uploads go straight to the backend (`directUpload`). Only a few server routes (`/api/template`, `/api/chat`, the onboarding gate) attach the token server-side. Read "BFF (#41)" in those audits as partially applied.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Managed IdP, server session (#42) | Auth0 v4 SDK with an HttpOnly session cookie; refresh token handled server-side; `offline_access` scope |
| Central gate (#42) | One `proxy.ts` decides: public paths (invite landing), `/auth/*` and `/api/*` pass to the SDK, no session redirects to login, onboarding state redirects |
| Order of checks | Comments document why authentication is decided before route pass-throughs (a logged-out invitee must reach Auth0, not a client loader) |
| Deep-link preservation | `returnTo` carries path plus query (Slack Connect state survives login); `onCallback` forwards `ctx.returnTo` on errors as well as success; the SDK restricts it to same-origin paths |
| Onboarding gate cache | Positive-only, per-`sub`, 60 s TTL, bounded at 500 entries; reasoning given (onboarded is monotonic, un-onboarded changes mid-flow); removed a `/users/me` call per prefetched `<Link>` |
| Matcher hygiene | Static assets, `_next`, and the first-party analytics proxy (`dispatch`) excluded so images are not redirected to login |
| Token handling in the browser | Token kept in a module variable (not localStorage/sessionStorage), expiry parsed from the JWT, 60 s expiry buffer, concurrent refreshes deduplicated via a shared promise |
| 401 recovery (#45) | `apiFetch` attempts one silent refresh and retry, then dispatches `auth:session-expired` and toasts; avoids signing out during onboarding/checkout where a 401 can be transient |
| Logout robustness | Explicit slash-free `returnTo` so the Auth0 logout URL allowlist matches (documented SDK quirk) |
| Identity for analytics | `distinct_id` from JWT `sub`, never email |
| Session-expiry cleanup | `clearAuth` clears user, token and cached profile |
| Tests | `proxy.test.ts` covers invite auth, stale session with no access token, Slack landing for un-onboarded users |
| Dev-only harness | `/reasoning-verify` bypass restricted to non-production |
| Headers | CSP built from env, HSTS, X-Frame-Options (see Chat audit) |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component/module architecture (#12) | `proxy.ts` is one 326-line function with onboarding rules, cookie checks, route exceptions and routing logic interleaved; the next-onboarding-step logic carries a "PENDING CONFIRMATION" note that is unresolved | Split into `session-gate`, `onboarding-gate`, `route-policy` (a table of public/exempt paths), and `next-onboarding-path` with unit tests |
| Token refresh (#36) | `setInterval` every 30 s polls `isTokenExpiringSoon()` for the lifetime of the tab, including background tabs | Schedule one timeout at `exp - buffer`; refresh on demand in `ensureFreshToken` and on window focus/visibility |
| Server state (#30) | `/users/me` is fetched by the proxy (per request when un-onboarded), by `AuthProvider`/`currentUser`, and elsewhere; each with its own caching | One server-side cached profile fetch (Next `unstable_cache`/tagged) and one client query |
| Observability (#55) | Failed onboarding fetch warns once per process (`hasLoggedOnboardingFetchFailure`) then goes silent; no metrics on login failures, refresh failures, session-expired events | Structured logs and counters for each outcome |
| Error handling | Gate failures (non-OK `/users/me`, network error) fall through to `auth0.middleware`, letting an un-onboarded or unknown-state user into the app | Decide the fail-open vs fail-closed policy explicitly and test it |
| Role checks (#42) | `lib/roles.ts` roles evaluated client-side for UI; enforcement is the backend's (appears so) | Keep, and add contract tests that unauthorised mutations show the 403 path |
| Hydration | `AuthProvider` marks `isHydrated` after the first token fetch; consumers must handle the null-token window (verify they all do) | Single `useAuthReady()` guard; skeletons while pending |
| Error boundaries (#19) | Layout-level only | Boundary plus a "session expired, sign in" recovery screen |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Access token in JS memory | Anything running in the page (an XSS, a compromised third-party script such as Mixpanel or Meta Pixel in the page) can read the bearer token and call the backend directly. Memory storage is better than localStorage but weaker than the HttpOnly cookie used for the session | Move toward a true BFF: server routes attach the token from the session; the browser sends only the cookie. Keep direct uploads via short-lived signed upload URLs. Interim: keep the strict CSP and minimise third-party scripts |
| Base64url decoded with `atob` | `parseTokenExpiry` and `decodeJwtSub` use `atob(payload)` directly. JWT payloads are base64url (`-`, `_`), which `atob` rejects, so for such tokens `exp` and `sub` come back `null`; `isTokenExpiringSoon()` then always returns true (a refresh on every call) and Mixpanel identity is skipped (verify with a real token containing `-` or `_`) | Convert `-`/`_` to `+`/`/` before `atob`, handle UTF-8; add unit tests with such a token |
| Cookie string matching | `cookies.includes("souvenir_checkout_complete=1")` on the raw header; the cookie is script-settable and unsigned, so a user can set it to skip the onboarding redirect (UX gate only, backend should enforce, verify) | Parse cookies properly; sign or verify against the backend; short expiry |
| Unvalidated `/users/me` shape | Gate accepts three possible envelopes (`data`, `user`, bare) and reads fields with casts (`Record<string, unknown>`); `allowsMainApp` logic depends on shape guesses | Zod schema shared with `current-user.ts` |
| Placeholder-name ambiguity | Onboarding "profile step done" is inferred from first/last name, which Auth0 can pre-fill with the email; the code flags this but ships it | Backend flag for "profile completed"; remove the heuristic |
| Duplicate access-token endpoint | `app/auth/access-token/route.ts` exists although `proxy.ts` documents that the SDK middleware serves that path natively and the route file is bypassed (verify it is dead) | Delete if unused |
| In-process cache on serverless | `onboardedCache` is a module `Map`: per instance, lost on cold start, not shared; harmless for correctness (positive-only) but the hit rate is unpredictable | Acceptable; or an edge KV cache; document |
| Raw `fetch` in gate | `/users/me` call has no timeout; a slow backend delays every navigation | `AbortSignal.timeout(2000)`; define behaviour on timeout |
| Logging | `console.warn` / `console.error` with error objects (verify no tokens are logged) | Redacting logger |

## 4. Missing, to add

| Principle | Add |
|---|---|
| CSRF review (#21) | State-changing calls rely on Bearer tokens (not cookies) which avoids classic CSRF; once on cookie-based BFF, add SameSite/Origin checks |
| Session policy | Explicit idle/absolute session durations and a "session about to expire" prompt |
| Multi-tab logout sync | `storage`/`BroadcastChannel` event so logout in one tab clears the others |
| Step-up/MFA signals | Handle `login_required`/`mfa_required` from the backend distinctly from generic 401 |
| Rate limiting on auth routes | Confirm Auth0 or edge provides it (verify) |
| Tests | Token decode (base64url), refresh scheduling, 401 retry then expiry event, gate fail-open/closed behaviour, `determineNextOnboardingPath` table, cookie bypass |
| `error.tsx` / `global-error.tsx` | Auth failure screen |
| Security headers review | Confirm third-party scripts (Meta Pixel, Mixpanel) are limited by CSP and loaded after consent where required (verify) |
| Core Web Vitals / budget (#8, #56) | Measure added latency from the proxy gate (TTFB) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Correctness and hardening (S, 59% → ~72%)
1. Fix JWT decoding for base64url (and UTF-8); unit tests with real-shaped tokens. (+0.8)
2. Timeout and explicit fail policy on the gate's `/users/me` call; test both paths. (+0.6)
3. Replace cookie substring match with a parsed, validated check. (+0.4)
4. Delete the dead access-token route if confirmed unused. (+0.2)
5. Zod schema for `/users/me` shared by proxy and client. (+0.6)
6. Replace the 30 s interval with a scheduled refresh plus refresh on focus. (+0.5)

### Phase 2: Structure and observability (M, → ~85%)
1. Split `proxy.ts` into session gate, onboarding gate and a route-policy table; resolve the "PENDING CONFIRMATION" rule with the backend flag. (+1.2)
2. Structured, redacting logs and counters for login failure, refresh failure, session expiry, gate errors. (+0.8)
3. One cached profile source on the server and one client query. (+0.6)
4. Multi-tab logout/session sync; `useAuthReady()` guard with skeletons. (+0.5)

### Phase 3: Token exposure (L, → ~95%)
1. Server-attached tokens: move `/api/backend` (and the chat routes) to inject the bearer from the session; browser stops holding the access token. (+1.5)
2. Signed, short-lived upload URLs for `directUpload` paths. (+0.5)
3. Distinct handling of MFA/step-up and `login_required`. (+0.3)
4. Session policy (idle/absolute) with an expiry prompt. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Full test matrix for the gate and token module in CI. (+0.4)
2. Measure and budget gate latency (TTFB); CSP review for third-party scripts. (+0.4)
3. `error.tsx`/`global-error.tsx` auth failure screen. (+0.2)

Re-score after each phase and settle all "(verify)" items first.
