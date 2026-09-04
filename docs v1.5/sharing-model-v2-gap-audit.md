# Sharing Model v2 — Gap Audit (FE + BE)

Audit date: 2026-09-03 · **Tables re-verified 2026-09-04** (🔄 notes) · **Frontend built for 5 gaps, later 2026-09-04** (🆕 notes, see §"Frontend built" below the tables)
Spec: `sharing-model-v2.html` (same directory)
Scope: started as read-only research on `front-end/` and `back-end/` — no backend changes were made or proposed as code. The 2026-09-04 frontend build below is real, shipped frontend code (no backend changes).

Legend: ✅ Fully supported · ⚠️ Partially supported · ❌ Not supported · 🔴 Conflicts with current model · 🐛 Active bug (built against backend behavior that has since changed)

---

## Entities & Roles

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| Admin/Member roles, no special Admin sharing power | ✅ | None — `src/lib/roles.ts` ladder already gives Admin no extra sharing power | None — `OrganizationRole` enum already matches |
| Last Admin can't leave workspace without promoting replacement | ✅ | 🆕 **Built 09-04**: `LeaveWorkspaceModal` (`src/components/LeaveWorkspaceModal/`), launched from Settings → General → Danger Zone → "Leave workspace". Computes last-admin status client-side, requires a signed-up successor before the button enables, blocks while members are still loading | 🔄 **Shipped 09-04**: `POST /organizations/{id}/leave` (`organization.py:339-366`) requires + promotes a `successorAdminUserId` when the caller is the last admin |

## Projects

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| 3 types: Personal / Workspace / Shared | ✅ | 🆕 **Fully built 09-04**: `projects/new/page.tsx` has a real Personal/Workspace/Shared picker at creation time (`createProject`/`createProjectApi` thread a real `visibility` field through; the normalizer no longer hardcodes `'private'`). **Later same day**: `/projects`' list scope filter rebuilt from the old binary Personal/Team tab into a real 3-way `ScopeFilter = ProjectVisibility` filter — `personalCount`/`workspaceCount`/`sharedCount` and `scopedProjects` are now keyed off `project.visibility`, not `teamId`; a `parseScope()` helper maps legacy `?scope=team` links to `'workspace'` for backward compat. **Still no way to change visibility after creation** (matches the backend, which has no PATCH either) | 🔄 **Shipped 09-04**: `PROJECT_VISIBILITY_VALUES = ("personal","workspace","shared")` (`projects/schemas.py:9`); the org-wide ACL arm for `Project` now exists (`organizations/roles.py:49-72`). Still missing: `PATCH /projects/{id}/visibility` |
| Owner fixed at creation, never removable by others | ✅ | None | 🔄 **No longer fully true**: `project.py:459` now mutates `user_id` — but only inside the new self-initiated owner-exit-with-successor flow, not forced by others, so this is directionally correct per spec, not a regression |
| Any collaborator can add/remove other collaborators (Shared) | 🐛 | 🔄 **Now the blocker**: `ProjectMembersPanel`'s `canManage` is still hard-coded owner-only (`project.canEdit` in `project/[id]/page.tsx:295`) — its own code comment claiming "backend 404s for anyone but the owner" is now stale | 🔄 **Shipped 09-04, spec now matches**: `inviteOne`/`inviteMany`/`removeMember` (`project.py:353-410`) now check `requireWritable`, not `requireOwned` — any collaborator with write access can manage members |
| Collaborator self-serve "Leave project" | ✅ | 🆕 **Built 09-04**: `LeaveProjectModal` (`src/components/LeaveProjectModal/`), launched from the "…" menu on both `/projects` (list) and `/project/{id}` (detail header) — shown whenever a project isn't Personal. Non-owner path is a plain confirm | 🔄 **Shipped 09-04**: `POST /{project_id}/leave` (`router.py:106-118`), full member/owner/successor/archive/convertPersonal handling in `project.py:429-480` |
| Owner exit flow: name successor / archive / convert to Private, forced modal, no escape | ✅ | 🆕 **Built 09-04**: same `LeaveProjectModal` — when the caller is the owner, it fetches `fetchProjectMembers` and branches automatically into a required successor picker (others remain) or an archive/convert-to-personal choice (owner alone) | 🔄 **Shipped 09-04**: fully implemented, `ALONE_ACTIONS = ("archive","convertPersonal")` (`schemas.py:11`), successor/archive/convert logic in `project.py:449-480` |
| Deletion: owner-only, Personal instant, Workspace/Shared soft-delete + 30-day recovery, cascades to chats | 🐛 | 🆕 **Partially built 09-04**: `ProjectTrashModal` (`src/components/ProjectTrashModal/`), launched from a new "Trash" button on `/projects`, lists recoverable workspace/shared projects and restores them (`GET /projects?deleted=recoverable`, `POST /projects/{id}/restore`). **Still open, not touched by this build**: `canDeleteProject = project.canEdit \|\| (isOrgAdmin && teamId===orgId)` (`project/[id]/page.tsx:323`, `projects/page.tsx:350`) still grants the admin bypass the backend removed — a non-owner admin clicking Delete still gets a 404. Delete-confirmation copy ("permanently, cannot be undone") is also still wrong for workspace/shared projects, which now visibly have a 30-day recovery window (the new Trash view itself proves it) | 🔄 **Shipped 09-04, conflict fixed**: `requireDelete` now strictly equals `requireOwned` (`project.py:90-91`, admin bypass removed) + real `restore()` / `POST /{project_id}/restore` with `RECOVERY_DAYS=30` |
| Offboarding: delete Personal projects, gate on unresolved Shared/Workspace ownership | ✅ | N/A (backend-driven) | 🔄 **Shipped 09-04**: `services/organizations/offboarding.py` — `requireResolvedOwnership` (409 on unresolved shared/workspace ownership) + `clearPersonalAssets`, wired into both `removeMember` and `leave` |

