# Front-end route handlers

The server routes this Next.js app itself serves (not the backend API). The source of truth is `src/lib/server/route-inventory.ts`; `route-inventory.test.ts` fails when a route file exists that is not listed there, or when an `/api` route other than `api/health` is reachable without a session.

## Access rules (enforced in `src/proxy.ts`, table in `src/lib/auth/route-policy.ts`)

| Path | Rule |
|---|---|
| `/api/*` | Session required (JSON 401). State-changing methods from another site's `Origin` get a 403 (CSRF defence in depth; the session cookie is also `SameSite=Lax`). Never the onboarding gate. |
| `/api/health` | Public: config variable names and backend reachability, 200 or 503. |
| `/auth/*` | Auth0 SDK middleware. |
| `/dispatch/*` | Not matched by the proxy at all (analytics beacons fire before login). |
| `/org-invite/*` | Public (the pre-login invite landing). |
| `/reasoning-verify`, `/browser-verify` | Dev only; `notFound()` in production. |
| everything else | Session, then the onboarding gate. |

## Routes

| Route | Upstream | Notes |
|---|---|---|
| `api/backend/[...path]` | backend (any path) | Streaming pass-through for local dev; drops cookies and hop-by-hop headers, adds `X-Request-Id`, disables buffering for SSE. Deployed builds call the backend directly (see decision D1). |
| `api/chat` | backend `/chats` | Multipart validated by `lib/server/chat-forms.ts`; SSE pass-through. |
| `api/persona-chat` | backend `/persona/{id}/chats` | As above. |
| `api/template/[uuid]` | backend `/templates/{id}/html` | Served under a sandbox CSP. |
| `api/download` | Souvenir S3 buckets | Exact hosts (`DOWNLOAD_ALLOWED_HOSTS`), no redirects, 30 s header timeout, 200 MB cap. |
| `api/lab/[...path]` | 127.0.0.1:8777 | Dev only (404 in production), three known paths. |
| `api/health` | backend `/health` | See above. |
| `auth/[auth0]`, `auth/logout` | Auth0 | SDK login/callback; federated logout with an allowlisted `returnTo`. |
| `dispatch/[...path]` | api-js.mixpanel.com | Five known routes, 1 MB cap, cookies stripped. |

## Shared server pieces

- `lib/server/backend.ts`: `BACKEND_BASE`, `getSessionToken`, `isSafeId`, `routeError` (`{ error: { code, message } }`), `upstreamFetch` (request id + one structured log line per failure).
- `lib/server/upload-limits.ts`: file count and size caps (10 files, 30 MB each).
- `lib/server/env.ts`: required configuration, checked at boot (`instrumentation.ts`) and by `/api/health`.

## Review checklist (each quarter, or when infrastructure changes)

- `DOWNLOAD_ALLOWED_HOSTS` and the `souvenir*` S3 rule in `api/download` still match the real buckets.
- The `/dispatch` route allowlist matches what `mixpanel-browser` sends.
- The `/api/lab` path allowlist still has only the three dev paths.
- `next.config.ts` CSP origins (backend, Auth0 tenant, Mixpanel, map tiles, Library storage) are all still used.
