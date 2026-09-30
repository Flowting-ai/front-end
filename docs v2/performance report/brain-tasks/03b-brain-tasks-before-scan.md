# Brain / Tasks Feature — Pre-Fix Production Baseline Scan

Companion to `03-brain-tasks-feature-report.md` (original findings — dev-mode only, no production Lighthouse, no `/brain?id=` timeline scan). This is a from-scratch, live, logged-in session against a clean **production build** (`npm run build --webpack` + `npm run start`), following the methodology established by the Chats/Projects/Agents engagements (`../chats/01c-chats-before-after-comparison.md`, `../projects/04b-projects-before-scan.md`, `../agents/02b-agents-before-scan.md`): dev-mode Lighthouse numbers in this environment are known-inflated, so production is the only trustworthy baseline. No code changes had been made yet when the live-behavior checks in §1-§3 were taken; the Lighthouse scan in §4 and the static-analysis pass in §5 were taken immediately before the fix pass began (see `03-brain-tasks-feature-report.md` §9 for what happened next, `03d-brain-tasks-before-after-comparison.md` for the re-scan).

**Methodology:** fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD` against the real Auth0-hosted login flow, driven by a throwaway Playwright driver script kept in a local scratchpad (not committed — `playwright`/`lighthouse` installed into a throwaway scratchpad `package.json`, per the environment notes; no such packages exist in this repo's own `package.json`). The `front-end:react-doctor` skill was **not available in this session's skill list at all** (not merely blocked by policy, as in the Projects fix pass — it simply did not appear as an invokable skill this session) — findings below were re-derived from first principles: direct code reads, `grep`/`ripgrep` sweeps for the specific patterns each original finding named, and cross-checking against `eslint-plugin-react-hooks`'/React's own documented rules. Every line number below was confirmed against the current file this session, not assumed from the original report.

---

## 1. The P0 navigation bug — investigated deeply, **could not reproduce**, likely already-correct or a transient-backend artifact

The original report (`03-brain-tasks-feature-report.md` §3.2) described, "reproduced twice," that sending a task from `/brain` never updates the URL and never navigates to the task's timeline, leaving the user on an unchanged empty composer.

**This session ran the identical live test twice against the current production build and got the correct behavior both times:**

| Attempt | Task sent | URL before send | URL at t+7s | URL at t+8s |
|---|---|---|---|---|
| 1 | "List 3 colors, one word each, comma separated." | `http://localhost:3000/brain` | `http://localhost:3000/brain` | `http://localhost:3000/brain?id=b2d1107a-3e06-47ba-a6d1-37a80e707bd9` |
| 2 | same | `http://localhost:3000/brain` | `http://localhost:3000/brain?id=7cceb1ad-3e1b-4309-abf4-c82f075dc426` | (unchanged, correct) |

Both runs: the composer immediately showed the sent message as a user bubble plus a "Thinking…"-style skeleton indicator (screenshot-confirmed — see `brain-01-composer.png`/`brain-02-after-send.png` in this session's scratchpad), the browser tab title updated to the task's resolved title ("Three Colors"), the URL updated to `/brain?id=<uuid>` roughly 7-8 seconds after Enter (the time for `POST /brain/create` to return with the `X-Chat-Id` response header before the SSE stream starts playing), and the sidebar's "Recent Tasks" list highlighted the new task as active in the same frame.

**Root-caused why this works:** `brain/page.tsx`'s `runBrainStream` callback (current line ~2404) calls `startBrainChat`; when the response carries a resolved chat id, it calls `router.replace(\`${BRAIN_ROUTE}?id=${resolvedChatId}\`, { scroll: false })` at what is now line **2506** (previously line 2506 in the original audit too — this code region of the file has not shifted, unlike others). Checked git history: this `replace(...)` call is not newly added — it appears, in this same shape, across the file's history going back many commits, so it was already present when the original report's session ran. This mirrors the Chats feature's own equivalent `?id=` navigation-on-send behavior essentially exactly.

**The one real, narrower gap found in the same code path — a defensive fallback, not the main flow:** if the backend's create-response is missing the `X-Chat-Id` header (the code's own comment: `"Backend forgot to set X-Chat-Id (e.g., a misconfigured proxy stripping the header)"`), `resolvedChatId` stays falsy, `replace()` is never called, and the only feedback is `console.warn(...)` plus `toast.warning('Chat started but cannot be saved to the URL. Refreshing will lose it.')` — a transient toast, not a persistent state change. If the original report's live session hit exactly this (a `devapi.getsouvenir.com` backend flakiness class already documented repeatedly throughout this whole audit series — see e.g. `../chats/01c-chats-before-after-comparison.md`'s 502 footnotes, and the Agents engagement's own transient-502 hit during its Save-Version test), that would fully explain the original symptom: task completes correctly server-side (the stream still plays even without a header), sidebar eventually shows it via the next `/brain` list refetch, but the composer view never gets the `replace()` navigation and the only feedback (a toast) is easy to miss if it fades before the tester looks back at the screen.

