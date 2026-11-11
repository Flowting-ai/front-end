# Brain / Tasks Feature — Before / After Fix Comparison

Companion to `03-brain-tasks-feature-report.md` (original findings + §9's fix log) and `03b-brain-tasks-before-scan.md` (the pre-fix production baseline this file re-scans). Same format and honesty standard as `../agents/02d-agents-before-after-comparison.md` and `../projects/04d-projects-before-after-comparison.md`: report what the data actually shows, including the parts that don't move the way a fix's own logic would predict — never smoothed over.

**Methodology:** identical to `03b`'s — clean production rebuild (`npm run build --webpack`, includes every fix through Phases 1-11 of `03-brain-tasks-feature-report.md` §9), clean server restart, fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, 3 consecutive Lighthouse runs per page, **the exact same 3 URLs as the pre-fix baseline** (`/brain`, `/brain?id=7cceb1ad-3e1b-4309-abf4-c82f075dc426`, `/brain/schedules`) — reusing the identical timeline URL rather than a fresh one specifically so this is a true apples-to-apples DOM-state comparison, not just "some task's timeline vs. some other task's timeline." Same driver script, same `throttlingMethod: 'provided'` (zeroed) approach that avoided the Agents engagement's LCP/TTI CDP-attach artifact in the baseline — confirmed again this scan: no run reports an implausible 45-50s figure, every number below is a real observed-trace metric.

**One deliberate note on the reused timeline URL:** `03b` §1 and this session's live QA pass (`03e-brain-tasks-manual-qa-checklist.md` §3) both found that this specific task (`7cceb1ad-...`, created by this engagement's own first automated test run) never rendered an assistant reply — only the user's message bubble — in *both* the pre-fix and post-fix scans, confirmed by an unrelated, independently-working task ("Greeting") rendering correctly on the same fixed code. This means the Lighthouse numbers below for "brain-timeline" reflect an identical DOM state before and after (a lone user-message bubble, not a completed result), which is exactly why it's valid to compare directly — but it also means this page's specific numbers say nothing about the `layout`-prop fix's effect on an actually-expanded phase group, since this task's timeline never got far enough to have one. See `03e`'s own priority list for the recommended follow-up (a genuinely multi-step task's expand/collapse interaction).

---

## 1. The numbers, in full, not cherry-picked

| Metric | `/brain` (composer) before r1/r2/r3 | after r1/r2/r3 | `/brain?id=...` (timeline) before r1/r2/r3 | after r1/r2/r3 | `/brain/schedules` before r1/r2/r3 | after r1/r2/r3 |
|---|---|---|---|---|---|---|
| Performance score | 75 / 81 / 81 | 80 / 81 / 81 | 66 / 71 / 71 | 72 / 71 / 71 | 75 / 75 / 75 | 79 / 73 / 74 |
| Accessibility score | 86 / 86 / 86 | 86 / 86 / 86 | 90 / 90 / 90 | 90 / 90 / 90 | 85 / 85 / 85 | 85 / 85 / 85 |
| Best Practices score | 92 / 92 / 92 | 92 / 92 / 92 | 92 / 92 / 92 | 92 / 92 / 92 | 92 / 92 / 92 | 92 / 92 / 92 |
| SEO score | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 | 100 / 100 / 100 |
| TBT | 0 / 0 / 0 ms | 0 / 0 / 0 ms | 0 / 0 / 0 ms | 0 / 0 / 0 ms | 0 / 0 / 0 ms | 0 / 0 / 0 ms |
| CLS | 0.4026 (×3, identical) | 0.4026 (×3, identical) | 0.3889 (×3, identical*) | 0.3889 (×3, identical*) | 0.3889 (×3, identical) | 0.3889 (×3, identical) |
| FCP | 1,182 / 483 / 505 ms | 773 / 485 / 483 ms | 480 / 480 / 496 ms | 490 / 495 / 491 ms | 491 / 494 / 506 ms | 493 / 615 / 555 ms |
| LCP | 1,182 / 483 / 505 ms | 773 / 485 / 483 ms | 2,824 / 2,110 / 2,072 ms | 2,020 / 2,065 / 2,105 ms | 1,672 / 1,640 / 1,654 ms | 1,241 / 1,879 / 1,802 ms |
| TTI | 1,182 / 483 / 505 ms | 773 / 485 / 483 ms | 480 / 480 / 496 ms | 490 / 495 / 491 ms | 491 / 494 / 506 ms | 493 / 615 / 555 ms |
| Speed Index | 1,386 / 780 / 789 ms | 1,001 / 781 / 792 ms | 702 / 843 / 852 ms | 698 / 793 / 840 ms | 859 / 909 / 924 ms | 720 / 1,054 / 983 ms |
| Server response time | 5 / 4 / 4 ms | 4 / 3 / 3 ms | 4 / 4 / 4 ms | 6 / 3 / 3 ms | 3 / 4 / 4 ms | 4 / 3 / 4 ms |
| Total byte weight | 9,067 / 9,067 / 9,066 KB | 9,079 / 9,076 / 9,077 KB | 9,062 / 9,061 / 9,061 KB | 9,073 / 9,073 / 9,072 KB | 9,056 / 9,056 / 9,055 KB | 9,067 / 9,066 / 9,066 KB |

\* `/brain?id=...` CLS differs by a hair in one before-scan run (0.38894 vs 0.38889) — a rounding-level difference, not a real distinction; grouped as "identical" above.

---

## 2. What actually moved, read honestly

### 2.1 CLS — completely unchanged on every page, exactly as expected

All three pages report **bit-identical CLS** (to 4 decimal places) before and after. This is exactly what should happen: `03b` §10 root-caused this feature's CLS almost entirely (~97%) to the app-wide font-`display: "swap"` behavior already investigated and explicitly left in place by the Projects engagement (`../projects/04-projects-feature-report.md` §10 Phase 3 item 8) — nothing in this pass's fix list touched fonts, `layout.tsx`, or anything upstream of that cause. A fix that doesn't touch the actual cause of a metric shouldn't move that metric, and it didn't.

### 2.2 TBT — 0ms on every single run, both before and after — a floor effect, not evidence of "no improvement"

TBT was already 0ms on every page in the pre-fix baseline (itself already a dramatic, expected improvement over the original dev-mode report's 2,480ms/1,480ms — see `03b` §10). With TBT already at its floor, there is no room for Phase 3's state-updater-purity fixes, Phase 4's `layout`-prop animation fix, or Phase 5's `motion`→`m` import swap to show up as a TBT reduction — they'd need TBT to have had headroom to fall from in the first place. **This is not evidence the fixes did nothing** — Phase 3 in particular is a correctness fix (preventing a ref from double-incrementing under React's own documented double-invoke semantics), not a raw-speed fix, and Phase 4/5's effects are runtime-animation-strategy and bundle-splitting changes respectively, neither of which this specific desktop, unthrottled Lighthouse configuration is well-positioned to detect (matching this whole audit series' repeated finding — see e.g. `../agents/02d-agents-before-after-comparison.md` §2.3's identical conclusion for its own compiler-optimization and layout-prop fixes).

### 2.3 Performance score / FCP / LCP / Speed Index — noise-band fluctuation on all 3 pages, no consistent directional signal

Every one of these metrics moves by a modest amount on every page, but **not consistently in one direction** — `/brain`'s Performance score goes up slightly (75→80 on run 1, 81→81 unchanged on runs 2-3), `/brain?id=...`'s goes up slightly (66→72, 71→71, 71→71), but `/brain/schedules`'s run 2 actually goes *down* (75→73) while run 1 goes up (75→79). This scatter is consistent with ordinary run-to-run production-build noise already documented throughout this whole audit series (e.g. `../projects/04d-projects-before-after-comparison.md`'s own "not force a tidy narrative onto noisy data" section) rather than a real, attributable effect of any specific fix — none of Phases 1-11 were raw-page-load-speed fixes for these particular pages' initial render (the composer and schedules empty-states aren't touched by any of this pass's code changes at all; the timeline page's only touched code is the Phase 2/3/4 fixes, none of which change what's fetched or how much JS runs before first paint).

