# Chat Endpoints — Frontend Usage Map

Cross-references every "chat"-related backend endpoint (per `docs/openapi/devapi.json`) against how — or whether — the front-end actually calls it: which `config.ts` constant it uses, which wrapper function in `src/lib/api/` calls it, and every UI location that triggers that call.

30 chat-related paths exist in the backend spec, grouped into five areas: regular chats, chat sharing, persona (agent) chats, Brain chats, and project-chat associations. **23 of the 30 are actively used; 4 have no frontend caller at all; 2 have a dead wrapper function but the endpoint itself is still hit through an inline call that bypasses the wrapper** (see the summary table at the end).

Structural note that applies throughout: **streaming and stop calls don't go through the `chat.ts`/`personas.ts` wrapper functions.** `src/hooks/use-streaming-chat.ts` calls `CHAT_STREAM_ENDPOINT`/`CHATS_CREATE_ENDPOINT`/`CHAT_STOP_ENDPOINT` (or the persona equivalents) directly, because it needs the raw `Response` object to pipe SSE frames through — a normal `apiFetchJson`-style wrapper would consume the stream before the UI could read it.

---

## 1. Regular chats (`/chats/*`)

### `GET /chats` (list) & `DELETE /chats` (remove)
- **`config.ts`**: `CHATS_ENDPOINT = withBase("/chats")`
- **Wrappers**: `listChats()` (`lib/api/chat.ts`, GET) · `deleteChat(chatId)` (`chat.ts`, DELETE with `{chat_id}` in the body)
- **Used by**:
  - `hooks/use-chat-history.ts` (`loadChats`, `refreshChatTitle`) — loads the sidebar chat list on mount and after a new chat's title resolves; consumed by `LeftSidebar.tsx` via `useChatHistoryContext`.
  - `context/highlight-context.tsx` — paginates every chat to build the search/highlight index.
  - `app/(app)/project/[id]/page.tsx` — loads the user's own chats as candidates for "add existing chat to project."
  - `deleteChat`: `use-chat-history.ts`'s `handleDelete`, fired when the user confirms "Delete" from a chat's context menu (`LeftSidebar.tsx`'s `onDelete={chatHistory.remove}`).

### `POST /chats/create`
- **`config.ts`**: `CHATS_CREATE_ENDPOINT`
- Called two different ways, neither through `chat.ts`'s own `createChat()`:
  - **Client-side, direct**: `hooks/use-streaming-chat.ts` calls it raw when the user sends the first message in a brand-new chat (the streaming hook needs to create-and-stream in one flow).
  - **Server-side**: `app/api/chat/route.ts` builds the same path for the `/api/chat` Next.js proxy route (used on local dev / non-direct-backend origins).
  - `chat.ts`'s `createChat()` is a **local-only placeholder** — it never calls the backend at all; it just returns an optimistic `{id: "temp-..."}` object. Its only caller, `use-chat-history.ts`'s `handleCreate`, doesn't appear to be wired to any current UI trigger — the real creation path is the streaming hook above.

### `PATCH /chats/rename`
- **`config.ts`**: `CHATS_RENAME_ENDPOINT`
- **Wrapper**: `renameChat(chatId, title)` (`chat.ts`)
- **Used by**: `use-chat-history.ts`'s `handleRename`, fired when the user submits a new title from a chat's rename input — wired through `LeftSidebar.tsx` and `project/[id]/page.tsx`.
  - Careful: `LeftSidebar.tsx` also imports a *different*, same-named `renameChat` from `useProjects()` (`projects-context.tsx`) for project-scoped rows. That one only updates local React state — it does **not** call the backend. The actual PATCH happens via the `chat.ts` version called right after it.

### `GET /chats/{chat_id}/messages`
- **`config.ts`**: `CHAT_MESSAGES_ENDPOINT(chatId)`
- **Wrapper**: `getChatMessages(chatId, cursor?)` (`chat.ts`)
- **Used by**: `hooks/use-chat-state.ts` — loads message history when a chat page mounts, and again when the user scrolls up to paginate older messages. Feeds `ChatInterface.tsx` (rendered from `chat/page.tsx` and `project/[id]/chat/[chatId]/page.tsx`).

### `POST /chats/{chat_id}/stream`
- **`config.ts`**: `CHAT_STREAM_ENDPOINT(chatId)`
- **Called directly** (no `chat.ts` wrapper) by `use-streaming-chat.ts` — the core send-message/streaming path.
- **Used by**: `ChatInterface.tsx`'s `handleSend` (the Send button / Enter in the composer), its regenerate/edit-and-resend paths, and the "run the initial prompt on load" path (e.g. landing on `/chat` with a prefilled prompt).
  - Server-side equivalent: `app/api/chat/route.ts` builds the same path for the `/api/chat` proxy.

### `POST /chats/{chat_id}/stop`
- **`config.ts`**: `CHAT_STOP_ENDPOINT(chatId)`
- **Wrapper `stopChat()` in `chat.ts` is dead** (zero call sites) — the endpoint is actually hit by an inline `apiFetch(CHAT_STOP_ENDPOINT(...))` inside `use-streaming-chat.ts`'s `handleStopGeneration`.
- **Used by**: `ChatInterface.tsx`'s `onStop={handleStopGeneration}` — fired when the user clicks "Stop generating" mid-stream.

### `PATCH /chats/{chat_id}/star`
- **`config.ts`**: `CHAT_STAR_ENDPOINT(chatId)`
- **Wrapper**: `starChat(chatId)` (`chat.ts`)
- **Used by**: `use-chat-history.ts`'s `handleStar` — fired by the pin/star icon on a chat row (`LeftSidebar.tsx`'s `onStar={chatHistory.star}`).

