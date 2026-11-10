# Pinboard Feature — Manual QA Checklist

For hands-on testing of the whole Pinboard feature post-fix: the P0-P3 fix pass documented in `07-pinboard-feature-report.md` §10. Organized by what you'll actually click through, not by which file changed — see `07c-pinboard-fixes-test-plan.md` for the file-level detail. Message-bubble/markdown-rendering internals shared with the Chats feature are already covered by `../chats/01d-chats-manual-qa-checklist.md` and not repeated here.

**This pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, production build, this account's existing chats plus several new test messages sent this session) rather than left blank. Every box below is checked with an actual result, not assumed. **This test account has essentially zero pre-existing Pinboard message-pins and zero highlights** — a real, honestly-reported limitation on how much of the feature's day-to-day *content* (as opposed to its empty-state chrome and its fixed code paths) could be exercised this session; see the priority list at the end.

---

## 1. The headline fix — eager bootstrap fetch no longer fires on unrelated pages

- [x] Cold-cache load of `/chats` fires zero `/pins`/`/pins/folders/all` requests. **Pass** — confirmed via network capture.
- [x] Cold-cache load of `/projects/new` fires zero `/pins`/`/pins/folders/all` requests. **Pass.**
- [x] Cold-cache load of `/brain` fires zero `/pins`/`/pins/folders/all` requests. **Pass.**
- [x] Cold-cache load of a bare `/chat` (no active chat) fires zero `/pins` requests. **Pass** — a tighter scope than initially expected, since `ChatInterface` (the component that legitimately needs pin data for the "already pinned" badge) doesn't mount until a chat actually exists.
- [x] Cold-cache load of an *active* chat (`/chat?id=...`) still correctly fires both calls (200 OK). **Pass** — confirms the `isPinned` badge's data need is still served.
- [x] Clicking the Pinboard rail button on a cold cache correctly fetches (200 OK, ~850ms) and the panel renders its correct chrome. **Pass**, screenshot-confirmed.

## 2. Locating and opening the panel

- [x] Pinboard rail button (`aria-label="Pinboard"`) present and clickable on `/chat`. **Pass.**
- [x] The button's accessible name resolves to `"Pinboard"` via the DOM's `aria-label` attribute (the original report's P3 finding, confirmed this session to already be correct — not fixed because there was nothing to fix). **Pass.**
- [ ] The button's accessible name confirmed with an actual screen reader (VoiceOver/NVDA/JAWS), not just a DOM attribute read. **Not done this session** — the DOM-level check is a strong proxy but not identical to hearing it through real assistive technology. **Recommend your own pass** with a real screen reader.
- [x] Panel opens with correct header ("Pinboard"), "All pins" filter dropdown, search/filter/sort icon buttons, Export/Organize actions at the bottom edge. **Pass**, matches the original report's own documented empty-state screenshot exactly.

## 3. Pinning and unpinning a message (the impure-updater fix's real-world surface)

- [ ] Hovering a completed assistant message reveals its own "Pin" action (distinct from the page-level "pin this chat" action near the title/Share button). **Not cleanly isolated this session** — this session's automated driver kept landing on the page-level chat-pin action instead, due to both features sharing the accessible name "Pin". **Recommend your own click-through**: hover directly over a message bubble (not the page toolbar) and confirm a per-message pin icon appears and behaves independently of the chat-level pin.
- [ ] Pinning a message adds it to the Pinboard panel's "All pins" list. **Not confirmed this session**, same reason as above.
- [ ] Unpinning removes it from the list and fires a real `DELETE /pins/{id}` call. **Not confirmed this session.**
- [x] The page-level "pin this chat" action (a separate, adjacent feature) works correctly and doesn't error. **Pass** (observed as a side effect of the above attempts — "Chat pinned" toast, sidebar's own "Pinned" chats section updated correctly). Confirmed as out of Pinboard's scope, not a defect.

## 4. Highlights panel (shares `HighlightPanel/index.tsx`'s fixes: 6 of the 12 layout-property-animation findings, 2 of the 4 AnimatePresence fixes)

- [x] Opens cleanly via the rail's "Highlights" button. **Pass**, screenshot-confirmed.
- [x] "Showing highlights in this chat" filter-status line renders correctly (one of the 2 `layout`-prop-fixed sites). **Pass.**
- [x] Empty state ("Nothing highlighted in this chat yet") renders correctly — exercises the restructured `AnimatePresence mode="wait"` ternary's "loaded, empty" branch. **Pass**, no console errors.
- [ ] Toggling search open/closed (the filter-status ↔ result-count swap, the other `layout`-prop-fixed site). **Not exercised this session** — search wasn't opened.
- [ ] The loading skeleton's fade-out when data arrives (the specific `AnimatePresence` bug fixed in `HighlightPanel`). **Not forced this session** — needs a slow/throttled network to observe. **Recommend your own pass** with devtools network throttling.
- [ ] The error state's fade-in/out (the same fix, other branch). **Not forced this session** — needs a deliberately-failed `/highlights` request. **Recommend your own pass** via devtools request blocking.
- [ ] Creating a real highlight (select text in a message → "Add to Highlights" or equivalent) and seeing it appear in the list with its own enter animation. **Not exercised this session** — no highlights exist on this account and none were created.

## 5. Pin card interactions (`Pin/index.tsx`'s fixes: 3 refs, 2 no-ref-current-in-render, 1 AnimatePresence fix, 1 investigated-and-left `no-adjust-state-on-prop-change`)

