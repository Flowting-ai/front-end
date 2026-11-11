# Personas and Share: System Design Audit

> **Status (Oct 14 2026): Phases 1–2 done (front-end); Phase 3 items 1 and 3 done, 4.4 done; 3.2 (one link model across share kinds), 3.4 paging and 3.5 notifications open (paging/notifications need the backend).**
>
> Done (Phase 1):
> 1. Persona-chat proxy: `repoId`/`chatId` were already checked with `isSafeId` (Internal/API routes audit). New: `checkUploads()` in `lib/server/upload-limits.ts` (at most 10 files, 30 MB each, matching the client's `FILE_CONSTRAINTS`) returns a 413 `payload_too_large`. It applies to `/api/persona-chat` and also to `/api/chat`. `payload_too_large` was added to `RouteErrorCode`.
> 2. Zod: `lib/api/share-schemas.ts` covers persona shares (share, preview, accept, received, sent, dashboard) and chat shares (share, shared-with-me item, fork, live view). Lists go through `parseList`, which drops malformed rows. Dashboard link cards that fail to parse are dropped instead of failing the dashboard. Optional fields fall back to null, 0 or [], so a field the backend drops does not crash a page.
> 3. Copy link: `lib/share/copy-link.ts` reports the real clipboard result. On failure the toast shows the link so it can be copied by hand (`AgentShareModal`, `agents/published`). The accept page's state cards have `role="status"`/`alert`, the loading card has `aria-busy`, and the headings have heading semantics.
> 5. The accept page navigates to Agents as soon as the accept succeeds; the fixed 1.2 s timer is gone. A double click is ignored while the accept is pending. `formatShareExpiry` guards invalid dates and uses the browser locale. Failures are mapped by `previewFailure`/`acceptFailure` in `lib/share/share-accept.ts`.
> 6. Tests: `lib/share/share.test.ts` covers the accept and preview mapping, the expiry guard, the copy result, `canonicalShareUrl` (with and without the env var, and an invalid URL), the upload limits and the schemas. `app/api/persona-chat/route.test.ts` covers URL routing (existing chat, new chat, `temp-` ids), token and geo headers, id validation and the file-count 413.
> 7. Events: `share_preview_viewed`, `share_expired_seen`, `share_accepted` (accept page), `share_forked` (`forkChatShare`) and `share_revoked` (`revokeShare`, `deleteChatShare`). Each carries a `kind` of `agent` or `chat`, and all are in `events.ts` and the Mixpanel doc.
>
> Not done: item 4 (`loading`/`error`/`not-found` files for the share routes). Both pages already render their own skeleton, not-found and expired states, and `(app)/error.tsx` catches crashes. Proper route files belong with the Phase 2 server-rendered preview.
>
> Phase 2 (Oct 14 2026):
> 1. `lib/share/share-queries.ts`: one `personaSharesQuery` replaces the four separate `listShares()` fetches (share modal, published page, agents panel badges, agents page filter); `shareDashboardQuery(days)` and `receivedSharesQuery` back `useSuperLinksData` (same return API, no set-state-in-effect). Writes: `rememberShare` / `forgetShare` update the list and cached dashboards and refetch them, so the share modal's `onChanged` refetch plumbing is gone; `afterShareAccepted` refreshes the agents list (`bustPersonasCache`) and "Shared with me" after accepting. 3 tests.
> 2. `/share/[id]` is now a server page: `loadSharePreviewOnServer` (React `cache`, session token, 4 s timeout) renders the preview or the not-found/expired state with no loading flash, and `generateMetadata` titles the tab with the agent and sender. Auth/5xx/malformed responses fall back to the browser fetch (`ShareAcceptClient`). 3 tests for the mapping.
> 5. The accept page's hand-rolled skeleton now uses the shared `components/Skeleton`.
>
> Open: chat shares (`ChatShareOverlay`, "shared with me" on /chats) move with the Chat Phase 2 migration; route `error`/`not-found` files for the share routes; the accept page still loads the whole model catalogue to show one model name (gap a).
>
> Phases 3–4 (Oct 14 2026):
> - 3.1: one `components/ShareAgentPanel` (Super Link: create, copy, turn off, usage meter; optional email invites; optional typed credit limit) used by `AgentShareModal` (now 62 lines of dialog chrome, with `useFocusTrap` and Esc) and the agent's published page (link only, asks for the limit; its own `SuperLinkSection`, usage bar and generate form are gone). The legacy configure editor and its sharing tab were already deleted in the Agents audit; `/agents/configure` remains only as a redirect for old links (per your call: delete the legacy editor, keep current agents working). Limit and usage helpers in `lib/share/share-limit.ts` (4 tests).
> - 3.3: `ChatShareOverlay` 474 → 347 lines, its state and actions in `components/chat/use-chat-share.ts`; the accept page was split in Phase 2 (server page + `ShareAcceptClient`).
> - 4.4: the panel says what recipients see (name, description, instructions on the preview) and that their chats run on the sender's credits up to the link's limit.
> - Open: 3.2 a common link model across agent shares, chat shares, Super Links and templates; 3.4 paging for sent/received (backend); 3.5 share notifications (backend feed; Notifications is a skipped audit).
>
> Backend gaps: (f, Phase 2) `GET /persona-shares/{id}` requires a session, so link unfurls can't show the agent; a public, minimal preview (name, sender, image) would let `generateMetadata` serve Open Graph tags. (a) `model_name` in the share preview; (b) a snapshot option and a live-view flag for chat shares; (c) a sender setting for whether the preview shows the agent's prompt; (d) rate limits on preview and accept; (e) the backend's own upload limits should match the proxy's (10 files, 30 MB each).

Scope: the sharing side of personas (agents) and chats. `app/(app)/share/[id]` (486), `app/(app)/chat-shares/[shareId]` (268), `components/chat/ChatShareOverlay` (474), `components/AgentShareModal` (247), `templates/SuperLinks` (286), `agent/configure/components/SharingTab` (744), `agent/configure/sharing/page` (381), `agents/published/page` (659, shared with Agents), `lib/api/persona-shares.ts` (214), `lib/api/chat-shares.ts` (194), `lib/share-url.ts`, `app/api/persona-chat/route.ts` (140), `lib/chat-personas.ts`, `hooks/use-selectable-chat-personas`, `use-pending-persona-handoff`. About 3,500 lines.
The persona editor, list, cards, API module and caching are covered in the **Agents audit**; this one covers sharing, the persona chat proxy, and persona chat plumbing only.
Method: share accept page, both share API modules, share-url helper and the persona-chat route read; other files by grep metrics. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~45% (14.4 / 32 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.5 | 50% |
| 2. Architecture | 8 | 3.6 | 45% |
| 3. Component Patterns | 2 | 0.7 | 35% |
| 4. Data Model | 7 | 3.3 | 47% |
| 5. Interfaces and APIs | 6 | 3.5 | 58% |
| 6. Optimizations | 6 | 1.8 | 30% |

Not applicable: SSG, ISR, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, cursor pagination.

## The four sharing mechanisms in the code

1. **Persona share links** (`persona-shares`): a sender creates a share for a persona repo (backend freezes the active version), with recipient emails or a link, optional credit limit and expiry; recipient previews (`/share/[id]`) and accepts, getting a read-only copy; sender can list, revoke, and see a dashboard.
2. **Standalone chat shares** (`chat-shares`): person-to-person, read-only live view with an optional "fork my own copy" (`/chat-shares/[shareId]`).
3. **In-project chat shares**: inherit the project's audience (separate backend endpoint).
4. **Super links** (`templates/SuperLinks`, `share-url`) and shared HTML pages (see the Templates audit).

Each has its own API functions, page and UI, with no shared share abstraction.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Status-aware UX (#45) | Accept page maps 404 to not found, 410 to expired, 402 to "no credits remaining", other `ApiError` messages to toasts; accept disables the button while pending and handles failure |
| Auth-gated sharing | Share pages sit under `(app)`, so the proxy gate sends a logged-out visitor to login with `returnTo` and brings them back (see Auth audit) |
| Canonical links | `canonicalShareUrl()` rewrites backend-generated URLs to the app's own base (`NEXT_PUBLIC_APP_BASE_URL`, then `window.location.origin`), so links point at the right deployment |
| Clear domain types | `PersonaShare`, `PersonaSharePreview`, `SentShareResponse`, `ChatShare`, `SharedChatItem` with normalisers (snake_case to camelCase) |
| Revoke and lifecycle | `revokeShare`, `deleteChatShare` (friendly error), `is_active` / `is_available` flags distinguish revoked from expired/exhausted |
| Credit-limited sharing | `credit_limit`, `credit_used`, `credit_remaining`, `getShareTokenLimit(plan)` cap shared spend |
| Read-only receive | Received agents are read-only; accept navigates to the agents list rather than the editor |
| Fork model | Chat shares are view-only with explicit fork; documented migration comment explains the model |
| Reuse of chat rendering | Shared chat view uses `ContentRenderer`, `ReasoningBlock`, `SourceList`, so a shared chat looks like the original |
| Skeletons | Loading skeletons on accept and chat-share pages |
| Server-side persona chat proxy | `/api/persona-chat` validates `repoId`/input, forwards geo headers, attaches the token server-side and streams the response; large `maxDuration` documented |
| Analytics | `share_created` event from `chat-shares.ts`; `sharing/page` has tracking |
| Tests | `chat-shares.test.ts` and the chat-share page test |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Server state (#30, #38) | Share pages load in `useEffect` + `useState` with a manual `PageState` machine; no query layer; lists (`listSent`, `listReceived`, `listShares`, `listSharedWithMe`) fetched imperatively | React Query: `["persona-share", id]`, `["shares","sent"]`, `["shares","received"]`; accept/revoke as mutations with invalidation of agents and share lists |
| Component architecture (#12) | `SharingTab` 744 lines (16 `useState`), `ChatShareOverlay` 474, `share/[id]` 486 mixing skeleton, formatting, state machine, view | Split share creation form, recipient list, link panel, sent list, dashboard |
| Duplicate share UIs | Legacy `SharingTab` / `agent/configure/sharing` and the new `AgentShareModal` and `agents/published` each create and manage shares | One `ShareAgentPanel` used everywhere; retire legacy with the legacy editor (see Agents plan) |
| Rendering (#1, #6) | Accept page is a client component that renders a skeleton, then fetches the preview; no server-side preview, no page metadata (title, Open Graph) for links pasted into Slack/email | Server component fetches the preview (token available server-side) and renders directly; `generateMetadata` for a meaningful title |
| Accessibility (#20) | `share/[id]` and `chat-shares/[shareId]` pages have 0 `aria-*`; status states (expired, revoked, accepted) are visual; copy-link has no feedback for screen readers | `role="status"` for states, `aria-live` on copy confirmation, heading structure |
| Error boundaries (#19) | Layout-level only | Boundary plus per-state recovery |
| Observability (#55) | Only creation is tracked; no events for preview viewed, accepted, expired seen, forked, revoked | Typed events with share kind enum |
| Style management (#16) | Local `Skeleton` component with inline styles in `share/[id]` while `chat-shares` imports the shared `Skeleton`; `cardStyle` inline objects | Use shared `Skeleton` and card components |
| Localisation | `formatExpiry` hard-codes `'en-US'` and does not guard invalid dates (`new Date(iso)` can give "Invalid Date") | Shared date helper with guard and locale |
| Optimistic/immediate UI (#33) | Accept shows toast then redirects after a fixed 1.2 s `setTimeout` | Navigate on mutation success; keep success state visible without a timer |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Unvalidated path parameters in the persona-chat proxy | `repoId` and `chatId` come from the client form and are interpolated directly into the upstream URL (`/persona/${repoId}/chats/${chatId}/stream`) with no format check; a crafted value such as `../x` could reach other backend routes under the user's token (backend authorisation still applies; verify). The Template route in contrast validates `z.uuid()` | Validate with `z.uuid()` and `encodeURIComponent` before building the URL; reject unknown `chatId` forms except the `temp-` prefix |
| No upload limits in the proxy | `formData.getAll("files")` forwarded with no count, size or type checks in the route (limits only exist client-side) | Enforce max files and sizes in the route; fail with 413 |
| Cast, not validated | Chat-share and persona-share responses are TypeScript interfaces (`ChatShareResponse`, `SharedChatViewResponse`) cast from `apiFetchJson`, unlike persona repos which use Zod | Zod schemas with `safeParse` at the boundary |
| Silent clipboard failures | `navigator.clipboard.writeText(...).catch(() => {})` shows no result in `AgentShareModal` (and other copy buttons) | Confirmation and a visible fallback (select text) on failure |
| Model name fetched to decorate a page | Accept page loads the full model catalogue via `fetchModelsWithCache()` just to show one model name, swallowing errors | Return `model_name` in the preview from the backend (request), or use the shared models query |
| Four mechanisms, no abstraction | Different URLs (`/share`, `/chat-shares`, `/template`, super links), response shapes and revoke flows; features like expiry, audit and revoke exist for some but not others | A common `ShareLink` model (kind, id, audience, expiry, revoked) in the UI layer and consistent revoke/expire UX; align backend where possible |
| Shared-chat exposure | `getSharedChatView` returns full message history including model names and reasoning to the recipient; there is a live view ("returns live view") so later messages by the sender appear without notice | Show a visible banner "live view, updates as the owner continues" and an option to share a snapshot |
| Prompt disclosure | Accept preview shows the shared agent's system prompt (truncated to 200 chars) to anyone with the link before acceptance (verify this is intended) | Make visibility of the prompt a sender setting |
| Hard redirect timing | `setTimeout(() => push(AGENTS_ROUTE), 1200)` with no cleanup if the component unmounts | Navigate in the mutation callback |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | Persona share accept flow (404/410/402/success), revoke, share-url canonicalisation (env set / unset / invalid), persona-chat route validation and header forwarding, SharingTab limits |
| Code splitting (#46, #48) | Lazy-load `ChatShareOverlay`, `AgentShareModal`, share dashboard and SuperLinks |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | Route-level states for `/share/[id]` and `/chat-shares/[shareId]` |
| Link hygiene | Expiry defaults, one-time links, link rotation, "who viewed" for chat shares |
| Rate limits and abuse | Throttle preview/accept (backend), show remaining credits to recipient before accept |
| Social previews | `generateMetadata` and OG image for agent share links |
| Pagination (#39) | Sent/received lists unbounded (verify) |
| Notifications | Notify the sender on accept, notify the recipient on share (ties to the notifications feed, which cannot represent these today) |
| URL as state (#34) | Share dialog open state and tab in query params for deep links from notifications |
| Core Web Vitals / budget (#8, #56) | Budget for the accept page (it is often the first page a new user sees) |
| Privacy | Document what a recipient can see (prompt, files, connectors) in the dialog before sharing |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Safety and quick wins (S, 45% → ~58%)
1. Validate and encode `repoId`/`chatId` in `/api/persona-chat` (`z.uuid()`, allow `temp-` prefix); enforce file count/size in the route. (+1.0)
2. Zod schemas for persona-share and chat-share responses. (+0.8)
3. Copy-link feedback and failure fallback; `aria-live` for status states and copy results. (+0.5)
4. `error.tsx`/`loading.tsx`/`not-found.tsx` for share routes. (+0.5)
5. Replace the fixed 1.2 s timer with navigate-on-success; guard `formatExpiry`. (+0.3)
6. Tests for accept flow, share-url and the proxy validation. (+1.0)
7. Typed events: preview viewed, accepted, forked, revoked, expired. (+0.4)

### Phase 2: Data and rendering (M, → ~74%)
1. React Query for shares and accept/revoke mutations with invalidation of agents lists. (+1.8)
2. Server-render the accept page preview with `generateMetadata`; include `model_name` in the preview (backend request). (+1.0)
3. Banner for live shared chats and a snapshot option (backend request). (+0.5)
4. Sender-controlled prompt visibility on the preview (backend request). (+0.4)
5. Use shared `Skeleton`/card components. (+0.3)

### Phase 3: Unify sharing (L, → ~90%)
1. One `ShareAgentPanel` replacing `SharingTab`, `agent/configure/sharing` and the modal duplicates. (+1.2)
2. Common `ShareLink` model and consistent revoke/expire UX across persona shares, chat shares, super links and templates. (+1.0)
3. Split `ChatShareOverlay`, accept page and sharing components into container hooks and presentational parts. (+1.0)
4. Lazy-load dialogs and dashboard; pagination for sent/received lists. (+0.6)
5. Notifications for share received/accepted via the backend feed. (+0.4)

### Phase 4: Governance (S, → 100%)
1. Performance budget and Web Vitals for the accept page. (+0.5)
2. Accessibility audit (axe plus screen reader) of share dialogs and pages. (+0.4)
3. Abuse controls review: link expiry defaults, rate limits, audit trail visibility. (+0.4)
4. Documentation of recipient visibility inside the share dialog. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
