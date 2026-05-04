# Feature: Left Sidebar

Persistent navigation panel. Shows: navigation links (Chat, Personas, Brain, Settings), recent chats, starred chats, and project folders. Uses KDS `Sidebar` + `SidebarMenuItem` + `SidebarProjectsSection` — copy all three.

**Component:** `src/components/layout/LeftSidebar.tsx`  
**KDS sources to copy:** `Sidebar`, `SidebarMenuItem`, `SidebarMenuSkeleton`, `SidebarProjectsSection`, `SidebarInset`

---

## Component Tree

```
LeftSidebar
├── Sidebar (KDS)                   ← container: open/collapse logic, keyboard shortcut
│   ├── [top section] nav links
│   │   ├── SidebarMenuItem variant="nav" icon=ChatIcon    label="Chat"
│   │   ├── SidebarMenuItem variant="nav" icon=PersonIcon  label="Personas"
│   │   ├── SidebarMenuItem variant="nav" icon=BrainIcon   label="Brain"
│   │   └── SidebarMenuItem variant="nav" icon=SettingsIcon label="Settings"
│   │
│   ├── [starred section]
│   │   ├── section header "Starred"
│   │   └── [per starred chat] SidebarMenuItem variant="chat-item"
│   │
│   ├── [recents section]
│   │   ├── section header "Recents"
│   │   └── [per recent chat] SidebarMenuItem variant="chat-item"
│   │       ← loading: show SidebarMenuSkeleton (3 rows)
│   │
│   └── [projects section]
│       └── SidebarProjectsSection (expand/collapse per project)
│           └── [per project chat] SidebarMenuItem
│
└── SidebarInset                    ← the main content area right of the sidebar
```

---

## State

| State | Source | Notes |
|-------|--------|-------|
| `isOpen` | Local or persisted to `localStorage` via `lib/storage.ts` | Sidebar open/closed |
| `chatHistory` | `GET /chats` | Array of `{ id, title, model_name, created_at, starred }` |
| `isLoading` | During fetch | Show `SidebarMenuSkeleton` (3 rows) |
| `activeChat` | From URL params / router | Highlights the active `SidebarMenuItem` |
| `projects` | `GET /chats` filtered/grouped | If backend returns project grouping; otherwise omit for now |

---

## API Wiring

### Load chat list
```ts
GET /chats
Response: {
  chats: {
    id: string
    title: string
    model_name: string | null
    created_at: string
    starred: boolean
    project_id?: string | null
  }[]
}
```

Call on mount. Re-call after a new chat is created or a chat is deleted.

### Star / unstar a chat
```ts
POST /chats/{chatId}/star
// toggles starred state — no body needed
```

### Delete a chat
```ts
DELETE /chats/{chatId}
// Confirm via DeleteChatDialog before calling
// Remove from local state immediately (optimistic update)
```

### Rename a chat
```ts
POST /chats/rename
Body: { chat_id: string, title: string }
```

---

## SidebarMenuItem — "chat-item" variant

Each chat entry in the list. Props:
```tsx
<SidebarMenuItem
  variant="chat-item"
  label={chat.title}
  isActive={chat.id === activeChatId}
  onSelect={() => router.push(`/chat?id=${chat.id}`)}
  onStar={() => starChat(chat.id)}
  isStarred={chat.starred}
  onRename={(newTitle) => renameChat(chat.id, newTitle)}
  onDelete={() => setDeleteTarget(chat.id)}
/>
```

The KDS component handles hover state, "..." overflow menu, and rename inline editing. Your wrapper only provides data and callbacks.

---

## Collapse / Expand Animation

KDS `Sidebar` handles the open/close animation internally. The three-layer Framer Motion pattern (height clip → stagger orchestrator → per-item fade) is baked into `SidebarProjectsSection`. Do not re-implement it.

If you need to animate something outside of KDS (e.g., a custom section), use the exact same pattern from `docs/animation-states.md → Expand/Collapse`.

---

## Keyboard Shortcut

KDS `Sidebar` binds `⌘ B` (Mac) / `Ctrl B` (Windows) to toggle the sidebar. This is internal to the component — do not re-bind it.

---

## Empty States

| Condition | Show |
|-----------|------|
| No chats at all | "Start your first conversation" with a CTA button |
| Loading | `SidebarMenuSkeleton` (3 rows) |
| No starred chats | Omit the Starred section entirely |

---

## Mobile

Below `md` breakpoint, the Sidebar overlays instead of pushing content. This is handled by KDS `Sidebar` internally via the `isMobile` prop (or auto-detected). Pass `isMobile={useIsMobile()}` — the hook is at `src/hooks/use-mobile.ts` (already built).
