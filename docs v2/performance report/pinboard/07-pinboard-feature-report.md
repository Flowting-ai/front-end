# Pinboard Feature — Detailed Report

**Scope:** Pinboard — the pin/highlight-and-save system layered on top of chat. Users pin messages and highlight text into folders, comment on pins, and export them. Unlike every other feature audited so far, **Pinboard has no dedicated route** — it's a panel/overlay opened from the chat right-rail (confirmed live, see §3), so it's tested as a UI surface within the Chats/Brain pages rather than as standalone pages with their own Lighthouse profile.

**How this was produced:** live, logged-in Playwright run locating and opening the Pinboard panel from `/chat`, and a static-analysis pass (`react-doctor`) filtered to this feature's files. No dedicated Lighthouse run this pass — see the note in §4.

---

## 1. Surfaces in this feature

| Surface | File | Purpose |
|---|---|---|
| Pinboard panel | `src/components/Pinboard/index.tsx` | Right-rail panel — list of pins, folders, filter/sort (opened via a rail icon on `/chat`, `/brain`, and project chat pages) |
| Pinboard expanded view | `src/components/PinboardExpanded/index.tsx` | Full-width/expanded pin browsing (**this is the single largest file in this feature** — findings reference lines past 1,500+) |
| Pinboard header | `src/components/PinboardHeader/index.tsx` | Panel header — folder switcher, search |
| Pinboard skeleton | `src/components/PinboardSkeleton/index.tsx` | Loading state |
| Individual pin | `src/components/Pin/index.tsx` | A single pinned message card — comments, tags, move-to-folder |
| Pin category / comment field / insert | `PinCategory/`, `PinCommentField/`, `PinInsert/` | Supporting pin-card subcomponents |
| Highlight card / mark / panel | `HighlightCard/`, `HighlightMark/`, `HighlightPanel/` | Text-highlight-to-pin flow — selecting text in a message and saving it as a highlight-backed pin |

**State/data layer:** `context/pinboard-context.tsx` (the source of the `[PinboardContext] Failed to load pins` error observed live in both the Chats and Projects reports), `context/highlight-context.tsx`, `lib/api/pins.ts`, `lib/export-pins.ts`.

---

## 2. All API calls used by this feature

From `src/lib/config.ts` (`/pins` block) and `src/lib/api/pins.ts`:

| Endpoint | Method | Used for |
|---|---|---|
| `/pins` | GET | List pins (confirmed live, `?search=` supported) |
| `/pins/{id}` | GET/DELETE | Single pin detail/delete |
| `/pins/message/{messageId}` | POST | Create a pin from a chat message |
| `/pins/folders/all` | GET | List all pin folders (confirmed live) |
| `/pins/folders` | POST | Create a folder |
| `/pins/folders/{id}` | GET/PATCH/DELETE | Folder detail/rename/delete |
| `/pins/{id}/folder` | POST | Move a pin to a folder |
| `/pins/{id}/tags` | POST | Update pin tags |
| `/pins/{id}/comments` | GET/POST | Pin comments |
| `/pins/{id}/comments/{commentId}` | PATCH/DELETE | Edit/delete a comment |
| `/highlights` | GET | Highlight list (`HIGHLIGHTS_ENDPOINT`) |
| `/highlights/{id}` | GET | Highlight detail |

**This feature's API surface is directly implicated in bugs already documented in two prior reports**: the Chats report's live-captured `502 /api/backend/pins/folders/all` (during the login/landing flow) and the Projects report's live-captured `[PinboardContext] Failed to load pins ApiError` (during `/projects/new`). This report is where those two previously-orphaned findings actually belong — they're Pinboard bugs surfacing on other features' pages because the Pinboard panel/context loads globally rather than only when its panel is opened.

---

## 3. Live functional test results

### 3.1 Locating the panel — confirmed
The Pinboard trigger is a small icon-only button in the chat page's floating right-rail (alongside share/agent-related icons) — not discoverable by any `aria-label` (none of the rail buttons in `RightSidebar.tsx` carry one for this specific icon; see §6 accessibility note). Located and opened successfully via direct coordinate click after enumerating candidate buttons.

### 3.2 Panel renders cleanly, empty state
With no existing pins, the panel shows: "Pinboard" header, search icon, "All pins" folder filter dropdown, filter and sort icon buttons, and — at the panel's bottom edge, outside the pin-list area — "Export" and "Organize" actions. Clean, no visual defects, no console errors beyond the recurring CSP warning.

