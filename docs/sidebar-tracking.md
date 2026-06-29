# Sidebar — Full Spec & Implementation Reference

This document is the authoritative reference for the left sidebar. It covers visual spec, component architecture, all logic, dynamic update patterns, and guard conditions. Use it to rebuild the sidebar with no gaps.

---

## 1. Guard: Individual vs Teams

Every individual-account feature is gated behind `isTeamUser`. **Never change teams-account behavior.**

```ts
const isTeamUser = Boolean(
  orgId ||
  user?.orgId ||
  user?.roleFit === 'small_team' ||
  user?.roleFit === 'large_team' ||
  billingSnap?.isTeamAccount        // from window.sessionStorage 'kaya:billing:snapshot:v2'
)
```

- `isTeamUser === true` → teams account (existing behavior, untouched)
- `isTeamUser === false` → individual account (all spec below applies)

---

## 2. Sidebar Key (remount boundary)

The `<Sidebar>` component receives a `key` prop that causes a full remount when the active section changes. This resets internal state (scroll position, tab selection) intentionally.

```ts
const sidebarSectionKey =
  isPersonaPage        ? 'persona'
  : isProjectPage      ? 'projects'
  : isBrainPage        ? 'brain'
  : isTeamSettingsPage ? `team-settings-${teamSectionId}`
  : isAdminPage        ? `admin-${adminItemId}`
  : isNewChatPage      ? 'new-chat'
  :                      'chat-board'
```

`isNewChatPage = pathname === '/chat' && !chatSearchParams.get('id')`

---

## 3. Individual Account — Tab-wise UI Spec

### CHATS Tab

**Pinned header row** (does not scroll)
| Button | Icon | Behavior |
|---|---|---|
| New Chat | `BubbleChatAddIcon animated` | `push('/chat')` — highlighted (`newChatButtonSelected`) when on new-chat page |
| Search | `SearchOneIcon animated` | Opens search overlay |
| Chatboard | `BubbleChatIcon animated` | `push('/chats')` — only shown for individual users (`onChatboardClick`) |
| Divider | — | Below the three buttons |

**Scrollable body**
1. **Personal Projects** — `<ProjectsSection label="Personal Projects" />`
   - "New project" button → `push('/projects/new')`
   - Top 2 projects (if any), `FolderOneIcon`
   - "See all" button → `push('/projects')`
2. **Starred Chats** — `<StarredSection>` — self-hides when no starred chats
3. **Recent Chats** — `<RecentsSection>` — from shared `ChatHistoryContext`

---

### AGENTS Tab

**Pinned header row**
| Button | Icon | Behavior |
|---|---|---|
| All Agents | `UserAiIcon animated` | `push('/agents')` — only shown for individual users (`onAllAgentsClick`) |
| Search | `SearchOneIcon animated` | Opens search overlay |
| Divider | — | Below the buttons |

**Scrollable body — `<PersonasSectionIndividual />`**
1. **Shared Agents** section
   - Header: "Shared Agents" (show/hide, animated collapse)
   - Hidden entirely when loading=false AND no shared agents
   - Shows 2 skeleton rows while loading
   - Each agent row: `renderPersonaRow(persona)` (see §6)
2. **Your Agents** section
   - Header: "Your Agents" (always rendered)
   - "New Agent" button → `push('/agents/templates')`
   - Shows 2 skeleton rows while loading
   - "No agents yet" empty state when none
   - Each agent row: `renderPersonaRow(persona)` (see §6)

**Below agents list — `<RecentAgentChatsSection />`** (see §7)
- Label: "Recent agent chats"
- Flat chronological list of all chats across all agents
- Second layer: complements the per-agent chat trees above

---

### BRAIN Tab

**Pinned header row**
| Button | Icon | Behavior |
|---|---|---|
| New Brain Thread | `BubbleChatAddIcon animated` | Creates new brain thread |
| Search | `SearchOneIcon animated` | Opens search overlay |
| Manage All Threads | `BubbleChatIcon animated` | `push('/brain')` — individual only (`onManageAllThreadsClick`) |
| Schedules | `CalendarFoldIcon animated` | `push('/brain/schedules')` |
| Divider | — | — |

**Scrollable body**
1. **Schedules** — `<BrainScheduledTasksSection>` (pre-loaded in `LeftSidebarImpl`, survives tab switches)
   - Top 2 schedules
   - "See all" button → `/brain/schedules`
2. **Recent Brain Threads** — from brain context

---

## 4. Scrollbar

Body scroll area uses the design-system class:

```tsx
className="kaya-scrollbar"
```

