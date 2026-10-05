# Souvenir application audit: improvements for speed, quality and production readiness

Date: 2026-10-04. Scope: the whole front end (`front-end/`, working tree as of today, incl. the uncommitted chat-output fixes) validated against the backend (`souvenir-server/`). Method: twelve read-only audits (code quality, components/design system, bundle performance, client data fetching, backend latency, FE↔BE contract in four domains, production readiness, SaaS features), each evidence-based (file:line). Items marked **✔** were re-checked by hand against the code before going into this document.

Severity: **Critical** (exploitable or broken for every user), **High**, **Med**, **Low**. Effort: **S** (≤1 day), **M** (days), **L** (weeks). Owner: **FE**, **BE**, **Both**, **Ops**, **Product**.

Related: [chat-output-fixes.md](chat-output-fixes.md), [chat-output-backend-requirements.md](chat-output-backend-requirements.md) (items already listed there are not repeated in detail).

---

## Executive summary

Souvenir is feature-rich (agents, projects, connectors, Slack, schedules, billing, org admin) and the core is solid: strict TypeScript with 0 errors, tokens kept in memory, a good streaming architecture, 88 test files. The gaps are in **hardening, speed and finish**:

1. **Security:** the Next.js version has 3 critical and many high advisories (incl. auth-gate bypass), there is an open download proxy, a backend IDOR on pins, and no sanitizer on one raw-HTML path.
2. **Broken features hiding behind silent contract drift:** "Claim free credits" always 404s, onboarding memory always 422s, `user.orgId` is always null, paused workspaces never show as paused, agent share credit caps are 1000× too high, saving an agent version un-blocks its connectors, and web search, style and connector controls do nothing. The root cause is hand-written types with no generated client and no CI.
3. **Performance:** every logged-in page downloads **7.7–8.5 MB gzip of JavaScript**, ~80% of it one 10.5 MB file of LLM logos. Fixing that one import chain cuts first load by roughly 80%. On the backend, every request opens a fresh Postgres connection, hot foreign keys look unindexed, and chat lists/history are unpaginated, so a cold `/chat` load is ~20–30 requests in four sequential waves against slow endpoints.
4. **No safety net:** CI runs no typecheck, lint, tests or build. There is no error tracking and no `error.tsx`.
5. **SaaS polish:** several settings pages are mock-ups with fake data (Security shows invented sessions), the admin analytics chart is synthetic, account deletion and data export are missing, and there is no SSO, no notification centre, no chat export and no server-side search.

### Top 20 by priority

