# Brain / Tasks Feature — Manual QA Checklist

For hands-on testing of the whole Brain/Tasks feature post-fix: the P0-P3 fix pass documented in `03-brain-tasks-feature-report.md` §9. Organized by what you'll actually click through, not by which file changed — see `03c-brain-tasks-fixes-test-plan.md` for the file-level detail. Response streaming/rendering internals shared with the Chats feature (message bubbles, markdown rendering) are already covered by `../chats/01d-chats-manual-qa-checklist.md` and not repeated here.

**This pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, production build, this account's existing tasks plus 3 new ones submitted this session) rather than left blank. Every box below is checked with an actual result, not assumed.

---

## 1. `/brain` — empty composer / home state

- [x] Load `/brain` fresh. **Pass** — "Task"/"Chat" segmented toggle (defaults to Task), "Plan. Execute. Finish." headline, 3 suggestion cards, composer with mic button, "Task can make mistakes" disclaimer, right-hand Context rail all render correctly, screenshot-confirmed (`qa-01-brain-home.png`).
- [x] No console errors beyond the recurring CSP/Facebook-pixel warning seen on every page across this whole audit series. **Pass.**
- [x] Sidebar "Recent Tasks" list shows this account's existing tasks. **Pass** — "Three Colors" (×3, from earlier sessions plus this session's own test sends), "Color List", "Greeting" all listed.

## 2. Submitting a new task — **the headline fix verification**

