# Projects Feature — Pre-Fix Production Baseline Scan

Companion to `04-projects-feature-report.md` (original findings — dev-mode only). This is a from-scratch re-scan on a clean **production build**, following the same methodology established and validated in the Chats feature's own reports (`../chats/01c-chats-before-after-comparison.md`): the Chats work proved dev-mode Lighthouse numbers in this environment are dramatically inflated versus production (TBT alone runs 70-80% higher in dev, purely from Turbopack overhead, not real code cost). No code changes have been made to Projects yet — this is a **pre-fix baseline**, logged specifically so a future fix pass has a real number to compare against, the same role `01c` §4 played for Chats.

**This is the one extra file Projects has that Chats doesn't.** Chats never had a dedicated pre-fix production baseline document — its dev-mode numbers (in `01-chats-feature-report.md`) served as the only "before" reference, and its production numbers only ever appear already alongside the "after" comparison in `01c`. For Projects, this file was commissioned separately and deliberately, specifically so a real production "before" number would exist independent of when the fixes themselves got written up — see `04d-projects-before-after-comparison.md` for what changed.

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

## What actually happened next

Every item above was executed in a later session — see `04-projects-feature-report.md` §10 ("Fixes applied") for the full phase-by-phase account, including one significant discovery this plan didn't anticipate (a systemic app-wide font-swap CLS cause, found only after re-scanning post-fix and seeing the CLS score not move — see that section's Phase 4). `04c-projects-fixes-test-plan.md` has the per-fix test cases, `04d-projects-before-after-comparison.md` re-scans this exact baseline post-fix, and `04e-projects-manual-qa-checklist.md` is the hands-on click-through.

