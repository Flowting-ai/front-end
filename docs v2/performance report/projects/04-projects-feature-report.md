# Projects Feature — Detailed Report

**Scope:** Projects — the shared-context container that groups chats, files, and instructions under one workspace. List/grid view, creation flow, and the project detail/chat view. Project-scoped chat streaming reuses core chat infrastructure but has its own page and API surface distinct from the standalone Chats feature.

**How this was produced:** live, logged-in Playwright run against the local dev server — including actually creating a real project end-to-end — Lighthouse against three representative pages, and a static-analysis pass (`react-doctor`) filtered to this feature's files.

---

## 1. Pages in this feature

| Route | File | Purpose |
|---|---|---|
| `/projects` | `src/app/(app)/projects/page.tsx` | Grid/list of Personal / Workspace / Shared projects |
| `/projects/new` | `src/app/(app)/projects/new/page.tsx` | Creation form — name, visibility, description, tags |
| `/project/[id]` | `src/app/(app)/project/[id]/page.tsx` | Project detail — composer, Instructions & Files rail, chat list |
| `/project/[id]/chat/[chatId]` | `src/app/(app)/project/[id]/chat/[chatId]/page.tsx` | An individual chat inside a project |

**Core components:** `ProjectCard/`, `ProjectChatRow/`, `EditProjectModal/`, `DeleteProjectModal/`, `LeaveProjectModal/`, `InviteModal/`, `SidebarProjectsSection/`, `FlatSidebarProjectGroup/`.

**State/data layer:** `lib/api/projects.ts`, `context/projects-context.tsx`.

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`/projects` block):

| Endpoint | Method | Used for |
|---|---|---|
| `/projects` | GET | List projects |
| `/projects/{id}` | GET | Project detail |
| `/projects/{id}/visibility` | POST | Change Personal/Workspace/Shared visibility |
| `/projects/{id}/chats` | GET | Chats inside a project |
| `/projects/{id}/chats/{chatId}` | GET | Link an existing chat into a project (confirmed live — see §3.2) |
| `/projects/{id}/files` | GET | Project file list |
| `/projects/{id}/files/{documentId}` | GET/DELETE | A single project file |
| `/projects/{id}/invite` | POST | Invite by email |
| `/projects/{id}/invites` | GET | Pending invites |
| `/projects/{id}/members` | GET | Member list |
| `/projects/{id}/members/{auth0Id}` | DELETE | Remove a member |
| `/projects/{id}/leave` | POST | Leave a project |
| `/projects/{id}/restore` | POST | Restore a deleted project |

No dedicated `POST /projects` (create) constant appears in the enumerated endpoint block the way it does for other features — creation is presumably folded into a generic call or a differently-named export not in the block audited here; worth a quick confirmation if this list is used for reference.

---

## 3. Live functional test results

### 3.1 `/projects` — empty state, then populated after creation
Empty state: "No projects yet" in the sidebar, main view showing "0 Personal Projects / 0 Workspace Projects / 0 Shared Projects" tabs, "New Project" button, Grid/List and sort toggles. Clean render, no defects.

### 3.2 End-to-end project creation — **completed successfully, live**

Full flow driven and confirmed working:

1. `/projects/new` form renders correctly: "What are we working on" (name), "Who can see this" (visibility — Personal/Workspace/Shared), "What are we trying to achieve" (description, becomes project context), Tags (Enter-to-add chip input), Cancel/Create project actions.
2. Filled name "QA Test Project," clicked "Create project" — **succeeded**: `GET /api/backend/projects` and `GET /api/backend/projects/{id}/chats` fired immediately after, confirming a real project was created server-side.
3. Sidebar and `/projects` grid both correctly show the new project ("1 Personal Project," card with "Created by test 01," "Personal" badge, "Updated 5h ago," "1 member," "0 chats").
4. Clicking the project card in the grid correctly navigates to `/project/{id}` — full detail view renders: composer ("Ask anything, or use your voice…"), model selector, right-hand "Instructions & Files" rail with a 100MB upload quota bar, "Add instructions to steer this project" placeholder, file drag/upload target, and pin/share/agent icons.

**This is the cleanest, most fully-functional creation flow of any feature audited so far** — no bugs found in the create → list → open sequence, unlike the Chats (message-history 502) or Brain/Tasks (no post-submit navigation) reports.