CSS definition (from `globals.css`):
```css
.kaya-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--neutral-800-30) transparent;
}
.kaya-scrollbar::-webkit-scrollbar { width: 3px; }
.kaya-scrollbar::-webkit-scrollbar-thumb {
  background: var(--neutral-800-30);
  border-radius: 999px;
}
```

No custom JS scrollbar machinery. No `onMouseEnter`/`onMouseLeave` on the scroll container.

---

## 5. New Chat Button Highlight

```tsx
newChatButtonSelected={isPersonaPage ? pathname === '/agents' : isNewChatPage}
```

- On the Agents tab: highlighted when on `/agents` (root agents page)
- On the Chats tab: highlighted when on `/chat` with no `id` param (new chat page)

---

## 6. Agent Row — `renderPersonaRow(persona)`

Used by both `PersonasSectionIndividual` and `PersonasSectionAll`.

**Avatar icon:**
```tsx
const avatarIcon = persona.imageUrl
  ? <img
      src={persona.imageUrl}
      alt=""
      style={{
        width: 20, height: 20,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
        boxShadow: 'var(--shadow-sidebar-item-avatar)',  // 1px ring matching item border color
      }}
    />
  : <UserAiIcon size={20} />
```

`--shadow-sidebar-item-avatar` = `0px 1px 1.5px 0px var(--neutral-700-15), 0px 0px 0px 1px var(--neutral-300-40)`
— 1px ring at `neutral-300` (40% opacity), same token as the sidebar item hover border, plus subtle drop shadow.

**Row structure (`SidebarProjectsSection`):**
```tsx
<SidebarProjectsSection
  key={persona.id}
  fluid
  label={persona.name}
  icon={avatarIcon}
  active={isActive}
  expanded={isExpanded}
  onClick={() => push(`/agents/${persona.id}/chat`)}
  onExpandedChange={(v) => handleExpand(persona.id, v)}
>
  {/* "New chat" button */}
  <SidebarMenuItem
    fluid variant="default" label="New chat"
    icon={<BubbleChatAddIcon size={20} />}
    href={`/agents/${persona.id}/chat`}
    onClick={() => push(`/agents/${persona.id}/chat`)}
  />

  {/* Loading skeletons */}
  {chatData?.loading && !chatData.loaded && <SidebarMenuSkeleton x2 />}

  {/* Chat list */}
  {visibleChats.map(chat => <PersonaChatItem ... />)}

  {/* Empty state */}
  {chatData?.loaded && visibleChats.length === 0 && <div>No chats yet</div>}
</SidebarProjectsSection>
```

**Chat visibility filter** (only show chats for the active persona version):
```ts
const visibleChats = chatData?.chats.filter(
  c => !c.versionId || !persona.activeVersionId || c.versionId === persona.activeVersionId,
) ?? []
```

---

## 7. `PersonasSectionIndividual` — State & Logic

**File:** `front-end/src/components/layout/LeftSidebar.tsx`

### State
```ts
const [personas,        setPersonas]        = useState<Persona[]>([])
const [isLoading,       setIsLoading]       = useState(true)
const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set())
const [personaChatsMap, setPersonaChatsMap] = useState<
  Record<string, { chats: PersonaChat[]; loaded: boolean; loading: boolean }>
>({})
const [shownShared, setShownShared] = useState(true)
const [shownOwned,  setShownOwned]  = useState(true)
```

### Persona split
```ts
const sharedPersonas = personas.filter(p => p.sourceShareId !== null)
const ownedPersonas  = personas.filter(p => p.sourceShareId === null)
```

### Effects

**Initial load:**
```ts
useEffect(() => {
  fetchPersonas()
    .then(list => setPersonas(list))      // no team filter for individual
    .catch(console.error)
    .finally(() => setIsLoading(false))
}, [])
```

**Auto-expand + load chats for active persona:**
```ts
useEffect(() => {
  if (!activePersonaId) return
  setExpandedIds(prev => prev.has(activePersonaId) ? prev : new Set([...prev, activePersonaId]))
  loadPersonaChats(activePersonaId)
}, [activePersonaId, loadPersonaChats])
```

**Persona list dynamic re-fetch** (on publish/delete/update):
```ts
useEffect(() => {
  const handle = () =>
    fetchPersonas().then(list => setPersonas(list)).catch(console.error)
  window.addEventListener(PERSONAS_LIST_UPDATED_EVENT, handle)
  return () => window.removeEventListener(PERSONAS_LIST_UPDATED_EVENT, handle)
}, [])
```

`PERSONAS_LIST_UPDATED_EVENT = 'persona:list-updated'` — dispatched by `bustPersonasCache()` in `lib/api/personas.ts`.

