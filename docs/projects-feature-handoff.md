# Projects Feature — Engineering Handoff
**Prepared for:** Kunal, Shyam  
**Prepared by:** Chai  
**Date:** 2026-05-11  
**Figma file:** [Kaya Design System](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System)  
**Fork workflow:** See `KDS May 19th fork.md` — all product code goes in `apps/souvenir/`

### Figma — direct screen links
| Screen | Link |
|---|---|
| 01 · Projects — landing | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3556-15929) |
| 01b · Projects — search (no results) | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3588-20610) |
| 02 · Projects — create new | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3570-37590) |
| 03 · Project — empty | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3588-24418) |
| 04 · Project — edit modal | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3588-25096) |
| 05 · Project — filled | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3588-25592) |
| 06 · Project — pinboard open | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3556-18017) |
| 07 · Chat inside project | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3586-19292) |
| [Component] ProjectCard states | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3473-23314) |
| [Component] ChatRow states | [Open](https://www.figma.com/design/VhtVr4Hhje26XKwc0E5uNP/Kaya-Design-System?node-id=3496-7347) |

---

## What is Projects

Projects is a workspace layer that sits above individual chats. A user creates a named project, attaches instructions (system prompt context) and files (shared knowledge), then starts chats inside that project. Every chat in the project inherits the instructions and file context automatically.

The right panel in a project view is persistent and toggles between three modes:
- **Instructions** — the project's system context
- **Files** — shared files for all chats in this project
- **Pinboard** — all pins saved from any chat in this project (uses the existing KDS `Pinboard` component)

---

## Fork Setup

All product code for this feature lives in your fork under `apps/souvenir/`. Do not modify anything in `src/components/` or `src/styles/`.

```
apps/souvenir/
  components/
    ProjectCard/
    ProjectChatRow/
    ProjectInstructionsPanel/
    ProjectFilesPanel/
  app/ (or pages/)
    projects/
      page.tsx           ← Projects landing
      new/page.tsx       ← Create project form
    project/[id]/
      page.tsx           ← Inside project (chat list + right panel)
      chat/[chatId]/
        page.tsx         ← Chat opened inside project
```

Sync upstream before starting:
```bash
git checkout main && git fetch upstream && git merge upstream/main && git push origin main
git checkout -b feat/projects
```

---

## Screens & Flow

### 01 · Projects — Landing
**Figma:** `node-id=3556-15929`

The main projects page a user lands on from the sidebar.

**Layout:**
- Left sidebar (existing KDS `Sidebar` component — already has projects section)
- Main area: heading "Projects" + `{n} Projects` count badge + Sort button + `+ New Project` button
- Search bar below heading
- "Start from a template" section — 3 template cards: **Product Design Sprint**, **Research Repository**, **Engineering Planning** (template flow is backlog — see §Backlog)
- Grid of `ProjectCard` components — 2 columns

**Interactions:**
- `+ New Project` → navigate to Create Project page (02)
- Clicking a `ProjectCard` → navigate to inside-project view (03/05)
- Search input → filters the grid in real time, hides template section. Empty state: *"No projects matching '{query}'"*
- Sort dropdown → Sort by: Recent, Alphabetical, Most active

**Copy:**
| Element | String |
|---|---|
| Page heading | `Projects` |
| Count badge | `{n} Projects` |
| Sort button | `Sort` |
| New project button | `+ New Project` |
| Search placeholder | `Search Projects...` |
| Templates section heading | `Start from a template` |
| Template names | `Product Design Sprint`, `Research Repository`, `Engineering Planning` |
| Search no-results | `No projects matching "{query}"` |

**KDS components used:**
- `Button` (variant `default`) — `+ New Project`
- `Badge` — project tag chips (Private, Research)
- `Chip` — template cards
- `Dropdown` + `DropdownMenuItem` — Sort dropdown

---

### 02 · Projects — Create New
**Figma:** `node-id=3570-37590`

Full-page form that replaces the main content area (no modal — the user loses the grid context intentionally; this is a deliberate commitment action).

**Layout:**
- Heading: `What's this project about?`
- `{n} Projects` count badge under heading
- Field 1: `What are we working on` → single-line text input
- Field 2: `What are we trying to achieve` → multiline textarea
- Helper text under field 2: `This becomes part of your project context.`
- Footer: `Cancel` button (ghost) + `Create project` button (primary)

**Interactions:**
- `Cancel` → back to landing (browser back)
- `Create project` (disabled until field 1 has content) → POST project → navigate to empty project view (03)
- The content from field 2 becomes the project's Instructions (pre-fills the Instructions panel)

**Copy:**
| Element | String |
|---|---|
| Page heading | `What's this project about?` |
| Field 1 label | `What are we working on` |
| Field 1 placeholder | `Name your project` |
| Field 2 label | `What are we trying to achieve` |
| Field 2 placeholder | `e.g. We're redesigning onboarding to improve activation. All related research and chats go here.` |
| Field 2 helper text | `This becomes part of your project context.` |
| Cancel | `Cancel` |
| CTA | `Create project` |

**KDS components used:**
- `InputField` — field 1
- `InputGroup` (or native `textarea`) — field 2
- `Button variant="default"` — Create project
- `Button variant="outline"` — Cancel

---

### 03 · Project — Empty
**Figma:** `node-id=3588-24418`

The state a user sees immediately after creating a project, before any chats exist.

**Layout — three zones:**

```
┌────────────────────────────────────────────────┬─────────────────┐
│  ← back arrow                                  │  Instructions   │
│  Project name                   ⋮  Share       │  panel          │
│                                                 │                 │
│  ┌─────────────────────────────────────────┐   │  Files          │
│  │  Ask anything, or use your voice...     │   │  panel          │
│  │                                [model ▼]│   │                 │
│  └─────────────────────────────────────────┘   │                 │
│                                                 │                 │
│  ┌──────────────────────────────────────────┐  │                 │
│  │ empty state message                      │  │                 │
│  └──────────────────────────────────────────┘  │                 │
└────────────────────────────────────────────────┴─────────────────┘
```

**Left zone:**
- Back arrow → returns to Projects landing
- Project title (large) + one-liner description (subtitle text — from Create form field 2)
- `⋮` icon button → dropdown: Edit, Archive, Delete
- `Share` button (ghost + icon)
- `ChatInput` component (existing KDS) — full width
- Empty state card below input (dashed border): *"Start a chat to keep conversations organized and re-use project knowledge."*
- Two floating `IconButton`s on the right edge of the left zone — gear (opens/focuses Instructions panel) and pin (opens Pinboard panel). These toggle the right panel mode.

**Right panel — Instructions tab (default when empty):**
- Section header `Instructions` + `+` IconButton
- Empty state copy: *"Add instructions to steer this project towards the right direction..."*

**Right panel — Files tab:**
- Section header `Files` + `+` IconButton  
- Empty state: upload icon + `Upload Files` label + *"Add files as shared knowledge for every chat in this project."*
- Dashed-border upload drop zone

**Copy:**
| Element | String |
|---|---|
| Empty state card | `Start a chat to keep conversations organized and re-use project knowledge.` |
| Instructions empty | `Add instructions to steer this project towards the right direction...` |
| Files empty heading | `Upload Files` |
| Files empty subtext | `Add files as shared knowledge for every chat in this project.` |
| ⋮ menu: Edit | `Edit` |
| ⋮ menu: Archive | `Archive` |
| ⋮ menu: Delete | `Delete` |

**KDS components used:**
- `ChatInput` — message input with model selector
- `IconButton` — `⋮`, `+` (Instructions), `+` (Files), gear, pin
- `Button` — Share
- `Dropdown` + `DropdownMenuItem` — ⋮ menu
- `Tooltip` — on the gear and pin floating buttons (label: `Instructions`, `Pinboard`)

---

### 04 · Project — Edit Modal
**Figma:** `node-id=3588-25096`

Triggered from the `⋮` menu → Edit. Overlays the current project view.

**Layout:**
- Modal title: `Edit`
- `×` close button (top right)
- `Name*` field — pre-filled with current project name
- `Description*` textarea — pre-filled with current description
- Footer: `Cancel` + `Save changes`

**Copy:**
| Element | String |
|---|---|
| Modal title | `Edit` |
| Name field label | `Name*` |
| Description field label | `Description*` |
| Description placeholder | `e.g. All discovery and design work for the V2 redesign` |
| Cancel | `Cancel` |
| CTA | `Save changes` |

> ⚠️ The CTA must say **"Save changes"**, not "Create project".

**KDS components used:**
- `Popover` (as modal shell) or KDS modal pattern
- `InputField` — Name
- `Button variant="default"` — Save changes
- `Button variant="ghost"` — Cancel

---

### 05 · Project — Filled
**Figma:** `node-id=3588-25592`

The project view once chats and files exist.

**Left zone:**
- Same header as empty state (back arrow, title, ⋮, Share)
- Project subtitle = user's one-liner description from Create form
- `ChatInput` — always visible at top for starting a new chat
- List of `ProjectChatRow` components below (see component spec below)
- Two floating `IconButton`s (gear + pin) — same as empty state

**Right panel — Files tab:**
- `Files  10 Files / 4 Urls` header with `+` button
- Capacity bar: `50 MB of 100 MB used` — slim `<progress>` element (blue fill)
- List of file rows (see `ProjectFilesPanel` component spec)

**Right panel toggle:**
The gear floating button focuses Instructions; the pin floating button opens Pinboard. Both are `IconButton` with `Tooltip`.

**KDS components used:**
- `ChatInput`
- `IconButton`
- `Tooltip`
- `Pinboard` (when pin button is active — see 06)

---

### 06 · Project — Pinboard Open
**Figma:** `node-id=3556-18017`

When the user clicks the pin floating button, or clicks a `{n} pins` badge on a `ProjectChatRow`, the right panel switches to the KDS `Pinboard` component.

**This is a direct mount of the existing `Pinboard` component.** No new component needed here.

**Wiring:**
```tsx
// When clicking "3 pins" badge on a chat row — pre-filter to that chat
<Pinboard
  pins={projectPins}
  view={selectedChatId ? `chat-${selectedChatId}` : 'all'}
  views={[
    ...DEFAULT_PINBOARD_VIEWS,
    ...projectChats.map(chat => ({ id: `chat-${chat.id}`, label: chat.title })),
  ]}
  onViewChange={(viewId) => { /* update filter */ }}
  onExport={handleExport}
  onOrganize={handleOrganize}
  onClose={() => setRightPanel('files')}
/>
```

The `Weekly planning ×` chip the user sees as the active filter is the Pinboard's built-in view-filter dropdown in its selected state — this is already handled by `PinboardProps.view`.

**KDS components used:**
- `Pinboard` (existing — `src/components/Pinboard/`)
- `Pin` (rendered inside Pinboard — `src/components/Pin/`)

---

### 07 · Chat Inside Project
**Figma:** `node-id=3586-19292`

When the user clicks a `ProjectChatRow`, the chat opens. The layout changes:

**Header changes:**
- The breadcrumb dropdown in the top bar shows: `{Project name} · {Chat name} ↓`
- Clicking the dropdown lets the user switch to another chat in the same project

**Sidebar changes:**
- The project item in the sidebar expands to show its sub-chats
- The active chat is highlighted

**Main area:**
- Chat thread (uses existing `MessageBubble` component)
- `ChatInput` at the bottom (existing KDS component)
- Three floating action buttons on right edge of chat area (vertically stacked):
  - Pin icon — pin a selection (triggers `SelectionPopover`)
  - Eye/Lens icon — focus mode (product decision needed)
  - Share icon — share this chat

**Right panel:**
- Pinboard opens by default when inside a project chat (shows `All pins` view)
- Can toggle back to Files or Instructions via the gear/pin floating buttons

**Copy:**
| Element | String |
|---|---|
| Header breadcrumb | `{Project name} · {Chat name}` |
| Input placeholder | `How can I help you today?` |
| Footer disclaimer | `Claude is AI and can make mistakes. Please double-check responses.` |

**KDS components used:**
- `MessageBubble` — chat messages
- `ChatInput` — input area
- `SelectionPopover` — pin/highlight on text selection
- `Pinboard` — right panel
- `IconButton` + `Tooltip` — floating action buttons

---

## New Components to Build

All of these go in `apps/souvenir/components/`. They are product-specific and should not be added to `src/components/` initially. If they prove canonical (used in 3+ product surfaces), file an issue with Uttkarsh to promote upstream.

---

### `ProjectCard`
**Location:** `apps/souvenir/components/ProjectCard/`  
**Figma:** `node-id=3473-23314` (component states sheet)

Card shown in the projects grid on the landing page.

```tsx
interface ProjectCardProps {
  /** Project display name. Truncates to 2 lines. */
  title: string
  /** Short description text. Truncates to 3 lines. */
  description?: string
  /** Tag chips shown below the title (e.g. "Private", "Research"). */
  tags?: Array<{ label: string; color?: BadgeColor }>
  /** Relative or absolute time string. e.g. "Updated Last month" */
  updatedAt: string
  /** Number of chats in this project. */
  chatCount: number
  /** Called when the ⋮ button is clicked. Wire to a Dropdown. */
  onMenuClick?: (e: React.MouseEvent) => void
  /** Called when the card body is clicked. */
  onClick?: () => void
}
```

**States (Figma node-id=3473-23314):**
- **Default** — no ⋮ button visible
- **Hover** — ⋮ button appears, subtle background tint
- **Active/Focused** — blue border ring (used when card is the last active project)
- Card is a `<button>` or `role="button"` div with `tabIndex={0}`

**KDS components used internally:**
- `Badge` — tag chips
- `IconButton` — ⋮ button (hidden by default, visible on hover via CSS `group-hover`)
- `Dropdown` + `DropdownMenuItem` — ⋮ menu content (Edit / Archive / Delete)

---

### `ProjectChatRow`
**Location:** `apps/souvenir/components/ProjectChatRow/`  
**Figma:** `node-id=3496-7347` (states sheet)

A single row in the project's chat list.

```tsx
interface ProjectChatRowProps {
  /** Chat title. */
  title: string
  /** Relative timestamp. e.g. "Just now", "2 days ago" */
  timestamp: string
  /** Number of pins in this chat. 0 = "No pins" state. */
  pinCount: number
  /** Called when the row is clicked (opens the chat). */
  onClick?: () => void
  /** Called when the pins badge is clicked. Opens Pinboard filtered to this chat. */
  onPinsClick?: (e: React.MouseEvent) => void
  /** Called when the ⋮ menu is opened. */
  onMenuClick?: (e: React.MouseEvent) => void
  /** Controlled active state (true when this chat is open). */
  active?: boolean
}
```

**States (Figma node-id=3496-7347):**
- **Default** — white background, no ⋮
- **Hover** — warm tint background, ⋮ button appears
- **Active** — blue border ring + tint (current open chat)
- **No pins** — pin badge shows "No pins" in greyed-out style, not clickable
- **{n} pins** — pin badge is clickable, fires `onPinsClick`
- **Empty state row** (at bottom of list, not a real row) — dashed border: *"Start a chat to keep conversations organized and re-use project knowledge."*

**KDS components used internally:**
- `IconButton` — ⋮ (hover-revealed)
- `Chip` or `Badge` — pins count badge
- `Dropdown` + `DropdownMenuItem` — ⋮ menu

---

### `ProjectInstructionsPanel`
**Location:** `apps/souvenir/components/ProjectInstructionsPanel/`  
**Figma:** Right panel on nodes 3588-24418 (empty) and 3588-25592 (filled)

The Instructions section of the right panel.

```tsx
interface ProjectInstructionsPanelProps {
  /** Current instructions text. Empty string = empty state. */
  value: string
  /** Called when the user saves edited instructions. */
  onSave: (text: string) => void
  /** Max character count. Default 2000. */
  maxLength?: number
}
```

**States:**
- **Empty** — no text, shows placeholder: *"Add instructions to steer this project towards the right direction..."*, `+` button in header
- **Filled** — shows text truncated with pencil edit icon in header corner
- **Editing** — textarea expands, char count shown (`{n} / 2000`), Save + Cancel buttons appear

**KDS components used internally:**
- `IconButton` — pencil edit, `+`
- `Button variant="default"` size sm — Save
- `Button variant="ghost"` size sm — Cancel

---

### `ProjectFilesPanel`
**Location:** `apps/souvenir/components/ProjectFilesPanel/`  
**Figma:** Right panel on nodes 3588-24418 (empty) and 3588-25592 (filled)

The Files section of the right panel.

```tsx
interface ProjectFile {
  id:         string
  name:       string       // e.g. "research-brief.pdf"
  type:       string       // e.g. "PDF", "FIG", "MD", "URL"
  sizeLabel:  string       // e.g. "1.2 MB"
  uploadedAt: string       // relative time
}

interface ProjectFilesPanelProps {
  files:     ProjectFile[]
  /** Current bytes used. */
  usedBytes: number
  /** Total capacity in bytes. */
  totalBytes: number
  /** Called when the user triggers file upload (click or drop). */
  onUpload?: (files: FileList) => void
  /** Called when the user removes a file. */
  onRemove?: (fileId: string) => void
}
```

**States:**
- **Empty** — upload icon + *"Upload Files"* + *"Add files as shared knowledge for every chat in this project."* + dashed-border drop zone
- **Filled** — header shows `{n} Files / {m} Urls`, capacity bar below header, list of file rows
- **Capacity bar** — `<progress>` element, blue fill, `{usedMB} MB of {totalMB} MB used` label

**KDS components used internally:**
- `Badge` — file type badge (PDF red, FIG blue, MD dark, etc. — reuse `ChatThumbnail` badge color logic if extractable)
- `IconButton` — remove file (`×`)

---

## Data Model

These are the minimal shapes the UI needs. Exact API contracts are for Kunal/Shyam to decide.

```ts
interface Project {
  id:           string
  name:         string
  description:  string          // one-liner, from create form
  instructions: string          // full system context for all chats
  tags:         ProjectTag[]
  files:        ProjectFile[]
  chatCount:    number
  updatedAt:    string          // ISO timestamp
  createdAt:    string
}

interface ProjectTag {
  id:    string
  label: string
  color: BadgeColor             // from KDS Badge
}

interface ProjectFile {
  id:         string
  name:       string
  type:       'PDF' | 'DOC' | 'FIG' | 'MD' | 'URL' | string
  sizeBytes:  number
  uploadedAt: string
  url:        string
}

interface ProjectChat {
  id:        string
  projectId: string
  title:     string
  pinCount:  number
  createdAt: string
  updatedAt: string
}

// Pins are the existing KDS Pin model
interface ProjectPin {
  id:          string
  projectId:   string
  chatId:      string           // which chat this pin came from
  chatTitle:   string
  category:    PinCategoryType  // from KDS Pin
  pinTitle:    string
  description: string
  labels:      PinLabel[]       // from KDS Pin
  createdAt:   string
}
```

---

## Using the Existing Pinboard Component

The `Pinboard` component (`src/components/Pinboard/`) is already built and handles the entire pinboard panel. You wire it like this:

```tsx
import { Pinboard, DEFAULT_PINBOARD_VIEWS } from '@/components/Pinboard'

// Build the views list: default views + one per chat in this project
const pinboardViews = [
  ...DEFAULT_PINBOARD_VIEWS,
  ...projectChats.map(chat => ({
    id:    `chat-${chat.id}`,
    label: chat.title,
  })),
]

// Map your API pin objects to KDS PinboardPin shape
const pinboardPins = projectPins.map(p => ({
  id:          p.id,
  category:    p.category,
  pinTitle:    p.pinTitle,
  description: p.description,
  labels:      p.labels,
  chatName:    p.chatTitle,
}))

<Pinboard
  pins={pinboardPins}
  views={pinboardViews}
  view={activeChatFilterId}        // 'all' or 'chat-{id}'
  onViewChange={(id) => setActiveChatFilterId(id)}
  onExport={handleExport}
  onOrganize={handleOrganize}
  onClose={() => setRightPanel('files')}
  fluid                            // fills the right panel width
/>
```

When the user clicks a `{n} pins` badge on a `ProjectChatRow`, set `activeChatFilterId` to `chat-{chatId}`. The Pinboard handles the filter UI automatically.

---

## Right Panel Toggle Logic

The right panel has three modes: `'instructions' | 'files' | 'pinboard'`. The two floating icon buttons (gear = instructions, pin = pinboard) plus the panel's own tab-like header handle switching.

```tsx
type RightPanelMode = 'instructions' | 'files' | 'pinboard'

const [rightPanel, setRightPanel] = useState<RightPanelMode>('instructions')

// Floating buttons
<IconButton onClick={() => setRightPanel('instructions')} tooltip="Instructions" />
<IconButton onClick={() => setRightPanel('pinboard')} tooltip="Pinboard" />

// Right panel renders
{rightPanel === 'instructions' && <ProjectInstructionsPanel ... />}
{rightPanel === 'files'        && <ProjectFilesPanel ... />}
{rightPanel === 'pinboard'     && <Pinboard ... />}
```

The panel header tabs (Instructions / Files) allow switching between those two within the right panel. Pinboard is opened via the floating pin button or by clicking `{n} pins` on a chat row.

---

## Sidebar Changes

The existing `Sidebar` component (and `SidebarProjectsSection`) needs to support two states:

1. **Projects listed** — shows flat list of project items under "Projects" section header
2. **Project expanded** — when inside a project chat, the project item expands to show its sub-chats as indent-children

Check the existing `SidebarProjectsSection` component — it may already support this. If not, file an issue with Uttkarsh:

> **Component request: Sidebar project sub-chat expansion**  
> When the user is inside a project chat, the project item in the sidebar should expand to show its chats as indented children. Current `SidebarProjectsSection` only shows flat project names.  
> Figma: node-id=3586-19292 (left sidebar, see how "Souvenir V2 Product Design" is expanded with sub-chats).

---

## Complete Copy Reference

Every string, placeholder, and label in the feature:

### Projects Landing
- Page title: `Projects`
- Count: `{n} Projects`
- Sort button: `Sort`
- Primary CTA: `+ New Project`
- Search placeholder: `Search Projects...`
- Templates heading: `Start from a template`
- Template 1: `Product Design Sprint`
- Template 2: `Research Repository`
- Template 3: `Engineering Planning`
- No-results: `No projects matching "{query}"`
- *(During search, hide templates section or label it "Or start from a template")*

### Create Project
- Heading: `What's this project about?`
- Field 1 label: `What are we working on`
- Field 1 placeholder: `Name your project`
- Field 2 label: `What are we trying to achieve`
- Field 2 placeholder: `e.g. We're redesigning onboarding to improve activation. All related research and chats go here.`
- Field 2 helper: `This becomes part of your project context.`
- Cancel: `Cancel`
- CTA: `Create project`

### Edit Project Modal
- Title: `Edit`
- Name label: `Name*`
- Description label: `Description*`
- Description placeholder: `e.g. All discovery and design work for the V2 redesign`
- Cancel: `Cancel`
- CTA: `Save changes`

### Project View — Header ⋮ Menu
- `Edit`
- `Archive`
- `Delete`

### Project View — Empty Chat State
- `Start a chat to keep conversations organized and re-use project knowledge.`

### Instructions Panel
- Empty placeholder: `Add instructions to steer this project towards the right direction...`
- Char count: `{n} / 2000`
- Save: `Save`
- Cancel: `Cancel`

### Files Panel
- Empty heading: `Upload Files`
- Empty subtext: `Add files as shared knowledge for every chat in this project.`
- Filled header: `Files  {n} Files / {m} Urls`
- Capacity: `{n} MB of {total} MB used`

### Chat Inside Project
- Breadcrumb: `{Project name} · {Chat name}`
- Input placeholder: `How can I help you today?`
- Footer: `Claude is AI and can make mistakes. Please double-check responses.`

---

## What the Pinboard Already Handles (Don't Rebuild)

The following are all built into the existing `Pinboard` component — do not recreate them:

- Filter dropdown (All pins / Recent / This chat / by folder)
- Sort dropdown
- Search icon button
- Export button + callback
- Organize / expanded view
- Per-pin ⋮ menu (Duplicate, Export, Delete)
- Tag add/delete on Pin cards
- Collapse all
- Drag-to-expand Pin cards

---

## Backlog (Not for May 19)

- **Template selection flow** — clicking a template on the landing pre-fills the Create form. Needs a defined set of template objects with name + instructions + suggested tags.
- **File upload progress** — spinner / progress bar in FilesPanel while a file is uploading.
- **Project sharing** — the Share button opens a share sheet. Not designed yet.
- **Project color variants** — the 4 KDS card colors (sand/lavender/sky/sage) are planned for ProjectCard to aid visual identification. Not in current Figma screens.

---

## Figma Screen Index

| Frame | node-id | Description |
|---|---|---|
| 01 · Projects — landing | `3556-15929` | Populated grid + template section |
| 01b · Projects — search | `3588-20610` | No-results search state |
| 02 · Projects — create new | `3570-37590` | Create project form |
| 03 · Project — empty | `3588-24418` | Empty chats, empty instructions, empty files |
| 04 · Project — edit modal | `3588-25096` | Edit overlay (name + description) |
| 05 · Project — filled | `3588-25592` | Chat list + file list + capacity bar |
| 06 · Project — pinboard open | `3556-18017` | Pinboard panel with chat filter active |
| 07 · Chat inside project | `3586-19292` | Open chat + project breadcrumb + pinboard |
| [Component] ProjectCard states | `3473-23314` | Default / hover / active / focused |
| [Component] ChatRow states | `3496-7347` | Default / hover / active / no-pins / {n}-pins |
