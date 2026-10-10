# Frontend Features

Inferred from the route structure in `src/app` and component names in `src/components`. Not yet verified against page code.

## Core
- **Chat** (`chat`, `chats`, `chat-shares`): AI chat with streaming, message bubbles, context indicator and panel, browser panel, approval cards, link side panels. Chat selection, move to project, shared chats.
- **Compare** (`compare`): side-by-side model comparison.
- **Agents** (`agent`, `agents`): agent editor, agents panel, share modal, change/fix agent model flows.
- **Projects** (`project`, `projects`): create, edit, delete, leave projects; move chats into them.
- **Templates** (`template`): stored model-written HTML pages (dashboards/reports) shared by link, served in a sandboxed iframe. See the Templates audit below.
- **Schedules** (`schedules`): scheduled runs.
- **Pinboard** (`Pinboard`, `Pin`, `PinCategory`, `PinCommentField`): pins, categories, comments. Highlights (`HighlightCard`, `HighlightPanel`) appear related.
- **Global search** (`GlobalSearchModal`).

## Integrations
- **Connectors** (`connectors`): catalog, browse, status, paused state, requests.
- **Slack** (`slack`, `souvenir-slack`): Slack connector and sidebar entry.
- **AI Models view** (`AiModelsView`, `ModelFeaturedCard`): model selection and catalog.

## Teams and Accounts
- **Auth** (`auth`): Auth0 login, logout, access token.
- **Onboarding** (`onboarding`, `welcome`): onboarding flow, Meta Pixel tracking.
- **Organizations** (`org`, `org-invite`, `team-invite`): invites, leave workspace, org badges.
- **Settings** (`settings`): account menu and settings pages.
- **Credits and billing**: credit status banner, exhaustion banner, inline credit notice, card brand logos, contact sales modal.

## Other
- **Analytics** (`Analytics`, `ChartCard`, `DeltaPill`, `DateRangePill`): usage dashboards.
- **Notifications** (`NotificationBell`, `NotificationPanel`).
- **Prompt enhancement** (`EnhancePromptField` and related components).
- **Personas** (`PersonaCard`, `api/persona-chat`) and **Share** (`share`).
- **Internal / API routes**: `dev`, `reasoning-verify`, `api/chat`, `api/backend`, `api/download`, `api/lab`, `api/template`, `dispatch`.

---

## Chat System Design Audit (2026-10-10)

Full report: [chat-system-design-audit.md](audits/chat-system-design-audit.md)

### Overall efficiency: ~56% (24.7 / 44 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 6 | 2.5 | 42% |
| 2. Architecture | 8 | 4.6 | 58% |
| 3. Component Patterns | 3 | 1.7 | 57% |
| 4. Data Model | 9 | 5.4 | 60% |
| 5. Interfaces and APIs | 7 | 5.4 | 77% |
| 6. Optimizations | 11 | 5.1 | 46% |

Not applicable to chat (12): SSG, ISR, Monorepo, HOC, Polymorphic, Redux vs MobX, REST vs GraphQL (decision made: REST + SSE), tRPC, WebSocket (SSE chosen instead), Micro-Frontends, Tree-shaking as a standalone chat concern, PWA offline (low value for live AI chat).

---

### 1. Already applied well