**This session's own two live attempts did not hit this fallback** — both got a clean `X-Chat-Id` and navigated correctly, so the specific missing-header path could not be directly reproduced or disproven this session either. **Reclassifying this backlog item, not silently dropping it:** the core "does sending a task navigate?" question is answered — **yes, in 2/2 live production attempts this session** — but the narrower "what happens if the header is missing" question remains a real, live code path worth hardening defensively (see `03-brain-tasks-feature-report.md` §9 Phase 1 for what this pass did about it). This is the same class of finding as the Agents engagement's `rules-of-hooks` reclassification (`../agents/02b-agents-before-scan.md` §5.1 item 1) and the Projects engagement's Sidebar-link-click investigation — re-verify against live current code rather than assume the original write-up still holds, and say plainly when it doesn't.

---

## 2. The unguarded browser-global finding, `brain/page.tsx:1298` — confirmed, still present, exact line match

The file has grown/shifted substantially since the original audit (findings elsewhere in this same file no longer line up — see §3 below) — but this one specific finding lands on the *exact same line number*, coincidentally, because this section of the file was untouched by intervening commits.

Current code (before this session's fix):

```
const storedHistoryAttachments = useMemo<Record<string, UserAttachment[]>>(() => {
    if (!chatId) return {}
    try {
      const key = `brain_input_files_${chatId}`
      const stored: { userInput: string; attachments: UserAttachment[] }[] =
        JSON.parse(localStorage.getItem(key) ?? '[]')          // ← line 1298
      return Object.fromEntries(stored.map(s => [s.userInput, s.attachments]))
    } catch {
      return {}
    }
  }, [chatId])
```

**Traced exactly, not just flagged:** this `useMemo` runs during render/hook-init. On the server render pass, `localStorage` doesn't exist — the `try` throws, the `catch` swallows it, and it returns `{}`. On the client's *first* (hydration) render, `localStorage` already exists (the browser has always had it, independent of whether React has hydrated yet) — so when `chatId` is already present on first paint (the real-world case: a hard reload of `/brain?id=<uuid>` — an existing task's timeline, not the empty composer), the client's hydration-pass render computes the *real* stored attachment data while the server-rendered HTML reflects `{}`. This value feeds directly into JSX (confirmed via `grep`: used at `msgAttachments = storedHistoryAttachments[cleanInput]`, in the historical-message-rendering path), so a genuine hydration mismatch is possible whenever attachment metadata for that chat exists in `localStorage` and a hard reload lands on `/brain?id=...` — **the same bug class as the Chats feature's `chat/page.tsx:267` `selectedPersona` lazy-initializer finding**, which was fixed in commit `da89ccd2` by converting a `typeof window === 'undefined'`-guarded lazy `useState` initializer into a plain `useState(null)` + `useLayoutEffect` pair (server and first-client-render both return the same "empty" value; the effect populates the real value a tick later). **Not incidentally fixed by any prior engagement's shared-code changes** — `chat/page.tsx`'s fix touched only that file; this Brain-specific instance needed its own, separate fix, applied this pass using the identical pattern (see `03-brain-tasks-feature-report.md` §9 Phase 2).

---

## 3. The 19 clustered impure/side-effecting state-updater findings — confirmed, precisely characterized: **one repeated pattern, 9 call sites, not 19 independent bugs**

Original line range (1965-2305) has shifted (current file line numbers for this cluster, pre-fix: 1965-2306 — nearly identical, but individual sites moved a few lines from other edits elsewhere in the file). Read every SSE-event-handler case in `handleCustomEvent`/`handleStandardEvent` by hand and confirmed **exactly 9 call sites**, all sharing the identical idiom:

```
setTimeline((prev) => [...prev, { kind: 'X', id: `X-${++timelineSeqRef.current}`, ... }])
```

`++timelineSeqRef.current` — a `ref` mutation — executes *inside* the `setTimeline` updater callback. React may invoke a state-updater function more than once per commit (Strict Mode's intentional double-invoke, or under concurrent-rendering features) — when it does, this specific idiom double-increments the ref while only one of the two invocations' results is actually committed, meaning the "sequence number" silently skips values unpredictably. The 9 sites, each a distinct SSE event kind:

| # | Event kind | Line (pre-fix) |
|---|---|---|
| 1 | `permission_prompt` (`permission` timeline item) | 1968 |
| 2 | `approval_prompt` (`approval` timeline item) | 1989 |
| 3 | `web_search` | 2052 |
| 4 | `image` | 2062 |
| 5 | `generated_file` | 2076 |
| 6 | `docx_progress`/`tool_progress` (`progress` timeline item) | 2114 |
| 7 | `tool_connect_prompt` (`connect` timeline item) | 2141 |
| 8 | `content` token streaming (`text` timeline item, the merge-or-append branch) | 2256 |
| 9 | tool-call lifecycle (`tool` timeline item, first-seen guard) | 2306 |

**This confirms the original report's own hypothesis exactly** — one bad idiom, copy-pasted 9 times across every SSE event branch that appends a new timeline row, not 9-19 independently-reasoned bugs. (The original report counted 10 warnings + 9 errors = 19; this session found 9 distinct call sites — consistent with react-doctor pairing its warning-severity `no-side-effect-in-state-updater-function` and error-severity `no-impure-state-updater` rules on the same 9 sites, with one of the two rules additionally firing once more on a site this session's manual read didn't separately distinguish — `react-doctor` itself wasn't available this session to confirm the exact 9-vs-10 warning-site split; the 9 error-severity sites are the ones this pass fixed, and they account for the overwhelming majority of the cluster either way).

Fix approach (applied — see `03-brain-tasks-feature-report.md` §9 Phase 3): mint the id *before* calling `setTimeline`, so the ref mutation happens in the surrounding (impure-is-fine) callback scope, and the updater itself becomes a pure function of `prev`. For the 2 sites (`content` and the tool-lifecycle guard) where the decision of *whether* a new id is even needed depends on `prev` itself, the id is still minted unconditionally up front and simply goes unused on the branch that doesn't need it — a harmless, documented trade-off (a monotonic counter skipping a value is inconsequential when its only job is uniqueness, not contiguity).

---

## 4. `/brain/threads` and `/brain/chats` — confirmed intentional, not dead code

Traced reachability the same way the Agents engagement traced `SidebarProjectsSection` (`../agents/02b-agents-before-scan.md`'s equivalent check):

- `grep`'d the whole `src/` tree for any in-app `Link`/`router.push`/`href` reference to `/brain/threads` or `/brain/chats`, or to the `BRAIN_THREADS_ROUTE` constant that names the former — **zero live in-app navigation reaches either route.**
- Both route files are one-line `redirect(...)` stubs to `/chats?filter=tasks`, each with an explicit code comment stating why it exists ("mirrors the existing brain/chats/page.tsx redirect-stub pattern" / "was a redirect to brain/threads... pointing here directly avoids the extra hop").
- `src/lib/analytics/screens.ts` explicitly maps `/brain/threads` (and documents `/brain/chats`) to the `"brain"` analytics screen name, and has a dedicated test (`screens.test.ts`) asserting this — i.e., the app's own analytics layer is deliberately built assuming real traffic can still land on these URLs.

**Conclusion: these are intentional legacy-URL redirect stubs (old bookmarks / external deep links from before the Chats/Tasks UI merge), not leftover dead code** — confirmed, not just assumed. No removal recommended; see `03-brain-tasks-feature-report.md` §9 for how this closes out backlog item #7.

---

## 5. `brain-verify/page.tsx` — confirmed still unlinked, deleted this pass

Re-confirmed the original report's own note: the page's header comment says "Not linked anywhere... reach it at /brain-verify. Safe to delete," and a fresh `grep` this session for any reference to `/brain-verify` outside the page itself found exactly one: `src/proxy.ts`'s dev-only middleware allowlist (gating `/brain-verify` and the still-live `/reasoning-verify` harness to bypass auth, `NODE_ENV !== "production"` only). No in-app links, no route imports elsewhere. **Bonus finding while tracing this:** `proxy.ts` had the identical `if` block (same condition, same body) duplicated verbatim, back-to-back — a harmless but genuine copy-paste artifact, unrelated to Brain specifically, cleaned up in the same pass (see `03-brain-tasks-feature-report.md` §9 Phase 8).

---

## 6. Layout-property-animation findings — confirmed exact count and root cause: **4 sites × 3 keyframe props = 12**

Original report said 12 findings across "`BrainPhaseGroup.tsx`, `BrainResultHeader.tsx`, `BrainTimeline.tsx`, `PhaseRecord.tsx` +2 more." A full `grep -rn` sweep of `src/templates/Brain/*.tsx` for `height: 0`/`height: 'auto'`/`width: 0`-shaped animation keyframes found **exactly 4 files, 1 collapse/expand animation site each** — no "+2 more" files exist with this pattern; the "+2" most likely referred to the extra `initial`/`exit` keyframe lines the original report's own finding-counter also tallied per site:

| File | Site | Keyframes flagged |
|---|---|---|
| `BrainPhaseGroup.tsx` | phase-group collapse/expand | `initial`, `animate`, `exit` (3) |
| `BrainResultHeader.tsx` | result-header collapse/expand | `initial`, `animate`, `exit` (3) |
| `BrainTimeline.tsx` | tool-chip details expand | `initial`, `animate`, `exit` (3) |
| `PhaseRecord.tsx` | phase-record collapse/expand | `initial`, `animate`, `exit` (3) |

4 sites × 3 keyframe entries = **12**, matching the original count exactly. All 4 already import `{ m, AnimatePresence }` (the code-splittable, lazy-loaded form — not the uncontrolled `motion` import, which is a separate finding, §7) and animate `height: 0 → 'auto'` alongside `opacity` — a genuine layout-shifting (reflow-per-frame) cost, and in every case load-bearing (collapsing/expanding a card needs the timeline content below it to visibly reflow, ruling out a naive `transform: scaleY` swap the same way the Agents engagement found for its own width-animating panels). See `03-brain-tasks-feature-report.md` §9 Phase 4 for the fix (Framer Motion's `layout` prop, same mechanism/limitation as the Agents engagement's own equivalent fix).

---

## 7. `brain-file-extract.ts:97` — confirmed exact line match; loop iterations independent, safe to parallelize

```
for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i)     // ← line 97
    const content = await page.getTextContent()
    ...
}
```

Each iteration only reads `pdf.getPage(i)`/`page.getTextContent()` for its own page number and pushes its own extracted text — no iteration reads or depends on another iteration's result, and pdf.js's own documented API supports concurrent page/content-stream access on a single loaded document. **Confirmed independent — safe to parallelize**, unlike a scenario with a real ordering dependency (which this pass would have left alone, per the engagement's own instruction not to force a wrong fix). See `03-brain-tasks-feature-report.md` §9 Phase 5 for the applied `Promise.all` fix (order preserved by `Promise.all` itself, not by completion order).

---

## 8. The 4 uncontrolled Framer Motion imports — confirmed exact file list

`grep`'d every `.tsx` file under `src/templates/Brain/` for `from 'framer-motion'` imports naming the un-split `motion` export instead of the lazy `m` export (the pattern already established and fixed in the Agents/Projects/Chats engagements, via this app's `MotionProvider` → `LazyMotion` + `domMax`):

| File | Import (before) |
|---|---|
| `BrainProjectView.tsx` | `import { motion, AnimatePresence } from 'framer-motion'` |
| `LoopRecord.tsx` | `import { motion, AnimatePresence } from 'framer-motion'` |
| `ProjectConfigPanel.tsx` | `import { motion, AnimatePresence } from 'framer-motion'` |
| `StuckCard.tsx` | `import { motion } from 'framer-motion'` |

Exact match to the original report's file list. Confirmed the app's `MotionProvider` (`src/components/MotionProvider/index.tsx`) already wraps the tree in `<LazyMotion features={domMax}>`, so swapping these 4 files' `motion.*` JSX to `m.*` (with the matching import change) is a drop-in swap, not a behavior change — see `03-brain-tasks-feature-report.md` §9 Phase 6.

---

## 9. The 3 `label-has-associated-control` gaps — 1 real, 2 confirmed false positives

- **`brain/page.tsx` (1, real):** the tool-connect credential-form's per-field `<label style={labelStyle}>{field.label}</label>` (pre-fix line 786) has no `htmlFor`, doesn't wrap the following `<input>`, and the input itself has no `aria-label` (placeholder-only) — a genuine gap. Fixed this pass with a real `htmlFor`/`id` pairing (see `03-brain-tasks-feature-report.md` §9 Phase 9).
- **`ScheduleEditModal.tsx` (2, investigated, confirmed already-accessible — false positives, not fixed):** the "Day" (`schedule-day-label`) and "Timezone" (`schedule-timezone-label`) labels are `<label id="...">` elements with no `htmlFor` and no nested control — which is exactly the shape the `label-has-associated-control` rule flags — **but both are correctly wired via `aria-labelledby` on their actual control** (a custom `Dropdown.Float`-triggering `Button`, not a native input the rule's `htmlFor`/nesting check can see). Confirmed by reading both call sites: `<Button id="schedule-day" aria-labelledby="schedule-day-label" ...>` and the identical pattern for timezone. This is a real, working ARIA association the static rule simply isn't built to detect (it only checks native `<label>`-to-`<input>` association mechanisms) — the same class of static-analysis false positive as the Agents engagement's `rules-of-hooks`/naming-collision finding. **Left unchanged — the working code should not be "fixed" to satisfy a rule that can't see why it's already correct.**

---

## 10. Lighthouse — production, 3 runs per page, including the new `/brain?id=` timeline scan

**Pages scanned:** `/brain` (empty composer), `/brain?id=<uuid>` (an existing task's completed timeline — a page state the original report never scanned), `/brain/schedules`.

**Methodology note — a refinement on the Agents engagement's own CDP-attach caveat:** the Agents baseline (`../agents/02b-agents-before-scan.md` §4.1) found that Lighthouse's default *simulated* ("Lantern") throttling badly miscalibrates LCP/TTI when attached via CDP to an already-authenticated, externally-launched browser (~45-50s regardless of real load time). This session's driver script used `throttlingMethod: 'provided'` with all network/CPU throttling values set to zero — i.e., it skips Lantern simulation entirely and reports the trace's own directly-observed timings. **This avoids the LCP/TTI artifact altogether** (no run in this scan reported an implausible 45-50s figure) — every metric below, including LCP/TTI, is a real observed-trace number from this session, not a simulated one. This is a genuine methodology improvement worth carrying into future engagements in this series, not just a Brain-specific footnote.

| Metric | `/brain` (composer) r1 | r2 | r3 | `/brain?id=` (timeline) r1 | r2 | r3 | `/brain/schedules` r1 | r2 | r3 |
|---|---|---|---|---|---|---|---|---|---|
| Performance score | 75 | 81 | 81 | 66 | 71 | 71 | 75 | 75 | 75 |
| Accessibility score | 86 | 86 | 86 | 90 | 90 | 90 | 85 | 85 | 85 |
| Best Practices score | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 |
| SEO score | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| TBT | 0 ms | 0 ms | 0 ms | 0 ms | 0 ms | 0 ms | 0 ms | 0 ms | 0 ms |
| CLS | 0.4026 | 0.4026 | 0.4026 | 0.3889 | 0.3889 | 0.3889 | 0.3889 | 0.3889 | 0.3889 |
| FCP | 1,182 ms | 483 ms | 505 ms | 480 ms | 480 ms | 496 ms | 491 ms | 494 ms | 506 ms |
| LCP | 1,182 ms | 483 ms | 505 ms | 2,824 ms | 2,110 ms | 2,072 ms | 1,672 ms | 1,640 ms | 1,654 ms |
| TTI | 1,182 ms | 483 ms | 505 ms | 480 ms | 480 ms | 496 ms | 491 ms | 494 ms | 506 ms |
| Speed Index | 1,386 ms | 780 ms | 789 ms | 702 ms | 843 ms | 852 ms | 859 ms | 909 ms | 924 ms |
| Server response time | 5 ms | 4 ms | 4 ms | 4 ms | 4 ms | 4 ms | 3 ms | 4 ms | 4 ms |
| Total byte weight | 9,067 KB | 9,067 KB | 9,066 KB | 9,062 KB | 9,061 KB | 9,061 KB | 9,056 KB | 9,056 KB | 9,055 KB |

**Big picture vs. the original dev-mode numbers:** Performance score 66-81 in production vs. 39-43 in dev-mode — consistent with every prior engagement's own dev-vs-production gap. TBT is **0ms on every single run of every page** — a dramatic, expected improvement over dev-mode's reported 2,480ms/1,480ms, matching this whole audit series' established "dev-mode TBT is hugely inflated" precedent exactly.

**CLS is the one number that got *worse*-looking than the original dev-mode report (0.39-0.40 here vs. 0.138 there) — root-caused, not just noted:** pulled Lighthouse's own `layout-shifts`/`cls-culprits-insight` per-element breakdown (not just the summary score) on `/brain`'s run 1. **~97% of the total CLS score (0.3888 of 0.4026) is attributed to "Web font loaded"** — two `.woff2` files reflowing the main content container as they swap in — with the remaining ~3% spread across small, low-impact shifts (the "Recent Tasks" sidebar list populating, a "New Project" label). **This is not a new or Brain-specific bug.** It is the *exact same* root cause the Projects engagement already identified and root-caused app-wide (`../projects/04-projects-feature-report.md` §10 Phase 3, item 8): the app's `Besley`/`Geist`/`Geist_Mono` fonts (via `next/font/google` in `src/app/layout.tsx`) are configured with `display: "swap"`, which the Projects engagement tried changing to `"optional"` — then **explicitly reverted back to `"swap"` on request**, leaving the underlying cause "open and unfixed" by that engagement's own explicit, documented decision. Confirmed this session that `src/app/layout.tsx` still uses `display: "swap"` on all three fonts (unchanged since that revert). **No new font-display fix attempted in this Brain-specific pass** — it would re-open a decision that was already made deliberately and explicitly in a prior engagement, and any fix would need to be evaluated app-wide, not per-feature. Flagged here for completeness and honesty, exactly as instructed, rather than either quietly ignoring it or re-litigating a decision outside this feature's scope.

---

## 11. Revised backlog — closed out vs. still open, going into the fix pass

**Re-classified (not simply "fixed" or "still broken" — the investigation itself changed the picture):**
- ~~"P0: sending a task never navigates"~~ — **could not reproduce in 2/2 live production attempts this session**; the code's main path already navigates correctly (mirrors Chats). The one real remaining gap is the narrower missing-`X-Chat-Id`-header fallback, which only shows a transient toast — hardened defensively this pass (see main report §9 Phase 1) rather than left as a false "still broken."
- `/brain/threads` / `/brain/chats` — confirmed **intentional** legacy-redirect stubs (analytics-aware, explicitly commented), not leftover dead code. No removal.
- `ScheduleEditModal.tsx`'s 2 label findings — confirmed **already accessible** via `aria-labelledby`, a static-analysis false positive. No change.

**Confirmed and fixed this pass (see `03-brain-tasks-feature-report.md` §9):**
- `brain/page.tsx`'s unguarded `localStorage` read in a `useMemo` (hydration-mismatch risk).
- All 9 `timelineSeqRef` impure-state-updater call sites.
- All 4 layout-property-animation sites (`layout` prop).
- All 4 uncontrolled Framer Motion imports.
- `brain-file-extract.ts`'s sequential PDF-page-extraction loop (parallelized).
- `brain-verify/page.tsx` deleted; `proxy.ts`'s duplicated dev-harness-allowlist block collapsed.
- `PinConfirmationCard.tsx:74`'s eager `useState` initializer.
- `brain/page.tsx`'s 1 real credential-form label gap.
- One genuine, self-contained decomposition extraction (`useBrainHomeDigest`).

**Confirmed, real, and deliberately not touched this pass (out of scope / already-decided elsewhere):**
- The font-`display`-driven CLS (§10 above) — an app-wide decision already made and explicitly reverted by a prior engagement; not re-litigated here.

**Not part of this pass's required coverage, still open (lower-priority static-analysis findings not called out in the engagement's required fix list):** `no-array-index-as-key` (10×), `set-state-in-effect` (6×), `no-derived-useState`/`no-adjust-state-on-prop-change` (`ScheduleDetailView.tsx`/`ScheduleEditModal.tsx`), `no-locale-format-in-render` (3×), `no-high-complexity-react-function`/`no-giant-component` beyond the one extraction made, and the React-Compiler-blocking `todo`/`refs` findings. These remain exactly as characterized in the original report's §6 — this pass's required scope (per the engagement brief) was the P0/P1 items plus a partial decomposition pass, not an exhaustive clearing of every warning-level finding.

See `03-brain-tasks-feature-report.md` §9 for the phase-by-phase fix log, `03c-brain-tasks-fixes-test-plan.md` for per-fix test cases, `03d-brain-tasks-before-after-comparison.md` for the post-fix Lighthouse re-scan, and `03e-brain-tasks-manual-qa-checklist.md` for the hands-on click-through.
