# Prompt Enhancement: System Design Audit

Scope: `components/EnhancePromptField` (874 lines, plus `index.test.tsx` 194), `EnhanceDotProgress`, `EnhanceScanningState`, `EnhanceSummaryBar`, `DiffLine`, `src/enhance/index.ts` (287, plus `index.test.ts` 64), `enhancePrompt` in `lib/api/personas.ts`, `EnhancePromptField` use in `agent/configure/instructions` and `AgentEditor` / `FineTuneModal`. About 1,700 lines. It improves an agent's system instructions (not the chat composer).
Method: `enhance/index.ts` in full, the component's state machine and backend flow, and the API call read; presentational pieces by grep. Items marked (verify) need a closer look.
Scoring: 1 = applied, 0.5 = partial, 0 = absent, applicable principles only.

## Overall efficiency: ~49% (10.8 / 22 applicable principles)

| Folder | Applicable | Score | % |
|---|---|---|---|
| 1. Requirements and Rendering | 2 | 1.2 | 60% |
| 2. Architecture | 8 | 4.0 | 50% |
| 3. Component Patterns | 2 | 0.9 | 45% |
| 4. Data Model | 3 | 1.9 | 63% |
| 5. Interfaces and APIs | 3 | 1.9 | 63% |
| 6. Optimizations | 4 | 0.9 | 23% |

Not applicable: SSR, SSG, ISR, RSC, Monorepo, HOC, Polymorphic, Redux vs MobX, tRPC, WebSocket, PWA, virtualisation, pagination, debounce, optimistic updates.

## How it works

1. The user clicks Enhance on the system-instruction field (`trackFeature('agent_enhance_instructions')`).
2. If the field has text, the component calls the backend (`POST /persona/enhance-prompt`) with the prompt. The response has an `enhanced_prompt` draft and clarifying `questions` (mapped by `fromBackendQuestions`, each with an added "Other" option).
3. If there are questions, the user answers them step by step; answers go back to the backend as `{question, answer}` pairs for a refined draft. Otherwise the draft goes straight to review.
4. The user sees a line-level diff (LCS) with a Changes / Preview toggle and applies or discards it.
5. If the backend errors, or takes more than 45 s, or the field is empty, a **local rule-based fallback** runs: regex `scanPrompt`, `classifyMode` (BUILD / AUDIT), a fixed `QUESTION_BANK`, and `buildRewrite`, which appends template sentences.

---

## 1. Already applied well

