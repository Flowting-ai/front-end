# Bug fixes tracker

Companion to [`souvenir-overall-flow-diagram.html`](./souvenir-overall-flow-diagram.html)'s
Bugs Tracker. That HTML doc is where every bug/missing-toast/dead-control finding lives with
full detail (one card per finding, filterable by section/severity); this file is the durable,
plain-text record of **which of those findings have actually been fixed in code**, so the list
survives outside any one browser's `localStorage`.

**How to use this file going forward:** whenever a bug from the flow-diagram doc gets fixed in
real code, add its entry to the bottom of this file (same format as below) and mark the matching
card in the HTML doc with a `<span class="bug-fixed-badge">✓ Fixed</span>` next to its title
(it appears in two places per bug — the section's own Bugs tab, and the global Bugs Tracker
overlay — update both). Keep entries in the order they were fixed, not by section, so this file
also works as a changelog.

When a real finding is reviewed but the user decides not to act on it (as opposed to a false
positive), tag it instead with `<span class="bug-skipped-badge">Skipped</span>` (same two spots)
and log it under a "Skipped" section here with the one-line reason. Don't add skipped IDs to the
Bugs Tracker's `BASELINE_RESOLVED` array — they're still open, just deliberately deferred.

Format per entry: **bug ID** · title · file location · what was wrong · why it mattered.

---

## Batch 1 — 32 fixed

### §1 Onboarding

- **s1-01 — Hello: save failure silently strands the user**
  `hello/page.tsx:149-167`
  `handleContinue` had a `finally` but no `catch`. If `updateUser`/`updateOnboarding` threw, the
  exception propagated uncaught — `isSaving` reset (button re-enabled) but the `push(...)` call
  after the try/finally never ran. No toast, no navigation — looked like the button did nothing.

- **s1-02 — Team Invite Profile: identical silent-stuck failure**
  `team/[inviteId]/profile/page.tsx:175-187`
  Same pattern as Hello — try/`finally`, no `catch`, no toast. (`tone/page.tsx:125-163` already
  did this correctly: catches, toasts, resets loading, only navigates on real success.)

- **s1-03 — Workspace: org rename can fail with zero indication**
  `workspace/page.tsx:88-103`
  A bare `catch {}` around the org-rename call (comment said "non-fatal") meant the user's
  company name could silently fail to save with no indication at all.

- **s1-04 — Import: the individual path's completion step fails silently**
  `import/page.tsx:93-97`
  `catch (err) { console.error(...) }`, no toast — on the completion step for the entire
  individual signup path, the highest-stakes silent failure in that flow.

- **s1-05 — WelcomeModal: trial activation failure is invisible**
  `WelcomeModal.tsx:370-378`
  Both failure branches of `handleStartTrial` (bad response status, thrown error) only
  `console.error`'d. "Start free trial" just stopped spinning with no explanation.

### §2 Chat

- **s2-01 — Chats list never loads a second page**
  `chats/page.tsx` + `use-chat-history.ts`
  The data hook exposed cursor-based `hasMore`/`loadMore`, but the page never called
  `loadMore`. Despite using a virtualizer (normally paired with infinite scroll), only the
  first page of chats could ever be seen.

- **s2-02 — A failed send just makes the message disappear**
  `ChatInterface.tsx` — `handleSend`
  `catch { rollbackLast(2) }` removed the optimistic user message and loading placeholder with
  no toast, no log, no explanation — the user's message just vanished.

- **s2-03 — Denied microphone permission is invisible**
  `ChatInput.tsx` — `startRecording`
  Permission failure was caught silently; the mic button just reset to idle with no indication
  of what went wrong or how to fix it.

- **s2-04 — A failed "Active shares" fetch is invisible**
  `ChatShareOverlay.tsx`
  `.catch(console.error)` only — every other action in the same component (create/revoke/copy)
  toasts on failure; this one just left the list empty with no indication anything went wrong.

### §3 Projects

- **s3-01 — Projects list: scope tab can drift from the URL**
  `projects/page.tsx`
  `?scope=` was read only once at mount (a `useState` initializer) and written via
  `router.replace` thereafter. A tab switch followed by browser Back could restore the URL's
  `?scope=` without re-syncing the already-mounted `scopeFilter` state — tab and URL visibly
  disagreeing until a hard reload.

