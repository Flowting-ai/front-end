# Agents Feature — Pre-Fix Production Baseline Scan

Companion to `02-agents-feature-report.md` (original findings — dev-mode-only, no seeded agent, no Lighthouse). This is a from-scratch, live, logged-in session against a clean **production build** (`npm run build --webpack` + `npm run start`), following the methodology established in the Chats engagement (`../chats/01c-chats-before-after-comparison.md`) and reused by the Projects engagement (`../projects/04b-projects-before-scan.md`): dev-mode Lighthouse numbers in this environment are known-inflated, so production is the only trustworthy baseline. No code changes had been made yet when this scan was taken — this is the **pre-fix** baseline; see `02-agents-feature-report.md` §9 for the fixes made afterward and `02d-agents-before-after-comparison.md` for the re-scan.

**Methodology:** fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD` against a real Auth0-hosted login flow, driven by a throwaway Playwright driver script kept in a local scratchpad (not committed — `npx playwright`/`npx lighthouse` per the environment notes, no `playwright`/`lighthouse` packages in `package.json`). Static analysis via the `front-end:react-doctor` skill — **it worked in this environment this session** (unlike the Projects engagement's fix pass, which hit a Windows Application Control block; no such block occurred here, so this report uses live tool output throughout, not first-principles re-derivation).

---

## 1. The hydration-race bug on "Start blank" — reproduced, root-caused, with real numbers

The original report characterized this qualitatively (clicking immediately vs. after ~3s). This pass reproduced it quantitatively, against the production build, using two methods:

**Method 1 — realistic click timing, unthrottled.** Using Playwright's own actionability-checked click (waits for the element to be visible, then clicks), 3 immediate attempts and 2 attempts after a 3s wait were run against `/agents/templates`'s "Start blank" button. **All 5 attempts navigated successfully** — 0/5 reproduced the bug on an unthrottled machine. This matters: it means the race is real but the window is narrow enough that a normal-speed click (even one issued the instant the button becomes visible) usually loses the race against React's own hydration completing first, on typical modern hardware with nothing else competing for the CPU.

**Method 2 — CPU-throttled, raw-DOM click fired the instant the button exists.** Using Chrome DevTools Protocol's `Emulation.setCPUThrottlingRate` to simulate a slower device (6x), combined with a `requestAnimationFrame`-polled `document.querySelectorAll` that dispatches a native `MouseEvent('click')` the millisecond the button node exists in the DOM (bypassing Playwright's own actionability wait, which itself adds latency that could mask the race) — **the bug reproduced 3 of 8 times (37.5%)**:

| Attempt | CPU throttle | Button found at | Navigated? |
|---|---|---|---|
| t6-0 | 6x | 190.9 ms | Yes |
| t6-1 | 6x | 157.8 ms | Yes |
| t6-2 | 6x | 158.8 ms | **No** |
| t6-3 | 6x | 1.2 ms | **No** |
| t6-4 | 6x | 160.6 ms | Yes |
| t6-5 | 6x | 157.4 ms | Yes |
| t6-6 | 6x | 1.6 ms | **No** |
| t6-7 | 6x | 162.5 ms | Yes |

**Root cause, traced not guessed:** `CustomCard`/`TemplateCard` in `src/app/(app)/agents/templates/page.tsx` are plain client-rendered `<button onClick={...}>` elements with no special hydration handling — this is a completely ordinary React client component, no different in kind from any other button in the app. The mechanism is the one the original report hypothesized: the static/server-rendered HTML paints before React's `hydrateRoot()` call has finished downloading, parsing, and executing the client JS bundle and attaching the button's `onClick` listener. A click landing in that window is not queued or replayed — the DOM node exists but has no listener yet, so the click is silently lost. The two clicks that failed at "found at 1.2ms/1.6ms" (i.e., essentially the instant the raw HTML painted, before any client JS had plausibly run at all) support this directly; the mixed results in the ~157-190ms band are consistent with hydration completing partway through that window on some runs and not others.

**This is not Agents-specific** — it is a property of any plain client-rendered button on a page whose JS bundle takes long enough to parse/execute, on a slow enough device. The original report's own suspicion ("worth checking whether other wizard primary-action buttons... share the same susceptibility") is correct in kind, though this pass only fixed and verified this specific page (see §9 of the main report).

---

## 2. Seeding a real agent — wizard completed successfully, no API fallback needed

Unlike the original report's session (which ran out of time before ever producing a persisted agent), this pass completed the full wizard end-to-end on the first clean attempt, waiting out the hydration window between steps (per §1's findings, this is the reliable way to click "Start blank"):

1. **Template step** — "Start blank", clicked after a 3s settle wait. Navigated correctly.
2. **Purpose step** — filled a free-text description, Continue.
3. **Name step** — filled "QA Test Agent", Continue. The next step's heading correctly interpolated the name ("How should QA Test Agent sound?").
4. **Tone step** — tone options load asynchronously (a `personaStarter` API call); the four tone cards (fetched from the API, not the page's own `FALLBACK_TONES` — labels observed: options replacing skeleton placeholders after the fetch resolved) rendered correctly once that resolved. Selected the first option, clicked Continue — this is the step that calls `createPersonaRepo` and actually persists the agent.
5. **Landed on `/agent/configure/instructions?repoId=cbde73d7-b4f4-4df3-9fac-5289e41c557a`** — a real repo ID, confirming persistence.
6. **Confirmed against the source of truth:** navigated to `/agents` afterward — **"QA Test Agent" is present in the list.**

No fallback to a direct `POST /persona/starter` API call was needed — the wizard itself worked reliably once the hydration timing was respected. This resolves the original report's §3.3/§7 backlog item #15 ("still unverified — needs a follow-up pass with a seeded agent").

---

## 3. Configure-tab editor and agent chat — all reachable, all render cleanly

With a real agent now seeded, every route the original report's session never reached was visited directly (production build, authenticated session):

| Page | Result |
|---|---|
| `/agents` (populated) | Loads cleanly, "QA Test Agent" card renders with avatar, name, description. Zero console errors beyond the recurring CSP/Facebook-pixel warning seen on every page across every report in this whole audit series. |
| `/agents/templates` | Loads cleanly. |
| `/agent/configure/profile?repoId=...` | Renders Avatar/Name/Handle/Description/Tags, "Page Contents" side rail, traffic-light dots for all 5 tabs (screenshot-confirmed). |
| `/agent/configure/instructions?repoId=...` | Renders Model picker, System Instruction editor pre-filled with the agent's actual prompt, Page Contents rail (Model/Instructions/Creativity/Examples). |
| `/agent/configure/knowledge?repoId=...` | Renders "Add knowledge to your Agent" empty state, upload dropzone, "0 files / 0 MB / 300 MB" quota bar. |
| `/agent/configure/connectors?repoId=...` | Renders Connectors search + "No connectors are available yet" empty state with a "Go to Connectors" CTA. |
| `/agent/configure/sharing?repoId=...` | Renders Super Link toggle and Email Invite form (address field + credit-limit field + Send invite). |
| `/agents/{repoId}/chat` | Renders the agent's own chat shell — avatar, name, description, composer pre-filled with "Message QA Test Agent…", Advanced/Edit buttons. |
| `/agents/published` | Loads cleanly (no published agents yet from this test account). |

**No new live defects observed** beyond what's already in the static-analysis backlog below. This closes out the original report's single biggest gap (§3.3: "still not reached").

---

## 4. Lighthouse — production, 3 runs per page

**Pages scanned:** `/agents` (populated), `/agents/templates`, `/agent/configure/profile` (most representative configure tab — Profile is the first tab and structurally similar to the other 4), `/agents/{repoId}/chat`.

### 4.1 Methodology caveat — read before the table

Lighthouse was driven via a Playwright-launched, persistently-authenticated Chromium instance attached over the Chrome DevTools Protocol (`--remote-debugging-port`), since there is no `playwright`/`lighthouse` install in this repo and Auth0's hosted login needs a real browser session — the same general approach as the Chats/Projects engagements, adapted for Agents' Auth0 flow specifically. Doing this surfaced a **new methodology artifact, investigated and root-caused, not previously seen in the Chats/Projects reports**: **Largest Contentful Paint and Time to Interactive are unreliable in this specific setup** — both consistently report ~45-50 **seconds** (!) on every page, including `/chat`, a totally unrelated page used only as a cross-check.

This was traced, not just noticed: Lighthouse's own `lcp-breakdown-insight` audit (which reports the *observed*, real trace data) shows the actual LCP element rendered in ~550ms on `/agents` — completely inconsistent with the ~46s the headline `largest-contentful-paint` audit reports for the same run. The headline LCP/TTI numbers in Lighthouse's default "simulate" throttling mode are **Lantern-simulated** (a predictive model calibrated from the trace, not a direct observation), and that calibration appears to break specifically when Lighthouse attaches via CDP to a browser it did not itself launch — main-thread activity is confirmed quiet by ~6s and network activity by ~15s in the same trace that reports a 46s LCP. Switching to real (`--throttling-method=devtools`) throttling was attempted as a cross-check but fails outright in this headless setup with `NO_FCP` (a documented Lighthouse-plus-headless-Chrome incompatibility, unrelated to the app). Attempting to let Lighthouse launch and authenticate its own fresh Chrome (copying the login profile) also failed — the copied profile didn't carry the Auth0 session cookie into a chrome-launcher-spawned process, redirecting every scan to the login page instead of the app.

**Bottom line: LCP, TTI, and the aggregate Performance score (which is heavily LCP-weighted) are not trustworthy numbers in this session and are reported for completeness only, explicitly flagged.** TBT, CLS, FCP, Speed Index, server-response-time, total byte weight, and the Accessibility/Best-Practices/SEO category scores are all **observed-trace metrics**, unaffected by this artifact, and are the numbers this report actually draws conclusions from — matching this whole audit series' established practice of never presenting a known-distorted number as if it were trustworthy (dev-mode TBT/CLS for Chats and Projects; this LCP/TTI artifact is the Agents engagement's own version of that same discipline).

### 4.2 The numbers, in full

| Metric | `/agents` run1 | run2 | run3 | `/agents/templates` run1 | run2 | run3 | `/agent/configure/profile` run1 | run2 | run3 | `/agents/{id}/chat` run1 | run2 | run3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Performance score ⚠️ | 41 | 40 | 56 | 79 | 66 | 73 | 58 | 51 | 60 | 57 | 59 | 59 |
| Accessibility score | 84 | 84 | 84 | 87 | 87 | 87 | 81 | 81 | 81 | 88 | 88 | 88 |
| Best Practices score | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 | 92 |
| SEO score | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| TBT | 527 ms | 518 ms | 582 ms | 527 ms | 490 ms | 478 ms | 530 ms | 647 ms | 435 ms | 593 ms | 531 ms | 516 ms |
| CLS | 0.357 | 0.380 | 0.022 | 0.007 | 0.007 | 0.007 | 0.0002 | 0.059 | 0.0002 | 0.007 | 0.039 | 0.039 |
| FCP | 1.5 s | 0.9 s | 1.7 s | 1.1 s | 1.7 s | 1.1 s | 1.4 s | 1.4 s | 1.5 s | 1.1 s | 1.5 s | 1.5 s |
| Speed Index | 4.7 s | 4.7 s | 4.7 s | 3.5 s | 3.6 s | 3.4 s | 4.8 s | 6.9 s | 4.9 s | 4.3 s | 4.3 s | 4.4 s |
| Server response time | 5 ms | 4 ms | 4 ms | 6 ms | 4 ms | 5 ms | 5 ms | **1,893 ms*** | 4 ms | 14 ms | 34 ms | 11 ms |
| Total page weight | 9,180 KB | 9,180 KB | 9,179 KB | 9,145 KB | 9,140 KB | 9,142 KB | 9,231 KB | 9,232 KB | 9,227 KB | 9,197 KB | 9,206 KB | 9,197 KB |
| LCP ⚠️ unreliable | 45.9 s | 45.5 s | 45.9 s | 3.2 s | 5.4 s | 4.2 s | 48.5 s | 47.9 s | 48.6 s | 49.9 s | 50.1 s | 48.7 s |
| TTI ⚠️ unreliable | 49.8 s | 49.8 s | 49.8 s | 49.5 s | 49.5 s | 49.6 s | 50.0 s | 50.0 s | 50.0 s | 50.4 s | 50.5 s | 49.9 s |

*`/agent/configure/profile` run 2's 1,893ms server-response spike is the same cold-path/backend-latency artifact documented extensively throughout this whole audit series (e.g. `../chats/01c-chats-before-after-comparison.md` §4 footnote) — runs 1 and 3 (both ~5ms) are the trustworthy read.

### 4.3 What the trustworthy metrics actually show

- **TBT is consistently in the 430-650ms band on every page** — comparable to Projects' post-baseline numbers (`../projects/04b-projects-before-scan.md`: 418-483ms) and meaningfully better than Chats' own production numbers. No page stands out as anomalous.
- **CLS is the standout finding, and it's page-dependent, not feature-wide:** `/agents` shows real, non-trivial CLS (0.022-0.380, one run touching "poor" territory) while `/agents/templates`, `/agent/configure/profile`, and `/agents/{id}/chat` are all consistently near-zero (0.0002-0.059). This is a concrete, traceable signal — `/agents`' CLS is worth root-causing in the fix pass (candidate cause: the persona list/card grid populating after an async fetch, similar in kind to Projects' own "loading skeleton doesn't reserve the right space" finding).
- **Total page weight (~9.1-9.2MB) is consistent with the other three features audited** (Chats ~8.9MB, Projects ~8.9-9.1MB) — not a new finding, confirms the codebase-wide bundle-size baseline.
- **Accessibility scores (81-88) are lower on `/agent/configure/profile` (81) than the other three pages (84-88)** — consistent with the configure tabs carrying more of this feature's accessibility backlog (the `control-has-associated-label`/`no-placeholder-only-field` findings below are concentrated there).

---

## 5. Static-analysis re-scan (react-doctor — live this session, not blocked)

Unlike the Projects engagement's fix pass (blocked by a Windows Application Control policy — see `../projects/04-projects-feature-report.md` §10's intro), **`react-doctor` ran successfully this session**, so every number below is live tool output, not a first-principles re-derivation.

Scoped to the same two directory trees as the original report's file set allows (`src/app/(app)/agents` and `src/app/(app)/agent`) — note this is a narrower scope than the original report's 38-file/201-finding count, which also pulled in shared files outside these two trees (`lib/api/personas.ts`, `PersonaChatInterface.tsx`, etc. — not re-scanned here since they're shared with Chats and outside this pass's fix budget):

| Scope | Score | Findings | Breakdown |
|---|---|---|---|
| `src/app/(app)/agents` (12 files) | 35/100 Critical | 30 | 5 Accessibility, 7 Maintainability, 4 errors + 3 warnings Performance, 1 Security, 3 errors + 7 warnings Bugs |
| `src/app/(app)/agent` (16 files) | 0/100 Critical | 138 | 26 Maintainability, 56 errors + 15 warnings Performance, 10 errors + 15 warnings Bugs, 15 Accessibility, 1 Security |

### 5.1 P0 items re-verified against live/current code

1. **3× `rules-of-hooks` (conditional hook call), `agents/page.tsx:1007,1024,1054` — confirmed still present, exact same line numbers as the original report.** But investigated further than the original report had time for: **this is a false positive from a naming collision, not a real conditional-hook bug.** All three call sites invoke `usePersonaRepoDeduped` — a plain `async function` in `lib/api/personas.ts` (POST `/persona/{repoId}/use`, copies a persona into the caller's account), never a React hook. `eslint-plugin-react-hooks`' `rules-of-hooks` rule treats *any* identifier matching `/^use[A-Z]/` as a hook call site regardless of whether it actually is one — and all three call sites are, correctly, inside `try` blocks in async event handlers (`handleCopyAndEdit`, `handleUseTeamSharedInChat`, `handleUseReceivedShareInChat`), which is exactly what trips the "called conditionally" heuristic for something merely *named* like a hook. Confirmed this was already a known nuisance in the codebase — `hooks/use-persona-repos.ts:39` carried a defensive comment explicitly warning future readers about the naming collision, before any fix was made this session. See `02-agents-feature-report.md` §9 for the fix (rename, not suppress).
2. **`agent/configure/context.tsx` — 7× side-effect-in-state-updater + 4× impure-state-updater — confirmed, precisely 4 locations, not spread across the file as the original report's summary implied.** Live line numbers: `toggleTestChat` (523), `toggleAiSuggest` (531), `toggleVersions` (535) — each calls sibling `setState` functions *from inside* another state updater's callback — plus `addPendingChangeTag` (944/947) — writes to `pendingChangeTagsRef.current` from inside `_setPendingChangeTags`'s updater callback. All 4 are genuine instances of the anti-pattern (a `setState` updater must be a pure function of `prev`; these call other setters or write refs as side effects, which React may invoke more than once per commit under Strict Mode/concurrent rendering). Nothing else in the file's ~30 other `prev =>` updater callbacks trips this — confirmed by cross-referencing react-doctor's own line list against a full manual read of the file (e.g. `markFieldTouched`/`resetTouchedFields`'s `new Set(prev).add(...)`/`.delete(...)` calls are pure — they mutate a *freshly constructed* Set, never `prev` itself).
3. **2× `no-create-object-url-without-revoke` — confirmed, both real, but with a nuance the original report didn't have time to trace:** `KnowledgeTab.tsx`'s instance is in a "local-state-only fallback" code path (`if (onRawFilesSelected) { ...; return }` — the only real call site always passes `onRawFilesSelected`, so this path is dead code today, not a live leak). `knowledge/page.tsx`'s instance (`fileUrlMapRef`) **is live and real** — blob URLs created once per uploaded file, kept for preview, never revoked on delete or on unmounting the Knowledge tab.
4. **1× `no-fetch-response-used-without-status-check`, `knowledge/page.tsx:356` — confirmed, exact line match.**

### 5.2 P1 items re-verified, with corrected current counts

5. **`agent/configure/instructions/page.tsx` — 16 of 20 `refs` findings (not 14 of 24 as the original report measured)** — the file has changed since the original pass, and the finding count is *more* concentrated in this file proportionally (80% vs. the original's 58%), not less. Traced to a **single dominant root cause**, not 16 independent issues: `savedSnapshotRef.current` (a ref holding the last-saved instruction/model/temperature) is read directly in the render body to compute `isDirty` — a value that must itself be render-reactive (it gates the Save/Publish buttons and the tab traffic-light dots). Reading a ref's `.current` during render is unsafe under concurrent rendering and is what the compiler's `refs` diagnostic exists to catch; the taint then propagates through every value and effect downstream of `isDirty` (accounting for the bulk of the 16). The remaining 2 of the file's 6 `no-ref-current-in-render` findings are separate: `instructionAutoSaveRef.current = ...` and `instructionContinueRef.current = ...` are assigned directly in the render body rather than in an effect.
6. **9× `no-layout-property-animation`, all in `agent/configure/layout.tsx` — confirmed, exact match.** All 3 instances are Framer Motion `<m.div>` panels (Versions/Test-chat/AI-suggestions) animating `width` — a genuine reflow-per-frame cost, not a false positive; the tool's own suggestion text explicitly names the fix (`transform`/`scale`, "or use the `layout` prop").
7. **27× compiler-blocking `todo` findings (the original report said 30 across a wider file scope) — investigated, and this is a genuine tool/compiler limitation, not a bug.** Pulled the tool's own diagnostic detail (not available from the summary table alone): every one of these 27 findings has the identical suggestion text `Todo: (BuildHIR::lowerStatement) Handle TryStatement with a finalizer ('finally') clause` — the React Compiler, as of the version this tool bundles, cannot yet parse `try { } finally { }` blocks (with or without an accompanying `catch`) inside component/hook bodies at all. `try/finally` is completely idiomatic, safe JavaScript (the standard "always run this cleanup" pattern, e.g. `try { setLoading(true); await x() } finally { setLoading(false) }`) — rewriting 27 of these across the feature to dodge a compiler parser gap would mean either duplicating cleanup logic across every branch (strictly worse code) or removing safety-net cleanup entirely. This is the same class of finding as this whole audit series' repeated "the tool doesn't measure/understand what's actually there" pattern (dev-mode Lighthouse artifacts, Lighthouse's missing `nested-interactive` audit in the Projects report) — reported plainly rather than force-"fixed."

### 5.3 P2/P3 items re-verified

8. **Every configure-tab page + component pair still flagged giant + high-complexity** — 10 files in `agent/configure`'s `no-giant-component`/`no-high-complexity-react-function` lists, unchanged pattern from the original report.
9. **10× placeholder-as-label + 5× missing control labels — confirmed, precise current locations captured** (see `02-agents-feature-report.md` §9 for the full fix list — all 15 fixed this pass).

---

## 6. Revised backlog — closed out vs. still open, going into the fix pass

**Closed out by this scan (no code changes yet — these are re-classifications, not fixes):**
- ~~"Configure editor unreached" (original §3.3, §7 item 15)~~ — reached, all 5 tabs + chat confirmed working live (§3 above).
- ~~"No Lighthouse run" (original §4)~~ — 4 pages × 3 runs, production, done (§4 above) — with the LCP/TTI methodology caveat as a new, honestly-reported limitation of its own.
- The 3× `rules-of-hooks` finding is **downgraded from "highest-severity finding in the whole report" to "real but a naming-only false positive"** — still worth fixing (confusing to readers, trips a real lint rule for no functional reason), but not the correctness emergency the original report's framing suggested. Fixed via rename in the same session — see `02-agents-feature-report.md` §9.

**Still open, unchanged from the original report, now with live current line numbers (see `02-agents-feature-report.md` §9 for what got fixed):**
- `context.tsx`'s 4 impure/side-effecting state updaters.
- The 2 `createObjectURL` leaks + 1 fetch-without-status-check.
- The hydration-race bug itself (confirmed real, root-caused, with a scoped fix applied — see main report).
- `instructions/page.tsx`'s `refs` cluster (root-caused to one dominant cause).
- `layout.tsx`'s 9 layout-property animations.
- The `todo` compiler-blocking findings (investigated, confirmed a tool limitation not a bug).
- Giant/high-complexity configure-tab files.
- 15 accessibility label findings.
- The wizard step-tracker sub-step gap and the deep-link guard gap (UX, not from static analysis — both re-confirmed live this session).

See `02-agents-feature-report.md` §9 for the phase-by-phase account of what happened to each of these, `02c-agents-fixes-test-plan.md` for per-fix test cases, `02d-agents-before-after-comparison.md` for the post-fix Lighthouse re-scan, and `02e-agents-manual-qa-checklist.md` for the hands-on click-through.