### `PATCH /chats/{chat_id}/visibility`
- **`config.ts`**: `CHAT_VISIBILITY_ENDPOINT(chatId)`
- **Wrapper**: `setChatVisibility(chatId, visibility, organizationId?)` (`chat.ts`) — sends `{visibility: 'org'|'private', organizationId}`, translated from the FE-internal `'team'`/`'private'` toggle (see Thread D in `backend-alignment-execution-map.md`).
- **Used by**: `project/[id]/page.tsx`'s `handlePublishToggle` — fired when the user toggles "Publish to team" (really "publish to the org") on a chat row inside a shared project.

### `POST /chats/{chat_id}/copy`
- **`config.ts`**: `CHAT_COPY_ENDPOINT(chatId)`
- **Wrapper**: `copyChat(chatId)` (`chat.ts`)
- **Used by**: `components/chat/ChatShareOverlay.tsx`'s `handleCopyReadableChat` — fired when a read-only chat viewer clicks "Duplicate to my chats" in the share overlay.

### `GET /chats/{chat_id}/browser/live` — **not called anywhere**
No `config.ts` constant exists for this path at all, and nothing in `src/` references `browser/live` or `browser_live`. Fully unused from the frontend's side.

### `DELETE /chats/message/{message_id}` — **wrapper exists, never called**
- **`config.ts`**: `DELETE_MESSAGE_ENDPOINT(messageId)`
- **Wrapper**: `deleteMessage(messageId)` (`chat.ts`) — defined, zero call sites anywhere. There is no "delete this message" action in `ChatMessage.tsx` or elsewhere today.

### `POST /chats/prompts/{prompt_id}`
- **`config.ts`**: `CHAT_PROMPT_RESPOND_ENDPOINT(promptId)`
- **Wrapper**: `respondToChatPrompt(promptId, response, respondUrl?)` (`chat.ts`) — the same backend endpoint is also reached via `respondToPrompt()` in `brain.ts` for Brain-side prompts (see §4).
- **Used by**:
  - `components/chat/ChatMessage.tsx` — the user answering an inline permission/connector prompt under an assistant message.
  - `components/chat/ChatPromptCard.tsx` — the user picking an option on a clarification/question prompt card.
  - `agent/configure/layout.tsx` — responding to a permission prompt while testing/configuring a persona.