**Confirmed live network behavior:** opening the panel fires `GET /pins` (1,339ms) and `GET /pins/folders/all` (1,282ms) on demand — i.e., pin data is *not* always eagerly fetched, contradicting what the Chats/Projects reports' error logs might imply at first glance. Worth reconciling: those two prior reports' 502s happened on page-load-time bootstrap calls to the same endpoints, meaning `pinboard-context.tsx` **does** eagerly fetch on certain page mounts (chat/project landing) independent of whether the panel is ever opened — this pass's clean fetch was additionally triggered by opening the panel on top of whatever the context had already loaded. This distinction matters for the fix in §7.

### 3.3 Bonus observation, unrelated to Pinboard
The chat composer's suggestion chips ("Write / Research / Think / Build" quick-actions, and three example prompts) differed between this run and the Chats report's earlier session ("Draft a clear email" / "Make a plan for a project" / "Summarize something I paste" here vs. different examples earlier) — confirms `lib/greetings.ts`-style example rotation is live and working as presumably intended. Not a Pinboard finding, noted for completeness since it was visible in the same screenshot.

---

## 4. Lighthouse — not run separately this pass

Because Pinboard has no dedicated route, its performance is already partially captured by the Chats report's `/chat` Lighthouse run (Performance 30/100, TBT 2,570ms, CLS 0.191) — the panel is part of that page's DOM/JS, not a separately navigable URL. A more precise measurement would require Lighthouse's user-flow mode (open the panel, then snapshot) rather than a plain page-load audit; that's a heavier setup than this pass covered. Flagging as a gap rather than fabricating a number.

---

## 5. Tailwind vs. inline-style composition — scoped to this feature

Measured directly across this feature's 17 files (8,351 LOC):

| | Inline `style={{}}` | `className=""` |
|---|---|---|
| Count | **207** | **27** |
| **Share of styling touchpoints** | **88.46%** | **11.54%** |

**This is a meaningfully different ratio than every other feature audited** — 11.5% Tailwind vs. the ~3-4% seen everywhere else, roughly 3x the codebase norm. Worth investigating why: possibly a newer feature built after some internal push toward more Tailwind usage, or simply a different author's default habits. Either way, this is the first evidence in this report series that the ~96/4 split isn't a hard technical constraint — Pinboard proves the codebase can and does use Tailwind more heavily when someone chooses to, which is a genuinely useful data point for any future migration-effort estimate.

---

## 6. Static-analysis findings (react-doctor, scoped to this feature)

**57 findings** (21 Performance, 15 Bugs, 18 Maintainability, 2 Accessibility, 1 Security; **25 errors / 32 warnings**). This feature has the **highest error-to-total ratio of any feature audited (25/57 ≈ 44%)** — proportionally the buggiest feature by this measure, despite being mid-sized.

### Highest-volume issues

