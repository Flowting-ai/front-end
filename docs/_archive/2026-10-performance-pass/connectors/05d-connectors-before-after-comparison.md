# Connectors Feature — Before/After Production Lighthouse Comparison

Re-run of `05b-connectors-before-scan.md` §8's exact methodology (`lighthouse` v13.5.0 `startFlow`, Navigation mode, `puppeteer-core`-launched Chromium with `--no-sandbox --disable-gpu --disable-dev-shm-usage`, `throttlingMethod: 'provided'`) against the post-fix production build, on the same route (`/connectors`, "All" tab), 3 consecutive runs. Same honesty standard as `../pinboard/07d-pinboard-before-after-comparison.md`: this pass's fixes are correctness/security/maintainability fixes, not raw-speed fixes, so no attempt is made to force a narrative where Lighthouse's score "should" have moved.

---

## 1. Headline numbers, side by side

| Metric | Before (run 1/2/3) | After (run 1/2/3) | Verdict |
|---|---|---|---|
| Performance score | 99 / 100 / 93 | 99 / 94 / 95 | No meaningful change — both ranges (93-100 vs. 94-99) overlap almost entirely; the spread within each set is larger than the gap between the sets. |
| Accessibility score | 84 / 84 / 84 | 84 / 84 / 84 | **Unchanged, exactly** — expected, see §3. |
| Best Practices score | 92 / 92 / 92 | 92 / 92 / 92 | Unchanged. |
| SEO score | 100 / 100 / 100 | 100 / 100 / 100 | Unchanged. |
| First Contentful Paint | 0.5s / 0.5s / 2.5s | 0.5s / 2.4s / 0.6s | Same run-to-run variance pattern in both sets, tracking server-response time (see §2). |
| Largest Contentful Paint | 0.5s / 0.5s / 2.5s | 0.5s / 2.4s / 3.0s | Same. |
| Total Blocking Time | 0ms / 10ms / 20ms | 10ms / 0ms / 0ms | Both effectively zero — no change. |
| Cumulative Layout Shift | 0.067 / 0.007 / 0.067 | 0.067 / 0.067 / 0.007 | Same distribution of values reappears in both sets (0.067 and 0.007 are the only two values observed, before and after) — not a regression, likely reflects the same one or two genuinely-shifting elements on the page (e.g. font swap, an image) present in both builds. |
| Speed Index | 0.8s / 0.9s / 0.9s | 0.7s / 0.8s / 0.9s | No meaningful change. |
| Time to Interactive | 0.6s / 0.6s / 2.6s | 0.7s / 2.4s / 0.6s | Same variance pattern, same root cause (§2). |
| Server response time | 10ms / 10ms / 1,940ms | 10ms / 1,930ms / 0ms | Same variance pattern, before and after. |

**Both dramatically better than the original report's dev-mode numbers** (Performance 37/100, TBT 1,950ms, CLS 0.138) — reconfirming, on both sides of this fix pass, the dev-vs-prod finding established across all six prior engagements in this series.

---

## 2. Why the timing metrics vary run-to-run, in both sets, and why that's not this pass's concern

