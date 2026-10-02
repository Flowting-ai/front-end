# Pinboard Feature — Before / After Fix Comparison

Companion to `07-pinboard-feature-report.md` (original findings + §10's fix log) and `07b-pinboard-before-scan.md` (the pre-fix production baseline this file re-scans). Same format and honesty standard as `../brain-tasks/03d-brain-tasks-before-after-comparison.md`, `../agents/02d-agents-before-after-comparison.md`, and `../projects/04d-projects-before-after-comparison.md`: report what the data actually shows, including the parts that don't move the way a fix's own logic would predict, and the parts that move in a *direction* the fix's own logic predicts but aren't visible in every instrument used.

**Methodology:** identical to `07b`'s — a clean production rebuild (`npm run build`, includes every fix in `07-pinboard-feature-report.md` §10), a clean server restart, fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, the same Lighthouse user-flow driver (`startFlow`, `throttlingMethod: 'provided'` zeroed, Puppeteer launched with `--no-sandbox --disable-gpu --disable-dev-shm-usage`), 3 consecutive runs, the exact same flow shape (`navigate` to `/chat`, then a `timespan` wrapping the Pinboard-panel-open click through the "Export" button becoming visible). Also re-ran the supplementary Playwright Performance-API cross-check (`performance.mark`/`measure` bracketing the click precisely, independent of Lighthouse's own scoring) that `07b` §9 flagged as the more sensitive instrument for this specific fix.

---

## 1. The eager-fetch fix — the headline question, answered directly and precisely

**Does `/chats` and `/projects/new`'s own network log now show zero `/pins`/`/pins/folders/all` requests on load, where it previously would have shown them per the original cross-feature bug reports?**

