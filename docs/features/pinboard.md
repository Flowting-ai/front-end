# Feature: Pinboard

A persistent right-side panel where the user saves and organises full chat messages as pins. Accessible via the `FloatingMenu` on the right edge of the chat.

**Component:** `src/components/layout/Pinboard.tsx` (wrapper + wiring)  
**KDS ready components used:** `FloatingMenu` · `FloatingMenuItem` · `Pinboard` · `PinboardHeader` · `PinboardExpanded` · `Pin` · `PinCategory` · `PinCommentField` · `Badge` · `Tabs` · `Button` · `IconButton`  
**KDS pending components used:** `FilterMenu` · `SortMenu` · `ContextMenu` · `EmptyState`

> **Highlight is a separate feature.** When a user selects text in a message, that goes into a `HighlightBoard` — not the Pinboard. `HighlightBoard` is not yet designed. See pending note at the bottom of this doc.

---

## Layout

```
Chat area                         │  FloatingMenu (right edge)
──────────────────────────────────│──────────────────────────
                                  │  [📌] Pin icon
                                  │  [✦]  Highlight icon  ← pending
                                  │
                                  │  ← compact Pinboard (332px) slides in
                                  │    when pin icon is active
```

The `FloatingMenu` sits fixed on the right edge of the chat content area. It is always visible — not inside the Sidebar, not inside the TopBar.

---

## Component Tree

```
[Right edge of chat]
FloatingMenu (KDS)
├── FloatingMenuItem icon=PinIcon  label="Pinboard"  active={pinboardOpen}
│   └── opens/closes compact Pinboard
└── FloatingMenuItem icon=HighlightIcon  label="Highlights"  active={highlightOpen}
    └── HighlightBoard (pending — returns null for now)

Pinboard (KDS, compact, 332px wide)
├── PinboardHeader (KDS)
│   └── Search input (onSearch → filters pin list client-side)
├── [scrollable pin list]
│   └── Pin (KDS) × N                    ← sorted by created_at desc by default
│       ├── PinCategory badge
│       ├── pinTitle + description (2-line clamp)
│       ├── labels (Badge × N)
│       ├── chatName
│       └── action bar (hover): [Insert into chat]  [···]
└── [bottom toolbar]
    ├── Button "Export"   → exports all pins as PDF
    └── Button "Organize" → opens PinboardExpanded overlay

PinboardExpanded (KDS, 924×817px, overlays chat)
├── [left sidebar 240px]
│   ├── "All pins"           → clears folder filter
│   ├── "Unorganized"        → filter: no folder_id
│   ├── Button "New folder"  → inline input → POST /pins/folders
│   ├── [personal folders]
│   │   └── folder item × N  → filter by folder_id
│   └── [project folders]
│       └── folder item × N
├── [right content]
│   ├── Header: title · pin count · [Organize] [Close]
│   ├── Tabs (KDS): All · Favorites · Code · Text · Vision · Image · Audio · Search
│   ├── [toolbar row]
│   │   ├── Search input (expands to 276px)
│   │   ├── FilterMenu (pending) → filter by label color / category
│   │   └── SortMenu (pending)   → sort by date / title / category
│   ├── [2-column pin grid]
│   │   ├── Pin × N
│   │   └── EmptyState (pending) when results = 0
│   └── [bottom toolbar — organize mode only]
│       ├── "[N] selected"
│       ├── Button "Move to folder" → folder picker dropdown
│       ├── Button "Export"         → PDF of selected pins
│       ├── Button "Delete"         → confirm → DELETE /pins bulk
│       └── Button "Done"           → exits organize mode
└── [organize mode overlay on each Pin]
    └── checkbox (top-left corner) — visible when isOrganizing = true
```

---

## FloatingMenu Wiring

```tsx
<FloatingMenu aria-label="Chat tools">
  <FloatingMenuItem
    icon={<HugeiconsIcon icon={Pin01Icon} size={20} strokeWidth={1.5} color="currentColor" />}
    label="Pinboard"
    active={pinboardOpen}
    onClick={() => setPinboardOpen(v => !v)}
  />
  <FloatingMenuItem
    icon={<HugeiconsIcon icon={HighlightIcon} size={20} strokeWidth={1.5} color="currentColor" />}
    label="Highlights"
    active={false}
    disabled  // TODO: remove when HighlightBoard ships
  />
</FloatingMenu>
```