| # | Item | Sev | Effort | Owner | Ref |
|---|---|---|---|---|---|
| 1 | Upgrade `next` 16.2.4 → ≥16.3.8 (3 critical RCE + proxy/auth-gate bypass advisories) ✔ | Critical | S | FE | SEC-1 |
| 2 | Close the open `/api/download` proxy (no auth, any `*.amazonaws.com`, follows redirects) ✔ | High | S | FE | SEC-2 |
| 3 | Fix pins IDOR: `POST /pins/message/{id}` returns any user's message ✔ | High | S | BE | SEC-3 |
| 4 | Stop shipping a 10.5 MB LLM-logo bundle on every page ✔ | Critical (perf) | S | FE | PERF-1 |
| 5 | Add CI gates: tsc, lint, vitest, build, npm audit | High | S | FE/BE | OPS-1 |
| 6 | Add error tracking (Sentry) + `global-error.tsx`/`error.tsx`/`not-found.tsx` | High | M | FE | OPS-2 |
| 7 | "Claim free credits" calls a non-existent `/stripe/trial` ✔ | High | S | FE/BE | API-1 |
| 8 | Onboarding memory import always fails (422) ✔ | High | S | FE | API-2 |
| 9 | `/users/me` has no `org_id`/role, so `user.orgId` is always null ✔ | High | S | BE | API-3 |
| 10 | Workspace `paused` status never shown (FE expects `locked/grace`) ✔ | High | S | FE | API-4 |
| 11 | Agent share credit cap off by 1000× (USD vs "tokens") ✔ | High | S | FE | API-5 |
| 12 | Saving an agent version resets blocked connectors, tags and hints ✔ | High | S | BE | API-6 |
| 13 | Received shared agents get copied to the recipient's account and billed to them | High | S | FE | API-7 |
| 14 | Remove or hide the mock settings pages (fake sessions, fake 2FA, non-persisting notifications/unsubscribe) ✔ | High | S | FE | SAAS-1 |
| 15 | Replace the synthetic admin analytics chart with real data ✔ | High | M | Both | SAAS-2 |
| 16 | Sanitize raw HTML in pins (`rehype-raw` without sanitizer) and tighten CSP | High | S–M | FE | SEC-4, SEC-5 |
| 17 | Composer controls that do nothing (web search, style, temperature, connectors) | High | M | Both | API-8 |
| 18 | Account deletion (UI is a no-op; backend doesn't revoke tokens) + data export | High | M | Both | SAAS-3 |
| 19 | Modals don't trap focus; no global focus ring | High | S–M | FE | UI-1, UI-2 |
| 20 | Backend: pooled DB connections (every request opens a new Postgres connection today), FK indexes on chat/message tables, paginate and slim `/chats` and `/messages` ✔ | High | S–M | BE | PERF-18…21, PERF-8 |

### Suggested plan

- **Week 1 (security and broken features):** items 1–3, 5, 7–14, 16, plus quick wins in the [Quick wins](#quick-wins-1-day-each) list.
- **Weeks 2–4 (speed and safety net):** PERF-1…PERF-6, OPS-2…OPS-4, UI-1…UI-4, API-9 (generated client), SAAS-2…SAAS-5.
- **Quarter (architecture and SaaS depth):** CODE-2…CODE-6 refactors, React Query migration, responsive/mobile, SSO/SCIM, notification centre, search, export, feedback, branching.

---

## 1. Security

| ID | Finding | Evidence | Impact | Fix | Sev | Effort | Owner |
|---|---|---|---|---|---|---|---|
| SEC-1 ✔ | **Vulnerable dependencies.** `next@16.2.4` (exact pin) has 25 advisories: 3 critical (unauthenticated RCE in the image optimizer with AVIF, RCE on Windows hosts, RCE in `next/og`), and high: several **middleware/proxy bypasses** (`src/proxy.ts` is the only page-level auth gate), SSRF in rewrites and WebSockets, DoS. Also `maplibre-gl ≤6.4` (critical XSS sanitizer bypass, used by the map widget), `pdfjs-dist` 5.x (high; unused, but `public/pdf.worker.min.mjs` ships), `undici`, `sharp`, `postcss`, `nanoid`, `dompurify` | `package.json`; `npm audit --omit=dev`: 2 critical, 5 high, 2 moderate packages | Remote code execution and auth bypass, depending on hosting | `npm i next@^16.3.8 eslint-config-next@^16.3.8` (non-major); upgrade maplibre-gl to 6.12 (major, test the map widget); remove `pdfjs-dist` + the worker file and the unused `stripe` dep; `npm audit fix`; add Dependabot/Renovate and an `npm audit --audit-level=high` CI gate | Critical | S | FE |
| SEC-2 ✔ | **Open download proxy.** `/api/download` has no auth, accepts any `https://*.amazonaws.com` URL, and uses `redirect: "follow"` | `src/app/api/download/route.ts:17,52-55`; `proxy.ts` doesn't enforce sessions on `/api/*` | Malware and phishing served from your domain (Safe Browsing risk), SSRF, free bandwidth relay | Require a session; pin the allowlist to the exact bucket host(s) from env; `redirect: "error"`; cap size. Better: backend returns presigned URLs with `ResponseContentDisposition=attachment`, and the proxy is deleted | High | S | FE |
| SEC-3 ✔ | **Pins IDOR.** `create_pin(message_id, db)` never checks the caller owns the message and returns its output | `souvenir-server/services/pins/router.py:55-64`, `pins/service.py:46`, `pins/repository.py:57-63` | Any signed-in user who knows a message UUID can read it (and triggers a billed LLM call). Live even though the pins UI is flagged off | Filter by `user_id` (join chat ownership); same for `move_pin` folder ownership and `create_highlight` message ownership | High | S | BE |
| SEC-4 | **Raw HTML in pins is not sanitized.** `pin-markdown.tsx` uses `rehype-raw` with no sanitizer; `<iframe srcdoc="<script>…">` renders and runs under the app CSP. Also `sanitizePreservingMath` (`markdown-utils.tsx`) restores math spans after DOMPurify, so a crafted `` `$`<iframe…>`$` `` passes (dormant: no caller sets `allowHtml`) | `src/lib/pin-markdown.tsx:13`; `src/lib/markdown-utils.tsx` | Stored XSS once pins are enabled, so tokens can be stolen | Remove `rehype-raw` from pins, or add `rehype-sanitize` after it; move sanitization into the HAST pipeline; add regression tests (`srcdoc`, `<base>`, `<form>`, `<meta>`) | High (dormant) | S | FE |
| SEC-5 | **Weak CSP.** `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com` (GTM unused now); no `base-uri`, `form-action`, `object-src`, `frame-src`; no `Permissions-Policy` (the app uses the microphone). Access tokens live in JS memory, so any injected script can use them | `next.config.ts:150-161`; `src/lib/jwt-utils.ts` | Any HTML injection becomes token theft | Nonce-based CSP generated in `proxy.ts`, drop `'unsafe-inline'` and GTM; add `base-uri 'none'; form-action 'self'; object-src 'none'; frame-src 'self'`; `Permissions-Policy: camera=(), geolocation=(), microphone=(self)` | High | M | FE |
| SEC-6 | **Mermaid SVG injected unsanitized** (`dangerouslySetInnerHTML`). Labels are escaped by the library, but not every diagram type or `click`/`href` was verified | `src/components/chat/MermaidDiagram.tsx:232` | Possible XSS via model output | `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })` | Low | S | FE |
| SEC-7 | **Dev tools shipped to production.** `/api/lab/*` is an unauthenticated proxy to `http://127.0.0.1:8777`; `/compare` lives in the `(app)` group | `src/app/api/lab/[...path]/route.ts:11-24`; `src/app/(app)/compare/page.tsx` | Broken in prod; unnecessary attack surface | Gate on `NODE_ENV` like `/reasoning-verify` (`proxy.ts:183-188`), return 404 in production | Med | S | FE |
| SEC-8 | **Generic backend proxy has no path allowlist** and forwards client `x-forwarded-for`; proxy body cap is 320 MB | `src/app/api/backend/[...path]/route.ts:55-60`; `next.config.ts:71` | Reaches internal backend routes (they have their own auth); memory DoS if self-hosted | Allowlist path prefixes, validate segments, overwrite forwarding headers, lower body cap per route | Med | S | FE |
| SEC-9 | **Backend auth and abuse hardening.** JWT issuer (`iss`) not validated; `active=False` users keep working tokens; no HTTP rate limiting (only per-user LLM semaphores); uploads accept any type with the raw filename in the S3 key; `X-Request-Id` accepted unvalidated (log injection); `/openapi.json`, `/docs` public | `core/security.py:10-29`; `services/llm/concurrency.py`; `services/document/workspace.py:71-75,250-262`; `main.py:137,165-173` | Account takeover persistence after deletion; abuse; log forging; API surface disclosure | Validate `issuer`; reject inactive users; slowapi or edge rate limiting per IP and per `sub`; sanitize filenames, force `Content-Disposition: attachment`; constrain request ids; disable or auth-gate docs in prod | Med | M | BE |
| SEC-10 | **Dead or incorrect logout routes** delete `appSession*` cookies, but Auth0 SDK v4 uses `__session` | `src/app/auth/logout/route.ts:30-34`, `src/app/api/onboarding/logout/route.ts` | Logout may leave the session alive if these are ever hit | Delete both; use the SDK's logout with a `returnTo` allowlist | Low | S | FE |
| SEC-11 | **Local secret hygiene.** `.env.local` holds long-lived AWS IAM keys, a Figma token, test login credentials; `scripts/load-secrets.mjs` uses static keys. Not committed (gitignored, verified) | `.env.local`, `scripts/load-secrets.mjs:24-39` | Laptop compromise exposes production secrets | `aws sso login` / short-lived credentials, scope IAM to one secret, move test credentials to a password manager | Low | S | Ops |
| SEC-12 | **Expired JWT still in git history** (`test-sse.mjs`, removed from the tree this week) | git history | Low (expired, access-only, dev tenant) | Accept, or rewrite history if the repo was ever public | Low | S | Ops |

---

## 2. Front end ↔ backend contract (broken or silently wrong features)

Root cause for most of these: request and response types are hand-written; Pydantic ignores unknown request fields; 108 `apiFetchJson<T>` call sites cast responses without validation; the checked-in `openapi.yaml` is stale; CI doesn't run anything.

### 2.1 Broken today

| ID | Finding | Evidence (FE ↔ BE) | Impact | Fix | Sev | Effort | Owner |
|---|---|---|---|---|---|---|---|
| API-1 ✔ | `POST /stripe/trial` doesn't exist | FE `lib/config.ts:121`, `lib/api/billing.ts:133`, `WelcomeModal.tsx:350`, `plans-and-billing/page.tsx:1249-1331` ↔ BE `services/stripe/router.py` (no trial route; the trial is granted at signup, `users/repository.py:219`) | "Start trial" / "Claim free 1,000 credits" always errors. Because `usage.isTrial` is never sent (API-10), the button shows for every trial-heuristic user | Remove the claim UI and gate on `free_trial_enabled` (already returned by `/users/me`), or add the route if a manual claim is wanted | High | S | FE (or BE) |
| API-2 ✔ | Onboarding memory sends `{content}`; the backend requires `{memory}` | FE `app/(onboarding)/onboarding/import/page.tsx:82-93` ↔ BE `services/memory/schemas.py:24-25` | Every call is a 422, unchecked (`res.ok` never read), so the user's pasted AI context and "Other" role are silently lost. The two calls would also overwrite each other (`/memory/user` replaces the whole note) | Send one combined `{memory}` and check the response | High | S | FE |
| API-3 ✔ | `/users/me` has no `org_id` or org role | FE `lib/api/user.ts:360-361`, `context/auth-context.tsx:201` ↔ BE `services/users/schemas.py:71-96` | `user.orgId`/`user.role` are always null: `isTeamMember` false, `isTeamsUser` false in WelcomeModal, Slack post-link redirect never fires, extra org round trip on every load (PERF-9) | BE adds `org_id`, `org_role` (and `auth0_id`, see API-11) to `/users/me`; or FE moves every reader to `useOrg()` | High | S | BE |
| API-4 ✔ | Workspace pool status enum mismatch | FE `hooks/use-workspace-credit-notice.ts:9` (`warning_95/grace/locked`), `ChatInterface.tsx` ↔ BE `services/organizations/models.py:45-48` (`healthy/warning_95/paused`) | A paused (out-of-credit) workspace never shows the locked banner; members type and hit backend errors | Map `paused` → locked state; align `InlineCreditNotice` | High | S | FE |
| API-5 ✔ | Agent share credit cap is off by 1000×. The backend counts USD spend; the FE sends a 25,000 "token" limit and displays spend as tokens | FE `lib/plan-config.ts:54-58`, `SharingTab.tsx`, `AgentShareModal`, `agents/published/page.tsx` ↔ BE `services/chat/service.py:619-631` (`costUsd`), `persona_share/repository.py` | Super Link and email shares are effectively uncapped, so sharers can be billed without limit | Define the unit (USD or credits = USD×1000) and convert on send and display; document it in the schema | High | S | FE (+BE doc) |
| API-6 ✔ | Saving an agent version inherits only `connector_slugs`; `blocked_connectors`, `persona_tags` and `connector_hints` reset; `version_tags` are never sent (kept in localStorage) | FE `lib/api/personas.ts:510-535`, `agent/configure/instructions/page.tsx:972-1013` ↔ BE `services/persona/repo_service.py:221-251` | Every "Save version" silently **un-blocks connectors** the author blocked | BE inherits all per-version settings from the source version (or FE sends them); move version tags to the backend | High | S | BE |
| API-7 | "Use received share" calls `POST /persona/{repo}/use` on the recipient's own copy | FE `agents/page.tsx:1077-1090`, `lib/api/persona-shares.ts:111-117` ↔ BE `persona_share/schemas.py:88-91`, `persona/repo_service.py:110-167` | Creates a de-shared duplicate billed to the recipient, outside the share's cap and revocation, without the sharer's knowledge docs | Chat directly with `share.persona_repo_id`; don't call `/use` | High | S | FE |
| API-8 ✔ | Composer and agent-test controls the backend ignores: `web_search`, `tone_id`, `temperature`, `system_prompt` (backend reads `system_instruction`), connector slugs (never even forwarded by `/api/chat`). Persona test/chat endpoints accept only `input`/`files`, so `model_id`, `connector_slugs`, `disabled_connectors`, `thinking`, `effort` are dropped | FE `use-streaming-chat.ts:343-369`, `app/api/chat/route.ts`, `lib/api/personas.ts:1056-1091`, `app/api/persona-chat/route.ts` ↔ BE `services/chat/router.py:134-146,216-232`, `services/persona/router.py:521-627` | Users toggle things that do nothing; agent "test with unsaved model" tests the saved one | Product decision per control: wire up or remove (detailed in [chat-output-backend-requirements.md](chat-output-backend-requirements.md) A1) | High | M | Both |

### 2.2 Silently degraded

| ID | Finding | Evidence | Fix | Sev | Effort | Owner |
|---|---|---|---|---|---|---|
| API-9 | **No generated client, stale OpenAPI, unknown fields silently ignored.** `openapi.yaml` (144 paths) lacks newer routes; no regeneration in CI; FE has no codegen | `souvenir-server/openapi.yaml`; `main.py:137`; FE `package.json` | CI step writes `app.openapi()` and fails on drift; FE generates types (openapi-typescript) or zod (orval); require a schema in `apiFetchJson(path, schema)`; `extra="forbid"` on request models in dev/staging | High | M | Both |
| API-10 | Plan and trial model drift: FE expects `trial` on usage and credits (never sent) and `starter/pro/power` plan types (backend only issues `teams/enterprise`, admins only), so `user.planType` is always null | FE `billing-schemas.ts`, `lib/plan-tier.ts`, `use-individual-plan.ts` ↔ BE `users/schemas.py:47-62`, `users/service.py:124-153` | Retire the starter/pro/power model; read `free_trial_enabled`; expose trial state if needed | High | S–M | FE |
| API-11 | `auth0_id` missing from `/users/me`; FE falls back to the JWT `sub`, which differs after Google account linking | FE `auth-context.tsx:145` ↔ BE `users/service.py:120-122` | Ownership checks (`ownerUserId === currentUserId`) fail for linked accounts. BE returns `auth0_id` | Med | S | BE |
| API-12 | Non-admin members get a redacted org plan (credits 0, `plan_type` null) and the FE treats it as real | FE `organization.ts:185-209`, `LeftSidebar.tsx`, `org-context.tsx` ↔ BE `organization.py:553-580` | Members see the "no plan" warning; Enterprise labelled "Free". Branch on role, or expose `pool_status`/`plan_type` to members | Med | S | FE |
| API-13 | Error envelope: FastAPI returns `{"detail": ...}`; FE reads `code/message/error`, so `ApiError.code` is always `api_error`; object `detail` (e.g. 409 `unresolved_ownership` with `projectIds`) is lost; many wrappers drop `detail` | FE `lib/api/client.ts:240-270`, `user.ts:602-633`, `persona-shares.ts:200-214` ↔ BE `organizations/offboarding.py:17-25` | Standard `{detail:{code,message,...}}` on BE; FE reads `detail.code`; replace substring matching in `friendlyApiError` | Med | M | Both |
| API-14 | Automations: FE ignores `status`/`error`, so failed automations look "paused"; detail view shows the summary as instructions; `drift` field never emitted | FE `lib/api/automations.ts:23-40`, `schedules/page.tsx:60,105,145` ↔ BE `automations/schemas.py`, `router.py:44-54` | Map `status`/`error`/`instructions`; drop drift | Med | S | FE |
| API-15 | Connector "Set all" permissions fails as a whole if any tool is globally blocked (blocked tools are listed but not flagged) | FE `AccountDetailView.tsx:216-223` ↔ BE `connectors/repository.py:316-320,476-487` | BE excludes or flags blocked tools, or skips them | Med | S | BE |
| API-16 | Zod schema types Zapier's raw provider metadata strictly; any shape change breaks every Zapier connector detail (uncertain) | FE `connector-schemas.ts:57-67` ↔ BE `providers/zapier.py:233,247` | Make those fields `z.unknown()` / `.catch()` | Med | S | FE |
| API-17 | Persona and project gaps: visibility shared→private offered but rejected (400, generic error); agent chat sorting no-op (timestamps dropped); share avatar URLs expire (stored presigned URLs); PATCH can't clear fields (`None` skipped); soft-deleted documents returned; naive vs UTC timestamps; project edit rights derived on the client | FE `personas.ts`, `persona-repo.ts`, `projects.ts`, `share/[id]/page.tsx` ↔ BE `persona/repo_service.py:322-349`, `persona/repository.py:154-166`, `persona_share/service.py:284,366`, `projects/project.py:68-97` | Fix individually (each S); BE returns a `canEdit` capability flag and UTC timestamps with offset | Med | M | Both |
| API-18 | Streams: `RUN_FINISHED` carries no `result` (finish reason, usage), so truncation can't be detected; `RUN_ERROR.code` dropped; non-2xx stream errors lose their body (read at headers time); the stop button stops the whole chat instead of the turn (`X-Turn-Id` unused) | FE `lib/agui/to-app-event.ts:58-70`, `use-streaming-chat.ts:1462-1484`, `chat.ts:504` ↔ BE `llm/stream.py:85`, `chat/router.py:280` | Add `result` to `RUN_FINISHED`; forward `code`; read the body on DONE; use `/turns/{id}/stop` | Med | S–M | Both |
| API-19 | Context panel never rehydrates: `GetMessages.context` and `GET /chats/{id}/context` exist but are unread | FE `lib/api/chat.ts` ↔ BE `chat/schemas.py:86-112`, `router.py:58-65` | Map it on history load | Med | S | FE |
| API-20 | CORS allows one origin while the FE calls the backend directly; preview deployments break unless they use the proxy (uncertain, depends on deploy config) | FE `config.ts:17-20` ↔ BE `main.py:175-184` | Allow a preview-origin pattern or route previews through the proxy | Med | S | Ops |
| API-21 | Small drift: `X-User-Locale` sent, never read; `X-Request-Id` never sent or shown; pins `search` param ignored; highlights use PATCH for create and delete; `revokeShare` expects 204, gets 200; invite preview reads `member_count`/`members` (not returned); `MemberBurn.email` missing; role `owner` and `hitlThreshold` enum mismatches; dead SSE handlers (`web_search`, `memory_updated`, `docx_progress`, `metadata`, `block`, `THINKING_END`…) | see contract audit notes | Clean up as part of API-9 | Low | S | Both |

### 2.3 Backend features with no UI (candidate quick features)

| Endpoint(s) | Feature it would enable |
|---|---|
| `/doc-design/*`, `/organizations/{id}/doc-design/*` (10 routes, consumed by the agent runtime) | Brand / document style kit for generated documents |
| `GET/DELETE /templates` | "My published templates" list and revoke |
| `POST /organizations/{id}/transfer-billing` | Transfer billing ownership (the billing admin can't leave or be removed today) |
| `GET /organizations/{id}/plan/enterprise-usage`, `/plan/usage`, `/pool-status` | Real admin usage analytics (see SAAS-2) |
| `DELETE /users/me` (wrapper exists, button is a TODO) | Account deletion |
| `GET /chats/{id}/context`, `/turns/{turn_id}/stop`, `reference_message_id` | Context panel after reload, per-turn stop, reply-to-message |
| `GET/POST/DELETE /persona/{repo}/members`, connector-hints, org-knowledge, `/projects/{id}/copy`, `/copies`, `/projects/{id}/personas` | Agent collaborators, project duplication, project-scoped agents |
| `GET /persona-shares/sent`, `PATCH /automations/{id}` (name, trigger, model) | "Shares I've sent" list; form-based schedule edit |
| Zapier `/zapier/organizations/*` (8 routes) | Unclear whether a UI is intended (front end uses `/connectors/*`) |

---

## 3. Performance

### 3.1 Bundle (measured on the production build)

First-load JavaScript per route, gzip: `/chat` **8.5 MB**, `/agents` 7.9 MB, `/settings/*` 7.8 MB, every `(app)` route 7.7–8.5 MB; onboarding ~0.5 MB.

| ID | Finding | Evidence | Fix | Expected impact | Sev | Effort |
|---|---|---|---|---|---|---|
| PERF-1 ✔ | **10.5 MB (6.9 MB gzip) LLM-logo chunk on every logged-in page.** `@strange-huge/icons/llm` embeds 296 base64 webp images. Pulled in via `AppLayout → RightSidebar → Pinboard → Pin → ModelIcon`, statically, even though Pins is flagged off, and via ~15 other static `ModelIcon` imports (`ChatInput.tsx:14`, `ReasoningBlock.tsx:34`, settings…). Four earlier `dynamic()` workarounds (TopBar, AppDialogs, DropdownMenuItem, LazyPresetModelSelectorDialog) are bypassed | chunk `0hl~8a1psuztp.js` = 10,550,332 bytes | Replace the package import in `ThemedLlmIcon` with a local map of the 11 logos `toLlmIconId` can return (or `/public/llm-icons/*.webp`); lazy-load `RightSidebar`/`HighlightSidebar`; add an ESLint `no-restricted-imports` rule for `@strange-huge/icons/llm` | −6.7 MB gzip and −10 MB parse on every route (~80% of first load) | Critical | S |
| PERF-2 | KaTeX + full markdown pipeline on every `(app)` route (same Pins chain) | chunks `0ul5v8imet91m.js` (96 KB gz), `0ilf_l11~~njb.js` (79 KB gz) | Fixed by lazy `RightSidebar` | −175 KB gz on non-chat routes | High | S |
| PERF-3 | Mermaid + elkjs loaded statically on `/chat` (and duplicated across routes by Turbopack) | `CodeBlock.tsx:5 → MermaidDiagram → beautiful-mermaid`; chunk 1.6 MB raw / 473 KB gz | `next/dynamic` for `MermaidDiagram` only when a fence is `mermaid` | −470 KB gz on chat routes | High | S |
| PERF-4 | Recharts loaded before any chart appears | `content-renderer.tsx` static `Xml*` imports; `agents/page.tsx:61` Sparkline | `dynamic()` per widget (as `XmlMap` already does) | −86 KB gz | Med-High | S |
| PERF-5 | Mixpanel bundle includes the session-replay recorder (rrweb), unused (`record_sessions_percent: 0`) | `lib/analytics/mixpanel.ts:16`; chunk 117 KB gz | Import the core loader (`mixpanel-browser/src/loaders/loader-module-core`) | −75–85 KB gz on every route incl. onboarding | Med-High | S |
| PERF-6 | framer-motion: `LazyMotion` with sync `domMax` while ~10 modules import full `motion` (incl. `Button`) | `MotionProvider`, `Button/index.tsx:5` | Use `m.*` everywhere, async features, `strict` | −20–30 KB gz | Low-Med | S–M |
| PERF-7 | Bundler mismatch: build ran on Turbopack while `package.json` says `--webpack` and the webpack-only analyzer is configured; no bundle budget | `.next/trace-build`, `next.config.ts` | Pick one bundler; use `next experimental-analyze`; CI budget on `.next/diagnostics/route-bundle-stats.json` (would have caught PERF-1) | Prevents regressions | Process | S |

### 3.2 Data fetching and runtime

Cold load of `/chat?id=X` today: server proxy (session + `/users/me` on cache miss) → `/auth/access-token` (every API call waits on it) → chats, models, messages, `/users/me` → projects, org (1–4 calls), recommendations + 6 connectors → per-project chats (up to 15 requests), org Slack status, persona version. Roughly **20–30 requests across four sequential waves**.

| ID | Finding | Evidence | Fix | Sev | Effort | Owner |
|---|---|---|---|---|---|---|
| PERF-8 | Chats list and messages unpaginated on the backend (FE already sends `cursor`) | BE `chat/router.py:124-130,193-203` | Keyset pagination on `(updated_at, id)` | Med-High | S–M | BE |
| PERF-9 | Waterfall: projects and org wait for `/users/me`; org needs an extra round trip because `org_id` is missing (API-3) | `projects-context.tsx:277`, `org-context.tsx:101` | Start projects from the token `sub`; return `org_id` with the user | High | S | Both |
| PERF-10 | Sidebar project chats re-fetched repeatedly (5 projects → up to 15 requests) | `LeftSidebar.tsx:2001-2004`, `projects-context.tsx:515,541` | In-flight/loaded set per project, or React Query `useQueries` | High | S | FE |
| PERF-11 | Switching chats always clears and re-fetches messages; no cache; no abort | `use-chat-state.ts:183-202` | React Query `useInfiniteQuery` keyed by chat id; AbortController; shallow URL updates | Med-High | M | FE |
| PERF-12 | `/users/me` fetched by the server proxy and again on the client; refreshed after every chat turn | `proxy.ts:125`, `auth-context.tsx:321`, `ChatInterface.tsx:515` | Seed the client from the server; send updated credits in the stream's done event | Med | S–M | Both |
| PERF-13 | N+1 lists: agent chats (one request per agent) in sidebar and search; highlights per chat | `LeftSidebar.tsx:1553-1560`, `search-context.tsx:115-131`, `highlight-context.tsx:87-104` | Backend "recent agent chats" and "all highlights" endpoints | Med | M | Both |
| PERF-14 | Title polling re-downloads the first page of `/chats` twice per new chat; billing page reloads twice on focus; 6 connector + recommendation requests warmed on every load | `chat/page.tsx:672`, `plans-and-billing/page.tsx:1128-1135`, `AppLayout.tsx:69-78` | Fetch one chat / push title in SSE; single throttled listener; batch endpoint or warm on intent | Low-Med | S | FE |
| PERF-15 | Streaming re-parses the whole message's markdown on every reveal step (~30/s); the 50 ms batcher is bypassed by a microtask flush per network chunk; think extraction and `xhr.responseText` rescan the full text per chunk | `ChatMessage.tsx`, `content-renderer.tsx:126`, `use-streaming-chat.ts:139-155` | Memoize completed markdown blocks (only the last block re-parses); rAF-based flush; `fetch` + ReadableStream | High (long replies) | M | FE |
| PERF-16 | Client-heavy app: 71 of 75 pages are `'use client'`, 13 client providers in the `(app)` layout, `AppLayout` chunk 125 KB gz; React Query used by one hook; ~20 hand-rolled module caches | see code audit | Split `AppLayout`/sidebar; server-fetch user/org/chat list in the (already dynamic) layout; migrate server state to React Query | Med | L | FE |
| PERF-17 | Backend latency on hot endpoints | See [Backend latency](#33-backend-latency) (PERF-18…PERF-27) | | | | BE |

### 3.3 Backend latency

Stack: FastAPI on uvicorn (4 workers), SQLAlchemy 2 async + psycopg against Supabase Supavisor (transaction mode), async Redis. Auth verifies RS256 locally with a 1 h JWKS cache (no Auth0 call per request).

| ID | Finding | Evidence | Fix | Sev | Effort |
|---|---|---|---|---|---|
| PERF-18 ✔ | **Every request opens a new Postgres connection** (`NullPool`, TLS + Supavisor auth each time, often tens of ms); some handlers open two sessions (`Organization(...).forUser()` then `.get()/.plan()/.members()`, same in `Project.*`) | `db/session.py:13-28`; `services/organizations/organization.py:52,136,230,541` | Small client pool (`pool_size` 5–10, `pool_pre_ping`) against Supavisor session mode or a direct connection (or keep transaction mode with a pool and `pool_reset_on_return`); one session per request | High | M |
| PERF-19 ✔ | **Hot foreign keys appear unindexed:** `ChatboardMessage.chat_id`, `ChatboardMessage.user_id`, `Chatboard.user_id`, `Pins.message_id`, `MessageFileAttachment/MessagePinAttachment/WebSearchToolCall.message_id`, `ProjectChat.chat_id`, `Automation.chat_id` (Postgres doesn't index FKs automatically; migrations create only PK indexes for these) | `services/chat/models.py:39,70,87,105`, `db/base.py:30,38`, `services/pins/models.py:34` | `(chat_id, created_at) WHERE deleted_at IS NULL` on messages; `(user_id, updated_at DESC)` on chats; plain indexes on each `message_id` FK and `ProjectChat.chat_id`. **Confirm against the live DB with `pg_indexes` first** | High | S |
| PERF-20 | **`GET /chats` counts every message and pin for every chat** (outer joins + `count(distinct)` + GROUP BY, no LIMIT) | `services/chat/repository.py:24-66` | Keyset pagination (PERF-8); drop the counts or store `message_count`; count only the page's ids | High | S–M |
| PERF-21 | **`GET /chats/{id}/messages` is heavy:** returns every turn with `output`, `reasoning`, sections, web search results, context and `tool_calls` with **raw tool output** (can be megabytes); no gzip | `services/chat/repository.py:122-196`, `services/llm/stream.py:244-249` | Paginate (last N turns); strip or truncate `tool_calls[].output` and `web_searches.results`, load on demand; add `GZipMiddleware(minimum_size=1024)` that skips `text/event-stream` | High | S–M |
| PERF-22 | **Org `/plan` and `/members` run two queries per member, sequentially, on every page load;** non-admins then get everything but themselves discarded; pending invites look users up by email twice | `services/organizations/service.py:470-485`, `organization.py:226-268,552`; FE `org-context.tsx:214-218` | One GROUP BY usage query + one bulk user fetch; skip the breakdown for non-admins; cache 30–60 s in Redis | High | S–M |
| PERF-23 | **`GET /users/me` runs ~12 sequential queries with duplicates** (membership ×2, enterprise contract ×2, billing user ×3, subscription ×2); Redis TTL only 15 s; called by the proxy, the client and after every chat turn | `services/users/service.py:116-167,276`, `router.py:27` | Resolve membership/contract/billing once and pass down; TTL ~60 s with invalidation on usage writes and webhooks | Med | S |
| PERF-24 | **Connector warm-up:** 6 `GET /connectors/{slug}` per app load; on a cache miss each one loads permissions for every connected account across all connectors | `services/connectors/service.py:157-172,211`; FE `connect-apps-cache.ts:17,35-46` | Batch endpoint (`GET /connectors?slugs=…`); filter accounts to the slug; bulk-load permissions | Med | S |
| PERF-25 | `GET /projects` unpaginated with a count-distinct join; project chats fetched per project with message counts | `services/projects/repository.py:48-90,523` | Return top N chats inline with `/projects`; paginate | Low-Med | S |
| PERF-26 | `GET /stripe/billing` makes three Stripe API calls in sequence, uncached (settings only) | `services/stripe/account.py:309-327,456-457` | `asyncio.gather` + Redis cache 60–300 s invalidated by webhook | Med | S |
| PERF-27 | Minor: request-id middleware uses `BaseHTTPMiddleware` (per-request overhead); `/pins` returns full message output with no limit (flagged off) | `main.py:~159`, `services/pins/repository.py:12` | Pure ASGI middleware; paginate pins | Low | S |

Highest-impact backend order: pooled engine → FK indexes → paginate and drop counts on `/chats` and `/messages` → strip tool outputs → batch org member queries → gzip → batch connectors endpoint → single agent-chats endpoint.

---

## 4. Code quality and architecture

Baseline: 701 TS/TSX files, ~162k lines; strict `tsc` clean; ESLint 193 errors (149 real, 44 are config noise from unknown rule ids) and 217 warnings; 88 test files; `reactCompiler: true`.

| ID | Finding | Evidence | Fix | Sev | Effort |
|---|---|---|---|---|---|
| CODE-1 | **CI doesn't run tsc, ESLint or tests** (only an advisory React Doctor job) | `.github/workflows/react-doctor.yml` | See OPS-1 | High | S |
| CODE-2 | **Streaming engine is one ~1,400-line closure, and its event handling exists three times** (chat hook, persona streams, CompareModels) | `use-streaming-chat.ts:217-1617` (`processSSEText` ~1,020 lines); `lib/api/personas.ts:1094+`; `CompareModels.tsx:~1148` | Extract a pure `(TurnState, Event) => patch` reducer, a transport module and a batching hook; reuse the reducer in all three | High | L |
| CODE-3 | **`LeftSidebar.tsx` (2,745 lines) holds two sidebars;** the legacy one renders only on `/org/*`, which are client redirect stubs. ~3.5k lines effectively dead, incl. `components/Sidebar` (1,311), `SidebarProjectsSection`, `ChatHistoryItem` | `LeftSidebar.tsx:2298,2500,2607-2733` | Move `/org/*` redirects to `next.config.ts`, delete the legacy branch, split the rest into `sidebar/` modules | High | M |
| CODE-4 | **React Compiler is on, but 62 files have error-level `react-hooks/*` findings,** incl. core primitives (`Button`, `IconButton`, `Switch`, `Tooltip`, `Tabs`, `Checkbox`, `Chip`), so the compiler likely skips the most-rendered components; 430 manual `useMemo`/`useCallback` remain | ESLint output | Fix primitives first (React 19 `ref` prop + merged callback ref), make `react-hooks/*` blocking in CI | Med-High | M |
| CODE-5 | **Fragmented data layer:** React Query used by one hook; ~20 module-level TTL caches; ~30 `window` event dispatches used as the invalidation bus (some as raw string literals) | `lib/queries/personas.ts`; `personas.ts`, `ai-models.ts`, `connectors.ts`, … | Migrate server state domain by domain (personas, models, projects, connectors, chats) to React Query; keep typed window events only for UI commands | Med | L |
| CODE-6 | **API responses cast, not validated** (108 `apiFetchJson<T>` sites; no zod in projects, pins, chat, chat-shares, teams, highlights, persona-shares) | `lib/api/client.ts:273` | Require a schema (see API-9) | Med | M |
| CODE-7 | **God components and prop drilling:** `agents/page.tsx` inner component ~1,830 lines / 32 `useState`; `ChatInterface` 43 props / 23 effects (fed ~47 props by `chat/page.tsx`, repeated in the project chat page); `instructions/page.tsx` 26 effects | — | Extract `useChatScroll`, `useChatSend`, `useStreamResilience`; one `ChatHostConfig`; split pages into data hooks + sections | Med | L |
| CODE-8 | **Dead code and deps:** ~42 files (~8.2k lines) with no importers (TeamSwitcher*, ApprovalCard, ShareModal, SaveVersionModal, VersionCard, PlanGate, ConnectorCard, UndoToast, `lib/api-client.ts`, `ui/button.tsx`, `hooks/useHighlightJs.ts`…); ~120 unused exports (12 `WORKFLOW_*` endpoints, unused persona stream functions); unused deps `rehype-highlight`, `pdfjs-dist`, `stripe` | `knip`-style scan + grep | Add `knip` to CI; delete in one sweep | Med | S |
| CODE-9 | **Duplicates:** two ChatInputs (1,358 + 1,057 lines), two markdown pipelines + a custom line renderer + CompareModels' inline renderer, three highlight.js loaders, two change-plan pages, `PersonaAvatar` ×2, `Chip` ×4, `CodeBlock` ×3, relative-time helpers ×3, `formatBytes` ×3; two files named `content-parser.ts` doing different jobs | see audit | Converge; rename `lib/parsers/content-parser.ts` → `thinking-parser.ts` | Med | M |
| CODE-10 | **Swallowed errors in user flows:** `respondToChatPrompt(...).catch(() => {})` in `agent/configure/layout.tsx:672`; autosave failure still navigates away (`agent/configure/context.tsx:424-433`, nav lock "temporarily disabled" at `:941-946`); clipboard failures still show "Copied"; ~50 `.catch(() => …)` and 15 empty `catch {}`; `logger` used 18× vs 95 `console.*` | — | Toast and roll back on failure; block navigation on failed save; route all logging through `logger` → Sentry | Med | S |
| CODE-11 | **Tests miss critical paths:** 0 of 15 contexts, 2 of 22 hooks, no tests for `ChatInterface`, `LeftSidebar`, `CompareModels`, `lib/api/chat.ts`, billing pages; `jsdom` used by 15+ tests but only a transitive dependency; no Testing Library | `vitest.config.ts` | Declare `jsdom` (+ `@testing-library/react`); test the extracted stream reducer, auth and projects contexts | Med | S–M |
| CODE-12 | **Conventions:** 5,799 inline `style={{}}` vs 831 `className=`; mixed folder and file casing; hooks inside `lib/`; `docs/`, `docs v1.5/`, `docs v2/` with spaces; mojibake in comments; lint `eslint-disable` comments naming rules that aren't loaded (44 "rule not found" errors) | — | Fix rule ids; agree conventions; see UI-3 for styling | Low | S |

---

## 5. Components, design system and accessibility

| ID | Finding | Evidence | Fix | Sev | Effort |
|---|---|---|---|---|---|
| UI-1 | **Modals:** ~8 implementations plus ~24 hand-built overlays; only 6 of 33 dialogs trap focus; `ConfirmModal` (12 call sites, used for deletes) has no dialog semantics; z-index 60–9998 | `ConfirmModal/index.tsx:69-100`, `ChangeAgentModelModal/shared.tsx:81`; `hooks/use-focus-trap.ts` used by 3 files | One `<Modal>` and `<ConfirmDialog role="alertdialog">` on Radix Dialog (already a dependency); quick win: add `useFocusTrap` + ARIA to `ConfirmModal` and `ModalShell` (~19 call sites) | High | M |
| UI-2 | **Focus often invisible:** no global `:focus-visible` rule; 58 inline `outline: none` | e.g. `onboarding/hello/page.tsx:59-75`, `_components/step-shell.tsx:151-160` | One global `:where(button,a,[role=button],[tabindex],input,textarea,select):focus-visible` rule using `--focus-ring` | High | S |
| UI-3 | **Styling bypasses the token scale:** 5,796 inline style objects; 889 numeric font sizes vs 126 tokenized (23 sizes vs a 6-step scale); 29 radius values; 24 z-index values; spacing tokens used 5 times; hover implemented in JS (173 `onMouseEnter`, 60 direct style mutations), so `:hover`/`:focus-visible` can't be expressed in CSS. Tailwind v4 installed but ~135 utility uses and no `@theme` | — | Add missing tokens (type 12/13/18/20, radius, z-index scale); map them into `@theme` or `kds-*` classes; lint against numeric `fontSize` and literal colours in new code | High | L |
| UI-4 | **Controls not keyboard-reachable or unnamed:** theme picker is a `<div onClick>` (keyboard users can't change theme), sortable table headers, attachment preview, agent avatar; chevron toggle without label or `aria-expanded`; schedule `role="switch"` without a name; 33 icon-only raw buttons; only Next core-web-vitals lint rules (no `jsx-a11y` recommended) | `preferences/page.tsx:225-229`, `AnimatedTable.tsx:192`, `ChatMessage.tsx:165`, `ScheduleDetailView.tsx:85-95` | Convert to `<button>`/`Switch`; enable `jsx-a11y` recommended; add axe checks to tests | High | M |
| UI-5 | **No responsive layout:** 1 Tailwind responsive prefix, 6 width media queries, fixed 294/332/356 px panels in normal flow, tables with 820–900 px min widths. At 390 px the expanded sidebar leaves ~96 px | `FlatSidebar/index.tsx:161`, `RightSidebar.tsx:463`, `members/page.tsx:480` | Product decision on mobile support, then overlay drawers under 768 px, scroll containers for tables, `maxWidth` over `width` | High | L |
| UI-6 | **Dead and duplicate components:** 23 component folders (~5.5k lines) unused; two ChatInputs, two sidebars, two menu systems (custom Dropdown + Radix); 41 page-local copies of primitives (`SectionCard` ×3, `GhostButton` ×3, `Badge`, `PermToggle`/`Toggle` duplicating `Switch`, `EmptyState` ×4); 241 raw `<button>`s (67 without `type`) | — | Delete; promote `SectionCard`, `EmptyState`, ghost/danger Button variants; add `Button variant="unstyled"`/`asChild` | Med | M |
| UI-7 | **Inconsistent loading, empty and error states:** no `loading.tsx`/`error.tsx` on any route; 33 bespoke skeletons; 4 spinner implementations (`Spinner` is `aria-hidden`, no status); 278 `toast.error` (66 show raw `err.message`), only 4 retry affordances | — | Route-level `loading.tsx`/`error.tsx`; shared `EmptyState`/`ErrorState` with Retry; `Spinner` with a label and `role=status` | Med | M |
| UI-8 | **Reduced motion not respected globally:** no `MotionConfig reducedMotion="user"`; 8 components with infinite animations ungated; skeleton pulse ungated | `MotionProvider/index.tsx`, `globals.css:128-131` | One-line `MotionConfig` wrapper; gate the CSS pulse | Med | S |
| UI-9 | **Contrast:** `--neutral-400` (2.94:1) used for text 87×, `--neutral-500` (4.10:1) 221×, `--neutral-300` (1.69:1) 17×; 54 sizes ≤ 11 px | token measurements | Darken `--neutral-500` to ≥4.5:1 (design sign-off) or restrict it to ≥14 px; keep 300/400 for icons and borders | Med | S–M |
| UI-10 | **Dark mode** (flag off): good token base (`theme.css` remaps primitives), but ~294 literal colours in 85 files, brown-tinted borders and shadows that vanish on dark, 58 `--legacy-*` token uses | `CompareModels.tsx`, `ProfileTab.tsx`, `agent/configure/layout.tsx:391-405`, `KnowledgeTab.tsx:210` | Re-run `scripts/migrate-inline-colors.mjs` for borders and backgrounds; replace `rgba(82,75,71,0.12)` with `var(--neutral-700-12)`; fold legacy tokens | Med | M |
| UI-11 | **Forms and semantics:** 30 inputs with placeholder only (no label); errors not linked (`aria-describedby` ×6); 46 of 75 pages without an `<h1>` (some may render one in children); no skip link; 137 native `title=` tooltips beside the Radix Tooltip; 4 icon sources + 105 inline SVGs | `step-shell.tsx:151`, `onboarding/workspace/page.tsx:168` | Use `InputField` everywhere; link errors; one icon source; skip link | Low-Med | M |
| UI-12 | **No component docs or visual tests:** no Storybook/Ladle, no visual regression, no axe; design docs partly stale (`AGENTS.md` points to a missing design reference path; `ui/index.ts` says "replace before production") | — | Storybook/Ladle for the ~20 real primitives (Button, IconButton, Badge, Dropdown, Tooltip, Tabs, Switch, Checkbox, InputField, Skeleton, Spinner, Toast, Chip…); fix stale docs | Low-Med | M |
| UI-13 | **i18n readiness** (only if localisation is planned): hard-coded `lang="en"`, ~1,700 literal strings, 31 calls pinning `en-US`, 38 `toLocaleString()` without a locale (server/client mismatch risk), formatters duplicated | — | Centralize formatting in `format-utils` with one locale source now; defer string extraction | Low | M |

---

## 6. Production readiness: reliability, observability, operations, compliance

| ID | Finding | Evidence | Fix | Sev | Effort | Owner |
|---|---|---|---|---|---|---|
| OPS-1 | **CI gates nothing.** FE: only advisory React Doctor (unpinned action). BE: Alembic check, build and an eval, but no pytest, ruff or mypy | `.github/workflows/` in both repos | FE PR workflow: `npm ci`, `lint`, `tsc --noEmit`, `vitest run`, `next build`, `npm audit --audit-level=high`, bundle budget; required checks; BE pytest + ruff; pin actions to SHAs | High | S | FE/BE |
| OPS-2 | **No front-end error tracking or web vitals;** no `global-error.tsx`, `error.tsx`, `not-found.tsx`; the class `ErrorBoundary` only `console.error`s and wraps `AppLayout`/settings (not onboarding, standalone, providers). Logger redaction is shallow | grep; `components/ErrorBoundary`; `lib/logger.ts:25-36` | `@sentry/nextjs` (instrumentation, `onRequestError`, hidden source-map upload, releases); `useReportWebVitals`; `logger.error` → Sentry; add the route error files | High | M | FE |
| OPS-3 | **Network resilience:** `apiFetch` has no timeout and retries only on 401; no offline handling; streams never reconnect and have no stall timeout (a hung stream spins until the 800 s `maxDuration`); no idempotency keys on create/checkout/invite | `lib/api/client.ts:119-221`; `use-streaming-chat.ts:1507-1546` | `AbortSignal.timeout`; GET retries with jittered backoff on 502/503/504; offline banner; stall watchdog + re-fetch the chat after a drop; `Idempotency-Key` on POSTs; later a resumable turn-event endpoint | Med | M | Both |
| OPS-4 | **Request ids not propagated:** backend sets and exposes `X-Request-Id`; FE never sends, reads or shows it | `main.py:165-183` | Generate per call, forward through proxies, attach to `ApiError`, Sentry and error toasts ("Ref: abc123") | Med | S | FE |
| OPS-5 | **Build depends on AWS:** `prebuild`/`prestart` run `load-secrets`, which exits without AWS keys unless on Vercel | `package.json`, `scripts/load-secrets.mjs:29-37` | Only for `predev`, or skip when `CI` / `SKIP_SECRETS` is set | Med | S | FE |
| OPS-6 | **Environment pinning:** no `.nvmrc`/`engines`; `run-dev.sh` hardcodes another developer's paths; git dependency `@strange-huge/icons` without a ref; version stays 0.1.0 with no tags or changelog; backend Dockerfile uses `uv:latest` | — | `.nvmrc` (22 LTS) + `engines`; delete `run-dev.sh`; pin refs and images; tag releases and inject the version into Sentry | Low-Med | S | Both |
| OPS-7 | **Analytics privacy and correctness:** Mixpanel starts without consent; default `$current_url` sends query strings (Slack `state`, Stripe `session_id`); preview builds may report to PROD Mixpanel if `NEXT_PUBLIC_VERCEL_ENV` isn't exposed (uncertain); backend Sentry `send_default_pii=True` | `lib/analytics/mixpanel.ts:36-72`, `lib/config.ts:39-44`, BE `main.py:130` | Consent banner gating `initAnalytics()` for EU/UK; `property_blacklist` for URL properties; set `NEXT_PUBLIC_VERCEL_ENV` per environment; review Sentry PII scrubbing | Med | M | Both |
| OPS-8 | **Feature flags are build-time only** (4 `NEXT_PUBLIC_*` booleans); no runtime kill switch | `lib/feature-flags.ts` | Fine for now; consider a runtime flag source for risky features (pins, browser view) | Low | M | FE |
| OPS-9 | **Health and uptime:** backend has `/health` and `/ready`; FE has no health route; no external uptime monitoring found | `main.py:222-241` | `app/api/health/route.ts`; uptime checks on both services; public status page | Low | S | Ops |
| OPS-10 | **Session policy:** Auth0 session durations unset (SDK defaults) | `lib/auth0.ts` | Set explicit inactivity and absolute durations | Low | S | FE |
| OPS-11 | **Compliance:** broken legal links on the public invite page (`/terms`, `/privacy` redirect to login); placeholder root metadata ("Your AI-powered souvenir companion"); no `robots.ts` | `org-invite/[inviteId]/page.tsx:105-106`, `app/layout.tsx:55-58` | Absolute marketing URLs; real description; `robots.ts` disallow; `noindex` on the invite page | Med | S | FE |

---

## 7. SaaS product quality and feature completeness

### 7.1 Inventory

| Area | Status | Notes |
|---|---|---|
| Chat streaming, stop, edit, regenerate, copy, retry | Complete | Edit/regenerate are destructive (no alternates kept) |
| Rename, star, delete, bulk move to project | Complete | |
| Archive | Partial | One-way: no unarchive endpoint or UI |
| Projects (files, instructions, members, trash/restore) | Complete | Copy/duplicate is backend-only |
| Search | Partial | Cmd+K matches titles of already-loaded chats only; messages already store embeddings |
| Sharing chats | Partial | Person-to-person only; shared view loses widgets, files, citations; no public link |
| Export (chat md/pdf, data export) | Missing | Only pin export (flagged off) |
| Answer feedback (thumbs) | Missing | No table, endpoint or UI |
| Branching / answer versions | Missing | |
| Composer draft persistence | Missing | |
| Prompt library / saved prompts | Missing | Starter suggestions only |
| Keyboard shortcuts | Partial | Cmd+K, Cmd+B; no shortcut sheet, no new-chat shortcut |
| Agents (create, versions, publish, test, knowledge, Super Links, templates) | Complete | See API-5, API-6, API-7 for correctness bugs |
| Connectors, OAuth, reconnect, permission prompts, Slack app, Zapier | Complete | |
| Schedules / automations | Partial | No form-based create/edit (round-trips through chat); failures notify Slack only |
| Org members, roles, invites | Partial | Admin/member only; no invite link, resend, guest or billing-admin role |
| Domain allowlist | Partial | Stored but enforced only in the browser |
| SSO / SAML / SCIM | Missing | |
| Audit log | Partial | Page and API exist but aren't in the settings nav; narrow event coverage; no filters or export |
| Admin usage analytics | Partial, **synthetic** ✔ | Chart is generated with sin/cos from one cycle total |
| Spend controls | Partial | Pool cap only; no per-member caps |
| Billing (checkout, portal, invoices, cancel/resume) | Complete | Trial claim broken (API-1); Stripe return URLs land in onboarding |
| Credit / blocked states | Partial | Individual works; workspace `paused` not shown (API-4) |
| Onboarding | Complete | Memory import broken (API-2) |
| Notification centre | Missing | |
| Notification preferences, Preferences, Security, Files settings | **Mock** ✔ | Local state only; Security lists invented sessions; "Enable 2FA" does nothing; email unsubscribe link points to the non-persisting page |
| Memory management (view/delete/export) | Missing | Write-only from onboarding |
| API keys / developer access | Missing | |
| Account deletion | Backend-only | Button disabled; backend soft-deactivates without revoking tokens |
| Help / support | Partial | Help Center, Contact Support "Coming soon"; no status page or changelog |
| Doc design (brand kit), templates management | Backend-only | |
| Dark theme, Pins, Highlights, Browser view | Flagged off | |
| Mobile / responsive, PWA | Missing | |
| Cookie consent | Missing | |

### 7.2 Prioritized gaps

| ID | Gap | Impact | Fix | Sev | Effort |
|---|---|---|---|---|---|
| SAAS-1 ✔ | Mock settings pages with fake data (Security sessions "Safari on iPhone 17 Pro, New Delhi", 2FA, Notifications, Preferences, Files); unsubscribe link lands on a page that saves nothing | Credibility and security-review red flag; CAN-SPAM/GDPR risk | Hide now; build notification prefs + unsubscribe token; Auth0 MFA enrolment and sessions API for Security | High | S (hide) / M |
| SAAS-2 ✔ | Admin analytics chart is synthetic while real per-event data exists unused | Admins make spend decisions on fabricated trends | Aggregate `plan/enterprise-usage` by day, category and member; until then show honest cycle-to-date bars | High | M |
| SAAS-3 | No account deletion, data export or chat export | GDPR/DSAR gap, procurement blocker | Wire `deleteUser()` with typed confirmation (+ BE token revocation, purge after retention); `GET /users/me/export` zip; per-chat md/pdf export | High | M |
| SAAS-4 | No SSO/SAML, SCIM or enforced domain capture | Blocks enterprise deals | Auth0 Organizations + Enterprise Connections; enforce `allowed_email_domains` server-side; domain auto-join | High | L |
| SAAS-5 | Search is title-only over loaded chats | Weak core retrieval | `GET /chats/search?q=` using existing message embeddings + trigram on titles | High | M |
| SAAS-6 | No answer feedback; edit/regenerate destroy prior answers | No quality signal; users lose answers | `message_feedback` table + thumbs UI; keep replaced turns as siblings with a "< 1/2 >" switcher | Med-High | M |
| SAAS-7 | No notification centre; automation failures only reach Slack users | Schedules fail silently for non-Slack users | `/notifications` feed (automation status, shares received, credit thresholds) + email fallback | Med-High | M–L |
| SAAS-8 | Audit log hidden from nav and narrow | Compliance reviewers can't find it | Add "Activity log" to the settings sidebar (S); log connector, share, export and login events; filters + CSV | Med | S / M |
| SAAS-9 | Schedules have no real create/edit form | Confusing; placeholder rows drift | Expose `POST /automations` and full `PATCH`; keep chat creation as an option | Med | M |
| SAAS-10 | Memory has no view/delete/export | Privacy and trust gap vs "Manage memories" elsewhere | `GET/DELETE /memory` + a real "Manage memory" modal | Med | M |
| SAAS-11 | Org governance: two roles only, no per-member caps, no org connector allowlist, no invite link/resend, workspace delete disabled, no billing transfer UI | Mid-market admins can't control cost or data exfiltration | Billing-admin and guest roles; per-member caps; org connector policy; enable the already-wired workspace delete; transfer-billing UI | Med | M–L |
| SAAS-12 | Shared chats render plain markdown (no widgets, files, citations) | Degraded experience for share recipients | Store blocks and attachments in `SharedMessage`; reuse `ChatMessage` read-only | Med | M |
| SAAS-13 | Mobile / PWA | Mobile users get a broken layout | See UI-5; add a manifest | Med | L |
| SAAS-14 | Help and trust surfaces: no status page, changelog, support email; "Coming soon" rows | Support friction | Link a status page, changelog and support address | Low-Med | S |

---

## Quick wins (≤1 day each)

1. Upgrade `next` (SEC-1); remove `pdfjs-dist`, its worker and `stripe`.
2. Lock down `/api/download` (SEC-2) and gate `/api/lab` + `/compare` in production (SEC-7).
3. Pins ownership check on the backend (SEC-3).
4. Replace the `@strange-huge/icons/llm` import with 11 local logos and lazy-load `RightSidebar` (PERF-1, PERF-2).
5. Lazy-load Mermaid and chart widgets (PERF-3, PERF-4); switch Mixpanel to the core loader (PERF-5).
6. CI workflow with tsc, lint, vitest, build, audit (OPS-1); fix the 44 unknown-rule lint errors.
7. Hide or label the mock settings pages; fix the unsubscribe link target (SAAS-1).
8. Fix the trial claim (API-1), memory body (API-2), `paused` mapping (API-4), share credit units (API-5), received-share "use" (API-7).
9. Backend: add `org_id`/role/`auth0_id` to `/users/me` (API-3, API-11); inherit version settings (API-6).
10. Add `global-error.tsx`, `(app)/error.tsx`, `not-found.tsx` (OPS-2 part 1).
11. Global `:focus-visible` rule (UI-2); `MotionConfig reducedMotion="user"` (UI-8); focus trap + ARIA on `ConfirmModal`/`ModalShell` (UI-1 part 1).
12. "Activity log" link in settings (SAAS-8); enable account deletion with confirmation (SAAS-3 part 1); unarchive.
13. Fix legal links on the invite page and the root metadata (OPS-11).
14. Delete dead code with `knip` (CODE-8) and the legacy sidebar branch (CODE-3).
15. Sidebar project-chat refetch loop (PERF-10).
16. Backend: add the FK indexes after checking `pg_indexes` (PERF-19); gzip for non-SSE responses (PERF-21); `asyncio.gather` the Stripe billing calls (PERF-26).

---

## What's already good

- Strict TypeScript with zero errors; 88 test files, with strong coverage of pure logic (parsers, reasoning, citations, streaming helpers).
- Access tokens held in memory (not localStorage) with deduplicated refresh and bounded 401 retry.
- Template iframe sandboxed (opaque origin, `frame-ancestors 'self'`); HSTS preload, `X-Frame-Options: DENY`, `nosniff`; backend and analytics proxies strip cookies.
- Fonts via `next/font` with subsetting; maplibre, jspdf, html2canvas, highlight.js and CompareModels already lazy-loaded; chat, chats, agents and pinboard lists virtualized.
- Backend has request ids, Sentry, liveness/readiness probes, a single locked CORS origin, AG-UI events published with JSON schemas.
- Accessible primitives exist and are good (IconButton enforces labels; Dropdown has full keyboard support; InputField wires labels and errors); dark-mode token base is generated and complete.
- Slack integration contract matches exactly; connector pagination implemented correctly on both sides.

---

## Appendix: method and limits

- Read-only audits; no code was changed for this document. One production build (`next build`, Turbopack) was analysed; npm audit run with `--omit=dev`.
- Counts from regex scans (inline styles, raw buttons, unlabeled inputs, dead files) are approximate; verify before bulk deletions (dynamic imports can hide usages).
- Not verified at runtime: mobile rendering, dark mode, real latency numbers, Zapier payload shapes, preview-deployment CORS, whether OnboardingGuard re-routes Stripe returns.
- Uncommitted work-in-progress in the tree (ContextPanel, BrowserPanel, plan updates) was audited as-is.