Every run in both the before and after sets shows the same pattern: 2 of 3 runs land in the 0.5-0.9s range across FCP/LCP/SI/TTI with a ~10ms server response, and 1 of 3 runs spikes to 2.4-3.0s with a ~1,900ms+ server response. This tracks the `devapi.getsouvenir.com` intermittent-backend-latency pattern documented across 5 of the 6 prior features in this series (Chats, Brain/Tasks, Projects, Connectors' own original report, and now reconfirmed here) — a backend/infra condition, not a frontend regression introduced or fixed by this pass. It appears in **both** the pre-fix and post-fix builds at almost the same rate (1 of 3 runs each), which is itself a small, useful confirmation that this pass's changes didn't make backend-latency sensitivity any worse.

---

## 3. Why Accessibility didn't move, even though 4 accessibility findings were fixed

The Accessibility score is **identical, run for run, before and after: 84/84/84 → 84/84/84.** This is not a measurement failure — it's exactly what `05-connectors-feature-report.md` §10 Phase 5/7 predicted and this comparison confirms: **all 4 `label-has-associated-control` fixes live in `ConnectorRequestModal/index.tsx`, a component confirmed dead code (zero import sites anywhere in the app) — it never renders on `/connectors` or any other route, so Lighthouse's accessibility audit, which only scans the DOM that actually gets rendered, has nothing to see change.** This is the same category of "predict before the fix pass that Lighthouse would be the wrong instrument to see a specific fix's effect, then confirm that prediction" rigor `../pinboard/07b-pinboard-before-scan.md` §9 modeled for its own headline fix — the difference here being the reason isn't "Lighthouse's own scoring methodology can't see this," it's "this code doesn't run on the page being scored at all." The remaining Accessibility findings this feature has (the `prefer-html-dialog` gaps, deliberately out of scope this pass) also remain, further explaining an unchanged score.

If `ConnectorRequestModal` is ever wired up to a live route, re-running Lighthouse against that route would be the correct way to see this fix's effect — `/connectors` itself was never going to show it.

---

## 4. Why Performance/TBT/CLS didn't move for the fixes that *are* live

Of this pass's live-reachable fixes on `/connectors` itself:
- The `window.open`/`noopener` fixes are pure security hardening — they change zero rendering, zero layout, zero JS execution time on the page. No Performance-metric movement is expected or would mean anything if observed.
- The `set-state-in-effect` fixes (Phase 4) restructure *when* a handful of `setState` calls happen (moving some from inside an effect body to render-time, or into an async callback) without changing *what* they do or *when the resulting DOM update becomes visible* in any user-perceptible way — React batches these regardless of which of the two documented-legitimate shapes triggers them. Not expected to move TBT/TTI.
- The `no-derived-useState` fixes (Phase 6) only change behavior in the specific staleness scenarios described in `05c-connectors-fixes-test-plan.md` TC-6.1/6.2 (an account's true nickname changing underneath an open edit, or a second `?q=` deep-link) — neither scenario occurred during any of these Lighthouse runs (a fresh page load each time), so there was nothing for this fix to visibly change here.
- The `nextjs-no-client-side-redirect` investigation resulted in no code change at all.

The one live fix with a plausible (if minor) Performance-adjacent story — `ConnectorRow`'s `layout`-prop animation fix — doesn't render on `/connectors` at all (it's on `/agent/configure/connectors`, per the Phase 5 scoping correction); a Lighthouse run on `/connectors` was never going to be sensitive to it either.

**Net conclusion, matching this series' established honesty standard**: this pass's fixes are correctness, security, and maintainability fixes almost without exception. The fact that Lighthouse's `/connectors` score is statistically indistinguishable before and after is the expected, correct outcome, not a sign the fixes did nothing — the actual "did it work" evidence for the fixes that matter most lives in `05c-connectors-fixes-test-plan.md`'s live `window.opener` checks and the `eslint`/`tsc`/`vitest` gates, not in a Lighthouse score.

---

## 5. What wasn't re-measured this pass

- **The "Connected" tab** (attempted via Lighthouse's Timespan mode wrapping a tab-click interaction): failed at the tooling level — this version of `lighthouse`'s `UserFlow.startTimespan()` does not accept `accessibility`/`seo` in `onlyCategories` for timespan-mode audits (performance-only categories are valid for a timespan; the script's per-step category override was not honored the way the flow-level config was), and a `performance`-only timespan config was not pursued further given the time this session had left. **Flagged as not completed, not fabricated** — the "All tab" Navigation-mode numbers above are the only production Lighthouse data this pass produced for either side of the comparison, matching the original report's own "All tab" scope.
- A dev-mode re-scan was not performed (production is the only mode this whole series measures for Lighthouse, per every prior engagement's own established finding that dev-mode numbers are categorically unrepresentative here).

See `05b-connectors-before-scan.md` for the pre-fix baseline and full methodology, `05-connectors-feature-report.md` §10 for the fix log, `05c-connectors-fixes-test-plan.md` for per-fix test cases, and `05e-connectors-manual-qa-checklist.md` for the hands-on click-through.