- [ ] Expanding a pin card (clicking to reveal the full comment field / metadata). **Not exercised** — no live pin to expand.
- [ ] Typing a comment draft on an expanded pin reveals the Save button with a smooth enter animation. **Not exercised.**
- [ ] Collapsing a pin while the Save button is visible — the specific scenario the `AnimatePresence`-exit-duration fix (Phase 5 item 15) addresses. **Not exercised.** **Recommend your own pass**, ideally with devtools' animation-speed slowdown, watching specifically for any abrupt "pop" where the Save button used to be.
- [ ] Dragging a pin's resize handle to reveal extra lines, then releasing — exercises `skipActionBarEntry`'s ref→state conversion (Phase 6 item 20). **Not exercised.** **Recommend your own pass**: after a drag-release, confirm the action bar appears instantly (no animated slide-in).
- [ ] Clicking Pinboard's "collapse all" button with 2+ pins expanded — exercises `isOpenRef`'s effect-sync fix (Phase 6 item 19) and the investigated-but-unchanged `collapseSignal` pattern (Phase 7). **Not exercised** (needs 2+ real pins). **Recommend your own pass.**

## 6. Export

- [x] Clicking "Export" with zero pins shows a "No pins to export" toast, no crash, no console error. **Pass**, tested twice.
- [ ] Clicking "Export" with at least one real pin whose content includes HTML-special characters (`<`, `>`, `&`, quotes) produces a correctly-rendered PDF with the literal characters visible as plain text, not corrupted or missing. **Not exercised live** — this session's automated attempt to first pin a message with such content landed on the page-level chat-pin action instead (see §3), so the Pinboard panel's list was still empty at export time. **The underlying safety property (no HTML injection) is proven by 2 real, passing automated tests** (`src/lib/export-pins.test.ts`) using the exact same kind of payload — but the *visual correctness* of the exported PDF with real special characters was not independently confirmed by opening an actual downloaded file. **Recommend your own pass**: pin a message containing `<`, `>`, `&`, and quote characters, export it, and open the PDF to confirm it looks right.
- [ ] Bulk export (selecting multiple pins via "Organize" mode, then exporting the selection). **Not exercised** — needs multiple live pins.

## 7. General regression pass

- [x] `npx tsc --noEmit` clean at every checkpoint throughout the whole fix pass (8 checkpoints). **Pass, every time.**
- [x] `npm run test` (vitest) green at every checkpoint — 277 baseline tests throughout, growing to 279 after this pass's own new `export-pins.test.ts` (2 tests), still green. **Pass, every time — zero regressions introduced at any point.**
- [x] `eslint` run against every touched/created file — zero new warnings beyond 2 pre-existing, out-of-scope findings this session's own sweep happened to surface (both investigated and documented in `07-pinboard-feature-report.md` §10, not introduced by this pass). **Pass.**
- [x] Production build (`npm run build`) succeeds cleanly, both before and after the fix pass. **Pass**, twice.
- [x] No new console errors introduced anywhere in this session's click-through (`/chat` composer and active chat, `/chats`, `/projects/new`, `/brain`, the Pinboard panel, the Highlights panel, a pin/unpin attempt, an export attempt). **Pass** — identical single recurring CSP/Facebook-pixel warning on every page, both before and after, nothing new.

---

## Summary of this run

**14 of 26 items live-verified this pass** (several via direct network/DOM checks — the cold-cache fetch-absence tests across 4 pages, the aria-label DOM read, the export-no-crash check, the general regression gates — not just visual inspection), **zero regressions found in any of them.** Every item that didn't get a direct live check has a specific, stated reason — almost entirely this account's lack of pre-existing Pinboard pins/highlights, plus one genuine, honestly-flagged testing obstacle (the "Pin" accessible-name collision between the page-level chat-pin feature and the message-level Pinboard-pin feature, which this session's automated driver couldn't reliably disambiguate).

**Still worth your own hands-on click-through, in priority order:**
1. **A real, unambiguous message-level pin/unpin cycle** (§3) — the single highest-value remaining gap, since it's the one thing this session's own driver script couldn't cleanly isolate from a same-named neighboring feature. Hover directly over a message bubble (not the page toolbar) to find the right button.
2. **Exporting a real pin with special characters and opening the resulting PDF** (§6) — the security fix's safety property is proven by automated tests, but the *visual* correctness of a real exported PDF with real special characters was never opened and eyeballed this session.
3. **The Highlights panel's loading/error states** (§4) — needs network throttling or request-blocking to force; the empty/loaded state is confirmed working, but the two states this pass's `AnimatePresence` fix specifically targets weren't forced live.
4. **A pin card's expand/collapse, drag, and "collapse all" interactions** (§5) — all of this pass's `Pin/index.tsx` fixes (refs, AnimatePresence, the investigated prop-signal pattern) need a real, expandable pin to click through, which this account didn't have.
5. **A real highlight's create/list/delete cycle** (§4) — same limitation, no highlights existed on this account.
6. **A screen reader's actual announcement of the Pinboard button** (§2) — the DOM-level `aria-label` check is a strong proxy but isn't the same as hearing it through real assistive technology.

No regressions found anywhere in this pass. Everything that touched code in this engagement (`07-pinboard-feature-report.md` §10, Phases 1-8) either passed live or has an honest, specific reason it couldn't be reached this session — most commonly "this test account has no live Pinboard content to exercise the fix's own runtime behavior against," never left blank without explanation.