### `POST /chats/files/{attachment_id}/save-to-drive` — **wrapper exists, never called**
- **`config.ts`**: `CHAT_SAVE_TO_DRIVE_ENDPOINT(attachmentId)`
- **Wrapper**: `saveFileToDrive(attachmentId, folderId?)` (`chat.ts`) — defined, zero call sites. No "Save to Drive" UI action currently exists.

---

## 2. Chat sharing (`/chat-shares/*`)

All fully wired in `lib/api/chat-shares.ts` — no dead endpoints in this group.

### `POST /chat-shares` & `GET /chat-shares`
- **`config.ts`**: `CHAT_SHARES_ENDPOINT`
- **Wrappers**: `createChatShare(params)` (POST), `listChatShares(chatId)` (GET, `?chat_id=`)
- **Used by** `ChatShareOverlay.tsx` (opened from the sidebar's chat-menu "Share" item, which navigates to `?share=1`):
  - `listChatShares` — fetches existing shares when the Share modal opens.
  - `createChatShare` — fired when the user picks a target and clicks "Share."

### `GET /chat-shares/shared-with-me`
- **`config.ts`**: `CHAT_SHARES_SHARED_WITH_ME_ENDPOINT`
- **Wrapper**: `listSharedWithMe()`
- **Used by**: `app/(app)/chats/page.tsx` and `project/[id]/page.tsx` — loads the "Shared with me" section on page load.

### `GET /chat-shares/{share_id}` & `DELETE /chat-shares/{share_id}`
- **`config.ts`**: `CHAT_SHARE_ENDPOINT(shareId)`
- **Wrappers**: `getSharedChatView(shareId)` (GET), `deleteChatShare(shareId)` (DELETE)
- **Used by**:
  - `getSharedChatView` — `app/(app)/chat-shares/[shareId]/page.tsx`, loading the read-only shared-chat viewer when a share link is opened.
  - `deleteChatShare` — `ChatShareOverlay.tsx`'s `handleRevokeShare`, fired when the sharer clicks "Revoke."

### `POST /chat-shares/{share_id}/fork`
- **`config.ts`**: `CHAT_SHARE_FORK_ENDPOINT(shareId)`
- **Wrapper**: `forkChatShare(shareId)`
- **Used by**: `chats/page.tsx`, `chat-shares/[shareId]/page.tsx`, `project/[id]/page.tsx` — all fired when the recipient of an editable share clicks "Fork" / "Continue this chat" to get their own writable copy.

---

## 3. Persona (agent) chats (`/persona/{repo_id}/chats/*`)

### `GET /persona/{repo_id}/chats` & `DELETE /persona/{repo_id}/chats`
- **`config.ts`**: `PERSONA_CHATS_ENDPOINT(personaId)`
- **Wrappers**: `fetchPersonaChats(repoId)` (GET, 30s in-memory cache), `deletePersonaChat(repoId, chatId)` (DELETE, `{chat_id}` body) — both in `lib/api/personas.ts`
- **Used by**:
  - `fetchPersonaChats` — `context/search-context.tsx`, `context/highlight-context.tsx` (search/highlight indexing), and `LeftSidebar.tsx` (populates the per-agent chat history list in the sidebar's Agents sections).
  - `deletePersonaChat` — `LeftSidebar.tsx`, fired when the user deletes an agent chat from its context menu.

### `POST /persona/{repo_id}/chats/create`
- **`config.ts`**: `PERSONA_CHATS_CREATE_ENDPOINT(personaId)`
- **Called directly** (no dedicated wrapper) via `useStreamingChat`'s `directEndpoints.create` inside `components/layout/PersonaChatInterface.tsx` — fired when the user sends the first message in a new agent chat.

### `PATCH /persona/{repo_id}/chats/rename`
- **`config.ts`**: `PERSONA_CHATS_RENAME_ENDPOINT(personaId)`
- **Wrapper**: `renamePersonaChat(repoId, chatId, title)` (`personas.ts`)
- **Used by**: `LeftSidebar.tsx` — renaming an agent chat from its context menu.

### `GET /persona/{repo_id}/chats/{chat_id}/messages`
- **`config.ts`**: `PERSONA_CHAT_MESSAGES_ENDPOINT(personaId, chatId)`
- **Wrapper**: `fetchPersonaChatMessages(repoId, chatId)` (`personas.ts`)
- **Used by**: `PersonaChatInterface.tsx`'s `loadHistory` — fired when an existing agent-chat thread is opened.

### `POST /persona/{repo_id}/chats/{chat_id}/stream`
- **`config.ts`**: `PERSONA_CHAT_STREAM_ENDPOINT(personaId, chatId)`
- **Called directly** (no wrapper) via `useStreamingChat`'s `directEndpoints.stream` inside `PersonaChatInterface.tsx` — fired when the user sends a message in an ongoing agent chat.

### `POST /persona/{repo_id}/chats/{chat_id}/stop`
- **`config.ts`**: `PERSONA_CHAT_STOP_ENDPOINT(personaId, chatId)`
- **Wrapper `stopPersonaChat()` in `personas.ts` is dead** (zero call sites) — hit via an inline call in `PersonaChatInterface.tsx`'s `handleStopBackend`, passed to `useStreamingChat` as `onStopBackend`, fired when the user clicks "Stop" mid-stream.

### `DELETE /persona/{repo_id}/chats/{chat_id}/message/{message_id}` — **wrapper exists, never called**
- **`config.ts`**: `PERSONA_CHAT_DELETE_MESSAGE_ENDPOINT(personaId, chatId, messageId)`
- **Wrapper**: `removePersonaMessage(repoId, chatId, messageId)` (`personas.ts`) — defined, zero call sites. No per-message delete action exists in the agent chat UI.

---

## 4. Brain chats (`/brain/{chat_id}/*`)

`brain.ts` builds its own local endpoint strings (`BRAIN_STREAM`, `BRAIN_STOP`, etc.) the same way `config.ts` does, rather than importing shared constants — worth knowing if you go looking for a `config.ts` entry and don't find one.

### `GET /brain/{chat_id}/messages`
- **Wrapper**: `getBrainMessages(chatId)` (`brain.ts`)
- **Used by**: `app/(app)/brain/page.tsx`'s `loadHistory` — fired when a Brain chat thread is opened via `?chatId=`.

### `POST /brain/{chat_id}/stream`
- **Wrapper**: `continueBrainChat(chatId, input, opts, signal?)` (`brain.ts`); a brand-new Brain chat instead goes through `startBrainChat()` (POSTs to the create endpoint)
- **Used by**: `brain/page.tsx`'s composer send action (`startBrainChat` for new chats, `continueBrainChat` for existing ones) — the response feeds `consumeBrainStream`, which drives the SSE UI.

### `POST /brain/{chat_id}/stop`
- **Wrapper**: `stopBrainChat(chatId)` (`brain.ts`)
- **Used by**: `brain/page.tsx` — fired when the user clicks "Stop" during Brain generation.

### `PATCH /brain/{chat_id}/star`
- **Wrapper**: `starBrainChat(chatId)` (`brain.ts`)
- **Used by**: `brain/threads/page.tsx` and `brain/BrainSidebarSections.tsx` — pinning/unpinning a Brain thread from the threads list or sidebar.

**Adjacent, not in the 30-endpoint list but worth knowing:** `brain.ts` also wraps `GET /brain` (`listBrainChats()`) and `DELETE /brain` (`deleteBrainChat()`), both consumed by `brain/threads/page.tsx`/`BrainSidebarSections.tsx` for listing/deleting threads. And `respondToPrompt(promptId, body)` in `brain.ts` reuses the same `POST /chats/prompts/{prompt_id}` endpoint as §1's regular-chat prompts — it's called extensively throughout `brain/page.tsx` for every clarification/permission/recovery prompt shown in the Brain UI.

---

## 5. Project chats (`/projects/{project_id}/chats/*`)

### `GET /projects/{project_id}/chats`
- **`config.ts`**: `PROJECT_CHATS_ENDPOINT(projectId)`
- **Wrapper**: `fetchProjectChats(projectId)` (`lib/api/projects.ts`)
- **Used by**: `context/projects-context.tsx`'s `loadProjectChats`, called from `project/[id]/page.tsx`, `project/[id]/chat/[chatId]/page.tsx`, `projects/page.tsx`, and `LeftSidebar.tsx` whenever a project's chat list needs to be (re)loaded (page mount, sidebar section expand, etc.).

### `POST /projects/{project_id}/chats/{chat_id}` (add to project)
- **`config.ts`**: `PROJECT_CHAT_LINK_ENDPOINT(projectId, chatId)`, `POST`
- **Wrapper**: `addChatToProject(projectId, chatId)` (`projects.ts`)
- **Used by**: `projects-context.tsx`'s `addChat` — triggered from `chats/page.tsx`'s "add to project" bulk action, `LeftSidebar.tsx`'s "Move to project" menu item, and `ChatHistoryItem.tsx`'s per-row "Add to project" action.

### `DELETE /projects/{project_id}/chats/{chat_id}` (remove from project)
- **`config.ts`**: same `PROJECT_CHAT_LINK_ENDPOINT`, `DELETE`
- **Wrapper**: `removeChatFromProject(projectId, chatId)` (`projects.ts`)
- **Used by**: `projects-context.tsx`'s `removeChat` — `project/[id]/page.tsx`'s row-delete action (`onDelete={() => removeChat(projectId, chat.id)}`) and the equivalent action in `LeftSidebar.tsx`'s project section.

---

## Summary — what's actually dead

| Endpoint | Status |
|---|---|
| `GET /chats/{chat_id}/browser/live` | No config constant, no wrapper, no reference anywhere in `src/` |
| `DELETE /chats/message/{message_id}` | Wrapper (`deleteMessage`) defined, zero UI call sites |
| `POST /chats/files/{attachment_id}/save-to-drive` | Wrapper (`saveFileToDrive`) defined, zero UI call sites |
| `DELETE /persona/{repo_id}/chats/{chat_id}/message/{message_id}` | Wrapper (`removePersonaMessage`) defined, zero UI call sites |

Two more where the **wrapper** is dead but the **endpoint** is still exercised through an inline call that bypasses it (worth knowing before deleting either "dead" function — the endpoint itself is very much alive):

| Endpoint | Dead wrapper | Actually invoked via |
|---|---|---|
| `POST /chats/{chat_id}/stop` | `stopChat()` in `chat.ts` | inline `apiFetch(CHAT_STOP_ENDPOINT(...))` in `use-streaming-chat.ts` |
| `POST /persona/{repo_id}/chats/{chat_id}/stop` | `stopPersonaChat()` in `personas.ts` | inline `apiFetch(PERSONA_CHAT_STOP_ENDPOINT(...))` in `PersonaChatInterface.tsx` |

All other 23 of the 30 endpoints are actively called by the frontend.

**Unrelated aside, found while checking `config.ts`:** `CHAT_DELETE_ENDPOINT` (a `/chats/{chatId}`-style constant, separate from the `CHATS_ENDPOINT`-plus-body-based `deleteChat()` that's actually used) and the whole `WORKFLOW_CHAT*` family of constants (`WORKFLOW_CHATS_ENDPOINT`, `WORKFLOW_CHAT_STREAM_ENDPOINT`, etc.) have zero call sites anywhere in `src/` — and none of the `/workflows/...` paths they'd point to exist in `devapi.json` at all. Not part of this doc's scope, but worth a look if you're cleaning up `config.ts`.
