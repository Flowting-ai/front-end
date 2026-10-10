# Compare Feature: System Design Audit

Scope: two surfaces share the name "compare".
1. **Model compare modal**: `components/compare/CompareModels.tsx` (2034 lines), `compareModels.module.css`, `context/compare-context.tsx`, opened from `components/layout/AppDialogs.tsx`.
2. **`/compare` page** (`app/(app)/compare/page.tsx`, 293 lines): a routing-lab recording tool (old router vs "Jev" router, via `/api/lab`).
Method: structural scan (sizes, greps, key code sections), not a line-by-line review. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~43% (15.5 / 36 applicable principles)

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

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Code splitting / lazy loading (#46, #48) | `CompareModels` is `dynamic()`-imported in `AppDialogs` with a comment that it pulls ~10MB (6.5MB gzip) of `@strange-huge/icons/llm` |
| Provider pattern (#24) | `compare-context.tsx` is a small 33-line open/close context, scoped correctly |
| Streaming transport reuse (#44 principles) | Uses the shared `AguiSSEDecoder` (`lib/sse-decoder`), abortable via `AbortController`, reader cancelled in `finally` |
| Frontend security (#21) | `sanitizeKaTeX` and `sanitizeURL` on rendered math and links |
| BFF (#41) / auth (#42) | Requests go through the app's own routes (`/api/chat`, `/api/lab`) |
| Reuse on the `/compare` page | Reuses `useStreamingChat`, `ChatMessage`, `ChatInput`, `InitialPrompts`: the right pattern |
| Analytics | `trackBrowserEvent` for pin creation |

## 2. Applied but needs improvement

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

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Custom markdown renderer inside the file (lines ~224-540) | A second hand-written markdown/table/code/LaTeX renderer duplicates `lib/markdown-utils`, `content-renderer`, and the chat `ChatMessage`; will drift from chat output, misses features (citations, widgets, highlights) | Render with the shared chat renderer (`/compare` page already does this via `ChatMessage`) |
| Hand-rolled fetch + event handling | Raw `fetch` and its own event mapping (`handleEvent`, `processDecodedEvent`) instead of `useStreamingChat` / `api-client` (no retry, timeout, circuit breaker, no shared AG-UI schema validation) | Reuse the streaming hook or extract a shared transport from `use-streaming-chat` |
| Errors stored as response text | `"Error: 500"`, `"Error: Failed to get response"` are written into the same map as answers, so the UI cannot style or retry them | Typed state: `{status: "streaming" \| "done" \| "error", text, error}` with per-model retry |
| Server data in `useEffect` | Model list fetched in an effect with `.catch(() => {})` (line ~871) | `useQuery` for models (shared with the model selector) |
| `/compare` page exposure | A routing-lab tool that calls a local lab on `:8777` is a normal app route; unclear whether it is gated by environment/flag (verify) | Gate behind a flag or dev-only route; remove from production build |
| No tests | Zero test files for compare (chat has 25) | Tests for stream handling and model filtering |
| Fixed-width modal | `width: 1212` inline breaks on small screens | Responsive container |

## 4. Missing, to add

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

## Plan to reach 100%

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