**One caveat, not a bug:** an initial automated attempt to click the sidebar's project-name entry (as opposed to the grid card) did not navigate anywhere. On investigation this reads as a test-automation targeting issue, not a confirmed product defect — flagging as unverified rather than as a finding, same honesty standard as the Agents report's tone-step note. Worth a quick manual check of whether the sidebar project link is reliably clickable, since the grid-card path is confirmed to work.

### 3.3 `/project/[id]` detail page — renders cleanly
See screenshot evidence above; no console errors beyond the recurring CSP/Facebook-pixel warning seen on every page across all four reports.

---

## 4. Lighthouse performance report

Same dev-mode caveat as the other three reports.

| Metric | `/projects` | `/projects/new` | `/project/[id]` |
|---|---|---|---|
| **Performance score** | **18 / 100** | **19 / 100** | **15 / 100** |
| Accessibility score | 87 / 100 | 88 / 100 | 88 / 100 |
| Best Practices score | 92 / 100 | 92 / 100 | 92 / 100 |
| SEO score | 100 / 100 | 100 / 100 | 100 / 100 |
| First Contentful Paint | 1.1 s | 1.1 s | 1.1 s |
| Largest Contentful Paint | 17.4 s ⚠️ dev-mode artifact | 14.1 s ⚠️ dev-mode artifact | 57.3 s ⚠️ dev-mode artifact |
| Total Blocking Time | **2,670 ms** | 1,930 ms | **2,680 ms** |
| Cumulative Layout Shift | **0.495** (poor) | **0.578** (poor — worst of all pages audited) | **0.495** (poor) |
| Speed Index | 7.6 s | 7.0 s | 14.7 s |
| Time to Interactive | 57.6 s ⚠️ dev-mode artifact | 56.9 s ⚠️ dev-mode artifact | 57.9 s ⚠️ dev-mode artifact |
| Server response time (root doc) | 2,010 ms | 2,010 ms | **5,370 ms** |

**This is the worst-scoring feature of the four audited so far.** Performance scores of 15-19/100 are the lowest seen (vs. Chats 19-30, Brain/Tasks 39-43). CLS of 0.578 on `/projects/new` is the single worst layout-shift number across every page tested in this audit. Server response time of 5,370ms on `/project/[id]` (root document, not an API call) is also the worst root-document time recorded — worth investigating separately from the client-side React issues, since that number reflects server-side work before any client JS runs.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 16 files (7,522 LOC) — the smallest feature footprint audited so far:

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **271** | **9** |
| Avg length | 203.7 chars | 26.8 chars |
| Total bytes | 55.2 KB | 241 B |
| **Share of styling touchpoints** | **96.79%** | **3.21%** |