## Chats

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| 3 states: Private / Shared / Archived | ⚠️ | 🔄 Still stubbed — `LeftSidebar.tsx:1841-1843` still fires `toast.info("Archiving chats is coming soon")` against a comment claiming no endpoint exists | 🔄 **Shipped 09-04**: `POST /{chat_id}/archive` (`chat/router.py:66-72`) sets a real archived state with a read-only write guard. Backend done — FE just needs to call it |
| Shared chat: explicit list, creator-only manage | ✅ | `ChatShareOverlay` already matches this well (creator-managed list, person/project recipient targets, revoke) | 🔄 **Reconciled 09-04** (was flagged as a duplicate mechanism, now cleaned up): the org-wide share path is `POST /{chat_id}/share`, requires the chat already be project-linked; `create_chat_share` now rejects project-linked chats outright and dropped `project_id` from its request schema. No more overlap |
| Chat's project association fixed at creation, never movable | 🐛 | 🔄 **Now the active bug**: `MoveToProjectModal` is still fully wired (`LeftSidebar.tsx:1795-1806`, `ChatHistoryItem.tsx:92-95,243-249`, `chats/page.tsx:128-140`) — every "Move to project" click now fails with a generic `toast.error` | 🔄 **Shipped 09-04, spec now enforced**: `linkChat`/`unlinkChat` unconditionally `409` ("fixed at creation", `project.py:271-281`); the `POST /chat-shares` + `project_id` path is gone too |
| Viewer sees read-only, hits "Continue" to fork private copy | ✅ | Already built — the "Create a copy" button does exactly this (naming differs from spec's "Continue," cosmetic only) | 🔄 **Simplified 09-04**: fork is now `copy_chat` / `POST /{chat_id}/copy`, gated only by read access — the old `editable`/`read_only` blocking dimension is gone entirely, matching spec cleanly |
| Deletion: instant, no recovery, no successor gating | ✅ | `DeleteChatDialog` already matches (instant, permanent, no gating) | Already matches functionally (soft-delete under the hood, but behaves as instant/no-recovery since nothing restores it) |
| Offboarding: delete Private chats, keep Shared chats alive | ✅ | N/A (backend-driven) | 🔄 **Shipped 09-04**: see `offboarding.py` in Projects above — same offboarding pass now deletes private chats too |
| Not searchable workspace-wide | ✅ | N/A | 🔄 **Corrected 09-04**: a real global chat search exists — `search-context.tsx` + `GlobalSearchModal` (mounted `app/(app)/layout.tsx:38`), live Cmd/Ctrl+K, includes chats/project chats. The original "not located" note was a miss, not a true absence |
| "Publish to Workspace" toggle on project chat rows (`project/[id]/page.tsx`'s `canPublishChat`/`handlePublishToggle`) | 🐛 | 🆕 **Newly documented 09-04 (found while fixing bug #10, not fixed — pre-existing)**: fully wired in the UI but dead — `setChatVisibility()` (`lib/api/chat.ts:491-506`) PATCHes `/chats/{id}/visibility`, which doesn't exist in the current backend at all. Every toggle click 404s | 🔄 **Route removed at some point, `chat/router.py` never had it added back**: current routes are `/share`, `/archive`, `/star`, `/copy`, `/stop`, `/rename`, etc. — no `/visibility`. `openapi.yaml` still lists the old route (stale, not regenerated) |

## Cross-cutting conflict: legacy Teams

**Unchanged as of 2026-09-04** — re-checked, nothing moved here.

Backend has **already fully dropped** the Teams layer — migration `f8a1c3e5b7d9_flatten_org_drop_teams.py` removes the team layer, with a comment noting shared-vs-private is now the only visibility split. So backend direction already agrees with dropping Teams (consistent with the `project_teams_ui` memory note flagging this conflict).

Frontend, however, still has live `TeamSwitcher` / `TeamSwitcherDropdown` / `TeamChip` components and a `teamId` field still threaded through `projects-context.tsx`, even though the backend concept it once mapped to is gone. **Updated 09-04 (later still)**: `projects/page.tsx`'s own scope filter no longer depends on `teamId` — it was rebuilt to key off real `visibility` instead (see "Frontend built" below) — but `teamId` is still load-bearing elsewhere: `canDeleteProject`'s admin-bypass check (`teamId===orgId`, already flagged as a 🐛 above) and the sidebar's project grouping (until today's fix, also `teamId`-based — see bug 8 in "Frontend built"). Needs a decision: delete `teamId`/Teams outright, or repurpose its "named group + project list" shape for the new Shared-project membership list.

## Frontend built (2026-09-04, later same day)

No design existed for any of these 5 flows — built directly against the
verified backend contracts above, UI decisions made inline (documented in
each component). New components: `ConfirmModal` (shared, currently unused —
see hygiene note below), `LeaveWorkspaceModal`, `LeaveProjectModal`,
`ProjectTrashModal`, all under `src/components/`. Modified: `lib/api/organization.ts`
(+`leaveOrganization`), `lib/api/projects.ts` (+`leaveProjectApi`,
`restoreProjectApi`, `fetchDeletedProjects`, real `visibility` field
end-to-end), `lib/config.ts` (+3 endpoint constants), `context/projects-context.tsx`
(+`refreshProjects`, `createProject` now threads `visibility`), plus the 4
integration points named in the table rows above.

### Bugs found and fixed during implementation (self-review, not live-tested)

1. **`LeaveProjectModal`** — a failed `fetchProjectMembers` call left `others`
   as `[]`, which read identically to "you're genuinely alone on this
   project." An owner could have archived/converted a project that actually
   still had other collaborators, based on a network error rather than real
   membership. Fixed: a distinct `membersLoadFailed` state blocks confirming
   and shows a "Couldn't check who else is on this project" + "Try again" state.
2. **`ProjectTrashModal`** — same class of bug: a failed `fetchDeletedProjects`
   call was indistinguishable from "trash is empty." Fixed: a `loadFailed`
   state with its own retry UI instead of a false "Nothing in the trash."
3. **`LeaveWorkspaceModal`** — `isLastAdmin` was computed as "does the org
   have exactly one admin total," with no check on whether the *person
   leaving* is actually an admin. A plain member in an org with one admin
   would've been forced into the successor-picker flow and blocked from
   leaving at all. Fixed: `isLastAdmin = currentUserRole === 'admin' && adminCount <= 1`.
4. **`LeaveWorkspaceModal`** — the successor candidate list excluded self and
   service accounts, but not pending invites (`inviteStatus === 'invite_sent'`)
   — someone who hasn't signed up could've been offered as "the new admin,"
   which makes no sense (no account to promote). Fixed: candidates now
   require `inviteStatus === 'signed_up'`.
5. **`projects/page.tsx` + `project/[id]/page.tsx`** — 3 call sites used
   `void refreshProjects()` with no `.catch()`. `refreshProjects` was
   extracted out of an effect that had its error handling attached at the
   *call site*, not inside the function — the new call sites lost that
   handling, risking an unhandled promise rejection on a transient network
   blip right after a successful leave/restore. Fixed with proper `.catch()`
   at all 3 sites.
6. **`LeaveWorkspaceModal`** — `adminCount`/candidates were computed from
   `useOrg().members` with no check on `membersLoading`. If the modal opened
   before the members list finished loading, `adminCount` could read as `0`,
   falsely telling a real admin "you're the only admin" even when others
   exist. Fixed: button disables and copy shows "Checking workspace
   admins…" while `membersLoading` is true, plus a defensive check inside
   `handleLeave` itself.
7. **Near-miss, caught before shipping**: the first draft wired
   `LeaveProjectModal`'s post-success callback to the existing `deleteProject()`
   function to refresh the list — which actually calls the real destructive
   `DELETE` endpoint, a completely different action from leaving. Caught in
   review; added `refreshProjects()` (fetch-only, no mutation) instead.
8. **`LeftSidebar.tsx:703`** — the sidebar's "Workspace projects" section
   filtered on `project.teamId !== null`, but the backend sets `organizationId`
   (→ `teamId`) on **every** project an org member creates, including
   `visibility: 'personal'` ones (`project.py:131-139`) — not just workspace/
   shared. Once the `/projects` page's own tabs switched to filtering by real
   `visibility` (see below), this became a live inconsistency: an org
   member's Personal project would appear under "Workspace projects" in the
   sidebar but under the Personal tab on `/projects` — two different counts/
   sets for what looks like the same concept. Fixed: `isOrgSharedProject`
   now checks `visibility === 'workspace' || visibility === 'shared'`.
9. **`lib/api/projects.ts`'s `normalizeProjectSummary`/`normalizeProject`** —
   both read `visibility: p.visibility` with no fallback, unlike the
   deliberate `?? existing?.visibility ?? 'personal'` guard already present
   in `projects-context.tsx` for degraded responses. Before the list filter
   switched to exact `visibility` matching, a missing value here only
   mis-labeled a project; after the switch, it would silently drop the
   project out of every scope tab and every badge count with no error.
   Fixed: both now fall back to `'personal'`, matching the context layer's
   existing pattern.
10. **`project/[id]/page.tsx` — the entire project detail page branched on
    `project.teamId` instead of `project.visibility`**, the same bug class
    as #8 but far more pervasive since it predates this build entirely (it's
    what the sidebar's `isOrgSharedProject` was copied from). Because the
    backend stamps `organizationId` on org members' Personal projects too,
    opening your own Personal project as an org member rendered it as if it
    were Workspace/Shared: the header showed "Created by {owner}" instead of
    "Personal Project" (was line 706), the chat area swapped the flat
    personal list for the 3-tab Personal/Published-to-Workspace/Shared-with-you
    layout (was line 903) and fired an unnecessary global-chat-list fetch to
    populate it (was lines 150/165), the "Publish to workspace" toggle
    appeared on chat rows (`canPublishChat`, was line 432), and a "Members"
    floating-panel entry appeared for a project with no membership to manage
    (was line 1057). Fixed: all 5 spots now key off `project.visibility !==
    'personal'` instead of `project.teamId`.
11. **`projects/page.tsx`'s `projectMemberCount`** — used `!project.teamId`
    to decide "is this a personal project, so just show 1 member" for the
    member-count badge on every `ProjectCard`/`ProjectListRow`. Same bug
    class: an org member's Personal project has a non-null `teamId`, so this
    fell through to counting the *whole org team roster* on that project's
    card instead of showing 1. Fixed: checks `visibility === 'personal'` first.
12. **`souvenir-slack/page.tsx`'s admin-facing project list** — filtered
    projects eligible for Slack-channel linking with a bare `summary.teamId`
    truthy check. Since `teamId` is non-null on org members' Personal
    projects too, an org admin configuring Slack integrations would see
    every member's private Personal projects listed as linkable — a real
    privacy/scoping leak, not just a display glitch. Fixed: now also
    requires `visibility !== 'personal'`.
13. **`projects-context.tsx`'s `createProject`** — the `project_created`
    analytics event reported `team_shared: !!teamId`, reading the function's
    `teamId` *parameter*. Its only caller (`projects/new/page.tsx`) always
    passes `undefined` for that parameter and passes `visibility` instead —
    so this metric silently reported `team_shared: false` for every project
    ever created via the real UI, even Workspace/Shared ones, since the
    visibility picker shipped. Fixed: now derives `team_shared` from the
    `visibility` parameter instead.
14. **`members/page.tsx`'s invite-modal project list** (lines 962, ~1241) —
    the "which project(s) should the new invitee be added to" picker inside
    `AppInviteModal`, fed by `fetchProjects(...).filter(project =>
    project.teamId)`. Same bug class as #12 (Slack): an admin's own Personal
    project also carries the org's `teamId`, so it showed up as a selectable
    "add this new member to…" target — offering to add a stranger to the
    inviting admin's private project. Fixed: now also requires `visibility
    !== 'personal'`.
15. **`lib/api/projects.test.ts`** — a pre-existing, already-red unit test
    (`fetchProjects > normalizes the camelCase backend shape...`), written
    for the old `'private'|'team'` visibility model and never updated when
    it was renamed to `'personal'|'workspace'|'shared'`. Its mock response
    omitted `visibility` entirely and asserted the normalized output was
    `visibility: 'private'` — a value that isn't even in the current
    `ProjectVisibility` union, so this assertion could never pass against
    either the pre- or post-today normalizer (confirmed by running the suite:
    it failed before fixing it too, just with a different received value).
    Ran `npx vitest run` for the first time this session and caught it.
    Fixed: the mock now includes an explicit `visibility: 'workspace'` field
    and asserts pass-through (representative of a real backend response);
    added a second, dedicated test asserting the `?? 'personal'` fallback
    from bug #9 when the field is genuinely missing. Full suite (36 files,
    256 tests) passes clean after the fix — checked for any other
    regressions from today's changes, found none.

**Also found, NOT part of this bug class, added to the Chats table below**:
while tracing `handlePublishToggle`/`canPublishChat` for bug #10, the
underlying `setChatVisibility()` (`lib/api/chat.ts:491-506`) PATCHes
`/chats/{id}/visibility` — a route that **no longer exists** in
`chat/router.py` at all (confirmed: its route list has `/share`, `/archive`,
`/star`, `/copy`, etc., no `/visibility`; `openapi.yaml` still lists it but
is stale, same drift pattern seen elsewhere this session). The "Publish to
Workspace" toggle on chat rows inside Workspace/Shared projects is
completely dead — every click 404s. `chat.ts`'s own existing comment on that
function undersold this ("every call with 'org' 400s") — it's actually worse,
a 404 against a route that was removed outright, not a 400 against a
wire-format mismatch. Pre-existing, not touched by today's fixes (see new
Chats-table row below) — narrowing bug #10's `canPublishChat`/3-tab gate from
`visibility !== 'personal'` to `visibility === 'workspace'` wouldn't matter
either way, since the feature is broken for Workspace projects too.

**Four things checked and ruled out as bugs** (worth recording so they aren't
re-flagged later): trash-view "Restore" can't 404 on a project you don't own
— `get_recoverable_projects` (`repository.py:91-108`) filters
`Project.user_id == user_id` server-side, so the list is always your own.
There's no stale-cache risk from the `visibility` field change — checked
`projects-context.tsx` for any localStorage/sessionStorage snapshot of the
project list; the only local caching there is per-file upload sizes, not the
list itself. `teamId`/`visibility` genuinely can and do disagree
(`organizationId` is set on every org member's project regardless of
visibility) — that's real, but it's the *correct* signal to key scope off
(see bug 8 above), not a regression to fix. And `projects/new/page.tsx`
defaulting its visibility picker to Personal regardless of which `/projects`
tab you clicked "New Project" from is intentional, not an oversight — its
sibling `newProjectHref` already carries a standing comment that this page's
create button "should default to Private regardless of which team happens
to be active... elsewhere," predating this build.

**Hygiene, not a bug**: `ConfirmModal` was built per-plan as a shared "simple
confirm" primitive, but both Leave modals ended up needing more than a bare
confirm and got their own hand-rolled shells instead — `ConfirmModal` has
zero real call sites right now. Left in place as a reasonable primitive for
a future simple-confirm need rather than deleted.

**Found while fixing #10, confirmed pre-existing dead code, not touched**:
`project/[id]/page.tsx`'s legacy "change project visibility" share modal
(`handleOpenShare`/`handleSaveVisibility`/`setProjectVisibility`, the
`shareOpen` overlay around line 1121, its "Currently Private/Shared" badge
and Private/Shared picker cards) is unreachable in the current UI — its only
trigger, the share `IconButton` (~line 630), is gated behind
`project.canManageVisibility`, which both normalizers hardcode to `false`
(matches the backend having no `PATCH /projects/{id}/visibility`, see the
Projects table row above). This subsystem still branches on `project.teamId`
internally and calls `setProjectVisibility` with a `'team'/'private'` enum
that predates the `visibility` field — left alone rather than fixed, since
fixing dead code that can never render doesn't change any user-visible
behavior. Worth deleting outright in a future pass, alongside the
legacy-Teams cleanup decision already noted above.

**Not fixed, out of scope for this build** (pre-existing, from the tables
above): the `canDeleteProject` admin-bypass 🐛 and the `MoveToProjectModal`
🐛 in the Chats table, plus the newly-documented dead "Publish to Workspace"
toggle 🐛 (Chats table, new row above). All three predate this session's
frontend build and weren't part of the 5 gaps worked on. Note the admin-
bypass check actually has a *third* copy, found during this scan:
`projects-context.tsx:357`'s `isOrgAdminOverride` inside `deleteProject()`
itself (the same stale `teamId===orgId` logic as the two page-level
`canDeleteProject` checks) — all three need fixing together whenever this
bug is picked up.

### `/projects` list 3-way scope filter (2026-09-04, later still)

The list-view half of the "3 types" gap (row above) was the one piece left
over after the 5-gap build — the creation picker was real, but `/projects`
itself still filtered by the old `teamId === null` proxy. Rebuilt in
`projects/page.tsx`: `type ScopeFilter = ProjectVisibility`, a `parseScope()`
helper (unrecognized/missing → `'personal'`, legacy `?scope=team` → `'workspace'`
for backward compat with any existing bookmarked/shared links), 3 header
badges (Personal/Workspace/Shared counts), and a 3-tab `Tabs` bar — all keyed
directly off `project.visibility` instead of `teamId`. `npx tsc --noEmit`
clean. A dedicated bug-hunt pass on this specific change (cross-checking every
other file that reads `teamId`/constructs a `?scope=` link, and whether
`visibility` can disagree with `teamId` or be missing on older projects)
turned up 2 more real bugs (8 and 9 above), both fixed same-day. A second,
broader pass across the rest of the codebase for the same bug class (any
`Project.teamId` truthy-check standing in for "is this shared with the
org") turned up 6 more (10–15 above) — the biggest being `project/[id]/page.tsx`
itself, which rendered an org member's own Personal project as if it were a
shared project across 5 separate spots. All fixed same-day; `npx tsc
--noEmit` still clean. That same pass also turned up one unrelated
pre-existing dead feature (the "Publish to Workspace" chat toggle hitting a
removed backend route — see the new Chats-table row) and a third copy of the
already-known `canDeleteProject` admin-bypass — both documented, neither
fixed (out of scope, see notes above). A follow-up pass finally ran the
actual unit test suite (`npx vitest run`, 36 files / 256 tests) for the
first time this session — it caught one more real, already-red test
(bug #15) predating this whole build, and confirmed no other regressions
from any of today's fixes.

**Caveat on all of the above**: mostly a static code review (re-reading every
state transition, cross-checking ambiguous cases directly against backend
source), not a live click-through — no authenticated dev session was
available this session (same limitation noted earlier in this doc's history:
the local dev server crashed from a Windows resource-exhaustion error
unrelated to this code). The one exception is bug #15: the unit test suite
itself (`npx vitest run`, 256 tests) was actually run and passes clean,
which is real verified-by-running coverage for the normalizer/fallback
logic specifically — but everything else (rendering, click flows, API
round-trips) is still verified-by-reading only, not verified-by-running.

### How to test each

- **Leave workspace / promote successor**: `/settings/general` → Danger Zone
  → "Leave workspace". As a non-last-admin, confirm and verify a 204 leave
  request fires, then a full-page redirect to `/chat`. As the sole admin,
  verify the button stays disabled until a signed-up member is picked, and
  that pending invites never appear in that list.
- **Leave project (collaborator)**: as a non-owner on a workspace/shared
  project, `/projects` → "…" menu → "Leave project" → confirm → verify the
  project disappears from your list without a page reload (`refreshProjects`,
  not `deleteProject`).
- **Project owner exit**: as the owner of a shared/workspace project with
  other collaborators, same entry point → verify a required successor
  picker appears (sourced from `GET /projects/{id}/members`) and the leave
  request sends `successorUserId`. As the owner with nobody else on the
  project, verify the archive/convert-to-personal choice appears instead and
  the request sends `aloneAction`. Also test with the network throttled/offline
  during the initial member fetch — should show "Couldn't check who else is
  on this project" + "Try again", never fall through to the "alone" UI.
- **Project type picker**: `/projects/new` — as an org member, verify all 3
  options render and the created project's `visibility` on the wire matches
  the one picked; as an individual (no org), verify the picker doesn't
  render at all and the project is created Personal.
- **Trash/restore**: delete a workspace or shared project, then `/projects`
  → "Trash" → verify it appears with a "Restore" button; restore it and
  verify it reappears in the main list. Delete a *personal* project and
  verify it never appears in Trash (hard-deletes instantly, matches
  backend). Also test with the trash fetch failing (offline) — should show
  "Couldn't load the trash" + "Try again", never a false "Nothing in the trash."
- **`/projects` 3-way scope filter**: with an org, verify all 3 tabs
  (Personal/Workspace/Shared) render with correct counts and each shows only
  projects with matching `visibility`. Visit `/projects?scope=team` (an old
  link) and verify it lands on the Workspace tab, not a broken/blank state.
  Switch tabs and verify the URL's `?scope=` updates via replace (Back button
  doesn't pile up a tab-switch per entry). Without an org, verify the tab bar
  and extra badges don't render at all. As an org member, create a Personal
  project and verify it does **not** appear under the sidebar's "Workspace
  projects" section (bug 8 above) — only under `/projects`' Personal tab.
- **Personal project rendering as an org member** (bugs 10–13): as an org
  member, open your own Personal project's detail page (`/project/{id}`) and
  verify it shows "Personal Project" (not "Created by …"), a flat chat list
  (not the 3-tab Personal/Published-to-Workspace/Shared-with-you layout), no
  "Publish to workspace" toggle on chat rows, and no "Members" entry in the
  floating side menu. On `/projects`, verify that same project's card shows
  a member count of 1, not the org's full roster. In `/souvenir-slack` (as
  an org admin), verify that project does **not** appear in the Slack
  channel-linking list. As an org admin, open Settings → Members → Invite,
  and verify your own Personal projects don't appear in the "add to
  project(s)" picker (bug 14). Finally, create a new Workspace or Shared
  project and confirm (via Mixpanel/network tab on the `project_created`
  event) that `team_shared` now reports `true` for it.
- **Unit tests**: `npx vitest run` from `front-end/` — should be 36 files /
  256 tests, all green (bug 15's fix + regression check).

## Bottom line

**Original (2026-09-03):**
- Biggest single gap: the owner-exit/successor flow — nothing exists on either side (no FE modal, no BE endpoint/state machine).
- Second biggest: the Shared-project membership permission model is backwards on the backend (owner-only today; spec wants any-collaborator) — a real BE change, not a FE-only tweak.
- Most mature areas already: chat sharing (`ChatShare`) and the Continue/fork flow.
- Backend was audited read-only per instruction — no backend code was modified.

**Superseded 2026-09-04 (mid-day):** both "biggest gaps" above are now
backend-complete (owner-exit/successor flow, and collaborator permissions).
The gap moved entirely to the frontend, which hadn't wired any of it up —
and two spots (`MoveToProjectModal`, the project-delete admin-bypass check)
now actively break for users because they were built against backend
behavior that no longer exists.

**Superseded again 2026-09-04 (later same day):** 5 of the frontend gaps
identified above are now built — leave-workspace/successor,
leave-project/collaborator, project-owner-exit, a project type picker at
creation, and a trash/restore view (see "Frontend built" section above the
Bottom line for what shipped, the bugs found+fixed along the way, and how to
test each). **Still open, unchanged by this build**: the two active bugs
(`MoveToProjectModal`, the delete admin-bypass), `ProjectMembersPanel` still
owner-only despite the backend now allowing any collaborator, chat archive
still a "coming soon" stub, the `/projects` list still using the old binary
Personal/Team filter instead of a real 3-way view, and the legacy-Teams
cross-cutting cleanup decision.

**Superseded again 2026-09-04 (later still):** the `/projects` list's binary
Personal/Team filter is now also a real 3-way Personal/Workspace/Shared
filter keyed on `visibility` (see "`/projects` list 3-way scope filter"
section above). The "3 types: Personal / Workspace / Shared" table row above
is now fully ✅. Everything else in the previous paragraph's "still open"
list is unchanged.

**Superseded again 2026-09-04 (yet another pass)**: a follow-up scan for the
same `teamId`-as-visibility-proxy bug class found it spread well beyond the
sidebar — `project/[id]/page.tsx` (5 spots), `projects/page.tsx`'s member
count, `souvenir-slack/page.tsx`'s Slack-linkable project list (a real
privacy leak), the invite modal's "add to project" picker, and the
`project_created` analytics stamp. All 6 fixed same-day (bugs 10–14 above).
The scan also turned up one new **undocumented pre-existing bug**, now added
to the Chats table: the "Publish to Workspace" chat toggle PATCHes a
`/chats/{id}/visibility` route that no longer exists on the backend — every
click 404s. Not fixed (pre-existing, out of scope). **Still open, unchanged**:
`MoveToProjectModal`, the delete admin-bypass (now known to have 3 copies,
not 2), `ProjectMembersPanel` owner-only, chat archive stub, and the
legacy-Teams cleanup decision.

**Superseded again 2026-09-04 (one more pass)**: ran the actual unit test
suite for the first time this session (`npx vitest run`, 36 files / 256
tests) instead of relying solely on `tsc --noEmit` + static review. Caught
one more real, pre-existing bug (#15): a stale test asserting the retired
`'private'` visibility value, dead since before this session started. Fixed;
full suite green. No regressions found from any of today's fixes.

**Superseded again 2026-09-05**: a dedicated diff-scoped review of today's
own fixes (not another pass over the original bug class, which is confirmed
exhausted) checked effect dependency arrays, boundary-condition polarity,
the `??` fallback semantics, and the new test's internal consistency across
every file touched today — all clean. The one thing it caught: a
newly-written comment in `lib/api/projects.ts`'s `normalizeProjectSummary`
("Falls back like teamId above") that was copy-pasted from
`projects-context.tsx`'s genuinely-different `existing`-value fallback and
didn't actually describe the trivial `?? null` default one line above it —
fixed to describe what the code actually does. No functional bug; this
session's own "comments drift from the code" pattern, caught in a comment
written today rather than an old one.