The FloatingMenu auto-expands after 2s hover (KDS internal behaviour — do not re-implement).

---

## Pin Creation Flow

Pins are created from the **message action bar** in the chat (copy · thumbs up · thumbs down · **pin**). Pinning saves the **entire message**, not a selection.

```
User clicks pin button in message action bar
    ↓
POST /pins/message/{messageId}
    ↓  (optimistic — add to local pins list immediately)
Pin button: icon swaps to filled PinIcon, brief green tint (150ms), reverts to filled state
    ↓
If compact Pinboard is closed → open it (setPinboardOpen(true))
    ↓
New pin appears at top of list
    → animate in using Pattern 3 (message appear: opacity 0→1, y 12→0, 220ms easeOut)
```

If the API call fails: revert optimistic update, show inline error (E3 pattern from `docs/error-states.md`).

---

## Organize Mode

Entered by clicking "Organize" in the compact Pinboard or PinboardExpanded header.

**What changes when `isOrganizing = true`:**
- A checkbox appears in the top-left corner of each `Pin` card
- Pins are no longer drag-expandable (drag handle hidden)
- A bulk action toolbar appears at the bottom of the panel
- "Organize" button label changes to "Done"

**Bulk action toolbar:**
```
[N selected]  [Move to folder ▾]  [Export]  [Delete]  |  [Done]
```

- **N selected**: count of checked pins
- **Move to folder**: dropdown of user's folders → `PATCH /pins/{id}` × N (sequential or bulk endpoint if available)
- **Export**: `generatePDF(selectedPins)` → download. If 0 selected: exports all visible pins.
- **Delete**: confirm dialog → `DELETE /pins/{id}` × N optimistically

Exiting organize mode (Done button or Escape): unchecks all, hides toolbar, restores drag handles.

---

## Search & Filter

**Search** (PinboardHeader / PinboardExpanded search input):
- Client-side filter on `pinTitle + description` — no API call
- Debounce: 150ms before filtering
- Clears on Escape

**Filter** (FilterMenu — pending KDS):
```tsx
<FilterMenu
  options={FILTER_OPTIONS}        // category types + label colors
  selected={activeFilters}
  onSelectionChange={setActiveFilters}
  onClear={() => setActiveFilters([])}
  trigger={<IconButton aria-label="Filter" />}
  open={filterOpen}
  onOpenChange={setFilterOpen}
/>
```

`FILTER_OPTIONS` — two groups:
- Category: Code · Research · Creative · Planning · Tasks · Quote · Workflow  
- Label colour: Blue · Red · Green · Yellow · Purple · Brown · Neutral

Filters are combined with AND: a pin must match all active filters to show.

**Sort** (SortMenu — pending KDS):
- Default: `date_updated desc`
- Options: Last updated · Date created · Title · Category
- Ascending/descending toggle

Both search and filter/sort are client-side against the in-memory `pins` array. Re-fetch from API only on mount and after create/delete.

---

## Folder Management

**Create folder:**
- "New folder" button → inline input field appears in sidebar
- On Enter or blur: `POST /pins/folders` → `{ name: string }`
- New folder appears in sidebar immediately (optimistic)

**Move pin to folder:**
- From organize mode bulk action or from `ContextMenu` (pending) on a Pin
- `PATCH /pins/{pinId}` → `{ folder_id: string }`

**Rename folder:**
- Double-click folder label in sidebar → inline edit
- On Enter: `PATCH /pins/folders/{folderId}` → `{ name: string }`

**Delete folder:**
- `ContextMenu` on folder → "Delete folder"
- Confirm: pins in the folder become unorganized (not deleted)
- `DELETE /pins/folders/{folderId}`

---

## Export

**Scope:** All currently visible pins (respects active filters), or only selected pins if in organize mode.

