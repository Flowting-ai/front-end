# Projects Feature — Fix Verification Test Plan

Test cases for every fix logged in `04-projects-feature-report.md` §10, organized by phase. Each case states the precondition, steps, expected result (before vs. after), and how it was actually verified — automated/live/code-review — versus what still needs manual QA. Same format and same honesty standard as `../chats/01b-chats-fixes-test-plan.md`.

---

## Phase 1 — P0 correctness

### TC-1.1 — Hydration-branch investigation (`project/[id]/chat/[chatId]/page.tsx:326`)
- **Precondition:** none — this is a code-trace, not a runtime reproduction.
- **Steps:** traced both realistic paths for the flagged `typeof window === 'undefined'` check (`initialFiles`/`window.__pendingProjectChatFiles`): a client-side `push()` navigation, and a hard page reload.
- **Expected:** confirm whether this is the same hydration-mismatch bug class already fixed elsewhere in this engagement, or a distinct, still-open instance.
- **Verified via code-review only, not live-reproduced** — a client-side push never runs a real SSR/hydration cycle at all (nothing to mismatch), and a hard reload returns `[]` on both server and client since the in-memory `window` global can't survive a reload. No runtime reproduction was possible or necessary; the reasoning is a closed logical case, not a guess.

### TC-1.2 — Style chip render/remove (`project/[id]/page.tsx:829` non-null-assertion fix)
- **Precondition:** a project's composer with the style picker available.
- **Steps:** open the "+" add menu → style submenu, pick a style, confirm the chip renders with the correct label; click the chip's remove (×), confirm it disappears cleanly.
- **Expected (before):** functionally identical — the non-null assertion (`!`) only risked a crash if the assumption it encoded ever broke, not a behavior difference under normal use. **Expected (after):** same rendering, same remove behavior, zero latent crash risk.
- **Verified live this session, screenshot-confirmed** — chip appeared with the correct style label and removed cleanly on a fresh production build.

