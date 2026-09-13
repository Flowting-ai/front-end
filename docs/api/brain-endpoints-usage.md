# Brain Endpoints — Frontend Usage Map

Cross-references every `/brain/*` backend endpoint against how the front-end calls it: wrapper function (in `src/lib/api/brain.ts`) and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), [`pins-endpoints-usage.md`](./pins-endpoints-usage.md), [`highlights-endpoints-usage.md`](./highlights-endpoints-usage.md), [`users-endpoints-usage.md`](./users-endpoints-usage.md), [`stripe-endpoints-usage.md`](./stripe-endpoints-usage.md), [`projects-endpoints-usage.md`](./projects-endpoints-usage.md), and [`connectors-endpoints-usage.md`](./connectors-endpoints-usage.md). `GET /brain/{chat_id}/messages`, `POST /brain/{chat_id}/stream`, `POST /brain/{chat_id}/stop`, and `PATCH /brain/{chat_id}/star` were already given a brief entry in [`chat-endpoints-usage.md`](./chat-endpoints-usage.md#4-brain-chats-brainchat_id) §4 — this doc gives all 8 endpoints in this group their full, dedicated treatment.

`brain.ts` builds its own endpoint strings locally (`BRAIN_BASE`, `BRAIN_CREATE`, `BRAIN_STREAM`, etc.) rather than importing shared constants from `config.ts`, so there are no `config.ts` entries to cite here — the path templates are quoted directly from `brain.ts`'s own `withBase(...)` calls instead.

8 endpoints exist in this group. **All 8 are actively used** — a fourth fully-live group, alongside `highlights`, `stripe`, and `projects`.

---

## `GET /brain` (List Chats)
- **Path builder**: `BRAIN_BASE`
- **Wrapper**: `listBrainChats()` (`brain.ts`)
- **Used by**:
  - `brain/threads/page.tsx` and `brain/BrainSidebarSections.tsx` — loading the full thread list for the "All Brain chats" page and the sidebar's Brain section respectively (also re-fetched on `BRAIN_THREAD_CREATED_EVENT`/`_TITLE_UPDATED_EVENT`/`_DELETED_EVENT` window events, so both stay in sync with each other without a shared context).
  - `context/search-context.tsx` — indexing Brain threads for the global command-palette search (⌘K).
  - `brain.ts`'s own `startBrainChat()` — as an internal fallback: if the create response doesn't carry an `X-Chat-Id` header (an older-backend CORS gap on cross-origin/deployed requests), it calls `listBrainChats()` and takes the newest row's id to recover the chat id that was just created.

## `POST /brain/create` (Create Brain Chat)
- **Path builder**: `BRAIN_CREATE`
- **Wrapper**: `startBrainChat(input, opts, signal?)` (`brain.ts`) — urlencoded body for text-only turns; for turns with file attachments, posts `multipart/form-data` either through the `/api/brain-chat` proxy (local dev) or, on deployed origins, directly to the backend via `directUpload()` to route around the platform's 4.5MB serverless-function body cap.
- **Used by**: `brain/page.tsx`'s send-message flow — the user's first message when no Brain chat is active yet (i.e. landing on `/brain` fresh and typing/sending), returning both the new `chatId` and the raw SSE `Response` to start streaming immediately.

## `PATCH /brain/rename` (Rename)
- **Path builder**: `BRAIN_RENAME`
- **Wrapper**: `renameBrainChat(chatId, chatTitle)` (`brain.ts`) — body is `{ chat_id, chat_title }` (the id lives in the body, not the URL, unlike most other rename endpoints in this codebase).
- **Used by**: `brain/threads/page.tsx` and `BrainSidebarSections.tsx`'s `handleRename()` — renaming a Brain thread from its row menu (both the standalone "All threads" page and the sidebar section); both apply the new title optimistically and don't roll back on failure (the next list refetch self-corrects).

## `GET /brain/{chat_id}/messages` (Get Messages)
- **Path builder**: `BRAIN_MESSAGES(chatId)`
- **Wrapper**: `getBrainMessages(chatId)` (`brain.ts`)
- **Used by**: `brain/page.tsx`'s `loadHistory()` — fired whenever a Brain chat thread is opened via `?chatId=` in the URL, populating the message history before the user can continue the conversation.

## `PATCH /brain/{chat_id}/star` (Star)
- **Path builder**: `BRAIN_STAR(chatId)`
- **Wrapper**: `starBrainChat(chatId)` (`brain.ts`)
- **Used by**: `brain/threads/page.tsx` and `BrainSidebarSections.tsx`'s `handleStar()` — toggling the pin/star on a thread row; applied optimistically with an explicit rollback (re-flip the local `starred` flag) if the request fails.

## `POST /brain/{chat_id}/stop` (Stop)
- **Path builder**: `BRAIN_STOP(chatId)`
- **Wrapper**: `stopBrainChat(chatId)` (`brain.ts`)
- **Used by**: `brain/page.tsx` — clicking **Stop** while a Brain turn is generating, mid-stream.

## `POST /brain/{chat_id}/stream` (Stream Brain Message)
- **Path builder**: `BRAIN_STREAM(chatId)`
- **Wrapper**: `continueBrainChat(chatId, input, opts, signal?)` (`brain.ts`) — same text/file-body split and direct-upload bypass as `startBrainChat` above.
- **Used by**: `brain/page.tsx`'s send-message flow — every message sent in an **already-active** Brain chat (as opposed to the very first message, which goes through `POST /brain/create` instead). The returned `Response` is handed to `consumeBrainStream()` (also in `brain.ts`) to decode the AG-UI SSE frames driving the whole Brain UI: reasoning, tool calls, external-output cards, recovery prompts, etc.

## `DELETE /brain` (Remove Chat)
- **Path builder**: `BRAIN_BASE` (same builder as the GET, method differentiates; the id lives in the body — `{ chat_id }` — not the URL)
- **Wrapper**: `deleteBrainChat(chatId)` (`brain.ts`)
- **Used by**: `brain/threads/page.tsx` and `BrainSidebarSections.tsx`'s `handleDelete()` — confirming the delete-chat dialog (`openDeleteChatDialog`) from a thread row's menu; on success emits `BRAIN_THREAD_DELETED_EVENT` (so the sidebar and the threads page stay in sync) and, if the deleted thread was the active one, navigates back to `/brain`.

---

## Adjacent, not in this group but worth knowing
`respondToPrompt(promptId, body)` also lives in `brain.ts`, but it targets `POST /chats/prompts/{prompt_id}` — a `/chats`-prefixed endpoint, not a `/brain`-prefixed one, so it's out of this doc's scope (it's the same backend endpoint the regular-chat flow uses, documented in [`chat-endpoints-usage.md`](./chat-endpoints-usage.md#1-regular-chats-chats) §1). It's extensively used throughout `brain/page.tsx` for every clarification/permission/recovery prompt shown in the Brain UI, reusing the same envelope regular chat prompts use.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /brain` | Live — `listBrainChats()` |
| `POST /brain/create` | Live — `startBrainChat()` |
| `PATCH /brain/rename` | Live — `renameBrainChat()` |
| `GET /brain/{chat_id}/messages` | Live — `getBrainMessages()` |
| `PATCH /brain/{chat_id}/star` | Live — `starBrainChat()` |
| `POST /brain/{chat_id}/stop` | Live — `stopBrainChat()` |
| `POST /brain/{chat_id}/stream` | Live — `continueBrainChat()` |
| `DELETE /brain` | Live — `deleteBrainChat()` |

All 8 endpoints in this group are actively used — no dead code found here.
