# Brain / Tasks Feature — Fix Verification Test Plan

Test cases for every fix logged in `03-brain-tasks-feature-report.md` §9, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and honesty standard as `../agents/02c-agents-fixes-test-plan.md` and `../projects/04c-projects-fixes-test-plan.md`.

---

## Phase 1 — P0: post-submit navigation

### TC-1.1 — Sending a task from a clean `/brain` composer navigates to `?id=<uuid>` — **the headline test case of this whole document**
- **Precondition:** logged in, production build, `/brain` fresh (no `?id=` in the URL).
- **Steps:** type "List 3 colors, one word each, comma separated." into the composer, press Enter; watch the URL every second for 10 seconds; screenshot immediately after send and again at t+10s.
- **Expected (before, per the original report):** URL never changes from `/brain`; composer returns to the same blank "Plan. Execute. Finish." state with no indication anything happened. **Expected (after / actually observed both this pass and the pre-fix baseline — see below):** composer immediately shows a user bubble + "Thinking…" indicator; URL updates to `/brain?id=<uuid>` within ~7-8 seconds; sidebar's "Recent Tasks" highlights the new task in the same frame.
- **Verified live, twice, against the pre-fix production build, and once more against the post-fix production build (3 independent runs total, all consistent):**
  - Pre-fix run 1: navigated to `/brain?id=b2d1107a-3e06-47ba-a6d1-37a80e707bd9` at t+8s.
  - Pre-fix run 2: navigated to `/brain?id=7cceb1ad-3e1b-4309-abf4-c82f075dc426` at t+7s.
  - Post-fix run: navigated to `/brain?id=38ffd19d-8b39-45d0-9fd6-367662fd07b7` at t+7s.
  - All three: screenshot-confirmed user bubble + thinking indicator immediately after send, sidebar showing the new task as active.
- **Honest framing:** this test case's real finding is that **the original report's P0 bug does not reproduce** — the fix pass's actual code change here (Phase 1 item 2, the toast duration) touches a narrower fallback branch this test case's 3 runs never exercised (all 3 got a clean `X-Chat-Id` header). See TC-1.2 for that branch specifically.