- **s3-02 — New Project: Back icon and Cancel button exit differently**
  `projects/new/page.tsx`
  The top-left Back icon hard-navigated to `/projects`; the footer's Cancel button called
  `router.back()` instead — if the page was reached via a deep link, Cancel could send the user
  somewhere other than the projects list, unlike Back.

- **s3-03 — New Project: an invalid `?teamId=` fails without a word**
  `projects/new/page.tsx`
  If the pre-seeded team id didn't match an editable, non-archived team, the effect's condition
  just failed — the picker silently stayed on Private with zero indication the requested team
  was rejected.

- **s3-04 — Agents panel: a fetch failure just looks like "no agents"**
  `ProjectAgentsPanel/index.tsx`
  On fetch failure the component set an empty agent list with no toast and no visible error
  text — rendered identically to a project that genuinely has zero agents.

- **s3-05 — Team panel: roster load failure is console-only**
  `ProjectTeamPanel/index.tsx`
  A failed `listTeamEditors` call was caught and logged only — the panel resolved straight to
  "No team members yet.," indistinguishable from an actually-empty team.

- **s3-06 — Members panel: "Remove" gives no success confirmation**
  `ProjectMembersPanel/index.tsx`
  `handleAdd` showed `toast.success('Member added to project')`, but `handleRemove` only
  toasted on failure — a successful removal just updated the list with no positive feedback,
  asymmetric with its own Add counterpart.

### §4 Highlights

- **s4-01 — Cross-chat jump can report success when it only reached the message**
  `layout/HighlightSidebar.tsx`
  The two-phase poll (message element, then highlight mark) capped at ~10s and fell back to
  scrolling the message container if the mark never appeared — but the same
  `toast.success('Jumped to highlight')` fired regardless of which tier actually resolved, so a
  slow highlights-API response read as a successful jump even when the user only landed on the
  message.

- **s4-02 — Selection-popover Copy never confirms, unlike the saved-highlight Copy**
  `chat/ChatMessage.tsx` (`handleCopySelection`)
  Copying a raw text selection from the popover wrote to the clipboard with no success or
  failure toast, unlike `HighlightCard`'s Copy action which toasts on both outcomes.

### §5 Pinboard

- **s5-01 — Category/folder edits are local-only despite matching API endpoints existing**
  `context/pinboard-context.tsx`
  `updatePinCategory`, `updatePinFolder`, `addFolder`, `removeFolder`, and `renameFolder` all
  mutated context state only — no API call — even though `lib/api/pins.ts` fully implements
  `movePinToFolder`/`createPinFolder`/`deletePinFolder`/`renamePinFolder`. Edits didn't survive
  a reload/cache revalidation.

- **s5-02 — Deleting or duplicating a single pin gives no confirmation**
  `context/pinboard-context.tsx`
  `removePin`/`removePinByMessage` fired-and-forgot the delete API call with no toast in either
  direction, unlike the bulk delete/move actions in the organize view.

- **s5-03 — export-pins.ts has no unescaped-content or popup-failure feedback**
  `lib/export-pins.ts`
  Pin title/content/tags/chat-name were interpolated into the export HTML without escaping, and
  a silently-blocked popup had no user-visible failure state.

### §6 Agents

- **s6-02 — Tab-switch autosave failures are console-only, on every configure tab**
  Instructions / Profile / Knowledge / Connectors / Sharing pages
  Every tab's registered autosave showed `toast.success('Changes autosaved')` on success but
  only `console.error`'d on failure — switching tabs during a network hiccup lost the pending
  edit with zero user-visible indication.

- **s6-03 — Profile avatar: non-image files are rejected with no message**
  `agent/configure/components/ProfileTab.tsx`
  `if (!file.type.startsWith("image/")) return;` — a non-image drop/paste/pick just did
  nothing, with no error toast telling the user why.

### §7 Org settings

- **s7-01 — TeamScopedAccountModal shows "connected" after an OAuth timeout it just warned about**
  `org/connectors/page.tsx`
  On OAuth timeout, the catch block showed `toast.warning('OAuth flow timed out...')` — but
  execution then fell through unconditionally to `toast.success('{connector} connected for
  {team}')` and closed the modal, even though `attachSharedAccount` was skipped in that same
  failed branch. The account was never actually attached, and the user was told the opposite.