### 2.4 Total byte weight — a small, real, expected increase (~11-12 KB, ~0.1%) on every page

Every page's after-scan byte weight is very slightly higher than its before-scan counterpart (9,079 vs 9,067 KB on `/brain`, similarly small deltas on the other two). This is consistent with this pass's actual code changes: new comments and a few new lines in `brain/page.tsx` (documenting the purity-fix reasoning at 9 call sites), a new `layout` prop and defensive-comment block per animated component, the `htmlFor`/`id` credential-form fix, and a new (small) extracted hook file that's still bundled into the same route. An ~11-12 KB increase across a ~9 MB total page weight (~0.13%) is exactly the order of magnitude this kind of correctness/accessibility/documentation-heavy fix pass should produce — not a regression worth chasing, and nowhere near the scale that would suggest an accidental duplicate bundle or a missed code-split.

---

## 3. Accessibility, Best Practices, SEO scores — all unchanged, for the same reason as every prior engagement

Identical to the pre-fix baseline on every page (86/90/85, 92, 100 respectively, across every run). Matches the exact pattern the Agents and Projects engagements both already documented for their own accessibility fixes (`../agents/02d-agents-before-after-comparison.md` §3, `../projects/04d-projects-before-after-comparison.md` §2): this pass's 1 real accessibility fix (Phase 11's `credential-field-*` `htmlFor`/`id` pairing) is a single field on a form most users never reach (a per-tenant API-key connector prompt), correct and worthwhile for a screen-reader user, but far too small a fraction of any page's total accessible-name surface to move Lighthouse's aggregate Accessibility category score, and Lighthouse's automated checks don't specifically target the `label-has-associated-control`/`no-placeholder-only-field` rule shapes react-doctor's stricter static analysis checks. **The fix is still worth having independent of what any automated scorer detects.**

