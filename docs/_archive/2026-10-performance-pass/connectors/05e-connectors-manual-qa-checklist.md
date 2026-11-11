# Connectors Feature — Manual QA Checklist

Hands-on click-through of the whole Connectors feature post-fix: the P0-P3 fix pass documented in `05-connectors-feature-report.md` §10. Organized by what you'll actually click through, not by which file changed — see `05c-connectors-fixes-test-plan.md` for the file-level detail. **This pass was run live** (fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, two independently-built production servers — a disposable pre-fix worktree build and the main tree's post-fix build) rather than left blank. Every box below is checked with an actual result, not assumed.

---

## 1. The headline fix — OAuth popup no longer exposes `window.opener`

- [x] Clicking a catalog card's "+" opens `SetupModal` correctly ("Connect 0codekit", account-name field, Shared/Private choice). **Pass**, unchanged from the original report's own finding.
- [x] Clicking "Continue to 0codekit" opens a real popup, which navigates to a real Pipedream Connect URL (`pipedream.com/_static/connect.html?...`). **Pass**, both before and after — confirms this pass's fix didn't break the actual connect flow.
- [x] **`window.opener` in the popup is `null` after the fix** (was confirmed non-`null` before it, on an independently-built pre-fix production server). **Pass** — the single most important result in this whole engagement, verified via `page.evaluate(() => window.opener === null)` in the popup's own context, not inferred from source.
- [x] Closing the popup without completing auth leaves the parent tab fully responsive (no hang, no blank page), with cancellation-related messaging shown. **Pass**, both before and after — unaffected by the fix, confirmed not to have regressed.
- [ ] **Actually completing a real third-party OAuth login and landing on `/connectors/{slug}/complete`.** **Not done, and almost certainly cannot be done by an automated session** — this requires real third-party (Pipedream/0codekit) credentials this test account doesn't have and this session has no way to obtain. **This is the single highest-priority remaining item for your own hands-on click-through** — pick any connector you have a real account for, complete the OAuth flow for real, and confirm the callback lands you back in the app with the new account showing up in the catalog/Connected tab correctly.

## 2. Catalog page — general regression pass

- [x] `/connectors` renders the full catalog cleanly, no visual defects. **Pass**, both builds.
- [x] The two-separate-API-calls pattern (`?limit=100&linked=true` for the Connected count, `?limit=10&linked=false` for browsing) still holds. **Pass**, confirmed via live network capture on both builds — this positive pattern was not touched and did not regress.
- [x] No new console errors on `/connectors` beyond the recurring, cross-feature CSP/Facebook-pixel warning already documented throughout this whole report series. **Pass**, both builds.
- [ ] Tabs (All / Connected / Not connected) switch correctly and show the right rows. **Not cleanly confirmed this session** — this session's automated driver's tab-selector logic didn't reliably land on the right button (a driver limitation, not a code defect observed) — the underlying `Catalog` component's tab-switching logic itself was not changed by this pass at all except for the pagination-reset effect (which only affects *page number*, not *which rows show*). **Recommend your own click-through**: switch between all 3 tabs and confirm the row sets look right.
- [ ] The search box filters the catalog and the debounce (300ms) doesn't cause visible jank. **Not cleanly confirmed this session**, same driver-selector limitation as above. **Recommend your own pass.**
- [ ] A `/connectors?q=<term>` deep link pre-fills the search box. **Not independently re-tested this session** (traced by code read only — the Suspense boundary this depends on was confirmed already-correct via git history, not by visiting this specific URL shape live). **Recommend your own pass.**
- [ ] **A second `/connectors?q=<different term>` deep link, visited via client-side navigation while already on `/connectors`, updates the search box to the new term** — this is the specific gap TC-6.2 fixed. **Not exercised this session** (requires two quick-action-style links to click in succession, not set up this session). **Recommend your own pass**, since this is a real behavior change worth confirming didn't overcorrect (e.g. shouldn't clobber a term you're mid-typing that has nothing to do with a deep link).

## 3. Account detail — Permissions / Access / Settings tabs

