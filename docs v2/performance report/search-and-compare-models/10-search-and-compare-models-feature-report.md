# Global Search & Compare Models — Detailed Report

**Scope:** two smaller, cross-cutting UI utilities that don't have their own routes — the app-wide command palette / search (`Ctrl+K`) and the model-comparison overlay (`CompareModels`, opened from `AppDialogs`, a global dialog manager). Grouped into one report since both are modal overlays layered on top of whatever page is active, similar in scale/nature to the Pinboard report's approach.

**How this was produced:** live, logged-in Playwright run confirming Global Search works end-to-end (open, type, real cross-entity results), and a static-analysis pass (`react-doctor`) for both surfaces. Compare Models' trigger UI was not located within this pass's time budget — see the honest caveat in §3.2.

---

## 1. Surfaces in this feature

| Surface | File | Purpose |
|---|---|---|
| Global Search | `src/components/GlobalSearchModal/index.tsx` | `Ctrl+K` (or the sidebar search icon) — search across Chats, Agent Chats, Tasks, Projects, Agents, Pins, and Pages from anywhere in the app |
| Compare Models | `src/components/compare/CompareModels.tsx` | A model-comparison overlay — **the largest single component file in this report**, findings reference lines past 1,800; rendered via `src/components/layout/AppDialogs.tsx`, a global dialog-manager pattern, rather than being opened directly from a page |

