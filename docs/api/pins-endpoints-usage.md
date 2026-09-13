# Pins Endpoints — Frontend Usage Map

Cross-references every `/pins/*` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), and [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md).

13 endpoints exist in this group, all with a `config.ts` constant and a wrapper defined in `src/lib/api/pins.ts`. **10 are actively used; 2 wrappers have zero real callers; 1 endpoint is reachable only from a UI action that's built but never wired to any click handler.**

Almost every consumer goes through `src/context/pinboard-context.tsx` (`PinboardProvider`/`usePinboard`/`usePinboardActions`) rather than importing `pins.ts` directly — the one exception is `src/components/layout/RightSidebar.tsx`, which calls the folder-CRUD and move wrappers directly. The feature surface is the "Pinboard" right-side panel (`RightSidebar.tsx` + `components/Pinboard/index.tsx` + `components/Pin/index.tsx`), opened from the floating toolbar's Pinboard button, plus the pin/unpin toggle on chat messages (`components/chat/ChatMessage.tsx`).

---

## `GET /pins` (Get All Pins) & `GET /pins/folders/all` (Get All Folders)
- **`config.ts`**: `PINS_ENDPOINT`, `PIN_FOLDERS_ENDPOINT`
- **Wrappers**: `listPins()`, `listPinFolders()` (`pins.ts`) — fetched together via `Promise.all` inside `pinboard-context.tsx`'s `load()`.
- **Used by**, all driving the same shared `load()`/local-storage cache (`sb_pinboard_v1`):
  - `PinboardProvider`'s mount effect — fires on first app load if no fresh cache exists, or in the background to revalidate a stale one.
  - Hovering the "Pinboard" icon in the floating chat toolbar (`FloatingPanel.tsx`) — `onMouseEnter` prefetches.
  - Clicking the "Pinboard" toolbar icon — opens `RightSidebar.tsx`, showing whatever's already in state.
  - Clicking a chat's pin-count badge on the Chats list (`chats/page.tsx`) — opens the panel filtered to that chat.

## `POST /pins/folders` (Create New Folder)
- **`config.ts`**: `PIN_FOLDERS_CREATE_ENDPOINT`
- **Wrapper**: `createPinFolder(name)` (`pins.ts`)
- **Used by**: `RightSidebar.tsx`'s `handleCreateFolder` — clicking **New folder** in the Pinboard panel, entering a name in the modal, and confirming. Name is pre-validated client-side by `validateFolderName()` (`pins.ts`, a pure helper — no network call, shared by create and rename).

## `PATCH /pins/folders/{folder_id}` (Rename Pin Folder)
- **`config.ts`**: `PIN_FOLDER_DETAIL_ENDPOINT`
- **Wrapper**: `renamePinFolder(folderId, name)` (`pins.ts`)
- **Used by**: `RightSidebar.tsx`'s `handleConfirmRename` — invoking **Rename** from a folder's menu in the Pinboard panel, editing the name in the rename modal, and confirming.

## `DELETE /pins/folders/{folder_id}` (Delete Pin Folder)
- **`config.ts`**: `PIN_FOLDER_DETAIL_ENDPOINT`
- **Wrapper**: `deletePinFolder(folderId)` (`pins.ts`)
- **Used by**: `RightSidebar.tsx`'s `handleConfirmDelete` — invoking **Delete** from a folder's menu, then confirming in the "pins will still be available in All Pins" warning modal.

## `POST /pins/message/{message_id}` (Create New Pin)
- **`config.ts`**: `CREATE_PIN_ENDPOINT`
- **Wrapper**: `createPin(messageId)` (`pins.ts`)
- **Live consumer**: `pinboard-context.tsx`'s `addPin` (optimistic add) — triggered by `ChatMessage.tsx`'s `handlePin()`, clicking the pin icon in a message's action row on a not-yet-pinned assistant message.
- **Dead second call site**: `components/compare/CompareModels.tsx`'s `handleSavePin` also calls into this same flow (via `addPin`), but `handleSavePin` is never invoked anywhere — verified via grep: its only match in the 2000+ line file is its own definition. It's not wired to any `onClick`, and the `PinIcon` imported alongside it is never rendered. A "save this comparison response as a pin" feature that was built but never connected to a control.

## `GET /pins/{pin_id}` (Get Pin By Id) — dead
- **`config.ts`**: `PIN_DETAIL_ENDPOINT`
- **Wrapper**: `getPin(pinId)` (`pins.ts`) — defined, zero call sites. Verified via grep: `getPin` appears only at its own definition in `pins.ts`, nowhere else in `src/`.
- Individual pin views hydrate from the already-loaded `listPins()` array via `pinboard-context`, rather than fetching a single pin by ID — this wrapper was never needed for that.

