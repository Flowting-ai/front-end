# 03 Components (shadcn primitives, our look, Library layout)

## 1. How we use shadcn here

The repo is Radix + Tailwind + CSS variable tokens (`src/styles/tokens`), with bespoke components in `src/components/*` and exactly one shadcn-shaped file, `src/components/ui/button.tsx` (cva variants, `cn`, `@radix-ui/react-slot`, flat primary using our tokens, other variants delegating to legacy `Button`/`IconButton`). There is no `components.json` yet. We follow that precedent:

1. Add `components.json` (style `new-york`, `rsc: true`, `tsx: true`, aliases `@/components`, `@/lib/utils`, `@/components/ui`, **no CSS variables theme block**; keep our `tokens/*.css` as the only theme).
2. Add shadcn primitives with the CLI into `src/components/ui/`, then **rewrite their classNames to our tokens** (`var(--border-default)`, `--field-surface`, `--button-*`, radius 8 for controls, 16 for cards, shadow `--shadow-button-secondary-outer`, focus `--focus-ring`). A generated file is not done until it contains no shadcn default colour (`bg-primary`, `text-muted-foreground`, ...).
3. **Reuse before adding.** If a legacy component already does the job and looks right, wrap it in `ui/` or import it directly; do not ship two Switches. Audit result:

| Need | Decision |
|---|---|
| Button, IconButton | existing `ui/button.tsx` (default = black pill primary; ghost, outline, danger via legacy) |
| Dialog / modal | **add** shadcn `dialog` and `alert-dialog` (Radix Dialog already installed); keep `ConfirmModal` for simple confirms, built on the new alert-dialog |
| Dropdown / row menu | **add** shadcn `dropdown-menu` (`@radix-ui/react-dropdown-menu` installed); legacy `Dropdown`/`FloatingMenu` stay for existing screens |
| Popover (Filter panel, Sort) | **add** shadcn `popover` (legacy `Popover` exists; check parity first and wrap if it fits) |
| Tabs | **add** shadcn `tabs` styled as pill chips (active = filled grey, rest plain text); legacy `Tabs`/`TabItem` are underline style and stay |
| Tooltip | wrap existing `Tooltip` (Radix) |
| Checkbox, Switch | existing `Checkbox`, `Switch` (Radix) |
| Avatar | existing `Avatar`; add the `AccessAvatars` composite |
| Badge, Chip | existing `Badge`, `Chip`, `ChipButton` |
| Skeleton | existing `Skeleton` |
| Toast | existing `sonner` + `UndoToast` |
| Table | **add** shadcn `table` (semantic table markup, 50px rows); `SettingsTable` stays for settings |
| Command (picker search list) | **add** shadcn `command` (`cmdk`) only if the picker needs keyboard list nav beyond a plain listbox; otherwise a Radix-free list is fine. Decide at build; default: no new dep |
| Radio group (transfer question, auto-save) | **add** shadcn `radio-group` (`@radix-ui/react-radio-group`) |
| Select (auto-save, limits) | **add** shadcn `select` or reuse `Dropdown` single-select; prefer `Dropdown` to avoid a second select style |
| Breadcrumb | **add** shadcn `breadcrumb` (Library > Trash) |
| Progress | **add** shadcn `progress` (storage bar, upload %); reuse `TokenBudgetBar` styling where it matches |
| Scroll area | existing `@radix-ui/react-scroll-area` wrapper if present, else add |
| Input, Textarea | existing `InputField`; add shadcn `input` only for the search pill if `SearchFieldRing` cannot be reused (try it first) |
| Separator | existing `Divider` |

New npm deps expected: `@radix-ui/react-alert-dialog`, `@radix-ui/react-radio-group`, `@radix-ui/react-select` (only if chosen), `cmdk` (only if chosen). Everything else is installed.

Icons: `@strange-huge/icons` first (house icon set), `@hugeicons/*` second. The prototype used `lucide-react`; map each lucide icon to the house set and list gaps (sparkle, building, trash, filter) so design can supply them rather than mixing sets.

## 2. Component inventory

Folder: `src/components/library/`. Each entry: purpose, props sketch, states it must cover (L = loading, E = empty, X = error), source in the prototype.