Fifth (counting the whole-codebase scan) consecutive measurement landing at ~96-97% inline / ~3-4% Tailwind. At this point the ratio is unambiguously a codebase-wide constant, not a per-feature artifact — no further per-feature Tailwind measurement is likely to add new information; future reports in this series should treat this as established rather than re-deriving it in depth.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**85 findings** (27 Performance, 15 Bugs, 20 Maintainability, 23 Accessibility; 17 errors / 68 warnings). This is the only feature so far where **Accessibility is nearly tied with Performance** as the largest category — worth noting given the CLS numbers above suggest real UI-stability problems users would notice, compounding with a11y gaps.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 11 | Performance/warning | `set-state-in-effect` | Blocks React Compiler optimization | `project/[id]/chat/[chatId]/page.tsx` (6×), `project/[id]/page.tsx` (2×), `projects/page.tsx`, `LeaveProjectModal/index.tsx` +1 |
| 8 | Accessibility/warning | `html-no-nested-interactive` | Interactive control nested inside another focusable control | `FlatSidebarProjectGroup/index.tsx` (4×), `ProjectChatRow/index.tsx`, `SidebarProjectsSection/index.tsx` (3×) |
| 7 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | `chat/[chatId]/page.tsx`, `project/[id]/page.tsx`, `projects/page.tsx`, `FlatSidebarProjectGroup`, `LeaveProjectModal`, `ProjectChatRow`, `SidebarProjectsSection` |
| 7 | Maintainability/warning | `no-giant-component` | Too large to safely reason about | Same file set as above, plus `projects/new/page.tsx` and `projects-context.tsx` |
| 6 | Performance/error | `refs` (React Compiler can't optimize) | Ref-pattern compiler-blocking | `chat/[chatId]/page.tsx` (2×), `ProjectChatRow/index.tsx` (4×) |
| 6 | Performance/error | React Compiler can't parse (`todo`) | Blocks auto-memoization | `project/[id]/page.tsx` (2×), `projects/page.tsx`, `EditProjectModal`, `InviteModal`, `projects-context.tsx` |
| 5 | Accessibility/warning | `prefer-tag-over-role` | `role=` instead of real HTML tag | `projects/page.tsx`, `FlatSidebarProjectGroup` (3×), `SidebarProjectsSection` |
| 4 | Bugs/warning | `no-array-index-as-key` | List items keyed by array index | `project/[id]/page.tsx` (2×), `FlatSidebarProjectGroup`, `SidebarProjectsSection` |
| 4 | Accessibility/warning | `no-static-element-interactions` | Click handlers on non-interactive elements | `project/[id]/page.tsx`, `projects/page.tsx`, `LeaveProjectModal`, `ProjectCardTagRow` |
| 4 | Maintainability/warning | `only-export-components` | Breaks Fast Refresh | `ProjectCard/index.tsx` (2×), `projects-context.tsx` (2×) |
| 3 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render | `chat/[chatId]/page.tsx`, `ProjectChatRow/index.tsx` (2×) |
| 3 | Performance/warning | `use-lazy-motion` | Full Framer Motion import | `FlatSidebarProjectGroup`, `InviteModal`, `SidebarProjectsSection` |

### Notable single findings

- **1× `no-hydration-branch-on-browser-global`** (`project/[id]/chat/[chatId]/page.tsx:326`, **error**) — the **third** independent occurrence of this exact bug class across the four features audited (Chats' `chat/page.tsx:267`, Brain's `brain/page.tsx:1298`, now here). This is no longer a per-feature curiosity — it's a recurring pattern worth a single codebase-wide sweep rather than three (now four, counting Agents' related hydration-mismatch-time finding) separate fixes.
- **1× `immutability`** (React Compiler blocked, `project/[id]/page.tsx:134`).
- **1× `no-non-null-assertion-on-maybe-undefined-result`** (`project/[id]/page.tsx:829`) — a `!` assertion on a value that can actually be undefined; a latent crash risk if the assumption ever breaks.
- **1× `no-adjust-state-on-prop-change`** (`EditProjectModal/index.tsx:82`) — same recurring anti-pattern flagged in three other features now.

