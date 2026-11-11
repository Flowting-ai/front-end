# Dropdown scrollbar-gutter fix

## Root cause

`Popover`'s `ScrollArea` (`src/components/Popover/index.tsx`) wraps dropdown
content in the `.kaya-scrollbar` class (`src/app/globals.css`), which sets
`scrollbar-gutter: stable`. That CSS rule unconditionally reserves space for a
scrollbar on the right side of the content — even when the content is short
and never actually overflows/scrolls. Any `<Dropdown>` that omits `maxHeight`
uses the default cap (`POPOVER_DEFAULT_MAX_HEIGHT`, currently
`min(380px, 100dvh - 32px)`) and pays this reservation regardless of whether
its own content ever gets close to that height.

`Popover` accepts `maxHeight={false}` to opt out of `ScrollArea` entirely and
render children directly — no scroll wrapper, no gutter reservation. This is
the same pattern `AccountMenu` (`src/components/AccountMenu/index.tsx`) already
used before this fix.

First noticed in `src/components/chat/ModelMenu.tsx` (the model-selector
dropdown), then confirmed to affect any other `<Dropdown>` whose content is a
short, fixed-length list that will never need to scroll.

## Fix

Added `maxHeight={false}` to every `<Dropdown>` whose content is a short,
fixed-length list (or which already manages its own inner scroll region,
making the outer `ScrollArea`/gutter redundant). Left untouched every
`<Dropdown>` whose content is genuinely dynamic/unbounded (project lists,
personas, members, tags, folders, search results) — those still need the
scroll cap.

## Fixed dropdowns (48 sites across 43 files)

| File | Dropdown |
|---|---|
| `src/app/(app)/agents/page.tsx` (2 sites) | Status filter (All/Active/Paused); Sort-by menu |
| `src/app/(app)/brain/BrainSidebarSections.tsx` | Sidebar task row menu (Rename/Pin task/Delete) |
| `src/app/(app)/project/[id]/page.tsx` | Project options menu (Edit/Leave) |
| `src/app/(app)/projects/new/page.tsx` | Project visibility picker |
| `src/app/(app)/projects/page.tsx` (4 sites) | Grid/List view toggle; Scope filter; Card options menu (Edit/Leave/Delete); Sort menu |
| `src/app/(app)/settings/(shell)/(org)/general/page.tsx` | Org visibility picker |
| `src/app/(app)/settings/(shell)/(org)/members/page.tsx` | Member role picker (Admin/Member) |
| `src/app/(app)/settings/(shell)/account/page.tsx` | Generic field dropdown (Tone / default model tier) |
| `src/app/(app)/settings/(shell)/files/page.tsx` | Generic field dropdown (max file size / retention) |
| `src/app/(onboarding)/onboarding/hello/page.tsx` | Role picker |
| `src/app/(onboarding)/onboarding/profile/page.tsx` (2 sites) | Role picker; Tone picker |
| `src/app/(onboarding)/onboarding/team/[inviteId]/profile/page.tsx` (2 sites) | Role picker; Tone picker |
| `src/app/(standalone)/org/change-plan/page.tsx` | Workspace/Core price-tier picker |
| `src/components/AgentsPanel/index.tsx` | Visibility filter |
| `src/components/ChatInput/index.tsx` (2 sites) | `DefaultAddMenu` fallback (Add files/Web search); `DefaultModelMenu` fallback |
| `src/components/ChatRow/index.tsx` | Chat row menu on `/chats` (Share/Rename/Pin/Move/Archive/Delete) |
| `src/components/ConnectorRequestModal/index.tsx` | Urgency picker |
| `src/components/ContactSalesModal/index.tsx` | Team-size picker |
| `src/components/HighlightPanel/index.tsx` | Filter mode (this chat / all) |
| `src/components/LibraryFilterButton/index.tsx` | Chats/Tasks mode picker |
| `src/components/PersonaCard/index.tsx` | Card options menu (Edit/Share/Pause/Copy & Edit/Delete) |
| `src/components/Pin/index.tsx` | Pin options menu (Duplicate/Export/Delete) |
| `src/components/Pinboard/index.tsx` (3 sites) | Category/Content-type filter submenu trigger list; Default sort menu; View + folders picker (already had its own inner scroll for folders — outer gutter was redundant) |
| `src/components/PinboardExpanded/index.tsx` (2 sites) | Folder row menu (Rename/Delete) — both list and expanded views |
| `src/components/ProjectCard/index.tsx` | Card options menu (Edit/Leave/Delete) |
| `src/components/ProjectChatRow/index.tsx` | Row menu (Rename/Unpublish/Create copy/Delete) |
| `src/components/ProjectMembersPanel/index.tsx` | Member picker (already had its own inner scroll — outer gutter was redundant) |
| `src/components/ShareModal/index.tsx` | Permission picker |
| `src/components/TeamSwitcherDropdown/index.tsx` (2 sites) | Per-team action flyout; Teams list (already had its own inner scroll+fade — outer gutter was redundant) |
| `src/components/chat/AddMenu.tsx` | Composer's "+" add menu (Add files/Web search/Use style/Add agent/Pin folders) |
| `src/components/chat/ModelMenu.tsx` | Model selector + Adaptive thinking (where this fix started) |
| `src/components/compare/CompareModels.tsx` | Tier filter |
| `src/components/connectors/AccountDetailView.tsx` | Permission picker |
| `src/components/connectors/ConnectionsView.tsx` (2 sites) | Type filter; Sort filter |
| `src/components/layout/LeftSidebar.tsx` (2 sites) | Sidebar chat row menu (Share/Rename/Pin/Move/Archive/Delete); Project-chat row menu (Rename/Delete) |
| `src/templates/Brain/ScheduleEditModal.tsx` | Day-of-week picker |

## Deliberately left untouched

Dropdowns with genuinely dynamic/unbounded content, or already explicitly
capped for a long list — these still need the scroll cap:

- Persona pickers (chat pages' `+` menu, `agent/configure`'s "Generate link" picker)
- Project member lists (`LeaveProjectModal`, `LeaveWorkspaceModal`)
- Pin tags list, pin-folders lists (`Pinboard`, `PinboardExpanded`)
- Slack channel → project mapping list (`SlackChannelMappingRow`)
- Style/tone submenu (12 items with 2-line subLabels — exceeds the default cap on its own, genuinely scrolls) — appears in `brain/page.tsx`, `chat/page.tsx`, `project/[id]/chat/[chatId]/page.tsx`, `project/[id]/page.tsx`, `ChatInput/index.tsx`, `chat/AddMenu.tsx`
- `agents/page.tsx`'s filter panel — mixes fixed sections with a data-driven "Model" section sized by however many distinct models are in use; could grow past the cap
- `settings/(shell)/(org)/activity/page.tsx`'s action-type filter — options are derived from distinct `action` values in the activity log; technically unbounded even though bounded in practice by the app's action vocabulary
- `src/components/PresetModelSelector/index.tsx` — confirmed orphaned/unused (never imported anywhere), not touched

## Reference: how to opt out

```tsx
// Short, fixed-length dropdown — no scrollbar ever needed:
<Dropdown maxHeight={false}>
  <Dropdown.Section fluid>
    <Dropdown.Item label="Option A" fluid />
    <Dropdown.Item label="Option B" fluid />
  </Dropdown.Section>
</Dropdown>
```

`maxHeight={false}` on `Popover`/`Dropdown` skips `ScrollArea` and renders
children directly — no `.kaya-scrollbar`, no `scrollbar-gutter: stable`, no
reserved right-side gap.
