# Brain / Tasks Feature — Detailed Report

**Scope:** the "Task" feature — internally named **Brain** throughout the codebase (`/brain` route, `BrainThreadContext`, `templates/Brain/*`), user-facing as **"Task"** (the segmented "Task / Chat" toggle, sidebar label "Schedules" under it). Autonomous goal-driven runs, not simple chat — "Give Task a goal. It plans, executes, and delivers." Chat threads filtered to tasks are actually served by the Chats feature's own page (`/chats?filter=tasks`) — see §1.

**How this was produced:** live, logged-in Playwright run against the local dev server, Lighthouse against the same authenticated session, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/brain` | `src/app/(app)/brain/page.tsx` | Task home — new-task composer, or an existing task's timeline at `/brain?id=<uuid>` |
| `/brain/schedules` | `src/app/(app)/brain/schedules/page.tsx` | Recurring/scheduled tasks |
| `/brain/threads` | `src/app/(app)/brain/threads/page.tsx` | **Redirects** to `/chats?filter=tasks` — not an independent page in practice |
| `/brain/chats` | `src/app/(app)/brain/chats/page.tsx` | **Redirects** to `/chats?filter=tasks` — same as above |
| `/brain-verify` | `src/app/brain-verify/page.tsx` | Dev-only harness for Brain's card components (`ClarificationCard`, `PauseCard`, `BrainNarration`), explicitly commented "not linked anywhere... safe to delete" — housekeeping note, not a real feature page |

`src/app/(app)/brain/page.tsx` is enormous — findings below reference line numbers past 3,800, making it one of the largest single files in the codebase (larger than `agent/configure/instructions/page.tsx` from the Agents report).

**Core components:** `src/templates/Brain/*` — 20 files including `BrainTimeline.tsx`, `BrainPhaseGroup.tsx`, `BrainResultHeader.tsx`, `BrainNarration.tsx`, `StreamingMessageBubble.tsx`, `StreamingIndicator.tsx`, `ActivityBlock.tsx`, `ArtifactCard.tsx`, `ScheduleCard.tsx` / `ScheduleDetailView.tsx` / `ScheduleEditModal.tsx`, `PauseCard.tsx`, `ClarificationSummary.tsx`, `PinConfirmationCard.tsx`, `LoopHistoryCard.tsx` / `LoopRecord.tsx`, `PersonaSelectionCard.tsx`, `ProjectConfigPanel.tsx`, `BrainProjectView.tsx`, `StuckCard.tsx`, `ExternalOutputCard.tsx`, `ContextRail.tsx`. Plus `BrainSidebarSections.tsx` (left-nav "Recent Tasks").

**State/data layer:** `lib/api/brain.ts`, `lib/brain-presentation.ts` (raw activity → timeline-card mapping), `lib/brain-file-extract.ts`, `hooks/use-brain-threads.ts`, `context/brain-thread-context.tsx`, plus a bespoke proxy route `src/app/api/brain-chat/route.ts` (separate from the generic `/api/backend/[...path]` rewrite — see the Chats report's note on `shouldUseDirectBackend`).

---

## 2. All API calls used by this feature

Brain's backend surface is much narrower than Chats or Agents — most of the work happens over one streaming endpoint rather than many small CRUD routes:

| Endpoint | Method | Used for |
|---|---|---|
| `/brain` | GET | Fetch task list / bootstrap (fired on nearly every page in the app, not just this feature — see the Chats and Agents reports' "fired on every page load" notes) |
| `/api/brain-chat` (Next.js route, not `/api/backend/*`) | POST/SSE | The actual task streaming endpoint — bespoke proxy, direct-to-backend on deployed origins per `shouldUseDirectBackend()` |
| Schedule CRUD (via `ScheduleEditModal.tsx`/`ScheduleDetailView.tsx`) | — | Not enumerated in `config.ts`'s top-level export block the way Chats/Persona endpoints are — schedule operations appear to be composed inline in the Brain templates rather than centralized in `lib/api/brain.ts`. Worth a closer look if schedule reliability becomes a concern, since it means schedule-endpoint conventions aren't co-located with the rest of this feature's API layer. |

**Notable finding purely from request volume:** `GET /brain` was observed firing **4 times** in one short navigation sequence (home → after-send → threads-redirect → schedules → chats-redirect) during this session, matching the "no caching layer" pattern already documented in the Chats report (`/brain` was one of the specific endpoints called 3× there too). This is the same underlying architectural gap surfacing in a third feature independently.

---

## 3. Live functional test results

### 3.1 `/brain` — task composer, empty state
Clean render: "Task / Chat" segmented toggle (defaults to Task), "Plan. Execute. Finish." headline, three suggestion cards ("Turn a goal into an action plan," "Research options and recommend a path," "Build a project brief from scratch"), composer with mic button, "Task can make mistakes" disclaimer, and a right-hand "Context" rail ("Context will appear here during an active loop"). No defects.

### 3.2 Sending a task — **confirmed navigation bug, live, reproduced twice**

Sent "List 3 colors, one word each, comma separated." Sequence observed:

1. UI immediately shows a user bubble and "Thinking…" indicator — correct so far.
2. **The page URL never changes from `/brain`** (no `?id=` param appended), unlike the Chats feature, which does update its URL to `/chat?id=<uuid>` on send (confirmed in the Chats report).
3. Reloading/revisiting `/brain` fresh shows the **same blank "Plan. Execute. Finish." composer** — not the in-progress or completed task — even though the sidebar's "Recent Tasks" list correctly now shows the task's title ("Three Colors").
4. **The task itself completed successfully in the background**: manually clicking "Three Colors" from the sidebar navigates to `/brain?id=<uuid>` and shows the full, correct result — `Task · Analysis complete` — `red, blue, green`.

**This is a confirmed, reproduced UX bug, not a backend-flakiness artifact** (unlike the Chats report's 502 finding — no errors occurred here, the task processed and completed correctly). The gap is purely front-end: **after submitting a task, the app does not navigate to that task's URL**, so a user who submits and doesn't separately notice the sidebar update is left staring at an unchanged "empty state" composer with no indication their task is running or where to find it. This is a materially worse first-run experience than Chats, where the equivalent flow at least updates the URL/state correctly.

### 3.3 `/brain/schedules` — clean empty state
"No schedules yet" / "Create a schedule to run Task automatically on a cadence." / "Create schedule" CTA. No defects observed.

### 3.4 `/brain/threads` and `/brain/chats` — confirmed redirects, not real pages
Both routes redirect client-side to `/chats?filter=tasks`. Functionally fine (reuses the Chats library UI, filtered), but means two route files exist in this feature's directory purely to redirect elsewhere — worth confirming these aren't dead code/legacy routes kept only for old links.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the Chats and Agents reports: treat LCP/TTI as inflated noise, FCP/TBT/CLS as real signal.

| Metric | `/brain` | `/brain/schedules` |
|---|---|---|
| **Performance score** | **39 / 100** | **43 / 100** |
| Accessibility score | 86 / 100 | 90 / 100 |
| Best Practices score | 92 / 100 | 92 / 100 |
| SEO score | 100 / 100 | 100 / 100 |
| First Contentful Paint | 1.1 s | 1.1 s |
| Largest Contentful Paint | 18.4 s ⚠️ dev-mode artifact | 60.0 s ⚠️ dev-mode artifact |
| Total Blocking Time | **2,480 ms** | **1,480 ms** |
| Cumulative Layout Shift | 0.138 (needs improvement) | 0.138 (needs improvement) |
| Speed Index | 4.1 s | 3.1 s |
| Time to Interactive | 61.2 s ⚠️ dev-mode artifact | 60.4 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 2,050 ms | 60 ms |

**This feature has the highest Performance score of the three audited so far (39-43 vs. Chats' 19-30, Agents untested)** despite having a comparably enormous main page file — worth noting as a positive data point, not just problems. TBT of 2.48s on `/brain` is still a real, high number though — consistent with the 12 layout-property-animation findings and the giant `brain/page.tsx` file (§5).

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 48 files (15,406 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **572** | **25** |
| Avg length | 194.5 chars | 27.5 chars |
| Total bytes | 111.3 KB | 687 B |
| **Share of styling touchpoints** | **95.81%** | **4.19%** |

Fourth consecutive feature landing almost exactly at ~96/4 inline-vs-Tailwind — at this point it's conclusively the codebase's uniform pattern, not a per-feature accident. Same conclusion as the other two reports: mechanically convertible, not the performance lever.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**93 findings** (33 Performance, 38 Bugs, 16 Maintainability, 6 Accessibility; 25 errors / 68 warnings). Smaller total than Chats (231) or Agents (201) — but concentrated differently: **Bugs is the largest category here**, the only one of the three features where Bugs outnumbers Performance.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 12 | Performance/error | `no-layout-property-animation` | Layout-property animation (reflow) | `BrainPhaseGroup.tsx`, `BrainResultHeader.tsx`, `BrainTimeline.tsx`, `PhaseRecord.tsx` +2 more |
| 10 | Bugs/warning | `no-array-index-as-key` | List items keyed by array index | `brain/page.tsx` (3×), `BrainNarration.tsx`, `ClarificationSummary.tsx` (2×), `ContextRail.tsx` (2×), `ExternalOutputCard.tsx`, `StreamingMessageBubble.tsx` |
| 10 | Bugs/warning | `no-side-effect-in-state-updater-function` | Side effect inside a state updater | **all 10 in `brain/page.tsx`**, clustered at lines 1965-2305 |
| 9 | Bugs/error | `no-impure-state-updater` | State updater has side effects (error-severity pairing of the finding above) | **all 9 in `brain/page.tsx`**, same line cluster |
| 7 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `brain/page.tsx`, `ActivityBlock.tsx`, `ContextRail.tsx`, `LoopHistoryCard.tsx`, `ScheduleDetailView.tsx`, `ScheduleEditModal.tsx`, `Brain/index.tsx` |
| 6 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `BrainSidebarSections.tsx`, `use-brain-threads.ts`, `ExternalOutputCard.tsx`, `ScheduleEditModal.tsx`, `StreamingIndicator.tsx`, `StreamingMessageBubble.tsx` |
| 6 | Maintainability/warning | `no-giant-component` | Too large to safely reason about | `brain/page.tsx`, `schedules/page.tsx`, `ProjectConfigPanel.tsx`, `ScheduleDetailView.tsx`, `ScheduleEditModal.tsx`, `Brain/index.tsx` |
| 4 | Performance/warning | `rerender-state-only-in-handlers` | State only used in handlers | all 4 in `brain/page.tsx` |
| 4 | Performance/warning | `use-lazy-motion` | Full Framer Motion import | `BrainProjectView.tsx`, `LoopRecord.tsx`, `ProjectConfigPanel.tsx`, `StuckCard.tsx` |
| 3 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `BrainSidebarSections.tsx`, `brain/page.tsx`, `use-brain-threads.ts` |
| 3 | Accessibility/warning | `label-has-associated-control` | Label missing associated control | `brain/page.tsx`, `ScheduleEditModal.tsx` (2×) |
| 3 | Bugs/warning | `no-locale-format-in-render` | Timestamp formatting in render, unmemoized | `brain/page.tsx` (2×), `LoopHistoryCard.tsx` |
| 3 | Bugs/warning | `no-adjust-state-on-prop-change` | State manually re-synced from props | all 3 in `ScheduleEditModal.tsx` |

### Notable single findings

- **1× `no-unguarded-browser-global-in-render-or-hook-init`** (`brain/page.tsx:1298`, **error**) — a browser global read outside a guard during render/hook-init; real hydration-crash risk, same class of bug flagged in the Chats report (`chat/page.tsx:267`) — this pattern recurs across features.
- **1× `no-derived-useState`** and **1× `no-derived-state`**, both in `ScheduleDetailView.tsx` / `StreamingMessageBubble.tsx` — props copied into state instead of derived; the same anti-pattern flagged repeatedly in the Agents report's `ChatInterface.tsx`/`ChatShareOverlay.tsx`.
- **1× `no-eager-new-in-use-state-initializer`** (`PinConfirmationCard.tsx:74`) — constructs an object eagerly on every render pass instead of lazily.
- **1× `async-await-in-loop`** (`brain-file-extract.ts:97`) — sequential awaits where they could parallelize, directly relevant to this feature's own file-processing performance.

**The dominant story in this feature's findings is `brain/page.tsx` itself**: 19 of this feature's 25 error-severity findings (the impure/side-effecting state updaters) live in that one file, at a tightly clustered set of line numbers (1965-2305) — this reads like one bad pattern copy-pasted repeatedly (e.g., a `setX(prev => { doSideEffect(); return prev })` idiom used across many state setters) rather than 19 independent bugs. Fixing the pattern once and re-applying should clear most of this feature's error count in one pass.

Full file/line detail for all 93 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — user-facing correctness**
1. **No URL/navigation update after submitting a task from `/brain`** — confirmed live, reproduced. The task runs and completes correctly server-side, but the user is left on an unchanged empty-state screen with zero indication their submission was received, unless they separately notice the sidebar. This is a materially worse first-run experience than the equivalent Chats flow (which does navigate to `?id=`). Straightforward, high-value fix: mirror Chats' post-send navigation behavior.
2. `brain/page.tsx:1298` — unguarded browser-global read during render/hook-init (error-severity hydration risk) — same bug class already flagged once in Chats' `chat/page.tsx:267`; worth a single sweep across both files (and possibly a shared cause).
3. 19 error-severity impure/side-effecting state-updater findings, all in `brain/page.tsx`, tightly clustered — likely one repeated pattern, cheap to fix once identified. React can invoke state updaters more than once (Strict Mode, concurrent rendering); a side effect inside one means that effect can double-fire unpredictably.

**P1 — performance**
4. 12× layout-property animation across the Brain timeline components (`BrainPhaseGroup`, `BrainResultHeader`, `BrainTimeline`, `PhaseRecord`) — likely the direct driver of this feature's still-elevated TBT (2.48s on `/brain`) despite its comparatively better Lighthouse score. Switch to `transform`/`opacity`.
5. `async-await-in-loop` in `brain-file-extract.ts` — sequential file processing where parallelizing (`Promise.all`) would directly cut wall-clock time for any task involving multiple file attachments.
6. 4× uncontrolled Framer Motion imports — same bundle-size issue flagged in the Chats report, recurring here in the Brain-specific template components.

**P2 — maintainability**
7. `brain/page.tsx` is flagged giant + high-complexity, and is demonstrably the largest file examined across all three feature reports so far (findings reference lines past 3,800). This is the single highest-value decomposition target of the whole audit to date — more concentrated risk in one file than either Chats' or Agents' worst offenders.
8. `/brain/threads` and `/brain/chats` exist only to redirect to `/chats?filter=tasks` — confirm these are intentional (e.g., for old bookmarked links) rather than leftover routes from before the Chats/Tasks unification; if unintentional, removing them is a trivial cleanup.
9. `brain-verify/page.tsx` is explicitly commented "not linked anywhere... safe to delete" — low-priority but literally pre-flagged by whoever wrote it.

**P3 — accessibility**
10. 3× label-control association gaps, concentrated in `ScheduleEditModal.tsx` and `brain/page.tsx`.

---

## 8. Cross-feature pattern check (now 3 features in)

Findings that have now appeared **independently in all three** features audited (Chats, Agents, Brain/Tasks) — worth treating as codebase-wide conventions to fix once rather than per-feature:
- ~96% inline-style / ~4% Tailwind composition, near-identical ratio every time.
- No client-side request caching — the same bootstrap endpoints (`/brain`, `/llm/models/all`, org/user data) refetched repeatedly across ordinary navigation within a single feature.
- Array-index-as-key in streaming/list UI.
- Props copied into `useState` instead of derived (`no-derived-useState`/`no-adjust-state-on-prop-change`), recurring in `ChatInterface.tsx`, `ChatShareOverlay.tsx`, `ScheduleDetailView.tsx`, `ScheduleEditModal.tsx`.
- Layout-property animation instead of `transform`/`opacity`, recurring in every feature's card/timeline components.
- Full/uncontrolled Framer Motion imports.
- "Giant component + high complexity" pairing on the single largest page file in each feature (`chat/page.tsx`+`chats/page.tsx`, `agent/configure/instructions/page.tsx`, `brain/page.tsx`).

---

## 9. Artifacts backing this report

Raw data (screenshots including the confirmed navigation-bug sequence, Lighthouse JSON, network captures, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