- **s7-02 — Activity Log's subtitle claims role-scoped data that doesn't exist**
  `org/activity/page.tsx`
  Copy switched between "All workspace actions across all members" (admin) and "Your activity
  in this workspace" (non-admin) — but `listAudit(orgId, {limit:100})` was called identically
  regardless of role, with no client-side filtering to match the narrower claim.

- **s7-03 — A member can vanish from the UI with no API call at all**
  `org/members/page.tsx`
  `handleRemove`/`handleRevokeInvite` ran their optimistic local removal, *then* checked
  `if (!orgId) return` — so in that edge case the row disappeared from the table with zero API
  call, zero toast, and zero rollback.

- **s7-04 — Role-change cleanup failures are fully swallowed, not even logged**
  `org/members/page.tsx` (`handleManageRole`)
  Every `removeTeamEditor`/`removeProjectMember` cleanup call inside a role change was wrapped
  in `.catch(() => {})` — no toast, no `console.error`. A failed cleanup could leave stale
  team/project grants with zero indication anything went wrong.

- **s7-05 — AddSharedAccountModal can stack a warning and a success toast for the same action**
  `org/connectors/page.tsx`
  On OAuth timeout with teams selected, a warning toast fired correctly, but if any teams were
  selected the code still fell into the success branch and showed `toast.success('Shared
  account created')` right behind it — technically true, but read as contradictory back-to-back
  messaging about the same operation.

### §8 Teams

- **s8-01 — A plain team member gets bounced from /teams/[teamId] with zero feedback**
  `teams/[teamId]/page.tsx`
  The `canEdit` gate redirected to `/chat` before first paint on failure — no toast, no "you
  don't have access" message, just a silent bounce.

- **s8-02 — Every read/list failure across the 4 team-settings tabs is console-only**
  `teams/[teamId]/page.tsx`
  Mutating actions (create project, link/unlink account, send request) all toast both ways —
  but the initial list fetch for every tab (projects, connections, requests, activity) only
  `console.error`'d on failure, with no user-visible indication a tab failed to load.

### §9 Standalone pages

- **s9-01 — The org entry point is missing an analytics call the settings entry point has**
  `(standalone)/org/change-plan/page.tsx`
  `trackBrowserEvent('checkout_started', {...})` fired in both handlers of
  `settings/billing/change-plan/page.tsx` but was entirely absent from the otherwise
  character-for-character identical org variant — checkout starts from the org entry point went
  completely untracked.

### §10 Personal Settings

- **s10-02 — Preferences violates React's rules of hooks**
  `settings/preferences/page.tsx`
  Two `useState` calls executed unconditionally, then an early `if (!mounted) return
  <Skeleton/>`, then two more `useState` calls after that return — the component called a
  different number of hooks depending on whether it was the first render or a later one, a
  textbook rules-of-hooks violation that can throw "Rendered more hooks than during the
  previous render."

- **s10-03 — Notifications' "Mute all" can desync a switch the UI says is permanently locked**
  `settings/notifications/page.tsx`
  The Billing card's bulk "Mute all" set `email: false` for every id in its group, including
  the two payment rows whose Email switch is supposed to be always-on and disabled — the switch
  stayed visually disabled/greyed but its underlying checked state flipped to unchecked,
  contradicting the static "cannot be disabled" copy right below it.

---

## Batch 2

### §1 Onboarding

- **s1-07 — "Know more about Role" — both copies are no-ops**
  `src/app/(onboarding)/onboarding/invite/page.tsx`
  Two separate instances of this link (footer-left and inline, next to the role picker) had
  empty placeholder `onClick` handlers — clicking either did nothing. Removed the redundant
  footer copy, kept the inline one next to the Role dropdown (the contextually useful spot),
  and replaced its dead click handler with a hover tooltip (info icon) explaining what "Member"
  and "Admin" each grant, reusing the same role descriptions already used on the org Members
  page.

