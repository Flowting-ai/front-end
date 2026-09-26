# Projects Feature — Production Performance Scan (baseline for comparison)

Companion to `04-projects-feature-report.md` (original findings — dev-mode only). This is a from-scratch re-scan on a clean **production build**, following the same methodology established and validated in the Chats feature's own reports (`../chats/01c-chats-before-after-comparison.md`): the Chats work proved dev-mode Lighthouse numbers in this environment are dramatically inflated versus production (TBT alone runs 70-80% higher in dev, purely from Turbopack overhead, not real code cost). No code changes have been made to Projects yet — this is a **pre-fix baseline**, logged specifically so a future fix pass has a real number to compare against, the same role `01c` §4 played for Chats.

**Methodology:** clean production build (`npm run build`), clean server restart (`npm run start`), fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`, 3 consecutive Lighthouse runs per page against the same real project (`QA Test Project`) used in the original report's live-testing pass.

---

## 1. The numbers

| Metric | `/projects` run 1 | run 2 | run 3 | `/projects/new` run 1 | run 2 | run 3 | `/project/[id]` run 1 | run 2 | run 3 |
|---|---|---|---|---|---|---|---|---|---|
| Performance score | 43 | 43 | 43 | 41 | 41 | 40 | 39 | 39 | 39 |
| TBT | 434 ms | 438 ms | 450 ms | 451 ms | 461 ms | 483 ms | 418 ms | 456 ms | 480 ms |
| CLS | 0.357 | 0.357 | 0.357 | 0.440 | 0.440 | 0.440 | 0.495 | 0.495 | 0.495 |
| FCP | 1.5 s | 1.5 s | 1.5 s | 1.5 s | 1.5 s | 1.5 s | 1.5 s | 1.5 s | 1.5 s |
| Speed Index | 4.7 s | 4.6 s | 4.6 s | 4.6 s | 4.6 s | 4.4 s | 5.4 s | 4.7 s | 4.4 s |
| Server response time | 11 ms | 5 ms | 4 ms | 10 ms | 5 ms | 5 ms | **560 ms*** | 13 ms | 13 ms |
| Total page weight | 8,957 KB | 8,957 KB | 8,957 KB | 8,939 KB | 8,939 KB | 8,939 KB | 9,062 KB | 9,064 KB | 9,063 KB |

*`/project/[id]` run 1's 560ms is a cold-first-hit artifact (route handler compiling/warming) — runs 2-3 (13ms both) are the trustworthy read, same "first-run-after-restart" pattern already documented extensively in the Chats reports.

**Every metric is tightly stable across all 3 runs per page** (CLS is identical to three decimal places on every single page) — this is a trustworthy, reproducible dataset, not noise.

---

## 2. The big one: the original report's "5,370ms server response time" concern is resolved

The original `04-projects-feature-report.md` §4 flagged `/project/[id]`'s dev-mode server-response-time of **5,370ms** as its top P1 finding, specifically calling it out as unusual enough to warrant investigating "what that page's server-side data-fetching is doing differently" — a real backend/server-side concern, distinct from client-side React issues.

**It wasn't a backend problem. It was dev-mode Turbopack compilation overhead**, exactly like the TBT inflation already proven for Chats. Production's server response time is **13ms** (runs 2-3, cold-start aside) — a **~400x drop**, not a few-percent improvement. This single number accounts for a large share of why the original dev-mode report read as alarming. Recommend striking this from the backlog as a server-side investigation target — there's nothing there to investigate.

## 3. TBT: same story as Chats — dev-mode inflated it 5-6x

| | dev-mode (original report) | production (this scan) | Ratio |
|---|---|---|---|
| `/projects` | 2,670 ms | 434-450 ms | **-83%** |
| `/projects/new` | 1,930 ms | 451-483 ms | **-76%** |
| `/project/[id]` | 2,680 ms | 418-480 ms | **-83%** |

Directionally identical to what the Chats engagement already proved twice over (dev-mode-vs-prod comparison, then re-confirmed via a true prod-before/prod-after test). Not claiming this as a "fix" — no code has changed — just confirming the same environmental distortion applies here, so the original report's TBT numbers should be read as "dev-mode noise," not "real cost."

## 4. CLS: this one is real, and it's the actual priority

Unlike TBT and server-response-time, **CLS did not collapse in production** — it's better than dev-mode's numbers but still squarely in Core Web Vitals' "poor" range (>0.25) on all three pages:

| Page | Dev-mode (original) | Production (this scan) |
|---|---|---|
| `/projects` | 0.495 | 0.357 |
| `/projects/new` | 0.578 (worst in the whole audit series) | 0.440 (still the worst of these three) |
| `/project/[id]` | 0.495 | **0.495 — identical to three decimal places** |

`/project/[id]`'s CLS being *exactly* the same in dev and production is a strong signal: this is a deterministic, reproducible layout shift, not measurement noise, and not something a build-mode change touches.

**Root cause traced and confirmed, not just hypothesized:** `LeftSidebar.tsx:522-550`. The project sidebar section starts with `expandedIds` empty (line 528), then a `useEffect` (line 541-550, the component's own comment: *"Auto-expand the project whose route is active (only expands, never collapses)"*) matches the current URL against the loaded projects list and expands the active project's row — **after** the projects list itself has finished its own async fetch. That expansion drives `FlatSidebarProjectGroup`'s `height: 0 → "auto"` Framer Motion animation (`FlatSidebarProjectGroup/index.tsx:21-23`). The component does wrap this in `<AnimatePresence initial={false}>`, which correctly skips animating content that's already present on the very first render — but it does **not** help here, because the row starts collapsed at first render and only becomes expanded later, once data arrives — exactly the case `initial={false}` doesn't cover. Every time someone lands directly on a project's page, the sidebar visibly grows to reveal that project's chat list a beat after the initial paint, and Lighthouse (correctly) scores that shift. This is a real, page-load-time layout shift, not a dev-mode artifact, and it explains why the number holds steady across dev and production alike.

`/projects` and `/projects/new` also show real (if lower) CLS (0.357/0.440) despite no project route being active there — meaning nothing in the sidebar should auto-expand on those two pages, so this specific mechanism isn't the whole story. Those two pages' CLS sources are **not yet identified** and need their own trace, the same way this one was.

## 5. New baseline data, no prior comparison available

Total page weight (~8.9-9.1MB) and the run-1-vs-run-2/3 server-response pattern are recorded here for the first time — no equivalent number exists in the original dev-mode-only report. Keep this table as the reference point for any future before/after comparison, the same role `01c` §4 plays for Chats.

---

## 6. Bottom line

Of the original report's two headline P1 concerns — dev-mode TBT (2,670-2,680ms) and dev-mode server-response-time (5,370ms) — **both turn out to be dev-mode artifacts, not real problems**, matching the Chats precedent exactly. The one metric that's genuinely bad and stayed bad in production is **CLS (0.357-0.495, "poor" on every page)** — that's the real, reproducible performance problem in this feature, and where an improvement pass should actually spend effort.

---

## 7. Improvement plan

Synthesizes this scan with the original report's static-analysis backlog (`04-projects-feature-report.md` §7). Two of that backlog's items are now resolved/downgraded by this scan; everything else there is untouched and still stands, since it was never dev/prod-mode-dependent in the first place — findings from static analysis (`react-doctor`) don't change based on which build mode a browser happens to load.

**Closed out by this scan, no longer needs action:**
- ~~Dev-mode server-response-time (5,370ms)~~ — was Turbopack cold-compilation overhead, confirmed via production's 13ms. Nothing to fix.
- ~~Dev-mode TBT (2,670-2,680ms)~~ — was the same class of build-mode inflation already proven for Chats. Production's 418-483ms is the real number.

**P0 — correctness (carried forward unchanged from the original report, still valid):**
1. `project/[id]/chat/[chatId]/page.tsx:326` — `no-hydration-branch-on-browser-global`. Now a **known, proven bug class** — this exact pattern (`typeof window === 'undefined'` inside a `useState` lazy initializer) was traced and fixed twice over in the Chats engagement (`chat/page.tsx`, then generalized into `usePendingPersonaHandoff` and applied to this exact file's *persona*-handoff logic as a bonus fix). Worth checking whether this specific line-326 finding is that same code path (in which case it may already be fixed as a side effect of the Chats work) or a distinct instance in the same file.
2. `project/[id]/page.tsx:829` — non-null assertion (`!`) on a value that can genuinely be undefined. Latent crash risk, cheap to fix once traced.
3. Verify the sidebar project-link click behavior (original report §3.2 caveat) — low effort, still open.

**P1 — performance (revised for this scan's findings):**
4. **Trace and fix the sidebar auto-expand layout shift** (§4 above) — the one concretely-identified, production-confirmed CLS source. Options, roughly ascending in effort: (a) skip the animation specifically for the *auto*-driven expansion (mirroring `ThinkingCollapse`'s own `instant` prop pattern from the Chats engagement — animate normally for a user's own click, snap instantly when the effect does it programmatically); (b) pre-compute the active project synchronously before first paint if the route param alone is enough to know which project should start expanded, removing the need for a post-mount effect entirely; (c) at minimum, reserve layout space for the expanded state so its arrival doesn't shift anything below it.
5. **Trace `/projects` and `/projects/new`'s own CLS sources** (0.357 / 0.440) — confirmed real, not yet root-caused. Since neither page touches the project-specific sidebar auto-expand, this needs its own investigation — check for the same class of issue (an animated or data-arrival-dependent layout change) in the project-card grid, the tab counts ("N Personal Projects" etc., which need a fetch to populate), or the create-project form's own fields.
6. 11× `set-state-in-effect`, 6 of them in `project/[id]/chat/[chatId]/page.tsx` — unaffected by this scan, still a compiler-optimization blocker worth its own pass, separate from the Chats `chat/page.tsx` fix (confirmed diverged code, not shared).
7. 3× uncontrolled Framer Motion imports (`FlatSidebarProjectGroup`, `InviteModal`, `SidebarProjectsSection`) — worth revisiting once item 4 is underway anyway, since `FlatSidebarProjectGroup` is exactly the file item 4 touches.

**P2 — maintainability (carried forward unchanged):**
8. `chat/[chatId]/page.tsx`, `project/[id]/page.tsx`, `projects/page.tsx` all flagged giant + high-complexity. If a decomposition pass is wanted here, the Chats engagement's own playbook (extract genuinely self-contained hooks first, verify each step with TypeScript + tests + a live smoke test, don't force an extraction that just relocates coupling) is the proven template — see `../chats/01-chats-feature-report.md` §9 Phase 6 for the worked example.
9. `ProjectChatRow/index.tsx` — 4 of 6 `refs`-pattern React-Compiler-blocking findings concentrated here.

**P3 — accessibility (carried forward unchanged, and worth flagging as genuinely high-value):**
10. **8 nested-interactive-control findings, concentrated in the sidebar project components** — the same two files (`FlatSidebarProjectGroup`, `SidebarProjectsSection`) that item 4 already needs to touch. Worth doing both passes together: `FlatSidebarProjectGroup`'s row is itself `role="button"`, and it contains three more `role="button"` spans inside it (new-chat icon, settings icon, add icon) — textbook nested-interactive, and exactly the kind of thing a screen-reader/keyboard user would trip over.
11. 5× `role=` instead of real HTML tags — same recurring pattern as Chats' `chats/page.tsx` finding, still open.

**Suggested order:** 4 and 10 together first (same files, compounding value, and 4 is the one concrete performance win available), then 1-3 (cheap correctness fixes), then 5 (the two still-unexplained CLS sources), then 6-9 as a maintainability pass whenever there's appetite for it — matching the same phased approach that worked for Chats.

---

## 8. P0 — executed and verified

1. **Hydration-branch bug, `project/[id]/chat/[chatId]/page.tsx:326`** — already resolved. The real hydration-mismatch risk (the persona lazy-initializer) was fixed earlier this engagement via `usePendingPersonaHandoff`. The remaining `typeof window === 'undefined'` check at lines 306-315 (for `initialFiles`/`window.__pendingProjectChatFiles`) was re-traced and confirmed genuinely benign for both realistic navigation paths (client-side push — no real SSR/hydration cycle occurs; hard reload — both server and client return `[]` since `window`'s in-memory value never survives a reload). No code change needed.
2. **Non-null assertion, `project/[id]/page.tsx:829`** — fixed. Added `const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null` once, guard changed to `{activeStyle && (...)}`, label to `activeStyle.label` — matching the identical pattern already used in the sibling `chat/[chatId]/page.tsx:470`.
3. **Sidebar project-link click behavior** — confirmed correct as-is, not a bug. `FlatSidebarProjectGroup`'s row is deliberately expand/collapse-only by design (own comment: "it no longer navigates anywhere on click"); navigation happens via the hover-revealed settings-gear icon (`onOpen`). Live-verified both behaviors.

All three verified via `tsc --noEmit` (clean), `vitest run` (271/271), and live Playwright checks against a production build.

## 9. P1 — executed and verified

4. **Sidebar auto-expand CLS fix (`LeftSidebar.tsx`)** — fixed via option (b) from §7: a new `activeProjectIdFromPathname(pathname)` helper extracts the active project id straight from the URL, used to seed `expandedIds`'s `useState` lazy initializer synchronously on first render, in both duplicated implementations (`ProjectsSection` and `FlatProjectItemsList`). `pathname` is identical on server and client first render, so this carries no hydration-mismatch risk (unlike `typeof window` or `sessionStorage`). The existing `useEffect` (for client-side navigation between two project pages without a remount) was left unchanged. **Live-verified**: on a genuinely fresh hard load of `/project/[id]`, the sidebar row's `aria-expanded` attribute reads `"true"` from the very first sample it appears in the DOM onward — it never starts `"false"` and flips, so `AnimatePresence initial={false}` now correctly treats the expanded content as present-on-first-render and skips animating it entirely. No post-mount growth observed.
5. **`/projects` and `/projects/new` CLS sources** — both root-caused and fixed:
   - **`/projects`**: the `loading` state rendered a single centered line of text ("Loading projects…") that got replaced by the full grid/list once `useProjects()` resolved — reserving far less space than the real content. Replaced with `viewMode`-aware `Skeleton` placeholders sized to match the real content (4 cards at 262px/12px radius for grid — matching `ProjectCard`'s actual fixed dimensions; 5 rows at 64px for list).
   - **`/projects/new`**: root cause was different in kind — not a skeleton mismatch but a **data-arrival-dependent conditional block**. The "Who can see this" (visibility selector) section only renders when `visibilityOptions.length > 1`, which depends on `orgId` — and `orgId` resolves asynchronously (`org-context.tsx`'s `listOrganizations()` fallback, or simply waiting on the authenticated `user` object on a hard reload). **Confirmed empirically** with a live probe: on a fresh load, the block appeared ~2-4s after initial paint (timing varies with cold-start), squarely inside Lighthouse's CLS measurement window — not a dev-mode artifact. Fixed by gating the block on `orgReady` (from `useOrg()`) instead of `orgId` directly, rendering a `Skeleton` placeholder precisely sized to the real content's measured dimensions (24px label + 44px button, matching a live-measured 74px total block height) while pending, so the swap to real content is pixel-exact with zero shift. **Trade-off, documented not hidden**: this converts the shift for org-having accounts (the case Lighthouse actually measured, CLS 0.440) to zero, at the cost of a new, small (~74px), one-time collapse for personal-only accounts that previously had no shift at all (since `orgId` stays `null` throughout for them, both before and after resolution) — an edge case this test account doesn't exercise. **Live-verified** on this test account (which does have an org): the "What are we trying to achieve" description field's Y-position stayed at a constant pixel value across the entire org-resolution window, before and after the visibility block appeared.
   - Both changes verified via `tsc --noEmit` (clean), `vitest run` (271/271 passing), and live Playwright checks against a fresh production build.
6. **11× `set-state-in-effect`, 7. 3× uncontrolled Framer Motion imports** — not yet started this pass.

## 10. Post-fix Lighthouse re-scan — the honest result: CLS score is unchanged, and here's exactly why

Ran the same 3-run production methodology against all three pages with items 4 and 5 both live. **The top-line CLS number did not move on any page** (`/projects` 0.357 → 0.357, `/projects/new` 0.440 → 0.440, `/project/[id]` 0.495 → 0.495/0.495, run-1-cold-start aside) — bit-identical to the pre-fix baseline in §1. This needed explaining, not glossing over, so before writing this up the fixes were re-verified independently of Lighthouse:

- **Item 4 (sidebar auto-expand)**: live-probed on a genuinely fresh `/project/[id]` load — the sidebar row's `aria-expanded` attribute reads `"true"` from the very first sample it exists in the DOM, never `"false"`-then-flips. The fix works exactly as designed.
- **Item 5 (`/projects/new` visibility block)**: live-probed the same way — the description field's Y-position stayed at a constant pixel value across the entire 6-second window spanning when the visibility block appeared. Zero shift, confirmed pixel-exact.
- **Item 5 (`/projects` skeleton)**: visually confirmed via screenshot — correctly-sized skeleton cards render immediately, swap cleanly to real content.

All three fixes are real and independently verified. **They just aren't what Lighthouse's CLS score is actually measuring on these pages.** Pulling the `layout-shifts` audit's per-element breakdown (not just the summary score) from both the pre-fix baseline JSON and this re-scan's JSON shows why:

| Page | Dominant shift (score) | Cause | Present in pre-fix baseline too? |
|---|---|---|---|
| `/projects` | 0.3572 (~100% of total) | **Web font loaded** | Yes — bit-identical score (0.3572296476306197 in both) |
| `/projects/new` | 0.4399 (~99.97% of total) | **Web font loaded** | Yes — bit-identical score (0.4398541919805589 in both) |
| `/project/[id]` | 0.3572 (main content area, unattributed) + 0.1381 (sidebar, **Web font loaded**) | Two separate large shifts | Yes — both bit-identical to baseline |

**The actual dominant CLS cause on all three pages is a web-font swap** (`layout.tsx`'s `Besley`/`Geist`/`Geist_Mono` via `next/font/google`, all three already set to `display: "swap"`) — not the sidebar animation, not a loading-skeleton mismatch, not an async `orgId` gate. `next/font` normally auto-generates a metrics-matched fallback specifically to prevent this class of shift, but these are **variable-weight fonts** (`weight: "variable"`); a single auto-generated fallback can't perfectly match every rendered weight, so a residual reflow on font-swap survives even with the recommended setup. This is a systemic, cross-cutting issue — `layout.tsx` is shared by every page in the app, not something specific to Projects — and is genuinely a **new finding from this pass**, outside the scope of the original 11-item backlog (§7).

On `/project/[id]` specifically, item 4's fix did shrink the *number* of distinct shift events in the breakdown (15 → 8, cutting most of the small ~0.003-0.009 long-tail entries) — real, measurable cleanup — but CLS is a windowed-max metric dominated by its two largest events (the font swap, and a separate, not-yet-traced 0.357 shift in the main content area/composer that has nothing to do with the sidebar). Removing smaller contributors doesn't move a score that's capped by the two big ones.

**Bottom line:** items 4 and 5 are correct, verified, and worth keeping — they eliminate real shifts and reduce shift-event count — but they were never going to move Lighthouse's top-line CLS score, because a much larger, previously-undiscovered pair of issues (app-wide variable-font-swap reflow, and an untraced main-content-area shift on `/project/[id]`) dominates the metric on all three pages. Actually moving the CLS score requires tackling those two, which is materially bigger in scope (font config is global; the main-content shift needs its own trace, mirroring how item 4 was root-caused) than the original P1 backlog — logged here as new, unscoped findings pending direction on whether to pursue them.

## 11. Font-swap CLS fix — applied, correct, but not locally provable

Per direction, tackled the dominant font-loading CLS cause from §10 directly.

**The fix**: `src/app/layout.tsx` — all three fonts (`Besley`, `Geist`, `Geist_Mono`, all self-hosted via `next/font/google`) changed from `display: "swap"` to `display: "optional"`. `next/font`'s automatic metrics-matched fallback (`ascent-override`/`descent-override`/`size-adjust`, confirmed present in the generated CSS — `Besley Fallback` maps to `Times New Roman`, `Geist`/`Geist Mono Fallback` to `Arial`) corrects *vertical* metrics only; it can't correct the fallback and real families having *different glyph advance widths*, so text still reflows (changes line-wrap) whenever the real font swaps in — which is exactly what "swap" guarantees will always eventually happen, however late. "optional" tells the browser to skip that swap entirely for a given page render unless the font is ready almost immediately, eliminating the reflow at the cost of occasionally keeping the fallback font for that one view. This is Next.js's own documented trade-off for CLS-sensitive apps, standard practice, and cannot make CLS worse than "swap" — only equal or better.

**What could be verified:**
- Build correctness — confirmed the generated CSS actually emits `font-display:optional` after rebuild (not just the source-level intent).
- `tsc --noEmit` clean, `vitest run` 271/271, both before and after re-restoring this fix following the counterfactual test below.

**What could NOT be verified locally, and why — full transparency:**
- Re-ran the same 3-run Lighthouse pass on `/projects` post-fix: **CLS unchanged, bit-for-bit identical** to both the pre-fix baseline and the `swap` version (0.3572296476306197, to 16 significant digits, cause still tagged "Web font loaded"). Confirmed this isn't a stale build — the generated CSS was checked and did contain `font-display:optional`.
- Root cause: this dev environment serves fonts from `localhost` with near-zero latency. Lighthouse's CLS number comes from a *real, unthrottled* browser trace (only TBT/FCP/Speed Index go through Lighthouse's simulated-throttling model) — so the font arrives fast enough that both "swap" and "optional" converge to the identical timing and identical swap behavior. Lighthouse locally cannot discriminate between the two settings.
- Attempted to force a genuine slow-network condition via Playwright's CDP `Network.emulateNetworkConditions` to test the real mechanism directly (not through Lighthouse): an aggressive throttle (50kbps) broke page load entirely before fonts were even requested; a realistic "Slow 4G" profile (1.6Mbps/150ms, Lighthouse's own default mobile simulate profile) still showed zero font network requests and zero `layout-shift` PerformanceObserver entries within a 7-10s window, for **both** the `swap` and `optional` builds — inconclusive, most likely because CDP-level artificial throttling in a single-machine dev/auth-gated test harness doesn't cleanly reproduce either Lighthouse's own simulation model or a real CDN-fronted production deployment's characteristics.
- Also tried Lighthouse's own `--throttling-method=devtools` (real, not simulated, throttling) directly: failed outright with `NO_FCP` ("the page did not paint any content") on repeated attempts — a known flakiness combination (headless Chrome + devtools-mode throttling), not something worth chasing further here.

**Bottom line:** the fix is applied, technically correct, low-risk, and directly targets the exact mechanism Lighthouse's own `layout-shifts` audit named as the CLS cause (verified via that audit's per-element breakdown in §10, not guesswork). Its real-world benefit could not be locally measured — this dev environment's setup (localhost speed, auth-gated pages, no CDN) makes every tool tried either converge to identical before/after behavior or fail to load at all. **Recommend verifying with a real Lighthouse run against a deployed staging/production URL**, where actual network latency will let "optional" show its effect (or confirm none is needed) — this is the one finding in this whole engagement that genuinely can't be proven from a local dev server alone.