| Page | Before (cold cache) | After (cold cache) |
|---|---|---|
| `/chats` | `GET /pins` + `GET /pins/folders/all`, both fired at ~339-350ms after navigation | **Zero** `/pins`-matching requests |
| `/projects/new` | Both fired at ~350ms | **Zero** |
| `/brain` | Both fired at ~406ms | **Zero** |
| `/chat` (bare, no active chat) | *(not separately tested in `07b` — same eager mount-effect would have fired here too)* | **Zero** |
| `/chat?id=...` (active chat, `ChatInterface` mounted) | Fired (same eager mount-effect) | **Still fires** (now via `ChatInterface`'s own `prefetch()`, for the `isPinned` badge) |

**Yes — precisely and completely.** This is not a partial improvement or a shifted timing window; the two endpoints genuinely no longer fire on any of the three pages the Chats/Projects/original-Pinboard reports' own live 502 captures occurred on, confirmed against a real production build with a cold cache (the exact condition those bugs manifested under — see `07-pinboard-feature-report.md` §10 Phase 1 for the full trace).

---

## 2. Lighthouse user-flow — the numbers, in full, not cherry-picked

| Metric | Navigation — "Load /chat" before (r1/r2/r3) | after (r1/r2/r3) | Timespan — "Open Pinboard panel" before (r1/r2/r3) | after (r1/r2/r3) |
|---|---|---|---|---|
| Performance score | 89 / 89 / 89 | 88 / 89 / 89 | 96 / 96 / 96 | 96 / 96 / 96 |
| LCP | 0.5s / 0.5s / 0.5s | 0.6s / 0.6s / 0.6s | n/a | n/a |
| FCP | 0.5s / 0.5s / 0.5s | 0.6s / 0.6s / 0.6s | n/a | n/a |
| TTI | 0.5s / 0.5s / 0.5s | 0.6s / 0.6s / 0.6s | n/a | n/a |
| Speed Index | 0.3s / 0.3s / 0.3s | 0.3s / 0.3s / 0.3s | n/a | n/a |
| TBT | 0ms / 0ms / 0ms | 0ms / 0ms / 0ms | 0ms / 0ms / 0ms | 0ms / 0ms / 0ms |
| CLS | 0.224 / 0.224 / 0.230 | 0.234 / 0.224 / 0.224 | 0.090 / 0.090 / 0.095 | 0.094 / 0.092 / 0.095 |

**Read honestly: these numbers are, to within ordinary run-to-run noise, unchanged.** This is expected, not a sign the fix did nothing — see §3 below for exactly why Lighthouse's own scoring is the wrong instrument to see this particular fix's effect, and §4 for the instrument that does see it.

---

## 3. Why Lighthouse's own numbers don't move — a predicted, confirmed non-result

`07b-pinboard-before-scan.md` §9 predicted this outcome before the fix pass even started: *"because `pinboard-context.tsx`'s eager mount-effect has already fetched `/pins`/`/pins/folders/all` by the time this timespan starts, the panel-open click in this baseline is measuring an artificially cheap interaction... a supplementary Playwright Performance-API cross-check... confirms this directly."*

The reasoning holds up exactly: Lighthouse's `startFlow` navigates to `/chat` fresh in every run (a new Puppeteer-launched browser each time, no persisted `localStorage` across runs) — which, on the **before**-fix build, meant the eager mount-effect fired during the navigation step itself, pre-loading pin data before the timespan's click ever happens. On the **after**-fix build, `/chat` (bare, no active chat) correctly does **not** prefetch anything (per §1's table) — so the panel-open click in the timespan step is now the thing that triggers the actual `/pins` fetch, for the first time in that browser session.

**And yet the timespan's own Performance score/TBT/CLS are unchanged.** This is because:
- **TBT measures main-thread blocking, not network wait.** A `fetch()` call is I/O-bound — the JS thread isn't blocked while it's in flight, so a slower network round-trip doesn't show up as blocking time regardless of how long the panel visually takes to populate.
- **Lighthouse's timespan mode has no LCP/FCP/TTI-equivalent "time to visible content settle" metric** — those are navigation-only metrics. A timespan's score is built from TBT, CLS, and a handful of other continuous-interaction signals, none of which capture "how long until the pin list actually shows real data."

So this is a case where the fix's real, measurable effect (see §4) is invisible to Lighthouse's specific timespan scoring model — not because the fix didn't do anything, but because Lighthouse's timespan mode isn't instrumented to see this particular kind of change. This matches this whole audit series' repeated finding that Lighthouse's aggregate scores often can't see a specific, narrow fix's effect (e.g. `../agents/02d-agents-before-after-comparison.md` §2.3's identical conclusion for its own compiler-optimization fixes, `../brain-tasks/03d-brain-tasks-before-after-comparison.md` §2.2's for its own state-updater-purity fix).

---

## 4. The instrument that *does* see it: the Performance-API cross-check — a real, honest trade-off, exactly as predicted

| | Before fix | After fix |
|---|---|---|
| **Cold run** (first panel-open this browser session) — click to "Export" button visible | **63ms** (2 pairs of `/pins` calls logged, both already resolved by click time — the eager mount-effect had already fetched before the click) | **898ms** (1 pair of `/pins` calls, fired *by* the click itself, 200 OK) |
| **Warm run 1** (second open, same session) | 48ms, zero `/pins` calls | 53ms, zero `/pins` calls |
| **Warm run 2** (third open, same session) | 45ms, zero `/pins` calls | 59ms, zero `/pins` calls |

**This is the real, measurable, honestly-reported trade-off of the P0 fix**, and it is exactly the trade-off `07b` predicted before it was measured: **the very first Pinboard-panel open in a session now takes ~850ms longer** (898ms vs. 63ms) than it did before, because that click is now genuinely the moment the `/pins`/`/pins/folders/all` fetch happens, instead of the fetch having already silently happened on page load regardless of whether the user ever opens the panel. **Every subsequent open in the same session is unaffected** (45-60ms either way, since the SWR cache is warm by then) — this is the same before/after floor in both builds.

**This is the correct, intended shape of this fix, not a regression to explain away.** The fix's entire point was to stop paying the eager-fetch cost on pages that never open the panel at all — a genuine architectural win for every page load that isn't followed by a panel-open — at the honest cost of the one moment that *does* open the panel no longer getting a "free" head start. Whether an ~850ms one-time delay on a rare user action (opening a side panel) is worth eliminating an unconditional network call on every single authenticated page load is a product trade-off, not a performance regression — and this document's job is to report the number precisely, not to spin it as an unambiguous win.

---

## 5. Total byte weight and Accessibility/Best Practices/SEO scores — unchanged, for the expected reasons

Lighthouse's navigation-step byte-weight and category scores (Accessibility, Best Practices, SEO — all at their pre-fix values across every run) were not expected to move: none of this pass's fixes touch `/chat`'s initial HTML/JS payload size in any way large enough to register (the export-pins.ts DOM-construction rewrite, the `layout` props, the ref-to-state/effect conversions, and the file-splitting extractions are all bytes-neutral-to-negligible changes at the scale Lighthouse's total-byte-weight audit reports), and Lighthouse's automated accessibility checks were never going to detect this pass's one real accessibility finding (`aria-label`) — because there wasn't one; it was already present (see `07-pinboard-feature-report.md` §10 Phase 8), so there was nothing for any scorer, automated or otherwise, to newly detect.

---

## 6. Summary

| Dimension | Verdict |
|---|---|
| **The headline question** (do `/chats`/`/projects/new`/`/brain` still eagerly fetch `/pins`?) | **No — confirmed zero requests on all three, cold cache, live, against the post-fix build.** The fix works exactly as designed. |
| **Lighthouse user-flow scores (Navigation + Timespan)** | Unchanged, within ordinary noise — a predicted, confirmed non-result, not evidence the fix did nothing (see §3). |
| **Performance-API cross-check (click-to-rendered timing)** | **Real, measured, honest trade-off**: first panel-open per session goes from ~50-65ms to ~900ms (now genuinely waiting on the network it used to get for free); every subsequent open in the same session is unaffected. |
| **Byte weight / Accessibility / Best Practices / SEO scores** | Unchanged — none of this pass's fixes were ever expected to move these. |

**Bottom line:** this was a correctness-and-scope pass (stop an unconditional network call from firing on every page load), not a raw-speed pass for the pages that already had it — and its actual, measurable effect (§1, §4) required a targeted network-log check and a Performance-API cross-check to see, not Lighthouse's own aggregate scoring, which is looking at the wrong page's load event to notice a fetch that used to happen there and now doesn't. Every individual fix's own correctness was independently confirmed via direct functional/state verification — see `07c-pinboard-fixes-test-plan.md` — which remains the more reliable signal throughout this whole engagement, exactly as the Agents, Projects, and Brain-Tasks engagements each concluded before this one.
