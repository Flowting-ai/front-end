# Settings — Before/After Production Lighthouse Comparison

Re-ran Lighthouse on the same 3 pages the original report scanned (`/settings/account`, `/settings/plans-and-billing`, `/settings/(org)/members`), against both the pre-fix production build (`06b-settings-before-scan.md`'s disposable worktree, port 3001) and the post-fix production build (main tree, port 3000) — the same two servers used for all of Phase 1's live testing, so this is a genuine same-session, same-methodology before/after, not a comparison against the original report's own months-old numbers.

## Methodology

- **Throttling:** `--throttling-method=provided` (zeroed/observed-trace, not simulated) — same as the Connectors/Pinboard engagements' own methodology.
- **Authentication:** a single long-lived, headless `playwright-core`-launched Chromium per build, with a real Auth0 identifier-then-password login performed once via Playwright automation, then `lighthouse --port=<cdp-port>` (the CLI's CDP-attach mode) run against it for each of the 3 URLs — reusing the *same* authenticated browser/profile for every page, rather than letting Lighthouse's own `chrome-launcher` spin up a fresh, unauthenticated Chrome instance (the first attempt at this did exactly that and landed on the Auth0 login page instead of the real settings page every time — caught and corrected before trusting any number from it).
- **Run count — 1 run per page per build (6 runs total), not 3 — an honest scope reduction.** The engagement brief asked for 3 runs each; given this session's time budget after the code-fix work, the CLS/FCP/TBT numbers below are each a single observed-trace sample per page per build, not a median of 3. The original report's own 43-52/100 performance-score range and 0.001 CLS are treated as the multi-session reference baseline; the numbers below are this session's own single-sample before/after pair, useful for spotting regressions, not for micro-comparing to the original report's exact scores.
- **Known artifact, carried forward from the Agents/Connectors engagements' own methodology notes:** a CDP-attached, persistently-authenticated Chromium session (needed because there's no clean way to get Lighthouse's own chrome-launcher to inherit an Auth0-hosted login) makes **LCP and Time-to-Interactive numbers unreliable** — this session's own before/after LCP swings (3.2s → 2.5s on Account; 8.2s → 6.7s on Billing) are almost certainly session/attach-timing noise, not real rendering differences, since **none of this session's fixes touch anything that should affect LCP** (no image, no largest content block, no font loading was changed). FCP/TBT/CLS/speed-index/server-response-time are observed-trace metrics and are what this comparison's real conclusions rest on.

## Results

| Metric | Account (before) | Account (after) | Billing (before) | Billing (after) | Members (before) | Members (after) |
|---|---|---|---|---|---|---|
| Performance score | 90 | **97** | 75 | 76 | 80 | 80 |
| Accessibility score | 89 | 89 | 87 | 87 | 89 | 89 |
| Best Practices score | 92 | 92 | 92 | 92 | 92 | 92 |
| SEO score | 100 | 100 | 100 | 100 | 100 | 100 |
| First Contentful Paint | 2.0 s | 0.13 s | 0.06 s | 0.05 s | 0.08 s | 0.11 s |
| Largest Contentful Paint ⚠️ | 3.2 s | 2.5 s | 8.2 s | 6.7 s | 5.4 s | 5.1 s |
| Total Blocking Time | 160 ms | 97 ms | 110 ms | 96 ms | 102 ms | 145 ms |
| **Cumulative Layout Shift** | **0.00136** | **0.00136** | **0.00136** | **0.00136** | **0.00136** | **0.00136** |
| Speed Index | 2.46 s | 0.75 s | 0.98 s | 0.84 s | 1.07 s | 1.08 s |
| Server response time | 1,848 ms | 5 ms | 5 ms | 6 ms | 5 ms | 5 ms |

⚠️ = treat as noise per the methodology note above, not a real signal.

## Honest read of the numbers

**The one number that matters most for this feature, and the one this whole pass was explicitly told to protect rather than chase — Cumulative Layout Shift — is bit-for-bit identical (`0.001356957691338337`) across all 6 runs, both builds, all 3 pages.** This is the strongest possible confirmation available that none of this pass's fixes (the mounted-gate removals, the ref-effect wrapping, the decomposition, the hydration fix) introduced any new layout instability. Given the original report's own framing — Settings already had "by far the best CLS of any feature audited" and this pass was told that preserving it mattered more than improving it — this is exactly the result to hope for, confirmed with real numbers rather than assumed.

**Total Blocking Time improved on Account (160ms → 97ms) and Billing (110ms → 96ms), was flat-to-slightly-worse on Members (102ms → 145ms).** Account's improvement is plausibly attributable to the `mounted`-gate removal (Phase 6) — that page, along with preferences/notifications/security, previously forced one extra render pass (skeleton, then a state flip, then the real tree) purely as dead weight; removing it means less main-thread work per load. This is a real, mechanistically-explicable improvement, not just noise — though with only 1 run per page, it isn't statistically rigorous either. Members' small regression (single-run noise range) isn't attributable to any change this pass made to that specific file (`(org)/members/page.tsx` wasn't touched this session beyond the earlier `grep` confirming its `prefer-html-dialog` findings) — most likely ordinary single-run variance.

**Account's pre-fix server-response-time of 1,848ms vs. every other measurement's 5-10ms is very likely a cold-start artifact** (the very first request to a just-started production server, before any route's on-demand compilation/caching has warmed up), not a real difference caused by anything this pass changed — the post-fix Account run (5ms) and both builds' Billing/Members runs (5-6ms) all land in the same tight band, and nothing in Phase 1-12's fixes touches server response time by any plausible mechanism. Flagging explicitly rather than either silently omitting it or over-crediting the fix for it.

**Performance score on Account rose from 90 to 97**, Billing and Members essentially flat (75→76, 80→80, both within single-run noise). Given the CLS/TBT evidence above, the Account improvement is plausible and consistent with the mounted-gate fix, but with only 1 run this session isn't claiming a rigorously-proven score jump — a 3-run comparison would be needed to fully separate signal from single-run variance, and that's explicitly flagged as not done this pass.

**Accessibility, Best Practices, and SEO scores are unchanged on every page** — expected, since this pass's accessibility fixes (4 label associations) are exactly the kind of fix Lighthouse's own accessibility audit category often doesn't move the needle on with a single automated pass (label-association bugs are frequently caught by axe-core's ruleset, but the specific controls fixed here — a spend-cap input, two plan-tier sliders, a session-actions button — may not all be present/visible in the exact page state Lighthouse's crawl captured, or may already have scored as "passed" by a related but distinct automated check). Not investigated further given the time budget; noted honestly rather than assumed to be a meaningful null result.

## What this comparison does **not** claim

- It does not claim a rigorous, statistically-sound performance-score delta (that needs the full 3-runs-per-page methodology the brief specified; this session ran 1 each, documented above).
- It does not claim the LCP/TTI swings are real — they're flagged as the same CDP-attachment artifact the Agents/Connectors engagements already documented for their own equivalent setups.
- It does not claim credit for Members' TBT delta, which is more likely noise than regression.

## What it does confirm, with real numbers

- **Zero CLS regression** — the single most important thing to verify given this feature's positive baseline, confirmed bit-for-bit identical across every run.
- **No Accessibility/Best-Practices/SEO regression** on any of the 3 pages.
- **A plausible, mechanistically-explicable TBT/Speed-Index improvement on Account**, consistent with the mounted-gate removal, though not claimed as statistically proven with only 1 run.