### 2.1 Page shell
| Component | Purpose | Notes |
|---|---|---|
| `LibraryScreen` | client orchestrator: reads URL state, owns queries, renders header + body | prototype `LibraryPage` |
| `LibraryHeader` | title, `StorageLabel`, `LibrarySearch`, Filter and Sort buttons, `TrashButton` | one row; sticky |
| `StorageLabel` | "1.93 GB used" beside title on every tab | L: skeleton text. Never blocks the page. |
| `LibraryTabs` | pill tabs Suggested / All files / Shared (Shared conditional) | shadcn `tabs`; keeps URL in sync |
| `TrashButton` | ghost trash icon button at far right | opens `/library/trash` |
| `LibrarySearch` | search pill + `ScopeChip` ("In All files" / "All of Library") | debounced, abortable |
| `FilterPanel` / `FilterChips` | two sections (Source, File type) in a popover; at most two chips beside the button | nothing ticked = all |
| `SortMenu` | Name / Created (or Date shared), asc/desc | |

### 2.2 Lists
| Component | Purpose | States |
|---|---|---|
| `FileTable` | semantic table, sortable headings with `aria-sort`, 50px rows, virtualised past ~200 | L: `FileTableSkeleton` (8 rows), E: `NoFiles`, X: `ListError` with Retry |
| `FileRow` | one row: `FileNameCell`, `AccessCell`, source, created, type, `RowMenu` | unread, generated, trashed variants |
| `FileNameCell` | glyph + name + `GeneratedMark` + `UnreadDot`; semibold when unread | truncates with tooltip via `tipWhenCut` equivalent |
| `AccessCell` / `AccessAvatars` | owner first, then one, then "+N", or workspace building | tooltip text from `accessTip` |
| `SourceCell`, `TypeCell` | text + icon, never colour alone | |
| `RowMenu` | Share, Rename, Download, Delete (red); disabled with tooltip for viewers | shadcn `dropdown-menu` |
| `SearchResults` | rows with snippet, scope label, "no results", "search unavailable" | |
| `SharedList` | All-files table variant with Date shared and sharer in Access | appears only when non-empty |

### 2.3 Suggested
| Component | Purpose |
|---|---|
| `SuggestedView` | composes the three sections, hides empty ones, skips duplicates |
| `RecentRow` + `RecentCard` | white card, 16px radius, soft shadow, title up to two lines, centred type glyph, one quiet line ("Opened 5:50 PM", "Shared 2d ago") |
| `FileTileList` + `FileTile` | compact tiles (max 3) for Frequently used and Generated, no file type |
| `SuggestedSkeleton` | card and tile skeletons matching final heights |

### 2.4 File page
| Component | Purpose |
|---|---|
| `FileScreen` | fetches detail, picks state, lays out sheet + side card + dock |
| `FileTitlePill` | type icon, name, chevron menu (full name + "Library", File info) |
| `FileToolbar` | zoom, download, Share, close |
| `FilePreview` | switch by format: `DocumentPreview`, `SheetPreview`, `ImagePreview`, `AudioPlayer` (+ `TranscriptList`), all accept a `cite` locator and scroll/highlight it |
| `CitedText` | renders the highlighted passage using `HighlightMark` |
| `FileInfoCard` | Type, Updated, Created, Size, Your access, provenance line |
| `ProvenanceLine` | "Uploaded in chat X" etc. with links the viewer may follow |
| `UsedInList` | chats and routines (and "+N you cannot see") |
| `AccessList` | Who has access with owner row, people, workspace; Remove action for owner/Admin |
| `FileStateBanner` | uploading, processing, trashed (Restore), shows `daysLeft` |
| `LockedState` | locked page + Request access button (becomes "Request sent") |
| `GoneState` | "No longer available" |
| `AskDock` | composer-styled link that hands off to `/chat?libraryFileId=` |
| `FileSkeleton` | sheet skeleton |

### 2.4b Trash
`TrashScreen` (breadcrumb, `TrashBanner` with Empty Trash and freed size, `TrashTable` with Name, Days left, Size, Deleted, row menu Restore / Delete forever), `TrashEmpty` ("Trash is empty. Items moved to Trash will be deleted forever after 30 days.").

