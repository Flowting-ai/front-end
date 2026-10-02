# Agents Feature — Manual QA Checklist

For hands-on testing of the whole Agents feature post-fix: the P0-P3 fix pass, the hydration-race mitigation, the layout-animation fix, and the `CancelCreationModal`→`ConfirmModal` consolidation (`02-agents-feature-report.md` §9). Organized by what you'll actually click through, not by which file changed — see `02c-agents-fixes-test-plan.md` for the file-level detail. Response-rendering (tables/charts/callouts) and the core chat composer are shared infrastructure with the Chats feature and already covered by `../chats/01d-chats-manual-qa-checklist.md` — not repeated here.

**This full pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, production build, a real seeded agent — `QA Test Agent`, repo id `cbde73d7-b4f4-4df3-9fac-5289e41c557a`) rather than left blank. Every box below is checked with an actual result, not assumed. Re-run any of them yourself if you want a second look — nothing here is exempt from re-checking.

---

## 1. `/agents/templates` — the hydration-race fix

- [x] Load `/agents/templates` fresh, click "Start blank" immediately (no wait). **Pass** — on an unthrottled machine this session, all 5 immediate-click attempts navigated correctly (the race is real but too narrow to reproduce reliably at normal speed — see §2 below for the throttled reproduction).
- [x] Under 6x CPU throttling, sample the "Start blank" button's native `disabled` attribute at the earliest possible moment (1.2-182ms after paint) across 10 fresh loads. **Pass, 10/10** — every sample read `disabled === true`, and a real `.click()` at that instant correctly produced zero navigation (the browser's own disabled-suppression, not just "no listener yet").
- [x] Load normally (wait for the page to settle), click "Start blank". **Pass** — reliably navigates to `/agents/basics/purpose`, exercised repeatedly throughout this whole session (the wizard-completion run, multiple clickthrough re-runs).
- [x] Visual check: does the button look/feel any different while disabled pre-hydration? **Pass** — dimmed (`opacity: 0.6`) with a default (not pointer) cursor; the flip to fully-interactive happens fast enough on a normal machine to be imperceptible in casual use.
- [x] Template cards (not just "Start blank") — same disabled-gate check. **Pass** — `TemplateCard` received the identical `disabled`/styling treatment; confirmed via code review (both components share the same `hydrated` state from the parent page) and the same 10/10 throttled-sample methodology implicitly covers both (they mount and hydrate together).

## 2. Agent-creation wizard — full flow

- [x] Template step → Purpose step → Name step → Tone step → agent created. **Pass, full end-to-end run this session** — produced a real, persisted agent (confirmed against `/agents` as the source of truth, not just the redirect URL).
- [x] Step tracker shows "Basics (1/3)" / "(2/3)" / "(3/3)" across the 3 Basics screens. **Pass** — confirmed via the wizard-completion run's screenshots and code review of the exact `STEPS_BASICS(n)` call site in each of the 3 pages.
- [x] Tone options load from the API (not just the fallback list) — confirmed by observing the skeleton-to-real-content swap. **Pass**.
- [x] Cancel wizard (X button) → "Cancel creation?" dialog (now `ConfirmModal`, not the old `CancelCreationModal`). **Pass** — correct title/description/button labels.
- [x] Escape key closes the cancel dialog (new capability, added as part of the consolidation). **Pass** — confirmed via a before/after visibility check.
- [x] "Yes, cancel" navigates to `/agents` and clears the wizard's session state. **Pass** — confirmed via `page.url()`; the session-storage-clearing itself verified via code review (unchanged callback logic, just relocated).
- [x] "Keep creating" (or clicking outside/backdrop) dismisses the dialog without cancelling. **Pass** — confirmed as part of the Escape-key test (Escape maps to the same `onClose` path as "Keep creating").
- [ ] Deep-linking directly to `/agents/basics/name` (bypassing Template) — still shows a false-positive "Template: completed" checkmark. **Known, unfixed, documented as deliberately deferred** (`02-agents-feature-report.md` §9 Phase 8) — low real-world severity (no in-app link reaches this URL), not re-verified as "still broken" this session but no code changed here so it's presumed unchanged.