**Format:** PDF via `window.print()` + print stylesheet, or a dedicated export endpoint if Sahil provides one.

> **Note for Shyam:** Check if `GET /pins/export` or similar exists in the API. If not, implement client-side PDF generation using `window.print()` with a print-specific CSS layout.

---

## State

| State | Source | Notes |
|-------|--------|-------|
| `pinboardOpen` | Local (lifted to layout) | Controls FloatingMenuItem active state + Pinboard visibility |
| `pins` | `GET /pins` | Fetched on mount, updated optimistically |
| `isLoadingPins` | During fetch | Show Pin skeletons (3 rows) |
| `expandedPinIds` | Local | Tracks which pins are expanded — passed as `collapseSignal` |
| `isOrganizing` | Local | Organize mode on/off |
| `selectedPinIds` | Local | Set of checked pin IDs in organize mode |
| `activeFilters` | Local | `string[]` of active filter option IDs |
| `sortConfig` | Local | `{ field: SortField, direction: SortDirection }` |
| `searchQuery` | Local | Debounced search string |
| `activeFolderId` | Local | Currently selected folder in expanded sidebar |
| `folders` | `GET /pins/folders` | Fetched on mount |

---

## API Wiring

```ts
// On mount
GET /pins                          → pins list
GET /pins/folders                  → folders list

// Pin CRUD
POST /pins/message/{messageId}     → create pin from message
PATCH /pins/{pinId}                → { folder_id?, title? } rename or move
DELETE /pins/{pinId}               → delete single pin

// Folder CRUD
POST /pins/folders                 → { name: string }
PATCH /pins/folders/{folderId}     → { name: string }
DELETE /pins/folders/{folderId}    → folders deleted, pins become unorganized

// After any mutation
// Re-fetch GET /pins to sync (or update local state optimistically)
```

> **Note for Shyam:** The V1 API had `POST /pins/message/{id}` — confirm this endpoint is stable on Sahil's V2 API before wiring it up.

---

## Animations

| Element | Pattern | Spec |
|---------|---------|------|
| Compact Pinboard open | Framer Motion | `x: 40→0`, `opacity: 0→1`, spring `{ stiffness: 300, damping: 28 }` |
| Compact Pinboard close | Framer Motion | `x: 0→40`, `opacity: 1→0`, 150ms `easeIn` |
| New pin appears | Pattern 3 (message appear) | `opacity: 0→1`, `y: 12→0`, 220ms `easeOut` |
| Compact ↔ Expanded morph | KDS internal | Spring `{ stiffness: 260, damping: 32 }` — do not re-implement |
| Pin expand/collapse | KDS internal | Drag-handle spring — do not re-implement |
| Organize mode checkboxes | CSS | `opacity: 0→1`, 150ms `ease` |
| Bulk toolbar appear | Framer Motion | `y: 8→0`, `opacity: 0→1`, 200ms `easeOut` |
| CollapseAll | KDS internal | `collapseSignal` prop propagates to all `Pin` children |

---

## Empty States

| Condition | `EmptyState` props |
|-----------|--------------------|
| No pins at all | title="No pins yet" · description="Pin any chat message to save it here." |
| Search returns 0 | title=`No results for "${query}"` |
| Filter returns 0 | title="No pins match these filters" · action={ label: "Clear filters", onClick: clearFilters } |
| Folder is empty | title="This folder is empty" · description="Move pins here from the main view." |

---

## Pending: HighlightBoard

Highlights (text selections from chat messages) are a **separate feature** from Pins. The flow:

```
User selects text in a message
    ↓
HighlightPopover (pending KDS — currently returns null)
    ↓
User clicks "Save highlight"
    ↓
Highlight saved → appears in HighlightBoard
```

The `HighlightBoard` component does not exist in KDS yet and has not been designed. The `FloatingMenuItem` for Highlights is present in the FloatingMenu but `disabled` until the design is locked.

**Do not implement HighlightBoard in the Pinboard sprint.** Add `// TODO(design): HighlightBoard not yet designed` at the disabled FloatingMenuItem.