---

## 4. Summary

| Dimension | Verdict |
|---|---|
| **CLS (all 3 pages)** | Bit-identical before/after — expected, since nothing in this pass touched the actual cause (app-wide font-swap, already investigated and left as-is by a prior engagement). |
| **TBT (all 3 pages)** | 0ms before and after — already at its floor in the pre-fix baseline; this pass's fixes (state-updater purity, animation-strategy, bundle-splitting) were never going to show up here regardless of whether they worked. |
| **Performance score / FCP / LCP / Speed Index** | Small, non-directional scatter on all 3 pages — ordinary production-build run-to-run noise, not attributable to any specific fix, none of which touched these pages' initial-load code paths. |
| **Total byte weight** | A small, real, expected ~11-12 KB (~0.1%) increase on every page — consistent with the actual size of this pass's code changes (comments, a `layout` prop, a small extracted hook, an `id`/`htmlFor` pairing), not a concern. |
| **Accessibility / Best Practices / SEO scores** | Unchanged on every page — Lighthouse's automated checks aren't built to detect this pass's specific, narrow accessibility fix, matching the Agents/Projects engagements' own identical precedent. |

**Bottom line, consistent with what this round of fixes actually was:** a correctness pass (a hydration-mismatch fix, 9 impure-state-updater fixes, a navigation-bug investigation that found the main flow already correct), a runtime-animation-mechanism pass (4 `layout`-prop additions), a bundle-splitting pass (4 `motion`→`m` swaps), a loop-parallelization pass, 2 dead-code/redirect investigations, one small decomposition extraction, and one accessibility label fix — not a raw-rendering-speed pass. None of these categories were ever expected to move Lighthouse's headline Performance/CLS/TBT numbers, and none of them did, in either direction, beyond ordinary noise. Every individual fix's *own* correctness was independently confirmed via direct functional/state verification — see `03c-brain-tasks-fixes-test-plan.md` — which remains the more reliable signal throughout this whole engagement, exactly as the Agents and Projects engagements both concluded before this one.