### 2.5 Dialogs (all on shadcn `dialog` / `alert-dialog`, footer: text Cancel left, one primary right)
| Component | Notes |
|---|---|
| `ShareDialog` | add person (typeahead over org members, excludes owner and existing), "Who has access" list (owner, people, workspace) with Remove, "Add whole workspace" row, Done. One file at a time. Shows ways in. |
| `RevokeDialog` | confirm removing a grant; warns if a workspace grant remains |
| `RenameDialog` | single input, extension preserved, validates empty and length 255 |
| `DeleteFileDialog` | usage-aware: lists chats citing it and routines using it; primary "Delete" red |
| `DeleteForeverDialog`, `EmptyTrashDialog` | irreversible copy, shows freed size |
| `DeleteChatDialog` addition | checkbox "Also delete these files" |
| `AskSaveDialog` | per-message "Save these files to Library?" (Ask each time mode) |
| `PickerDialog` | "Add from Library": search pill, type chips, rows with tile/name/date, multi-select, footer "N selected / Cancel / Add to chat"; ~680px wide |
| `RemoveMemberDialog`, `LeaveWorkspaceDialog` | Admin confirm; leaver's locked `TransferQuestion` (radio group: transfer / delete, with the explanatory line). Reuse existing `LeaveWorkspaceModal` shell. |
| `RequestAccessConfirmation` | inline, not a dialog |
| `DeleteRoutineDialog` (in `schedules/`) | adds the unchecked option "Also delete its N run outputs" (N from a dry run) |
| `ImportToLibraryDialog` | see 2.7b |

### 2.6 Composer integration (touches existing components)
| Component | Change |
|---|---|
| `ChatInput` | `+` menu gets "Add from Library"; attachments row uses `AttachmentCard`; Send disabled until all ready with tooltip; upload failure message strip above composer (auto-clears 6 s, `aria-live="polite"`) |
| `AttachmentCard` (new, in `components/library` or `ChatInput/`) | name and file type only, status icon + word (Uploading 42% / Processing / Ready), Cancel/Remove |
| `UploadFailureNotice` | the 6-second message |
| `SourcesPanel` addition | marks cited sources, per-source off switch |
| `SourceCitation` (existing) | Library file chips: name only, locked and deleted variants, opens `/library/files/{id}?cite=` |
| Routine editor in `schedules/` | "Attach from Library" opens `PickerDialog` with `target: routine`; pane shows skipped-file notice |

### 2.7 Settings
| Component | Notes |
|---|---|
| `LibrarySettingsPage` (personal) | auto-save select, "Use my Library" switch, `StorageBlock`, Leave workspace. Uses `SettingsPageShell` |
| `AdminLibrarySettings` | default auto-save, force-off switch, AI reference switch, file size and type limits, `StorageBlock`, link to Members |
| `StorageBlock` | "X of Y used" + `Progress` + rows (Files, Images, Audio). Sample figures until backend limits exist |
| `MembersTable` | name, role, files count, Remove (Admin only; the only Admin cannot be removed) |
| `AuditPlaceholder`, `InventoryPlaceholder` | static Phase 2 pages |

### 2.7b Components added from the PRD edge cases
| Component | Purpose | PRD id |
|---|---|---|
| `UploadStatusNotice` | inline on the attachment card and the composer strip: "Upload paused. It will continue when you are back online." and "This is taking longer than usual." (after 10 min) with Remove | CAP-15, CAP-17 |
| `SaveRetryNotice` | after send, when promotion to Library fails: "Couldn't save to Library. Trying again." then **Save again**; the file shows `NotInLibraryBadge` if retries are exhausted | CAP-1 |
| `NotInLibraryBadge` | on the chat attachment chip only; never appears in Library lists | CAP-1 |
| `UndoSaveToast` | "Saved to Library" with Undo for 10 s; Undo keeps the file attached to that message only | CAP-10 |
| `NotSearchableBadge`, `PartialReadBadge` | on the File page header and the row tooltip when text could not be read (see OQ-9 for whether these ship) | CAP-17 |
| `ScopeLabel` | File page label Private / Shared (names) / Workspace | PRD Understanding |
| `AiGeneratedTag` | small tag after the title of an AI-named output until the owner renames it | ORG-6 |
| `SourcesUsedList` | list ending an answer, with the cited files | FIND-22/23 |
| `NotFromFilesMarker` | marks a general (not sourced) part of an answer; and "I couldn't find this in your files." | FIND, section 11 |
| `TooManyFilesNotice` | "Too many files to read at once." plus which best matches were used | section 6 |
| `ApprovalCard` (existing) + `sourceFile` prop | confirmation for an action that followed from reading a file; **names the document that prompted it** | section 11 |
| `SettingsChangedNotice` | one-time banner for members: what an Admin changed | section 10 |
| `ChangedByNotice` | inline on an Admin setting: "Changed by Priya just now" | section 10 |
| `KillSwitchNotice` | disabled state with reason when auto-save, AI use of Library or sharing is switched off at workspace level | section 12 |
| `ImportToLibraryDialog` | opt-in import of past chat files and delivered routine outputs (counts, per-source choose, progress) | section 12 |
| `LastAdminGuard` | in `MembersTable` and Leave: "Name another Admin first" | section 10 |

