# Agents Feature — Before / After Fix Comparison

Companion to `02-agents-feature-report.md` (original findings + §9's fix log) and `02b-agents-before-scan.md` (the pre-fix production baseline this file re-scans). Same format and honesty standard as `../projects/04d-projects-before-after-comparison.md` and `../chats/01c-chats-before-after-comparison.md`: report what the data actually shows, including the parts that don't move the way a fix's own logic would predict — never smoothed over.

**Methodology:** identical to `02b`'s — clean production build (`npm run build --webpack`, includes every fix through Phases 1-8 of `02-agents-feature-report.md` §9), clean server restart, fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, 3 consecutive Lighthouse runs per page against the same real agent (`QA Test Agent`, repo id `cbde73d7-b4f4-4df3-9fac-5289e41c557a`) used throughout this whole engagement, same 4 pages (`/agents`, `/agents/templates`, `/agent/configure/profile`, `/agents/{id}/chat`). **The same LCP/TTI unreliability documented in `02b` §4.1 applies identically here** — both metrics, and the Performance score they heavily weight, are Lantern-simulated numbers that this session's CDP-attached-browser Lighthouse setup miscalibrates (~45-50s on every page regardless of what the page actually does), confirmed again this scan on `/agents/templates` run 1 specifically returning a *sane* 1.06s LCP while every other run/page still shows the ~45-50s artifact — inconsistent behavior of the same broken mechanism, not a real page-load difference. TBT/CLS/FCP/Speed-Index/server-response-time/byte-weight/Accessibility/Best-Practices/SEO remain the trustworthy signal set.

---

## 1. The numbers, in full, not cherry-picked

| Metric | `/agents` run1 | run2 | run3 | `/agents/templates` run1 | run2 | run3 | `/agent/configure/profile` run1 | run2 | run3 | `/agents/{id}/chat` run1 | run2 | run3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Performance score ⚠️ | 59 | 59 | 59 | 87 | 69 | 69 | 51 | 59 | 58 | 59 | 57 | **37** |
| Accessibility score | 84 | 84 | 84 | 87 | 87 | 87 | 81 | 81 | 81 | 88 | 88 | 88 |
| Best Practices score | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 |
| SEO score | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| TBT | 516 ms | 505 ms | 501 ms | 470 ms | 493 ms | 471 ms | 666 ms | 499 ms | 520 ms | 548 ms | 569 ms | 521 ms |
| CLS | 0.022 | 0.022 | 0.022 | 0.007 | 0.007 | 0.007 | 0.059 | 0.0002 | 0.0002 | 0.007 | 0.007 | **0.497** |
| FCP | 0.9 s | 1.5 s | 1.5 s | 1.1 s | 1.7 s | 1.7 s | 1.4 s | 1.4 s | 1.4 s | 1.5 s | 1.1 s | 1.5 s |
| Speed Index | 4.5 s | 4.6 s | 4.6 s | 3.8 s | 4.0 s | 3.9 s | 7.2 s | 4.8 s | 4.8 s | 4.1 s | 5.1 s | 5.0 s |
| Server response time | 3 ms | 4 ms | 5 ms | 5 ms | 4 ms | 4 ms | **2,038 ms*** | 5 ms | 4 ms | 24 ms | 10 ms | 10 ms |
| Total page weight | 9,179 KB | 9,179 KB | 9,179 KB | 9,143 KB | 9,145 KB | 9,143 KB | 9,233 KB | 9,232 KB | 9,233 KB | 9,196 KB | 9,198 KB | 9,197 KB |

*`/agent/configure/profile` run 1's 2,038ms server-response spike is the same cold-first-hit-after-restart pattern documented throughout this whole audit series — runs 2-3 (4-5ms) are the trustworthy read, and this run's own Speed Index (7.2s, the outlier of the three) tracks directly with it.

---

## 2. What actually moved, read honestly

### 2.1 `/agents` — CLS became dead stable (0.022, identical to 3 decimal places, all 3 runs)

The pre-fix baseline (`02b` §4.2) showed `/agents`' CLS swinging 0.357 → 0.380 → 0.022 across its 3 runs — real instability, not measurement noise (each run was internally consistent, they just disagreed with each other). Post-fix, all 3 runs land on exactly 0.022. **This is not attributable to any specific fix in this pass** — nothing in Phases 1-8 touched `/agents`' rendering, layout, or data-loading path (the only changes to `agents/page.tsx` were the `copyPersonaRepoDeduped` rename, which has zero runtime/rendering effect, and one `aria-label` addition to the search input, which changes no layout geometry). The most plausible explanation, consistent with this whole audit series' repeated finding that CLS on data-driven pages is sensitive to exactly how fast/in-what-order async data arrives (see e.g. `02b` §4.2's own note that `/agents`' CLS was "worth root-causing... candidate cause: the persona list/card grid populating after an async fetch"): the specific arrival timing of the persona-list fetch differed between the two sessions for reasons outside this pass's control (session-to-session backend latency variance, not a code change). **Reported as a real, measured improvement in this specific dataset, explicitly not claimed as caused by any fix.**

### 2.2 `/agents/templates` — essentially unchanged, as expected

TBT (470-493ms vs. baseline's 478-527ms) and CLS (0.007 identically, both before and after) both land in the same band. This is exactly what should happen — the only change to this page was the hydration-race fix (Phase 1 item 3), which touches `disabled`/`opacity`/`cursor` state on two buttons, none of which are layout-shifting properties, and which resolves in well under a frame on an unthrottled machine (the same machine Lighthouse runs on) — so no visible Lighthouse-timescale effect is expected, and none appeared.

### 2.3 `/agent/configure/profile` — no meaningful change, one cold-start artifact

TBT/CLS/Speed-Index all fall within the same noise band as the baseline (`02b` §4.2's own `configure-profile run2` had an identical 1,893ms server-response cold-start blip — this scan's run 1 shows the same pattern, just landing on a different run number). Nothing in Phases 1-8 changed this page's own rendering path in a way that would be expected to move Lighthouse's headline numbers — the `refs`/ref-mutation fixes (Phase 2) and the layout-`prop` addition (Phase 3, on `layout.tsx`, shared chrome around all 5 configure tabs) are compiler-optimization and animation-*mechanism* fixes, not raw-speed fixes, and correctness/compiler-optimization fixes not moving Lighthouse's timing numbers is the same conclusion the Chats and Projects engagements both already reached for their own equivalent fix categories (see `../chats/01c-chats-before-after-comparison.md` §5's "None of that shows up as a Lighthouse score movement... that's consistent with what the fixes actually were").

### 2.4 `/agents/{id}/chat` — one new anomaly, reported plainly

Run 3's CLS spiked to **0.497** ("poor"), pulling that run's Performance score down to 37 (Lighthouse's Performance score is CLS-sensitive, and this is the same lockstep relationship the Projects engagement documented in its own `04d` §4: "the runs with CLS 0.007 are also the runs with the highest Performance scores"). Runs 1-2 (0.007 both) match the pre-fix baseline's own `agent-chat` CLS numbers (0.007-0.039) closely. **Nothing in this pass touched `PersonaChatInterface.tsx` or any agent-chat-specific rendering code** (the cross-file duplication check in Phase 5 investigated but explicitly did not modify it, judging a `useChatState` retrofit high-risk and out of scope) — so this is not attributable to a regression from any fix here either. Consistent with the "first-run-after-restart" volatility this whole audit series has repeatedly documented (e.g. `../chats/01c-chats-before-after-comparison.md` §6's own "first Lighthouse run against a server that had just been restarted" anomaly) — though notably this is run *3*, not run 1, so it doesn't cleanly fit that specific pattern either. **Flagged as an open, unexplained anomaly rather than forced into a tidy explanation** — the honest thing to do given the data doesn't cleanly support one.

---

## 3. Accessibility, Best Practices, SEO scores — all unchanged

Identical to the pre-fix baseline on every page: 84/87/81/88, 92, 100 respectively, across every single run. This is the same "Lighthouse's scoring model doesn't have an automated check for what actually got fixed" pattern the Projects engagement documented in detail (`../projects/04d-projects-before-after-comparison.md` §2 — confirmed there that Lighthouse's Accessibility category has no automated `nested-interactive` audit). This pass's 15 accessibility fixes (Phase 7: `aria-label` additions resolving `no-placeholder-only-field`/`control-has-associated-label`) are real, correct, and would matter to a screen-reader user — but Lighthouse's automated Accessibility audits (`aria-*`-attribute-presence checks, color contrast, etc.) don't specifically score "does this input have an accessible name via `aria-label` vs. relying on placeholder text" as a category-moving check in a way visible at this resolution; the underlying axe-core ruleset does have relevant checks, but whether they fire depends on the exact violation shape, and a placeholder-only field without any other accessible-name mechanism already often passes Lighthouse's baseline `aria-*` audits (e.g. `input-button-name`/`aria-input-field-name`), which check for *the presence of any label mechanism, not specifically whether it's the best one* — the `no-placeholder-only-field`/`control-has-associated-label` rules this pass fixed are react-doctor's own, stricter, more specific checks, not Lighthouse's. **The fixes are still worth having — this is a UX/screen-reader-clarity improvement independent of what any specific automated scorer detects.**

---

## 4. Summary

| Dimension | Verdict |
|---|---|
| **`/agents` CLS** | Real, measured improvement in this dataset (0.357-0.380 → dead-stable 0.022) — explicitly **not** attributed to any specific fix in this pass; most likely session-to-session data-arrival timing, the same class of variance this whole audit series has repeatedly documented elsewhere. |
| **`/agents/templates`** | Unchanged, as expected — the hydration-race fix touches no layout-shifting properties. |
| **`/agent/configure/profile`** | Unchanged, as expected — this pass's fixes here (refs/compiler-optimization, layout-`prop` animation mechanism) were never raw-speed fixes. |
| **`/agents/{id}/chat`** | One new, unexplained CLS spike (run 3, 0.497) — reported honestly as an open anomaly, not attributable to any change made this pass, not force-fit into a tidy narrative. |
| **Accessibility / Best Practices / SEO scores** | Unchanged on every page — Lighthouse's specific automated checks aren't built to detect this pass's particular a11y fixes (label-mechanism specificity), matching the Projects engagement's own "the tool doesn't measure what you fixed" precedent. |
| **Performance score, TBT** | Same noise band as the pre-fix baseline on 3 of 4 pages; `/agents` shows a real, stable increase (~46→59) driven by its own CLS stabilization (§2.1), not a TBT change (TBT itself moved only marginally, within noise, on every page). |

**Bottom line:** consistent with what this round of fixes actually was — a correctness, compiler-optimization, leak, and accessibility pass, not a raw-rendering-speed pass. The one page showing a real, stable metric shift (`/agents`' CLS) can't be honestly attributed to any specific code change in this engagement, and is reported as such rather than claimed as a win. The one new anomaly (`/agents/{id}/chat` run 3's CLS spike) is reported as unexplained rather than glossed over. Every individual fix's *own* correctness was independently confirmed via direct functional/state verification — see `02c-agents-fixes-test-plan.md` — which remains the more reliable signal throughout this whole engagement whenever Lighthouse's aggregate score and a fix's actual, verified behavior have disagreed, exactly as the Projects and Chats engagements both concluded before this one.