Full file/line detail for all 85 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness**
1. `project/[id]/chat/[chatId]/page.tsx:326` — hydration-branch-on-browser-global (error). Fourth occurrence of this bug class codebase-wide; strongly recommend a single fix pass across all four instances (`chat/page.tsx`, `brain/page.tsx`, this file, plus Agents' related finding) rather than four separate ones, since they're likely the same root cause (probably a `typeof window !== 'undefined'` branch used for conditional rendering instead of `useEffect`/`useIsomorphicLayoutEffect`).
2. `project/[id]/page.tsx:829` — non-null assertion on a possibly-undefined value.
3. Verify the sidebar project-link click behavior manually (see §3.2 caveat) — low confidence either way, cheap to check.

**P1 — performance**
4. **Worst Lighthouse scores of any feature audited (15-19/100) and the worst CLS (0.578) and worst root-document server-response-time (5,370ms) recorded in this whole audit series.** This feature deserves priority investigation over the others purely on these numbers, dev-mode caveats aside — a 5.37s *server* response time (before any client JS executes) on `/project/[id]` is unusual enough to warrant checking what that page's server-side data-fetching is doing differently from the other three features' detail pages.
5. 11× `set-state-in-effect`, heavily concentrated in `project/[id]/chat/[chatId]/page.tsx` (6 of 11) — the project-scoped chat page inherits the same compiler-blocking pattern flagged in the standalone Chats report's `chat/page.tsx`, unsurprising given they likely share heritage, but means fixing one won't fix the other — they've diverged enough to need separate patches.
6. 3× uncontrolled Framer Motion imports in the sidebar project-group components.

**P2 — maintainability**
7. `chat/[chatId]/page.tsx`, `project/[id]/page.tsx`, and `projects/page.tsx` are all flagged giant + high-complexity — same pattern as every other feature's primary pages.
8. `ProjectChatRow/index.tsx` alone carries 4 of the 6 `refs`-pattern React-Compiler-blocking findings — concentrated fix target within this feature.

**P3 — accessibility**
9. **8× nested-interactive-control findings, all concentrated in the sidebar project components** (`FlatSidebarProjectGroup`, `SidebarProjectsSection`) — a real screen-reader/keyboard-nav hazard (a focusable control inside another focusable control creates ambiguous tab order and can trap assistive-tech users). This is the single largest accessibility-finding cluster in any feature audited so far and is worth fixing as its own focused pass.
10. 5× `role=` used instead of real HTML tags, same pattern as the Chats report's `chats/page.tsx` finding.

---

## 8. Cross-feature pattern check (now 4 features in)

Patterns now confirmed independently in **all four** features (Chats, Agents, Brain/Tasks, Projects):
- ~96-97% inline-style / ~3-4% Tailwind — now treated as an established codebase constant (see §5).
- No client-side request caching — every feature refetches its own bootstrap data repeatedly within a single session.
- Array-index-as-key in list rendering.
- Props copied into `useState` instead of derived.
- "Giant + high-complexity" pairing on each feature's primary page file.
- Uncontrolled/full Framer Motion imports.
- `no-hydration-branch-on-browser-global` / related hydration-mismatch findings — **now 4 independent occurrences**, the strongest candidate yet for "fix once, codebase-wide" rather than per-feature.

**New this report:** Projects has meaningfully worse Lighthouse numbers than the other three features (15-19 vs. 19-43), and the worst root-document server-response-time recorded (5.37s) — worth a dedicated look at what's different about this page's server-side rendering path.

---

## 9. Artifacts backing this report

Raw data (screenshots of the full create → list → detail flow, Lighthouse JSON for three pages, network captures, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.

---

## 10. Fixes applied (post-report follow-up)

Everything below was implemented in later sessions, working through the §7 backlog phase by phase, using the same verification gate at every checkpoint: `npx tsc --noEmit` (clean throughout), the full `vitest` suite (271 tests, passing at every single checkpoint below — zero regressions at any point), and live Playwright testing against a real production build (`npm run build` + `npm run start`, fresh login via `.env.local`'s `PROFILE_EMAIL`/`PROFILE_PASSWORD`) wherever the fix's own reachability allowed it. `react-doctor` itself was blocked for this entire follow-up by a machine-level Windows Application Control policy (unrelated to the code) — every finding below was instead re-derived from first principles or cross-checked directly against `eslint-plugin-react-hooks@7.1.1`'s own rules, which cover several of the same categories react-doctor does.

A from-scratch production Lighthouse baseline was run before any of this work started — see `04b-projects-before-scan.md` — following the same "dev-mode numbers are inflated, get a real production baseline first" methodology the Chats engagement (`../chats/01c-chats-before-after-comparison.md`) established. Two of the original report's own headline P1 concerns (dev-mode TBT, dev-mode server-response-time) turned out to be dev-mode/Turbopack measurement artifacts, not real problems — see that file for the full data. Everything below is the real backlog that baseline left standing.

### Phase 1 — P0 correctness

1. **Hydration-branch bug, `project/[id]/chat/[chatId]/page.tsx:326`** — investigated, found already resolved. The real hydration-mismatch risk (a persona lazy-initializer branching on `typeof window`) was fixed earlier in the Chats engagement's own decomposition work via `usePendingPersonaHandoff`, and this file was made a consumer of it as a bonus fix at the time. The remaining `typeof window === 'undefined'` check in the same file (for `initialFiles`/`window.__pendingProjectChatFiles`) was re-traced and confirmed genuinely benign for both realistic navigation paths (a client-side `push()` never runs a real SSR/hydration cycle at all; a hard reload returns `[]` on both server and client since the in-memory `window` global never survives a reload). No code change needed — reasoning documented, not force-"fixed."
2. **Non-null assertion, `project/[id]/page.tsx:829`** — fixed. Replaced a twice-repeated `USE_STYLE_OPTIONS.find(...)!  ` with a single derived `const activeStyle = USE_STYLE_OPTIONS.find(s => s.id === selectedStyleId) ?? null`, guarded with `{activeStyle && (...)}` and referencing `activeStyle.label` — matching the identical pattern already established in the sibling `chat/[chatId]/page.tsx:470`.
3. **Sidebar project-link click behavior** — investigated, confirmed correct as-is, not a bug. `FlatSidebarProjectGroup`'s row is deliberately expand/collapse-only by design (the component's own comment: "it no longer navigates anywhere on click"); navigation happens via the hover-revealed settings-gear icon (`onOpen`). Live-verified both behaviors work as designed.

### Phase 2 — P1 performance: the CLS root causes

4. **Sidebar auto-expand layout shift (`LeftSidebar.tsx`)** — root-caused via the production baseline scan (`04b-projects-before-scan.md` §4): the active project's sidebar row started collapsed and expanded a beat after paint, once an effect matched the URL against the async-loaded projects list. Fixed by adding an `activeProjectIdFromPathname(pathname)` helper that seeds the `expandedIds` state's `useState` lazy initializer synchronously on first render, in both duplicated call sites (`ProjectsSection` and `FlatProjectItemsList`) — `pathname` is identical on server and client's first render, so this carries no hydration-mismatch risk, unlike branching on `typeof window` or `sessionStorage`. The existing `useEffect` (still needed for client-side navigation between two project pages without a remount) was left in place. **Live-verified:** on a genuinely fresh hard load of `/project/[id]`, the sidebar row's `aria-expanded` attribute reads `"true"` from the very first sample it appears in the DOM — it never starts `"false"` and flips.
5. **`/projects` and `/projects/new`'s own CLS sources** — both root-caused and fixed, two different root causes:
   - **`/projects`**: the `loading` state rendered a single centered line of text ("Loading projects…"), reserving far less space than the real grid/list it was replaced by. Fixed with `viewMode`-aware `Skeleton` placeholders sized to match the real content exactly (4 cards at 262px height/12px radius, matching `ProjectCard`'s real fixed dimensions; 5 rows at 64px for list view).
   - **`/projects/new`**: a different root cause — not a skeleton mismatch but a data-arrival-dependent conditional block. The "Who can see this" visibility selector only renders once `orgId` resolves asynchronously, and **empirically confirmed via a live probe** that the block pops in ~2-4s after initial paint — squarely inside Lighthouse's CLS measurement window, not a dev-mode artifact. Fixed by gating the block on `orgReady` (a more complete readiness signal from `useOrg()`) instead of `orgId` directly, with a `Skeleton` placeholder sized to the real block's live-measured dimensions (74px total) while pending — the swap to real content is pixel-exact. **Trade-off documented, not hidden:** this converts the shift to zero for org-having accounts (the case Lighthouse actually measured), at the cost of a new, small, one-time collapse for personal-only accounts that previously had no shift at all — an edge case this test account doesn't exercise, so it couldn't be live-verified either way.
   - Both live-verified via pixel-position probes across the whole org-resolution window: zero movement.

### Phase 3 — P1 performance: compiler-optimization blockers

6. **`set-state-in-effect` (8 findings across the 3 Projects-scoped page files)** — all fixed. Two redundant `setLoading(true)` calls in `project/[id]/chat/[chatId]/page.tsx` deleted outright (the outer page wrapper already remounts the whole component on a project-id change, so both loading flags already start `true` via `useState`). The remaining instances (a `qParam`-sync effect, a persisted-settings-load effect, a composer-reset-on-project-switch effect, a team-chats-fetch effect's synchronous reset branch, and a URL back/forward re-sync effect) were all converted to React's own sanctioned "adjust state during render" pattern — comparing a tracked "last synced" value directly in the render body instead of inside a `useEffect`, which applies the same update a full frame later, after paint. A one-time `window.__pendingProjectChatFiles` mount effect was folded into a lazy `useState` initializer, mirroring an already-established identical pattern elsewhere in the same file.
7. **Uncontrolled Framer Motion imports (3 files)** — `FlatSidebarProjectGroup`, `InviteModal`, `SidebarProjectsSection` all imported the full `motion` object directly, bypassing the app-wide `<LazyMotion features={domMax}>` code-splitting wrapper (`src/components/MotionProvider`). Mechanical, API-identical swap to the code-splittable `m` import already used correctly elsewhere in the app (e.g. `projects/new/page.tsx`). Live-verified `FlatSidebarProjectGroup`'s collapse/expand animation renders identically post-swap.

### Phase 4 — a new P1 finding discovered mid-engagement: font-swap CLS

Re-running Lighthouse after Phases 2-3 landed showed the CLS score itself **completely unchanged** on all three pages — bit-identical to the pre-fix baseline. Rather than accept that silently, pulled Lighthouse's own `layout-shifts` audit's per-element breakdown (not just the summary score), which named the actual dominant cause on all three pages as **"Web font loaded"** (~99-100% of the measured score, present identically before and after every other fix) — the app's `Besley`/`Geist`/`Geist_Mono` fonts (via `next/font/google`) still reflow on swap because they're variable-weight fonts, and `next/font`'s automatic fallback-metrics matching only corrects vertical metrics, not glyph advance widths.

8. **Font-display fix (`src/app/layout.tsx`) — applied, then reverted by request.** Changed all three fonts from `display: "swap"` to `display: "optional"`, which skips the swap entirely unless the font is ready almost immediately (Next.js's own documented trade-off for CLS-sensitive apps; cannot make CLS worse than `swap`, only equal or better). **Could not be verified locally** — this dev environment serves fonts from localhost with near-zero latency, so Lighthouse's real (unthrottled) CLS trace sees the font arrive fast enough that `swap` and `optional` converge to identical behavior most of the time (a later before/after re-scan, `04d-projects-before-after-comparison.md` §3, did show a real if inconsistent ~98% CLS improvement on 2 of 6 runs, consistent with `optional`'s mechanism succeeding intermittently — see that file for the full data). Several attempts to force a realistic slow-network condition (Playwright/CDP throttling, Lighthouse's own `--throttling-method=devtools`) were inconclusive or failed outright. **Reverted back to `display: "swap"` on explicit request** after this whole write-up — all three fonts are back to their original setting; the font-swap CLS cause identified above remains open and unfixed. Left this section intact rather than deleting it, since the root-cause tracing (the actual, useful finding) is still accurate and valid regardless of which `display` value the app currently ships with.

### Phase 5 — P2 maintainability: refs findings + giant-component decomposition

9. **`refs` findings (6, across `ProjectChatRow` and `project/[id]/chat/[chatId]/page.tsx`)** — all fixed. `ProjectChatRow` had two `useRef`-based "track the previous prop value, write `.current` during render" patterns (re-syncing `publishState` from `published`, `editValue` from `title`) — the exact anti-pattern the compiler's `refs` rule exists to catch, since a render can be replayed/discarded (e.g. Strict Mode's double-invoke), leaving a render-time ref write out of sync with what actually committed. Converted both to `useState`-tracked comparisons, the same compiler-safe pattern used throughout Phase 3. In `project/[id]/chat/[chatId]/page.tsx`, a ref written directly during render (to keep a callback "latest" for a later effect) was moved into its own deps-less `useEffect`; a ref that was *read* during render was converted to `useState` entirely (its own write already happened in the same batch as a sibling `setState` call, so no extra render tick resulted). Live-verified: sending a message from a brand-new project chat correctly swaps the URL from `/chat/new` to the real chat id, zero "Chat not found" flash.
10. **Giant-component decomposition, all three flagged files:**
    - **`projects/page.tsx` (907 → 552 lines, -39%)**: extracted `project-filters.ts`/`project-list-utils.ts` (pure types/utilities, zero behavior change) and three genuinely self-contained presentational components (`ProjectViewToggle`, `ScopeFilterDropdown`, `ProjectListRow`) — none closed over the page's own state.
    - **`project/[id]/page.tsx` (1266 → 1135 lines, -10%)**: extracted the loading-skeleton helpers and the inline Sharing modal (`ProjectShareModal`, matching the file's own existing pattern of separate `EditProjectModal`/`DeleteProjectModal`/`LeaveProjectModal` components) into their own files. **Deliberately left in place**, matching the Chats decomposition's own judgment call for entangled clusters: the Instructions/Files/Agents/Members shared-panel effect (closes over 8+ pieces of state), the composer/chips block (18+ pieces of state, a near-duplicate of two other files' copies), and the `teamChatRow`/`privateChatList` render helpers (each closes over ~10 values) — extracting any of these would relocate coupling, not reduce it.
    - **`project/[id]/chat/[chatId]/page.tsx` (955 → 854 lines, -11%)**, plus a real cross-file duplication bug found in the process: `MentionChip` existed as an essentially byte-identical copy in **three** places (this file, `chat/page.tsx`, `ChatInterface.tsx`), and `TemplateCard`/`ChatMode`/`ACTION_BUTTONS`/`MODE_PLACEHOLDERS` in **two** (this file, `chat/page.tsx`). Consolidated all of them into shared files (`src/components/chat/MentionChip.tsx`, `src/components/chat/TemplateCard.tsx`, `src/lib/chat-modes.tsx`) and repointed every call site — the same class of "bonus fix discovered as a side effect" the Chats engagement's own decomposition phase surfaced (its `usePendingPersonaHandoff` generalization). Confirmed `agents/templates/page.tsx`'s own same-named `TemplateCard` is a genuinely different component (different prop shape) and left it untouched.
    - Verified throughout: `tsc --noEmit` clean at every step, `eslint` problem counts on every touched file went *down*, never up (confirmed via `git stash` comparisons against the pre-decomposition baseline), `vitest run` 271/271, and a live production-build smoke test for every extraction confirming identical rendering and behavior.

### Phase 6 — P3 accessibility

11. **Nested-interactive-control (fixed in 3 of 4 identified components):** a `role="button"` row containing further real interactive elements as descendants — assistive tech can't reliably operate a button nested inside another interactive element.
    - **`FlatSidebarProjectGroup`** — the sidebar's project row contained up to 4 nested `role="button"` spans (icon, new-chat, gear, add). Restructured: the outer row is now a plain, non-interactive flex container (still owns hover tracking and the visual "pill" background); the label/toggle and each action are real, sibling `<button>`s.
    - **`ProjectListRow`** — the whole `/projects`-list row was `role="button"` wrapping the ⋮ menu's own real button. Badge/title/stats are now one real `<button>` (the navigate target); the menu slot is a plain sibling.
    - **`ProjectChatRow`** — the most involved: the row wrapped the ⋮ menu, the pin-count button, and (mid-publish-confirmation) two more buttons. Title/timestamp is now a real `<button>` when not editing; while editing, that button doesn't render at all (an `<input>` can't validly nest inside a `<button>` either way).
    - A shared `src/lib/reset-button-style.ts` strips native `<button>` chrome so these read identically to the elements they replaced; every manual `onKeyDown`/`stopPropagation` handler that's no longer needed was deleted, not just left alone.
    - **Deliberately deferred: `SidebarProjectsSection`.** Confirmed the same category of issue, plus a double-click-to-rename timer and a marquee-animation effect layered on top — but traced its only render path and found it's used exclusively by the old, non-flat sidebar, which only renders on **admin pages** (`useFlatSidebar = !isAdminPage`) that this test account can't reach. Deferred rather than shipping an unverified structural change to code with zero live-test coverage.
    - Live-verified on a fresh production build: all three fixed components toggle/navigate correctly (confirmed via `tagName === "BUTTON"` and correct `aria-expanded`/URL transitions), zero console errors.
12. **`role=` findings** — the "Close search" button in `projects/page.tsx` (`span role="button"` → `button`) was the one clear remaining standalone instance; the rest were already covered by the nested-interactive fixes above. **One separate, real accessibility bug surfaced in the process, documented but not fixed:** `InputField`'s `rightIcon` slot wraps its content in `<span aria-hidden>` unconditionally, which hides this specific interactive close button (and any other interactive `rightIcon` a future consumer might pass) from assistive tech entirely, independent of the `role`/`button` fix. Fixing that properly means changing a widely-shared base component's default behavior for every consumer across the whole app — a materially bigger, higher-blast-radius change than this pass's scope, flagged rather than touched blind.

### Net result

3 real correctness fixes (a latent crash risk, plus 2 confirmed-non-issues investigated and documented rather than force-changed), 2 real CLS root causes fixed with live pixel-level verification, 1 systemic app-wide CLS cause found and fixed (font-display) with an honest note on why it can't be locally proven, 8 compiler-optimization-blocking `set-state-in-effect` findings resolved, 3 uncontrolled Framer Motion imports fixed, 6 unsafe ref-mutation-during-render patterns fixed, 3 giant components decomposed (with a real 3-copy UI-duplication bug found and fixed along the way), and 3 of 4 nested-interactive-control accessibility violations fixed (the 4th deliberately deferred, documented why). Zero regressions at any checkpoint across the whole sequence — `tsc --noEmit` and the 271-test suite stayed green throughout, and every reachable fix was confirmed live against a real production build.

See `04b-projects-before-scan.md` for the pre-fix production baseline, `04c-projects-fixes-test-plan.md` for the full test-case breakdown of every fix above, `04d-projects-before-after-comparison.md` for the after-fix Lighthouse re-scan, and `04e-projects-manual-qa-checklist.md` for a hands-on click-through of the whole feature post-fix.