## `DELETE /pins/{pin_id}` (Remove Pin)
- **`config.ts`**: `PIN_DETAIL_ENDPOINT` (shared with the GET above)
- **Wrapper**: `deletePin(pinId)` (`pins.ts`)
- **Used by**, both via `pinboard-context.tsx`:
  - `removePin(id)` — the delete/trash action on an individual pin card in the Pinboard panel, and bulk-delete of selected pins in the panel's "organize mode."
  - `removePinByMessage(messageId)` — `ChatMessage.tsx`'s `handlePin()`, clicking the same pin icon on an **already-pinned** message (the unpin action).

## `POST /pins/{pin_id}/comments` (Add) & `PATCH .../comments/{comment_id}` (Edit) & `DELETE .../comments/{comment_id}` (Delete)
- **`config.ts`**: `PIN_COMMENT_ENDPOINT` (add), `PIN_COMMENT_CRUD_ENDPOINT` (edit/delete, shared)
- **Wrappers**: `addPinComment()`, `editPinComment()`, `deletePinComment()` (`pins.ts`) — all funneled through a single context action, `pinboard-context.tsx`'s `updatePinComment(id, text)`, which picks the right one: add if no comment exists yet, edit if one exists and the new text is non-empty, delete if the submitted text is empty/whitespace.
- **Used by**: `components/Pin/index.tsx`'s comment field on an expanded pin card — a pin supports at most one comment. Typing text and clicking **Save** commits add/edit; clearing the text entirely and clicking Save deletes it.

## `PATCH /pins/{pin_id}/folder` (Move Pin To Folder)
- **`config.ts`**: `PIN_MOVE_ENDPOINT`
- **Wrapper**: `movePinToFolder(pinId, folderId)` (`pins.ts`)
- **Used by**: `RightSidebar.tsx`'s `handleMoveToFolder` — selecting one or more pins in the panel's "organize mode" and moving them to a folder. Applied optimistically via the context's `updatePinFolder`, with rollback to the prior folder on API failure.

## `PUT /pins/{pin_id}/tags` (Replace Pin Tags) — dead
- **`config.ts`**: `PIN_TAGS_ENDPOINT`
- **Wrapper**: `updatePinTags(pinId, tags)` (`pins.ts`) — fully wired into a same-named context action in `pinboard-context.tsx` (which optimistically updates local state, then calls the wrapper), and exposed on `PinboardContextValue`.
- **No UI ever calls it.** Verified via grep: every component that calls `usePinboard()` (`agents/page.tsx`, `brain/page.tsx`, `chat/page.tsx`, `chats/page.tsx`, `project/[id]/page.tsx`, `project/[id]/chat/[chatId]/page.tsx`, `RightSidebar.tsx`) destructures other actions (`pins`, `folders`, `removePin`, `clonePin`, `updatePinComment`, etc.) but never `updatePinTags`. `Pinboard`/`Pin` components render tags as read-only badges with no `onTagsChange`-style prop wired anywhere. The full plumbing exists top to bottom; there's just no button that fires it.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /pins` | Live — `listPins()` |
| `GET /pins/folders/all` | Live — `listPinFolders()` |
| `POST /pins/folders` | Live — `createPinFolder()` |
| `PATCH /pins/folders/{folder_id}` | Live — `renamePinFolder()` |
| `DELETE /pins/folders/{folder_id}` | Live — `deletePinFolder()` |
| `POST /pins/message/{message_id}` | Live via `ChatMessage.tsx`; **dead second call site** in `CompareModels.tsx` (`handleSavePin` unreachable) |
| `GET /pins/{pin_id}` | **Dead** — `getPin()` defined, zero callers |
| `DELETE /pins/{pin_id}` | Live — `deletePin()` |
| `POST /pins/{pin_id}/comments` | Live — `addPinComment()` |
| `PATCH /pins/{pin_id}/comments/{comment_id}` | Live — `editPinComment()` |
| `DELETE /pins/{pin_id}/comments/{comment_id}` | Live — `deletePinComment()` |
| `PATCH /pins/{pin_id}/folder` | Live — `movePinToFolder()` |
| `PUT /pins/{pin_id}/tags` | **Dead** — `updatePinTags()` wired into context, never called by any UI |

10 of 13 endpoints are actively used end-to-end; 2 wrappers (`getPin`, `updatePinTags`) have no caller at all; 1 endpoint (create pin) has a second, unreachable call site in the Compare Models feature worth knowing about if that feature gets picked back up.