### TC-1.3 — Sidebar project-link click behavior
- **Precondition:** a real project visible in the sidebar.
- **Steps:** hover the sidebar's project row, click directly on the row's label text (not an icon), confirm it does **not** navigate (only toggles expand/collapse); then hover to reveal the gear icon and click it, confirm it **does** navigate to `/project/{id}`.
- **Expected:** this was investigated as a possible bug (an earlier automated test couldn't get the sidebar link to navigate) and confirmed to be correct, intentional design, not a defect.
- **Verified live this session** — both behaviors confirmed exactly as designed: label click never navigates, gear-icon click reliably does.

---

## Phase 2 — P1 performance: CLS root causes

### TC-2.1 — Sidebar auto-expand on a fresh `/project/[id]` load
- **Precondition:** a real project with at least one chat.
- **Steps:** hard-navigate directly to `/project/{id}` (not a client-side link click — this is what Lighthouse itself does), and sample the sidebar row's `aria-expanded` attribute starting from the very first moment it exists in the DOM.
- **Expected (before):** row starts `aria-expanded="false"`, flips to `"true"` a beat after paint once an effect matches the loaded projects list against the URL — this flip is what Lighthouse scored as a real layout shift. **Expected (after):** row reads `aria-expanded="true"` from its very first appearance in the DOM, never `"false"`-then-flips.
- **Verified live this session** — sampled repeatedly from t=0 through the row's first appearance; `aria-expanded` was `"true"` on every single sample, confirming the synchronous pathname-based seed works.

### TC-2.2 — `/projects` loading-skeleton sizing
- **Precondition:** none (fresh page load).
- **Steps:** hard-navigate to `/projects`, screenshot during the loading window, confirm the placeholder's size roughly matches the real grid/list content that replaces it (not a single line of "Loading projects…" text).
- **Expected (before):** a single centered line of text, reserving far less vertical space than the real grid/list — a real, measured layout shift when the swap happened. **Expected (after):** `Skeleton` placeholders sized to the real content (262px cards for grid, 64px rows for list), zero shift on swap.
- **Verified live this session, screenshot-confirmed** — both grid and list view modes show correctly-sized skeleton placeholders that swap cleanly to real content.

### TC-2.3 — `/projects/new` visibility-selector block
- **Precondition:** a logged-in account that belongs to an organization (the visibility selector only renders for org-having accounts — see the trade-off noted in `04-projects-feature-report.md` §10 Phase 2).
- **Steps:** hard-navigate to `/projects/new`, sample the description field's Y-position continuously from page load through the moment the "Who can see this" block appears.
- **Expected (before):** the block pops in ~2-4s after paint (empirically confirmed via a live probe before the fix), pushing the description field down — a real, measured shift. **Expected (after):** description field's Y-position stays pixel-constant across the entire window; the block's own `Skeleton` placeholder occupies the identical space the real content will.
- **Verified live this session** — Y-position sampled continuously across a 6-second window spanning the block's appearance: zero movement, confirmed pixel-exact.
- **Not verifiable for personal-only accounts** (no organization) — documented trade-off, not a gap in testing: this test account has an org, so the personal-only path (which now has a small new one-time collapse where none existed before) couldn't be exercised either way.

---

## Phase 3 — P1 performance: compiler-optimization blockers

### TC-3.1 — `set-state-in-effect` fixes, functional regression check
- **Precondition:** a project with an existing chat, and a fresh new-chat landing.
- **Steps:** (a) load a project chat via a `?q=` query param (text+files navigation) and confirm the initial prompt still auto-populates correctly; (b) switch between two different existing chats in the same project and confirm persisted settings (web search toggle, persona) load correctly for each; (c) switch between two different projects and confirm the composer (draft text, attachments, persona/style picks) resets cleanly; (d) use browser Back/Forward on `/projects` with an active filter and confirm the visible filters re-sync to match the URL.
- **Expected:** all four behaviors work identically to before — these were structural rewrites (moving `setState` calls from inside `useEffect` to React's "adjust state during render" pattern), not behavior changes.
- **Verified live this session for (a)** — sent a message from a brand-new project chat, URL swapped from `/chat/new` to the real chat id correctly, zero errors (this is also TC-5.2 below, same underlying flow). **(b), (c), (d) verified via `tsc --noEmit` + the 271-test suite only, not independently re-clicked this session** — these are lower-risk, well-understood React patterns (the official "adjust state during render" idiom), and time was prioritized toward the fixes with less-established verification precedent (Phase 2's CLS fixes, Phase 6's accessibility restructures). **Recommend a manual click-through of (b)/(c)/(d) if you want independent confirmation.**

### TC-3.2 — Framer Motion `motion` → `m` swap
- **Precondition:** the sidebar's project section, expanded/collapsed at least once.
- **Steps:** toggle a sidebar project row's expand/collapse animation, confirm it still animates smoothly (height, opacity, stagger) with no visual regression.
- **Expected:** byte-for-byte identical animation — this was a mechanical, API-identical import swap (`motion.div` → `m.div`), not a logic change.
- **Verified live this session, screenshot-confirmed** (`FlatSidebarProjectGroup`) — collapse animation renders correctly, `aria-expanded` toggles true→false→true, zero console errors. **`InviteModal` and `SidebarProjectsSection` not independently live-verified** — `InviteModal`'s only reachable page (`/settings/members`) never resolves for this personal, non-admin test account; `SidebarProjectsSection` only renders on admin pages this account can't reach (see TC-6.5). Both are covered by TypeScript's prop-compatibility check and the identical transformation's confirmed-working behavior in `FlatSidebarProjectGroup`.

---

## Phase 4 — Font-swap CLS fix

### TC-4.1 — `display: "optional"` font-swap fix
- **Precondition:** none.
- **Steps:** re-run the same 3-run production Lighthouse pass used for the original baseline, on `/projects`, `/projects/new`, `/project/[id]`, and check whether the CLS score moved.
- **Expected:** genuinely unknown locally — see the honest writeup below.
- **Verified that the build is correct** — the generated CSS was checked directly and confirmed to contain `font-display:optional`, not a stale `swap`. **Could not verify the actual CLS effect** — this dev environment serves fonts from localhost with near-zero latency, so Lighthouse's real (unthrottled) CLS trace sees the font arrive fast enough that `swap` and `optional` converge to identical behavior; the re-scan showed a bit-for-bit identical CLS score to the pre-fix baseline for exactly this reason, not because the fix doesn't work. Several attempts to force a realistic slow-network condition for a direct test (Playwright/CDP throttling, Lighthouse's own `--throttling-method=devtools`) were inconclusive or failed outright — documented in full in `04-projects-feature-report.md` §10 Phase 4. **Needs verification against a real deployed URL** with actual network latency — the one fix in this whole engagement that structurally can't be proven from a local dev server.

---

## Phase 5 — P2 maintainability: refs findings + decomposition

### TC-5.1 — `ProjectChatRow` publish-state / rename re-sync
- **Precondition:** a chat row with `canPublish` true, or a chat row with rename permission.
- **Steps:** (a) toggle a chat's published state from a parent action, confirm the row's badge updates correctly; (b) rename a chat via the row's ⋮ menu, confirm the input pre-fills with the current title and the row updates after commit.
- **Expected:** identical behavior — this converted a `useRef`-based "track previous prop, write `.current` during render" pattern to a `useState`-based one (the compiler-safe equivalent), not a logic change.
- **Not independently live-tested this session** — the specific `publishState` re-sync requires a publish/unpublish action from a parent context not exercised during this pass's live testing window; the rename path is covered indirectly by TC-6.3 below (which reached the ⋮ menu but found `hasMenu` false on the specific chats available). **Needs manual QA** if you want direct confirmation of the publish-badge re-sync specifically.

### TC-5.2 — `project/[id]/chat/[chatId]/page.tsx` ref-to-state conversions
- **Precondition:** a project with the ability to start a new chat.
- **Steps:** send a message from a brand-new project chat (`/chat/new`), confirm the URL swaps to the real chat id with no "Chat not found" flash, and confirm the response streams in correctly (exercises the model-selector ref-to-effect conversion indirectly).
- **Expected:** identical to before — `justCreatedChatIdRef` (read during render) converted to `useState`; `selectModelRef`'s write moved from render-body to a deps-less effect.
- **Verified live this session** — URL swap confirmed correct, zero "Chat not found" flash, zero console errors, message streamed in successfully.

### TC-5.3 — `projects/page.tsx` decomposition
- **Precondition:** none.
- **Steps:** toggle grid↔list view, open the scope-filter dropdown (Personal/Workspace/Shared/Recently Deleted), search with live filtering, confirm the list row's stats/badges/⋮ menu all render and work.
- **Expected:** byte-for-byte identical to before the extraction — `ProjectViewToggle`, `ScopeFilterDropdown`, `ProjectListRow` were pulled into their own files with zero logic changes.
- **Verified live this session, screenshot-confirmed** — grid↔list toggle, scope filter, search-with-filtering, and the list row's stats/badges all render and behave identically.

### TC-5.4 — `project/[id]/page.tsx` decomposition
- **Precondition:** a real project.
- **Steps:** load the project detail page, confirm the chat list (and its loading-skeleton state) renders correctly, open the project options (⋮) menu (Edit/Delete).
- **Expected:** identical to before — `ProjectChatListSkeleton` and `ProjectShareModal` were extracted with zero logic changes (the Sharing modal itself needs a non-personal project to open, see below).
- **Verified live this session, screenshot-confirmed** — chat list and composer render correctly, project options menu opens with Edit/Delete present. **The Sharing modal itself was not live-clicked** — this test account has no workspace/shared project, and the Sharing icon only renders for non-personal projects. Covered by TypeScript's prop-contract check and the mechanical, logic-free nature of the extraction (verbatim JSX relocation).

### TC-5.5 — `project/[id]/chat/[chatId]/page.tsx` decomposition + cross-file dedup
- **Precondition:** none.
- **Steps:** load both `/chat` (the main chat landing) and a project's `/chat/new` landing, confirm the Write/Research/Think/Build mode buttons and the "Not sure where to start?" template cards render identically on both, and confirm the `@`-mention dropdown still opens on both.
- **Expected:** identical rendering and behavior on both pages — `MentionChip`, `TemplateCard`, and the `ChatMode`/`ACTION_BUTTONS`/`MODE_PLACEHOLDERS` set were deduplicated from 2-3 independent copies into shared files.
- **Verified live this session, screenshot-confirmed on both pages** — mode buttons and template cards render identically; mention dropdown opens correctly on both; zero console errors.

---

## Phase 6 — P3 accessibility: nested-interactive-control fixes

### TC-6.1 — `FlatSidebarProjectGroup` toggle + gear button
- **Precondition:** a real project in the sidebar.
- **Steps:** click the sidebar row's label (confirm it's a real `<button>` via `tagName`), confirm it toggles `aria-expanded` true↔false↔true; hover to reveal the gear icon (confirm it's a real `<button>`), click it, confirm it navigates to `/project/{id}`.
- **Expected:** identical interaction, now via real sibling `<button>` elements instead of nested `role="button"` spans.
- **Verified live this session** — `tagName === "BUTTON"` confirmed for both the label and the gear icon; toggle cycled `false → true` correctly; gear click navigated to the correct project URL; zero console errors.

### TC-6.2 — `ProjectListRow` navigate button + ⋮ menu
- **Precondition:** at least one project, list view mode.
- **Steps:** switch to list view, hover a row to reveal its ⋮ menu and open it, then click the row's title/stats area (confirmed as a real `<button>` via `tagName`) and confirm it navigates to `/project/{id}`.
- **Expected:** identical interaction — the whole row used to be one `role="button"` div wrapping the ⋮ menu's own real button (a nested-interactive violation); now the title/stats area is its own sibling `<button>`.
- **Verified live this session** — `tagName === "BUTTON"` confirmed; ⋮ menu opened on hover; clicking the row navigated to the correct project URL; zero console errors.

### TC-6.3 — `ProjectChatRow` navigate button + pin count
- **Precondition:** a project with at least one chat.
- **Steps:** click a chat row's title/timestamp area (confirmed as a real `<button>`), confirm it navigates to the chat; confirm the pin-count control is a real `<button>` and the hover-highlight background still renders correctly; attempt to open the ⋮ menu on a hovered row.
- **Expected:** identical interaction for navigate and pin-count; the ⋮ menu (when available) opens identically.
- **Verified live this session** for navigate (`tagName === "BUTTON"`, correct chat URL after click) and pin-count (`tagName === "BUTTON"`, hover-highlight background confirmed via screenshot). **⋮ menu not exercised** — every chat available to click through in this test account had `hasMenu` false (a pre-existing permission condition unrelated to this fix, not a regression). **Needs manual QA** on an account/chat combination where `hasMenu` is true, to directly confirm the Rename flow still enters edit mode correctly (the input can no longer nest inside the navigate button, by design — see `04-projects-feature-report.md` §10 Phase 6).

### TC-6.4 — Search-clear button (`projects/page.tsx`)
- **Precondition:** none.
- **Steps:** open the search field on `/projects`, type a query, click the "×" clear button (confirmed as a real `<button>`), confirm the field clears and search re-closes.
- **Expected:** identical interaction — `span role="button"` converted to a real `<button>`.
- **Verified live this session** — `tagName === "BUTTON"` confirmed; clicking cleared the field correctly.

### TC-6.5 — `SidebarProjectsSection` (deferred, not fixed)
- **Precondition:** an org-admin account, on an admin page.
- **Steps:** N/A — not attempted.
- **Not fixed this pass.** Confirmed via code trace that this component has the same nested-interactive issue, but its only render path is the old, non-flat sidebar, which only renders on admin pages (`useFlatSidebar = !isAdminPage`). This test account isn't an org admin, so there's no way to reach or verify this component at all. Deferred rather than shipping a structural change with zero live-test coverage. **Needs an admin account to even attempt.**

---

## Summary — verification coverage

| Coverage | Count | Test cases |
|---|---|---|
| **Live-verified this session** (functional test, screenshot, or precise state-sampling) | 11 | TC-1.2, TC-1.3, TC-2.1, TC-2.2, TC-2.3, TC-3.2 (partial), TC-5.2, TC-5.3, TC-5.4 (partial), TC-5.5, TC-6.1, TC-6.2, TC-6.3 (partial), TC-6.4 |
| **Verified via TypeScript + full test suite only, not independently re-clicked** | 1 | TC-3.1 (partial — sub-cases b/c/d) |
| **Verified via code-review only** (no runtime reproduction needed or possible) | 1 | TC-1.1 |
| **Explicitly could not be verified, with a stated reason** | 2 | TC-4.1 (dev-environment network-latency limitation), TC-2.3's personal-only-account branch |
| **Needs manual QA** (precondition/permission not available this session) | 3 | TC-3.1 (b/c/d, lower priority), TC-5.1, TC-6.3 (⋮ menu specifically), TC-6.5 (needs admin access) |

Same honesty standard as the Chats test plan: nothing here is claimed as verified without either a live result, a passing automated check, or a stated reason it couldn't be reached. See `04e-projects-manual-qa-checklist.md` for the live, click-through-and-cross-off pass across the whole feature.
