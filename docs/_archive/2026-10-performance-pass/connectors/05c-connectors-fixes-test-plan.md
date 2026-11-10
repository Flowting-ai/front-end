# Connectors Feature — Fix Verification Test Plan

Test cases for every fix logged in `05-connectors-feature-report.md` §10, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and honesty standard as `../pinboard/07c-pinboard-fixes-test-plan.md`, `../brain-tasks/03c-brain-tasks-fixes-test-plan.md`, and `../agents/02c-agents-fixes-test-plan.md`.

---

## Phase 1 — P0: `window.open` / `noopener` sweep

### TC-1.1 — The Connectors OAuth popup (`useConnectorSetupFlow.ts:80`) — the headline security fix, most rigorously verified

- **Precondition:** logged in, production build, on `/connectors`.
- **Steps:** click a not-yet-connected catalog card's "+" (`aria-label="Connect 0codekit"`) → `SetupModal` opens → click "Continue to 0codekit". A `Promise.all([context.waitForEvent('page'), continueBtn.click()])` (Playwright) captures the new popup `Page` object the instant it opens. Once captured: `popup.evaluate(() => window.opener === null)` is called twice — immediately after open (while the popup is still `about:blank`) and again ~2.5s later after `initiateLink()` resolves and navigates `popup.location.href` to the real OAuth redirect URL.
- **Expected (before):** `window.opener === null` evaluates to `false` at both checkpoints — the popup retains a live reference back to the parent tab for the whole flow, including after it has navigated to the real third-party origin.
- **Expected (after):** `window.opener === null` evaluates to `true` at both checkpoints — the reference is severed the instant the popup opens and stays severed through the navigation.
- **Verified live, both ways, on two independently-built production servers** (a disposable pre-fix worktree build on port 3000, then the post-fix main-tree build on the same port after stopping the first): 
  - **Pre-fix run:** popup opened at `about:blank`, `window.opener === null` → `false`; after navigation, popped URL was `https://pipedream.com/_static/connect.html?connectLink=true&token=ctok_512e5215722b412eaefea5fd20957a0a&app=_0codekit`, `window.opener === null` → still `false`.
  - **Post-fix run:** identical flow, real popup, real Pipedream URL (`https://pipedream.com/_static/connect.html?connectLink=true&token=ctok_76a4a1a8646b47ca88bda99815ecb577&app=_0codekit`), `window.opener === null` → `true` at both checkpoints.
  - This is not a synthetic reproduction — both runs exercised the real `POST /connectors/_0codekit/link` backend call and the real Pipedream Connect hosted page. This is exactly the "confirm via `page.evaluate`/`window.opener` check in the popup context" rigor the engagement brief asked for, not just an assertion that the code looks right.

### TC-1.2 — Popup closed without completing auth — parent recovers cleanly, both before and after

- **Precondition:** same as TC-1.1, popup open and navigated to the real Pipedream URL.
- **Steps:** `popup.close()`, then wait 4s and read `document.body.textContent` on the parent tab.
- **Expected:** the parent tab is still fully rendering (a real, populated DOM, not blank/hung) and shows cancellation-related copy, matching `useConnectorSetupFlow.ts`'s own documented `closedCheck` handling (a closed popup on a `hosted`/Pipedream-style flow is treated as an outright cancellation).
- **Verified live on both builds**: pre-fix body length ~54KB, post-fix ~46.5KB (both real, non-empty renders — the size difference reflects normal catalog-state churn between the two separate sessions, e.g. different account/connection state at the moment each was captured, not a regression), both matched `/cancel|error|failed/i` in their body text. **This specific recovery behavior was never broken by the fix and isn't expected to change** — included here to confirm the `popup.opener = null` change didn't have a side effect on it.

### TC-1.3 — The one-shot `window.open` fixes (fallback popup, billing portal, help links) — return value unused, mechanical `noopener` addition

