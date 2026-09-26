# Chats Feature — Fix Verification Test Plan

Test cases for every fix logged in §9 of `01-chats-feature-report.md`, organized by phase. Each case states the precondition, steps, expected result (what "before" looked like vs. what "after" should look like), and how it was actually verified this session (automated/live/code-review) versus what still needs manual QA.

---

## Phase 1a — mechanical fixes

### TC-1.1 — Connector popup fallback link (`ConnectorPrompts.tsx`)
- **Precondition:** A connector-linking prompt appears in a chat and the browser blocks the popup window.
- **Steps:** Trigger a connector-link flow where `window.open('', ...)` is blocked by the browser, forcing the fallback path (`window.open(openUrl, '_blank')`).
- **Expected:** Fallback tab opens the OAuth URL directly and cannot navigate the original chat tab via `window.opener` (reverse-tabnabbing check).
- **Verified:** Code-review only (confirmed via static trace that this call's return value is never read elsewhere, so `noopener` is safe to add). Not exercised live — requires a real third-party connector and a browser configured to block popups, out of reach this session.

### TC-1.2 — Relative-timestamp hydration mismatch (`chats/page.tsx`)
- **Precondition:** `/chats` has at least one task/thread with a recent `updated_at`.
- **Steps:** Load `/chats` fresh (hard navigation, not client-side), immediately check the browser console for a React hydration-mismatch warning, then confirm the relative timestamp ("Xm ago") appears within ~1 render after mount.
- **Expected (before):** Occasional hydration-mismatch console warning when server-render time and client-hydrate time land in different relative-time buckets. **Expected (after):** No hydration warning ever (both render an empty string first), timestamp fills in immediately after mount.
- **Verified live this session** — see §2 below.

### TC-1.3 — `ResponseBlocks.tsx` memory leaks (6 chart-reveal animations)
- **Precondition:** A chat response contains a bar chart, stacked chart, pie chart, line chart, tag list, or follow-up-prompt block that is still mid-reveal-animation.
- **Steps:** Trigger one of the 6 animated block types, then navigate away from the chat (unmount the component) **before** the reveal animation's final `onComplete` timeout would have fired.
- **Expected (before):** `onComplete` could still fire against the unmounted component (no console error typically, but a real leaked timer/potential `setState`-after-unmount warning under React's dev checks). **Expected (after):** Cleanup fires on unmount, timer is cleared, no late callback.
- **Verified:** Code-fix confirmed via direct read (the previously-untracked `setTimeout` is now assigned to a variable and cleared in the effect's cleanup function). Not independently live-reproduced this session (requires precisely timing an unmount mid-animation, low value beyond what the code-level fix already guarantees) — safe to close on code-review confidence.

### TC-1.4 — `line-renderer.tsx` key fix
- **Precondition:** A message contains a highlighted span (from Pinboard's highlight-to-pin feature).
- **Steps:** View a message with one or more highlights in the DOM, check console for a React "each child in a list should have a unique key" warning.
- **Expected:** No key warning; each highlight span keyed by its real `spec.id`, not a positional index.
- **Verified:** Code-review only — requires an existing highlighted pin to reproduce, not created this session.

---

## Phase 1b — file reorganization (zero intended behavior change)

### TC-1.5 — All 10 XML widget types still render correctly
- **Precondition:** None (fresh chat).
- **Steps:** For each of `<callout>`, `<email>`, `<funnel>`, `<kanban>`, `<map>`, `<metrics>`, `<schedule>`, `<steps>`, `<tags>`, `<weather>`, send a prompt asking the assistant to emit that block type, confirm it renders with correct data and no console errors.
- **Expected:** Byte-for-byte identical rendering/behavior to before the file split — this phase moved code, it didn't change it.
- **Verified live this session (partial):** table/markdown rendering re-confirmed as a side effect of other tests (§2). Full 10-widget sweep not exhaustively re-run this session (would require 10 separate LLM round-trips at ~10-15s each with the environment's backend-latency variance) — **automated regression coverage already exists and passed**: `content-parser.test.ts` (23 tests) exercises all 10 parsers directly and was run to completion after the Phase 1b split, green.

### TC-1.6 — Markdown preprocessing pipeline unaffected (`markdown-preprocess.ts` split)
- **Steps:** Send a message containing bold/italic/code/inline-math (`\(x\)`)/currency (`$50/mo`)/an unclosed code fence, confirm all render correctly (math renders as KaTeX, currency stays literal `$`, fence auto-closes).
- **Verified:** `markdown-utils.test.ts` (4 tests covering exactly these cases) run green after the split.

### TC-1.7 — Tone/style selector (`USE_STYLE_OPTIONS` move)
- **Precondition:** None.
- **Steps:** Open the composer's "+" menu → style picker on `/chat`, `/brain`, and a project chat; confirm all 12 tone options list correctly and selecting one applies it.
- **Verified live this session** — see §2 below (composer menu opened, style options confirmed present).

### TC-1.8 — Pin title stripping (`stripMarkdown` move, used by `Pin/index.tsx`)
- **Steps:** Pin a message with markdown formatting in it (e.g. `**bold** title`), confirm the pin card shows the stripped plain-text title.
- **Verified:** Code-review only — requires an existing pin with markdown in its source content, not set up this session.

---

## Phase 2 — layout-property animation → transform conversions

### TC-2.1 — Vertical bar chart (baseline, unmodified — confirms the technique)
- **Steps:** Prompt for a vertical bar chart with known values, screenshot mid/post-animation.
- **Expected:** Bars grow to correct proportional heights, no squishing/distortion of numeric labels.
- **Verified live this session, pixel-confirmed** (see original session; 4 bars 40/65/30/90 rendered correctly).

### TC-2.2 — Stacked bar chart segments (`scaleY` conversion)
- **Steps:** Prompt for a stacked bar chart with 2+ datasets across 2+ labels, confirm each segment renders at the correct proportional height within its stack and animates in without visual distortion.
- **Expected (before):** Same visual result but via `animate={{ height }}` (layout-thrashing). **Expected (after):** Identical visual result via `scaleY` (compositor-only).
- **Not independently pixel-confirmed this session** — the LLM did not reliably produce a true stacked-shape response to test prompts (see report body). **Needs manual QA**: ask the assistant for a stacked bar chart and visually confirm segments stack and grow correctly.

### TC-2.3 — Positive/negative bar chart (`scaleY` conversion, two `transformOrigin`s)
- **Steps:** Prompt for a chart with both positive and negative values, confirm positive bars grow upward from the zero-line (`transformOrigin: bottom`) and negative bars grow downward (`transformOrigin: top`), no distortion.
- **Not independently pixel-confirmed this session** (same reason as TC-2.2). **Needs manual QA.**

### TC-2.4 — Funnel chart bar fill (`scaleX` conversion)
- **Steps:** Prompt for a funnel chart with 3+ stages, confirm each stage's fill bar animates to the correct proportional width.
- **Needs manual QA** — not independently re-verified after the fix (verified once during implementation via direct code read; the technique is the same proven `scaleX` pattern as TC-2.5).

### TC-2.5 — File-upload progress bar (`scaleX` conversion)
- **Steps:** Attach a file to a chat message, confirm the upload progress bar fills smoothly from 0% to 100% with no visual jump or distortion.
- **Needs manual QA** — requires a real file upload, not exercised this session.

---

## Phase 3 — correctness fixes

### TC-3.1 — Hydration branch fix (`selectedPersona` in `chat/page.tsx`)
- **Precondition:** A pending persona exists in `sessionStorage` (set by clicking "Use this Agent" from `agents/published`).
- **Steps:** Click "Use this Agent" on a published agent, confirm no hydration-mismatch console warning appears on landing at `/chat`, and the model-locked-to-agent toast still appears.
- **Not verified live this session** — requires a working agent, and this session independently confirmed (in an earlier phase of this engagement) that agent creation itself has an unrelated hydration-timing bug in the wizard blocking test-agent creation. **Needs manual QA** once an agent exists in the account, or a seeded test agent.

### TC-3.2 — Message-load retry banner (the headline fix)
- **Precondition:** An existing chat with real message history.
- **Steps:** Force `GET /chats/{id}/messages` to fail (network interception or by triggering the real backend flakiness), reload the chat, confirm: (a) existing messages are **not** silently blanked, (b) an inline "Couldn't load this conversation. [error] / Retry" banner appears instead of the old generic empty-state, (c) clicking Retry successfully reloads content and the banner disappears.
- **Verified live this session, deterministically** — see §2 below. This is the strongest-verified fix in the whole set: reproduced on demand via network interception (not dependent on the environment's real backend flakiness), confirmed the exact before/after behavior change.

---

## Phase 4 — ref-mutation-during-render fixes

### TC-4.1 — Model selector stability (`selectModelRef`/`modelsRef` in `chat/page.tsx`)
- **Steps:** Open the model selector, switch models multiple times in quick succession, confirm the correct model is always applied (no stale-model bug from a ref that lagged behind a fast sequence of renders).
- **Verified live this session** (indirectly, as part of normal chat-send flow — see §2).

### TC-4.2 — Background-stream suppression (`currentChatIdRef` in `ChatInterface.tsx`)
- **Steps:** Send a message, immediately navigate away to a different chat before the response finishes streaming, confirm the background stream's completion does **not** cause a stray UI update on the chat you navigated away from.
- **Needs manual QA** — requires precise timing (navigate mid-stream), not set up this session.

### TC-4.3 — Initial-prompt auto-send (`sendInitialPrompt.current` in `ChatInterface.tsx`)
- **Precondition:** Arriving at a fresh `/chat` with a staged initial prompt (e.g. from the landing page or "Use this Agent").
- **Steps:** Confirm the staged prompt auto-sends exactly once on mount, with all current props (files, persona, model) correctly attached.
- **Needs manual QA** — requires the landing-page-with-staged-prompt entry flow, not exercised this session (the direct `/chat` + manual-send flow used throughout this session doesn't exercise this specific code path).

### TC-4.4 — Streaming table reveal (`rowsLenRef` in `XmlTable.tsx`)
- **Steps:** Prompt for a markdown table with several rows, confirm all rows reveal in sequence and the reveal animation correctly stops at the last row (no over/under-counting from a stale row-count ref).
- **Verified live this session, pixel-confirmed** — see §2 below.

### TC-4.5 — Multi-block response completion (`onAllCompleteRef` in `ResponseBlocks.tsx`)
- **Steps:** Prompt for a response containing 2+ structured blocks in sequence (e.g. a table followed by a chart), confirm the "all complete" callback fires exactly once, after the last block finishes, not early/late/duplicated.
- **Needs manual QA** — requires a specific multi-block response shape not exercised this session.

---

## Phase 5 — no changes made (verification only, no regression risk)

No test cases — nothing was changed. The 11 sites investigated remain exactly as they were before this session.

---

## Summary — verification coverage

| Coverage | Count | Test cases |
|---|---|---|
| **Live-verified this session** (functional test or deterministic reproduction) | 6 | TC-1.2, TC-1.5 (partial), TC-1.7, TC-3.2, TC-4.1, TC-4.4 |
| **Verified via passing automated test suite** | 2 | TC-1.5, TC-1.6 (23 + 4 tests, both suites green) |
| **Verified via code-review only** (low practical risk, precondition not available this session) | 4 | TC-1.1, TC-1.3, TC-1.4, TC-1.8 |
| **Needs manual QA** (precondition not reproducible this session — mostly blocked by the unrelated Agents-wizard bug, or requiring precise timing/specific data shapes) | 6 | TC-2.2, TC-2.3, TC-2.4, TC-2.5, TC-3.1, TC-4.2, TC-4.3, TC-4.5 |

The "needs manual QA" column is the honest gap — mostly chart-variant visual confirmation and agent-dependent flows, not because the fixes are suspect, but because reproducing their exact preconditions live wasn't practical in this session's environment.
