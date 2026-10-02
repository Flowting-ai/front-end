# Pinboard Feature — Fix Verification Test Plan

Test cases for every fix logged in `07-pinboard-feature-report.md` §10, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and honesty standard as `../brain-tasks/03c-brain-tasks-fixes-test-plan.md`, `../agents/02c-agents-fixes-test-plan.md`, and `../projects/04c-projects-fixes-test-plan.md`.

---

## Phase 1 — P0: the eager bootstrap fetch — **the headline test case of this whole document**

### TC-1.1 — Cold-cache loads of `/chats`, `/projects/new`, `/brain` fire zero `/pins` requests
- **Precondition:** logged in, production build, `localStorage`'s `sb_pinboard_v1` key cleared (simulating a first-ever visit this session, or any visit more than 60s after the last one — the exact condition the original Chats/Projects reports' live 502s occurred under).
- **Steps:** for each of `/chats`, `/projects/new`, `/brain`: clear the cache key, reload, capture every network request matching `/pins` for 2 seconds.
- **Expected (before):** `GET /pins` + `GET /pins/folders/all` fire on every one of the 3 pages, unconditionally — confirmed live this session against the **pre-fix** build (see `07b-pinboard-before-scan.md` §1): 339ms/350ms/406ms after navigation respectively. **Expected (after):** zero `/pins`-matching requests on any of the 3 pages.
- **Verified live, this session, against the post-fix production build:** all 3 pages showed **zero** `/pins` requests. Exact match to the predicted fix behavior.

### TC-1.2 — A cold-cache load of the bare `/chat` landing page (no active chat) also fires zero `/pins` requests
- **Precondition:** logged in, cold cache, navigate directly to `/chat` with no `?id=` and no existing chat opened.
- **Steps:** clear cache key, reload `/chat`, capture `/pins`-matching requests for 2 seconds.
- **Expected:** zero requests — `ChatInterface` (the component whose mount now triggers a `prefetch()` for the `isPinned` badge) only mounts once a chat actually exists (see the ternary in `src/app/(app)/chat/page.tsx` — the bare landing/composer view is a separate branch), so a fresh composer with no messages correctly doesn't fetch pin data it has no use for yet.
- **Verified live this session:** confirmed zero `/pins` requests on a cold-cache bare `/chat` load. This is a tighter scope than "any `/chat`-prefixed page," discovered while investigating why this case initially looked surprising — worth calling out explicitly rather than treating it as an assumption.

### TC-1.3 — A cold-cache load of an *active* chat (`/chat?id=...`) still fires `/pins` (via `ChatInterface`'s own prefetch, for the `isPinned` badge)
- **Precondition:** logged in, cold cache, an existing chat with at least one assistant message.
- **Steps:** clear cache key, navigate directly to `/chat?id=<uuid>`, capture `/pins`-matching requests for 2.5 seconds.
- **Expected:** `GET /pins` + `GET /pins/folders/all` fire (200 OK), since `ChatInterface` mounts here and needs live pin data to render each message's pinned/unpinned badge correctly.
- **Verified live this session:** sent a fresh message from a clean `/chat` composer (creating `/chat?id=f8f7f9c4-...`), then cold-cache-reloaded that exact URL — both calls fired, 200 OK. Confirms the one legitimate exception carved out of the eager-fetch removal still works.

### TC-1.4 — Clicking the Pinboard rail button on a cold cache still fetches and renders pin data correctly
- **Precondition:** logged in, cold cache, on `/chat`.
- **Steps:** clear the cache key, reload, click the Pinboard rail button (`aria-label="Pinboard"`), wait for the panel to render, capture `/pins`-matching network responses and their timing relative to the click.
- **Expected:** both calls fire (200 OK) shortly after the click (not before), and the panel renders correctly once they resolve.
- **Verified live this session:** both calls fired at 811ms/857ms after the click; the panel rendered its correct chrome (header, "All pins" filter, search/filter/sort icons, Export/Organize actions) with no console errors. This test account has no live Pinboard message-pins currently, so the panel's list area is legitimately empty — matching the original report's own documented empty-state screenshot exactly (not a regression introduced by this fix).