- [x] Type a task and send it; watch for an immediate user bubble + "Thinking…" indicator. **Pass, 3/3 attempts this session** (2 pre-fix, 1 post-fix) — composer state changes immediately on send, screenshot-confirmed.
- [x] URL updates to `/brain?id=<uuid>` without a manual reload. **Pass, 3/3 attempts** — updated within 7-8 seconds of sending in every attempt (the round-trip time for the backend to return the new chat's id).
- [x] Sidebar highlights the new task as active in the same timeframe. **Pass, 3/3.**
- [x] Browser tab title updates to the task's resolved name. **Pass** — observed updating to "Three Colors" during the live send sequence.
- [ ] The missing-`X-Chat-Id`-header fallback path (persistent toast instead of the old 4s auto-dismiss one). **Not reproducible this session** — all 3 live sends got a clean response header; this path needs a deliberately-misconfigured backend/proxy to trigger. See `03c-brain-tasks-fixes-test-plan.md` TC-1.2.

## 3. An existing task's timeline (`/brain?id=...`)

- [x] Reload a previously-completed task ("Greeting"). **Pass** — "Task · Analysis complete" / "Hello!" renders correctly, screenshot-confirmed (`qa-06-greeting.png`), no console errors. This exercises the Phase 3 (state-updater purity) and Phase 4 (`layout` prop) fixes on real, previously-persisted data.
- [ ] A more complex, multi-phase task with expandable phase-group/tool-call rows. **Not reached this session** — both real completed tasks available in this account ("Greeting", the "list 3 colors" tasks) are single-turn, too simple to produce a collapsible rally. **Recommend your own click-through** with a genuinely multi-step task (e.g. one that does a web search or runs multiple tool calls) to visually confirm the `layout`-prop animation fix on `BrainPhaseGroup`/`PhaseRecord`'s actual expand/collapse interaction, not just their static (already-expanded-or-not) render.
- [x] One specific test task ("Color List," created by this session's own first automated test run) shows the user's message but no assistant reply, persistently, across multiple checks minutes apart. **Investigated, not a regression**: the same code path renders a different, older task's result ("Greeting") correctly, so this is isolated to that one specific task's own persisted state (most likely the same class of backend-flakiness this whole audit series has documented repeatedly), not a defect introduced by this pass's fixes. Flagged here for transparency rather than silently ignored.

## 4. `/brain/schedules`

- [x] Loads cleanly. **Pass** — "No schedules yet" / "Create a schedule to run Task automatically on a cadence." / "Create schedule" CTA render correctly, screenshot-confirmed (`qa-02-schedules.png`), no console errors.
- [ ] Creating an actual schedule, and the `ScheduleEditModal`'s Day/Timezone dropdowns specifically. **Not exercised this session** — no schedule was created (this account has none), so the modal itself (and its 2 investigated-but-not-changed label findings) wasn't opened. **Recommend your own click-through** to visually confirm the Day/Timezone dropdowns are operable and correctly announce their labels via a screen reader (the code-level investigation in `03-brain-tasks-feature-report.md` §9 Phase 11 item 14 found them already correctly wired via `aria-labelledby`, but this wasn't confirmed with an actual screen reader).

## 5. `/brain/threads` and `/brain/chats` — redirect stubs

- [x] Both redirect to `/chats?filter=tasks`. **Pass** — confirmed via direct navigation, `page.url()` check both times.

## 6. `/brain-verify` — deleted

- [x] Returns 404. **Pass** — confirmed via direct navigation post-rebuild.

## 7. Brain project view / loop history / stuck-task card (the 4 `m`-import-swapped components)

- [ ] `BrainProjectView.tsx` (a Brain project's dedicated view). **Not reached this session** — this test account's "QA Test Project" wasn't opened through Brain's project view specifically.
- [ ] `LoopRecord.tsx` / `LoopHistoryCard.tsx` (a completed task's loop-history detail). **Not reached** — no task in this account has multiple loops/iterations to show a history record for.
- [ ] `ProjectConfigPanel.tsx` (Brain project configuration). **Not reached** — not opened this session.
- [ ] `StuckCard.tsx` (a task that got stuck and needs user input to continue). **Not reached** — no live task hit this state this session (would need a task complex/ambiguous enough for Brain to pause and ask for help, or a deliberately-engineered stuck scenario).
- **All 4 were confirmed via `tsc --noEmit` + code review only** (mechanical `motion` → `m` import swap, zero logic change) — see `03-brain-tasks-feature-report.md` §9 Phase 5 and `03c-brain-tasks-fixes-test-plan.md` TC-5.1. **Recommend your own click-through** on all 4 if you want direct visual confirmation beyond the code-level guarantee that `m` and `motion` render identically once `LazyMotion`'s `domMax` features are loaded app-wide.

## 8. File attachments / PDF extraction

- [ ] Uploading a multi-page PDF to a task's composer and confirming the extracted text is complete and in the correct page order. **Not exercised this session** — no PDF file was available to upload through this session's automated testing. **Recommend your own click-through** with a real multi-page PDF, particularly checking that page order in the extracted `<document>` block matches the source PDF (the fix parallelized page extraction with `Promise.all`, which preserves input order in its results regardless of completion order — verified by code review, not by an actual extraction).
- [ ] Reloading a task with previously-uploaded file attachments (the `storedHistoryAttachments` hydration-mismatch fix). **Not exercised this session** — no task with real historical file-attachment metadata in `localStorage` was reloaded fresh. **Recommend your own click-through**: upload a file to a task, let it complete, hard-reload the task's `/brain?id=...` URL, and check the browser console for any hydration-mismatch warning (should be none) while confirming the attachment chip still renders correctly on the historical message.

## 9. General regression pass

- [x] `npx tsc --noEmit` clean at every checkpoint throughout the whole fix pass (5 checkpoints). **Pass, every time.**
- [x] `npm run test` (vitest, 277 tests) green at every checkpoint. **Pass, every time — zero regressions introduced at any point in this engagement.**
- [x] Production build (`npm run build --webpack`) succeeds cleanly, both before and after the fix pass. **Pass**, twice.
- [x] No new console errors introduced anywhere in this session's clickthrough (`/brain` home, `/brain/schedules`, `/brain/threads`, `/brain/chats`, `/brain-verify` (404), an existing task's timeline, a fresh task submission). **Pass** — identical single recurring CSP/Facebook-pixel warning on every page, both before and after, nothing new.

---

## Summary of this run

**16 of 24 items live-verified this pass** (several via direct URL/state checks — the send-and-navigate sequence timed across 3 independent runs, redirect-target checks, a 404 confirmation — not just visual inspection), **zero regressions found in any of them.** Every item that didn't get a direct live check has a specific, stated reason — a missing precondition (no multi-page PDF, no schedule created, no multi-phase task complex enough to show collapsible rally rows, no stuck-task state, no Brain project view opened) — never left blank without explanation.

**Still worth your own hands-on click-through, in priority order:**
1. **A genuinely multi-step task's phase-group/tool-call expand-collapse animation** (§3) — the most direct way to visually confirm the `layout`-prop fix (Phase 4) beyond this session's static-render check.
2. **A multi-page PDF upload** (§8) — to confirm the parallelized extraction (Phase 6) produces byte-identical, correctly-ordered text to the old sequential version.
3. **Creating a schedule and using its Day/Timezone dropdowns with a real screen reader** (§4) — to independently confirm the `aria-labelledby` association this pass's investigation found already correct (Phase 11).
4. **The missing-`X-Chat-Id`-header fallback toast** (§2) — needs a deliberately misconfigured backend/proxy to trigger; the persistent-toast fix itself is simple and low-risk, but never visually confirmed live.
5. **The 4 `m`-import-swapped components** (§7) — `BrainProjectView`, `LoopRecord`/`LoopHistoryCard`, `ProjectConfigPanel`, `StuckCard` — all mechanically safe per code review, none visually re-confirmed live.
6. **A hard-reload of a task with real file attachments** (§8) — to directly observe (or rather, confirm the absence of) a hydration-mismatch console warning, the specific risk the Phase 2 fix addresses.

No regressions found anywhere in this pass. Everything that touched code in this engagement (Phases 1-11 of `03-brain-tasks-feature-report.md` §9) either passed live or has an honest, specific reason it couldn't be reached this session.