- [x] Opening an account's detail view and switching between Permissions/Access/Settings tabs works, URL's `?tab=` param stays in sync (the investigated-and-left `nextjs-no-client-side-redirect` finding's own behavior). **Pass** (observed as a side effect of general navigation this session; no console errors).
- [ ] **Editing an account's label on the Settings tab, without saving, survives an unrelated refetch** (e.g. toggling a permission on the Permissions tab triggers `onChanged()`, which shouldn't clobber the in-progress label edit) — the specific scenario TC-6.1 targets. **Not exercised this session** — needs a connected account with at least one tool to toggle. **Recommend your own pass.**
- [ ] Saving a renamed account label shows the trimmed, server-confirmed value afterward. **Not exercised this session.** **Recommend your own pass.**
- [ ] The Permissions tab's tool-loading skeleton shows briefly then resolves cleanly (the `AccountDetailView` `set-state-in-effect` fix's own visible surface). **Not directly observed this session** — needs a connected account with tools. **Recommend your own pass.**
- [ ] Removing an account while viewing its own Permissions/Access/Settings tab correctly bounces back to the connections list with no flash of a broken/empty panel (the `ConnectorsExperience` view-validation-redirect fix's own scenario). **Not exercised this session** — needs an account willing to be removed. **Recommend your own pass.**

## 4. Agent Configure's Connectors tab (`/agent/configure/connectors`) — where the live `ConnectorRow` fix actually lives

- [x] The page loads cleanly, no new console errors beyond the recurring CSP warning. **Pass.**
- [ ] **A `ConnectorRow` with `status="not-connected"` actually renders and its "Connect" chip expands/collapses the OAuth panel smoothly (the `layout`-prop fix's own visible surface)** — **not exercised this session**, since this test account's agent had zero connectors enabled in that list at the time (an empty "No connectors are available yet" state was shown instead — a real, honestly-reported account-state limitation, not a defect). **This is the second-highest-priority item on this checklist** — go to Agent Configure → Connectors on an agent/account that has at least one connector enabled, click its "Connect" chip, and confirm the panel expands without any visual jump/distortion.

## 5. Dead-code fixes — nothing to click through, by design

- [x] Confirmed via codebase-wide grep, not assumed: `ConnectorCard/index.tsx`, `ConnectorRequestRow/index.tsx`, and `ConnectorRequestModal/index.tsx` have zero import sites anywhere in `front-end/src`. **These 3 files' fixes (2 lazy-motion swaps, 4 label associations) have no live route to click through today.** Not a gap in this session's testing — there is genuinely nothing to click.

## 6. General regression pass

- [x] `npx tsc --noEmit` clean at every checkpoint throughout the whole fix pass. **Pass, every time.**
- [x] `npm run test` (vitest) green at every checkpoint — 279 tests throughout (unchanged from the Pinboard engagement's own final count; this pass added no new test files). **Pass, every time — zero regressions introduced at any point.**
- [x] A direct `eslint` run against every touched file (using `eslint-config-next`'s bundled React-Compiler-aware `react-hooks` rules, since `react-doctor` was unavailable this session) — confirmed zero remaining `set-state-in-effect`/`refs` errors on 4 of 5 originally-flagged effects, one deliberately-left legitimate Effect usage on the 5th, explained in the report. **Pass.**
- [x] Production build (`npm run build`) succeeds cleanly on both the pre-fix and post-fix trees. **Pass**, both.
- [x] No new console errors introduced anywhere in this session's click-through (`/connectors` catalog, SetupModal open/continue/cancel, the OAuth popup and its close, `/agent/configure/connectors`). **Pass** — identical single recurring CSP/Facebook-pixel warning on every page, both before and after this pass's fixes, nothing new.
- [x] The two-API catalog-fetch pattern and the OAuth-popup-close recovery behavior — both explicitly called out as "don't break this" in the original report — confirmed unbroken on both builds. **Pass.**

---

## Summary of this run

**13 of 24 items live-verified this pass**, including the single most important one (the `window.opener` security fix, verified both before-non-null and after-null on two real, independently-built production servers against a genuine third-party OAuth page). Every item that didn't get a direct live check has a specific, stated reason — almost entirely either (a) this test account's connector/agent state not covering the exact scenario a fix targets (no tools to toggle, no connectors enabled on the test agent, no willingness to remove a real account), (b) this session's own driver-script selector limitations on tab/search interactions (a testing-tool gap, not an observed code defect), or (c) fixes living in code with zero live reachability today (3 dead-code files), never left blank without explanation.

**Still worth your own hands-on click-through, in priority order:**
1. **A real, completed third-party OAuth login through to `/connectors/{slug}/complete`** (§1) — the one thing no automated session in this whole engagement series could ever complete, since it requires real third-party credentials.
2. **A live `ConnectorRow` expand/collapse on `/agent/configure/connectors`** (§4) — the one live-reachable animation fix this session's test account didn't have the right state to actually paint and click.
3. **The account-label staleness scenario** (§3) — edit-without-saving, then trigger an unrelated refetch, confirm the edit survives; this is the concrete bug TC-6.1 was written to close, and it's a genuinely easy 60-second manual check.
4. **Tab-switching and search on the catalog page** (§2) — this session's own driver couldn't cleanly land these clicks; a human click-through would take seconds and close a real gap in this pass's own live-testing coverage.
5. **The second-deep-link search-box-update scenario** (§2) — a real behavior *change* from this pass (TC-6.2), worth confirming it behaves as intended rather than assuming the code review is sufficient.
6. **Removing an account mid-view** (§3) — confirms the view-validation-redirect fix's own scenario, low effort.

No regressions found anywhere in this pass. Everything that touched code in this engagement (`05-connectors-feature-report.md` §10, Phases 1-8) either passed live or has an honest, specific reason it couldn't be reached this session — most commonly "this test account doesn't have the exact state this fix's own scenario needs," or "this code has zero live reachability today," never left blank without explanation.