- **s1-08 — "Finish setup," "Change image," both kebab menus**
  `src/app/(onboarding)/onboarding/workspace-setup/page.tsx`
  All four controls had no handler at all, but the whole page was unreachable — nothing else in
  the app ever links to `/onboarding/workspace-setup`. Verified: the "needs workspace setup"
  branch in `pricing/confirmation/page.tsx` actually routes to `/onboarding/workspace` (a
  different, live page); the comment there just described the step conceptually. Deleted the
  page and its directory entirely rather than wiring dead controls nobody could ever reach.

### Dismissed (not actually bugs)

- **s2-07 — ChatRow's "Scheduled" badge is never passed** — false positive. `ChatRow` is shared
  between the regular Chats list and Brain Threads; only Brain threads can be scheduled, and
  `brain/threads/page.tsx` does pass `scheduled={scheduledChatIds.has(thread.id)}` there. The
  Chats list correctly never passes it since chats aren't schedulable. No action needed.

- **s2-09 — Two top-level "+" menu rows close the whole menu** — confirmed intended behavior
  for the "Web search" row: the switch is just a status indicator, and closing the "+" attach
  menu after toggling it is the desired UX (same as "Add files or photos" closing the menu
  after picking it). No action needed.

- **s7-15 — Legacy single-account connector fields are never read** — false scope on the
  original finding. `workspace_linked`/`shared_account_id`/`account_options`/etc. are genuinely
  unread within `org/connectors/page.tsx` (as described), but they're part of the shared
  `ConnectorCatalogEntry` type, which `agent/configure/components/ConnectorsTab.tsx` and
  `brain/page.tsx` both read for real (per-agent connector permissions, connection status).
  Removing them from the schema would have broken those. No action needed.

- **s2-08 — A trailing StreamingCursor is hardcoded invisible**
  `src/components/chat/ChatMessage.tsx`
  A `<StreamingCursor isVisible={false} />` sat right after the finished-message content,
  hardcoded to never show — the real streaming indicator for this text is a separate
  `<BreathingDot>` a few lines up, already working correctly. `StreamingCursor` itself isn't
  dead as a component (it's genuinely used with a real `isStreaming` value in
  `ReasoningBlock.tsx`) — just this one redundant, always-off instance. Removed the dead
  instance and its now-unused import from `ChatMessage.tsx`.

- **s2-10 — No error state for a failed attachment upload**
  `src/components/chat/AttachmentManager.tsx`
  Three separate gaps, all fixed:
  1. `PendingAttachment.error` existed on the type but was never rendered anywhere — added a
     "Failed" badge (image chips) and a red error message line (document chips), plus a red
     border on the chip, whenever `.error` is set. Purely additive: `.error` is always
     `undefined` today (uploads here are a local progress simulation, not a real network call),
     so no existing rendering path changes — this just closes the gap for whenever a real
     failure signal reaches this component.
  2. The strip's drag-hover outline showed even while `disabled`, despite drops doing nothing
     in that state — `handleDragOver` now only arms the hover state when `!disabled`.
  3. Chips weren't clickable to preview — added `handlePreview`, which opens the local file in
     a new tab (images reuse their existing preview object URL; other types get one created on
     click and revoked after 30s).

- **s3-09 — "Archive" is disabled everywhere it appears**
  `src/components/ProjectCard/index.tsx`, `src/app/(app)/projects/page.tsx` (`ProjectListRow`),
  `src/app/(app)/project/[id]/page.tsx`
  All three Archive menu items were hardcoded `disabled` and wired to an empty
  `{/* backlog */}` stub — an intentionally shelved feature, not an oversight. Hid the buttons
  entirely per product direction: removed the `Archive` `Dropdown.Item` from all three menus,
  and cleaned up the now-dead `onArchive` prop from `ProjectCardProps`, `ProjectListRow`'s
  props, and the two call sites in `projects/page.tsx` that passed it.

- **s3-10 — Instructions panel's inline edit mode is unreachable**
  `src/components/ProjectInstructionsPanel/index.tsx`
  Confirmed with the user this wasn't a "make it reachable" case — the panel is meant to be
  preview-only with an edit button that opens `SystemInstructionsModal`, full stop. Removed the
  entire dead inline-editing code path: `editing`/`draft`/`saving` state, `handleSave`/
  `handleCancel`, the textarea branch, and the now-unused `maxLength` prop and `toast`/`Button`
  imports. The edit button now calls `onOpenEditor` directly.

