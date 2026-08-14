# Sidebar — Pre-Migration Logic Audit (as-built, 2026-08-12)

**Purpose:** insurance document for the flat-list Figma redesign (node 136:53072). Everything below is verified against the actual code, not the older spec docs (which are incomplete/partially stale). Before considering the migration done, walk the checklist in §9 and confirm each item was deliberately kept, deliberately dropped, or deliberately changed — never lost by accident.

This supersedes nothing — [`left-sidebar.md`](left-sidebar.md) and [`sidebar-tracking.md`](sidebar-tracking.md) still exist, but both are partial (the latter is mislabeled — it's actually a fuller spec, but only covers the individual-account tab UI and event wiring, not teams/admin/collapse/KDS internals). This doc is the complete cross-section.

## 0. File map

| File | Responsibility |
|---|---|
| `src/components/Sidebar/index.tsx` | KDS shell: header, collapse, tab strip / body-section switch, scroll fades, footer slot. Owns `bodySection` state machine. |
| `src/components/Sidebar/context.tsx` | `SidebarProvider`/`useSidebar` — cookie-backed open state. **Appears unused by the app** (see §8). |
| `src/components/SidebarMenuItem/index.tsx` | Row primitive — 6 variants, rename/marquee/link logic. |
| `src/components/SidebarProjectsSection/index.tsx` | Expandable folder primitive — separate rename logic from SidebarMenuItem. |
| `src/components/AccountMenu/index.tsx` | Footer trigger + dropdown panel. |
| `src/components/layout/LeftSidebar.tsx` (2444 lines) | App wiring: all real routing logic, data fetching, per-section components, event bus. This is where nearly all the business logic and edge cases live. |
| `src/app/(app)/brain/BrainSidebarSections.tsx` | Brain threads section (separate from `BrainScheduledTasksSection`, which lives in `LeftSidebar.tsx`). |
| `src/hooks/use-sidebar-events.ts` | All cross-component window-event constants + emitters. |
| `src/lib/storage-keys.ts` | `SIDEBAR_COLLAPSED_KEY = "sidebar_collapsed"`, `personaProfileKey`. |

## 1. KDS `Sidebar` shell — the container LeftSidebar wraps

### 1.1 Body-section state machine
`bodySection: 'chats' | 'agents' | 'brain' | 'admin'` — **internal state**, only seeded once from `defaultBodySection`/`defaultSection` at mount (`initialBodySection`). Changing `defaultBodySection` on a live instance does nothing — that's why `LeftSidebarImpl` forces a full remount via the `key={sidebarSectionKey}` prop whenever the route category changes (chat/persona/project/brain/team-settings/admin/new-chat).

Switching sections (`onSelectSection`) always: sets `bodySection`, clears `activeFolder` (never clears `selectedItem`... actually it does via `onSelect`, but section-switch itself only resets `activeFolder`), and fires the matching back-compat hook (`onChatTabClick`/`onPersonasClick`/`onBrainClick`/`onOrganisationClick`).

**Admin is not a tab.** It's entered only via the OrgBadge click or the "Manage Organisation" row — the 3-tab strip (Chats/Agents/Brain) has no 4th "Admin" tab; when `bodySection==='admin'` the tab pill has no active value (`value={bodySection === 'admin' ? '' : bodySection}`).

### 1.2 Collapse behavior
- Width animates 294px ↔ 48px (`width 320ms cubic-bezier(0.16,1,0.3,1)`).
- `isCollapsed` is **internal** state seeded once from `defaultCollapsed` — same one-way-seed caveat as body section. Toggling calls `onCollapse?.()` for the consumer to persist externally (`LeftSidebar.tsx` does this into `localStorage`, see §8).
- **Scroll position is preserved across collapse/expand**: on collapse, `scrollTop` is stashed and reset to 0 (so the header inside a scrolled-down list doesn't visually clip). On expand, it's restored one animation frame later (`requestAnimationFrame`) because `overflow:auto` has to reapply before a `scrollTop` assignment sticks.
- Header height is measured live via `ResizeObserver` (`headerH`, starts at a 210px guess) — the scroll body's `top` and both scroll-fades anchor to this, so there's no hardcoded per-section offset to keep in sync when a section's header row count changes.
- **Keyboard shortcut ⌘B / Ctrl+B** toggles collapse globally, but is **suppressed when focus is inside an `<input>`, `<textarea>`, or any `contentEditable`** — must be preserved or renaming/typing anywhere in the app breaks on that chord.
- Collapsed mode hides: org badge, tab strip (replaced by a vertical icon-only section-switch card), all row labels/shortcuts/trailing content (`SidebarMenuItem` and `SidebarProjectsSection` both branch on `collapsed`), and the entire "Recents"/"Projects"/etc. body (opacity+blur animated to invisible, `pointerEvents:none` — DOM stays mounted so state survives).
- Collapsed admin state gets its **own separate absolutely-positioned icon rail** (not the blurred-out body div) with group-separator dividers between `adminGroups`.

### 1.3 Header
- Wordmark (inline SVG, not swappable) + `OrgBadge` — **the org badge only renders for `currentUserRole` ∈ {undefined, owner, admin, editor}**; a plain `member` role never sees it, even though `orgName` is still set. Don't drop this gate when re-skinning the header.
- Individual-only "Update plan" pill appears **only** when there's no org and `plan === 'starter'`; `plan === 'pro'` shows nothing.
- Single persistent collapse toggle button (icon variant flips, no unmount) with a tooltip that flips label per state.

### 1.4 Nav strip (primary action + search + per-section extras)
- Primary "New chat"/"New agent chat"/"New thread" button: **hidden entirely in Admin** (no primary action), and on the Agents tab it's **replaced** by "All Agents" whenever `onAllAgentsClick` is provided (individual accounts only — see §7.3).
- Search row is the **only** search entry point (⌘K badge, hidden when collapsed) — no per-section search variant. Clicking it blurs the row itself before calling `onSearch` (avoids a lingering focus ring).
- "Chatboard" row: chats tab only, individual accounts only (gated on `onChatboardClick` being passed at all).
- "All Brain Threads" row: brain tab, shown for **both** individual and teams (gated only on the handler being passed).
- "Schedules" quick-access row: brain tab, always shown (not gated on a handler prop — clicking with no handler is a silent no-op).

### 1.5 Scroll fades
Four layered blur+gradient bands top and bottom, each independently faded via `atScrollTop`/`atScrollBottom` (thresholds: top <34px, bottom <8px from end). Purely cosmetic but easy to lose fidelity on if the new list doesn't expose an equivalent scroll-position signal.

### 1.6 Footer / account slot
- If the consumer passes `accountMenu` (render-prop, receives `collapsed`), that fully replaces the default. **`LeftSidebarImpl` always passes this** — so the KDS's own default `<AccountMenu>` wiring below is dead code in production, but it's the fallback used by Storybook/bare KDS usage, and encodes a *second, slightly different* plan-label algorithm (`orgName ? Teams|orgName : plan==='pro' ? 'Pro' : plan==='starter' ? 'Starter' : userEmail`) than the one `LeftSidebarImpl` actually computes (`planLabel`, §7.5). Don't accidentally resurrect the KDS default's algorithm thinking it's the canonical one — `LeftSidebarImpl`'s is.

## 2. What's actually "live" vs back-compat/fallback in the KDS Sidebar

`LeftSidebarImpl` overrides `projectItems`, `agentItems`, `recentItems`, `scheduledTasksItems`, `brainRecentItems`, and `accountMenu` — so `DefaultProjectItems`/`DefaultAgentItems`/`DefaultRecentItems`/the default `AccountMenu` wiring are **never rendered** in the real app.

**Exception: `adminItems` is never overridden.** `DefaultAdminItems` + `adminGroups` (passed as `ORG_ADMIN_GROUPS` / `teamSettingsGroups`) **is** the live, production admin-nav implementation — grouped headers with show/hide, `SidebarProjectsSection`-nested expandable items (e.g. "Tools"), icons from `ADMIN_ITEM_ICONS`. Any migration must reimplement this behavior, not just skin it.

## 3. `SidebarMenuItem` — row primitive contract

- Variants: `default`, `new-chat`, `header`, `chat-item`, `chat-item-edit`, `account-item`. **In collapsed mode, `header`, `chat-item`, and `chat-item-edit` render nothing (`return null`)** — only icon-bearing rows survive collapse.
- `isActive = isHovered || isFocused || selected`; when `selected` flips to false, stale `isFocused` is cleared explicitly (avoids a row looking "stuck" active).
- **Chat-item rename**: double-Enter within 400ms while `selected` triggers `onRename` (switches to `chat-item-edit`); a single Enter just clicks. In edit mode, Escape cancels (+ toast "Rename cancelled"), Enter commits, and **blur only cancels if the rename wasn't already resolved by Enter/Escape** (`renameResolvedRef` guard — without it, Enter would double-fire commit then cancel-on-blur).
- **Marquee**: chat-item labels that overflow start scrolling after 1s of continuous hover; a left-edge mask-fade gradient shows while idle-but-overflowed and not yet mid-scroll.
- `href` rendering: becomes a real `next/link` (except header/edit variants) so ⌘/Ctrl/Shift/Alt-click and middle-click open in a new tab natively; a plain click is intercepted (`preventDefault`) and routed through `onClick` instead.
- `account-item`: avatar + name/plan (hidden collapsed), role badge + settings icon in one combined click target (settings click target wraps both — 4px gap, not a separately-padded pair of buttons).

## 4. `SidebarProjectsSection` — folder primitive contract

- Expand state is **controlled** whenever the `expanded` prop is passed (as `LeftSidebar.tsx` always does), otherwise internal.
- **Row click vs icon click are different actions**: clicking the row label calls `onClick` (navigate/open); clicking the icon (`stopPropagation`ed) only toggles expand — never touches "active" selection. The chevron on the right also just toggles.
- **Inline rename is separate machinery from `SidebarMenuItem`'s**, but same 400ms double-click/double-Enter convention on an *already-active* row. Escape cancels without commit; blur commits (via `cancelledRef`, not the resolved-guard pattern `SidebarMenuItem` uses — slightly different implementation, same semantics).
- `showExpandArrow={false}` removes the chevron **and** disables the icon-click-to-toggle path — there is no toggle at all in that mode (icon becomes purely decorative).
- `showTreeLine` (opt-in) draws a vertical guide line down the left edge of expanded children, itself animated in sync with the stagger (not a hard show/hide).
- Marquee behavior mirrors `SidebarMenuItem`'s chat-item marquee, applied to the folder label.

## 5. `AccountMenu` — footer dropdown contract

Fixed item order: **Profile → [Upgrade Plan, if `showUpgradePlan`] → divider → Settings (⌘, badge) → [Organization, if `showOrganization` or `onOrganization` set] → Manage connectors → What's new → Help (→ chevron) → Report a bug → divider → Log out.**

Credits only appear in the `IdentityRow` at the top of the open dropdown panel — never on the collapsed trigger row itself.

## 6. `LeftSidebar.tsx` — app wiring (where almost all real logic lives)

### 6.1 Route classification → remount key → default section
```
isPersonaPage   = pathname startsWith /agents or /agent
isProjectPage   = pathname startsWith /project/  (NOT /projects or /projects/new)
isBrainPage     = pathname startsWith /brain
isAdminPage     = pathname startsWith /org
isTeamSettingsPage = pathname startsWith /teams/
isNewChatPage   = pathname === /chat && no ?id
```
`sidebarSectionKey` (forces remount): persona → 'persona'; project → 'projects'; brain → 'brain'; team-settings → `team-settings-${teamSectionId}`; admin → `admin-${adminItemId}`; new-chat → 'new-chat'; else 'chat-board'.

`adminItemId` is derived from the `/org/*` sub-path (members/teams/plans/analytics/connectors/souvenir-slack/activity, default 'general') **so a page refresh on an admin sub-page pre-highlights the right row** — this only works because of the key-per-item remount.

`teamSectionId` is read from `?section=` on `/teams/[id]`, validated against `TEAM_SETTINGS_SECTIONS` (projects/connectors/requests/activity), defaulting to 'projects' for anything invalid.

### 6.2 Admin/org nav wiring
- `ORG_ADMIN_GROUPS = DEFAULT_ADMIN_GROUPS` **minus** the `company-data` group — the app currently hides Company Data entirely from the live admin nav.
- `ADMIN_SECTION_ROUTES`: maps each admin-item id to a real `/org/*` route; anything not in the map (currently nothing — `ADMIN_SECTION_COMING_SOON` is empty) falls back to a "`<label> — coming soon`" toast, so **no admin row is ever a silent dead click**.
- Team settings clicks rewrite the URL's `?section=` query param in place rather than navigating.

### 6.3 Projects
- Constants: `PROJECT_LIMIT = 2`, `CHAT_LIMIT = 2` (team/org projects), `PERSONAL_PROJECT_CHAT_LIMIT = 2` (personal projects — deliberately same value today, but a **separate constant** since personal folders nest one level deeper visually).
- Only chats with `canEdit !== false` are shown inline in a project's chat list — a chat merely *visible* via another member's activity or a read-only share is filtered out (surfaced instead through the project's own page tabs).
- `sortChatsByRecency` — always by `updatedAt` desc.
- Auto-expand: the project whose route is currently active gets added to `expandedIds` — **only adds, never auto-collapses** another expanded project (multiple can stay open).
- Per-project chats are lazy-loaded (`loadProjectChats`) only when `chatCount > 0` and not already loaded — guards against redundant fetches on every render.
- `PersonalProjectsMenu`: personal (`teamId === null`) projects only, capped at 5, **nested one level deeper** — it's itself a folder ("Personal projects") containing per-project sub-folders, always rendered above `WorkspaceSwitcher` regardless of team state.

### 6.4 Workspace / team switching
- `WorkspaceSwitcher` renders nothing if there are zero non-archived teams.
- Falls back to the first active (non-archived) team whenever `activeTeamId` is null or points at a stale/removed team — **never** falls back to a "Personal Projects" pseudo-state (that's a fully separate, always-present nav section now).
- Dropdown action routing (`manage`/`projects`/`connectors`/`request`/`activity`/`usage`) branches on admin vs non-admin role for at least 3 of the 6 actions (e.g. `request` → org members page for admins, team-scoped requests section for everyone else).

### 6.5 Agents
- `AGENT_LIST_LIMIT = 10`.
- **Two different components** depending on account type: `PersonasSectionIndividual` (splits by `sourceShareId` into Shared/Your Agents, no ownership-map fetch needed) vs `PersonasSectionAll` (org/team — filters by `personasForTeamContext`, **and** cross-checks real per-persona ownership via `fetchPersonaOwnerMap` so a team-shared agent this viewer doesn't actually own never appears — its "New chat" button has no clone-before-chat step, so an unowned agent here would 404 on first send).
- Draft personas (`status === 'draft'`): not expandable, no chat list, clicking routes straight to the configure flow instead of expanding; shows a Yellow "Draft" badge (Individual) — the team variant additionally shows a Blue "Shared" badge for `sourceShareId !== null` non-draft agents (mutually exclusive with Draft).
- Persona chats are filtered to the agent's **active version** — chats with no `versionId`, or when the persona has no `activeVersionId`, are kept (covers optimistic/legacy rows), everything else must match.
- Avatar fallback chain: `persona.imageUrl` → sessionStorage draft avatar via `personaProfileKey(persona.id)` (the configure flow stashes it there before the fetched record catches up) → `<UserAiIcon>`.
- `RecentAgentChatsSection` is a **second, flatter layer** below the per-agent tree — all chats across all personas, chronological, independent fetch (`fetchAll`) that Promise.all's every persona's chats and merges by `updated_at ?? created_at` descending.

### 6.6 Brain schedules
- Fetched once per brain-page visit via `brainTasksFetchedRef` (survives tab switches without re-fetching).
- Per-task run status isn't on the list payload — fetched per-task in parallel (`getAutomation` detail call) to derive `lastRunStatus` and `newRunsCount`.
- "New since last seen" is tracked in `localStorage` per task (`brain-schedule-seen:<id>`), cleared (locally, not via any API) when the schedule is opened from the sidebar.
- Status icon: failed → amber `AlertTwoIcon`; otherwise a solid blue dot (including "no runs yet").

### 6.7 Recents / Starred (non-agent, non-brain pages)
- Chats already surfaced under Projects are excluded (`projectChatIdSet`) from both Starred and Recents — avoids duplicate rows.
- `StarredSection` **unmounts entirely** when no chat is starred (not just visually hidden) — its `shown` state therefore resets to `true` next time it remounts (i.e. next time any chat gets starred).
- `RecentsList` has a hydration guard (`mounted`) — server always renders `isLoading=false`, so the loading skeleton is deferred one tick past mount to avoid an SSR/client mismatch.
- "Load more" pagination row appears whenever `hasMore` is true.

### 6.8 Role / plan / org display computation
- `orgDisplayName()` strips a trailing `"'s Organisation"`/`"'s Workspace"` possessive suffix via regex — **only** when that's the entire name (auto-provisioned default); a real custom org name passes through untouched.
- Displayed role hierarchy: `owner(4) > admin(3) > editor(2) > member(1)`. Owner/admin show their org-level role; everyone else shows their **highest** role across all their teams.
- Badge chip color: owner→Purple, admin→Blue, editor→Green, else Neutral.
- Plan label: Teams accounts → `"Teams | <orgDisplayName>"` (or bare `"Teams"` pre-resolve); individuals → `planType` capitalized, else `"Free Trial"` if `isTrial`, else `"No Plan Selected"` (rendered as a warning badge via `planWarning`).
- Credits: **org and personal balances are never mixed** — org members read `org.creditPool.remaining`, individuals read `user.creditsRemaining`. This is called out as a hard rule in the old spec doc too — preserve it.
- `isTeamUser` fallback chain (`orgId || user.orgId || roleFit ∈ {small_team,large_team} || sessionStorage 'kaya:billing:snapshot:v2'.isTeamAccount`) gates individual-vs-teams UI everywhere — **treat as load-bearing, not incidental**.

### 6.9 Misc navigation guards
- "Already on new chat" / "Already showing agent library" — clicking a nav action that's a no-op on the current page shows an info toast instead of doing nothing silently.
- Nav toasts use `{ id: 'nav' }` so a rapid second click replaces rather than stacks the toast.
- New-chat click on the chat page while already viewing an existing chat both pushes the URL *and* emits `SIDEBAR_NEW_CHAT_EVENT` so the page's own imperative reset runs — URL navigation alone isn't reliably observed by the already-mounted page.

## 7. Cross-component event bus (`use-sidebar-events.ts`)

| Event | Emitted by | Consumed by |
|---|---|---|
| `persona:list-updated` | `bustPersonasCache()` (lib/api/personas.ts) | `PersonasSectionIndividual`, `PersonasSectionAll`, `RecentAgentChatsSection` |
| `persona:chat-created` / `persona:chat-title-updated` | agent chat page | same three as above |
| `chat:created` | `chat/page.tsx` | `LeftSidebarImpl` (via a ref-mirrored `addOptimistic`, to dodge stale closures without re-registering the listener every render) |
| `brain:thread-created` / `brain:thread-title-updated` / `brain:thread-deleted` | brain page / `BrainSidebarSections` itself | `BrainSidebarSections` |
| `brain:new-thread` | LeftSidebar's "New thread" button while on a brain page | brain page's imperative reset |
| `agents:see-all` | LeftSidebar's "See all agents" row while already on `/agents` | agents page (switches back to "My Agents" tab) |
| `sidebar:open` / `sidebar:close` / `sidebar:new-chat` (+ `useSidebarEvents` hook) | defined, exported | **No confirmed consumer found in this pass** — grep for usage elsewhere (mobile shell?) before assuming dead. |

## 8. Two distinct, likely-disconnected persistence mechanisms — flag before migrating

1. **`src/components/Sidebar/context.tsx`** (`SidebarProvider`/`useSidebar`) persists open/closed state in a `sidebar:state` **cookie** (1-year max-age). This looks like the "intended" KDS-level persistence API.
2. **`LeftSidebar.tsx`** instead reads/writes its own `localStorage` key `SIDEBAR_COLLAPSED_KEY` (`"sidebar_collapsed"`) directly, seeds a ref at mount, and passes it to `<Sidebar defaultCollapsed>` — which only consumes it once (collapse state then lives purely inside the KDS component; the outer ref is write-only afterward, only affecting the *next* mount).

`LeftSidebar.tsx` does not appear to call `useSidebar()`/`SidebarProvider` at all. **Confirm which of these two mechanisms (if either) the new sidebar should keep** — don't assume the cookie-based context is live just because it exists and looks canonical.

## 9. Full-codebase scan — additional findings (context providers, API layer, adjacent components)

This section closes the gaps flagged earlier: `nav-guard-context.tsx`, `search-context.tsx`, `projects-context.tsx`, `use-chat-history.ts`, `use-mobile.ts`, `AppLayout.tsx`, `AppDialogs.tsx`, `OrgBadge`, `TeamSwitcherRow`/`TeamSwitcherDropdown`, `RoleBadge`, `lib/api/personas.ts`, `lib/api/teams.ts` were all read in full.

### 9.1 Mobile — resolved: there is no mobile sidebar behavior today
`useMobile()` (`src/hooks/use-mobile.ts`, 768px breakpoint) exists but a codebase-wide grep found **exactly one match — its own definition file.** Nothing imports it. `AppLayout.tsx` renders `<LeftSidebar>` unconditionally at fixed width with zero breakpoint logic. **The claim in `left-sidebar.md` that "the Sidebar overlays on mobile via an `isMobile` prop" is simply false against current code** — no such prop exists on `SidebarProps`, and no overlay logic exists anywhere. Treat mobile behavior as a net-new requirement for the migration, not a preserve-existing-behavior item.

### 9.2 Global "unsaved changes" nav guard wraps *every* sidebar navigation
`nav-guard-context.tsx`'s `NavGuardProvider`/`useGuardedRouter` is mounted app-wide, and `LeftSidebar.tsx` uses `useGuardedRouter()` (not plain `useRouter()`) for all its `push` calls. Concretely: **every sidebar click that navigates first passes through `guardedNavigate`**, which — if `isDirty` is currently `true` (set only by the agent-configure flow, for an unpublished version) — intercepts the click, shows a global "Unsaved changes" modal ("Stay" / "Leave anyway"), and only runs the navigation if the user confirms. This is invisible in the sidebar's own code (it looks like a normal `push`) but is a real, global behavior gate that must be preserved — a new flat sidebar must still route its navigation through `useGuardedRouter`, not a raw router.

### 9.3 Global search (⌘/Ctrl+K) is a separate system from the sidebar's search row
`search-context.tsx`'s `SearchProvider` (mounted app-wide) owns its own ⌘K listener — independent of the Sidebar's own search row, which just calls the same `openSearch()`. When opened, it lazily fetches personas + every persona's chats + Brain threads (mirrors `RecentAgentChatsSection`'s own fetch-all pattern — two independent implementations of the same "all chats across all agents" fetch exist side by side). Search results merge, in order: chats, project chats, agent chats, Brain threads, projects, personas, pins, then static nav pages — each type capped (20/20/20/20/10/10/10, nav pages uncapped). Empty-query state shows the last 5 non-project chats. `trackFeature('search')` fires on every open.

### 9.4 `AppLayout.tsx` — sidebar is not always present
- **Settings pages (`/settings/*`) render no sidebar at all** — they bypass the shared chrome entirely and own their own full-page layout. A migration must keep this exclusion.
- **Brain pages** render `LeftSidebar` as a bare flex sibling next to `children` (no `TopBar`, no rounded-container wrapper, no `FloatingPanel`) — `BrainShell` (inside `children`) supplies its own center column + context rail.
- All other pages wrap `children` in the rounded glass-card container with `TopBar` + `FloatingPanel`, **except** `/org/*` and `/teams/*` pages (no TopBar, no FloatingPanel) and non-chat persona pages (plain unstyled `<main>`, no rounded container).
- `AppDialogs` (delete-chat confirmation + compare-models dialog) is mounted in all three layout branches — its own delete-chat trigger (`openDeleteChatDialog`) is a fourth cross-component pattern: a dedicated `window.dispatchEvent`/listener pair scoped to just that one imperative call, distinct from the general event bus in §7.

### 9.5 Three independent, non-unified deterministic color-hash algorithms
Don't assume these share logic — they don't:
- **`OrgBadge`** (`pickOrgColor`): hashes **org id** (fallback org name) → one of 6 KDS tag colors `[Blue,Red,Green,Yellow,Purple,Brown]`. Id-keyed, so renaming an org never changes its color.
- **`RoleBadge`**: **not hashed at all** — fixed per-role tokens (owner→lime/olive, admin→tan/brown, editor→blue, member→purple/mauve), with custom inlined "Solar" glyph SVGs (system/ring/comet/organic) mapped 1:1 to owner/admin/editor/member. `mode` prop accepts `'chess'|'shapes'|'cards'` for API parity but **only `'solar'` is actually implemented** — the others silently render solar anyway.
- **`TeamSwitcherRow`/`TeamSwitcherDropdown`**: their own separate hash (`getTeamGradient`/`getGradient`, djb2-style) over **team name** (not id) → one of 6 CSS gradients. Name-keyed, so **renaming a team changes its avatar color** — unlike the org badge. The two implementations are copy-pasted identically between the two files rather than shared.

### 9.6 Persona status/ownership — two subtleties not visible from the sidebar code alone
- **Paused personas get no special sidebar treatment.** `status` is derived in `lib/api/personas.ts`'s `normalizeRepo`: `is_active === false` always yields `status: 'paused'`, taking precedence over draft/active regardless of publish history. But `LeftSidebar.tsx`'s draft-handling branch only checks `persona.status === 'draft'` — it has no `'paused'` case. A paused persona therefore renders today as an ordinary, fully-expandable row with no badge and no special routing, which may or may not be intentional; flag it as a decision point rather than assuming it's deliberate.
- **`visibility` and `sourceShareId` are different axes, easy to conflate.** `visibility` (`'private'|'team'`) is a repo-level deployment-scope flag; `sourceShareId` (on the *version*, not the repo) marks a personal copy accepted via a Super Link. The Individual sidebar's Shared/Your-Agents split uses `sourceShareId`; the Team sidebar's ownership filter uses `visibility` + the owner map. They answer superficially similar "is this mine" questions via genuinely different mechanisms.
- **Ownership-map race on first render.** `resolveViewerUserId` matches the viewer by email against the org members list; if that list hasn't loaded yet, it returns `null`, and `isPersonaOwnedByViewer` falls back to the coarse `currentUserRole === 'admin'` guess until members resolve. So immediately after a team-context sidebar mounts, agent ownership filtering can transiently use the wrong (coarse) signal for a moment.
- `fetchPersonaOwnerMap` (in `lib/api/teams.ts`) has its own 30s cache keyed by `orgId + sorted teamIds`, and — cross-file coupling worth knowing about — it self-clears whenever `personas.ts`'s `PERSONAS_LIST_UPDATED_EVENT` fires, even though that event is emitted from a different module.

### 9.7 `use-chat-history.ts` — the hook behind `chatHistory` everywhere in the sidebar
- Cursor-based pagination (`hasMore`/`loadMore`), with the backend itself excluding project-linked chats (`!c.project_id`) — this is a **second, server-side-driven exclusion** layered underneath `LeftSidebar.tsx`'s own client-side `projectChatIdSet` filter; both exist, doing the same job at two different layers.
- Every mutation (`rename`, `remove`, `star`) is optimistic with rollback-on-failure and a matching error toast; `remove` returns a `boolean` specifically so per-row callers can choose whether to show their own success toast.
- `refreshChatTitle` is a dedicated mechanism for the async-generated-title problem: it bails out immediately if the local title is already real (not `"New chat"`/`"Untitled"`), dedupes concurrent calls per chat id via an in-flight promise map, and is called on a staggered 2.5s/5s schedule from elsewhere (the chat page) — this hook only exposes the primitive, not the scheduling.

### 9.8 `projects-context.tsx` — the hook behind `useProjects()` everywhere in the sidebar
- `deleteProject` is **hard-blocked** client-side when `!canEdit` (toast + early return) — a real permission guard, not just a UI affordance.
- Every mutation (`createProject`, `updateProject`, `deleteProject`, `removeFile`) follows the same optimistic-update-then-rollback-on-error pattern, each with its own toast.
- File sizes are cached in `localStorage` per-project (`project-file-sizes:<id>`), with a background `HEAD`-request fallback (via `AbortController` + `Promise.allSettled`) for any document neither the server nor localStorage has a size for yet — a fairly elaborate side mechanism just to avoid showing blank file sizes.
- `loadProject`'s list-refresh effect deliberately uses a functional `setProjects` updater to avoid clobbering a fuller project record that `loadProject` (detail fetch) may have already resolved first — a real race guarded against, not incidental.

### 9.9 `TeamSwitcherDropdown` — action flyout is gated per-team-role, not per-viewer-role
Each team row's available actions depend on **that team's own `userRole`** (owner/admin get Manage/Usage/Request/Activity; editor gets Projects/Connectors/Request/Activity; **member gets no action flyout at all** — just a plain select-team click, no chevron, no submenu). This means several of `LeftSidebar.tsx`'s `handleActionSelect` switch branches (`manage`/`usage`/`connectors` etc.) are simply unreachable for any team where the viewer's role in that specific team is `member` — the dropdown never gives them a way to trigger those actions in the first place. Also: dropdown scrolls internally with the same progressive-blur treatment as the main sidebar once a viewer has more than 4 teams (`needsOverflow`, max height 210px).

## 10. Migration checklist — confirm each explicitly, don't let any slip silently

- [ ] ⌘B/Ctrl+B collapse shortcut, suppressed inside text inputs
- [ ] Collapse scroll-position memory (stash on collapse, rAF-restore on expand)
- [ ] Org badge hidden for plain `member` role
- [ ] "Update plan" pill: individual + no org + `starter` plan only
- [ ] Admin entry is not a tab; only via org badge / "Manage Organisation" row (or resolve this if the new flat design removes admin from the sidebar entirely — see prior open question)
- [ ] `DefaultAdminItems`/`ORG_ADMIN_GROUPS` behavior (grouped, collapsible, nested "Tools" expandable, Company Data hidden) — this one IS production code, not a fallback
- [ ] Admin "coming soon" toast fallback for any unmapped section id
- [ ] Chat-item rename: double-Enter-within-400ms, Escape-cancels-with-toast, blur-cancels-unless-already-resolved
- [ ] Folder rename: double-click-within-400ms-on-active-row, separate implementation from chat-item rename
- [ ] Row click vs icon click on folders are different actions (navigate vs toggle-only)
- [ ] Label marquee-on-hover-after-1s for overflowing chat/folder labels
- [ ] Collapsed mode hides header/chat-item/chat-item-edit rows entirely
- [ ] PROJECT_LIMIT/CHAT_LIMIT/PERSONAL_PROJECT_CHAT_LIMIT = 2 (or deliberately changed)
- [ ] Projects: `canEdit` filter on inline chats; auto-expand active project (additive only)
- [ ] Personal projects nested one level deeper than team projects, capped at 5
- [ ] WorkspaceSwitcher: hides with zero active teams; falls back to first active team, never to a "Personal" pseudo-state
- [ ] Agents: individual (Shared/Your split) vs team (ownership-map filtered) are genuinely different data paths
- [ ] Draft persona: not expandable, routes to configure, Draft badge
- [ ] Persona chats filtered to active version
- [ ] Persona avatar fallback chain (imageUrl → sessionStorage draft → icon)
- [ ] RecentAgentChatsSection as an independent flat second layer
- [ ] Brain schedule run-status: per-task detail fetch, seen/unseen localStorage tracking, status icon rule
- [ ] Recents/Starred exclude project-linked chats; Starred unmounts (not hides) when empty
- [ ] Hydration guard on Recents loading skeleton
- [ ] orgDisplayName possessive-suffix stripping (whole-name match only)
- [ ] Role hierarchy owner>admin>editor>member; badge colors purple/blue/green/neutral
- [ ] Plan label branching (Teams / capitalized planType / Free Trial / No Plan Selected + warning)
- [ ] Credits: org pool vs personal balance, never mixed
- [ ] `isTeamUser` fallback chain — treat as load-bearing
- [ ] "Already on X" no-op guards with toast feedback
- [ ] Nav toast dedupe via `{id:'nav'}`
- [ ] Full event-bus table (§7) — every emitter needs a live consumer in the new implementation, or a deliberate decision to drop it
- [ ] Resolve which collapse-persistence mechanism (cookie context vs localStorage ref) is canonical going forward
- [ ] AccountMenu dropdown item order and role/plan gating (§5)
- [ ] All sidebar navigation routed through `useGuardedRouter`/`guardedNavigate` (§9.2) — not a raw router
- [ ] Decide mobile behavior fresh — confirmed no existing implementation to preserve (§9.1)
- [ ] Sidebar is absent entirely on `/settings/*`; bare (no TopBar/FloatingPanel) on Brain pages (§9.4)
- [ ] Global ⌘K search vs. sidebar's own search row remain two distinct entry points to the same `openSearch()` (§9.3)
- [ ] Decide deliberately: keep 3 separate color-hash algorithms (org=id-keyed, team=name-keyed, role=fixed) or unify — don't unify by accident (§9.5)
- [ ] Decide deliberately whether paused personas should keep getting zero special sidebar treatment (§9.6)
- [ ] Preserve the `visibility` vs `sourceShareId` distinction — don't conflate "team-deployed" with "Super-Link-shared" (§9.6)
- [ ] Per-team-role action-flyout gating in the team switcher — member role gets no flyout (§9.9)
