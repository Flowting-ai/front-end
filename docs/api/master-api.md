# Master API — Frontend Data-Fetching Architecture

Cross-references the current frontend data-fetching stack against the official Next.js App Router guidance — [fetching data](https://nextjs.org/docs/app/getting-started/fetching-data) (Part 1), [mutating data](https://nextjs.org/docs/app/getting-started/mutating-data) (Part 2), [caching](https://nextjs.org/docs/app/getting-started/caching) (Part 3), [revalidating](https://nextjs.org/docs/app/getting-started/revalidating) (Part 4), and [error handling](https://nextjs.org/docs/app/getting-started/error-handling) (Part 5), all App Router v16 — against [chat-endpoints-usage.md](./chat-endpoints-usage.md), [persona-endpoints-usage.md](./persona-endpoints-usage.md), [persona-shares-endpoints-usage.md](./persona-shares-endpoints-usage.md), [pins-endpoints-usage.md](./pins-endpoints-usage.md), [highlights-endpoints-usage.md](./highlights-endpoints-usage.md), [users-endpoints-usage.md](./users-endpoints-usage.md), [stripe-endpoints-usage.md](./stripe-endpoints-usage.md), [projects-endpoints-usage.md](./projects-endpoints-usage.md), [connectors-endpoints-usage.md](./connectors-endpoints-usage.md), [brain-endpoints-usage.md](./brain-endpoints-usage.md), [slack-endpoints-usage.md](./slack-endpoints-usage.md), [automations-endpoints-usage.md](./automations-endpoints-usage.md), [memory-endpoints-usage.md](./memory-endpoints-usage.md), [organizations-endpoints-usage.md](./organizations-endpoints-usage.md), [llm-endpoints-usage.md](./llm-endpoints-usage.md), and [team-invite-endpoints-usage.md](./team-invite-endpoints-usage.md)'s endpoint-by-endpoint audits — every endpoint-usage doc in `docs/api/` that has any real frontend surface to check ([`internal-sandbox-endpoints-usage.md`](./internal-sandbox-endpoints-usage.md) and [`health-endpoints-usage.md`](./health-endpoints-usage.md) are the only two with none: both are backend-only infrastructure with zero frontend implementation, confirmed by grep, and are intentionally not given a subsection below). which are the source of truth for which backend endpoint each finding below actually hits. Where the docs disagree with what's actually in `src/`, this file defers to the code.

Each of the five parts below covers the chat surface first, then closes with one subsection per additional surface audited — **"Persona surface"** (repo/version/configure), **"Persona shares (Super Links) surface"** (the `/persona-shares/*` sharing feature), **"Pins surface"** (the Pinboard panel, `/pins/*`), **"Highlights surface"** (the Highlights panel, `/highlights`), **"Users surface"** (`/users/*`, mediated by `auth-context.tsx`), **"Stripe (billing) surface"** (`/stripe/*`), **"Projects surface"** (`/projects/*`, mediated by `projects-context.tsx`), **"Connectors surface"** (`/connectors/*` and org connectors), **"Brain surface"** (`/brain/*`), **"Slack surface"** (`/slack/*` and org Slack), **"Automations surface"** (`/automations`, branded "Schedules" in the UI), **"Memory surface"** (`/memory/user`), **"Organizations surface"** (`/organizations/*`, mediated by `org-context.tsx`), **"LLM models surface"** (`/llm/models*`), and **"Team invite surface"** (`/team-invite/*`) — each carrying whatever is genuinely different, a stronger/weaker version of the same finding, or a new one, for that surface. The systemic findings — no Cache Components, no Server Actions, one under-covering error boundary — apply to every surface identically and aren't re-derived per surface; they're stated once, in whichever part they first come up.

This is not a call to rewrite the app in Server Components — the product is a real-time streaming chat client sitting behind Auth0, and the Next.js docs themselves note that `fetch` in a Server Component blocks rendering unless cached or wrapped in `<Suspense>`, which doesn't suit per-user SSE turns. The goal here is narrower: use the pieces of the Next.js/React data model that *do* fit — Client Component caching via a library, and server-fetched initial data for the parts that aren't streaming — and stop re-deriving by hand what's already installed.

---

## Action Items at a Glance

A consolidated index into the findings above, segregated by feature/surface rather than by change type — each surface's own table uses a **Type** column (`Add` / `Remove` / `Fix` / `Improve`) so the four kinds of change are still easy to pick out within it. Every row links back to a section below for the full reasoning and code; this is for triage, not the argument. Rows are roughly ordered by priority within each surface.

### Cross-cutting (not specific to one feature)

Infrastructure shared across every surface — the highest-leverage items, since fixing one row here removes duplication or risk from several surfaces' tables below at once.

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Add | `app/error.tsx`, `app/(app)/error.tsx`, `app/global-error.tsx` | Zero route-level error boundaries anywhere; the one hand-built `<ErrorBoundary>` covers a small fraction of the render tree | Add all three — see Part 5 §2 (F1) for exactly what each one catches that the others can't |
| Add | Shared `usePollUntil()`-style hook (backoff + `AbortSignal` + unmount/popup-closed handling) | The same "open an OAuth flow, poll until done" logic is hand-built three times (Connectors, org-connector-accounts, Slack) at three different quality levels | One hook, ported from `pollConnectorUntilActive`/`startOAuth` (the best of the three) — see Connectors and Slack rows below |
| Add | Empty-body-safe `apiFetchJson` variant (e.g. `apiFetchOk`) in `client.ts` | `apiFetchJson` always calls `.json()`, which breaks on a `204` — forcing 4+ features to hand-roll the same error-parsing workaround, and this exact gap already caused a real shipped bug | See Persona Shares, Projects, Stripe rows below for every affected call site |
| Improve | `/api/chat`, `/api/persona-chat`, `/api/brain-chat` route handlers | Byte-for-byte identical ~25-line SSE pump loop, copy-pasted three times and already drifting | Extract one `streamBackendResponse()` helper (Part 1 §4.2) |
| Improve | `personas.ts` (×3), `current-user.ts`, `connectors.ts`, `persona-cache.ts`, `lib/ai-models.ts` | 8 independently hand-rolled TTL-cache-plus-in-flight-dedupe modules, all solving what `@tanstack/react-query` (already a dependency) solves generically | Migrate each onto `useQuery`; delete the bespoke module once its last direct caller moves off it (Part 3 F2) |
| Improve | `PERSONAS_LIST_UPDATED_EVENT`, `MODELS_CACHE_BUSTED_EVENT`, `BRAIN_THREAD_CREATED_EVENT`/`_TITLE_UPDATED_EVENT`/`_DELETED_EVENT` | 5 separate custom `window` events standing in for cache invalidation across component boundaries | Retire once the underlying data is on `useQuery` — `onSuccess`/`onSettled` replaces all of them |

### Chat

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Improve | `use-chat-history.ts` and siblings (`fetchProjectChats`, `listChatShares`, …) | Hand-rolled `useState`+`useEffect`+dedup-ref per list; `listChats()` alone has 3 independent call sites | Migrate onto `useQuery`/`useInfiniteQuery`, `usePersonas` as the template (Part 1 §4.1) |
| Improve | `use-chat-history.ts`'s `rename`/`delete`/`star` | Hand-rolled optimistic `setState` + manual rollback, repeated 3 times | Migrate onto `useMutation`'s `onMutate`/`onError`/`onSettled`, same pass as the read-side migration (Part 2 F2) |
| Add | Chats sidebar / projects list | Every list view is a pure client-side fetch-on-mount waterfall, no SSR initial data | Server-fetch the first page or hydrate `useQuery`'s cache (Part 1 §4.3) |
| Remove | `stopChat()` (`chat.ts`), `deleteMessage()`, `saveFileToDrive()` | Dead/bypassed wrappers — real calls are inline elsewhere, or zero callers at all | Delete, or wire the wrapper in and delete the inline duplicate (Part 1 §4.4) |
| Remove | `WORKFLOW_CHAT*` family, `CHAT_DELETE_ENDPOINT` (`config.ts`) | Dead constants, no matching backend path | Delete (Part 1 §4.4) |
| Fix | `LeftSidebar.tsx` | Imports two different functions both named `renameChat` — one hits the backend, one is local-state-only | Rename one on import or at its source export (Part 1 §4.4) |

### Persona

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Improve | `fetchPersonas()` | 7 independent call sites, each a separate round trip for the same catalog | Route all seven through `usePersonas()` (Persona surface, Part 1) |
| Add | 5 configure tabs (Instructions/Profile/Knowledge/Connectors/Sharing) | Each independently bootstrap-fetches on mount with no shared cache between tabs | Same `useQuery`-based fix as the chat waterfall, applied per tab |
| Fix | `personas.ts` `updateVersion()` + `instructions/page.tsx`'s `handlePublish()` | Two-request save with no rollback if the second fails; caller clears "unsaved" state before the last of 3 sequential calls resolves | Defer the "clean" state update until the final call succeeds; branch the catch on which step failed (F5) |
| Remove | `PersonaRepo.setWorkingVersion()`/`.publish()`/`.pause()`/`.setVisibility()`/`.delete()`/`.listVersions()` | Six dead class methods, referenced only by their own test | Delete; repoint tests at the live free functions in `personas.ts` (F6) |

### Persona shares (Super Links)

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Add | `OnboardingGuard` | No carve-out for `/share/[id]` — unauthenticated visitors are bounced to login before ever seeing the preview `team-invite` already carves out an exception for | Add the route to the carve-out list, pending a product decision |
| Fix | `revokeShare()` (`persona-shares.ts`) | Hand-rolls `apiFetchJson`'s error-parsing to work around the `204` gap | Repoint at the empty-body-safe variant (cross-cutting table) (F7) |
| Fix | `agents/page.tsx`'s Super Links tab | `listReceived()`/`listShares()`/`fetchDashboard()` failures go to `console.error` only — indistinguishable from "you have none" | Model the failure as a value the same way `share/[id]/page.tsx` already does two files away |
| Remove | `listSent()` (`persona-shares.ts`) | Zero callers | Delete |

### Pins

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `pinboard-context.tsx`'s `updatePinComment` | Fires live network requests *inside* a `setState` updater — Strict Mode double-invokes it | Move the API calls out of the updater into a plain `async` sequence after it (F9) |
| Fix | `pinboard-context.tsx`'s `removePin`/`removePinByMessage`/`updatePinTags`/`updatePinComment` | No rollback on failure (unlike `addPin`/`clonePin` in the same file); two don't even toast | Apply the same rollback-and-toast treatment `addPin`/`clonePin` already use (F8) |
| Remove | `getPin()`, `updatePinTags()` (`pins.ts`) | Zero UI callers despite full wiring | Delete |
| Remove | `CompareModels.tsx`'s `handleSavePin` / unused `PinIcon` import | Never wired to a click handler | Delete |

### Highlights

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Add | Backend: an aggregate "all my highlights" endpoint | `GET /highlights` requires a `chat_id`; frontend compensates with an N-request-per-chat fan-out (60+ requests for a heavy user) | Raise with backend — the one finding a frontend change alone can't fully fix (F10) |
| Improve | `highlight-context.tsx`'s `loadAll()` | No cache over the fanned-out result — re-pays the full fan-out on every toggle/reopen | Cache the result client-side (even a short TTL) until the backend fix lands |

### Users

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Add | `settings/(shell)/account/page.tsx`'s `handleDeleteAccount` | Real "Delete account" button; handler is an empty `// TODO` stub | Build the confirmation dialog and call the already-implemented `deleteUser()` (F11) |
| Fix | `auth-context.tsx` `refreshUser()` | Catch is `console.error` only — no toast, no retry, no exposed flag, despite firing from credit top-ups, Stripe returns, onboarding | Expose an error flag (see `org-context.tsx`'s `roleError` for the pattern) or surface a toast |

### Stripe (billing)

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `BuyCreditsModal.handlePay()` / `chargeTopUp()` | **Top priority in this document.** An SCA-required charge is treated as neither success nor failure, then a second, separate Checkout session opens for the same amount | Detect the status and show an error (minimum), or add `@stripe/stripe-js` + `confirmCardPayment` (F12) |
| Fix | `user.ts` `cancelSubscription()`/`resumeSubscription()`/`chargeTopUp()` | Hand-rolled error throwing bypasses `friendlyApiError` — raw backend text shown for the app's real-money failures | Route through `apiFetchJson` directly (F13) |
| Remove | `stripe.ts`'s `createTopUp()` adapter | Zero callers; real call site uses `createTopUpSession()` directly | Delete |

### Projects

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `setProjectVisibility()` (`projects.ts`) | Hand-rolls the same `204`-workaround as Persona Shares' `revokeShare` — already caused a real shipped bug (a silently-swallowed 403) | Repoint at the empty-body-safe `apiFetchJson` variant once it exists (raises that item's priority) |

### Connectors

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `pollOrgConnectorAccountUntilConnected()` + `AddSharedAccountModal` | No `AbortSignal`, no unmount guard — closing the modal doesn't stop the poll; callbacks can fire on a dismissed component | Port `pollConnectorUntilActive`/`startOAuth`'s `AbortSignal` + unmount/popup-closed handling (F15) |
| Remove | `removeOrgConnector()` (`org-connectors.ts`) | Imported, never called | Delete |
| Remove | `getConnectorUsedBy()` (`org-connectors.ts`) | Fully implemented; the "blast radius" UI it would power was never built | Delete, or build the UI if it's still wanted |

### Brain

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `brain.ts`: `stopBrainChat`, `starBrainChat`, `renameBrainChat`, `deleteBrainChat` | None check `response.ok` — can't reject on an HTTP failure; `deleteBrainChat`'s caller shows "Brain chat deleted" even when the delete failed | Add `if (!response.ok) throw`; `respondToPrompt` in the same file is the pattern to copy (F16) |
| Fix | `brain.ts` `recoverNewestChatId()` | Assumes the newest `listBrainChats()` row is unambiguously the one just created — a real race under concurrent creation | Needs a client-generated identifier, or drop once the CORS gap it compensates for is confirmed fixed |
| Improve | `brain.ts:12` | Locally redefines the `withBase` helper `config.ts` already exports | Import instead of duplicating |

### Slack

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `SlackConnectModal` | No `AbortController` — a status check already in flight when the modal closes can resolve afterward and fire stale callbacks | Same fix as Connectors' F15, folded into the shared poll hook (F17) |

### Automations

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Improve | `LeftSidebar.tsx`'s Brain-schedules status fetch | Smaller-scale N+1 fan-out (one `getAutomation()` per schedule), same root cause as Highlights' F10 | Low priority given current scale; same fix if it ever grows |
| Fix | `automations.ts` `runAutomationNow()` | Throws one fixed generic message, discarding the backend's actual reason | Read `response.text()`/`.json()` before throwing, matching the rest of the file |

### Memory

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `onboarding/import/page.tsx`'s awaited memory-context write | Comment says "errors should be visible"; code doesn't make that true — same root cause as Brain's F16 | Add the `.ok` guard, or switch to `apiFetchJson` (F18) |

### Organizations

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Remove | `deleteOrg()` / `transferOrgOwnership()` (`organization.ts`) | Fully built, no button anywhere calls them | Decide: wire up or delete — don't leave as unverifiable dead weight |
| Remove | `ORG_POOL_CAP_ENDPOINT`, `ORG_POOL_STATUS_ENDPOINT` (`config.ts`) | Dead duplicate constants | Delete |
| Improve | `org-context.tsx`'s `refreshMembers()` | Name implies members-only; it also re-triggers the plan fetch | Rename to reflect real scope, or split into two functions |

### LLM models

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `models.ts` `fetchAllModels()` | Swallows every failure into `[]` — "zero models" and "fetch failed" are indistinguishable to all four callers | Let it throw or return a discriminated result; give model pickers a real error state (F19) |
| Remove | `listModels()` (`models.ts`) | Zero callers; `recent`/`most_used` groupings unused anywhere | Delete |
| Improve | `automations.ts:4` | Same `withBase` duplication as Brain | Import from `config.ts` instead |

### Team invite

| Type | Where | Issue / what's needed | Change |
|---|---|---|---|
| Fix | `onboarding/team/[inviteId]/page.tsx`'s `handleAccept()` | Same shape as Persona's F5 — generic catch message shown even after `acceptTeamInvite()` has already committed real org membership | Treat the invite as accepted once step 1 resolves, regardless of what follows |

---

## Part 1 — Fetching Data

### 1. The stack today

```
config.ts                    → one exported constant/function per backend path
        │
lib/api/*.ts                 → per-domain wrapper functions (chat.ts, personas.ts, brain.ts, projects.ts, …)
        │                       response normalization (Backend*Raw → app types) lives here
lib/api/client.ts             → apiFetch / apiFetchJson (the only place that talks to `fetch` directly
        │                       for non-streaming calls): auth header injection, 401-retry-once,
        │                       friendlyApiError() mapping, typed ApiError
        │
hooks / context               → useState + useEffect + refs, OR (in one place) React Query
        │
components                    → render
```

Streaming is a separate path that bypasses all of the above except `config.ts`: `use-streaming-chat.ts` opens a raw `XMLHttpRequest` directly (needed for real upload-progress events and because a `fetch`-wrapper would consume the stream before the UI can read it), either to a same-origin Next.js Route Handler proxy (`/api/chat`, `/api/persona-chat`, `/api/brain-chat`) or, on deployed origins, straight to the backend.

### 2. Next.js guidance vs. current practice

| Next.js recommends | Current practice | Verdict |
|---|---|---|
| Server Components fetch with `fetch`/ORM, cached via `use cache` or streamed via `<Suspense>` | Every page under `app/(app)/**` that shows a list (chats, projects, personas, shares) is a Client Component that fetches in a `useEffect` on mount | **Not used anywhere** — see [§4.3](#43-medium--every-list-view-is-a-client-side-waterfall-with-no-initial-data) |
| Client Components: React's `use()` API, or a community cache library (SWR / React Query) for non-streamed data | `@tanstack/react-query` v5 is installed and has a `QueryProvider` mounted — but only one hook (`usePersonas`) actually uses it. Every other list/detail GET (chats, messages, projects, brain threads, shares) is hand-rolled `useState`/`useEffect` | **Partially used, inconsistently** — see [§4.1](#41-high--react-query-is-already-adopted-and-then-mostly-ignored) |
| `React.cache()` / request memoization so sibling components don't refetch the same data | No memoization layer; the same `listChats()` call is issued independently by the sidebar, the highlight/search indexer, and the project "add existing chat" picker, each with its own `useEffect` | Same as above — a `useQuery` cache fixes this for free |
| Parallel fetching via `Promise.all` when requests are independent | N/A — most reads here are single-endpoint list calls, not the artist/albums-style parallel case the guide illustrates. No sequential-fetch anti-pattern of that shape was found. | Not applicable |
| Route Handlers stream a body straight through (`new Response(upstreamBody, ...)`) | The generic proxy (`/api/backend/[...path]/route.ts`) does exactly this. The three purpose-built proxies (`/api/chat`, `/api/persona-chat`, `/api/brain-chat`) instead manually pump `backendReader.read()` into a hand-built `ReadableStream` | **Redundant, three times over** — see [§4.2](#42-high--three-copies-of-the-same-sse-proxy-plumbing) |

---

### 3. Findings

### 4.1 (High) — React Query is already adopted, and then mostly ignored

[`src/lib/queries/personas.ts`](../../src/lib/queries/personas.ts) wraps `fetchPersonas()` in `useQuery`, and [`src/components/QueryProvider/index.tsx`](../../src/components/QueryProvider/index.tsx) mounts a `QueryClient` with a 30s `staleTime`. This is exactly the Next.js-recommended pattern for Client Component data fetching. It gives, for free: request dedup across components, cache-hit-no-refetch on remount, background revalidation, and a single invalidation call (`queryClient.invalidateQueries`) instead of a bespoke event bus.

None of that machinery is used for the other list/detail reads that share the same shape:

- **Chats list** — `use-chat-history.ts:36-80` hand-rolls: a `useState<Chat[]>`, a cursor `useRef`, a `loadingRef` re-entrancy guard, a manual "skip IDs already in `prev`" dedup on every page, and a **separate** `refreshInFlightRef` map (`use-chat-history.ts:46-49`) purpose-built to stop two staggered title-refresh timers from firing duplicate `listChats()` calls. A `useQuery` with `queryKey: ["chats", cursor]` (or `useInfiniteQuery` for the cursor pagination) removes the re-entrancy guard, the dedup map, and the manual `prev`-merging in one move — in-flight request dedup is `useQuery`'s baseline behavior.
- **`listChats()` is independently called** from `use-chat-history.ts` (sidebar), `context/highlight-context.tsx` (search index), and `app/(app)/project/[id]/page.tsx` ("add existing chat" picker) — three separate network round trips for the same data, on every mount, per [chat-endpoints-usage.md §1](./chat-endpoints-usage.md#1-regular-chats-chats). A shared `useChatsQuery()` collapses these to one request, cached and shared.
- Same shape again for `fetchPersonaChats` (`personas.ts`), `fetchProjectChats` (`projects.ts`), `listBrainChats`/`getBrainMessages` (`brain.ts`), and `listChatShares`/`listSharedWithMe` (`chat-shares.ts`) — each has its own hand-written loading/error `useState` pair.

**Recommendation:** migrate GET-and-cache reads (not the SSE stream itself, which stays on the XHR path) onto `useQuery`/`useInfiniteQuery`, keeping the existing `lib/api/*.ts` functions unchanged as the `queryFn`. `usePersonas` is the template to copy — it proves the migration doesn't touch the fetch/normalization layer, only how components subscribe to the result. Do the highest-traffic one (chats list) first since it's currently fetched from three separate call sites.

### 4.2 (High) — Three copies of the same SSE proxy plumbing

`app/api/chat/route.ts:134-160`, `app/api/persona-chat/route.ts:117-139`, and `app/api/brain-chat/route.ts:107-129` each contain **the same** hand-rolled pump loop:

```ts
const backendReader = backendResponse.body.getReader()
const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
    try {
      while (true) {
        const { value, done } = await backendReader.read()
        if (done) { try { controller.close() } catch {}; break }
        controller.enqueue(value)
      }
    } catch { try { controller.close() } catch {} }
  },
  cancel() { backendReader.cancel().catch(() => {}) },
})
return new Response(stream, { headers: responseHeaders })
```

byte-for-byte identical across all three files, plus duplicated response-header setup (`Cache-Control`, `X-Accel-Buffering`, `X-Chat-Id` forwarding) and duplicated `maxDuration = 800` / error-logging boilerplate. The comment in `persona-chat/route.ts:7` ("Matches the `/api/chat` proxy's ceiling — see that file") is itself an admission that these three are meant to stay in lockstep, which copy-paste doesn't guarantee — the FormData field-handling has already started to diverge between them (e.g. `brain-chat` never validates `input.trim()`, unlike the other two).

The general-purpose proxy one directory over, `app/api/backend/[...path]/route.ts:109-113`, shows this loop is unnecessary in the first place:

```ts
return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders })
```

A `ReadableStream` body can be handed straight to `Response` — no manual `getReader()`/`enqueue()` pump needed, and no backpressure lost to a loop that reads as fast as possible regardless of whether the browser is consuming it. The only reason the three chat proxies can't just do this too is that they need to *rebuild* the outgoing request (FormData field renaming, auth header injection) before forwarding — the pass-through only applies to the response half, which needs no transformation at all in any of the three.

**Recommendation:** extract a shared `streamBackendResponse(backendResponse, extraHeaders?)` helper (e.g. in `src/lib/api/proxy.ts`) that does the `X-Chat-Id`-forwarding + header setup + `return new Response(backendResponse.body, ...)` once, and call it from all three routes. This deletes ~90 duplicated lines and means a future fix (e.g. surfacing upstream disconnects, adding a heartbeat) is written once.

### 4.3 (Medium) — Every list view is a client-side waterfall with no initial data

`use-chat-history.ts:78-80`:

```ts
useEffect(() => {
  loadChats(true);
}, []);
```

This pattern — render empty/loading state, mount, fire the fetch, wait for the round trip, paint real data — is the exact case the Next.js docs' Server Components section is written to avoid: *"fetch requests are not cached by default and will block the page from rendering until the request is complete... wrap the fetching component in `<Suspense>` to stream fresh data at request time."* Right now the app gets neither: no server-rendered initial data, and no `<Suspense>` boundary — just a spinner on every navigation to `/chats`, `/projects`, etc.

The pieces to fix this already exist elsewhere in the codebase: every Route Handler in `app/api/*/route.ts` shows the pattern for resolving the Auth0 token server-side (`auth0.getAccessToken({ audience })`). The same call, made from a Server Component (`page.tsx`) instead of a Route Handler, can fetch the first page of chats/projects/personas server-side and either (a) render it directly for the parts that don't need client interactivity, or (b) hand it to `useQuery`'s `initialData` / React Query's `HydrationBoundary` so the client cache is warm before the component mounts — eliminating the loading flash without giving up client-side refetching, pagination, or the streaming chat interactions layered on top.

**Recommendation:** treat this as the natural follow-on to §4.1, not a separate effort — once a list is on `useQuery`, hydrating it from a server-fetched initial value is a small addition, not a rewrite. Prioritize the chats sidebar and the projects list (highest-traffic first paints); leave message history and SSE-driven views as client-only, since they're inherently per-turn and not helped by SSR.

### 4.4 (Medium) — Known endpoint-usage drift (carried from the endpoint audit)

[chat-endpoints-usage.md](./chat-endpoints-usage.md) already documents these; listed here because they're the same class of "backend endpoint wired up incorrectly" issue this doc is about:

- `stopChat()` (`chat.ts`) and `stopPersonaChat()` (`personas.ts`) are dead wrappers — the endpoints they wrap are actually hit via inline `apiFetch(...)` calls elsewhere, bypassing the named function entirely. Either call the wrapper from the inline site, or delete the wrapper — not both existing.
- `deleteMessage()`, `saveFileToDrive()`, `removePersonaMessage()` are fully wired (config constant + wrapper) but have zero UI call sites.
- `GET /chats/{chat_id}/browser/live` has no frontend representation at all.
- `LeftSidebar.tsx` imports two functions both named `renameChat` — one from `lib/api/chat.ts` (hits the backend), one from `projects-context.tsx` (local state only) — same name, different effect, in the same file's import list.
- `config.ts` defines a full `WORKFLOW_CHAT*` endpoint family and a separate `CHAT_DELETE_ENDPOINT` with zero call sites and no matching backend path in `devapi.json`.

None of these need a Next.js pattern change — they're cleanup: delete the dead code, or wire the wrapper in and delete the inline duplicate.

---

### 4. What's already right (don't change)

- **`apiFetchJson`/`apiFetch` (`client.ts`)** — this is the correct place for auth-header injection, 401-retry, and error normalization, and it sits *below* whatever fetches on top of it (React Query included) without conflicting with it. Migrating hooks to `useQuery` keeps this function as the `queryFn`'s implementation, unchanged.
- **The generic backend proxy (`/api/backend/[...path]/route.ts`)** — correct use of `runtime: "nodejs"` (needed for the streaming request body / `duplex: "half"`), explicit hop-by-hop header stripping, and the direct `Response(upstream.body)` passthrough this doc recommends the other three proxies adopt.
- **Direct-to-backend streaming on deployed origins** (`shouldUseDirectBackend()` in `use-streaming-chat.ts`) — deliberately skips the Vercel proxy hop to dodge its stream-duration/body-size limits; correctly gated on `chatOwnershipConfirmed` so it doesn't take the direct path for a chat it hasn't confirmed the user can access.
- **XHR instead of `fetch` for the streaming send** — justified in-code (`use-streaming-chat.ts:206-209`): real upload-progress events and reading the stream incrementally without a wrapper consuming it first. Not a candidate for `apiFetch`.

---

### 5. Persona surface

Same three-layer stack as chat (`config.ts` → `personas.ts` wrapper functions → `apiFetch`/`apiFetchJson`), with the same class of findings showing up harder here than for chat.

**Five configure tabs each independently bootstrap-fetch on mount — a wider version of §4.3.** Instructions, Profile, Knowledge, Connectors, and Sharing (`app/(app)/agent/configure/{instructions,profile,knowledge,connectors,sharing}/page.tsx`, e.g. `SharingTab.tsx`) each run their own `useEffect` fetching the repo, the resolved version, and (for Instructions) the model list — with no server-fetched initial data and no shared cache between tabs, so switching tabs re-fetches state a sibling tab may have just loaded. `instructions/page.tsx` alone carries over 20 `useState` fields for one tab's form/loading state (`isInitialising`, `isSaving`, `isPublishing`, `isDeletingOldest`, plus every form field individually). Same client-waterfall pattern as §4.3, multiplied across five tabs instead of one sidebar list.

**`fetchPersonas()` has at least seven independent call sites** — per [persona-endpoints-usage.md §B](./persona-endpoints-usage.md#b-persona-repo-crud): `agents/page.tsx`, `LeftSidebar.tsx`, `search-context.tsx`, `highlight-context.tsx`, `brain/page.tsx`, `ProjectAgentsPanel/index.tsx`, and `lib/chat-personas.ts`, on top of the one that already goes through `usePersonas()`. This is a stronger version of §4.1's `listChats()`-called-three-times finding: the case for routing all seven through `usePersonas()` instead of the raw function is even more direct here, since several of these call sites can be mounted simultaneously in the same authenticated shell (e.g. the sidebar's Agents section and the command-palette index).

**Good pattern, worth crediting: the guide and test-chat SSE streams don't need a bespoke Route Handler.** `guidePersonaStream()` and `testVersionStream()` (`personas.ts:1390`, `personas.ts:1280`) call `apiFetch()` directly — the same client wrapper as every non-streaming call — and decode the response with the *same* shared `AguiSSEDecoder` that `use-streaming-chat.ts` uses for the main chat stream (via a `readPersonaSSEStream()` helper that only differs in how it dispatches decoded events, not in how it parses the wire format). Unlike chat/persona-chat/brain-chat sends, these two never need a server-side FormData rebuild — the guide call is plain JSON, and the test-chat call's FormData is already complete on the client — so they ride `apiFetch`'s existing `API_BASE_URL` resolution (the same `/api/backend/[...path]` catch-all proxy on localhost, direct-to-backend on deployed origins) with no dedicated proxy route at all. This is incidentally why §4.2 only found three bespoke SSE proxies to consolidate rather than five: the other two never needed one.

### Persona shares (Super Links) surface

Cross-referenced against [persona-shares-endpoints-usage.md](./persona-shares-endpoints-usage.md) — all 8 `/persona-shares/*` endpoints, wrapped by `src/lib/api/persona-shares.ts`.

**Good pattern, worth crediting: this is the one confirmed real use of `Promise.all` for independent parallel fetches.** §2's table row for chat says no sequential-fetch anti-pattern was found, but also that no genuine parallel-fetch case was found either. This surface has one: `agents/page.tsx`'s Super Links tab activation effect fires `Promise.all([fetchDashboard(slDays), fetchPersonas()])` (`agents/page.tsx:675`) rather than awaiting them one after another — exactly the docs' own `getArtist`/`getAlbums` pattern, done correctly.

**A real candidate for Server Component + `notFound()` — the one place in this app where that pattern would fit and pay off.** `app/(app)/share/[id]/page.tsx` is a `'use client'` page that, on mount, does exactly one thing before any interaction: fetch a share preview by ID and render it, or render a 404/410/error state (`getSharePreview(id)` in a `useEffect`, mapping `ApiError.status` to a hand-rolled `'not_found' | 'expired' | 'error'` page state — `share/[id]/page.tsx:69-91`). Unlike chat or the configure tabs, there's no streaming, no per-user session-dependent content, and no ongoing interactivity in the read half — it's a one-shot "look up this ID, show a preview or a 404" page, which is close to verbatim the docs' own `notFound()`/`not-found.tsx` example (§ Part 5). A Server Component here would remove the loading-skeleton flash (the page's *only* content on first paint today) and let the preview render before any client JS runs.

That last point isn't hypothetical: **`app/(app)/layout.tsx`'s `OnboardingGuard` redirects every unauthenticated visitor to the login page before this page's `{children}` ever renders** (`OnboardingGuard.tsx:16-19` — `if (!isAuthenticated) { window.location.href = AUTH_LOGIN_ROUTE; return }`), with no carve-out for `/share/*` analogous to the one it explicitly makes for team invites two lines later: *"Let an un-onboarded invitee reach their invite link (mirrors proxy.ts) so the invitation popup renders instead of bouncing them into onboarding"* (`OnboardingGuard.tsx:22-24`). The share-preview UI is visibly built to be shown *before* signup — it displays the sharer's name and email, the agent's prompt/model/credits, and an "Accept & copy agent" CTA, i.e. it's trying to sell an anonymous recipient on signing up. Today, anyone who isn't already logged in never sees any of that; they're bounced to `/auth/login` first. Given the guard makes an explicit exception for the structurally identical team-invite case, the absence of one here reads as an oversight rather than a deliberate choice — worth confirming with product, since the fix (add `/share` to the guard's carve-out list, or move the preview fetch to a Server Component that renders before any client guard mounts) is small either way.

**Inconsistent error handling for the same wrapper functions across call sites.** `share/[id]/page.tsx` carefully maps every failure mode of `getSharePreview`/`acceptShare` to a specific UI state (404 → "Link not found", 410 → "expired", 402 → a specific credits-exhausted toast). By contrast, `agents/page.tsx`'s Super Links tab calls `listReceived()`, `listShares()`, and `fetchDashboard()` with `.catch(console.error)` and nothing else (`agents/page.tsx:680`, `:703`, `:714`) — a failure there leaves the dashboard/received-shares section silently empty, indistinguishable from "you have none." Not urgent, but worth aligning: the pattern already exists two files away.

**One dead wrapper, same class as elsewhere:** `listSent()` (`persona-shares.ts:179`) — defined, zero call sites, per [persona-shares-endpoints-usage.md](./persona-shares-endpoints-usage.md).

### Pins surface

Cross-referenced against [pins-endpoints-usage.md](./pins-endpoints-usage.md). Almost every consumer goes through `src/context/pinboard-context.tsx` rather than importing `lib/api/pins.ts` directly, and that file turns out to be the best-engineered data layer in the app — worth reading in full before touching it.

**Good pattern, worth crediting: the most complete stale-while-revalidate implementation in the codebase.** `pinboard-context.tsx:17-59` layers an in-memory cache over a `localStorage` snapshot (`sb_pinboard_v1`) with a 60s TTL, and its mount effect (`:220-231`) applies a fresh-enough cached snapshot synchronously before deciding whether to revalidate in the background — while still starting both SSR and the first client render from the same empty-array defaults to avoid a hydration mismatch (`:146-148`). It's also the third confirmed correct use of `Promise.all` for independent parallel work in this app (after the Super Links dashboard finding above): `load()` fetches `listPins()`/`listPinFolders()` together (`:176`), and `RightSidebar.tsx`'s `handleMoveToFolder` batches a multi-pin folder move the same way (`RightSidebar.tsx:185`). This is what the React Query migration recommended elsewhere in this doc is aiming to generalize — see Part 3's note on why this particular cache is the one exception worth leaving alone for now.

**Known dead code, same class as §4.4:** per [pins-endpoints-usage.md](./pins-endpoints-usage.md) — `getPin()` (defined, zero callers; individual pins hydrate from the already-loaded list instead), `updatePinTags()` (fully wired end-to-end — context action, optimistic update, API call — but no UI control ever calls it), and a second, unreachable call site for `createPin` in `CompareModels.tsx`'s `handleSavePin` (never wired to an `onClick`, its `PinIcon` import never rendered).

### Highlights surface

Cross-referenced against [highlights-endpoints-usage.md](./highlights-endpoints-usage.md) — a tiny surface (3 endpoints, zero dead code) entirely mediated by `src/context/highlight-context.tsx`, but it contains this doc's single highest-severity fetching finding.

**F10 (High) — "Load all highlights" fans out into one HTTP request per chat the user has, with no cache and no backend support for the aggregate query.** The backend's `GET /highlights` requires a `chat_id` — there's no cross-chat listing endpoint — so `collectAllChatIds()` (`highlight-context.tsx:87-104`) pages through the user's *entire* `listChats()` result, fetches every persona via `fetchPersonas()`, then calls `fetchPersonaChats()` once per persona to build a full chat-ID set; `loadAll()` (`:141-152`) then calls `getHighlights(id)` **once per ID in that set, in parallel**. For a user with, say, 60 regular/project chats across 5 agents, one click on the panel's "All chats" filter issues on the order of 65+ concurrent requests — and does it again, from scratch, every single time the filter is toggled back to "All chats" or the panel is reopened, since none of this is cached anywhere. Per-item failures are individually swallowed (`.catch(() => [])`, `:99` and `:148`) specifically so one inaccessible/deleted chat doesn't blank the whole result — a deliberate, reasonable defensive choice — but it doesn't change the request-count problem underneath it. This is a frontend workaround for a real backend gap (no bulk/aggregate endpoint), not something `useQuery` alone fixes: the fix that actually reduces request volume is a backend "all my highlights" endpoint; until then, the front-end-only mitigation is caching the fanned-out result (Part 3's Highlights subsection) so repeat toggles don't re-pay the full fan-out cost.

**Good pattern, worth crediting: the only confirmed use of `AbortController` to cancel a superseded fetch, rather than just ignoring the new one.** `loadForChat`/`loadAll`/`clearHighlights` (`:126-160`) all abort the previous in-flight request via a shared `loadAbortRef` before starting the next — correct behavior for a user who switches chats faster than the network responds. Contrast with `use-chat-history.ts`'s `loadingRef` guard (§4.1), which instead just drops a new call while one is in flight — that's fine for a mount-once list load, but wouldn't handle rapid chat-switching the way this does.

### Users surface

Cross-referenced against [users-endpoints-usage.md](./users-endpoints-usage.md). This surface's fetching side is almost entirely the `currentUser` singleton already named in §3 F2 — nothing new to add to that count — but reading `auth-context.tsx` in full surfaces two deliberate, well-documented decisions worth crediting, since this is the most heavily-relied-upon of the seven hand-rolled caches (virtually every gated route depends on it).

**Good pattern, worth crediting: a documented, deliberate fix for the exact "dependency causes a refetch loop" failure mode the docs warn about.** The profile-load effect in `auth-context.tsx` (`:299-313`) depends on `[isHydrated]` only, with an explicit comment explaining that including `jwtToken` — which changes every 30s via the proactive token-refresh timer (`:228-238`) — would fire a fresh `GET /users/me` every half-minute. `isHydrated` flips exactly once, and the token is already set in the same React batch by the time this effect runs, so the omission is safe, not an oversight. `current-user.ts:67-68`'s fetch path has a matching decision: a failed refresh keeps the last good profile rather than blanking the app on a transient error — the same "don't let a transient failure erase good data" reasoning as Pins' `load()` (Part 1's Pins subsection) and Highlights' per-chat `.catch()` (Part 1's Highlights subsection), independently arrived at a third time.

### Stripe (billing) surface

Cross-referenced against [stripe-endpoints-usage.md](./stripe-endpoints-usage.md) — 8 endpoints, all live, wrapped in `src/lib/api/user.ts` with a thin re-export layer in `stripe.ts`. Real-money mutations raise the stakes on findings that would otherwise be minor elsewhere; see F12 and F13 in Parts 2 and 5.

**F14 (Medium) — The three "returned from Stripe" confirmation pages fetch billing state once, immediately, with no retry — racing the backend's asynchronous webhook.** `settings/(shell)/billing/confirmation/page.tsx:52-65` (and its `onboarding/pricing`/org-plans equivalents) fires `refreshUser()`, `fetchBilling()`, and `refreshMembers()` in an unawaited, un-retried mount effect the moment the page renders, with a comment explicitly calling it "fire-and-forget." The success heading itself is safe — it's driven by the `plan`/`type` query params Stripe's `success_url` redirect sets, not by whether the refetch succeeded or returned fresh data — so a user is never told "success" incorrectly. But if the backend's Stripe webhook hasn't landed yet (a normal, expected delay, not a failure), this one-shot fetch can return pre-payment data, and nothing here retries or polls until it changes. The window is self-correcting (the next `credits:updated` trigger, the 30s token-refresh-adjacent paths, or a reload will pick up the right state), so this is a rough edge, not data loss — but it's the one place in the app where "the fetch technically succeeded, just with stale data" is most likely to be visible to a paying customer right after they pay.

**Known dead code, same class as elsewhere:** `stripe.ts`'s `createTopUp({ amount_usd })` object-arg adapter — has zero callers; every real top-up-session call site uses the raw `createTopUpSession()` from `user.ts` directly instead, even though its sibling adapters (`createCheckout`, `chargeTopUp`) are both genuinely used elsewhere.

### Projects surface

Cross-referenced against [projects-endpoints-usage.md](./projects-endpoints-usage.md) — 11 endpoints, all live, mediated by `src/context/projects-context.tsx`. This is the third fully-engineered context in the document (alongside Pinboard and Highlights), and it's the strongest one yet on the fetching side specifically — no new bug to report here, but two patterns worth recording as reference-quality examples.

**Good pattern, worth crediting: the one confirmed correct use of `Promise.allSettled` in this app, exactly where the docs recommend it.** `loadProject()`'s background file-size enrichment (`projects-context.tsx:358-390`) HEAD-requests every document's file URL that's missing a size from both the server response and the `localStorage` cache, using `Promise.allSettled` — not `Promise.all` — specifically so one file's failed HEAD doesn't discard every other file's successfully-resolved size. This is the docs' own caveat about `Promise.all` ("if one request fails, the entire operation fails... use `Promise.allSettled`") applied precisely where it matters, rather than the `.catch(() => [])`-per-item workaround this app uses everywhere else (Highlights' `collectAllChatIds`, this doc's chat-shares fan-outs) to get the same effect. These HEAD requests correctly bypass `apiFetch` entirely — they're plain cross-origin requests to file-storage URLs, not backend API calls, so none of `apiFetch`'s auth-header/401-retry machinery is relevant, and not using it here is the right call, not an inconsistency.

**Good pattern, worth crediting: a hand-solved instance of exactly the race `React.cache`/request memoization exists to prevent.** The bootstrap effect (`:234-260`) explicitly accounts for `loadProject()`'s detail fetch resolving *before* the list-fetch it's not sequenced against, using a functional `setProjects` updater that preserves already-loaded detail (instructions, files) instead of overwriting it with the leaner list-summary shape when both land. There's no `React.cache`-equivalent available on the client to prevent the race automatically (that API is Server-Component-only), so this merge logic is the correct client-side substitute — worth pointing to as the template if a similar dual-fetch race shows up while doing the `useQuery` migrations recommended elsewhere in this document.

**Minor, not quite dead code:** `createProjectApi`'s `files`/`teamId` parameters (`projects.ts`) are fully typed and wired but never populated by the single real call site (`projects/new/page.tsx` only ever passes name + description) — every project starts private with no files, and sharing/upload both happen as separate follow-up actions. Not worth a cleanup pass on its own; noted per [projects-endpoints-usage.md](./projects-endpoints-usage.md) for completeness.

### Connectors surface

Cross-referenced against [connectors-endpoints-usage.md](./connectors-endpoints-usage.md) — 15 endpoints, 13 live, mediated by `connectors.ts` (personal) and `org-connectors.ts` (org). This surface introduces a pattern not seen elsewhere in the document — OAuth-popup-plus-polling — and it's been built twice, once carefully and once without carrying the lessons over.

**Good pattern, worth crediting: the most carefully-reasoned async flow in this document.** `pollConnectorUntilActive()` (`connectors.ts:373-399`) polls with exponential backoff (2s → doubling → capped at 30s) against a hard 120s deadline, fully wired to an `AbortSignal`. Its caller in `settings/(shell)/connectors/page.tsx` (`startOAuth`, `:774-896`) goes further: it tracks component-unmount via an `abortedRef` that aborts the poll on cleanup, and — the standout detail — explicitly does **not** treat a closed OAuth popup as a cancellation. A code comment explains why: *"With Pipedream the hosted connect page often stays open on a 'success' screen that the user closes by hand, and the backend needs a moment to register the account after the OAuth callback. So a closed popup is NOT treated as a cancellation: we abort the long poll and run a short final check against the backend."* That's a real, hard-won product insight encoded correctly in the control flow, with a `settled` flag preventing the long poll and the popup-closed grace-check from racing each other to resolve twice.

**F15 (High) — The near-identical org-connector-account poller was rebuilt without the cancellation half of that design, and its caller has no unmount guard.** `pollOrgConnectorAccountUntilConnected()` (`org-connectors.ts:208-230`) is structurally the same function — same exponential backoff, same 120s deadline — with no `signal`/`AbortSignal` parameter at all: nothing in its options type, no abort check in the loop, and its delay `Promise` has no rejection path. Its only call site, `connectors/page.tsx`'s `AddSharedAccountModal` (`:1279-1313`), has no `abortedRef`-style unmount guard either, and — unlike `startOAuth`'s popup-closed handling above — no popup-closed detection of any kind. Concretely, this means: closing the modal mid-poll doesn't stop it (the `await` keeps running in the background for up to 120s, then calls `setPolling(false)`, `popup?.close()`, `onCreated()`, and `onClose()` against a component that may no longer be mounted); closing the OAuth popup early gives no shortcut to a grace-period recheck, only a full-timeout wait; and starting a second poll (e.g. retrying) can't cancel a still-running first one. The timeout path's error copy is honest about the resulting ambiguity (*"OAuth flow timed out. The account was created; refresh the account list after finishing auth"*) — a good, appropriately-hedged message — but that's a symptom of the missing cancellation, not a substitute for it. **Recommendation:** port the `signal`/`AbortSignal` parameter and the popup-closed grace-check from `pollConnectorUntilActive`/`startOAuth` onto this function and its caller; they're solving the same problem and should share the same design, not two divergent ones.

**Minor nit, even in the well-built version:** `pollConnectorUntilActive`'s own `await getConnector(slug)` call doesn't forward the poll's `AbortSignal` into the underlying request — `getConnector()` takes no `signal` parameter at all — so aborting mid-poll doesn't cancel a request already in flight, only the next scheduled wait. The overall abort still works correctly (the loop exits, the promise rejects), this just leaves one discarded in-flight request per abort rather than a true cancel. Low severity; noted for completeness given F15's fix will otherwise be tempted to copy this detail along with everything else worth copying.

### Brain surface

Cross-referenced against [brain-endpoints-usage.md](./brain-endpoints-usage.md) — 8 endpoints, all live, wrapped in `src/lib/api/brain.ts`. This file is a mix of the best and weakest patterns found in this document; see F16 in Part 2 for the headline issue.

**Good pattern, worth crediting: an explicit, well-reasoned idle-stream watchdog not present in any of the other three SSE consumers.** `consumeBrainStream()` (`brain.ts:422-484`) re-arms an 800-second idle timer on every chunk and cancels the reader if the server goes silent longer than that — with a code comment explaining the number isn't arbitrary (it has to tolerate extended-thinking turns, slow tools, and multi-page document processing legitimately producing zero events for tens of seconds, while still catching a truly wedged connection). It also correctly distinguishes a watchdog-triggered cancellation from a genuine fetch error via a `timedOut` flag, so the two paths don't double-report. `use-streaming-chat.ts` and `personas.ts`'s `readPersonaSSEStream` have no equivalent explicit idle detection — worth considering whether this watchdog pattern should be pulled into the shared decoder layer rather than living only here.

**A narrower, lower-severity race than F10/F15, worth noting for the same underlying reason.** `startBrainChat()`'s fallback for a missing `X-Chat-Id` response header — `recoverNewestChatId()` (`brain.ts:574-592`) — assumes the just-created chat is unambiguously `listBrainChats()`'s first (newest) row. Under concurrent chat creation (two tabs, a double-click before the first request resolves, or simply another Brain chat being created by anything else in that window), "newest" isn't guaranteed to be "the one this call just created," and there's no client-generated identifier to disambiguate. The header gap this compensates for is described as an "older-backend... hotfix," so the blast radius may already be shrinking, but the fallback itself has no safeguard against misattribution if it's still reachable. On its own failure path, it returns `''`, which means the caller can end up with a fully-streaming SSE response and no chat id to route it by.

**Minor DRY nit, now confirmed as a pattern rather than a one-off:** `brain.ts` defines its own `withBase = (path) => \`${API_BASE_URL}${path}\`` (`:12`) — a byte-for-byte duplicate of `config.ts`'s own `withBase`, which `brain.ts` already imports `API_BASE_URL` from but not this helper. `src/lib/api/automations.ts:4` (see the Automations surface below) has the exact same one-line duplicate. Two independent files reinventing the identical helper instead of importing it is worth a five-minute fix — export `withBase` from `config.ts` and import it in both.

### Slack surface

Cross-referenced against [slack-endpoints-usage.md](./slack-endpoints-usage.md), with one caveat stated up front: that doc's own headline finding is that **7 of the 11 live Slack wrappers target backend paths absent from the current OpenAPI spec** — a real, flagged discrepancy, but a backend-documentation/API-contract issue, not a Next.js fetching/mutating/caching/revalidating/error-handling pattern. It doesn't map onto this document's five-part structure, so it isn't repeated here — it's mentioned only because it means these seven wrappers' behavior can only be verified by reading `slack.ts` and its callers directly, not cross-checked against a documented contract, which is exactly what the rest of this subsection did.

**F17 (Medium) — This is the third independent implementation of "open an external OAuth flow, then poll until it completes," and it lands at a different point on the same quality spectrum as F15's two.** `SlackConnectModal` (`components/SlackConnectModal/index.tsx:102-134`) opens the Slack install URL in a new tab and polls `getOrgSlackStatus`/`getSlackStatus` on a **fixed** 3-second interval (no backoff) against a 3-minute timeout. Unlike the org-connector-account poller (F15's worse case), it does correctly stop polling on modal-close or unmount (`useEffect` at `:92-100` returns `stopPolling` as its cleanup) — so it doesn't share F15's worst symptom. But like `pollConnectorUntilActive`'s own minor nit (Part 1's Connectors subsection), it has no `AbortController`: `clearInterval`/`clearTimeout` stop *future* ticks, not a status check already in flight the moment the modal closes, so a poll that was mid-request when the user closed the modal can still resolve afterward and fire `setConnecting(false)`/`toast.success('Slack connected')`/`onConnected?.()`/`onClose()` against a component the user has already dismissed. Lower severity than F15 (no destructive action is misreported, just a stray success toast after the fact), but it's now the third build of the same async pattern, each with a different subset of the same three concerns handled (backoff, abort, unmount-safety) — a strong case for extracting one shared `usePollUntil()`-style hook that gets all three right once, rather than a fourth feature needing this same pattern rebuilding it from scratch again. **Recommendation:** fold this into F15's roadmap item — the fix is the same shared utility, just with three call sites to migrate instead of two.

### Automations surface

Cross-referenced against [automations-endpoints-usage.md](./automations-endpoints-usage.md) — 5 endpoints ("Schedules" in the UI), all live, wrapped in `src/lib/api/automations.ts`. A small, mostly-clean surface with one genuine echo of a finding already made elsewhere.

**A second, smaller-scale instance of F10's N+1 fan-out.** `LeftSidebar.tsx`'s Brain-schedules section (`:2397-2417`) calls `listAutomations()`, then — because "per-task run history isn't on the list payload" — fans out `Promise.all(tasks.map(task => getAutomation(task.id)))`, one `GET /automations/{id}` per schedule, just to compute a status dot/badge for the sidebar. Same root cause as Highlights' F10 (no bulk endpoint returns everything the UI needs in one call, so the frontend compensates with N parallel per-item GETs), at a much smaller likely scale (schedules are a deliberately-created resource, not "every chat you've ever had") and with one real mitigation F10 lacks: a `brainTasksFetchedRef` guard means this only fires once per mount, not on every re-render or filter toggle. Not urgent given the scale, but worth watching if "Schedules" usage grows — the fix, if ever needed, is the same one recommended for F10: either a bulk endpoint or a cached result.

### Memory surface

Cross-referenced against [memory-endpoints-usage.md](./memory-endpoints-usage.md) — the smallest surface in this document: one endpoint, `POST /memory/user`, called with no dedicated wrapper at all, directly via `apiFetch` from two onboarding pages. Nothing to add on the fetching side; see F18 in Part 2 for the one real finding here.

### Organizations surface

Cross-referenced against [organizations-endpoints-usage.md](./organizations-endpoints-usage.md) — 25 endpoints, mostly mediated by `org-context.tsx`'s `useOrg()`. This is the largest dead-code cluster found in this document (9 of 25 not reachable today) and, separately, the single best-engineered permission/role-resolution logic found in it — see Part 5 for the latter.

**Known dead/unreachable surface, consolidated rather than itemized per-endpoint (full detail in the linked doc):** the 4 `/organizations/{id}/connections...` endpoints have zero frontend implementation at all (a distinct concept from the fully-built `/connectors` endpoints — easy to confuse when reading the spec); `GET .../members/admins`, `.../members/regular`, and `.../plan/enterprise-usage` are all unimplemented because the UI derives the same data client-side from endpoints it already calls (`listMembers()` filtered by role; `GET /plan`'s bundled fields); and `ORG_POOL_CAP_ENDPOINT`/`ORG_POOL_STATUS_ENDPOINT` are dead duplicate `config.ts` constants pointing at paths a different, live constant/response field already covers. None of this needs a Next.js pattern change — it's the same class of cleanup as §4.4, just a larger cluster.

### LLM models surface

Cross-referenced against [llm-endpoints-usage.md](./llm-endpoints-usage.md) — 4 endpoints, 2 live through their wrapper, 1 live via an inline bypass (`testModels()` — the same dead-wrapper-live-endpoint shape as `stopChat`/`stopPersonaChat` in §4.4), 1 fully dead (`listModels()`, its `recent`/`most_used` groupings never surfaced anywhere).

**F19 (Medium) — `fetchAllModels()` swallows every failure into an empty array, making "no models available" and "the fetch failed" indistinguishable, for one of the app's more central UI surfaces.** `models.ts:60-69`:

```ts
export async function fetchAllModels(): Promise<GetModelsWithStatus[]> {
  try {
    const res = await apiFetch(MODELS_ALL_ENDPOINT, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as GetModelsWithStatus[]) : [];
  } catch {
    return [];
  }
}
```

A non-2xx response and a thrown network exception both resolve to `[]`, with no way for any of its four independent callers (`AiModelsView`, `agents/page.tsx`, `PersonaChatInterface.tsx`, `TopBar.tsx` — the main chat model picker) to tell "you have zero available models" apart from "the request failed." For the chat top bar specifically, that means a transient backend hiccup renders as an empty model-selector dropdown with no retry affordance and no error indication — a state a user has no obvious way to recover from except reloading the page. **Recommendation:** let `fetchAllModels()` throw (or return a discriminated result) on genuine failure, and have callers distinguish "loading," "empty," and "failed" the way `org-context.tsx`'s `roleError`/`orgPlanSettled` (Part 5's Organizations subsection) already model that distinction correctly elsewhere in this app.

**Good pattern, worth crediting: the shared `AguiSSEDecoder` is now confirmed reused across every SSE consumer in this document, not just the ones covered so far.** `CompareModels.tsx`'s "Compare Models" feature fires 1–3 parallel `POST /llm/models/test` requests (one per selected model) and decodes each independent stream with `new AguiSSEDecoder()` (`:1127`) — the same shared decoder `use-streaming-chat.ts`, `personas.ts`'s `readPersonaSSEStream`, and `brain.ts`'s `consumeBrainStream` all use. That's five independent call sites now confirmed sharing one wire-format parser, with only the higher-level event-dispatch logic varying per UI — a genuinely well-maintained piece of shared infrastructure, worth noting explicitly given how much this document's other findings focus on things built more than once. (Also worth noting: these three streams are deliberately *not* combined with `Promise.all` — each needs to update its own column live and independently, so the docs' parallel-fetch guidance doesn't apply the way it did for `listPins()`/`listPinFolders()`; firing three independent, unawaited streams is the correct shape here, not a missed optimization.)

### Team invite surface

Cross-referenced against [team-invite-endpoints-usage.md](./team-invite-endpoints-usage.md) — 2 endpoints, both live, wrapped in `teams.ts`. This is the org-invite *acceptance* flow (distinct from the *sending* flow in the Organizations surface), and it's the reference implementation the Persona Shares surface's recommendation (Part 1) already pointed back to.

**Good pattern, confirmed as the working precedent for the Persona Shares fix.** `team-invite-onboarding-context.tsx`'s `TeamInviteOnboardingProvider` fetches the invite via `getTeamInviteOnboarding()` and drives a `status` state machine (`loading`/`ready`/`expired`/`not_found`/`error`) off `ApiError` status codes — 404 → `not_found`, 410 → `expired` — the same shape already credited for `share/[id]/page.tsx` in the Persona Shares surface. The reason this route's version of the problem is actually solvable end-to-end: `OnboardingGuard` (cited in the Persona Shares surface's F-finding) carries an explicit carve-out for exactly this route — *"Let an un-onboarded invitee reach their invite link (mirrors proxy.ts) so the invitation popup renders instead of bouncing them into onboarding."* Persona Shares' `/share/[id]` has no equivalent carve-out, which is precisely why that finding recommended adding one "the same way team-invite already has one" — this is that reference, confirmed to exist and work as described.

### 6. Suggested order of work (Part 1)

1. Migrate the chats-list hook (`use-chat-history.ts`) to `useQuery`/`useInfiniteQuery`, following `usePersonas` as the template — **together with its mutations**, per [Part 2 §3](#3-findings-1) below, not as a separate follow-up. Collapses three independent `listChats()` call sites into one cached query.
2. Extract the shared SSE-proxy response helper and apply it to `/api/chat`, `/api/persona-chat`, `/api/brain-chat`.
3. Repeat step 1 for project chats, brain threads, and chat-shares.
4. Add server-fetched initial data (§4.3) for the chats sidebar and projects list once their client hooks are on React Query.
5. Sweep the dead wrappers/constants in §4.4 (mechanical, no architecture risk).
6. Route `fetchPersonas()`'s seven call sites (§5) through `usePersonas()` — the highest-value single migration in this list, given how many places currently refetch it independently.
7. Confirm with product whether `/share/[id]` should be reachable by an unauthenticated visitor (per the Persona Shares surface finding above); if so, add it to `OnboardingGuard`'s carve-out list and convert the preview fetch to a Server Component + `notFound()`, leaving only the "Accept" button as a client island.
8. Sweep the Pins dead code (`getPin`, `updatePinTags`, `CompareModels.tsx`'s unreachable `handleSavePin`) alongside item 5 — same mechanical cleanup, no architecture risk.
9. Flag F10 (the highlights fan-out) for a backend conversation about an aggregate "all my highlights" endpoint — this is the one finding in this document a frontend-only change can mitigate but not fully fix. In the meantime, cache `loadAll()`'s result (Part 3) so repeated toggles don't re-issue the full fan-out.

---

## Part 2 — Mutating Data

Every mutating endpoint in [chat-endpoints-usage.md](./chat-endpoints-usage.md) — rename, delete, star, visibility, copy, stop, prompt-respond, save-to-drive, chat-shares create/delete/fork, persona-chat rename/delete, project chat link/unlink — is invoked the same way: a plain client-side function in `lib/api/*.ts` calling `apiFetch`/`apiFetchJson` from an event handler. None go through a Next.js Server Function.

### 1. Next.js guidance vs. current practice

| Next.js recommends | Current practice | Verdict |
|---|---|---|
| Mutate via a Server Function (`"use server"`), invoked from a `<form action={...}>` or an event handler | Zero `"use server"` directives anywhere in `src/` (verified by grep). Every mutation is a client `apiFetch`/`apiFetchJson` call fired from `onClick`. No `<form action={fn}>` usage either — forms are controlled inputs submitted via `onSubmit` → the same client fetch functions | **Deliberately not applicable** — see [§2](#2-f1-not-a-gap--server-actions-dont-fit-this-backend-shape) |
| `revalidatePath`/`revalidateTag` after a mutation to refresh Next's Data Cache | N/A — there is no Next-owned cache in this data path; the data lives behind the FastAPI backend, not in `fetch`'s Next.js cache. The equivalent job (make the UI reflect the mutation) is done by hand: optimistic `setState` + rollback (chats), or a `window` `CustomEvent` that a `useEffect` turns into `queryClient.invalidateQueries` (personas) | Reimplemented ad hoc — see [§3 F2/F3](#3-findings-1) |
| `useOptimistic` for instant UI feedback with automatic revert on error | Hand-rolled per mutation: snapshot current value → apply optimistic `setState` → `await` the call → on `catch`, `setState` back to the snapshot. See `use-chat-history.ts:93-138` (`handleRename`, `handleDelete`, `handleStar`) — same three-step shape, written out three times | Same effect, more repetition — see [§3 F2](#3-findings-1) |
| `useActionState` for a `pending` boolean during the mutation | No mutation hook here exposes an `isPending`/`isMutating` flag; call sites that want a spinner would need their own local state (none currently do) | Not present — low priority, see [§3 F4](#3-findings-1) |

### 2. F1 — Not a gap: Server Actions don't fit this backend shape

Server Actions earn their keep when the Next.js server itself owns the mutation (direct DB/ORM access) and can pair it with `revalidatePath`/`revalidateTag` against Next's own cache in one round trip. Here, every mutation's real destination is the external FastAPI backend behind Auth0 — the same one the Route Handlers in `app/api/*/route.ts` already proxy to. Moving these calls into Server Functions would mean re-implementing, on the server, everything `client.ts`'s `apiFetch` already does for free: the 401-retry-once dance, the onboarding/checkout carve-out, and `friendlyApiError`'s mapping to user-facing copy — and would still need a client-side companion for optimistic UI, since Server Functions are dispatched and awaited one at a time (per the docs' own note) rather than fire-and-optimistically-update. Keeping mutations as client `apiFetch` calls is the right call here; this section is about the *pattern* those calls follow, not about replacing them with Server Actions.

### 3. Findings

**F2 (Medium) — Optimistic-update boilerplate is hand-written per mutation, and will fight a query cache once one exists.**
`use-chat-history.ts:93-138` repeats the same shape three times — snapshot, optimistic `setState`, `await`, rollback-`setState`-on-`catch`, toast — for rename, delete, and star. That's a reasonable manual stand-in for `useOptimistic` today, *because* the chats list is plain `useState` with no cache to contradict. It stops being reasonable the moment [Part 1 §3 F1](#3-findings) migrates that same list onto `useQuery`: at that point there are two independent sources of truth for the chat list (the query cache and this hook's hand-rolled optimistic `chats` state), and whichever one renders last after a mutation silently wins. `useMutation`'s documented optimistic-update recipe (`onMutate` returns the pre-mutation snapshot, `onError` rolls back to it, `onSettled` invalidates) is a near-literal port of the logic already written here — the fix is to move it, not redesign it. Do this in the same pass as the `useQuery` migration in Part 1, not after — see the revised roadmap in [§4](#4-suggested-order-of-work-part-2).

**F3 (Low) — Persona-list cache invalidation goes through a global `window` event instead of the mutation itself.**
`personas.ts` mutating calls (pause/publish/delete) dispatch a `PERSONAS_LIST_UPDATED_EVENT` `CustomEvent` on `window`; `usePersonas` (`lib/queries/personas.ts:21-27`) listens for it in a `useEffect` and calls `queryClient.invalidateQueries`. This reproduces what `useMutation({ onSuccess })` gives directly, through an extra indirection that depends on every mutating call site remembering to dispatch the event — a new persona-mutating endpoint that forgets to do so will silently leave the list stale with no error to point at why. Once `usePersonas` has real `useMutation` siblings for pause/publish/delete, colocate the invalidation in their `onSuccess`/`onSettled` and retire the event listener.

**F4 (Low) — No shared pending-state signal for mutations.**
Rename/delete/star apply their optimistic update immediately and never expose a loading flag, so no call site can disable a button or show a spinner mid-request without adding its own one-off state (none currently do). This is arguably fine for an optimistic-first interaction model — the UI already looks "done" the instant the user acts — but it becomes free with `useMutation`'s `isPending`, so worth picking up as a side effect of F2's migration rather than pursued on its own.

### 4. Suggested order of work (Part 2)

Fold into Part 1's roadmap rather than sequencing after it:

0. Apply F5's fix (defer "done" state until the *last* dependent call succeeds; distinguish which step failed) to `onboarding/team/[inviteId]/page.tsx`'s `handleAccept()` too (Team Invite surface) — same bug shape, and this one commits real org membership before it can fail.
1. When migrating chats to `useQuery` (Part 1 step 1), migrate `rename`/`delete`/`star` to `useMutation` with `onMutate`/`onError`/`onSettled` in the same change — don't leave hand-rolled optimistic `setState` next to a query cache for the same list.
2. Repeat for project-chat and chat-share mutations alongside their Part 1 read-side migrations.
3. Once persona mutations are on `useMutation`, drop the `PERSONAS_LIST_UPDATED_EVENT` bridge in favor of direct `invalidateQueries` in each mutation's `onSuccess`.
4. Add an empty-body-safe variant of `apiFetchJson` to `client.ts` (F7) and repoint `revokeShare`/`deleteChat`/`deleteMessage`/`setProjectVisibility` at it — small, mechanical, no architecture risk, and worth moving up given this exact gap has already caused one real incident (Projects surface, Part 5). Separately (no dependency on this item), repoint `cancelSubscription`/`resumeSubscription`/`chargeTopUp` at plain `apiFetchJson` directly (F13) — they return real bodies today, so this doesn't even need to wait for the empty-body variant.
5. Fix `updatePinComment`'s side-effecting `setPins` updater (F9) first — it's a correctness bug independent of any migration — then add rollback-on-failure to `removePin`/`removePinByMessage`/`updatePinTags`/`updatePinComment` (F8) before or alongside migrating `pinboard-context.tsx` onto `useMutation`.
6. Wire up `handleDeleteAccount` (F11) ahead of the rest of this list's dead-code cleanup — it's the one item here a real user can currently hit and be confused by, not just a maintenance concern.
7. Prioritize F12 (the unhandled SCA/`client_secret` charge status) above everything else in this document — it's the one finding with direct real-money exposure. At minimum, ship the small fix (detect the status, show an error) before the fuller `@stripe/stripe-js` integration.
8. Port `pollConnectorUntilActive`'s `AbortSignal` wiring and `startOAuth`'s popup-closed grace-check onto `pollOrgConnectorAccountUntilConnected`/`AddSharedAccountModal` (F15) — the reference implementation to copy from already exists two files away. Given a third implementation of the same pattern now exists (`SlackConnectModal`, F17), consider extracting a single shared `usePollUntil()`-style hook instead of a third one-off port.
9. Add the missing `if (!response.ok) throw` guard to `stopBrainChat`/`starBrainChat`/`renameBrainChat`/`deleteBrainChat` (F16) — rank this near F12: it's the other finding in this document where a user is told an action succeeded when it may not have. `respondToPrompt`, in the same file, is the pattern to copy. Fix `onboarding/import/page.tsx`'s awaited memory-context write the same way (F18) in the same pass — same root cause, much smaller blast radius.
10. Give `fetchAllModels()` a way to distinguish a genuine failure from an empty result (F19) — the chat top bar's model picker is core enough UI that a silently-empty dropdown after a transient failure is worth fixing on its own, separate from any caching work.

### 5. Persona surface

Same verdict as above — zero Server Actions; every persona/version mutation (`updateVersion`, `createVersion`, `deleteVersion`, `publishPersonaVersion`, `togglePause`, `setPersonaVisibility`, `setActiveVersion`, `setVersionBlockedConnectors`, document upload/delete) is a `personas.ts` free function calling `apiFetch`/`apiFetchJson` from a button handler. Two findings are specific to this surface, and both are new — not stronger/weaker versions of a chat finding above.

**F5 (High) — A multi-step save can partially succeed, report total failure, and still clear "unsaved changes" state.** `updateVersion()` (`personas.ts:613-663`) does two sequential requests, not one: a `PATCH` for JSON metadata (name/prompt/model/temperature), then — only if an image, files, or `removeDocumentIds` were passed — a second `PUT` to a *different* endpoint (`PERSONA_VERSION_FILES_ENDPOINT`). There's no compensating rollback of the PATCH if the PUT fails; the function simply throws, having already committed the metadata half server-side.

Its caller, `handlePublish()` in `instructions/page.tsx:1009-1069`, compounds this: it wraps `updateVersion(...)` *and* the subsequent `publishPersonaVersion(repoId, versionId)` call in one `try` block with a single `catch` that shows one generic `"Failed to publish agent"` toast regardless of which of the (up to three) network calls failed. Worse, several local-state updates that assume success — `savedSnapshotRef.current = {...}`, `resetInstructionsTouched()`, `setPendingChangeTags([])` (`instructions/page.tsx:1039-1042`) — run *between* the `updateVersion` `await` and the `publishPersonaVersion` `await`, inside the same `try`. If `updateVersion` succeeds but `publishPersonaVersion` then throws, the catch block fires the generic failure toast, but the "this tab is now clean / no pending changes" state has already been committed — the UI can end up believing the draft is saved with no pending edits, while the version was never actually published (or, per the previous paragraph, while only half of `updateVersion`'s own two requests actually landed).

This is the same principle the Next.js error-handling docs are written around (model expected failures explicitly, rather than letting a multi-step operation report one undifferentiated outcome) — see [Part 5 §2](#2-findings-3), where this same finding is recorded once more as the error-handling side of the same bug. **Recommendation:** move the `savedSnapshotRef`/`resetInstructionsTouched`/`setPendingChangeTags` calls to after `publishPersonaVersion` resolves, and give the catch block enough information to distinguish "metadata saved, files/publish failed" from "nothing saved."

**F6 (Medium) — Six `PersonaRepo` class methods are dead code, not just a couple of wrappers.** §4.4 flagged a handful of individually-dead chat wrapper functions. The persona surface has a more structural version: per [persona-endpoints-usage.md](./persona-endpoints-usage.md), `src/lib/api/persona-repo.ts` defines a full `PersonaRepo` class whose mutation methods — `.setWorkingVersion()`, `.publish()`, `.pause()`, `.setVisibility()`, `.delete()`, `.listVersions()` — each duplicate a live free function in `personas.ts` (`setActiveVersion`, `publishPersonaVersion`, `togglePause`, `setPersonaVisibility`, `deletePersona`, `listVersions`), and are referenced only from `persona-repo.test.ts`. Production code never calls the class's write path — only its read-side collection-building (`fetchPersonaRepos()`) is live. **Recommendation:** delete the six dead methods (and repoint their tests at the free functions they'd actually be testing in production) rather than maintaining two implementations of the same six mutations indefinitely.

**Noted, not a finding — `usePersonaRepoDeduped()`'s localStorage write-dedup is a legitimate one-off.** `usePersonaRepoDeduped()` (`personas.ts:326-356`) checks a `localStorage`-backed map before calling `usePersonaRepo()` (`POST /persona/{id}/use`), so a user who's already cloned a shared agent doesn't accumulate duplicate copies across sessions/tabs — a different problem than the TTL read-caches in Part 3 (this dedupes a *write*, durably, across sessions, not a *read* for 30 seconds). `useMutation` has no stock primitive for "was this write already done, possibly in a different tab, possibly days ago" — hand-rolling it here is the right call, not a gap to fold into the React Query cleanup.

### Pins surface

Cross-referenced against [pins-endpoints-usage.md](./pins-endpoints-usage.md). `pinboard-context.tsx` implements six independent hand-rolled optimistic mutations (`addPin`, `clonePin`, `removePin`, `removePinByMessage`, `updatePinTags`, `updatePinComment`) — the largest concentration of the pattern F2 describes in any single file in this app. Two things stand out that aren't present in the chat/persona versions of this pattern.

**F8 (High) — Half of these mutations roll back on failure; the other half don't, and the failure is silent for two of them.** `addPin` and `clonePin` (`pinboard-context.tsx:250-309`) do this correctly: optimistic insert with a temp ID, then on `catch`, filter the temp item back out and toast an error. `removePin` and `removePinByMessage` (`:312-346`) apply the optimistic removal, and on a failed `deletePin()` call, **only log to console and toast** — the pin stays removed from `pins` state (and, per F9 below, from the persisted cache) even though the backend still has it. `updatePinTags` (`:392-399`) and `updatePinComment` (`:401-441`) are worse: their `.catch()` handlers call `console.error` and nothing else — no toast, no rollback — so a failed tag update or comment edit/delete is invisible to the user and permanent in the UI. **Recommendation:** give every mutation here the same rollback-and-toast treatment `addPin`/`clonePin` already model correctly; this is a good match for `useMutation`'s `onMutate`/`onError` recipe (F2) if/when this context migrates.

**F9 (High) — A `useState` updater function fires live network requests, which React's Strict Mode is documented to invoke twice.** `updatePinComment`'s updater passed to `setPins` (`pinboard-context.tsx:401-441`) calls `addPinComment()`/`editPinComment()`/`deletePinComment()` — real `POST`/`PATCH`/`DELETE` requests — directly inside the callback, as a side effect of computing the next state. React's documented contract for a functional updater is that it must be pure; Strict Mode (Next's App Router default when `reactStrictMode` isn't explicitly set — and it isn't, in [`next.config.ts`](../../next.config.ts)) calls it twice specifically to surface exactly this class of bug in development. In practice, one click on **Save** for a pin comment can fire the add/edit/delete request twice, and since each of `editPinComment`/`addPinComment`'s own `.then()` handlers separately call `setPins` again to reconcile the real backend comment ID, a double-invocation means two reconciliation writes can race for which one lands last. **Recommendation:** move the `addPinComment`/`editPinComment`/`deletePinComment` calls out of the `setPins` updater and into a plain `async` sequence after it (read the pin's current comment from a ref or from the `prev` snapshot the updater already computes, then fire the request outside the updater callback) — the same shape `removePin`/`updatePinTags` already use elsewhere in this file.

### Highlights surface

No new finding here — worth recording precisely because it's a clean pass. `addHighlight`/`deleteHighlight` (`highlight-context.tsx:168-218`) are two more hand-rolled optimistic mutations in the same shape §3's F2 describes, but done the way `addPin`/`clonePin` model it correctly in the Pins surface: snapshot, optimistic update, roll back and toast on failure, every time — none of Pins' F8 (missing rollback) or F9 (side effect inside a `setState` updater) shows up here. `deleteHighlight` adds one small, sharp detail worth calling out: if the target `id` is still a client-side temp id (its `createHighlight` call hasn't resolved yet), it's dropped from local state with **no network call at all** (`:199-202`) — correctly avoiding a pointless DELETE racing an in-flight, not-yet-acknowledged POST. Nothing to fix; useful as a second data point (alongside the SSE-decoder reuse in the Persona surface) that this codebase's hand-rolled patterns are correct more often than not — the bugs found elsewhere are real, but not evidence the general approach is unsound.

### Users surface

**F11 (Medium) — Unlike every other dead-code finding in this document, this one is user-facing.** `settings/(shell)/account/page.tsx:244-246`:

```ts
const handleDeleteAccount = () => {
  // TODO: open confirmation dialog before proceeding
}
```

wired to a real, currently-rendered **Delete account** button in a danger-zone card whose copy reads *"Permanently delete your account and all associated data, personas, workflows, and pins. This action cannot be undone."* Every other dead wrapper found across this document (§4.4, F6, `getPin`, `listSent`, `updatePinTags`, the `WORKFLOW_CHAT*` family) is invisible — nobody using the app would ever notice `getPin()` has zero callers. This one is different: a real user can click a real, alarmingly-worded button and nothing happens — no toast, no error, no console log, nothing. `deleteUser()` (`user.ts`) is fully implemented and ready to be called; only the confirmation dialog and the click handler's body are missing. **Recommendation:** treat this above the priority of the rest of this document's dead-code sweep — it's the one case where "dead code" is currently a visible, confusing product bug rather than a maintenance-only concern.

**Good pattern, worth crediting: the best-designed multi-request mutation in this document, and a useful contrast with F5.** `settings/(shell)/account/page.tsx`'s `handleSave()` (`:205-239`) conditionally builds a `tasks` array — `updateUser()` if name/avatar changed, `updateOnboarding()` if role/tone changed — and fires them with `Promise.all`, then `await refreshUser()`, all inside one `try`/`catch`/`finally`. This looks structurally similar to persona's `handlePublish()` (F5) but avoids its bug for two reasons that are worth naming explicitly: the two PATCHes here are genuinely independent (neither depends on the other's result, so `Promise.all` is the *correct* tool, unlike F5's two sequential, dependent requests), and — critically — nothing marks the form "clean" until `refreshUser()` actually succeeds. The dirty-check (`isDirty`, `:164-168`) is derived by comparing live form state against a baseline that only moves when the real `user` context value changes (via the render-time `profileKey`/`syncedKey` re-sync at `:154-162`), so a failed save leaves every changed field correctly flagged dirty for a retry — and because both PATCHes are idempotent (re-sending the same target values), a retry after a partial failure is safe, unlike a retried `updateVersion()` call.

### Stripe (billing) surface

**F12 (High) — An immediate-charge response that requires card authentication is silently treated as neither success nor failure, and falls through into opening a second, separate checkout flow.** `chargeTopUp()`'s response type (`user.ts:734-737`) is:

```ts
export interface TopUpChargeResponse {
  status: string;
  client_secret?: string | null;
}
```

`client_secret` is the standard Stripe signal that a `PaymentIntent` needs additional client-side confirmation — 3D Secure / SCA, which card issuers (especially under EU/UK PSD2 rules) can require on essentially any card, not as an edge case. `BuyCreditsModal.handlePay()` (`index.tsx:99-122`) only branches on two outcomes:

```ts
const res = await chargeTopUp(usd)
if (res.status === 'succeeded' || res.status === 'ok') {
  toast.success('Credits added successfully!')
  // ...
  return
}
// falls through to creating a brand-new Checkout session:
const session = await createTopUpSession(usd)
window.location.href = session.checkout_url
```

Any other `status` — including whatever value the backend sends alongside a populated `client_secret` for a charge that needs confirmation — isn't handled: no toast, no error, nothing distinguishing it from failure or success. Execution simply continues to the fallback branch and opens an *entirely separate* Stripe Checkout session for the same amount, redirecting the browser away. `@stripe/stripe-js` — the SDK required to call `confirmCardPayment(client_secret)` and actually complete a charge in this state — isn't in `package.json` at all (confirmed by grep), and no other file in `src/` reads `client_secret` or handles a `requires_action`-shaped response. So today, for any card that trips SCA on an immediate top-up: the original `PaymentIntent` is left in limbo, the user gets silently redirected into a second, independent payment flow for the same amount, with no code path resolving the first one and a real possibility of both eventually completing. **Recommendation:** either add `@stripe/stripe-js` and call `confirmCardPayment(client_secret)` when `status` indicates action is required, or — as a smaller, immediate fix — explicitly detect that status and show an error asking the user to use "Edit payment method" / checkout instead of silently opening a second session.

### Projects surface

No new bug here — worth stating plainly rather than manufacturing one. `createProject`/`updateProject`/`deleteProject` follow the same correct optimistic-update-with-rollback shape `addPin`/`addHighlight` model elsewhere, consistently. Two details are worth recording as good examples rather than findings:

**`removeFile`'s defensive re-check against a known backend quirk.** `removeFile()` (`projects-context.tsx:414-441`) doesn't trust a `200 OK` at face value: after the DELETE call returns, it checks whether the deleted file's id is still present in the response's document list, and if so, `throw`s explicitly — routing a "false success" through the exact same rollback-and-toast path as a genuine network failure, rather than needing a second, parallel handling branch for it. That's a well-reasoned response to a real backend behavior (a 200 that doesn't reflect the deletion), not defensive-programming-for-its-own-sake.

**A documented invariant, not just a fallback.** `apiToProject()`'s `teamId`/`visibility` mapping (`:174-178`) has an explicit comment guarding against a specific failure mode: a partial/degraded API response leaving these two fields disagreeing, because one falls back to the last-known value on a missing field while the other silently took whatever came back. Both are given the same fallback logic specifically so they can't drift apart. Small, but it's the kind of cross-field consistency invariant that's easy to get wrong by fixing one field at a time.

### Connectors surface

No new mutation-pattern finding — `updateConnector`/`unlinkConnector`/`setOrgConnectorStatus`/the shared-account CRUD all follow the same established try/catch/toast shape used correctly elsewhere in this document, and F15 (Part 1) is really a fetching/lifecycle finding wearing a mutation-adjacent hat (it happens to run inside `AddSharedAccountModal`'s submit handler, but the bug is in the poll, not the `createOrgConnectorAccount`/`updateOrgConnectorAccount` calls around it).

**Known dead code, same class as elsewhere:** `DELETE /organizations/{org}/connectors/{slug}` — `removeOrgConnector()` (`org-connectors.ts`) is imported into `connectors/page.tsx` but never actually called; the "turn a connector off" flow uses `setOrgConnectorStatus(..., 'denied')` instead. And `GET /organizations/{org}/connectors/{slug}/used-by` — `getConnectorUsedBy()` is fully implemented backend-and-wrapper but has zero callers; per [connectors-endpoints-usage.md](./connectors-endpoints-usage.md), it was meant to back a "blast-radius preview" (warn an admin how many personas depend on a connector before disabling it org-wide) that was never built into the UI.

### Brain surface

**F16 (High) — Four of `brain.ts`'s eight wrappers never check `response.ok`, so they never reject on an HTTP-level failure — and one of them shows a definitive success toast for a deletion that may not have happened.** `stopBrainChat`, `starBrainChat`, `renameBrainChat`, and `deleteBrainChat` (`brain.ts:658-678`) all share this shape:

```ts
export async function deleteBrainChat(chatId: string): Promise<void> {
  await apiFetch(BRAIN_BASE, { method: 'DELETE', body: JSON.stringify({ chat_id: chatId }) })
}
```

No status check, no throw — the function resolves successfully whether the backend returns `200` or `500`. `apiFetch` itself never throws on a non-2xx response (by design — Part 1's stack diagram: "raw-response callers... handle status themselves"), so the *caller* is supposed to check status, and none of these four do. Their callers, in turn, all assume the opposite — that a rejected promise is how a failure would show up:

- `BrainSidebarSections.tsx:265-273`: `try { await renameBrainChat(id, title) } catch { /* Revert isn't critical — next fetch will correct it */ }` — the revert-on-failure comment describes dead code; an HTTP-level rename failure (403, 404, 422, 500 — the common cases) never reaches this `catch` at all, only a network-level exception would.
- `BrainSidebarSections.tsx:275-284` (and its second, near-identical copy at `:574-582`): the star-toggle rollback has the same gap — a backend-rejected star/unstar leaves the UI showing the wrong state with no correction.
- `brain/threads/page.tsx:126-137` and `BrainSidebarSections.tsx:286-297`: `onConfirm: async () => { await deleteBrainChat(id); setThreads(prev => prev.filter(t => t.id !== id)); emitBrainThreadDeleted(...); toast.success('Brain chat deleted') }`. Because `deleteBrainChat` can't reject on an HTTP failure, **this sequence runs unconditionally** — the thread disappears from the UI and the user sees a definitive "Brain chat deleted" success toast even when the DELETE request failed server-side. This is a stronger version of the false-confirmation problem than anything else in this document: it's not a missing rollback on a silently-swallowed error, it's an explicit, worded success message for an action that didn't necessarily succeed.

The fourth function in this group, `stopBrainChat`, is lower-stakes since its caller already treats it as best-effort (`void stopBrainChat(chatId).catch(() => {})`), but shares the same root cause. **Note the contrast within the same file:** `respondToPrompt()` (`:644-656`) — right next to these four — *does* check status correctly (`if (!response.ok && response.status !== 204) throw new ApiError(...)`), proving this isn't a structural constraint of using raw `apiFetch`, just an inconsistency across sibling functions. **Recommendation:** add the same `if (!response.ok) throw` guard `respondToPrompt` already has to `stopBrainChat`/`starBrainChat`/`renameBrainChat`/`deleteBrainChat` — a small, mechanical, high-value fix given the delete-path's user-facing consequence.

### Slack surface

No new bug — `handleCreateChannel`/`handleEditSave`/`handleDeleteChannel` (`souvenir-slack/page.tsx`) follow the standard try/catch/toast shape correctly. One detail worth crediting: `handleRemoveSlack()` (`:448-460`) doesn't trust the `DELETE /organizations/{id}/slack/installation` call's success at face value — it re-fetches `getOrgSlackStatus(orgId)` immediately after and explicitly throws (`'Slack is still connected. Please try disconnecting again.'`) if the org still shows connected. That's the same defensive re-verification pattern as the Projects surface's `removeFile()` false-200 guard, independently arrived at a second time — a real, recurring good habit in this codebase for destructive actions specifically, worth calling out as a pattern to keep applying (and a candidate default for `deleteBrainChat`'s fix, F16, once it's throwing correctly to begin with).

### Automations surface

No new bug. `updateAutomation`/`deleteAutomation`/`listAutomations`/`getAutomation` all correctly use `apiFetchJson`, which means their failures get `friendlyApiError`'s translation for free — unlike Stripe's F13, nothing here bypasses it. `brain/schedules/page.tsx`'s pause/resume and delete flows follow the same optimistic-with-rollback shape used correctly elsewhere (Highlights, Pins' `addPin`/`clonePin`), including the same "drop a not-yet-persisted local-only row with no network call" short-circuit `deleteHighlight` uses for temp IDs.

**One small nuance, low severity:** `runAutomationNow()` (`automations.ts:80-90`) is the one function in this file that uses raw `apiFetch` instead of `apiFetchJson`, and on failure it throws a fixed, generic `'Failed to run automation'` message without reading the response body for backend-provided detail at all — the opposite problem from F13 (which over-exposes raw backend text): this one discards whatever specific reason the backend gave (rate limit, already-running, misconfigured, etc.) in favor of one message every time. Not worth an F-number on its own — a two-line fix (read `response.text()`/`.json()` before throwing, same as the pattern used everywhere else) whenever this file is next touched.

### Memory surface

**F18 (Medium) — A comment states an error should be visible; the code it's attached to doesn't make that happen, for the same root-cause reason as F16.** `onboarding/import/page.tsx:84-90`:

```ts
// Send user memory/context to backend if provided
if (!skipContext && data.aiContext.trim().length > 0) {
  await apiFetch(MEMORY_USER_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ content: data.aiContext.trim() }),
  });
}
```

The surrounding comment (per [memory-endpoints-usage.md](./memory-endpoints-usage.md)) explains the intent precisely: this call is `await`-ed rather than fire-and-forget "since it directly reflects a field the user filled in and errors should be visible." But `apiFetch` never throws on a non-2xx response — the same fact behind F16 — and nothing here checks `.ok`, so a failed save of the user's typed "AI context" blurb resolves this `await` successfully anyway. The outer `try`/`catch` a few lines down (`:94-96`) only fires for a genuine network-level exception, not a clean 4xx/5xx from this specific call, so the comment's stated goal isn't actually met: the write can fail silently, onboarding proceeds to `refreshUser()` and redirects to chat, and the user never learns their context blurb didn't save. This is F16's exact pattern (raw `apiFetch`, no status check, a caller that assumes a rejected promise is how failure would show up) found a third time, in code that explicitly documents the behavior it's failing to deliver. **Recommendation:** add the same `if (!response.ok) throw` guard recommended for F16, or switch this one call to `apiFetchJson`.

The sibling fire-and-forget calls (`import/page.tsx:77-82` and `invite/page.tsx:110-115`, both saving the free-text "Other" role detail) are, by contrast, correctly designed as-is — their own comments state the failure should be silent and non-blocking, and `void apiFetch(...)` with no `.catch()` achieves exactly that. Not every uncaught failure in this document is a bug; this one is, specifically because it contradicts its own stated intent.

### Organizations surface

**Two complete, unreachable mutation flows — a quieter cousin of Users' F11.** `deleteOrg()` and `transferOrgOwnership()` (`organization.ts`) each have a fully-built handler, confirmation state, and (for transfer) a member-picker wired up in `general/page.tsx` — but per [organizations-endpoints-usage.md](./organizations-endpoints-usage.md), neither has any button, danger-zone card, or dialog anywhere in that file's JSX that would ever call them. Unlike F11's `handleDeleteAccount` — a real button whose handler is an empty stub — there's no dead click waiting here; a user can't stumble into either of these because there's nothing to click. That makes this lower user-facing severity than F11, but it's a larger maintenance-debt cluster: two complete mutation implementations, with their own state machinery, that can't be exercised or verified against real usage. Worth a decision either way — wire them up or delete them — rather than leaving them as the only two "finished but silent" features in the app.

**Good pattern, worth crediting: a documented, past-incident-driven fix in the role-precedence logic.** `org-context.tsx:167-176`'s comment explains a real bug this code was written to prevent: letting `isTeamPlan` (a guess, derived from the user's own onboarding `roleFit`) override a *definitive* `'member'` answer from the backend would silently promote every real non-owner team member to `'admin'`, which "broke the clone-before-chat logic gated on `currentUserRole !== 'admin'` throughout the app." The fix — never let the guess override a `roleDefinitive` result — is exactly the kind of precedence bug that's easy to reintroduce without the comment explaining why it matters; worth preserving if this logic is ever refactored.

### LLM models surface

No new bug — `toggleBlockModel()` (`models.ts:72-79`) follows the correct shape: throws a proper `ApiError` on failure (unlike F16/F18's raw-`apiFetch`-with-no-check pattern), and on success busts the shared models cache (Part 3) so every open model-selector picks up the change immediately, which is exactly the "make the mutation's effect visible everywhere" principle this section is about. F19 (Part 1) is a fetching-layer gap in a sibling function, not a mutation issue.

### Team invite surface

**A fourth confirmed instance of F5's exact shape — three sequential, dependent mutations under one generic catch, with the first one being real, hard-to-undo org membership.** `onboarding/team/[inviteId]/page.tsx`'s `handleAccept()` (`:53-77`):

```ts
try {
  await acceptTeamInvite(invite.inviteId);
  await updateOnboarding({ onboarding_completed: true });
  await refreshUser();
  push(/* ... */);
} catch (err) {
  setSubmitting(false);
  if (err instanceof ApiError && err.status === 410) { toast.error("This invite has expired."); return; }
  toast.error(err instanceof ApiError ? err.message : "Couldn't accept the invite. Please try again.");
}
```

Unlike persona's `handlePublish` (F5), these three calls genuinely can't be parallelized — accepting the invite has to happen before marking onboarding complete, and refreshing the user has to come last — so the sequencing itself is correct, not a missed `Promise.all` opportunity. The bug is the same as F5's: if `acceptTeamInvite()` succeeds but `updateOnboarding()` or `refreshUser()` then fails, the org membership is already committed server-side, but the catch block's generic *"Couldn't accept the invite. Please try again"* tells the user otherwise — and a retry calls `acceptTeamInvite()` a second time on an invite that's already been accepted, whose outcome (silent no-op vs. a fresh "already used" error) isn't accounted for anywhere in this handler. **Recommendation:** same as F5 — once `acceptTeamInvite()` resolves, treat the invite as accepted regardless of what happens next, and give the later two steps' failures their own, non-retry-the-whole-thing recovery path (at minimum, a message that doesn't imply the invite itself needs re-accepting).

### Persona shares (Super Links) surface

**F7 (Medium) — `apiFetchJson` can't be used for any endpoint that returns 204, and that's the root cause of a recurring duplicated error-parsing block.** `revokeShare()` (`persona-shares.ts:191-205`, `DELETE /persona-shares/{id}`) calls raw `apiFetch` and hand-rolls ~15 lines of "parse the JSON error body, fall back to a default message on an empty body, throw a typed `ApiError`" — logic that's already `apiFetchJson`'s job. It isn't duplicated by oversight: `apiFetchJson` (`client.ts:233-274`) always calls `response.json()` on a successful response, which throws on the empty body a `204 No Content` returns, so any endpoint that succeeds with no body — `revokeShare` here, and `deleteChat`/`deleteMessage` in `chat.ts` (`master-api.md` Part 1's stack diagram already notes "raw-response callers... handle status themselves") — is structurally forced to bypass `apiFetchJson` and reimplement its error-parsing branch by hand instead. **Recommendation:** give `client.ts` a `apiFetchOk(path, options)` helper (or teach `apiFetchJson` to special-case a `204`/empty body by returning `undefined` instead of calling `.json()`) that reuses the existing error-parsing logic and returns `void` on success. This collapses at least three independent copies of the same block — `revokeShare`, `deleteChat`, `deleteMessage` — onto one implementation, the same consolidation §4.2 already recommends for the SSE proxy loop, just one layer down the stack.

---

## Part 3 — Caching

The [caching guide](https://nextjs.org/docs/app/getting-started/caching) fetched for this section documents **Cache Components** (`"use cache"`, `cacheLife`, `cacheTag`, Partial Prerendering) — the model that applies when `cacheComponents: true` is set in `next.config.ts`. It is not set here (checked [`next.config.ts`](../../next.config.ts) directly — no `cacheComponents` key at all), so none of that page's directives, `connection()` guard, or prerendering/prefetch behavior are active in this app. That's stated up front because the fix for a gap in this section is *not* "sprinkle `'use cache'` into a few functions" — without the flag, the directive has no runtime effect at all, and flipping the flag on is a real adoption decision (it turns on PPR validation and requires a `<Suspense>` boundary around every `cookies()`/`headers()`/uncached-fetch access, app-wide) that shouldn't happen as a side effect of caching one list.

With Cache Components off, the only other Next.js-native caching layer is the **Data Cache** (`fetch`'s own `cache`/`revalidate` options), which only ever applies to `fetch` calls made while rendering a Server Component or Route Handler. Per Part 1, this app fetches exclusively from Client Components — `lib/api/*.ts` calls run in the browser, never inside a Server Component — so the Data Cache has nothing to do on that side either. The only server-side `fetch` calls in the whole frontend are the ones *inside* the Route Handlers proxying to the backend, and that's the one place this section has real findings.

### 1. Next.js caching model vs. current practice

| Next.js layer | Applies here? | Current practice |
|---|---|---|
| Cache Components (`use cache`, `cacheLife`, `cacheTag`, PPR) | No — `cacheComponents` isn't set | N/A |
| Data Cache (`fetch({cache, next: {revalidate}})`) for Server Component / Route Handler fetches | Only inside the Route Handlers' own upstream `fetch()` calls | The generic proxy sets `cache: "no-store"` explicitly (`app/api/backend/[...path]/route.ts:73`); the three bespoke SSE proxies don't set it, but their upstream calls are all `POST`, which `fetch` never caches by default anyway — not a gap |
| Full Route Cache / static rendering | No route in `app/(app)/**` is staticable (Auth0 session on every page) | All six Route Handlers export `dynamic = "force-dynamic"` — correct, and consistent everywhere it's needed |
| Request memoization (`React.cache`) | Only relevant to Server Component fetches, which don't exist here | N/A |
| *(not a Next.js concept)* — application-level read caching / dedup | This is what's actually solving "don't refetch the same GET twice" in this app | Hand-rolled module-scope TTL + in-flight-promise caches, built independently at least six times — see §2 F2 |

### 2. Findings

**F1 (info) — Cache Components is off; don't adopt its directives piecemeal.** Not a defect, but worth stating explicitly so a future change doesn't add a stray `"use cache"` expecting it to do something. If server-rendered initial data is added per [Part 1 §4.3](#43-medium--every-list-view-is-a-client-side-waterfall-with-no-initial-data), it can be done with a plain `fetch`/Route Handler + React Query hydration, without needing Cache Components at all.

**F2 (High) — The same hand-rolled TTL-cache-plus-in-flight-dedupe module is independently reimplemented at least eight times.** All in `src/lib/api/` except the last:

- `personas.ts` — `fetchPersonas()` (`_personasCache` / `_fetchPersonasInFlight`, `personas.ts:158-175`), `getPersonaRepoWithCache()`'s per-repo detail cache (`_personaDetailCache` / `_personaDetailInFlight`, `personas.ts:229-234`), and the per-repo persona-chats cache (`_personaChatsInFlight`, `personas.ts:839-844`) — three separate instances in one file, per [persona-endpoints-usage.md §B](./persona-endpoints-usage.md#b-persona-repo-crud)
- `current-user.ts` — a `CurrentUserCache` class with `fetchedAt`/`inFlight` fields (`current-user.ts:18-19`), whose own comment says it exists to add "the same two guards `fetchPersonas()` already has — a TTL cache and in-flight dedupe... [to] mirror that module's shape deliberately" (`current-user.ts:12-14`)
- `connectors.ts` — `_catalogCache` + `CATALOG_CACHE_TTL` (`connectors.ts:226-239`)
- `persona-cache.ts` — a shared `PERSONAS_CACHE_TTL` constant plus its own bespoke `Set`-based invalidation-listener registry (`onPersonasInvalidated`/`bustPersonasCache`)
- `lib/ai-models.ts` — `_modelsCache`/`_modelsFetchPromise`/`MODELS_CACHE_TTL = 60_000` (`:125-128`), wrapping `models.ts`'s `fetchAllModels()` from outside `lib/api/` entirely, with its own fourth custom invalidation event (`MODELS_CACHE_BUSTED_EVENT`, `:134`) — see the LLM Models surface below.

Every one of these is solving exactly the problem `@tanstack/react-query` — already a dependency, already proven in `usePersonas` (Part 1 §4.1) — solves generically: serve a cached value inside a freshness window, collapse concurrent callers onto one request, and invalidate on demand. Eight bespoke implementations of the same twelve-line pattern is eight places a subtle bug (a forgotten `finally`, a TTL that doesn't get reset on `set()`) can diverge from the others.

**F3 (Medium) — Where the migration has started, it stacked a second cache on top of the first instead of replacing it.** `usePersonas()` (`lib/queries/personas.ts`) wraps `fetchPersonas()` in `useQuery`, and `QueryProvider` sets a global `staleTime: 30_000`. But `fetchPersonas()` itself still runs its own independent `PERSONAS_CACHE_TTL = 30_000` check and in-flight dedupe before `useQuery` ever sees it — two caching layers, both tuned to the same 30 seconds, doing the same job on the same data. The inner cache isn't pure waste today: `fetchPersonas()` is presumably still called directly from places that predate the hook and haven't been migrated, and removing the inner cache before those callers move to `usePersonas()` would leave them making an unguarded request per call. It's a sign the migration is half-done, not that the layering is intentional — see the recommendation below.

**F4 (Good/keep) — The generic proxy's `cache: "no-store"` is doing real, non-obvious work.** Per `config.ts:17-20`, on `localhost` (or whenever `NEXT_PUBLIC_SERVER_URL` isn't set) *every* non-streaming API call from the browser — `listChats`, `getChatMessages`, `fetchPersonas`, project reads, all of it — routes through `/api/backend/[...path]`, not just the SSE proxies. That handler's upstream `fetch(target, { ...cache: "no-store" })` (`route.ts:73`) is the only thing stopping Next's Data Cache from potentially memoizing a per-user authenticated `GET` response keyed only by URL — which, without this line, could serve one signed-in user's chat list to a different user hitting the same path. Keep this explicit even though it may look redundant; if the shared `streamBackendResponse()` helper proposed in Part 1 §4.2 ever gets extended to cover non-streaming responses too, carry this line forward with it.

### 3. Recommendation

There's no Cache-Components or Data-Cache work to do here — the actual caching problem in this app is fully client-side, and the fix is the same one already proposed in Part 1: finish moving `personas`, `current-user`, `connectors`, `persona-repo`, and `ai-models` onto `useQuery`. Once every caller of a given resource goes through its hook instead of calling the raw `lib/api` function directly, the bespoke TTL/in-flight module for that resource has no remaining reason to exist and can be deleted outright — `useQuery`'s cache and request dedup fully subsume it, with nothing left calling the old function to migrate away from.

### 4. Persona surface

The count above already folds in the persona-specific evidence — `personas.ts` alone accounts for three of the seven hand-rolled caches in F2. Two more things surfaced while auditing this surface specifically, and neither is another instance of the same problem:

- **`instructions/page.tsx` persists in-progress, unsaved form state to `sessionStorage`** (keyed per repo/version), restoring it on mount and clearing the key once a save lands. This is a different problem from the TTL caches above — "recover my unsaved edits after an accidental reload," not "avoid refetching the same GET" — and browser storage is the right tool for it regardless of what happens with the React Query migration elsewhere.
- **`usePersonaRepoDeduped()`'s localStorage write-dedup** (Part 2 §5) is, similarly, not a read-cache and shouldn't be swept into this cleanup — see that section for why it's a deliberate exception.

Both are noted here only so they aren't mistaken for more instances of F2 while the migration in §3 is underway.

### Pins surface

**The one hand-built cache in this app that's genuinely doing more than `useQuery` does out of the box, and the one place a rollback bug (F8) compounds into a persistence bug.** `pinboard-context.tsx`'s `sb_pinboard_v1` `localStorage` cache (Part 1's Pins subsection) survives a full page reload — React Query's default in-memory cache doesn't; matching this exactly would need the separate `@tanstack/query-sync-storage-persister` package, not just `useQuery` on its own. That makes this the one cache in the app where "migrate it to React Query" isn't a drop-in win — it's a real feature to preserve deliberately, not just an artifact of not having adopted React Query yet. Treat it as lower priority than F2's TTL caches, and only migrate it once the persister package is actually part of the plan, not before.

That durability is exactly what makes F8 sharper here than it would be otherwise: the debounced cache-write effect (`pinboard-context.tsx:236-243`) persists `pins`/`folders` to `localStorage` 500ms after *any* state change, with no awareness of whether the mutation that caused the change actually succeeded on the backend. A failed `deletePin()` (F8) is written into the durable cache as if it had succeeded, and — unlike the in-memory-only state in `use-chat-history.ts` that a page reload would naturally correct — this wrong state now survives a reload too, until the 60s TTL forces the next revalidation. Fixing F8's rollback also fixes this: once the optimistic state is correctly reverted on failure, the debounced write persists the *correct* state instead.

### Highlights surface

The same "no caching at all" problem as the Persona Shares surface below, but with a much larger blast radius because of what's being re-fetched: `loadAll()` (Part 1's F10) re-runs its full per-chat fan-out from a cold start every time — there is no cache, TTL or otherwise, over either `collectAllChatIds()`'s chat-ID set or the merged highlights list it produces. Given the backend has no bulk endpoint to lean on (F10), caching the fanned-out *result* client-side is the highest-leverage fix available without a backend change: even a short TTL (the same 30-60s window used elsewhere in this app) would mean a user toggling between "This chat" and "All chats" repeatedly, or reopening the panel, doesn't re-pay dozens of requests each time. This is a stronger, more consequential version of the "no cache at all" pattern than the Persona Shares one below — there, re-fetching costs 3 requests; here, it costs one per chat the user has.

### Users surface

No new count — `current-user.ts` is already one of the seven caches in F2, and this surface doesn't add an eighth. Worth one line of texture: it's arguably the most carefully-reasoned of the seven. Every non-obvious decision in the class — serving stale data on a failed refresh rather than blanking the app, deliberately *not* time-coalescing `refresh()` since onboarding calls it immediately after a `PATCH` and any coalescing window could hand back pre-PATCH data, joining (not restarting) an in-flight request on a forced refresh — has an explaining comment at the point of the decision. That doesn't change the recommendation (still migrate it alongside the others once its callers are ready), but it's a better template to copy from than `fetchPersonas()` if the person doing the migration wants a second example of "why," not just "what."

### Stripe (billing) surface

Same "no caching at all" shape as Persona Shares and Highlights: `fetchBilling()` has no TTL cache, no React Query, nothing — `settings/(shell)/billing/page.tsx` and its org counterpart re-fetch it fresh on mount and after every mutation via a plain `reload()`. Lower stakes than the Highlights case (this is a single request, not a fan-out) and arguably correct as-is given how billing-sensitive this data is — staleness here is worse than an extra request — so this is the one "no cache" surface in the document where *not* adding one by default is defensible, not just unaddressed.

### Projects surface

Not another instance of F2, and worth being precise about why: `projects-context.tsx`'s `localStorage` file-size map (`storageSizesKey`, `:91-104`) isn't caching a GET to avoid a duplicate request — it's persisting a piece of metadata (`size_bytes`) the backend doesn't reliably return at all, so the frontend has to compute and remember it once (via the HEAD-request enrichment in Part 1) rather than re-deriving it every load. That's a different problem than "don't refetch the same list twice," and none of F2's recommendation (migrate onto `useQuery`) applies to it — `useQuery` would still need this exact enrichment step as its `queryFn`, it wouldn't remove the need for it.

### Connectors surface

No new count — `listConnectors()`'s 30s TTL cache is already one of the seven named in F2 (`connectors.ts` — `_catalogCache`/`CATALOG_CACHE_TTL`). Nothing further to add; the polling functions in this surface aren't a caching concern at all (they're driving toward a state change, not serving a cached read).

### Brain surface

No caching layer here at all — `listBrainChats()` is called fresh every time (mount, and after each of three separate window events), consistent with the "no cache" pattern already seen in Persona Shares/Highlights/Stripe, at a similar low-stakes single-request scale. Nothing to add beyond that; F16 (Part 2) is a status-checking bug, not a caching one.

### Slack surface

No caching layer here either, at the same low-stakes scale as Brain/Stripe — status and channel-mapping reads are always fresh. Nothing to add.

### Automations surface

No caching layer, same low-stakes shape as the other single/small-fan-out surfaces in this document. Nothing to add.

### Memory surface

Not applicable — a single fire-and-await write with nothing to cache. Nothing to add.

### Organizations surface

No caching layer anywhere in `org-context.tsx` — org identity, role, plan, and members are all plain fetch-on-`orgId`-change, no TTL, no React Query. Consistent with the pattern elsewhere; nothing new to add, and no new count for F2 (`organization.ts` has no bespoke cache module to list alongside it).

### LLM models surface

Already folded into F2 above as the eighth instance. Worth noting once more here since it's structurally distinct from the other seven: `_modelsCache` lives in `lib/ai-models.ts`, not `lib/api/`, wrapping a lower-level `fetchAllModels()` that itself has no caching at all — so this surface has both problems in the same call chain: the "real" fetcher (F19, Part 1) can't distinguish failure from empty, and the caching layer sitting on top of it (`fetchModelsWithCache`) would happily cache and serve that same ambiguous empty result for a full 60 seconds.

### Team invite surface

No caching layer — a one-shot invite preview fetched once when the link is opened. Nothing to add.

### Persona shares (Super Links) surface

The opposite problem from F2, and arguably a cleaner one: `listShares()`, `listReceived()`, and `fetchDashboard()` (`persona-shares.ts`) have **no caching at all** — not React Query, not a module-scope TTL cache, nothing. Every activation of the Super Links tab re-fetches all three from scratch (`agents/page.tsx:672-705`), and the manual refresh button exists specifically because there's no other way to get fresher data. This is the one part of the app where there's no bespoke cache to migrate away from — a plain `useQuery` per endpoint is a net-new addition here, not a replacement, and would also subsume the manual refresh button (`refetch()`) for free.

---

## Part 4 — Revalidating

The [revalidating guide](https://nextjs.org/docs/app/getting-started/revalidating) is, like Part 3, scoped to Cache Components (`cacheLife`, `cacheTag`, `revalidateTag`, `updateTag`) — inert here for the same reason: the flag isn't set. Its "previous model" counterpart (`revalidatePath`/`revalidateTag` plus `export const revalidate`) is the classic App Router mechanism for invalidating Next's own Data Cache and Full Route Cache after a Server Action or Route Handler mutates something — and this app has neither a Server Action nor any cached Server Component data for those functions to act on. Concretely:

- Every mutation in this app (Part 2) targets the external FastAPI backend through a client-side `apiFetch` call, never a Server Action — so `revalidateTag`/`updateTag` (Server-Actions-only per the docs) can't be called from any mutation site that exists.
- `revalidatePath`/`revalidateTag` from a Route Handler would only matter if that handler's own response were something Next had cached — the six Route Handlers here are all `export const dynamic = "force-dynamic"` proxies to an external API, not producers of cached Next content, so there's nothing for them to revalidate either.
- `router.refresh()` (the client-side trigger for re-running Server Component data fetching) is unused anywhere in `src/` — consistent with there being no Server Component data fetching to refresh.

None of this is a gap to close. "Revalidation" as a concept still exists in this app — it's just implemented entirely in the layer Parts 1–3 already covered: `queryClient.invalidateQueries` (or, pending the Part 1 migration, the hand-rolled `bustPersonasCache()`/`PERSONAS_LIST_UPDATED_EVENT` bridge and the various module-cache TTLs), plus the optimistic-`setState`-then-reconcile pattern in Part 2. Nothing further to add here beyond pointing back at those findings — this section exists mainly to confirm the absence is consistent, not overlooked.

### Persona surface

No new pattern here — `publishPersonaVersion`, `togglePause`, `deletePersona`, and `setPersonaVisibility` (Part 2 §5) are simply four more callers into the same `bustPersonasCache()` → `PERSONAS_LIST_UPDATED_EVENT` → `usePersonas()` bridge already described above, not a different mechanism.

### Pins surface

Same "no gap" verdict, and the same mechanism as chat/personas in miniature: there's no `revalidateTag`/`revalidatePath` involved because there's no Next-owned cache to invalidate — `pinboard-context.tsx`'s debounced `writeCache()` (Part 3) plays the role a revalidation call would, just triggered by any `pins`/`folders` state change rather than by an explicit call at the mutation site. Nothing new to recommend beyond fixing F8/F9 so that trigger fires on correct state.

### Highlights surface

Same verdict, and no cache here to revalidate at all (Part 3), so there's nothing this section adds beyond pointing at F10's recommendation: the fix is caching the fan-out result client-side and, ideally, a backend aggregate endpoint — neither is a Next.js revalidation-API concern.

### Users surface

Same verdict. `refreshUser()` (`auth-context.tsx:253-260`) is this surface's manual revalidation call, and it has by far the most trigger sites of any hand-built "revalidate" call in this document: a `credits:updated` window event, every onboarding step's own save handler, four separate post-Stripe-checkout confirmation pages, and two org-switch/invite-acceptance points. All of it is the same pattern already described for chat/personas/pins — a plain function call standing in for what `invalidateQueries`/`revalidateTag` would do if this data lived in a Next-owned cache — just with unusually wide fan-in.

### Stripe (billing) surface

Same verdict. `reload()`/`refreshUser()`/`refreshMembers()`/`notifyCreditsUpdated()` firing together after a mutation or a Stripe redirect are this surface's revalidation-equivalent — the mechanism is fine (Part 2/5's billing-page mutations correctly call it); F14's issue is that it can race an external system's own eventual consistency, which no amount of "call the revalidation function correctly" fixes without adding a retry/poll, a different kind of change than anything Next's revalidation APIs would offer here anyway.

### Projects surface

Same verdict; nothing distinct to add. `loadProject(id)` re-called after a visibility save (Part 5) is this surface's revalidation-equivalent, and it's a plain, correctly-placed explicit re-fetch — the same shape as everywhere else in this document.

### Connectors surface

Same verdict; `updateConnector`/`unlinkConnector` busting the catalog cache on success (Part 3's F2 cache) is this surface's revalidation-equivalent, and it's called correctly from both mutation paths. Nothing distinct to add — F15's problem is cancellation, not revalidation.

### Brain surface

Same verdict, with the starkest version yet of the window-event-as-revalidation pattern already flagged in Part 2 §3 F3 for personas. `brain/threads/page.tsx` and `BrainSidebarSections.tsx` have no shared context at all — they stay in sync purely through three separate custom window events (`BRAIN_THREAD_CREATED_EVENT`, `_TITLE_UPDATED_EVENT`, `_DELETED_EVENT`), each triggering the other surface's own independent `listBrainChats()` refetch. Where F3 found one event standing in for one `invalidateQueries` call, this is three events standing in for what a single shared `useQuery` subscription (with each mutation's `onSuccess` invalidating it) would give both surfaces automatically and atomically, with no risk of one event type being added for a new mutation and forgotten for the other.

### Slack surface

Same verdict; the poll loop in F17 is this surface's version of "check until the state I care about changes," which is the same underlying shape as revalidation without any Next.js-cache mechanics involved. Nothing further.

### Automations surface

Same verdict; nothing distinct to add.

### Memory surface

Not applicable — no cache, no Server Action, nothing to revalidate. Nothing to add.

### Organizations surface

Same verdict; `refreshMembers()` bumping a shared `planRefreshToken` (`org-context.tsx:210-212`) is this surface's manual revalidation call. One small naming nit worth a mention: calling it `refreshMembers()` when it actually re-triggers *both* the members fetch and the plan fetch (they share one effect keyed on the same token, `:192-208`) could mislead a future caller who wants to refresh only one of the two. Not worth its own finding — just worth knowing before assuming the name describes its full scope.

### LLM models surface

A fourth confirmed instance of the window-event-as-invalidation pattern (Part 2 §3 F3 for personas; Brain's three-event version above): `MODELS_CACHE_BUSTED_EVENT`, dispatched by `bustModelsCache()` whenever `toggleBlockModel()` succeeds, exists purely so "already-mounted consumers... refresh their already-loaded — now stale — model list" (per its own code comment). Same shape, same fix (a shared `useQuery` subscription would make the event unnecessary), no new mechanism to describe.

### Team invite surface

Not applicable; no cache, no Server Action, nothing to revalidate.

### Persona shares (Super Links) surface

Consistent with the "no gap" verdict above, for a different reason than the persona surface: there's no cache here to invalidate (Part 3's finding), so there's nothing for a `revalidateTag`-equivalent to do. `agents/page.tsx`'s `handleRefreshDashboard()` (`agents/page.tsx:687-694`) — a manual refetch fired by a button, unconditionally re-pulling `fetchDashboard()` — is the closest hand-built analogue to `router.refresh()` anywhere in this app. It's a reasonable stand-in given there's no cache to invalidate today, but per Part 3's recommendation, a `useQuery`'s own `refetch()` would give the same button the same behavior for free once this data is on React Query.

---

## Part 5 — Error Handling

Unlike Parts 3–4, this guide is **not** gated behind Cache Components — `error.tsx`/`global-error.tsx`/`not-found.tsx` and the expected-vs-uncaught distinction apply to the App Router regardless of that flag, so this is the first of the five docs pages to check against fully live behavior.

### 1. Next.js guidance vs. current practice

| Next.js recommends | Current practice | Verdict |
|---|---|---|
| Expected errors (failed request, validation): model as a value, not a thrown/uncaught exception — `useActionState` for Server Function forms, or a conditional render off the response in a Server Component | No Server Actions (Part 2), so `useActionState` doesn't apply — but the client-side equivalent is in place and used consistently: every mutation call site catches its typed `ApiError` and shows `friendlyApiError(...)`'s message via `toast.error(...)`, exactly the "handle explicitly, don't let it crash" spirit of this section | **Met, via the Client Component path** |
| `notFound()` + `not-found.tsx` for "this resource doesn't exist" | Not used anywhere (no matches for `notFound(` or a `not-found.tsx` file in `src/app`). Chat/persona "not found" cases are instead surfaced as an inline message (`CHAT_NOT_FOUND_MESSAGE`, threaded through `friendlyApiError` in `client.ts`) rather than a route-level 404 | **Not a gap** — see [§2 F2](#2-findings-2) |
| Nested `error.tsx` per route segment, catching render-time exceptions with a fallback UI | **Zero `error.tsx` files anywhere in `src/app`** (confirmed by glob). A hand-built class-component boundary exists (`src/components/ErrorBoundary/index.tsx`) but is mounted in exactly one place | **Real gap** — see [§2 F1](#2-findings-2) |
| `global-error.tsx` as the root-layout backstop | Doesn't exist | **Real gap** — see [§2 F1](#2-findings-2) |
| Errors in event handlers / async code aren't caught by boundaries — catch manually with local state | Done correctly and consistently: every `apiFetch`/`apiFetchJson` call site is wrapped in `try`/`catch`, storing the failure as component/hook state (or a toast) rather than letting it throw uncaught | **Met** |
| `redirect()` for a Server Component's expected-error/auth-gate case | Used correctly in at least `app/page.tsx` and `app/(app)/brain/chats/page.tsx` | **Met** |

### 2. Findings

**F1 (High) — No `error.tsx`/`global-error.tsx` anywhere; the one hand-built boundary that exists covers a small fraction of the render tree.**

`src/components/ErrorBoundary/index.tsx` is a genuinely well-built boundary — a real class component with `getDerivedStateFromError`/`componentDidCatch`, plus a documented `key={pathname}` trick so the fallback clears itself on navigation without also (undesirably) resetting on a same-page `router.replace()` mid-stream. The problem isn't the component — it's that it's instantiated in exactly one place in the whole codebase, `app/(app)/layout.tsx:41`, wrapping only `{children}` *inside* `<AppLayout>`. Everything else has no fallback at all, custom or native:

- `AppLayout` itself (the sidebar/chrome) sits outside the boundary it wraps
- All ~10 context providers stacked above it in the same file — `OnboardingGuard`, `NavGuardProvider`, `OrgProvider`, `ProjectsProvider`, `ChatHistoryProvider`, `PinboardProvider`, `HighlightProvider`, `CompareProvider`, `ModelSelectorProvider`, `SearchProvider`, `ProjectPanelProvider` — are unprotected; a render-time exception in any one of them takes down the entire authenticated app shell
- The root `app/layout.tsx`'s own providers (`QueryProvider`, `MotionProvider`, `AuthProvider`, `MixpanelProvider`) are unprotected, and by construction *can't* be protected by anything placed inside that same layout
- Every route outside the `(app)` group — the `(onboarding)` flow, `/auth/*`, and the marketing `app/page.tsx` — has no boundary at all

Next's `error.tsx` file convention exists to solve exactly this without relying on someone remembering to wrap `{children}` by hand at the right layer: an `app/error.tsx` at the root, plus `app/(app)/error.tsx` nested one level inside the route group, would sit *around* the providers and layout chrome that the current hand-built boundary sits *inside of* — coverage the manual approach structurally cannot reach no matter where else it's added, short of wrapping each provider individually. `app/global-error.tsx` is the specific, documented answer for the one remaining hole: an exception in the root layout itself, which no `error.tsx` (app-level or route-level) can ever catch, because `error.tsx` boundaries sit inside the layout that renders them.

**F2 (Low, informational) — No `not-found.tsx`/`notFound()`, and that's the right call for this app's shape.** The docs' `notFound()` pattern fits "this URL segment doesn't correspond to a resource" (a slug with no matching post, e.g.). This app's closest analogue — a chat ID that doesn't exist or isn't accessible — is already handled as an *expected* error rather than a routing failure: `CHAT_NOT_FOUND_MESSAGE` flows through `friendlyApiError` in `client.ts` and surfaces as an inline message in the chat UI, which is arguably more correct here than a full 404 page would be (the user stays in the app shell with context, rather than landing on a dead-end page). Not a finding to act on — noted so a future pass doesn't add `not-found.tsx` reflexively just because the docs mention it.

### 3. Recommendation

1. Add `app/error.tsx` — a minimal fallback (can reuse the existing `ErrorBoundaryInner`'s markup) plus a `console.error`/logging call in a `useEffect`, matching the docs' own example almost verbatim. This alone gives every route the custom boundary doesn't reach a safety net for the first time.
2. Add `app/(app)/error.tsx` specifically to cover the ~10 context providers and `AppLayout` chrome that sit above today's hand-built `<ErrorBoundary>` — the one piece of coverage the manual approach can't provide from where it's currently mounted.
3. Add `app/global-error.tsx` as the last-resort backstop for the root layout itself.
4. Keep the existing `<ErrorBoundary>` where it is — its pathname-keyed remount behavior is real, deliberate value that a bare `error.tsx` doesn't replicate on its own (its own `retry()` re-renders in place; it doesn't reset on navigation) — but stop treating it as the app's only safety net now that the two `error.tsx` layers above would exist to catch what it can't.
5. Leave `not-found.tsx` alone per F2 — the inline expected-error pattern already in place is the better fit here.

### 4. Persona surface

**This surface is, incidentally, already inside the one boundary that exists.** Every route under `agent/configure/*`, `agents/*`, and `agents/basics/*` lives in the `(app)` route group, so — unlike the marketing or onboarding routes — a render-time exception in a configure tab's own component tree is caught rather than white-screening. The rest of F1's gap still applies exactly as written: the ~10 context providers and `AppLayout` chrome sitting *above* that boundary in `app/(app)/layout.tsx` are just as unprotected for a persona-page render as for a chat-page one, since it's the same layout file for both. Nothing new to recommend beyond §3's items 1–3.

**What is new here:** Part 2 §5 F5 — `handlePublish()`'s single `catch` for three sequential network calls, with "changes are saved" state committed before the call that can still fail — is a concrete instance of this section's central warning against letting an uncaught/undifferentiated failure stand in for "what actually happened." It's recorded in full in Part 2 to avoid duplicating the code walkthrough, but it belongs here as much as there: the fix (branch the catch on which step failed; defer the "clean" state update until publish itself succeeds) is exactly the "handle expected errors explicitly" principle this guide is about, applied to a plain client `try`/`catch` instead of a Server Function.

### Pins surface

**The single best-modeled expected-error case in the app, sitting right next to the least-modeled ones.** `pinboard-context.tsx`'s `load()` failure path (`:199-208`) does everything this section recommends: it catches the failure, sets an `isError` flag the context exposes as a first-class value (`isError: boolean` on `PinboardContextValue`, letting any consumer conditionally render off it exactly the way the docs' Server Component example does off a failed `fetch`), and shows a toast with a bound **Retry** action (`toast.error("Couldn't load your pins. Tap to retry.", { action: { label: "Retry", onClick: () => load(false) } })`) — a genuinely better failure UX than the bare `toast.error(message)` used almost everywhere else in this app, including elsewhere in this same file.

That contrast is the point: Part 2's F8 is this same section's concern from the other direction. `removePin`/`removePinByMessage`'s failure toasts are at least user-visible, if not correctly rolled back; `updatePinTags`/`updatePinComment`'s `console.error`-only handlers mean a failed mutation is invisible to the user by design, not just under-handled — there's no expected-error modeling at all for those two paths, in a file that demonstrates elsewhere it knows how to do this well.

### Highlights surface

**A third clean instance of "model the error as a value" (`hasError` in `HighlightDataValue`), with one deliberate trade-off worth surfacing rather than fixing.** `highlight-context.tsx` exposes `hasError: boolean` alongside `isLoading`, distinct from a genuinely empty result, so `HighlightSidebar.tsx` can render a real error state with retry rather than a silent "nothing highlighted yet" — the same shape as Pins' `isError` and the docs' own conditional-render example. But `loadAll()`'s per-chat `.catch(() => [])` (Part 1's F10) means `hasError` can only ever reflect a failure in the outer `collectAllChatIds()` call (listing chats/personas) — a failure in any individual `getHighlights(id)` call is absorbed into an empty array for that chat and never surfaces, anywhere. That's the correct trade-off for the reason stated in F10 (one bad chat shouldn't blank the whole panel) — but it does mean a user viewing "All chats" has no way to know the view might be missing some chats' highlights; it will just look complete. Not urgent enough to warrant surfacing per-chat failures in the UI, but worth knowing before treating "All chats shows nothing for this highlight" as a report of a missing highlight rather than a possible silent fetch failure.

### Users surface

**A silent-failure gap in the one place a failure is hardest to notice, and a cross-reference to F11.** `refreshUser()`'s `catch` (`auth-context.tsx:257-259`) is `console.error` and nothing else — no toast, no retry, no `hasError`-style flag exposed on the auth context. Given how many places call it (Part 4) — a credits top-up, a Stripe return, an onboarding step — a failed refresh after any of those leaves the user silently looking at stale credits/plan data with zero indication anything went wrong, and no path to retry short of another trigger firing successfully later. This is a smaller-scoped version of the same "swallowed failure looks like success" shape as Highlights' F10 partial-failure gap and the Persona Shares `console.error`-only handlers — it keeps showing up as this codebase's most common error-handling gap, more so than any missing `error.tsx`.

Separately: F11 (Part 2) — the `handleDeleteAccount` stub — isn't really an error-handling problem at all, which is itself worth being precise about: there's no error to handle because the handler never attempts the mutation in the first place. It's recorded fully in Part 2 as a mutating-data finding; noted here only to explain why it isn't duplicated in this section.

### Stripe (billing) surface

**F13 (Medium-High) — Every Stripe mutation wrapper hand-rolls its own error-throwing instead of using `apiFetchJson`, and none of them go through `friendlyApiError` — for the app's highest-stakes failure messages.** `cancelSubscription()`, `resumeSubscription()`, and `chargeTopUp()` (`user.ts:700-732`, `:740-752`) each repeat the same shape:

```ts
const response = await apiFetch(ENDPOINT, { method });
let data = { status: "" };
try { data = await response.json(); } catch { /* non-JSON error body */ }
if (!response.ok || !data.status) {
  throw new Error(data.error || "Failed to <action>.");
}
```

This is a fourth reimplementation of the exact parsing logic `apiFetchJson` already centralizes (Part 2's F7 already found three: `revokeShare`, `deleteChat`, `deleteMessage`) — but unlike those three, **there's no 204-response reason for it here**: all three of these return a JSON body on success, so `apiFetchJson` would have worked directly. More importantly, none of these `throw new Error(...)` calls ever pass through `friendlyApiError()` (`client.ts`) — the one function this entire document has credited, in Part 1's "what's already right," as the correct place for translating raw backend/network text into user-appropriate copy (401 → "session expired," 402 → "out of credits," etc.). Every caller of these three functions catches with `err instanceof Error ? err.message : 'fallback'` and shows that directly in a toast (`settings/(shell)/billing/page.tsx:443-444`, `:457-458`, `:471-472`; `BuyCreditsModal/index.tsx:118`) — meaning a cancel, resume, trial-claim, or charge failure surfaces whatever raw string the backend happened to send, unfiltered, for the one category of failure — real money — where a confusing or overly technical message matters most. **Recommendation:** route these four functions through `apiFetchJson` (once F7's empty-body-safe variant exists, `cancelSubscription`/`resumeSubscription`/`chargeTopUp` don't even need it — they all return real bodies) so their failures get `friendlyApiError`'s translation for free, the same as every other mutation in this app.

**Also relevant here:** F12 (Part 2) is this section's concern from another angle — an SCA-required charge response is neither an error nor a success, and nothing here models it as either, which is exactly the gap this guide's "handle expected errors explicitly" principle is written to prevent.

### Projects surface

**This is the third documented real incident from the exact bug class F7/F13 describe — not a hypothetical.** `setProjectVisibility()` (`projects.ts`) manually checks `res.ok` on a raw `apiFetch` call instead of using `apiFetchJson`, and per [projects-endpoints-usage.md](./projects-endpoints-usage.md#patch-projectsproject_idvisibility-set-project-visibility), the reason is explicit: *"the endpoint returns `204`... a prior bug silently swallowed a non-owner's 403 by trying to parse an empty body."* That's `apiFetchJson`'s exact failure mode (F7: it always calls `.json()` on the response, which throws — or, worse, silently produces the wrong result — on a body-less response) having already caused a real, shipped bug in this specific function, independently of the three call sites F7 already named (`revokeShare`, `deleteChat`, `deleteMessage`) and the four named in F13 (`cancelSubscription`, `resumeSubscription`, `chargeTopUp`). That's now four unrelated features that have each hand-rolled the identical workaround for the identical gap in `apiFetchJson`, and at least one of them only after it caused a live incident (a permissions error being silently dropped, which is a security-adjacent failure mode, not just a UX rough edge). **This raises F7's priority** — it's no longer just "this would be nicer to consolidate," it's "this exact gap has already caused a real bug in production, in a way that hid a permissions failure from the user."

### Connectors surface

**F15's consequence from this section's angle: success/failure callbacks can fire against a component that's already gone.** Because `AddSharedAccountModal`'s poll (Part 1's F15) has no unmount guard, closing the modal mid-poll doesn't stop `toast.success('Shared account created')`, `onCreated()`, or `onClose()` from firing once the background `await` finally resolves — none of which is wrong in the sense of throwing an error, but a success toast landing well after the user closed the dialog and moved on to something else is a real instance of this guide's underlying concern: a result being reported somewhere the user isn't looking anymore. Contrast with `startOAuth`'s `abortedRef` check before every state-touching callback (`:792`, `:827`, `:838`, `:851`, `:870`, `:889`) — the fix here is the same pattern, not a new one.

**Worth crediting on its own:** the org poller's timeout message — *"OAuth flow timed out. The account was created; refresh the account list after finishing auth"* — is an honest, well-hedged acknowledgment of a genuinely ambiguous outcome (the account row exists; whether the OAuth grant landed is unknown), rather than a generic "something went wrong." Good copy for a case that doesn't have a clean success/failure answer, even though the mechanism producing it (F15) needs the fix described in Part 1.

### Brain surface

**F16, restated from this section's angle: this is this document's clearest violation of "model expected errors so the user finds out about them."** Every other error-handling finding so far involves a failure that's swallowed quietly (a console-only log, a generic toast) or a status that's left unhandled. `deleteBrainChat`'s consequence (Part 2) is a step further than either: the user is told, in an explicit success toast, that something happened which may not have. There's no ambiguity to hedge here the way Stripe's `client_secret` gap or the confirmation-page race required careful phrasing — the fix is purely mechanical (check `.ok`, throw), which is exactly why it's worth prioritizing alongside F12 in the roadmap rather than treating it as a lower-effort/lower-priority cleanup item.

### Slack surface

Nothing new — F17's in-flight-request-outlives-the-modal detail (Part 1) is a smaller-scale cousin of F16's "a callback fires against state nobody's looking at anymore" theme, not a distinct error-handling gap of its own. `handleRemoveSlack`'s post-delete re-verification (Part 2) is this surface's best example of the "don't just trust a 200, confirm the state actually changed" principle this guide is ultimately about — recorded there to avoid repeating the code walkthrough.

### Automations surface

Nothing new — `runAutomationNow`'s generic-message nuance (Part 2) is this surface's only rough edge, and it's a case of under-informing rather than mishandling; every other mutation here goes through the app's standard, correct error-translation path.

### Memory surface

F18 (Part 2) is this section's finding as much as Part 2's — a comment stating "errors should be visible" is the clearest possible statement of this guide's core principle, and the surrounding code not delivering on it is the clearest possible miss. Recorded in full in Part 2 to avoid repeating the walkthrough.

### Organizations surface

**Arguably the single best instance of "model an expected error as a value" in this entire document — because the value being modeled is a security-relevant one, not just UI content.** `org-context.tsx` exposes three distinct, purpose-built booleans rather than collapsing a fetch outcome into "loaded" vs. "not loaded": `roleError` (`:42-48`, true when the role fetch failed, so `orgRole`'s default `'member'` isn't mistaken for a confirmed answer), `orgRoleResolved` (`:49-55`, true only when the backend returned a *definitive* role — false means "unknown, don't gate on it"), and `orgPlanSettled` (`:56-60`, true once the plan fetch finishes either way, so a failed billing fetch can't block the billing page's render gate forever). Each has a doc comment explaining exactly how a consumer should treat it — "billing gates should treat this as 'role unknown' and fall back to optimistic access" — which is the docs' own "conditionally render an error message" guidance applied to an authorization decision instead of a content one: getting this wrong in the conservative direction (assuming a role when it's actually unknown) is a permissions bug, not just a UX rough edge, and the code is written with that distinction clearly in mind throughout.

### LLM models surface

F19 (Part 1) restated from this section's angle: collapsing "failed" and "empty" into the same `[]` result is the direct opposite of this guide's core advice to model expected errors explicitly. It's a quieter version of the theme than F16/F18 (nothing reports false success; it just under-reports genuine failure), but the fix is the same family — give the caller enough information to render a real error state instead of a state indistinguishable from "you have no models," which for a model picker is a confusing thing to show for the wrong reason.

### Team invite surface

Two things worth separating, both already recorded elsewhere. The invite-preview state machine (Part 1) is a good, correct example of this section's core guidance. The `handleAccept()` finding (Part 2) is this section's concern too — a generic catch message that actively misleads the user about what state they're actually in after a partial failure — but it's the same finding as F5, not a new one, so it's recorded once, in Part 2.

### Persona shares (Super Links) surface

**The best example in this app of the docs' "conditionally render an error message" pattern, and a good illustration of what happens when it's skipped.** `share/[id]/page.tsx` (Part 1's Persona Shares subsection) is the one place that maps every distinct failure mode of a fetch to its own UI: 404 → "Link not found," 410 → "This link has expired," 402 on accept → a specific credits-exhausted message, anything else → a generic retry card. That's exactly the docs' Server-Component conditional-render example, just written by hand in a Client Component. `agents/page.tsx`'s Super Links tab, fetching from the same `persona-shares.ts` module a few components away, does the opposite: `listReceived()`/`listShares()`/`fetchDashboard()` failures go to `console.error` and nothing else, so a real failure and "you have no shares yet" render identically. Neither call site is wrong in isolation, but the gap between them is worth closing — see Part 1's Persona Shares subsection for the specific lines.

**Also relevant here, not just an auth concern:** `OnboardingGuard`'s redirect-before-render for `/share/[id]` (Part 1) means none of `share/[id]/page.tsx`'s carefully-built error states — the exact pattern this section recommends — are reachable by an unauthenticated visitor in the first place. A well-built expected-error UI that a real user can't reach is a smaller version of having none at all.