### TC-1.2 — Missing `X-Chat-Id` header fallback — toast now persists until dismissed
- **Precondition:** a `POST /brain/create` response with no `X-Chat-Id` header (a backend/proxy misconfiguration — not reproducible on demand against this session's real backend, which returned the header correctly in all 3 runs above).
- **Steps:** code review of the changed line only — confirmed `toast.warning('Chat started but cannot be saved to the URL. Refreshing will lose it.', { duration: Infinity })` replaces the previous call with `sonner`'s default (~4s) duration.
- **Expected:** the warning toast no longer auto-dismisses; it stays visible until the user closes it themselves.
- **Verified via code review + `tsc`/`vitest` only** — this fallback branch could not be forced without either a genuinely misconfigured backend/proxy (not available) or mocking the fetch layer to strip the response header (out of scope for a live-account test, and this session had no `react-doctor`/mocking harness available to do it cleanly). **Needs manual QA** if a way to force a headerless response becomes available (e.g. a staging proxy misconfigured on purpose).

---

## Phase 2 — P0: unguarded browser-global read

### TC-2.1 — `storedHistoryAttachments` no longer reads `localStorage` during render
- **Precondition:** a task with file-attachment metadata previously stashed in `localStorage` (key `brain_input_files_<chatId>`), then a hard reload of that task's `/brain?id=...` timeline.
- **Steps:** code review of the diff (useMemo → useState + useEffect); confirmed the effect populates `storedHistoryAttachments` from `localStorage` identically to the old memo's logic, just after mount instead of during render.
- **Expected:** identical end-state (attachment chips on historical messages) after the effect runs; the only behavior change is a single extra render tick before they populate — imperceptible in practice, matching the equivalent fix already made and accepted for `chat/page.tsx`'s `selectedPersona`.
- **Verified via `tsc --noEmit` + the 277-test suite + code review only.** **Not independently live-reproduced with a real hard-reload-with-cached-attachments scenario this session** — doing so would require a task with actual file attachments in this test account's history and a timed hard-reload check for a hydration-mismatch console warning, neither set up this session. **Needs manual QA**: upload a file to a task, let it complete, hard-reload `/brain?id=...`, confirm no hydration-mismatch warning in the console and that the attachment chip still renders on the historical message.

---

## Phase 3 — P0: the 9 impure state-updater call sites

### TC-3.1 — Timeline rendering is unaffected by the id-minting relocation
- **Precondition:** any task whose stream emits at least one of the 9 covered event kinds (`permission_prompt`, `approval_prompt`, `web_search`, `image`, `generated_file`, `tool_progress`/`docx_progress`, `tool_connect_prompt`, `content` tokens, tool-call lifecycle).
- **Steps:** reload an existing completed task's timeline (`/brain?id=dc811b4a-...`, a "Greeting" task with a real persisted result) and confirm the timeline renders with correct content and no duplicate/missing rows; submit a fresh task and watch the streaming timeline build up in real time (text tokens, at minimum, are exercised by every task).
- **Expected:** identical timeline content and ordering to before this fix — this was a purity fix (relocating a ref mutation, not a logic change), so timeline rows should be indistinguishable in a normal (non-Strict-Mode-double-invoke-triggering) run.
- **Verified live, twice:** (a) the "Greeting" task's historical timeline reloaded correctly, showing "Task · Analysis complete" / "Hello!" with no console errors — this row is exactly the `content`-token-streaming code path (Phase 3 fix #8 in the file's line list), confirming its post-fix behavior is correct on real, previously-persisted data. (b) A fresh task submission (the same "List 3 colors" prompt used in TC-1.1) streamed and completed correctly end-to-end, including the composer's user-bubble/thinking-indicator sequence and eventual URL update — this exercises the `content` token-append path repeatedly during streaming. **Not independently verified under React Strict Mode's actual double-invoke** (this app doesn't run in Strict Mode dev-server style during a production build/`next start`, so the specific double-increment bug this fix prevents can't be directly observed either before or after — its absence is inferred from the code's correctness, not measured). **The other 8 of the 9 event kinds** (`permission_prompt`, `approval_prompt`, `web_search`, `image`, `generated_file`, `tool_progress`, `tool_connect_prompt`, tool-call lifecycle) **were not independently exercised this session** — none of the specific test tasks submitted needed a real web search, image generation, file generation, tool connection, or permission/approval prompt. **Needs manual QA**: submit tasks that specifically trigger each of these 8 remaining event kinds and confirm each renders its timeline row exactly once with a stable, unique id.

---

## Phase 4 — P1: layout-property animations

### TC-4.1 — `layout` prop on `BrainPhaseGroup`/`BrainResultHeader`/`BrainTimeline`/`PhaseRecord`
- **Precondition:** an existing task with a completed result.
- **Steps:** reload the "Greeting" task's timeline (`/brain?id=dc811b4a-...`); confirm the result header ("Task · Analysis complete" / "Hello!") renders without distortion; screenshot-compare to the pre-fix rendering pattern used throughout this whole audit series (no squish/skew/clipping).
- **Expected:** visually identical rendering to before — this is a runtime-animation-mechanism change (raw height-tween → FLIP-computed transform via the `layout` prop), not a visual-design change.
- **Verified live this session:** the "Greeting" task's result rendered cleanly, screenshot-confirmed (`qa-06-greeting.png` in this session's scratchpad), no console errors. **The actual collapse/expand interaction itself (clicking to expand a `BrainPhaseGroup`/`PhaseRecord` row and watching the animation play) was not independently clicked through this session** — the two real tasks reached in this session's live testing (a trivial "list 3 colors" task and a trivial "hello" greeting) are both too simple to produce a multi-phase rally with collapsible phase groups; reaching a task complex enough to have real phase-group/tool-call rows to expand would need a longer-running, more elaborate task than this session's time budget allowed. **Needs manual QA**: submit or find a more complex multi-step task, expand/collapse its phase groups and any tool-call detail chips, and confirm the animation is smooth with no content distortion.

---

## Phase 5 — P1: uncontrolled Framer Motion imports