| Principle | Evidence |
|---|---|
| Human in the loop (#21) | AI output is never auto-applied: a diff with Changes / Preview and an explicit apply/discard |
| Runtime validation (#35) | `enhancePrompt` parses the response with Zod (`enhancePromptSchema`) |
| Graceful degradation (#45) | Backend failure, empty prompt, and 45 s timeout each fall back to the local flow; "still working" note and Cancel after 8 s; second-stage refine falls back to the first draft |
| Stale-response guard | `requestId` ref ignores responses after close or restart |
| Explicit state machine | `EnhanceState = 'idle' \| 'scanning' \| 'qa' \| 'diff' \| 'complete'` with `DiffView`; clear transitions |
| Pure logic separated | `src/enhance/index.ts` has no React: `scanPrompt`, `classifyMode`, `selectQuestions`, `buildRewrite`, `diffLines`, `diffSummary`, `fromBackendQuestions`; unit-tested |
| Diff algorithm | Line-based LCS, blank lines dropped, removed before added; `diffSummary` gives words added and guideline groups for the summary bar |
| Reusable pieces | `DiffLine`, `EnhanceSummaryBar`, `EnhanceDotProgress`, `OptionRow` shared with other UI |
| Q&A constraints | `multiSelect` and `maxSelect` enforced; custom "Other" text with chips and removal |
| Accessibility (#20) | `role="dialog"` with label when open, `role="status"` for progress text, labelled diff list, `aria-pressed` toggle, labelled remove buttons, `aria-label` on the textarea |
| Cleanup | Timers cleared on unmount and close |
| Tests | Pure-logic test and component test exist |

## 2. Applied but needs improvement

| Principle | Gap | Fix |
|---|---|---|
| Component architecture (#12) | `EnhancePromptField` 874 lines with ~12 `useState`, 5 refs, 4 effects, a state machine written as separate setters | `useReducer` (or a small state-machine hook `useEnhanceFlow`) holding state, questions, answers, draft; presentational sub-views per state (Scanning, Questions, Diff, Complete) |
| Cancellation (#45) | Closing or restarting only increments `requestId`; the HTTP request keeps running (and any model cost with it) | Pass an `AbortSignal` through `apiFetchJson` and abort on close, restart, give-up |
| Streaming UX (#36) | The user waits for the whole draft (up to 45 s) behind a scanning animation | Stream the draft (SSE) into the Preview, or show progress phases from the backend |
| Observability (#55) | One event at open; nothing for outcome (applied, discarded, fell back, timed out), number of questions answered, latency | Typed events with enum outcomes (`applied`, `discarded`, `fallback_local`, `timeout`) |
| Server state (#30) | Imperative promise chains with local flags (`waiting`, `slow`, `backendMode`, `backendDraft`) | `useMutation` for both calls (first pass, refine) giving loading/error/cancel states |
| Form state (#35) | Answers and custom text are hand-managed maps | Small schema for answers; unit-tested reducer |
| Error boundaries (#19) | Layout-level only; a diff or markdown preview crash would lose the user's editing session | Boundary around the enhance panel that restores the idle textarea |
| Style management (#16) | Many inline style objects (e.g. the status paragraph) plus a `kaya-enhance-textarea` class | Tokens/Tailwind |
| Code splitting (#46) | The 874-line field, diff and Q&A code load with the editor even if never used | Lazy-load the open states (`Questions`, `Diff`) on first Enhance |

## 3. Applied wrongly / should change

| Item | Problem | Change |
|---|---|---|
| Artificial latency on the local path | `SCAN_DURATION_MS = 1800` ("PRD §11") fakes a "scanning" delay even though the regex scan is instant | Keep a short (about 300 ms) transition or none; do not slow users down for theatre |
| Local heuristic quality | `scanPrompt` uses English-only regexes (`\byou are\b`, `\bonly\b`, `\bhelp\b`...) so a prompt in another language or a long prompt with the words in other forms is classified wrongly; `hasGoal` matches common words like "help" and "only"; `classifyMode` uses `length >= 80` and 4 of 6 flags | Treat the local flow as a minimal checklist, state clearly that it is basic, or drop it in favour of a retry state |
| Template rewrite output | `buildRewrite` appends fixed sentences ("Communicate in a friendly & approachable manner.", "Your primary goal is to answer questions accurately."), keeps option labels with `&`, joins arrays with "and", and may duplicate content already in the prompt | Make wording generation backend-only; or phrase from option ids rather than labels |
| Unused parameters and types | `selectQuestions(..., _personaContext)` ignores its context argument (`knowledgeCount`, `connectorsEnabled`, `sharing`); `PersonaContext` and the `personaContext` prop are dead weight | Use it (e.g. skip connector questions when none are connected) or remove it |
| Deprecated alias | `diffSentences` kept "for callers of the old name" | Delete if unused |
| Two vocabularies | Local ids (`role`, `tone`...) versus backend ids (`q0`, `o0`); `custom` option appended in both | One question type with `source` |
| Free-text sent as answer text | Answers are posted as the question text plus selected labels (`{question, answer}`), long custom text unbounded | Length limits with Zod, trimmed |
| Hard-coded copy | Placeholder, labels, toasts (British and American spelling mix: "specialise", "Summarise" next to "color") | Copy constants; one locale |
| No credit/quota awareness | Enhance calls the model on every click; no handling of exhausted credits (`402/403`) distinct from generic failure (falls to local) | Detect credit exhaustion and show the billing message (see Credits and billing) |
| Undo | After applying, the old text is lost unless `footerLeft` supplies undo (optional slot) | Built-in "Undo enhance" until next edit |

## 4. Missing, to add

| Principle | Add |
|---|---|
| Tests | Backend-success, timeout fallback, stale response ignored after close, refine fallback to first draft, abort on close, answers capped by `maxSelect`; diff edge cases (identical text, empty original, reordered lines) |
| `loading.tsx`/Suspense (#7) | Skeleton for the open states |
| Diff UX | Accept/reject per hunk instead of only whole draft; word-level highlights inside changed lines |
| Streaming (#36) | SSE for draft text |
| Safety | Warn on very long outputs; limit total prompt size; strip control characters |
| Persistence (#32) | Keep an in-progress Q&A across accidental close (sessionStorage) |
| Reuse | The same flow for project instructions and chat custom instructions (feature `project_instructions_added` exists; verify) |
| Internationalisation | Localised copy and language-aware scanning |
| Keyboard flow | Enter to advance, Esc to close, focus management on state change (verify) |
| Reduced motion (#20) | Respect `prefers-reduced-motion` for the scanning animation (verify) |
| Core Web Vitals / budget (#8, #56) | Measure INP while diffing a long prompt (LCS is O(n*m) in lines) |

---

## Plan to reach 100%

Effort: S ≤ 2 days, M ≤ 1 week, L > 1 week.

### Phase 1: Quick wins (S, 49% → ~62%)
1. Remove the 1.8 s fake delay on the local path. (+0.3)
2. Abort the HTTP request on close/restart/give-up via `AbortSignal`. (+0.6)
3. Typed outcome analytics (applied, discarded, fallback, timeout, latency bucket). (+0.5)
4. Remove `PersonaContext`/`_personaContext` or use it; delete `diffSentences`. (+0.3)
5. Tests for backend success, timeout fallback, stale response, abort and refine fallback. (+1.0)
6. Handle credit-exhausted errors with the billing message instead of silently going local. (+0.4)
7. Error boundary that returns to the idle textarea; keyboard and focus review. (+0.5)

### Phase 2: State and data (M, → ~76%)
1. `useEnhanceFlow` with a reducer for state/questions/answers/draft; separate view components per state; file under ~300 lines. (+1.5)
2. `useMutation` for first pass and refine (loading, error, cancel). (+0.8)
3. Zod limits for answers and custom text; single question type for local and backend. (+0.5)
4. Built-in undo for the applied draft. (+0.3)
5. Lazy-load the open-state views. (+0.4)

### Phase 3: Quality of enhancement (M-L, → ~90%)
1. Streaming draft via SSE, shown in Preview as it arrives (needs backend). (+1.0)
2. Per-hunk accept/reject and word-level diff. (+0.8)
3. Decide on the local fallback: reduced to a clear checklist with honest copy, or removed. (+0.6)
4. Persist in-progress sessions; reuse across project and chat instructions. (+0.6)
5. Copy constants, consistent spelling, localisation hooks. (+0.3)

### Phase 4: Governance (S, → 100%)
1. Performance budget for the open states; INP on long-prompt diff (move LCS to a worker if needed). (+0.5)
2. Accessibility audit (axe plus screen reader), reduced motion. (+0.4)
3. Quality metric: acceptance rate and edit distance after apply, per enhancement version. (+0.4)
4. Prompt-injection and output-size review for generated text saved as a system prompt. (+0.3)

Re-score after each phase and settle all "(verify)" items first.