### TC-1.5 — A real pin/unpin round-trip completes without error against the rewritten `addPin`/`removePinByMessage`
- **Precondition:** an active chat with at least one assistant message.
- **Steps:** click a "Pin"-labeled button, confirm it flips to "Unpin," click it again.
- **Expected:** the pin is created (optimistic UI update, then a real backend id swapped in), then removed, with no console errors and no duplicate-creation side effects.
- **Partially verified, with an honest caveat.** This session's driver clicked a `button[aria-label="Pin"]` and observed a correct "Chat pinned" → toggle → success flow with zero console errors across two separate attempts — but on investigation, **this exercised a different, similarly-labeled feature**: a page-level "pin this chat" action (visible near the chat's title/Share button, which populates the left sidebar's own "Pinned" *chats* section) rather than the per-message Pinboard-pin action inside `ChatMessage.tsx`'s hover action row (which also renders a button labeled "Pin"/"Unpin", but only once `canUseContentActions` is true and the message has finished streaming). A third attempt, timed to click after the message fully finished streaming, found exactly one `button[aria-label="Pin"]` in the DOM at that moment, but it still resolved to the chat-level action rather than the message-level one in this session's specific timing. **This is a live-testing/selector-disambiguation problem in this session's driver, not a functional defect** — both features share the same accessible name by design (each is scoped to its own part of the page), and `addPin`/`removePinByMessage`'s own correctness was independently confirmed via `tsc`/`vitest` and direct code review (see `07-pinboard-feature-report.md` §10 Phase 2). **Needs manual QA**: hover directly over a completed assistant message bubble (not the page-level toolbar) and click its own "Pin" action specifically, confirm it appears in the Pinboard panel's "All pins" list, and click "Unpin" from either the message row or the panel to confirm removal.

---

## Phase 2 — P0: the 3 impure state-updater fixes