### TC-5.1 — `BrainProjectView.tsx`/`LoopRecord.tsx`/`ProjectConfigPanel.tsx`/`StuckCard.tsx` `m` import swap
- **Precondition:** none — this is a mechanical import/JSX-tag rename with no logic change.
- **Steps:** `grep`-confirmed zero remaining `motion.` references in any of the 4 files post-fix; `tsc --noEmit` confirms no type errors from the swapped import.
- **Expected:** byte-identical rendering and animation behavior — `m` and `motion` render identically once `LazyMotion`'s `domMax` features are loaded (already the case app-wide via `MotionProvider`), the only difference is bundle-splitting.
- **Verified via `tsc --noEmit` + the 277-test suite + code review only.** **None of these 4 components were reached live this session** — `BrainProjectView` (project-scoped Brain view), `LoopRecord`/`ProjectConfigPanel` (project-config and loop-history detail views), and `StuckCard` (shown only when a running task gets stuck and needs user input) all require either a Brain project to be configured or a task to reach a specific rare state, neither set up this session. **Needs manual QA**: open a Brain project's config panel, a loop-history record, and (if reproducible) a stuck-task prompt, confirming each still renders and animates correctly.

---

## Phase 6 — P1: `brain-file-extract.ts` parallelization

### TC-6.1 — PDF page-extraction loop, `Promise.all` conversion
- **Precondition:** a multi-page PDF file uploaded to a Brain task's composer.
- **Steps:** confirmed via code review that (a) each iteration's work (`pdf.getPage(i)` → `getTextContent()`) reads only its own page and writes only to its own array slot, no cross-iteration dependency; (b) `Promise.all` preserves input order in its results array regardless of completion order, so the post-processing `.filter()` for blank pages can't scramble page order.
- **Expected:** identical extracted text (same pages, same order, same content) to the sequential version, just faster for multi-page PDFs.
- **Verified via `tsc --noEmit` + the 277-test suite + code review only.** **Not independently live-exercised this session** — no real multi-page PDF was uploaded through Brain's composer to confirm extracted text matches byte-for-byte between the before and after implementations. **Needs manual QA**: upload the same multi-page PDF before and after this change (or just once, now, since the "before" code path no longer exists) and manually confirm the extracted `<document>` block's text content is complete and in the correct page order.

---

## Phase 7 — P2: `/brain/threads`/`/brain/chats` investigation (no code changed)

### TC-7.1 — Confirmed still redirecting correctly
- **Precondition:** none.
- **Steps:** navigated directly to `/brain/threads` and `/brain/chats` against the post-fix production build.
- **Expected:** both redirect to `/chats?filter=tasks`, unaffected by any fix in this pass (nothing in this pass touched either route file).
- **Verified live this session:** `brain/threads redirected to: http://localhost:3000/chats?filter=tasks` and `brain/chats redirected to: http://localhost:3000/chats?filter=tasks`, both confirmed via `page.url()` after navigation.

---

## Phase 8 — P2: `brain-verify` deletion + `proxy.ts` cleanup