**Persona chat dynamic updates:**
```ts
window.addEventListener("persona:chat-created",       handleCreated)
window.addEventListener("persona:chat-title-updated", handleTitleUpdated)
```

---

## 8. `RecentAgentChatsSection` — State & Logic

Second layer below the agent list on the Agents tab. Shows all chats across all agents chronologically.

```ts
type AgentChat = PersonaChat & { personaId: string }
```

### `fetchAll`
```ts
const fetchAll = useCallback(async () => {
  const personas = await fetchPersonas()
  const results  = await Promise.all(
    personas.map(p => fetchPersonaChats(p.id).then(chats => chats.map(c => ({ ...c, personaId: p.id }))))
  )
  const merged = results.flat().sort((a, b) => {
    const at = a.updated_at ?? a.created_at ?? ''
    const bt = b.updated_at ?? b.created_at ?? ''
    return bt.localeCompare(at)     // descending — most recent first
  })
  setAllChats(merged)
}, [])
```

`fetchPersonas()` has in-flight deduplication — concurrent calls from both sections share one HTTP request.

### Effects
- Initial load: shows skeletons → calls `fetchAll()` → clears loading
- `PERSONAS_LIST_UPDATED_EVENT` → silent re-fetch (no loading state reset)
- `persona:chat-created` → prepend to local list
- `persona:chat-title-updated` → update title in local list

---

## 9. Recent Chats (Chats Tab) — Dynamic Update

**Data source:** `useChatHistoryContext()` — shared React context, provided by `ChatHistoryProvider` in `app/(app)/layout.tsx`. Both the chat page and `LeftSidebarImpl` consume the same instance.

**`filteredChatHistory`** (excludes project chats — already shown under Projects):
```ts
const filteredChatHistory = useMemo(
  () => ({ ...chatHistory, chats: chatHistory.chats.filter(c => !projectChatIdSet.has(c.id)) }),
  [chatHistory, projectChatIdSet],
)
```

**Dynamic new-chat update** — window event pattern to guarantee the sidebar sees new chats immediately, bypassing any React context propagation timing window caused by the navigation key change:

In `chat/page.tsx` (`handleChatCreated`):
```ts
const newChatStub = { id: chatId, can_edit: true, title: 'New chat', created_at: ..., updated_at: ..., starred: false }
addOptimistic(newChatStub)       // updates shared context
emitChatCreated(newChatStub)     // window event for sidebar listener
```

In `LeftSidebarImpl`:
```ts
const addOptimisticRef = useRef(chatHistory.addOptimistic)
useEffect(() => { addOptimisticRef.current = chatHistory.addOptimistic })  // keep ref fresh

useEffect(() => {
  const handle = (e: Event) => {
    const detail = (e as CustomEvent<ChatCreatedEventDetail>).detail
    addOptimisticRef.current({ id: detail.id, title: detail.title, ... })
  }
  window.addEventListener(CHAT_CREATED_EVENT, handle)
  return () => window.removeEventListener(CHAT_CREATED_EVENT, handle)
}, [])
```

`CHAT_CREATED_EVENT = 'chat:created'` — defined in `hooks/use-sidebar-events.ts`. The ref pattern prevents stale closure issues without causing the effect to re-register on every render.

---

## 10. Window Events Reference

All events are defined and emitted via `front-end/src/hooks/use-sidebar-events.ts`.

| Constant | Value | Emitter | Listeners |
|---|---|---|---|
| `PERSONAS_LIST_UPDATED_EVENT` | `'persona:list-updated'` | `bustPersonasCache()` in `lib/api/personas.ts` | `PersonasSectionIndividual`, `PersonasSectionAll`, `RecentAgentChatsSection` |
| `PERSONA_CHAT_CREATED_EVENT` | `'persona:chat-created'` | `agents/[id]/chat/page.tsx` | `PersonasSectionIndividual`, `PersonasSectionAll`, `RecentAgentChatsSection` |
| `'persona:chat-title-updated'` | same | agent chat page | same as above |
| `CHAT_CREATED_EVENT` | `'chat:created'` | `chat/page.tsx` `handleChatCreated` | `LeftSidebarImpl` |
| `BRAIN_THREAD_CREATED_EVENT` | `'brain:thread-created'` | `brain/page.tsx` | `BrainSidebarSections` |
| `BRAIN_THREAD_TITLE_UPDATED_EVENT` | `'brain:thread-title-updated'` | `brain/page.tsx` | `BrainSidebarSections` |
| `BRAIN_THREAD_DELETED_EVENT` | `'brain:thread-deleted'` | `BrainSidebarSections`, `brain/threads/page.tsx` (on delete) | `BrainSidebarSections`, `brain/threads/page.tsx` |

