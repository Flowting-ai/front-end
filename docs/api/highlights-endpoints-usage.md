# Highlights Endpoints — Frontend Usage Map

Cross-references every `/highlights` backend endpoint against how the front-end calls it: `config.ts` constant, wrapper function, and every UI location that triggers it. Sibling doc to [`chat-endpoints-usage.md`](./chat-endpoints-usage.md), [`persona-endpoints-usage.md`](./persona-endpoints-usage.md), [`persona-shares-endpoints-usage.md`](./persona-shares-endpoints-usage.md), and [`pins-endpoints-usage.md`](./pins-endpoints-usage.md).

Only 3 endpoints exist in this group, all defined in `src/lib/api/highlights.ts` and all with a `config.ts` constant. **All 3 are actively used** — this is the rare feature area with zero dead surface. Note the backend uses `PATCH` for both create and soft-delete (not `POST`/`DELETE`) — worth knowing before assuming REST-conventional verbs from the method name alone.

Every wrapper is called exclusively through `src/context/highlight-context.tsx` (`HighlightProvider`/`useHighlight`/`useHighlightActions`) — no component imports `highlights.ts` directly. The feature surface is the "Highlights" side panel (`src/components/layout/HighlightSidebar.tsx`), opened via the floating toolbar (`FloatingPanel.tsx`), plus the highlight-creation flow triggered by selecting text in a chat message (`components/chat/ChatMessage.tsx`).

---

## `GET /highlights` (Get Highlights)
- **`config.ts`**: `HIGHLIGHTS_ENDPOINT`
- **Wrapper**: `getHighlights(chatId)` (`highlights.ts`) — the backend requires `chat_id` as a query param; there's no "all highlights across every chat" endpoint.
- **Used by**, both in `highlight-context.tsx`:
  - `loadForChat(chatId)` — fetches one chat's highlights. Triggered from `chat/page.tsx` and `project/[id]/chat/[chatId]/page.tsx` whenever the active chat changes, and from `HighlightSidebar.tsx`'s mount/filter-change effect when `filterMode === 'this-chat'`.
  - `loadAll()` — since the backend has no cross-chat endpoint, this fans out client-side: `collectAllChatIds()` pages through `listChats()` plus every persona's `fetchPersonaChats()` to build the full chat-ID set, then calls `getHighlights(id)` once per chat in parallel (failures per-chat are swallowed so one bad chat doesn't blank the list) and merges the results. Triggered from `HighlightSidebar.tsx` when the user switches the panel's filter to **"All chats"** (`filterMode === 'all'`).

## `PATCH /highlights` (Create New Highlight)
- **`config.ts`**: `HIGHLIGHTS_ENDPOINT` (same constant, PATCH verb — this is a create, not the GET's list semantics)
- **Wrapper**: `createHighlight(body)` (`highlights.ts`)
- **Used by**: `highlight-context.tsx`'s `addHighlight()` — optimistically inserts a temp entry (`hl-...` id) immediately, then confirms/replaces it with the server response (or rolls back and toasts an error on failure).
- **Trigger**: `components/chat/ChatMessage.tsx` — selecting a span of text in a chat message and confirming the highlight (the selection-popover flow around line 544) calls `addHighlight({ text, messageId, startOffset, endOffset, chatId })`.

## `PATCH /highlights/{highlight_id}` (Remove Highlight)
- **`config.ts`**: `HIGHLIGHT_DETAIL_ENDPOINT(highlightId)`
- **Wrapper**: `removeHighlight(highlightId)` (`highlights.ts`) — soft-delete; the wrapper treats both `204` and a plain `res.ok` as success.
- **Used by**: `highlight-context.tsx`'s `deleteHighlight(id)` — if the id is still a client-side temp id (`hl-...`, meaning the create call hasn't resolved yet), it's just dropped from local state with no network call; otherwise it optimistically removes the entry, calls the endpoint, and rolls back with an error toast on failure.
- **Trigger**: `components/layout/HighlightSidebar.tsx` — clicking the delete action on a highlight row in the Highlights panel (`onDelete={deleteHighlight}`).

---

## Adjacent, non-networked helper worth knowing
`copyHighlight(id)` (`highlight-context.tsx`) — copies a highlight's text to the clipboard via `navigator.clipboard.writeText`. No backend call; wired to the **Copy** action on a highlight row in `HighlightSidebar.tsx` (`onCopy={copyHighlight}`). Mentioned for completeness since it sits alongside the three real endpoints in the same panel.

---

## Summary

| Endpoint | Status |
|---|---|
| `GET /highlights` | Live — `getHighlights()`, via `loadForChat`/`loadAll` |
| `PATCH /highlights` | Live — `createHighlight()`, via `addHighlight()` |
| `PATCH /highlights/{highlight_id}` | Live — `removeHighlight()`, via `deleteHighlight()` |

All 3 endpoints in this group are actively used — no dead code found here.
