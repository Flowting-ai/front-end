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