- **s5-04 — `PinCommentItem` is defined but never rendered**
  `src/components/Pin/index.tsx`
  Confirmed the product intent is "1 comment per pin" — and the data layer
  (`updatePinComment` in `pinboard-context.tsx`) already enforces exactly that: it always
  collapses to a single-element `comments` array (editing the existing comment or replacing
  it), never actually accumulating a list. `PinCommentItem` was built for a comment-history
  list UI that was never needed under that design and never will be. Removed it entirely; the
  existing single-comment read/write behavior (`comments?.[0]`) is untouched.

- **s5-05 — export filename is computed but never actually used to save a file**
  `src/lib/export-pins.ts`
  The filename previously only ended up in a popup's `<title>` tag; whether a PDF actually
  resulted depended entirely on the user's own browser print dialog. Rebuilt the export to
  generate a real, downloaded PDF: added `jspdf` + `html2canvas` (new dependencies), render the
  same pin-card HTML off-screen, rasterize + paginate it into an actual PDF, and trigger a
  browser download under the already-computed filename. Replaced the old popup-window /
  popup-blocked-detection flow with `toast.promise` (loading → success with the real filename →
  error), since there's no popup left to fail.

- **s5-06 — 2,370 lines of dead code across 3 files**
  `src/components/layout/PinboardExpanded.tsx`, `src/components/layout/pinboardEnterAnimation.tsx`,
  `src/components/PinboardExpandedSkeleton/index.tsx`
  An earlier, self-contained rewrite of the expanded Pinboard view, superseded by the live
  `src/components/PinboardExpanded/index.tsx` (a separate directory) but never removed.
  Confirmed zero external consumers: `layout/PinboardExpanded.tsx` was imported nowhere, and it
  was the *only* importer of both `pinboardEnterAnimation.tsx` and `PinboardExpandedSkeleton`.
  Deleted all three files and the now-empty `PinboardExpandedSkeleton` directory (2,400 lines).
  Full-project `tsc --noEmit` clean.

- **s6-06 — RepublishModal is wired on three tabs and opened by none of them**
  `src/app/(app)/agent/configure/{instructions,profile,knowledge}/page.tsx` +
  `src/app/(app)/agent/configure/components/RepublishModal.tsx`
  Traced `handlePublish` fully: every publish (first-time or republish) already navigates to a
  full `/agents/published` confirmation page (`republished=true` flag distinguishes the two
  cases) — this modal was an earlier design for the same confirmation moment, superseded by
  that page, never deleted. Confirmed with the user it's genuinely redundant. Removed the dead
  `republishModalOpen` state, the modal's render block, and its import from all three tabs, then
  deleted `RepublishModal.tsx` itself once nothing referenced it. `handlePublish`'s actual
  publish logic and the `/agents/published` navigation are untouched.

- **s6-07 — Knowledge's "Connected" section can never render**
  `src/app/(app)/agent/configure/components/KnowledgeTab.tsx`
  Confirmed with the user: connecting a Drive/Slack/OneDrive source isn't a planned feature
  right now, just file uploads. Removed the whole dead "Connected" section: the
  `SOURCE_BUTTONS` filter chips, `activeConnectorFilter` state, the `connectedFiles` derivation,
  the `"connected"` member of `KnowledgeFile["type"]` (never produced anywhere), and the
  now-unused `ChevronDown` import. `filteredFiles` simplified back to a plain search filter.

- **s6-08 — Knowledge file preview has no trigger element**
  `src/app/(app)/agent/configure/components/KnowledgeTab.tsx`
  `handlePreviewFile` in `knowledge/page.tsx` was fully functional (3-tier blob resolution,
  passed down as `onPreview`) but `FileRow`'s "⋮" menu only ever offered "Delete." Added a menu
  item that calls `onPreview`. Verified the underlying behavior first: it opens a blob URL, not
  a forced download, but browsers only render PDFs/images/text/HTML/SVG/JSON/XML inline —
  Office docs, CSV, RTF, ZIP, and EPUB have no native viewer and download regardless. Added
  `isPreviewable()` (extension-based) so the menu item is correctly labeled "Preview" or
  "Download" per file instead of always claiming "Preview."

