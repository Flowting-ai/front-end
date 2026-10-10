# Chat Feature: System Design Audit

Scope: chat (`app/(app)/chat`, `chats`, `components/chat`, `hooks/use-streaming-chat`, `use-chat-*`, `lib/stream-registry`, `lib/api-client`, `app/api/chat`).
Method: the 56 principles across the 6 folders were matched to chat by structural scan (file sizes, greps, config). This is not a line-by-line review. Items marked (verify) need a closer look.
Scoring: 1 = fully applied, 0.5 = partial, 0 = absent. Applicable principles only.

## Overall efficiency: ~56% (24.7 / 44 applicable principles)

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

## 1. Already applied well

| Principle | Evidence |
|---|---|
| CSR for the chat surface (#2) | `chat/page.tsx` is `"use client"`; the server layout only reads the sidebar cookie (hybrid shell) |
| Real-time state (#36) + streaming transport | SSE via `/api/chat`, AG-UI schemas validated with Zod (`lib/agui/schemas.ts`, `sse-schemas.ts`), `stream-registry` tracks in-flight streams across reloads (sessionStorage) |
| BFF (#41), partial | `/api/chat`, `/api/backend/[...path]` proxy routes give same-origin streaming and hide the backend origin; the access token itself is still held in browser memory (see Auth audit) |
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

## 2. Applied but needs improvement

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

## 3. Applied wrongly / should change

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

## 4. Missing, to add

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

## Plan to reach 100%

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