| Principle | Evidence |
|---|---|
| CSR for the chat surface (#2) | `chat/page.tsx` is `"use client"`; the server layout only reads the sidebar cookie (hybrid shell) |
| Real-time state (#36) + streaming transport | SSE via `/api/chat`, AG-UI schemas validated with Zod (`lib/agui/schemas.ts`, `sse-schemas.ts`), `stream-registry` tracks in-flight streams across reloads (sessionStorage) |
| BFF (#41) | `/api/chat`, `/api/backend/[...path]` proxy routes keep tokens and backend origin off the client |
| Authentication (#42) | Auth0 server-side session, JWT never hand-stored |
| API-layer error handling (#45) | `api-client.ts`: timeout, retry with exponential backoff, circuit breaker, rate limiting; `http-errors.ts`, `model-error.ts` |
| Cursor pagination (#39) | `use-chat-history` uses `next_cursor` |
| Custom hooks as abstraction (#40) | `use-streaming-chat`, `use-chat-state`, `use-message-queue`, `use-file-upload` |
| List virtualisation (#51) | `useVirtualizer` for messages in `ChatInterface`, plus `stick-to-bottom` logic |
| React performance (#50) | React Compiler enabled; `memo` on `ChatMessage`, `ResponseBlocks`, `ChatRow` |
| Debounce/throttle (#53) | `lib/throttle.ts` |
| Lazy loading (#48), partial | Map (`XmlMap`) and preset model dialog are lazy |
| Frontend security (#21) | CSP built from env, HSTS, X-Frame-Options, KaTeX output sanitised with DOMPurify |
| Local storage choices (#32) | Centralised `storage-keys.ts`; sessionStorage for per-tab in-flight flag |
| Optimistic updates (#33) | Present in chat/project/share pages |
| URL as state (#34) | Chat id and `useSearchParams` drive routing |
| Provider pattern (#24) | Context layer (chat-history, model-selector, highlight, pinboard, etc.) |
| Design system / styles (#15, #16) | Shared component folder, tokens, Tailwind, theme scripts |
| Testing around streaming | `sse-decoder`, `streaming`, `use-streaming-chat`, `ChatInput.*` tests (25 chat-related test files) |

### 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | God files: `ChatInterface` 1840 lines, `use-streaming-chat` 1675, `ChatMessage` 1482, `ChatInput` 1156, `chat/page` 1017 | Split by responsibility (see plan, phase 2) |
| Container/Presentation (#22) | Data fetching, side effects and markup mixed in `chat/page` and `ChatInterface` | Extract container hooks; leave presentational components pure |
| Code splitting / bundle splitting (#46, #52) | `katex` and `beautiful-mermaid` are statically imported in chat; Recharts/chart widgets only partly deferred | `next/dynamic` / `import()` for KaTeX, Mermaid, charts, `html2canvas`/`jspdf` (export only) |
| Image optimisation (#49) | `next/image` used for attachments, but raw `<img>` for favicons in `ActivityRow` | Acceptable for external favicons; add explicit width/height and `loading="lazy"` (verify) |
| Error boundaries (#19) | Only at layout level (`AppLayout`, settings). No `error.tsx`, `global-error.tsx`, `loading.tsx` anywhere in `app/` | Add route-level `error.tsx` for chat, and a boundary around each widget renderer (Mermaid, Map, Chart, Table) so one bad block does not blank the chat |
| Accessibility (#20) | `aria-live` only on status text; the streaming transcript itself has no `role="log"`; no evidence of focus management on stream end (verify keyboard flow) | `role="log"` + `aria-live="polite"` on the message list, announce completion, test with a screen reader |
| Observability (#55) | `logger.ts` and Mixpanel only. No error tracking, no Web Vitals, no stream-level metrics | Add error reporting, `useReportWebVitals`, custom metrics (time to first token, stream error rate) |
| CI/CD (#18) | Only React Doctor, advisory (non-blocking). No lint/typecheck/test/build gate | Workflow: `tsc`, `eslint`, `vitest`, `next build`, bundle check |
| Provider pattern (#24) | 17 contexts at app level, a likely cause of broad re-renders (verify) | Narrow context value scope; move hot state to selector-based stores |
| Real-time resilience (#36, #44 principles) | No evidence of resuming a dropped SSE stream (no `Last-Event-ID`, reconnect) beyond the in-flight flag | Add resume/reconnect protocol (needs backend support) |
| Form state (#35) | Zod used for SSE/billing only; chat input and attachments are hand-managed | Zod-validate attachment constraints and slash/mention input |
| Normalisation (#31) | Messages held as arrays; replacement by id exists (`replace-message-id`) | Normalise by id + order array if message edits/branches grow (verify) |

### 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Server state (#30, #38) | `@tanstack/react-query` is a dependency and `QueryProvider` exists, but only `lib/queries/personas.ts` uses it. Chat history is hand-rolled (`use-chat-history`: `useRef` cursor + manual fetch + context) | Move chat list, chat detail and project data to `useInfiniteQuery` / `useQuery` with keys, stale time, invalidation, optimistic updates via `onMutate`. This replaces the hook and the history context |
| State in giant components | ~15 `useState` + ~31 `useEffect` in `ChatInterface`, 20/12 in `chat/page` | Replace with a reducer or a small store for chat UI state; derive instead of syncing in effects |
| Global state (#28) | Hand-written `useSyncExternalStore` stores (`chat-context-store`, `active-chat-agent-store`) | Fine technically; either standardise on Zustand (matches the principle) or document the convention. Do not mix three approaches (context, custom stores, hooks) |
| Retry on non-idempotent calls | `api-client` retries 3x by default; confirm POST `/chat` and message sends do not retry and duplicate (verify) | Retry only idempotent GETs, require idempotency keys for sends |
| Injected HTML | `MermaidDiagram` and `CodeBlock` use `dangerouslySetInnerHTML` without the DOMPurify step KaTeX has | Sanitise SVG/hljs output or confirm the libs escape (verify) |
| Heavy-dep imports in chat | Static `katex`, `beautiful-mermaid` at top of chat renderers | Dynamic import (see above) |
| Two icon libraries + lucide | `@hugeicons`, `lucide-react`, `@strange-huge/icons` all shipped | Pick one; direct named imports to keep tree shaking effective |
| Large dependency footprint for chat route | `html2canvas`, `jspdf`, `pdfjs-dist`, `maplibre-gl`, `recharts` in package set | Ensure none are in the initial chat chunk (analyze with `ANALYZE=true`) |

### 4. Missing, to add

| Principle | Add |
|---|---|
| `useTransition` / `useDeferredValue` (#54) | Defer markdown re-parse while streaming; transition for chat switching and search |
| Core Web Vitals (#8) | Measure INP (typing and streaming), LCP, CLS; set targets |
| Performance budget + CI (#56) | Bundle-size limit on the chat route, Lighthouse CI |
| Suspense / streaming UI (#7) | `loading.tsx` plus Suspense skeleton for chat history and chat open |
| Service worker / caching (#10) | Optional: cache static shell and assets; not message data |
| CDN/edge (#9) | Verify cache headers for static assets and `Cache-Control: no-store` on streaming routes |
| `error.tsx`, `not-found.tsx`, `global-error.tsx` | App Router error surface |
| Widget-level error isolation | Boundary per rendered block |
| Message streaming batching | Coalesce token updates per animation frame so re-renders do not scale with tokens (verify whether already done in `use-streaming-chat`) |
| Resumable streams | Reconnect with last event id |
| Storybook/visual tests for message blocks | Guards the 20+ `Xml*` widgets |

---

### Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week. Score gain is estimated against the 44-point scale.

### Phase 1: Quick wins and safety (S, 56% → ~66%)
1. Add `error.tsx` / `loading.tsx` / `not-found.tsx` for chat routes, plus per-widget ErrorBoundary around Mermaid, Map, Chart, Table. (+1.0)
2. Sanitise Mermaid SVG and code HTML, or document why safe. (+0.5)
3. Dynamic-import KaTeX, Mermaid, charts, export libs; run bundle analyzer to confirm. (+1.0)
4. `role="log"` + announcements on the transcript. (+0.5)
5. Confirm and fix retry on non-idempotent sends. (+0.5)
6. Wrap markdown re-render in `useDeferredValue` / `startTransition` during streaming. (+1.0)
7. Real CI workflow: typecheck, lint, test, build; make React Doctor blocking on errors. (+1.0)

### Phase 2: Data layer (M, → ~78%)
1. Migrate chat list/detail/projects to React Query (infinite query, keys, invalidation, optimistic mutations). Remove `use-chat-history` and `chat-history-context`. (+1.5)
2. Define a query-key factory and standard error/retry policy in one place. (+0.5)
3. Choose one global-state approach (Zustand recommended) for chat UI state and migrate the custom stores. (+1.0)
4. Narrow context scopes; measure re-renders with React Profiler. (+0.5)
5. Zod-validate input/attachment boundaries. (+0.5)

### Phase 3: Component architecture (L, → ~90%)
1. Split `use-streaming-chat` into transport (SSE + decoder), reducer (event → state), and side effects (analytics, queue, credits). Target < 300 lines each. (+1.0)
2. Split `ChatInterface` / `ChatMessage` / `ChatInput` / `chat/page` into container hooks + presentational components; target no file over ~400 lines. (+1.5)
3. Replace effect-driven syncing with reducers/derived state. (+0.5)
4. Unit-test the extracted reducer and transport; add stream-chaos tests (drop, duplicate, out-of-order events). (+0.5)

### Phase 4: Resilience, observability, performance governance (M, → 100%)
1. Error tracking and Web Vitals reporting; custom metrics (time to first token, stream error rate, reconnects). (+1.0)
2. Resumable SSE (needs backend `Last-Event-ID` or cursor support, backend is read-only for us, so request it). (+0.5)
3. Performance budget and Lighthouse CI on the chat route; INP target < 200 ms during streaming. (+1.0)
4. Icon library consolidation; verify tree shaking with analyzer. (+0.5)
5. Cache-header audit, optional service worker for the static shell. (+0.5)
6. Visual regression/Storybook for message widgets; accessibility audit with axe plus manual screen-reader pass. (+0.5)

Re-score after each phase using the table above; every "(verify)" item should be settled in Phase 1 so the baseline is firm.

---

## Compare System Design Audit (2026-10-10)

Full report: [compare-system-design-audit.md](audits/compare-system-design-audit.md)

### Overall efficiency: ~43% (15.5 / 36 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.5 | 50% |
| 2. Architecture | 8 | 3.1 | 39% |
| 3. Component Patterns | 3 | 1.3 | 43% |
| 4. Data Model | 7 | 2.5 | 36% |
| 5. Interfaces and APIs | 6 | 3.2 | 53% |
| 6. Optimizations | 9 | 3.9 | 43% |

Not applicable: SSG, ISR, SSR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, list virtualisation (a handful of columns), cursor pagination.

---

### 1. Already applied well

| Principle | Evidence |
|---|---|
| Code splitting / lazy loading (#46, #48) | `CompareModels` is `dynamic()`-imported in `AppDialogs` with a comment that it pulls ~10MB (6.5MB gzip) of `@strange-huge/icons/llm` |
| Provider pattern (#24) | `compare-context.tsx` is a small 33-line open/close context, scoped correctly |
| Streaming transport reuse (#44 principles) | Uses the shared `AguiSSEDecoder` (`lib/sse-decoder`), abortable via `AbortController`, reader cancelled in `finally` |
| Frontend security (#21) | `sanitizeKaTeX` and `sanitizeURL` on rendered math and links |
| BFF (#41) / auth (#42) | Requests go through the app's own routes (`/api/chat`, `/api/lab`) |
| Reuse on the `/compare` page | Reuses `useStreamingChat`, `ChatMessage`, `ChatInput`, `InitialPrompts`: the right pattern |
| Analytics | `trackBrowserEvent` for pin creation |

### 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | One 2034-line file holds chips, markdown renderer, code block, model card, reasoning view, mic/audio recorder, filters, grid, results view, and the stream handler | Split into `ModelPicker`, `ResultsGrid`, `ModelColumn`, `PromptBar`, `VoiceInput`, `useCompareRun` |
| Local state (#27) | 26+ `useState` in one component; several `Record<modelId, X>` maps updated in parallel (responses, reasoning, credits, messageIds, connect prompts, permission prompts) | One reducer or one `Record<modelId, RunState>` |
| Error boundaries (#19) | Layout-level only. A crash in the custom renderer blanks the modal | Boundary around each model column |
| Accessibility (#20) | `aria-label` on a few buttons, `aria-pressed` on cards; no `aria-live` for streaming columns; no focus trap/ESC behaviour confirmed (verify); fixed-size layout | Live region per column, dialog semantics, focus trap (`use-focus-trap` hook already exists) |
| Real-time state (#36) | Streams per model in parallel, but each token calls `setTestResponses({...streamingResponses})`, re-rendering every column | Per-column state or a store with selectors; batch per animation frame |
| Style management (#16) | Inline `style={{...}}` objects (e.g. fixed `width: 1212`, `height: 98vh`) mixed with a CSS module and Tailwind classes | Move to tokens + Tailwind or the CSS module; responsive layout |
| Observability (#55) | One event; errors go to `console.error` | Track run started/finished/failed, per-model latency |
| Optimisation of re-renders (#50) | `ModelCard` etc. not memoised (React Compiler is on, but inline closures in a 2000-line component limit its effect) | Split components so the compiler and `memo` can help |

### 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Custom markdown renderer inside the file (lines ~224-540) | A second hand-written markdown/table/code/LaTeX renderer duplicates `lib/markdown-utils`, `content-renderer`, and the chat `ChatMessage`; will drift from chat output, misses features (citations, widgets, highlights) | Render with the shared chat renderer (`/compare` page already does this via `ChatMessage`) |
| Hand-rolled fetch + event handling | Raw `fetch` and its own event mapping (`handleEvent`, `processDecodedEvent`) instead of `useStreamingChat` / `api-client` (no retry, timeout, circuit breaker, no shared AG-UI schema validation) | Reuse the streaming hook or extract a shared transport from `use-streaming-chat` |
| Errors stored as response text | `"Error: 500"`, `"Error: Failed to get response"` are written into the same map as answers, so the UI cannot style or retry them | Typed state: `{status: "streaming" \| "done" \| "error", text, error}` with per-model retry |
| Server data in `useEffect` | Model list fetched in an effect with `.catch(() => {})` (line ~871) | `useQuery` for models (shared with the model selector) |
| `/compare` page exposure | A routing-lab tool that calls a local lab on `:8777` is a normal app route; unclear whether it is gated by environment/flag (verify) | Gate behind a flag or dev-only route; remove from production build |
| No tests | Zero test files for compare (chat has 25) | Tests for stream handling and model filtering |
| Fixed-width modal | `width: 1212` inline breaks on small screens | Responsive container |

### 4. Missing, to add

| Principle | Add |
|---|---|
| Server state (#30, #38) | React Query for the model catalog and any run history |
| URL as state (#34) | Selected models and tab in the URL so a comparison is shareable |
| Form state / validation (#35) | Zod for prompt, image paste limits, model-count limits |
| Suspense / loading (#7) | Skeleton for the lazily loaded modal instead of a blank wait |
| Core Web Vitals (#8), perf budget (#56) | Measure modal open time and INP while 3-4 models stream |
| `useTransition` (#54) | Defer filtering/search of the model grid |
| Persistence (#32) | Remember last selected models (storage-keys) |
| Error UX | Per-model retry, partial failure (one model fails, others finish) |
| Bundle check | Verify the 10MB LLM icon set is split by provider or sprited, not shipped wholesale |

---

### Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Safety and quick wins (S, 43% → ~55%)
1. Add a per-column ErrorBoundary and a Suspense skeleton for the lazy modal. (+1.0)
2. Replace string errors with typed per-model state and retry. (+0.5)
3. Gate or remove the `/compare` lab route in production. (+0.5)
4. Add `aria-live` regions, dialog semantics and focus trap. (+1.0)
5. Add tests for the stream handler, model filtering and error states. (+1.0)
6. Verify the icon bundle (analyzer), split by provider if needed. (+0.5)

### Phase 2: Remove duplication (M, → ~70%)
1. Swap the custom markdown renderer for the shared chat renderer; delete ~320 lines. (+1.5)
2. Extract a shared streaming transport (from `use-streaming-chat`) and use it here, gaining retry, schema validation and the shared AG-UI mapping. (+1.5)
3. Model catalog via React Query, shared with the model selector. (+1.0)
4. Per-model run state in a reducer/store; stop re-rendering all columns per token. (+1.5)

### Phase 3: Component architecture (M-L, → ~88%)
1. Split `CompareModels` into the six units listed above; no file over ~400 lines. (+2.0)
2. Move inline styles to tokens/Tailwind; make the layout responsive. (+1.0)
3. Zod validation at input boundaries; URL state for selection. (+1.0)
4. `useTransition` for filter/search. (+0.5)

### Phase 4: Governance (S-M, → 100%)
1. Analytics for run lifecycle and per-model latency/failure; Web Vitals for modal open and streaming INP. (+1.0)
2. Performance budget for the compare chunk in CI. (+0.5)
3. Persist last selection in storage; document the compare conventions in the design docs. (+0.5)
4. Accessibility audit (axe plus screen-reader pass). (+0.5)

Re-score after each phase and settle all "(verify)" items first.

---

## Agents System Design Audit (2026-10-10)

Full report: [agents-system-design-audit.md](audits/agents-system-design-audit.md)

### Overall efficiency: ~43% (16.5 / 38 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.5 | 50% |
| 2. Architecture | 8 | 3.2 | 40% |
| 3. Component Patterns | 3 | 1.2 | 40% |
| 4. Data Model | 9 | 3.8 | 42% |
| 5. Interfaces and APIs | 6 | 3.9 | 65% |
| 6. Optimizations | 9 | 2.9 | 32% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination.

Size context: ~23,400 lines in the agent surface. Largest files: `agents/page.tsx` 2359, `configure/instructions/page.tsx` 1891, `configure/layout.tsx` 1350, `configure/context.tsx` 1164, `PersonaCard/index.tsx` 1042, `lib/api/personas.ts` 1553.

---

### 1. Already applied well

| Principle | Evidence |
|---|---|
| API-layer separation (#40, #45) | All HTTP in `lib/api/personas.ts` via `apiFetch`/`apiFetchJson`; components never call `fetch` directly |
| Runtime validation (#35 Zod) | Responses parsed with `personaRepoSchema` / `personaVersionSchema` before use |
| Non-2xx guard | Delete/pause/visibility explicitly check `res.ok` because `apiFetch` does not throw |
| BFF / auth (#41, #42) | Calls go through the app's proxy with the Auth0 session |
| Server-state start (#30) | `usePersonas()` in `lib/queries/personas.ts` is a clean shared cache entry with an event-to-invalidation bridge |
| Cache dedupe | 30s TTL plus in-flight dedupe for persona list and detail |
| URL as state (#34) | Editor is route-based (`/agent/configure/...`, `/agents/[id]/edit`), tabs and repo in the URL |
| Navigation guard | `useNavGuard` dirty-state interception for unsaved edits |
| Virtualisation (#51) | `useVirtualizer` on the agents list |
| Reduced motion (#20) | `useReducedMotion` in the animated avatar and hero scenes |
| Tests | 15 test files (page tests for new/edit/templates, AgentEditor, CreateAgentInChat, sidebar) |
| Helper separation | Pure logic lives in `lib/agent-*.ts` (draft, save, sync, intent, generate), each small |

### 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | Four files over 1,000 lines mixing data, state, effects, markup; `agents/page.tsx` has 33 `useState` + 12 `useEffect` | Split into container hook + presentational sections (filters, grid, empty states, dialogs) |
| Local state (#27) | `configure/context.tsx` 37 `useState` + 20 `useEffect`; `instructions/page.tsx` 26 + 26 | `useReducer` per concern (draft, test-chat, tabs); derive instead of syncing in effects |
| Provider pattern (#24) | One 1,164-line context carries editing state, test-chat streaming, tab visits, model fetch, nav guard | Split into draft, test-chat and tabs providers so consumers re-render selectively |
| Server state (#30, #38) | React Query only in `usePersonas`, used by 3 files (sidebar, context panel, identity); the list page, editor, templates, search/highlight contexts call `fetchPersonas`/`getPersonaRepo` directly | Move detail, versions and list consumers to queries; then retire the window event |
| Storage (#32) | Ad-hoc keys such as `persona_configure_saved_${repoId}` in localStorage and visited-tabs in sessionStorage, outside `storage-keys.ts` | Centralise keys; add versioning/cleanup for per-repo keys (they accumulate) |
| Optimistic updates (#33) | Partial; pause/delete/publish bust the cache then refetch | `onMutate` + rollback via mutations |
| Error boundaries (#19) | Layout-level only | Boundary per tab and around the test-chat pane |
| Accessibility (#20) | Few `aria-*` in the list page (12 hits across 2359 lines); drag/carousel/avatar pickers need keyboard and label review (verify) | Roles, keyboard paths, live region for test-chat stream and autosave status |
| Images (#49) | Mixed `next/image` and raw `<img>` (1 raw in PersonaCard/list) | Standardise; set sizes |
| Observability (#55) | Analytics on new/templates pages only | Track create, publish, test-run, save failures |

### 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Two editors in parallel | New `AgentEditor`/`agents/[personaId]/edit` plus legacy `/agent/configure` (instructions, profile, knowledge, connectors, sharing) ship together | Set a deprecation date; route all entry points to one editor; delete the other (about 8-10k lines) |
| Double caching | Hand-rolled TTL cache in `personas.ts` sits under React Query, which then needs `retry: false` to preserve old behaviour and a `window` event bridge to invalidate | One cache: React Query. Drop `_personasCache`, the in-flight maps and the event |
| Custom event bus for invalidation | `PERSONAS_LIST_UPDATED_EVENT` on `window` is a hidden global dependency | Query invalidation from mutations |
| Giant API module | `lib/api/personas.ts` is 1,553 lines (repos, versions, knowledge, sharing, streaming, caching, copy-dedupe) | Split by resource: repo, versions, knowledge, sharing, stream, cache |
| Autosave and save logic spread across files | Autosave in Instructions tab, tab-switch autosave in layout, dirty tracking in context, nav guard elsewhere (verify the conflict paths) | One save state machine (idle, dirty, saving, saved, error) with a single owner |
| Raw `fetch` in API module | `urlToImageFile` and another path use plain `fetch` (lines ~505, 553), bypassing `apiFetch` retry/auth handling | Use the shared client, or document why not |
| Static preset data | `template-presets.ts` is 337 lines of content in the client bundle | Serve templates from the backend or lazy-load |
| Heavy decorative components in main chunk | `PersonaCard` plus `scenes.tsx` and `job-scenes.tsx` (about 2,500 lines) with framer-motion | Lazy-load scenes; render a static avatar first |

### 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46, #48) | No `dynamic()`/`lazy` in the agent surface: split each configure tab, share modal, FineTune and Example-conversation modals, avatar scenes |
| `useTransition` (#54) | Filtering/searching agents, tab switching |
| Debounce (#53) | Verify list search and handle availability check are debounced |
| Form state (#35) | React Hook Form + Zod for profile/instructions (many fields, 26 states in one page) |
| Core Web Vitals / perf budget (#8, #56) | Budget for list and editor routes; INP while typing instructions |
| Suspense / loading (#7) | `loading.tsx` and skeletons for list/editor |
| `error.tsx` per route | List, edit, configure |
| Data normalisation (#31) | Normalise personas by id so list, sidebar, editor and search read the same record |
| Permissions layer | One `can(user, action, persona)` helper (owner vs team copy vs viewer) instead of scattered checks (`isPersonaOwnedByViewer`, role checks) |
| Test coverage | Context (draft/save/autosave), `personas.ts` caching, sharing modal, model-health fix flows |

---

### Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 43% → ~55%)
1. Add `error.tsx` / `loading.tsx` for `agents`, `agents/[id]/edit`, `agent/configure`; error boundary around test-chat. (+1.0)
2. Dynamic-import configure tabs, modals and avatar scenes; check with the bundle analyzer. (+1.5)
3. Move per-repo storage keys into `storage-keys.ts` with cleanup. (+0.5)
4. Debounce/`useTransition` on list search and filters. (+1.0)
5. Aria roles, keyboard paths, live region for save status and test-chat. (+1.0)
6. Decide and publish the legacy-editor retirement date. (+0.5)

### Phase 2: Data layer (M, → ~68%)
1. Migrate list, detail, versions and templates reads to React Query; add mutations (create, pause, delete, publish, visibility) with optimistic updates and rollback. (+2.0)
2. Delete the hand-rolled TTL cache, in-flight maps and `PERSONAS_LIST_UPDATED_EVENT`. (+1.0)
3. Split `lib/api/personas.ts` by resource and keep Zod parse on every response. (+0.5)
4. Normalised persona selectors shared by list, sidebar, search, highlight context. (+0.5)
5. Central `can()` permission helper. (+0.5)

### Phase 3: Consolidate editors and components (L, → ~88%)
1. Migrate remaining legacy tabs (knowledge, connectors, sharing) into the new editor, then delete `/agent/configure`. (+2.0)
2. Split `agents/page.tsx` and `PersonaCard` into container hooks + presentational parts, nothing above about 400 lines. (+1.5)
3. Replace the 1,164-line context with three focused providers plus a save state machine. (+1.5)
4. React Hook Form + Zod for profile/instructions/sharing forms. (+1.0)

### Phase 4: Governance (M, → 100%)
1. Analytics for create, publish, test-run, save errors; Web Vitals on list and editor. (+1.0)
2. Performance budget and bundle-size CI check for agent routes. (+1.0)
3. Tests for save machine, cache/mutation flows, permissions, sharing. (+1.0)
4. Accessibility audit (axe plus screen reader) on the editor and avatar picker. (+0.5)

Re-score after each phase and settle all "(verify)" items first.

---

## Projects System Design Audit (2026-10-10)

Full report: [projects-system-design-audit.md](audits/projects-system-design-audit.md)

### Overall efficiency: ~42% (15.0 / 36 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 3 | 1.3 | 43% |
| 2. Architecture | 8 | 3.3 | 41% |
| 3. Component Patterns | 3 | 1.3 | 43% |
| 4. Data Model | 8 | 3.5 | 44% |
| 5. Interfaces and APIs | 6 | 3.8 | 63% |
| 6. Optimizations | 8 | 1.8 | 23% |

Not applicable: SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, cursor pagination, real-time state, list virtualisation (project counts are small).

---

### 1. Already applied well

| Principle | Evidence |
|---|---|
| API-layer separation (#40, #45) | All HTTP in `lib/api/projects.ts` via `apiFetch`/`apiFetchJson`; `ApiError` surfaced with backend `detail` |
| Non-2xx guard | Delete, link/unlink chat, invite, remove member check `res.ok` explicitly |
| Optimistic updates (#33) | Create/update/delete in `ProjectsProvider` apply the change first and roll back on failure |
| Provider pattern (#24) | `ProjectsProvider` + `useProjects()` guard hook; `ProjectPanelProvider` is small (46 lines) |
| Stable refs for async | `projectsRef`, `chatLoadsRef` (in-flight chat load dedupe) prevent stale closures and duplicate loads |
| Pure helpers separated | `project-filters.ts`, `project-list-utils.ts` |
| Reuse of chat | Project chat page renders the shared `ChatInterface` rather than a copy |
| Separated modals | Edit/Delete/Leave/Move modals are their own components |
| Auth / BFF (#41, #42) | Goes through the app proxy with the Auth0 session |
| Role-aware UI | Owner/member/workspace capability checks via `useOrg()` caps |
| Test | `lib/api/projects.test.ts` |

### 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `project/[id]/page.tsx` 1,129 lines with 26 `useState` + 11 `useEffect`; `project/[id]/chat/[chatId]/page.tsx` 838 lines with 27 + 13 | Container hooks (`useProjectDetail`, `useProjectMembers`) + sections (header, files, chats, members, instructions) |
| Container/Presentation (#22) | Pages mix permission derivation, data loading, effects and markup | Extract `useProjectPermissions(project, org)` and presentational panels |
| Provider scope (#24) | One 586-line context holds list, details, chats, files, sizes, optimistic ops, localStorage; any change re-renders all consumers (verify) | Split reads (list/detail) from actions; selector-based access, or move reads to React Query |
| Error boundaries (#19) | Only in the project chat page; none on list/detail/modals | Boundary per section; add `error.tsx` |
| Accessibility (#20) | Few `aria-*` (7 in detail page, 3 in list, 0 in the context-driven sidebar group); multi-select and filters need keyboard/label review (verify) | Roles for tabs/filters, labelled modals, focus return |
| Storage (#32) | `storageSizesKey(projectId)` in localStorage keeps file sizes per project, outside `storage-keys.ts`, never expires | Centralise; see "wrong" below |
| Filtering (#53/#54) | List filtering and search run synchronously in render (`filter` + `includes`) | `useDeferredValue` for search; debounce if server-side later |
| URL as state (#34) | Route carries project id; the scope filter and search on the list page are local state (verify) | Put `scope`, `q`, `sort` in search params so views are shareable and survive reload |
| Observability (#55) | 3 track calls in the context, 1 in detail page, none in list | Track create/delete/leave/share/move events with the typed helpers |

### 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| No response validation | `apiFetchJson<ProjectSummary[]>(...)` is a type cast, not a check; personas use Zod, projects do not, so a backend change fails silently in the UI | Zod schemas for `ProjectSummary`, `ProjectResponse`, members, chats; `safeParse` at the API boundary |
| Hand-rolled server cache in context | Fetching, loading flags, refresh, per-project chat load tracking, and a fetch-on-demand of sizes live in a context instead of a query cache | React Query: `["projects"]`, `["project", id]`, `["project", id, "chats"]`, `["project", id, "members"]` with mutations and `onMutate` rollback (the optimistic code already exists, just move it) |
| File sizes via HEAD requests + localStorage | The context makes background HEAD requests for each document and stores sizes in localStorage because the server size is sometimes missing (lines ~151, ~388) | Have the backend return `size_bytes` always (backend is read-only for us, so request it); until then, a query with cache instead of localStorage |
| Counting and filtering on the client | `personalCount`/`workspaceCount`/`sharedCount` recomputed from full list in the page | Derive once in a selector, or take counts from the API |
| `memberListVersion` counter | Page bumps a number to force the member list to refetch (line ~141) | Query invalidation |
| Duplicate-prone API pattern | Many near-identical `apiFetch` + `res.ok` + error-parse blocks (invite, remove, link, unlink) | One `apiRequest()` helper that throws `ApiError` on non-2xx |
| Project chat page duplicates chat page wiring | 838 lines of pin mentions, initial prompt hand-off and model selection overlap with `chat/page.tsx` (1,017 lines) | Share a `useChatPageController` between both routes |

### 4. Missing, to add

| Principle | Add |
|---|---|
| Code splitting (#46, #48) | No `dynamic()` in the project surface: lazy-load Edit/Delete/Leave/Move modals, members/sharing panel, project chat route |
| `useTransition` (#54) | Switching scope tabs, search |
| Form state (#35) | React Hook Form + Zod for create/edit project (name, description, instructions, files, visibility) |
| Suspense / loading (#7) | `loading.tsx` and skeletons for list/detail |
| `error.tsx` / `not-found.tsx` | Missing or deleted project (404), no access (403) states |
| Core Web Vitals / perf budget (#8, #56) | Budget for project routes |
| Data normalisation (#31) | Projects by id; chats referenced by id from project and chat history so renames show everywhere (today `renameChat` is in the projects context while chat history lives in another hook, risk of drift, verify) |
| Permissions helper | One `can(user, action, project)` for owner/member/workspace rules, currently inline comments plus several booleans in the page |
| Test coverage | Optimistic rollback paths, permissions, filters, Move-to-project flow |
| Pagination | Projects and project chats are fetched as full lists; add paging if counts grow |

---

### Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 42% → ~55%)
1. Add `error.tsx`, `loading.tsx`, `not-found.tsx` for `projects` and `project/[id]`; boundaries around member and file panels. (+1.0)
2. Lazy-load the four modals, members/sharing panel and project chat route. (+1.0)
3. Zod schemas on every project API response. (+1.0)
4. Search/filter state in URL params; `useDeferredValue` for search. (+1.0)
5. Aria roles, labelled dialogs, focus return; keyboard test of filters. (+1.0)
6. Typed analytics for create/delete/leave/share/move. (+0.5)

### Phase 2: Data layer (M, → ~70%)
1. Move list, detail, chats, members to React Query; port the existing optimistic/rollback logic into mutations; delete the corresponding context code. (+2.5)
2. Replace `memberListVersion` and manual refresh flags with invalidation. (+0.5)
3. Single `apiRequest` helper for the repeated fetch + error blocks. (+0.5)
4. Remove localStorage file-size cache once the backend returns sizes (request the field). (+0.5)
5. Shared `can()` permission helper. (+0.5)
6. Normalise chats by id shared with chat history. (+0.5)

### Phase 3: Components (M-L, → ~88%)
1. Split `project/[id]/page.tsx` and the project chat page into container hooks + presentational sections, none above about 400 lines. (+2.0)
2. Share a chat-page controller between `/chat` and project chat routes. (+1.0)
3. React Hook Form + Zod for create/edit forms. (+1.0)
4. Slim `ProjectsProvider` to actions only (or retire it). (+1.0)

### Phase 4: Governance (S-M, → 100%)
1. Web Vitals and route performance budgets in CI. (+1.0)
2. Tests: optimistic rollback, permissions, filters, move flow, API schema failures. (+1.0)
3. Pagination for projects and project chats. (+0.5)
4. Accessibility audit (axe plus screen reader). (+0.5)
5. `useTransition` for tab/scope switches. (+0.5)

Re-score after each phase and settle all "(verify)" items first.

---

## Templates System Design Audit (2026-10-10)

Full report: [templates-system-design-audit.md](audits/templates-system-design-audit.md)

### Overall efficiency: ~63% (12.0 / 19 applicable principles)

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

### 1. Already applied well

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

### 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Error boundaries (#19) | Errors are handled inline, but there is no `error.tsx`, `not-found.tsx` or `loading.tsx`; an unexpected throw (e.g. `upstream.json()` on invalid JSON) falls to the generic error | Add `error.tsx`/`loading.tsx` for the route; wrap `upstream.json()` in try/catch (it throws before `safeParse` runs) |
| Accessibility (#20) | `iframe title` and `h1` present; no skip link, no focus handling, notices are not announced (`role="status"`/`alert`) | Add roles to `Notice`; make the iframe keyboard-reachable and document focus behaviour |
| Style management (#16) / design system (#15) | Inline style objects (including a full-screen `Notice`) and `--legacy-*` token use, unlike shared components | Reuse an empty-state component and Tailwind/tokens; drop the legacy colour token |
| Core Web Vitals (#8) | Page waits for the metadata fetch, then the iframe starts its own request: two sequential round trips before content | Start the HTML request in parallel (render the iframe immediately and let the metadata header stream via Suspense), or add `<link rel="preload">` |
| Network robustness (#45) | Both `fetch` calls have no timeout or abort; a hung backend holds the request open | `AbortSignal.timeout(...)`; map to 504 |
| Duplicated server plumbing | `BACKEND_BASE`, audience and token retrieval are repeated in the page and the route (and again in other API routes) | One `serverBackendFetch()` helper in `lib/` |
| Container/Presentation (#22) | Data loading, entity decoding, formatting helpers and markup share one file | Move `decodeEntities`, `formatBytes`, `formatBuilt` to `lib/` with unit tests; keep page presentational |

### 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Title decoding | The backend leaves HTML entities in the title and the frontend patches that with a hand-written entity decoder (numeric code points, a six-entry table) | Fix at source: decode in the backend; short term use a small tested library; at minimum cap `String.fromCodePoint` input (invalid code points throw `RangeError`, e.g. `&#x110000;`) (verify) |
| Error text leakage | `new Response(await upstream.text(), { status })` forwards backend error bodies to the browser verbatim | Return a fixed message per status; log the body server-side |
| `allow-popups` without `allow-popups-to-escape-sandbox` question | Popups opened from the sandboxed page inherit the sandbox (links may behave oddly) (verify intent) | Decide explicitly and document |
| Docs mismatch | `features.md` description of Templates is wrong | Update it (this audit's correction) |

### 4. Missing, to add

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

### Plan to reach 100%

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