- **s6-09 — Every template's `modelHint` is defined and never read**
  `src/app/(app)/agents/_data/template-presets.ts`
  Traced why before touching it: `tone/page.tsx` unconditionally sets a
  `persona_wizard_no_model_${repoId}` flag for every new agent (template or custom), and
  `instructions/page.tsx` obeys it unconditionally too — forcing every agent to start with no
  model selected, regardless of what was seeded at creation. So `modelHint` couldn't be "wired
  up" to matter — it belongs to an older design where templates pre-selected a model, superseded
  by the current "user must always choose explicitly" rule. Confirmed with the user this was
  actually a removal, not a fix. Deleted the field from the `TemplatePreset` interface, its
  doc comment, and all 14 template entries.

- **s6-10 — One orphaned file, one dead tab**
  `src/app/(app)/agent/configure/components/ExampleConversationDialog.tsx`, `src/app/(app)/agents/page.tsx`
  Two separate things: `ExampleConversationDialog.tsx` had zero importers anywhere — deleted.
  The Agents hub's "Community" tab trigger was commented out (and `disabled` even if
  uncommented), with no `Tabs.Content` ever built for it and its mock `RECOMMENDED` persona
  array never rendered anywhere — confirmed `activeTab` can never actually become `'community'`
  since nothing sets it. Removed the commented trigger, the `'community'` member of `TabId`, and
  the dead `RECOMMENDED` mock array. Left the unrelated, real `visibility: 'private' | 'team' |
  'community'` persona field and its filter dropdown completely untouched — that's a live,
  separate concept (a persona's actual visibility scope), not part of this dead tab.

- **s7-14 — Unwired Search/Filter icon buttons appear identically dead in two separate tables**
  `src/app/(app)/org/analytics/page.tsx` (`MemberCapsTable`), `src/app/(app)/org/teams/[teamId]/page.tsx` (Team Members table)
  Neither button had any `onClick`, state, or effect — pure decoration. Built real
  functionality for both rather than removing them (user's call, since there was no existing
  logic to hook into): a toggleable search input (name/email substring match) and a role-filter
  dropdown (All/Owner/Admin/Member) via `Dropdown.Float`. Analytics' table filters its
  `members` prop locally; the team page adds a `visibleRoster` memo derived from the existing
  `roster` memo, used only in the render — the original unfiltered `roster` is left untouched
  everywhere else it's used (e.g. `rosterIds` for invite dedup). Distinct empty states: "No
  members yet" (roster genuinely empty) vs "No members match your search" (filtered to zero).

- **s8-05 — `setTeamEditorLink` — the update half of a create/update/delete triad, unused**
  **s8-06 — `getTeamInvitePreview` — superseded by a function that bypasses it**
  **s8-07 — `deleteTeamConnector` — zero callers**
  `src/lib/api/teams.ts`
  All three confirmed zero callers anywhere. Removed all three functions. For `getTeamInvitePreview`,
  also removed its two dedicated interfaces (`InvitePreviewResponse`, `TeamInvitePreview`) since
  neither was used elsewhere — but kept `TEAM_INVITE_PREVIEW_ENDPOINT` intact, since a different,
  still-live function (the "rich payload" onboarding one right below it) calls the same endpoint
  constant. Similarly kept `ORG_TEAM_CONNECTOR_ENDPOINT` since a live GET call still uses it.

### Skipped (real findings, left as-is per user decision)

These are genuine findings — not false positives — where a fix (or removal) was identified and
discussed, but the user chose to hold off. Marked in the HTML doc with
`<span class="bug-skipped-badge">Skipped</span>` (grey, distinct from the green "Fixed" badge)
on both copies of the card. Unlike "Fixed," these are **not** added to the Bugs Tracker's
`BASELINE_RESOLVED` seed list — they're still open issues, just deliberately deferred.

- **s1-09 — Back button's team-branch ternary is unreachable** — "keep it as it is."
- **s2-05 — ModelSelector.tsx — entirely unused** — "keep it hidden for now."
- **s2-06 — `highlightedCitation` can never become non-null** — turned out to be part of a
  larger dead `CitationsPanel` side-panel (superseded by the inline `SourceList`); user said
  "move on" rather than remove the whole cluster.
- **s4-04 — SelectionPopover's "Reply" action is fully built but never wired** — "keep it
  hidden" — the quote-reply feature has no implementation behind the button regardless.
- **s7-10 — Danger Zone (delete org, transfer ownership) is fully wired and never rendered** —
  user clarified delete is actually a soft delete and transfer-ownership doesn't exist on the
  backend yet, despite the frontend code looking complete. Left unrendered.
- **s7-11 — "Workspace defaults" card is hardcoded off** — user wasn't sure the backend
  actually supports `defaultChatVisibility`/`defaultPersonaVisibility` yet (`{false && (...)}`
  kill-switch left in place, uncertain whether it's safe to enable).
- **s7-12 — "Archive team" has a working handler and no button** — confirmed `archiveTeam`
  reuses the already-working `updateTeam` endpoint and the `archived` field is already live
  elsewhere (`LeftSidebar.tsx` filters on it) — strong evidence it's actually ready — but user
  said no changes anyway.
- **s7-13 — `approveOverflow()` has zero callers anywhere** — this is a missing admin UI (no
  page to list/approve pending credit-overflow requests), not a quick wire-up. Left the
  function in place for whenever that admin surface gets built.
- **s10-07 — "Delete account" is a fully stubbed, permanently disabled button** — already
  honestly labeled "Coming soon" with a real disabled state; user confirmed to keep as-is.

- **s10-01 — Four of nine personal-settings pages are invisible from the app, and none of
  them work** (marquee finding) — Files & Data, Notifications, Preferences, and Security are
  all commented out of the sidebar nav and fully non-functional (no API calls, no persistence,
  hardcoded mock data). User said skip for now.

- **s3-07 — Edit modal: no confirmed success toast for name/description/tag edits**
  `src/components/EditProjectModal/index.tsx`
  Neither the modal nor the shared `updateProject` context function toasted on success (only on
  failure). Added `toast.success('Project updated')` directly in the modal's `handleSave`,
  alongside the existing fire-and-forget `onSave(...)` call — kept the modal's existing
  optimistic-close behavior unchanged rather than restructuring it into an async/await +
  saving-state flow (a bigger change than what was asked for).

- **s3-08 — Files panel: no client-side size/type validation**
  `src/components/ProjectFilesPanel/index.tsx`, `src/hooks/use-file-upload.ts`
  Files were forwarded to `onUpload` raw; limits were only enforced server-side after a full
  upload round-trip. Exported `isAllowedType` from `use-file-upload.ts` (previously private) and
  reused it plus `FILE_CONSTRAINTS.maxSizeBytes` to validate before upload — oversized/
  unsupported files are now rejected client-side with a toast, matching the chat-attachment
  path's existing convention. Valid files are still forwarded via a real `FileList` (built with
  `DataTransfer`) so the `onUpload: (files: FileList) => ...` prop contract didn't need to
  change. Also added the missing `accept={FILE_ACCEPT}` to the file input (drag-and-drop still
  goes through the same runtime check, since `accept` only filters the native picker).

- **s6-05 — Super Links empty-state copy references a menu action that no longer exists**
  `src/components/SuperLinksEmpty/index.tsx`
  Copy told users to choose "Generate Super Link" from a card's menu; the actual current menu
  item is labeled "Share" (`PersonaCard/index.tsx:796`). Verified it's substantively accurate
  too, not just a label swap — `onMenuShare` routes to the agent's Configure → Sharing tab,
  which does contain the Super Link section. Updated the copy to say "Share".

- **s7-06 — "Export all" invoices is a fake action**
  `src/app/(app)/org/plans/page.tsx`
  Previously just `toast.success('Exporting all invoices…')` with nothing behind it. Each
  invoice already has a real `invoice_pdf`/`invoice_url` (used by the per-row "View" link) —
  no bundling endpoint exists (ZIP/combined PDF), so implemented the honest client-side version:
  opens every invoice's real link in its own tab, with a toast confirming the count, or "No
  invoices to export" if the list is empty.

## Batch 3 — (add future fixes here)

_Nothing yet — append new entries above this line as bugs from the flow-diagram doc get fixed._