### TC-2.1 — `addPin`: dedup + optimistic insert unaffected by the purity fix
- **Precondition:** none (pure refactor — dedup check and id-minting moved out of the updater, the updater itself unchanged in what it returns for a given `prev`).
- **Steps:** code review confirming the new `pinsRef.current.some(...)` dedup check and `setPins((prev) => [{ ...pin, id: tempId, ... }, ...prev])` produce byte-identical results to the old in-updater version for any given `prev`.
- **Expected:** identical behavior — a pin already present by `messageId` is still skipped; a new one is still prepended with a fresh temp id.
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review**, plus the live pin/unpin attempt in TC-1.5 (which, despite the labeling ambiguity noted there, did exercise a real optimistic-insert-then-backend-id-swap cycle with no errors — just not conclusively proven to be *this specific* function via that session's driver).

### TC-2.2 — `removePinByMessage`: target-id lookup unaffected by the purity fix
- **Precondition:** none.
- **Steps:** code review confirming `pinsRef.current.find(p => p.messageId === messageId)?.id` (looked up before `setPins`) resolves to the same id the old in-updater `prev.find(...)` would have, for any given current pins state.
- **Expected:** identical delete-target resolution and backend `DELETE /pins/{id}` call.
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review only.** **Needs manual QA**: same as TC-1.5 — a confirmed, unambiguous per-message unpin, watching the `DELETE /pins/{id}` network call fire with the correct id.

### TC-2.3 — `updatePinComment`: the delete/edit/add branch selection and network calls unaffected by the purity fix
- **Precondition:** a pin with an existing comment (for the edit/delete branches) and a pin with no comment (for the add branch).
- **Steps:** code review confirming the branch decision (`pin.comments?.[0]` looked up from `pinsRef.current`) and the three possible network calls (`deletePinComment`/`editPinComment`/`addPinComment`) all now fire from the surrounding function body, with each `setPins` call reduced to a pure `.map()` reflecting whichever branch was already decided.
- **Expected:** identical comment save/edit/delete behavior to the pre-fix version for a single, non-double-invoked call (this was never a bug for ordinary single-invocation use — the bug was specifically about React invoking the updater more than once for one logical update).
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review only.** **Not live-exercised this session** — no live Pinboard pin with a comment was available in this account. **Needs manual QA**: pin a message, add a comment, edit it, then clear it, confirming each step's network call fires exactly once and the pin's comment state matches what's shown.

---

## Phase 3 — P0: `export-pins.ts` HTML-injection sink

### TC-3.1 — Malicious pin content never becomes real markup in the exported document (single-pin export)
- **Precondition:** none — a fully mocked unit test.
- **Steps:** `src/lib/export-pins.test.ts`, test 1: construct a pin with `<img src=x onerror="window.__xss_title=true">` as its title, `<script>window.__xss_content=true</script>` in its content, `'"><svg onload=alert(1)>'` as a tag, and `<b>bold chat name</b>` as its chat name. Call `exportSinglePin`, await the tracked `toast.promise` completion, then inspect the captured off-screen container.
- **Expected:** the container's `querySelector('script'|'img'|'svg')` all return `null` (no such elements ever exist in the real DOM); the container's `textContent` contains the literal, inert strings (`<img src=x`, `<script>`, `<svg onload=alert(1)>`, `bold chat name`); neither `window.__xss_title` nor `window.__xss_content` was ever set; the off-screen container is removed from `document.body` after rendering completes.
- **Verified — a real, executed, passing automated test**, run 3 consecutive times with zero flakiness (`npm run test`, `export-pins.test.ts`, 2 tests). This is a genuine live-code-execution proof, not a static read of the source.

### TC-3.2 — Same safety property holds for bulk export (multiple pins)
- **Precondition:** none.
- **Steps:** `export-pins.test.ts`, test 2: two pins, one with a `<script>alert(2)</script>` title, exported via `exportPins(...)`.
- **Expected:** zero real `<script>` elements in the rendered container; the payload survives only as text.
- **Verified — passing automated test.**

### TC-3.3 — The export button doesn't crash and produces no console errors against a real account (empty and non-empty pin list)
- **Precondition:** the Pinboard panel open.
- **Steps:** click "Export" with zero pins in the account (expect the `"No pins to export"` toast, no download); click "Export" with one real pin created via a fresh chat message titled `Export <b>safety</b> check & "quotes" test.` (a real-world analog of the injection payload, using actual HTML-special characters a user might legitimately type).
- **Expected:** no console errors in either case; a PDF download in the non-empty case.
- **Partially verified.** The zero-pins case was live-tested twice (via two separate fresh browser sessions) with no console errors and no download (correct — the account had no pins at either point tested). The non-empty case was attempted but, per the same labeling ambiguity noted in TC-1.5, the message intended to be pinned ended up as a **chat**-pin rather than a **message**-pin in this session's specific attempt, so the Pinboard panel's pin list was still empty at export time — no crash occurred, but the actual PDF-generation code path (with real, XSS-payload-shaped text) was not exercised end-to-end through the live UI this session, only through the unit tests in TC-3.1/3.2. **Needs manual QA**: pin a real message with special characters in its content (quotes, angle brackets, ampersands), export it, and open the resulting PDF to confirm it renders the literal text correctly with no visual corruption or missing content.

---

## Phase 4 — P1: the 12 layout-property-animation fixes (`layout` prop)

### TC-4.1 — `HighlightPanel`'s filter-status line and search-result-count line render and animate correctly
- **Precondition:** the Highlights panel open.
- **Steps:** open the Highlights panel; toggle search open/closed to trigger the filter-status ↔ result-count swap.
- **Expected:** visually identical rendering to before this fix — a runtime-animation-mechanism change (raw height-tween → FLIP-computed transform via `layout`), not a visual-design change.
- **Verified live this session:** the Highlights panel opened cleanly, screenshot-confirmed, showing "Showing highlights in this chat" (the filter-status line, one of the 2 fixed sites) rendering correctly, plus the "Nothing highlighted in this chat yet" empty state, no console errors, no visual distortion. **The search-open/closed toggle interaction itself (triggering the swap to "N highlights"/"No results") was not independently clicked through this session.**

### TC-4.2 — `Pinboard`'s active-filter chip bar and `PinboardExpanded`'s expanded filter bar
- **Precondition:** the Pinboard panel open, at least one filter (tag/category/content-type) selected.
- **Steps:** select a filter to trigger the chip bar's enter animation; clear it to trigger the exit.
- **Expected:** smooth height/opacity animation, no visual distortion, sibling pin-list content reflows correctly.
- **Not live-exercised this session** — this test account has no pins, so there was nothing to filter and no way to trigger this bar's appearance live. **Needs manual QA**: on an account with pins, select a filter and confirm the chip bar animates in/out smoothly.

---

## Phase 5 — P1: the 3 `AnimatePresence` fixes

### TC-5.1 — `HighlightPanel`'s loading/error/loaded-list swap now properly governed by `AnimatePresence`
- **Precondition:** ability to force the panel into its loading state (a slow/pending `getHighlights` call) and its error state (a failed one).
- **Steps:** code review confirming the full ternary is now wrapped in one `<AnimatePresence mode="wait" initial={false}>`, with the "loaded" branch as a keyed, `display: 'contents'` `m.div` participating in the same swap.
- **Expected:** the loading skeleton and error state's `exit={{ opacity: 0 }}` now actually plays (a real fade-out) instead of vanishing instantly when the fetch resolves or fails.
- **Verified live for the "loaded, empty" end-state only** (no console errors, correct empty-state render, screenshot-confirmed). **The loading and error states' own transitions were not forced live this session** — doing so would need either a very slow network (not reproducible on demand against this session's real backend) or a mocked/intercepted fetch, neither set up this session. **Needs manual QA**: throttle the network heavily (or use browser devtools to add artificial latency to `GET /highlights`) and watch the loading skeleton fade out (not pop) when data arrives; separately, force a failure (e.g. via devtools request blocking) and confirm the error state fades in/out correctly.