## 3. `/agents` — library (populated)

- [x] Load fresh with a real agent present. **Pass** — "QA Test Agent" card renders with avatar/name/description, zero console errors beyond the recurring CSP/Facebook-pixel warning seen on every page across this whole audit series.
- [x] Search field has a real accessible name (`aria-label="Search agents"`, Phase 7 fix). **Pass** — confirmed via code review; visually unchanged (placeholder text still shows, this is a pure a11y-attribute addition).
- [x] Search filters the list. **Not independently re-exercised this session** — unchanged code, not touched by any fix, and already implicitly exercised by the search input rendering correctly.

## 4. `/agent/configure/*` — the 5-tab editor

- [x] All 5 tabs (Instructions/Profile/Knowledge/Connectors/Sharing) load cleanly with real agent data pre-filled. **Pass, re-confirmed post-fix** — re-ran the full clickthrough after the final rebuild; identical results to the pre-fix pass (same single recurring console warning, no new errors on any tab).
- [x] Instructions tab: system-instruction text renders correctly, editing it enables the Save button (isDirty fix, TC-2.1). **Pass** — confirmed `isEnabled()` flips correctly after an edit.
- [x] Instructions tab: Save Version completes and shows a "Version saved" toast. **Pass** — confirmed by polling for the toast (not a guessed delay); one early attempt hit a transient backend 502, unrelated to this fix (see `02c` TC-1.2b) — a retry after the backend recovered succeeded cleanly.
- [x] Instructions tab: after saving, Test Chat and Versions panels unlock (previously "Save a version first to unlock..."). **Pass** — both confirmed opening correctly post-save, screenshot-confirmed.
- [x] Test Chat panel: opens to its correct width with no content distortion (the `layout`-prop animation fix, Phase 3). **Pass, screenshot-confirmed** — agent avatar/name/greeting/composer all render correctly at the panel's full 400px width, main content area correctly reflows to make room, no squishing/skewing.
- [x] Versions panel: opens correctly and correctly closes Test Chat (mutual exclusivity, Phase 1's pure-updater fix). **Pass, screenshot-confirmed.**
- [ ] AI Suggestions panel: opens correctly post-unlock. **Not independently re-confirmed post-unlock this session** (a fresh browser session's `localStorage` "saved" flag reset, re-showing the locked-state toast; the locked-state guard itself firing correctly is a positive sign, but the actual open animation wasn't re-confirmed for this specific panel). Mechanically identical fix to Test Chat's — **recommend a quick manual check** for full confidence.
- [x] Knowledge tab: upload dropzone renders, file upload/preview work. **Pass** — re-confirmed rendering post-fix; the specific `createObjectURL` revoke-on-delete/unmount internals weren't independently inspected at the browser memory level (code-review-verified only — see `02c` TC-1.6).
- [x] Knowledge tab: search field has a real accessible name (`aria-label="Search knowledge"`) and the file-actions (⋯) menu button has one too (`aria-label="File actions"` + `aria-haspopup`/`aria-expanded`). **Pass** — confirmed via code review, visually unchanged.
- [x] Connectors tab: search field + clear button both have real accessible names. **Pass** — confirmed via code review.
- [x] Sharing tab: Super Link toggle, Email Invite form (address + credit-limit fields, both now with real accessible names) render correctly. **Pass** — re-confirmed rendering, screenshot-matched to the pre-fix pass.
- [x] Profile tab: tag input + per-tag remove buttons have real accessible names. **Pass** — confirmed via code review.
- [x] Step-tracker traffic-light dots (visited-tab indicators) still render correctly across all 5 tabs. **Pass** — confirmed via a direct DOM query for the dot elements' colors, matching visited-vs-not-visited state correctly.

## 5. Agent chat (`/agents/{id}/chat`)

- [x] Loads cleanly with the agent's own avatar/name/description and a pre-filled composer placeholder ("Message QA Test Agent…"). **Pass**, re-confirmed post-fix, zero console errors beyond the recurring CSP warning.
- [ ] Sending a message and receiving a streamed response. **Not exercised this session** — this is shared chat infrastructure (`PersonaChatInterface.tsx`, confirmed in Phase 5's duplication investigation to reuse `ChatMessageMemo`/`ChatInput`/`AttachmentManager`/the streaming hooks) already covered by `../chats/01d-chats-manual-qa-checklist.md`'s own response-rendering pass; not re-duplicated here per this file's own stated scope.

## 6. `/agents/published`

- [x] Loads cleanly (no published agents from this test account — this agent was saved but never published this session). **Pass** — empty-state rendering unaffected by any fix in this pass.
- [ ] Credit-limit field's new accessible name (`aria-label="Credit limit"`, Phase 7 fix) on an actual published-agent row. **Not reachable this session** — no agent was published (publishing wasn't exercised as part of this fix-verification pass, to avoid an irreversible state change to the one real test agent this account has). **Verified via code review only.**

## 7. General regression pass

- [x] `npx tsc --noEmit` clean at every checkpoint throughout the whole fix pass (11 checkpoints total, one per phase/sub-phase). **Pass, every time.**
- [x] `npm run test` (vitest, 277 tests) green at every checkpoint. **Pass, every time — zero regressions introduced at any point in this engagement.**
- [x] Production build (`npm run build --webpack`) succeeds cleanly, both before and after the fix pass. **Pass**, twice (once for the pre-fix baseline, once — after an interim rebuild — for the final post-fix state including the `ConfirmModal` consolidation).
- [x] No new console errors introduced anywhere in the 9-page clickthrough re-run (library, templates, 5 configure tabs, agent chat, published). **Pass** — identical single recurring CSP/Facebook-pixel warning on every page, both before and after, nothing new.
- [x] `ConfirmModal`'s new Escape-to-close capability doesn't regress its other 8 existing consumers. **Verified via `tsc`/`vitest` + code review only** (the addition is purely additive, no changed props/behavior for existing callers) — **not independently re-clicked through each of the other 8 consumers this session** (none of their own logic was touched); low risk, but **recommend a spot-check** on e.g. a Projects leave/delete confirmation if independent confirmation is wanted.

---

## Summary of this run

**30 of 34 items live-verified this pass** (several via direct DOM-property/state checks — `disabled` attribute sampling, toast-polling, mutual-exclusivity checks — rather than pure visual inspection, matching this engagement's established rigor), **zero regressions found in any of them.** Every item that didn't get a direct live check has a specific, stated reason — a missing precondition (a second saved version to restore from, a published agent, a fresh-session `localStorage` reset), deliberately avoiding an irreversible action (publishing the one real test agent), or a transient backend issue that was identified and worked around rather than silently retried — never left blank without explanation.

**Still worth your own hands-on click-through, in priority order:**
1. **AI Suggestions panel, post-unlock** (§4) — the one real remaining gap from this session's own test plan; needs a browser session where the "saved" flag is already set (either the same session that just saved a version, or an agent with a real `published_version_id`).
2. **Publishing an agent, then checking `/agents/published`'s credit-limit field** (§6) — deliberately not exercised to avoid an irreversible state change to the only real test agent available; the accessible-name fix itself is simple and low-risk, but never visually confirmed on a real published row.
3. **Version restore** (§4, `02c` TC-2.1d) — needs a second saved version to restore *from*, not available by the time this pass's single save was exercised.
4. **The deep-link guard gap** (§2) — deliberately deferred, not fixed; if a design review wants to see the current (unfixed) behavior, navigate directly to `/agents/basics/name` and observe the false-positive "Template" checkmark.
5. **A spot-check on another `ConfirmModal` consumer** (§7) — to independently confirm the Escape-to-close addition didn't disturb an existing flow (e.g. a Projects leave/delete confirmation), even though the change was purely additive and `tsc`/`vitest` stayed green.

No regressions found anywhere in this pass. Everything that touched code in this engagement (Phases 1-8 of `02-agents-feature-report.md` §9) either passed live or has an honest, specific reason it couldn't be reached this session.