---

## 11. `LeftSidebarImpl` — `recentItems` Prop Matrix

The `recentItems` prop passed to `<Sidebar>` changes based on current route:

| Condition | `recentItems` value |
|---|---|
| `!user` (loading) | 5 `SidebarMenuSkeleton` rows |
| `isPersonaPage && isTeamUser` | `<PersonasSectionAll />` (teams: persona list lives in recentItems slot) |
| `isPersonaPage && !isTeamUser` | `<RecentAgentChatsSection />` (individual: agents are in `agentItems`, this is the 2nd layer) |
| `isProjectPage` | `null` (project page manages its own content) |
| otherwise (chat, brain, admin, etc.) | `<div><StarredSection .../><RecentsSection .../></div>` |

`agentItems` prop:
```tsx
agentItems={
  currentProjectTeamId        ? <PersonasSectionAll teamId={currentProjectTeamId} />
  : !isTeamUser               ? <PersonasSectionIndividual />
  :                              undefined
}
```

---

## 12. `PersonasSectionAll` — Teams Agent Section

Used for: teams on Agents tab, and team project pages (both via `agentItems`).

- Receives optional `teamId` prop
- Filters agents via `personasForTeamContext(list, teamId)` — shows only team-shared agents when `teamId` is set
- Same expand/collapse, chat-load, and event-listener logic as `PersonasSectionIndividual`
- Emits "Shared" badge on agents with `sourceShareId !== null`
- Dynamic re-fetch on `PERSONAS_LIST_UPDATED_EVENT`

---

## 13. Key Prop Wiring (`LeftSidebarImpl` → `<Sidebar>`)

```tsx
<Sidebar
  key={sidebarSectionKey}                        // §2
  recents={[]}                                   // always empty — prevents fake placeholder items
  defaultCollapsed={collapsedRef.current}
  defaultBodySection={computedDefaultBodySection}
  newChatButtonSelected={isPersonaPage ? pathname === '/agents' : isNewChatPage}   // §5
  onChatboardClick={!isTeamUser ? () => push('/chats') : undefined}                // individual only
  onAllAgentsClick={!isTeamUser ? () => push('/agents') : undefined}               // individual only
  onManageAllThreadsClick={!isTeamUser ? () => push('/brain') : undefined}         // individual only
  agentItems={...}                               // §11
  projectItems={orgId ? <TeamsSidebarContent /> : <ProjectsSection label="Personal Projects" />}
  scheduledTasksItems={isBrainPage ? <BrainScheduledTasksSection /> : undefined}
  recentItems={...}                              // §11
/>
```

`recents={[]}` is critical — the `DefaultRecentItems` fallback reads the `recents` array. Passing `[]` suppresses all placeholder/fake items and causes an empty state to render instead of default labels.

---

## 14. `computedDefaultBodySection`

Sets the initial active tab when Sidebar mounts (on key change):

```ts
const computedDefaultBodySection =
  isPersonaPage        ? 'agents'
  : isProjectPage      ? 'projects'
  : isBrainPage        ? 'brain'
  : isAdminPage || isTeamSettingsPage ? 'admin'
  : isNewChatPage      ? 'new-chat'   // Sidebar maps 'new-chat' → 'chats' internally
  :                      'chats'
```

---

## 15. `RecentsSection` and `StarredSection`

Both are defined in `LeftSidebar.tsx` and rendered inside `recentItems`. They receive `SectionProps`:

```ts
interface SectionProps {
  activeChatId: string | undefined
  onSelectChat: (id: string) => void
  chatHistory: UseChatHistoryResult   // from filteredChatHistory
}
```

`StarredSection` self-hides when `chatHistory.chats.filter(c => c.starred).length === 0`.

`RecentsSection` uses `RecentsList` internally which:
- Shows 5 skeleton rows while `isLoading && chats.length === 0`
- Shows "No chats yet" when `chats.length === 0` (and not loading)
- Renders `ChatHistoryItem` for each chat
- Shows "Load more" button when `hasMore === true`

Hydration guard in `RecentsList`: `mounted` state starts `false`, set to `true` in `useEffect` — prevents SSR/client mismatch on the loading skeleton.

---

## 16. `BrainScheduledTasksSection`

- Label: **"Schedules"** (not "Scheduled Tasks")
- Receives `tasks` and `loading` props — pre-fetched in `LeftSidebarImpl` so the list survives tab switches
- Fetch happens once on first `isBrainPage === true` via `brainTasksFetchedRef`
- Shows top 2 tasks, "See all" button → `/brain/schedules`