### TC-8.1 — `/brain-verify` now 404s; `/reasoning-verify` still works
- **Precondition:** post-fix production build.
- **Steps:** navigated to `/brain-verify` directly.
- **Expected:** a 404 (the page and its route no longer exist), and `/reasoning-verify` (a different, still-live dev harness gated by the same `proxy.ts` block) is unaffected.
- **Verified live this session:** `brain-verify status: 404`. **`/reasoning-verify` was not independently re-visited this session** — traced via code review only (the fix removed `/brain-verify` from the allowlist condition and collapsed the duplicated block, but left the `/reasoning-verify` check itself untouched, so it should be unaffected — `tsc`/`vitest` don't cover middleware route-gating behavior directly). **Needs manual QA**: visit `/reasoning-verify` in a non-production environment and confirm it still bypasses auth correctly.

---

## Phase 9 — P2: `useBrainHomeDigest` extraction

### TC-9.1 — Home composer's "Active schedules"/"Recent activity" rail, unchanged behavior
- **Precondition:** logged in, `/brain` fresh (no `?id=`).
- **Steps:** loaded `/brain` post-fix; confirmed the page renders its empty-composer state ("Plan. Execute. Finish.", suggestion cards, composer) without error.
- **Expected:** identical behavior to before the extraction — this was a pure code-relocation (the effect's logic, dependencies, and cleanup are byte-identical, just moved to `src/hooks/use-brain-home-digest.ts` and invoked via `useBrainHomeDigest(!!chatIdFromUrl)`).
- **Verified live this session:** `/brain` loaded cleanly post-fix (`qa-01-brain-home.png`), no console errors. **This test account had no active schedules and no recent schedule-run history at the time of this session's testing**, so the actual "Active schedules"/"Recent activity" rail content itself (as opposed to just the page not crashing) wasn't visually exercised. **Needs manual QA**: on an account with at least one active schedule and one completed schedule run, confirm both the schedules list and the digest render with correct data, matching pre-extraction behavior.

---

## Phase 10 — small nits

### TC-10.1 — `PinConfirmationCard.tsx` lazy initializer
- **Precondition:** a pin-confirmation prompt (Brain asking the user to confirm which pins to use for context).
- **Steps:** code review confirming the initializer is now `() => new Set(defaultIds)` (lazy) instead of `new Set(defaultIds)` (eager); behaviorally these produce the same initial state, the only difference is whether the `Set` is constructed on every render or only the first.
- **Expected:** identical initial `selected` state and toggle behavior.
- **Verified via `tsc --noEmit` + the 277-test suite + code review only.** **Not independently live-exercised this session** — no pin-confirmation prompt was triggered live (this test account's pinboard wasn't populated with pins in a state that would trigger this card). **Needs manual QA**: trigger a pin-confirmation prompt and confirm the default-selected pins and toggle behavior are correct.

---

## Phase 11 — P3: accessibility labels

### TC-11.1 — `brain/page.tsx` credential-form field `htmlFor`/`id` pairing
- **Precondition:** a `tool_connect_prompt` event requiring an API-key-style credential form (e.g. a Shopify-style per-tenant connector).
- **Steps:** code review confirming each field now gets a unique `id="credential-field-${field.name}"` matched to its `<label htmlFor={...}>`.
- **Expected:** each field's accessible name now resolves via the native `label`/`for` mechanism (previously placeholder-only); zero visual change (pure attribute addition).
- **Verified via `tsc --noEmit` + the 277-test suite + code review only.** **Not independently live-exercised this session** — no live task reached a `tool_connect_prompt` requiring the API-key credential form (this test account's connectors didn't trigger that specific auth mode during this session's testing). **Needs manual QA**: trigger a per-tenant API-key connector prompt and confirm each field's accessible name (via a screen reader or the DOM's computed accessible-name) now resolves to the visible label.

### TC-11.2 — `ScheduleEditModal.tsx`'s 2 findings — investigation only, no code changed
Not applicable — no code changed. See `03-brain-tasks-feature-report.md` §9 Phase 11 item 14 for the investigation and reasoning (confirmed already-accessible via `aria-labelledby`).

---

## Summary — verification coverage

| Coverage | Count | Test cases |
|---|---|---|
| **Live-verified this session** (functional test, screenshot, or precise state check) | 6 | TC-1.1 (3 independent runs), TC-3.1 (partial — `content`-token path only), TC-4.1 (partial — static render only, not the animation itself), TC-7.1 (full), TC-8.1 (partial — `/brain-verify` only), TC-9.1 (partial — page loads, digest content not populated in this account) |
| **Verified via code review + `tsc`/`vitest` only, not independently live-exercised** | 7 | TC-1.2, TC-2.1, TC-5.1, TC-6.1, TC-8.1 (the `/reasoning-verify` half), TC-10.1, TC-11.1 |
| **Investigation only, no code changed** | 1 | TC-11.2 |
| **Needs manual QA** (missing precondition, rare event kind, or account state not available this session) | 8 | TC-1.2, TC-2.1, TC-3.1 (8 of 9 event kinds), TC-4.1 (the actual expand/collapse animation), TC-5.1 (all 4 components), TC-6.1, TC-8.1 (`/reasoning-verify`), TC-9.1 (real schedule/digest data), TC-10.1, TC-11.1 |

**The headline test case (TC-1.1) got the most rigorous treatment in this document, as instructed** — 3 independent live runs across 2 separate production builds (pre- and post-fix), each screenshot-confirmed at multiple points in the send sequence, precisely because it's the single highest-value verification in this whole engagement. Every other item that didn't get a direct live check has a specific, stated reason — a missing precondition (no multi-step task complex enough to have collapsible phase groups, no multi-page PDF on hand, no pin-confirmation or connector-auth prompt triggered, no active schedules on this test account) — never left blank without explanation, matching the standard set by `../agents/02c-agents-fixes-test-plan.md` and `../projects/04c-projects-fixes-test-plan.md`.

See `03e-brain-tasks-manual-qa-checklist.md` for the hands-on click-through-and-cross-off pass across the whole feature.