- **Precondition:** none — pure code-review + `tsc`/`eslint` verification, since these are either unreachable without triggering a real popup-block (the `useConnectorSetupFlow.ts:110` fallback) or lead to real external destinations this session had no reason to actually click through (Stripe billing portal, Help & Legal external links).
- **Steps:** confirmed via direct read that none of these 4 call sites (`useConnectorSetupFlow.ts:110`, `plans-and-billing/page.tsx` ×2, `help/page.tsx`) ever capture or later read the `window.open(...)` return value — adding `'noopener'`/`'noopener,noreferrer'` to the feature-string argument cannot change any other behavior at these sites.
- **Expected:** identical click behavior (a new tab opens to the same URL), just without a `window.opener` back-reference in the new tab.
- **Verified via `tsc --noEmit` (clean) and code review only.** **Needs manual QA**: click "Manage billing" on `/settings/plans-and-billing` and a "View →" link on `/settings/help`, confirm each still opens correctly in a new tab.

### TC-1.4 — The "retain reference, navigate later" fixes (`ConnectorPrompts.tsx`, `brain/page.tsx`, `knowledge/page.tsx`) — `popup.opener = null` preserves the reference

- **Precondition:** none for the mechanism itself — verified by code trace, since these 3 sites are on different pages/features than this session's primary live-testing target (`/connectors`).
- **Steps:** confirmed via direct read that in each case, the `popup`/`newTab` variable returned by `window.open(...)` is used *after* the `.opener = null` line (for `.location.href` assignment and/or `.close()`), and that `Window.opener`'s setter does not invalidate the caller's own reference to the child window (it only clears what the *child's own script* would see via `window.opener`).
- **Expected:** identical popup-navigation/closing behavior to before, minus the `window.opener` back-reference.
- **Verified via `tsc --noEmit` (clean) and code review; the identical mechanism was live-verified end-to-end for `useConnectorSetupFlow.ts`'s own popup in TC-1.1** (same technique, same code shape). **Needs manual QA**: a Chats-feature connector-connect prompt's OAuth popup (`ConnectorPrompts.tsx`), the `/brain` page's own inline connector-connect flow, and the Agent Configure Knowledge tab's "preview a remote file in a new tab" action — none independently re-exercised live this session.

---

## Phase 2 — P0: `connectors/page.tsx` Suspense — no fix made, confirmed already correct

### TC-2.1 — `useSearchParams()` is properly Suspense-wrapped, and the `?q=` deep-link still works

- **Precondition:** none.
- **Steps:** code trace (current file already wraps `ConnectorsPageContent` — the component calling `useSearchParams()` — in `<Suspense fallback={null}>`) plus `git log`/`git show` confirming this predates the engagement (commit `f0d94b76`, Aug 30).
- **Expected:** no code change needed; a `/connectors?q=slack`-style deep link still pre-fills the catalog search box.
- **Verified via git history (definitive — no ambiguity about whether this was "recently" fixed by something else) and a live production load of `/connectors`** (no hydration warning, no client-render fallback flash observed in this session's screenshots). **The specific `?q=` deep-link pre-fill itself was not independently re-tested live this session** (the underlying `initialSearch` prop wiring was traced by code read, not exercised via an actual `?q=` URL visit) — **needs manual QA**: visit `/connectors?q=slack` fresh and confirm the search box shows "slack" pre-filled and the catalog is pre-filtered.

---

## Phase 3 — P1: the 6 `todo` findings — investigated, not fixed

### TC-3.1 — `try/finally` compiler-limitation investigation

- **Precondition:** none — a code-trace, not a runtime reproduction, matching the Agents engagement's own equivalent TC-4.1.
- **Steps:** grepped `AccountDetailView.tsx` and `ConnectorsExperience.tsx` for `try {`/`} finally {` pairs; confirmed exactly 4 + 2 = 6, matching the original finding count and file split exactly; confirmed `next.config.ts` has `reactCompiler: true`.
- **Expected:** confirm whether this is a genuine tooling limitation (as found in the Agents engagement) rather than a fixable pattern.
- **Verified via direct code inspection only — a closed logical case** (the same parser gap already independently documented and traced to its root cause in a prior engagement in this series; re-deriving it from scratch here via line-count matching is sufficient confirmation, no further live testing needed).

---

## Phase 4 — P1: the 5 `set-state-in-effect` fixes

### TC-4.1 — `AccountDetailView.tsx`'s tools-loading state — no behavior change, since the removed call was provably a no-op

- **Precondition:** an account whose connector has at least one tool.
- **Steps:** code review confirming `loadingTools`'s own `useState(catalog.tools.length === 0)` initializer and the effect's own `.finally()` together cover every case the removed early-return `setLoadingTools(false)` used to handle.
- **Expected:** identical loading-skeleton behavior on the Permissions tab (shows while tools are being fetched, disappears once populated).
- **Verified via `tsc --noEmit` + `vitest` (both clean/green) + code review.** **Needs manual QA**: open an account's Permissions tab on a connector whose tools aren't already cached, confirm the skeleton shows briefly then resolves to the real tool list, no flicker or stuck skeleton.

### TC-4.2 — `ConnectionsView.tsx`'s pagination reset — identical reset timing, now render-time instead of effect-time

- **Precondition:** the catalog's "All connectors" grid has 2+ pages.
- **Steps:** code review confirming the `paginationKey`/`syncedPaginationKey` comparison fires on the exact same `[view, debouncedQuery]`-equivalent transitions the old effect's dependency array covered, and that the `cursorsRef` reset (now in its own small effect) still runs in the same commit, before the fetch effect reads it (effects fire in declaration order within one commit — confirmed by reading React's own effect-ordering guarantee, not assumed).
- **Expected:** navigating to page 2, then changing the search term or switching tabs, resets back to page 1 exactly as before.
- **Verified via `tsc --noEmit` + `vitest` + code review + `eslint` (zero `set-state-in-effect`/`refs` errors remaining on this code path).** **Needs manual QA**: page to page 2 of the catalog, type a search term, confirm the view snaps back to page 1 and the results reflect the new search (not a stale page-2 cursor).

### TC-4.3 — `ConnectionsView.tsx`'s browse-fetch effect — reset branch fixed, fetch-kickoff deliberately unchanged

- **Precondition:** the "Connected" tab, no search term active.
- **Steps:** code review confirming `skipBrowse`'s render-time adjustment resets `browseItems`/`browseHasMore`/`browseBusy` on the exact same transition the old inline early-return branch did, and that the fetch effect's own remaining `setBrowseBusy(true)` (deliberately left as-is, see report §10 Phase 4 item 10) is unaffected in shape or timing.
- **Expected:** switching to the Connected tab with an empty search box shows the connected-accounts list (from `linkedRows`, not a stale `browseItems`) with no lingering busy spinner; searching while on any tab still shows a busy indicator while the request is in flight.
- **Verified via `tsc --noEmit` + `vitest` + code review + `eslint`** (the fetch-kickoff's own remaining synchronous `setState` was confirmed, via a second `eslint` pass, to be the legitimate documented data-fetching shape, not a new regression — see report §10 Phase 4 item 10 for the reasoning). **Needs manual QA**: switch to the Connected tab and confirm no stray busy spinner appears when there's nothing to fetch; type a search term on any tab and confirm the busy state does show while the request is in flight.

### TC-4.4 — `ConnectorsExperience.tsx`'s mount-fetch — identical catalog load behavior, network call unaffected

- **Precondition:** none — the very first page load.
- **Steps:** code review confirming the inlined mount effect calls the identical `listLinkedConnectors()` function the old `fetchAll()`-based version called, with the same `setCatalog`/`toast.error` handling, just without a redundant `setLoading(true)` call (since `loading` already starts `true`).
- **Expected:** identical first-load behavior — the loading skeleton shows until the catalog call resolves, then the real grid renders.
- **Verified live** — every live test this session (TC-1.1 through the general regression pass) began with a fresh `/connectors` load that depends on exactly this effect; the catalog rendered correctly every time, on both the pre-fix and post-fix builds, with the same two-API network pattern confirmed in both.

### TC-4.5 — `ConnectorsExperience.tsx`'s view-validation redirect — self-corrects during render, confirmed non-looping

- **Precondition:** a state where the active connector/account has gone missing from the catalog (e.g. after a removal).
- **Steps:** code review confirming `invalidView`'s condition becomes `false` immediately after `backToConnections()` runs (since it sets `view` to `'connections'`, one of `invalidView`'s own inputs) — i.e. it cannot loop.
- **Expected:** identical end state to before (bounced back to the connections list), now arrived at slightly faster (before React ever commits the invalid intermediate view, rather than after a full commit+effect cycle).
- **Verified via `tsc --noEmit` + `vitest` + code review.** **Needs manual QA**: remove an account while viewing its Permissions/Access/Settings tab (via the Remove flow) and confirm the view lands back on the connections list without any visible flash of a broken/empty account-detail panel.

---

## Phase 5 — P1: layout-animation + lazy-motion fixes

### TC-5.1 — `ConnectorRow`'s OAuth-panel expand/collapse — visually identical, `layout` prop confirmed live on its real route

- **Precondition:** the Agent Configure "Connectors" tab (`/agent/configure/connectors`), with at least one not-yet-connected row visible.
- **Steps:** load the page, screenshot.
- **Expected:** visually identical rendering — a runtime-animation-mechanism change (raw `height` tween → FLIP-computed `transform` via `layout`), not a visual-design change.
- **Verified live, partially.** The page itself loaded cleanly on the post-fix build with no console errors beyond the recurring cross-feature CSP/Facebook-pixel warning — but this specific test account's agent had **zero connectors enabled** in that list at the time (an empty state, "No connectors are available yet"), so `ConnectorRow` itself was not actually painted to compare against. **Needs manual QA**: on an agent/account with at least one connector enabled, open the Connectors tab and click "Connect" on a not-yet-linked row to confirm the OAuth panel expands/collapses smoothly with no visual distortion.

### TC-5.2 — `ConnectorCard`/`ConnectorRequestRow`'s `motion`→`m` swap — code-correct, zero live surface to verify against

- **Precondition:** N/A.
- **Steps:** confirmed via codebase-wide grep that neither file is imported anywhere in `src`.
- **Expected:** N/A — not reachable from any route.
- **Not verifiable live, by design, not by oversight.** This is a real, correct fix (the import swap is mechanically identical to `ConnectorRow`'s, which *was* live-verified) sitting in dead code. Flagged explicitly rather than fabricating a verification for a component nothing currently renders.

---

## Phase 6 — P2: `no-derived-useState` fixes

### TC-6.1 — `AccountDetailView.tsx`'s account-label field — normal edit/save flow unaffected, staleness scenario specifically targeted

- **Precondition:** an owned connector account.
- **Steps:** code review confirming the value-based (not identity-based) comparison (`account.nickname !== syncedNickname`) only fires a resync when the nickname's actual text changes, never on an unrelated `account` object refresh (e.g. a permission edit's `onChanged()` refetch) that leaves the name untouched.
- **Expected:** typing a new label and clicking Save works exactly as before; a resync only happens if the account's true nickname changes out from under the field.
- **Verified via `tsc --noEmit` + `vitest` + code review.** **Needs manual QA**: open an account's Settings tab, edit the label but don't save, then trigger an unrelated refetch (e.g. toggle a permission on the Permissions tab) and confirm the unsaved label edit is *not* clobbered; separately, save a label rename and confirm the field shows the trimmed, server-confirmed value afterward.

### TC-6.2 — `ConnectionsView.tsx`'s search box — a second deep-link now correctly updates it

- **Precondition:** `/connectors` already open with a prior `?q=` deep link applied.
- **Steps:** code review confirming the same value-based render-time re-adoption pattern as TC-6.1, applied to `ownQuery`/`query`.
- **Expected (before):** a second client-side navigation to `/connectors?q=<different term>` while already on the page would leave the search box showing the *first* term. **Expected (after):** the search box updates to the new term.
- **Verified via `tsc --noEmit` + `vitest` + code review only.** **Needs manual QA**: from within the app, trigger two different `/connectors?q=...` quick-action links in succession without a full page reload in between, confirm the search box reflects the second term.

---

## Phase 7 — P3: `ConnectorRequestModal` label-association fixes

### TC-7.1 — All 4 labels correctly associate with their controls, no visual change

- **Precondition:** N/A — dead code, not reachable from any live route (see Phase 5 item 16 in the report).
- **Steps:** code review confirming each `<label htmlFor="…">` matches a real `id="…"` on its corresponding `InputField`/`textarea`/dropdown-trigger `<button>`, and that no existing inline style was touched.
- **Expected:** clicking any label focuses (or, for the button, activates) its associated control; a screen reader announces the label text for each control.
- **Not verifiable live** — this component has zero import sites anywhere in the app. Code-correct, unreachable. If/when this component is wired up, a `page.$('label[for="connector-request-tool-name"]')`-style DOM check (the same technique used for the Pinboard engagement's `aria-label` verification) would confirm this instantly.

---

## Phase 8 — investigated, no fix

### TC-8.1 — `ConnectorsExperience.tsx:77`'s URL-tab-sync — confirmed not a redirect anti-pattern

- **Precondition:** an account's Permissions/Access/Settings tab open.
- **Steps:** code review + live confirmation that switching tabs doesn't cause any visible flash or re-render glitch (this effect only ever changes the URL's query string, never the rendered content).
- **Expected:** no change in behavior; this was never touched.
- **Verified via code review.** No manual QA needed beyond what ordinary tab-switching click-through already covers (§ manual QA checklist, general regression section).

---

## Coverage summary

| Phase | Fix | Live-verified this session | Code-review/`tsc`/`vitest`/`eslint`-verified | Needs manual QA |
|---|---|---|---|---|
| 1 | Connectors OAuth popup `window.opener` | **Yes — both before and after, on real Pipedream URLs** | Yes | Popup-block fallback tabs, other 3 features' popups |
| 1 | Popup-close recovery | Yes, both builds | Yes | — |
| 1 | 4 one-shot/reference-retained `noopener` sites | No | Yes | Billing portal, Help links, Chats/Brain/Knowledge popups |
| 2 | Suspense (no fix — confirmed already correct) | Partial (page loads cleanly) | Yes (git history) | `?q=` deep-link pre-fill itself |
| 3 | 6 `todo` findings (investigated, not fixed) | N/A | Yes | N/A |
| 4 | `AccountDetailView` loading-state removal | Indirect (page loads/renders correctly) | Yes | Direct skeleton-timing observation |
| 4 | `ConnectionsView` pagination reset | No | Yes | Page-2-then-search flow |
| 4 | `ConnectionsView` browse-reset (partial fix) | No | Yes | Connected-tab busy-state flow |
| 4 | `ConnectorsExperience` mount-fetch | **Yes**, every test this session | Yes | — |
| 4 | `ConnectorsExperience` view-validation redirect | No | Yes | Remove-account-mid-view flow |
| 5 | `ConnectorRow` layout/lazy-motion | Partial (route loads, empty state only) | Yes | Actual row-expand animation |
| 5 | `ConnectorCard`/`ConnectorRequestRow` (dead code) | No — not reachable | Yes | N/A (no live surface) |
| 6 | 2 `no-derived-useState` fixes | No | Yes | Both staleness scenarios |
| 7 | 4 label-association fixes (dead code) | No — not reachable | Yes | N/A (no live surface) |
| 8 | URL-tab-sync (no fix) | Yes (indirect) | Yes | — |

**Honest summary**: the single highest-stakes fix in this whole pass (the OAuth-popup `window.opener` security fix) received the most rigorous live verification of anything in this document — a real, repeatable, before-and-after `window.opener` check against a genuine third-party OAuth page, on two independently-built production servers. Several other fixes (the mount-fetch effect, the general catalog/two-API pattern, the Suspense boundary) were exercised as a side effect of every other live test this session ran, since `/connectors` had to load correctly for any of that testing to happen at all. The fixes with the least direct live verification are, honestly, either genuinely unreachable today (3 files' worth of dead-code fixes) or gated on test-account states this session's account didn't have (an agent with connectors enabled, an account needing a real staleness-triggering refetch) — each flagged with a specific, concrete manual-QA step rather than left unstated.