| Count | Category/Severity | Rule | What it means | Where |
|---|---|---|---|---|
| 12 | Performance/error | `no-layout-property-animation` | Layout-property animation (reflow) | `HighlightPanel/index.tsx` (6×), `Pinboard/index.tsx` (3×), `PinboardExpanded/index.tsx` +2 |
| 7 | Maintainability/warning | `only-export-components` | Breaks Fast Refresh | `HighlightCard`, `Pinboard/enterAnimation.tsx` (2×), `Pinboard/index.tsx` (4×) |
| 6 | Maintainability/warning | `no-giant-component` | Too large to safely reason about | `HighlightPanel`, `Pin/index.tsx`, `Pinboard/index.tsx` (2×), `PinboardExpanded`, `pinboard-context.tsx` |
| 5 | Maintainability/warning | `no-high-complexity-react-function` | High control-flow complexity | same 5 files as above |
| 5 | Performance/error | `refs` (React Compiler can't optimize) | Ref-pattern compiler-blocking | `Pin/index.tsx` (3×), `highlight-context.tsx` (2×) |
| 4 | Bugs/warning | `motion-animate-presence-must-outlive-child` | Framer Motion `AnimatePresence` misuse | `HighlightPanel` (2×), `Pin/index.tsx`, `Pinboard/index.tsx` |
| 4 | Bugs/error | `no-ref-current-in-render` | Ref mutated during render | `Pin/index.tsx` (2×), `highlight-context.tsx` (2×) |

### Notable single/paired findings

- **2× `no-impure-state-updater`** (`pinboard-context.tsx:252,331`, **error**) — the same state-updater-purity bug class flagged heavily in the Brain report's `brain/page.tsx` (19 instances there), now confirmed in Pinboard's own context store too. Given this context is the one implicated in the cross-feature 502-driven pin-loading failures (§3.3), an impure state updater here is a plausible contributing factor to the "stuck/failed to load" symptom users would see, on top of the pure backend-latency explanation.
- **2× `no-adjust-state-on-prop-change`** (`Pin/index.tsx:701-702`) — same recurring props-into-state anti-pattern flagged in five of the six prior reports.
- **1× `dangerous-html-sink`** (`export-pins.ts:69`, Security) — dynamic content into an HTML injection sink, specifically in the pin-export code path; worth a closer look given it's the one path in this feature that produces output meant to leave the app (exported content).
- **1× `incompatible-library`** and **1× `immutability`** (both React-Compiler-blocking, `Pinboard/index.tsx:981` and `pinboard-context.tsx:206`).
- Only **2 accessibility findings total** — by far the lowest of any feature audited, though this likely reflects the feature's small surface area (a panel, not a page) rather than genuinely better accessibility discipline; the missing-`aria-label` issue noted live in §3.1 didn't register as a rule violation but is a real, observed gap.

Full file/line detail for all 57 findings is in the raw JSON generated this session (see §8).

---

## 7. Backlog — prioritized

**P0 — correctness**
1. **Reconcile the pin-loading failure pattern.** Two prior reports (Chats, Projects) independently captured live 502s specifically on `/pins` and `/pins/folders/all` during ordinary page navigation, unrelated to whether the user ever opened the Pinboard panel — meaning `pinboard-context.tsx` eagerly bootstraps pin data app-wide. Combined with the 2 confirmed impure-state-updater errors in that same file, this is now a Pinboard-owned bug, not a diffuse backend-only issue: (a) the eager, app-wide fetch means a transient backend hiccup shows a Pinboard-specific error toast on pages that have nothing to do with pins, and (b) the impure updaters mean React's double-invocation behavior (Strict Mode/concurrent features) could be compounding retry/state issues on top of the network failure. Recommend scoping the pin bootstrap fetch to when it's actually needed (panel opened, or lazily) rather than eagerly on every authenticated page load — this alone would reduce the blast radius of the backend flakiness documented elsewhere in this series.
2. `export-pins.ts:69` — HTML injection sink in the export path; worth a security-focused look given exported content is user-facing output.

**P1 — performance**
3. 12× layout-property animation, over half in `HighlightPanel/index.tsx` (6 of 12) — the concentrated fix target for this feature's animation-driven reflow cost.
4. 4× `AnimatePresence` exit-animation misuse, spread across `HighlightPanel`, `Pin`, and `Pinboard` — same bug class flagged in three prior reports, worth a shared fix pattern.

**P2 — maintainability**
5. `Pinboard/index.tsx` carries 4 of this feature's 7 `only-export-components` findings and 2 of 6 giant-component findings — the single most flagged file in this feature, consistent with it being the panel's main implementation.
6. `PinboardExpanded/index.tsx` is confirmed the largest file in the feature (findings past line 1,500) — worth a decomposition pass alongside `Pinboard/index.tsx`.

**P3 — accessibility**
7. The Pinboard trigger icon has no `aria-label` (observed live, not caught by the automated scan) — a screen-reader user has no way to identify this button's purpose. Worth adding regardless of what the static scan does or doesn't flag, since this was directly observed as a real usability gap during testing.

**Positive finding, worth preserving as a reference**
8. This feature's ~88/12 inline-style/Tailwind ratio is the best (most Tailwind-forward) of any feature audited — worth examining *why* (newer code? different author convention?) as a template for what a broader Tailwind push elsewhere in the codebase could look like, rather than starting a hypothetical migration from zero precedent.

---

## 8. Cross-feature pattern check (now 7 features in)

- `no-unguarded-browser-global-in-render-or-hook-init` remains at 5 confirmed occurrences (none new here) — still the top cross-cutting recommendation from the Settings report.
- `window.open` without `noopener` remains at 4 occurrences (none new here).
- Impure/side-effecting state updaters: previously concentrated almost entirely in Brain's `brain/page.tsx` (19 instances); now confirmed as a second, independent occurrence in `pinboard-context.tsx` — worth treating as a codebase-wide idiom problem (likely the same `setX(prev => { sideEffect(); return prev })` shape) rather than two unrelated bugs.
- Props-copied-into-state anti-pattern: 6th consecutive feature showing at least one instance.
- **New this report:** the ~96/4 inline-style/Tailwind ratio, previously treated as a hard codebase constant, is **broken here** — Pinboard sits at ~88/12, proving the pattern is a convention, not a constraint. This is the most actionable single fact for any future Tailwind-migration conversation: there's already an in-house example of what "more Tailwind" looks like in this codebase.
- **New this report:** two previously-orphaned live bug captures (Chats' `pins/folders/all` 502, Projects' `PinboardContext` failure) are now correctly attributed to this feature rather than left as unexplained noise in two other reports.

---

## 9. Artifacts backing this report

Raw data (screenshots of the located and opened Pinboard panel, network captures, full react-doctor diagnostics scoped to this feature) was generated during this session in a local scratchpad, not checked into this repo — ask if you want any of it attached here as supporting files.