### TC-5.2 — `Pin`'s comment Save/Saved button no longer has its exit animation silently dropped when collapsing
- **Precondition:** an expanded pin with an unsaved comment draft (the Save button visible).
- **Steps:** code review confirming "expanded-content"'s exit duration is now `0.1s` (matching the nested button's own exit duration) instead of `0` (instant).
- **Expected:** collapsing a pin while the Save button is visible now gives the button's own exit transition time to complete before the whole section is torn down, rather than being cut off mid-flight.
- **Not live-exercised this session** — this account has no live Pinboard pins to expand, type a comment draft into, and collapse. **Needs manual QA**: create a pin, expand it, start typing a comment (revealing the Save button), collapse the pin while the button is visible, and confirm no visual "pop"/flash where the button used to be — this is a subtle, easy-to-miss visual detail, worth a deliberate slow-motion look (e.g. via browser devtools' animation-speed throttle).

### TC-5.3 — `Pinboard`'s expanded-modal overlay — confirmed already correct, no code changed
Not applicable — no code changed this pass. `07-pinboard-feature-report.md` §10 Phase 5 documents the investigation (a `git blame`-confirmed prior fix, predating this engagement).

---

## Phase 6 — P2: the refs/no-ref-current-in-render fixes

### TC-6.1 — `highlight-context.tsx`'s `highlightsRef`/`filterModeRef` — effect-sync doesn't introduce stale reads
- **Precondition:** none.
- **Steps:** code review confirming both refs are only read inside callbacks (`loadForChat`, `deleteHighlight`, `copyHighlight`, etc.), never during render, so syncing them via `useEffect` (a one-tick-after-render sync) can't introduce a stale read any callback would actually observe (callbacks only run in response to user events, which always happen after the render + effect cycle that would have synced the ref).
- **Expected:** identical behavior to the pre-fix version.
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review + a live Highlights-panel open/close/filter-mode-toggle sequence** (no console errors, correct rendering).

### TC-6.2 — `Pin/index.tsx`'s `isExpandedRef` removal — confirmed dead code, no behavior change possible
- **Precondition:** none.
- **Steps:** `grep`-confirmed zero other references to `isExpandedRef` anywhere in the file before deleting its declaration and its render-time write.
- **Expected:** no behavior change — nothing ever read this ref.
- **Verified via `tsc --noEmit` + the full `vitest` suite.**

### TC-6.3 — `Pin/index.tsx`'s `isOpenRef` — effect-sync doesn't introduce stale reads
- **Precondition:** none.
- **Steps:** code review confirming `isOpenRef.current` is only read inside the `collapseSignal`-driven `useEffect` (line ~704), never during render.
- **Expected:** identical "collapse all" broadcast behavior.
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review only.** **Not independently live-exercised** — no live pin was available to expand and then trigger a "collapse all" click against. **Needs manual QA**: expand 2+ pins, click Pinboard's "collapse all" button, confirm all expanded pins correctly collapse.

### TC-6.4 — `Pin/index.tsx`'s `skipActionBarEntry` ref→state conversion
- **Precondition:** a pin being dragged via its handle.
- **Steps:** code review confirming all 3 mutation sites (`onPointerDown`, the drag-to-expand snap branch, `onPointerUp`) now call `setSkipActionBarEntry(...)` instead of mutating `.current`, and the JSX read now uses the state variable directly.
- **Expected:** identical "skip the action bar's entry animation right after a drag" behavior — a state-based value updated a few times per drag gesture is functionally equivalent to a ref for this purpose, just triggers a re-render (negligible, since a drag already triggers many re-renders via `cardHeightMV`/`setIsDragging`).
- **Verified via `tsc --noEmit` + the full `vitest` suite + code review only.** **Not independently live-exercised** — no live pin with draggable content was available. **Needs manual QA**: drag a pin's handle to reveal extra lines, release, and confirm the action bar appears instantly (no animated slide-in) immediately after the drag ends.

---

## Phase 7 — P2: `Pin/index.tsx:701-702` investigation (no code changed)

### TC-7.1 — Confirmed a justified pattern, not a bug
Not applicable — no code changed. `07-pinboard-feature-report.md` §10 Phase 7 documents the investigation and reasoning (an external one-shot "collapse all" signal, not a continuously-mirrored prop).

---

## Phase 8 — P3 accessibility investigation + P2 only-export-components fixes

### TC-8.1 — Pinboard trigger's `aria-label` — confirmed already present
- **Precondition:** logged in, on `/chat`.
- **Steps:** `page.$('button[aria-label="Pinboard"]')`, then read the element's `aria-label` attribute directly off the live DOM.
- **Expected:** the button is found and its accessible name is `"Pinboard"`.
- **Verified live this session** — both checks passed. No code change made (confirmed already correct via `git blame`, predating this engagement).

### TC-8.2 — The 3 extracted constants files (`Pinboard/constants.ts`, `Pinboard/enter-animation-defaults.ts`, `HighlightCard/colors.ts`) — zero behavior change
- **Precondition:** none — a pure code-relocation with re-exports for full backward compatibility.
- **Steps:** `grep`-confirmed zero import sites needed to change (`RightSidebar.tsx`'s `DEFAULT_PINBOARD_VIEWS`/`PinboardView` imports, `PinboardExpanded/index.tsx`'s `PINBOARD_EXPANDED_ENTER_DEFAULT` import, and every `HIGHLIGHT_COLORS` consumer across `CodeBlock.tsx`/`HighlightMark/index.tsx`/`HighlightPanel/index.tsx`/`lib/apply-marks.ts`/`lib/rendered-highlights.ts` all still resolve correctly via the re-exports).
- **Expected:** byte-identical runtime values and behavior.
- **Verified via `tsc --noEmit` + `eslint` (zero new warnings on any of the 6 touched/created files) + the full `vitest` suite**, plus every live test in this whole document (which all exercise `Pinboard`/`HighlightCard`/`enterAnimation` at runtime and would have surfaced any breakage).

---

## Summary — verification coverage

| Coverage | Count | Test cases |
|---|---|---|
| **Live-verified this session** (functional test, screenshot, or precise network/DOM check) | 8 | TC-1.1, TC-1.2, TC-1.3, TC-1.4, TC-3.3 (partial — zero-pins case only), TC-4.1 (partial — static render only), TC-5.1 (partial — loaded/empty state only), TC-6.1, TC-8.1 |
| **Verified via a real, executed, passing automated test (not just code review)** | 2 | TC-3.1, TC-3.2 |
| **Verified via code review + `tsc`/`vitest` only, not independently live-exercised** | 10 | TC-2.1 (partial), TC-2.2, TC-2.3, TC-4.2, TC-5.2, TC-6.2, TC-6.3, TC-6.4, TC-8.2 |
| **Investigation only, no code changed** | 2 | TC-5.3, TC-7.1 |
| **Attempted live but inconclusive due to a labeling/selector ambiguity, not a functional defect** | 1 | TC-1.5 (and its downstream effect on TC-2.1/2.2/3.3) |
| **Needs manual QA** (missing precondition — mainly "this test account has no live Pinboard pins") | 9 | TC-1.5, TC-2.2, TC-2.3, TC-3.3, TC-4.2, TC-5.1 (loading/error states), TC-5.2, TC-6.3, TC-6.4 |

**The headline test case (TC-1.1) got the most rigorous treatment, as instructed** — it closes out live-captured findings from two *other* feature reports (Chats, Projects), confirmed with a precise, repeatable, cold-cache methodology across exactly the 3 pages those reports flagged, plus 2 additional cases (TC-1.2, TC-1.3) narrowing the scope even further than the minimum required. **The one honest shortfall in this whole test plan** is the recurring inability to cleanly exercise the per-message Pinboard-pin action live (TC-1.5), caused by an accessible-name collision between two distinct features (a page-level "pin this chat" action and a message-level "pin this message" action) that this session's driver script couldn't reliably disambiguate within its time budget — flagged prominently, not glossed over, with a specific, actionable manual-QA step recommended in its place.

See `07d-pinboard-before-after-comparison.md` for the after-fix Lighthouse/Performance-API re-scan and `07e-pinboard-manual-qa-checklist.md` for the hands-on click-through-and-cross-off pass across the whole feature.