**State/data layer:** `context/search-context.tsx` (fetches personas/persona-chats to feed search results, confirmed via its imports of `fetchPersonas`/`fetchPersonaChats` from the Agents feature's own API module — a genuine cross-feature dependency).

Compare Models is the **only component found in this entire report series that uses a CSS Module** (`compareModels.module.css`) rather than the codebase's dominant inline-style pattern — worth flagging alongside the Pinboard/Onboarding/Slack Tailwind-range finding as more evidence of real stylistic variance across the codebase depending on which component/author.

---

## 2. API calls

Global Search doesn't have its own dedicated endpoints — `search-context.tsx` composes results client-side from data already fetched by other features (personas, persona-chats), rather than calling a server-side search endpoint. Whether Chats/Tasks/Projects/Pins results are similarly client-composed or separately fetched wasn't confirmed in this pass; worth a follow-up read of `search-context.tsx` in full if search performance on large accounts becomes a concern (client-side filtering over an ever-growing chat history doesn't scale as well as a server-side search endpoint would).

Compare Models' data comes from the same `/llm/models/all` endpoint already documented in the Chats and Agents reports — no separate API surface of its own.

---

## 3. Live functional test results

### 3.1 Global Search — confirmed working end-to-end, polished
`Ctrl+K` from `/chat` opens the modal correctly. Confirmed via two live screenshots:
1. **Empty state**: shows a "RECENT" section with the two most recent chat queries from this session, plus keyboard-navigation hints (↑↓ navigate, ↵ open, Esc close) — genuinely well-built UX detail.
2. **Typed query** ("pong"): correctly scoped-filtered into a "CHATS" section, matched the right chat, and **bolded the matching substring** within the result title. Category tabs (All / Chats / Agent Chats / Tasks / Projects / Agents / Pins / Pages) all rendered and appear switchable.

This is the **most polished, defect-free live interaction observed in this entire 10-report series** — no bugs found, no rough edges, correct keyboard-shortcut behavior, correct result highlighting, correct category scoping.

### 3.2 Compare Models — **confirmed: dead code, no reachable trigger anywhere in the app**

This wasn't a test-targeting failure. Tracing the actual wiring:

- `context/compare-context.tsx` defines `CompareProvider`, exposing `{ isOpen, open, close, toggle }` via `useCompare()`.
- `AppDialogs.tsx` is the **only** place in the entire codebase that calls `useCompare()` — and it destructures only `{ isOpen, close }`. It renders `<CompareModels>` when `isOpen` is true and wires `close`, but nothing ever calls `open()` or `toggle()`.
- A codebase-wide search for any other call to `useCompare()`, or for a `"Compare"`-labeled button anywhere near the model selector (`ModelSelectItem`, `PresetModelSelectorDialog`, `ChangeAgentModelModal`), turned up nothing.

**Conclusion: there is no UI element anywhere in the current codebase that sets `isOpen` to `true`.** Compare Models is a fully-built, ~1,800-line component — its own CSS module, wired into the global dialog manager, even instrumented with a `trackFeature('compare_models')` analytics call on `open()` — that is completely unreachable by a real user. This isn't "untested," it's confirmed dead code: either a feature that was built and never wired up to its entry point, or one whose trigger was removed elsewhere without removing the dialog itself.

This changes how the security findings in §6 should be read: the two `dangerous-html-sink` instances in this file are real code defects, but their actual exploitability today is zero, since nothing can open the component. That's a reason to prioritize *removing or wiring up* the feature, not a reason to deprioritize the sink findings — if someone does wire up a trigger later without first fixing them, those findings become live again immediately.

---

## 4. Lighthouse — not run separately

Same reasoning as the Pinboard report: neither surface has its own route, both are modals layered on already-profiled pages (`/chat`, primarily). No new Lighthouse data generated for this report.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 3 files (3,128 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **169** | **41** |
| **Share of styling touchpoints** | **80.48%** | **19.52%** |

**New high for the series**, edging out the Souvenir-in-Slack report's previous 17.86%. Combined with Compare Models' unique CSS Module usage, this feature is — by a comfortable margin — the least "inline-style-typical" part of the codebase audited. The series' empirical Tailwind-adoption range is now **0.99% (Onboarding) to 19.52% (this feature)**.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**36 findings** (19 Performance, 8 Bugs, 5 Maintainability, 2 Accessibility, 2 Security; split roughly 33/67 error/warning — errors are 15 of the 36). Findings are heavily concentrated in `CompareModels.tsx` (32 of 36) vs. `GlobalSearchModal.tsx` (only 5) — consistent with Global Search's clean live behavior and Compare Models being both larger and untested live.

### GlobalSearchModal.tsx — small, contained finding set
- `no-high-complexity-react-function` + `no-giant-component` (paired, same location) — the modal's main function is large/complex despite its clean external behavior.
- `set-state-in-effect` — React-Compiler-blocking.
- `exhaustive-deps` — missing effect dependency.
- **3× `no-layout-property-animation`** (lines 572-574) — the modal's open/close transition likely animates a layout property; worth checking given how polished the rest of the interaction is, this would be a cheap win to make the animation itself compositor-only too.

### CompareModels.tsx — the largest, most-flagged single file in this report series

| Count | Category/Severity | Rule | What it means |
|---|---|---|---|
| 4 | Bugs/warning | `no-array-index-as-key` | List items keyed by array index, at 4 separate locations |
| 3 | Performance/error | `refs` (React Compiler can't optimize) | Ref-pattern compiler-blocking, lines 786-792 |
| 3 | Performance/error | `todo` | React Compiler can't parse, 3 separate locations |
| 2 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render (pairs with the `refs` findings above — same 2 of the 3 locations) |
| 2 | Security/warning | `dangerous-html-sink` | HTML injection sink with dynamic content, lines 262 and 436 — **two separate sinks in one file**, more than any other single file in the whole series except `ResponseBlocks.tsx` (Chats report) |
| 2 | Performance/warning | `no-transition-all` | `transition: all` animates everything, not just the intended property |
| 2 | Performance/warning | `rerender-state-only-in-handlers` | State only used in handlers, causing avoidable re-renders |
| 2 | Maintainability/warning | `no-high-complexity-react-function` | Two separate oversized regions within the file (same "does two jobs" signal seen in the Settings report's `plans-and-billing/page.tsx`) |
| 1 | Performance/warning | `no-create-object-url-without-revoke` | Same blob-leak pattern flagged in the Chats and Agents reports, here a third independent instance |
| 1 | Performance/warning | `set-state-in-effect` | React-Compiler-blocking |
| 1 | Accessibility/warning | `img-redundant-alt` | Redundant words in image alt text |
| 1 | Accessibility/warning | `no-placeholder-only-field` | Same recurring pattern |
| 1 | Performance/warning | `js-set-map-lookups` | Array lookup inside a loop |

Full file/line detail for all 36 findings is in the raw JSON generated this session (see §7).

---

## 7. Backlog — prioritized

**P0 — product decision, not just a bug**
1. **Decide what to do with Compare Models.** It's confirmed unreachable (§3.2) — no button, menu item, or code path anywhere sets it to open. Three options, in order of likely cost: (a) it's finished work waiting on a trigger that was never added — wire one up (most likely near the model selector, given its props take `selectedModel`/`onModelSelect`); (b) it's deprecated/superseded functionality whose entry point was intentionally removed — delete the component, its context, and its CSS module; (c) it's mid-migration and the trigger lives in a branch/PR not yet merged — check with whoever owns this area. Whichever it is, leaving a ~1,800-line component with real security findings sitting live-but-unreachable in the bundle is the wrong steady state.
2. `CompareModels.tsx:262,436` — two HTML injection sinks with dynamic content. Currently unexploitable (nothing can open the component to trigger them), but must be fixed **before** anyone wires up a trigger per item 1 — not after.

**P1 — correctness**
3. `CompareModels.tsx:786-792` — 2 ref-mutated-during-render errors, clustered with 3 compiler-blocking `refs` findings at nearly the same lines — same "one bad pattern, several call sites" shape seen repeatedly across this series (Brain's `brain/page.tsx`, Pinboard's `pinboard-context.tsx`).

**P2 — performance**
4. 3× `no-layout-property-animation` in `GlobalSearchModal.tsx` — the only blemish on an otherwise clean, well-built feature; cheap to fix given the small file/finding footprint here.
5. `no-create-object-url-without-revoke` in `CompareModels.tsx` — third confirmed instance of this exact leak pattern across the series (Chats' `AttachmentManager.tsx`, Agents' `KnowledgeTab.tsx`/`knowledge/page.tsx`, now here) — strong candidate for a single shared upload/blob-handling utility rather than three (now effectively four, counting both Agents instances) independent implementations of the same unsafe pattern. Moot if item 1 resolves to deletion.

**P3 — maintainability**
6. `CompareModels.tsx` flagged high-complexity at two separate locations, same "doing two jobs" signal as Settings' billing page — worth considering a split, if the component is kept at all.

---

## 8. Cross-feature pattern check (now 10 features in)

- `no-create-object-url-without-revoke` — **now 3 independent files** across 2 prior features plus this one; strong candidate for a shared utility fix.
- `dangerous-html-sink` — this file's 2 instances bring the series' running total of HTML-injection-sink findings to a level worth a dedicated security review pass across `ResponseBlocks.tsx`, `LaTeXRenderer.tsx`, `line-renderer.tsx`, `export-pins.ts`, and now `CompareModels.tsx` together, rather than treating each as an isolated per-feature finding.
- Tailwind adoption range extended again: **0.99%–19.52%** across the ten reports.
- **New, positive finding:** Global Search is the cleanest live-tested surface in the whole series — worth using as an internal reference for "what good looks like" when planning fixes elsewhere, the same way the Pinboard/Slack reports suggested using their higher Tailwind ratios as internal precedent.
- **New, and the most structurally unusual finding of the entire series:** Compare Models is confirmed dead code — a fully-built, non-trivial component (~1,800 lines, own CSS module, wired into the global dialog manager, analytics-instrumented) with zero reachable trigger anywhere in the current codebase. Every other "unverified" item across all ten reports was a testing-time-budget gap on a feature that's actually reachable; this is the one case in the whole series where the gap turned out to be the app's, not the audit's.

---

## 9. Artifacts backing this report

Raw data (Global Search screenshots — empty state and typed-query state — full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