### 2.8 Shared primitives specific to Library
`FormatGlyph` (coloured type glyph + label, never colour alone; PDF, doc, sheet, image, audio), `GeneratedMark` (soft-mint gradient sparkle with tooltip "Made by Souvenir in chat X / routine Y"), `UnreadDot` (dot + `aria-label="Unread"`), `InfoTip` (icon that reveals a hint, the prototype `Tip`), `EmptyState` (small grey icon tile, one title line, one quiet line), `LibraryToastActions`. `EmptyState` and `InfoTip` are generic enough to live in `src/components/` if another feature wants them; start in `library/` and promote on second use.

## 3. Visual spec (taken from the look book, adapted to our tokens)

- Page background `--surface-page` equivalent of `#fcfcfc`; content starts about 50px from the rail and ends about 50px from the right edge; header one row.
- Row 50px, hairline `#efefef` (map to the nearest border token, do not hardcode); 32px type tile; hover reveals `RowMenu` trigger at the right.
- Cards: white, 16px radius, soft shadow; menus and dialogs share one card style, radius and row height with the rest of the product.
- One black pill per surface: Done in Share, Add to chat in the picker, Confirm in dialogs. Red only for Delete / Delete forever / Empty Trash.
- Accent: the prototype used the chat pink `#e4074d`; use our existing accent token, do not introduce a new colour.
- Dark mode must work: every colour via tokens, glyph colours via `--tag-*`/category tokens (add if missing), generated mint gradient gets a dark variant.
- Motion: 150 ms transitions already in `Button`; dialogs fade/scale via Radix data attributes; respect `prefers-reduced-motion`.

## 3b. Component rules from the design-system principles (06)

- Layers point down only: `components/ui` -> Library composites -> screens -> routes. `components/ui` never imports Library; nothing deep-imports another feature's internals (ESLint `no-restricted-imports`).
- A component is describable in one sentence without "and"; <= 300 lines; props <= 7 (use slots/children or compound parts instead of boolean flags); no component defined inside another.
- Views are prop-only (status union `loading | error | empty | ready`, intent-named callbacks); containers are hooks plus thin screen components. No HOCs; no `cloneElement`.
- The file-name cell is a real `Link` (`asChild`), never a clickable `div`; the row menu button is a sibling, not nested in the anchor.
- Dynamic values (upload %, widths, zoom) via CSS variables, never dynamic Tailwind class names; animate `transform`/`opacity` only; honour `prefers-reduced-motion` and `forced-colors`.
- No manual `memo`/`useMemo`/`useCallback` without a measured reason (React Compiler is on).
- Every viewer, the table region and dialog bodies sit in an error boundary; every `"use client"` file has a one-line reason.
- Icons through an explicit map (no `icons[name]`); thumbnails lazy with fixed boxes and a type-icon fallback.

## 4. Build order and ownership

1. Foundations: `components.json`, shadcn primitives restyled, `FormatGlyph`, `EmptyState`, `InfoTip`, `AccessAvatars`, `GeneratedMark`, `UnreadDot`, skeletons.
2. List surface: `FileTable`, rows, header, tabs, filter, sort, search, `StorageLabel`, Suggested.
3. File page and dialogs: preview, info, share, rename, delete, trash.
4. Composer integration: attachments, picker, citations, routine attach.
5. Settings and Admin, Members and transfer.
Each step is shippable behind the flag against the mock adapter (05 section 2). A component is done when it has: all states above rendered in a Storybook-less visual page (`src/app/(app)/dev/library` mirrors the existing `dev/greetings` pattern), keyboard path verified, dark mode checked, unit tests for any logic it owns.

## 5. Open questions (log)

This doc depends on: OQ-5 (Settings > Files), OQ-9 (NotSearchable and PartialRead badges), OQ-10 (first-use notice), OQ-13 (transcript on the File page), OQ-18 (sharing kill switch UI), OQ-22 (See all, third sample), OQ-23 (Office preview), plus the icon gaps (sparkle, building, trash, filter) for design. Master log: `05-delivery-plan-and-qa.md` section 8.
