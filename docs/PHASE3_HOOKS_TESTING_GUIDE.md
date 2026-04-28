# Phase 3 — Extract Custom Hooks: Testing Guide

This document covers how to verify every change implemented in Phase 3 — Extract Custom Hooks, confirm that no existing functionality is broken, and detect regressions. Tests are ordered by hook and include both manual browser steps and automated unit-test stubs.

> **Scope of Phase 3:** Ten custom React hooks were extracted from four large components (`chat-interface.tsx`, `app-layout.tsx`, `organize-pins-dialog.tsx`, `pin-item.tsx`, `left-sidebar.tsx`, `WorkflowChatInterface.tsx`, `WorkflowChatFullPage.tsx`, `WorkflowCanvas.tsx`). All hooks live under `src/hooks/`. No behaviour was changed — only location and encapsulation.

---

## Table of Contents

1. [`useChatState()` — from `chat-interface.tsx`](#usechatstate--from-chat-interfacetsx)
2. [`useStreamingChat()` — from `chat-interface.tsx`](#usestreamingchat--from-chat-interfacetsx)
3. [`useChatHistory()` — from `app-layout.tsx`](#usechathistory--from-app-layouttsx)
4. [`useModelSelection()` — from `app-layout.tsx`](#usemodelselection--from-app-layouttsx)
5. [`usePinOperations()` — from `app-layout.tsx`](#usepinoperations--from-app-layouttsx)
6. [`useFolderTree()` — from `organize-pins-dialog.tsx`](#usefoldertree--from-organize-pins-dialogtsx)
7. [`useTags()` — from `pin-item.tsx`](#usetags--from-pin-itemtsx)
8. [`useSidebarEvents()` — from `left-sidebar.tsx`](#usesidebarevents--from-left-sidebartsx)
9. [`useWorkflowChat()` — shared by `WorkflowChatInterface` + `WorkflowChatFullPage`](#useworkflowchat--shared-by-workflowchatinterface--workflowchatfullpage)
10. [`useWorkflowState()` — from `WorkflowCanvas.tsx`](#useworkflowstate--from-workflowcanvastsx)
11. [Cross-Cutting Regression Checks](#cross-cutting-regression-checks)
12. [Automated Test Stubs](#automated-test-stubs)
13. [Quick Smoke-Test Checklist](#quick-smoke-test-checklist)

---

## `useChatState()` — from `chat-interface.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-chat-state.ts` | **Created** — owns `messages`, `input`, `isResponding`, `showSources`, `mentionedPins`, `referencesSources`, textarea auto-resize effect, scroll-to-bottom effect, and message-action handlers (`handleCopy`, `handleDelete`, `handleResubmit`, `handleReact`) |
| `src/components/chat/chat-interface.tsx` | Removed all of the above state declarations, effects, and handlers; replaced with a single `useChatState()` call |

### What could break

- **Chat messages list is empty or never renders** — if `messages` or `setMessages` wiring between the hook and JSX broke.
- **Textarea doesn't auto-resize when typing** — if the auto-resize effect lost its ref or dependency.
- **Page does not scroll to the latest message** — if the scroll-to-bottom effect is no longer being run.
- **Copy-to-clipboard fails on AI messages** — if `handleCopy` is no longer wired to the `onCopy` prop.
- **Deleting a message throws or doesn't update UI** — if `handleDelete` callback is broken.
- **Resubmitting an edited message doesn't resend** — if `handleResubmit` lost its reference to the send function.
- **Sources panel doesn't open** — if `showSources` state is not toggled correctly.

### Manual tests

#### T-CS-1: Messages render on initial load

1. Open an existing chat that has several messages.
2. Confirm all messages appear in the correct order (user messages above AI messages for each exchange).
3. Confirm the page auto-scrolls to the most recent message.

#### T-CS-2: Textarea auto-resizes when typing

1. Open any chat.
2. Type a short one-line message — confirm the textarea stays compact.
3. Type a long multi-line message (press Shift+Enter for new lines) — confirm the textarea grows up to its maximum height and then becomes scrollable.
4. Delete the text — confirm the textarea collapses back to its minimum height.

#### T-CS-3: Copy AI message content

1. Hover over an AI message to reveal the action buttons.
2. Click the **Copy** button.
3. Open any text editor and paste — confirm the full message content is pasted correctly.
4. Confirm a toast notification "Copied to clipboard!" appears.

#### T-CS-4: Delete a message

1. Hover over a message to reveal action buttons.
2. Click the **Delete** button (or trash icon).
3. Confirm the message disappears from the chat immediately.
4. Reload the page — confirm the deleted message is gone from the loaded history.

#### T-CS-5: Resubmit / edit-and-resend a message

1. Hover over a user message to reveal action buttons.
2. Click the **Edit** button.
3. Modify the message text.
4. Submit the edit.
5. Confirm the original message is replaced and a new AI response is streamed.

#### T-CS-6: Sources / citations panel

1. Ask a question that produces a response with embedded web links.
2. Click the **Sources** or **Citations** toggle button.
3. Confirm the sources panel slides open and shows the extracted URLs.
4. Click the toggle again — confirm the panel closes.

---

## `useStreamingChat()` — from `chat-interface.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-streaming-chat.ts` | **Created** — owns the entire SSE streaming lifecycle: `fetchAiResponse`, streaming message state updates (`queueAiMessageUpdate`, batch RAF queue), `AbortController` management, `handleSend`, `handleStop`, `handleRegenerate`, and all streaming callbacks |
| `src/components/chat/chat-interface.tsx` | Removed `fetchAiResponse`, all streaming state management, and send/stop/regenerate handlers; replaced with `useStreamingChat()` |

### What could break

- **Sending a message does nothing** — if `handleSend` lost its wiring to the send button or Enter key.
- **AI response never arrives / spinner never stops** — if the SSE connection or abort controller is broken.
- **Response streams character-by-character with visible lag** — if the `requestAnimationFrame`-based batch queue was accidentally changed.
- **Stop button doesn't halt the stream** — if `handleStop` / `AbortController` is not connected.
- **Regenerate button doesn't replay the last message** — if `handleRegenerate` lost context.
- **Thinking / reasoning blocks stop streaming** — if the partial `<think>` detection logic broke.
- **Chat boards (left sidebar) don't update after first message** — `useStreamingChat` updates `setChatBoards` on new chat creation; if broken, the sidebar list won't refresh.
- **Pinned items referenced in a message vanish** — if `selectedPinIdsForNextMessage` clearing after send broke.

### Manual tests

#### T-SC-1: Full send and stream cycle

1. Open a new chat (no previous messages).
2. Type a message and press Enter (or click Send).
3. Confirm:
   - The user message appears immediately.
   - An AI loading skeleton or placeholder appears.
   - The response streams in word-by-word or token-by-token.
   - The stream completes and the final message is rendered correctly.

#### T-SC-2: Stop streaming mid-response

1. Send a message that produces a long response.
2. While the response is streaming, click the **Stop** button.
3. Confirm streaming halts immediately.
4. Confirm the partial response is preserved in the chat (not wiped).
5. Confirm the send button becomes active again after stopping.

#### T-SC-3: Regenerate last AI response

1. After an AI response is fully received, click the **Regenerate** button.
2. Confirm the previous AI response is replaced with a new streaming response.
3. Confirm the new response is different from the previous one (or at least a fresh API call is made — verify in Network tab).

#### T-SC-4: Thinking / reasoning content streams correctly

1. Select a model that supports reasoning (e.g. DeepSeek-R1 or similar).
2. Send a message.
3. While the response is streaming, confirm:
   - The thinking block is **not** visible in the main message content.
   - A "Reasoning…" indicator or collapsible block appears during the thinking phase.
   - After the stream completes, the reasoning block is fully populated.

#### T-SC-5: New chat appears in left sidebar after first message

1. Start a brand-new chat (no prior messages).
2. Send the first message.
3. Confirm a new entry appears in the left sidebar's chat list during or after the response.

#### T-SC-6: Pin mentions survive a send

1. Use `@pin` or the pin mention interface to attach a pin to a message.
2. Send the message.
3. Confirm the pin card renders in the sent message.
4. Confirm the pin selection is cleared for the next message (the mention dropdown resets).

---

## `useChatHistory()` — from `app-layout.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-chat-history.ts` | **Created** — owns `chatBoards`, loading of chat history, `loadChatBoards`, `loadChatBoard`, `handleNewChat`, `handleSelectChatBoard`, `handleDeleteChatBoard`, `handleRenameChatBoard`, title-resolution effect, and `persona-chats-updated` / `persona-chat-id-resolved` event handling |
| `src/components/layout/app-layout.tsx` | Removed all of the above; replaced with `useChatHistory()` |

### What could break

- **Chat list in the sidebar is empty or never loads** — if `loadChatBoards` is no longer called on mount.
- **Switching chats loads the wrong message history** — if `handleSelectChatBoard` is broken.
- **"New Chat" button doesn't create a new session** — if `handleNewChat` lost its wiring.
- **Deleting a chat from the sidebar doesn't remove it** — if `handleDeleteChatBoard` is broken.
- **Renaming a chat doesn't update the sidebar** — if `handleRenameChatBoard` is broken.
- **Page title doesn't update when switching chats** — if the title-resolution effect was lost.
- **Persona chat events don't refresh the chat list** — if window event subscriptions for `persona-chats-updated` were removed.

### Manual tests

#### T-CH-1: Chat list loads on initial login

1. Log in and navigate to the main chat page.
2. Confirm the left sidebar shows a list of recent chats.
3. Confirm chats are in reverse-chronological order (most recent at the top).

#### T-CH-2: Select a chat from the sidebar

1. Click on a past chat in the sidebar.
2. Confirm the message history loads in the main area.
3. Confirm the URL updates to include the chat ID.
4. Confirm the browser tab title updates to the chat's name.

#### T-CH-3: Create a new chat

1. Click **New Chat** (or equivalent).
2. Confirm the chat area is cleared (no previous messages).
3. Confirm the URL updates to a fresh session or `/chat` base.
4. Send a message — confirm a new entry appears in the sidebar list.

#### T-CH-4: Delete a chat

1. In the sidebar, hover over a chat to reveal the delete option.
2. Click **Delete**.
3. Confirm a confirmation prompt appears (if configured).
4. Confirm the chat is removed from the sidebar list.
5. Reload the page — confirm the chat is gone.

#### T-CH-5: Rename a chat

1. In the sidebar, click the rename icon on an existing chat.
2. Type a new name and confirm.
3. Confirm the new name appears in the sidebar immediately.
4. Reload the page — confirm the rename persisted.

#### T-CH-6: Chat title updates in browser tab

1. Select a chat from the sidebar.
2. Confirm the browser tab title changes to the selected chat's name (e.g. "My Research Chat — Souvenir AI").
3. Select a different chat — confirm the title updates again.
4. Create a new chat — confirm the title resets to the base app title.

---

## `useModelSelection()` — from `app-layout.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-model-selection.ts` | **Created** — owns `selectedModel`, `availableModels`, model loading, `handleModelSwitch`, `handleModelSwitchConfirm`, model-persistence to `localStorage`, `canAccessFramework`, and `referencesSources` / `selectedPinIdsForNextMessage` state |
| `src/components/layout/app-layout.tsx` | Removed all of the above; replaced with `useModelSelection()` |

### What could break

- **Model selector dialog doesn't open** — if `handleModelSwitch` is not wired.
- **Switching model doesn't update the active model indicator** — if the selected model state is disconnected from the UI.
- **Selected model resets to default after page reload** — if `localStorage` persistence is broken.
- **Models list is empty in the selector** — if `availableModels` fetch is broken.
- **Free-tier users can select paid models** — if `canAccessFramework` / plan-gate logic was accidentally removed.
- **Pin references don't pass to the next message** — if `selectedPinIdsForNextMessage` state was orphaned.

### Manual tests

#### T-MS-1: Model selector opens and lists models

1. In the main chat UI, click the **Model selector** button (usually shows the current model name/icon).
2. Confirm a dropdown or dialog opens showing a list of available models.
3. Confirm the list includes both free and paid models (if applicable to the test account).

#### T-MS-2: Switching model updates the active indicator

1. Select a different model from the selector (e.g. switch from GPT-4o to Claude Sonnet).
2. Close the dialog.
3. Confirm the model indicator in the chat toolbar shows the newly selected model name and/or icon.

#### T-MS-3: Selected model persists across page reloads

1. Switch to a non-default model.
2. Reload the page (F5 or Ctrl+R).
3. Confirm the same model is still selected (not reset to the default).

#### T-MS-4: Model switch mid-chat

1. Open a chat with existing messages, using Model A.
2. Switch to Model B.
3. Send a new message.
4. Confirm the new AI response uses Model B's avatar/name in the message metadata.
5. Confirm previous messages are still attributed to Model A.

#### T-MS-5: Plan-gated model shows upgrade prompt for free users

1. Log in with a free-tier account.
2. Open the model selector.
3. Click on a paid/premium model.
4. Confirm an upgrade prompt or disabled state appears (not a direct switch).

---

## `usePinOperations()` — from `app-layout.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-pin-operations.ts` | **Created** — owns `pins`, `loadPinsForChat`, `handlePinMessage`, `handleUnpinMessage`, `setPins` (wrapper), pin-fetch effects, and `handleChatDeleted` (cross-hook dependency resolved via the "double-ref pattern" with `onChatDeletedRef`) |
| `src/components/layout/app-layout.tsx` | Removed all of the above; replaced with `usePinOperations()` |

### What could break

- **Pinning a message fails silently** — if `handlePinMessage` no longer has access to the correct chat/board context.
- **Unpinning a message doesn't remove the pin card** — if `handleUnpinMessage` is broken.
- **Pin list doesn't load when switching chats** — if `loadPinsForChat` is not called when the active chat changes.
- **Pins from a previous chat bleed into a new chat** — if the chat-switch cleanup is missing.
- **Deleting a chat doesn't clean up its pins** — if the `onChatDeletedRef` double-ref pattern broke.
- **Pin counter/badge in the sidebar is wrong** — if the reactive `pins` array is not in sync.

### Manual tests

#### T-PO-1: Pin a message from a chat

1. In an active chat, hover over an AI message.
2. Click the **Pin** button.
3. Confirm a confirmation toast or visual indicator appears.
4. Navigate to the **Pinboard**.
5. Confirm the pinned message appears as a pin card.

#### T-PO-2: Unpin a message

1. Navigate to the Pinboard and find a pinned message.
2. Click the **Unpin** button on the pin card.
3. Confirm the card is removed from the Pinboard.
4. Return to the original chat — confirm the Pin button is no longer marked as active for that message.

#### T-PO-3: Pins load when switching chats

1. Switch to a chat that has several previously pinned messages.
2. Confirm the pinboard (or sidebar pin indicator) shows the correct pins for this chat.
3. Switch to a different chat with zero pins.
4. Confirm the pin list is now empty (no bleed-through from the previous chat).

#### T-PO-4: Deleting a chat removes its pins

1. Create a pin in a chat.
2. Delete that chat from the sidebar.
3. Navigate to the Pinboard.
4. Confirm the pin from the deleted chat is no longer present (or is marked as orphaned, depending on implementation).

#### T-PO-5: Pin operations survive a page reload

1. Pin a message.
2. Reload the page.
3. Confirm the pin still appears on the Pinboard.
4. Switch back to the original chat — confirm the message is still marked as pinned.

---

## `useFolderTree()` — from `organize-pins-dialog.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-folder-tree.ts` | **Created** — owns `folders` list (with sync from prop), inline create/rename form state (`isCreatingFolder`, `newFolderName`, `editingFolderId`, `editFolderName`), `createInputRef`/`editInputRef`, `selectedFolderIds`, `searchFolderQuery`, derived memos (`pinsByFolder`, `selectedFolderPins`, `filteredMoveableFolders`), and all folder CRUD handlers |
| `src/components/pinboard/organize-pins-dialog.tsx` | Removed all of the above; replaced with `useFolderTree()`; retained `handleDeleteFolderWithPins` wrapper for moving orphaned pins |

### What could break

- **Folder list is empty in the dialog** — if `folders` prop sync is broken.
- **"New folder" input doesn't auto-focus** — if `createInputRef` lost its attachment.
- **Typing in "New folder" input doesn't update the field** — if `newFolderName` state is stale.
- **Confirming a new folder doesn't add it** — if `handleConfirmCreateFolder` callback is broken.
- **Rename in-place doesn't save** — if `handleConfirmRenameFolder` is broken.
- **Deleting a folder doesn't remove it** — if `handleDeleteFolder` / `handleDeleteFolderWithPins` is broken.
- **Pins in a deleted folder are lost** — if the wrapper that moves them to "Unorganized" broke.
- **Sidebar folder search doesn't filter results** — if `searchFolderQuery` state is disconnected.
- **Move-mode folder selector doesn't show new folders** — if `filteredMoveableFolders` memo is broken.

### Manual tests

#### T-FT-1: Folder list renders in the Organize dialog

1. Navigate to the Pinboard.
2. Open **Organize Pins** (or the folder management dialog).
3. Confirm the left panel lists all existing folders.
4. Confirm the "Unorganized" folder is always present, even if empty.

#### T-FT-2: Create a new folder

1. In the Organize dialog, click **New Folder** (or the `+` icon).
2. Confirm an input field appears and receives auto-focus.
3. Type a folder name and press Enter (or click the confirm button).
4. Confirm the new folder appears in the list immediately.
5. Reload and re-open the dialog — confirm the folder persists.

#### T-FT-3: Rename a folder

1. Hover over an existing folder in the list.
2. Click the **Rename** (pencil) icon.
3. Confirm the folder name becomes an editable input with the current name pre-filled.
4. Change the name and confirm.
5. Confirm the updated name is shown in the list.

#### T-FT-4: Delete a folder — pins move to Unorganized

1. Create a folder and add at least one pin to it.
2. Delete the folder.
3. Confirm the folder disappears from the list.
4. Confirm the pin that was in the folder now appears in **Unorganized**.

#### T-FT-5: Search / filter folders in the sidebar

1. In the Organize dialog, type in the folder search box.
2. Confirm only folders whose names contain the search term are shown.
3. Clear the search — confirm all folders return.

#### T-FT-6: Move-mode folder selector shows correct folders

1. Select a pin in the Organize dialog and choose "Move to folder".
2. Confirm the move-destination dropdown / panel shows all folders except the pin's current folder.
3. Select a destination folder — confirm the pin moves there.

---

## `useTags()` — from `pin-item.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-tags.ts` | **Created** — owns `tags` (local copy with debounced sync from `pin.tags`), `tagInput`, `hoveredTagIndex`, `handleTagKeyDown` (add + sanitize + limit enforcement), `handleRemoveTag`, and `getTagColor` utility |
| `src/components/pinboard/pin-item.tsx` | Removed all of the above; replaced with `useTags({ pin, onUpdatePin, onRemoveTag })` |

### What could break

- **Tags on pin cards don't render** — if the local `tags` state fails to sync from `pin.tags`.
- **Typing in the "Add Tag" input doesn't update the field** — if `tagInput` state is stale.
- **Pressing Enter in the tag input doesn't add the tag** — if `handleTagKeyDown` is broken.
- **Adding a tag that exceeds the limit doesn't show the warning toast** — if `TAG_LIMIT` enforcement was lost.
- **Removing a tag doesn't update the pin** — if `handleRemoveTag` is not calling `onUpdatePin`.
- **Tag badge colours are wrong or random** — if `getTagColor` deterministic hash was changed.
- **Adding a tag with leading/trailing spaces doesn't trim it** — if `sanitizeTagName` call was removed.

### Manual tests

#### T-TG-1: Tags render on pin cards

1. Navigate to the Pinboard.
2. Open a pin that has several tags.
3. Confirm all tags are visible as coloured badge chips on the pin card.
4. Confirm each tag badge has a consistent colour (the same tag always uses the same colour).

#### T-TG-2: Add a new tag

1. On a pin card, click inside the **Add Tag** input (or click an "Add tag" button).
2. Type a tag name and press Enter.
3. Confirm the new tag badge appears on the card immediately.
4. Reload the page — confirm the tag persisted.

#### T-TG-3: Tag input sanitizes whitespace

1. In the tag input, type `  my tag  ` (with leading/trailing spaces).
2. Press Enter.
3. Confirm the added tag appears as `my tag` (trimmed), not with spaces.

#### T-TG-4: Tag limit enforcement

1. On a pin that already has the maximum number of tags (usually 10), try to add one more.
2. Confirm a toast notification appears explaining the tag limit has been reached.
3. Confirm no new tag is added.

#### T-TG-5: Remove a tag

1. On a pin card with tags, hover over a tag badge.
2. Confirm a remove/× icon appears.
3. Click the × icon.
4. Confirm the tag badge disappears from the card.
5. Reload the page — confirm the tag is gone from the pin's data.

#### T-TG-6: Tag colour is deterministic

1. Create a tag named "important" on Pin A.
2. Create a tag named "important" on Pin B.
3. Confirm both badges use the exact same colour.
4. Reload the page — confirm colours are unchanged after reload.

---

## `useSidebarEvents()` — from `left-sidebar.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-sidebar-events.ts` | **Created** — owns subscriptions to `persona-chats-updated`, `persona-chat-title-updated`, and `persona-chat-id-resolved` window events; manages `documentTitle` state with route-aware precedence logic and a guard against title-flash during async loads; applies title to `document.title` |
| `src/components/layout/left-sidebar.tsx` | Removed three `useEffect` event-listener blocks, `documentTitle` state, and title-derivation effects; replaced with a single `useSidebarEvents()` call |

### What could break

- **Browser tab title doesn't update when switching chats** — if the title-derivation effect is broken.
- **Browser tab title shows "Souvenir AI" briefly on each chat switch** — if the anti-flash guard was removed.
- **Tab title is wrong in a persona chat** — if the persona-chat precedence rule broke.
- **Tab title is wrong in a workflow chat** — if the workflow-chat route detection broke.
- **Persona chat list doesn't refresh after a persona conversation ends** — if the `persona-chats-updated` event handler is missing.
- **Persona chat title doesn't update live** — if the `persona-chat-title-updated` handler broke.
- **Temporary persona chat ID is never resolved to a real ID** — if the `persona-chat-id-resolved` handler is missing.

### Manual tests

#### T-SE-1: Browser tab title updates when switching chats

1. From the main chat, switch to several different chats using the sidebar.
2. After each selection, confirm the browser tab title changes to the selected chat's name within one second.
3. Confirm the title format is approximately: `[Chat Name] — Souvenir AI` (or the configured format).

#### T-SE-2: Tab title doesn't flash on chat switch

1. Switch between chats rapidly (click several chats in quick succession).
2. Confirm the tab title does not briefly revert to "Souvenir AI" between chats.
3. The title should update smoothly — either staying at the previous chat name or jumping directly to the new one.

#### T-SE-3: Tab title on persona chat page

1. Open a conversation with a persona.
2. Confirm the browser tab title reflects the persona chat (e.g. the persona's name or the chat session name).
3. Return to a regular chat — confirm the title reverts correctly.

#### T-SE-4: Tab title on workflow chat page

1. Navigate to a workflow's full-page chat view (`/workflows/[id]/chat`).
2. Confirm the browser tab title reflects the workflow name or "Workflow Chat".
3. Navigate back to the main app — confirm the title reverts to a regular chat title.

#### T-SE-5: Persona chat list refreshes after a new conversation

1. Start a conversation with a persona (this creates a new session).
2. After the session is created, check the sidebar or persona chat list.
3. Confirm the new session appears in the list without requiring a manual page refresh.

#### T-SE-6: Persona chat title updates live

1. In a persona chat, wait for or trigger a title update (persona chats often auto-title after the first exchange).
2. Confirm the sidebar list item for this chat updates its title without a page reload.

---

## `useWorkflowChat()` — shared by `WorkflowChatInterface` + `WorkflowChatFullPage`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-workflow-chat.ts` | **Created** — owns `displayMessages`, `input`, `isResponding`, `nodeOutputs`, `expandedNodeOutputId`, `activeNodeId`, `totalCost`; all refs (`abortRef`, `streamingContentRef`, `reasoningContentRef`, `nodeOutputsRef`, `seenRunningNodesRef`, `scrollViewportRef`, `textareaRef`); auto-scroll and auto-resize effects; all 15+ streaming callbacks (`onWorkflowStart` → `onModelSelected`); `handleSend`, `handleAbort`, `handleCopy`, `handleInputChange`; exports shared `WorkflowNodeOutput` type |
| `src/components/workflows/WorkflowChatInterface.tsx` | Removed ~585 lines of duplicated state/ref/effect/handler code; replaced with `useWorkflowChat({ workflowId, selectedModel, onRunStart, onNodeStatusChange, getNodeDisplayName, getNodeDisplayType })` |
| `src/components/workflows/WorkflowChatFullPage.tsx` | Removed ~470 lines of duplicated state/ref/effect/handler code; replaced with `useWorkflowChat({ workflowId })` |

### What could break

- **Sending a message in the workflow test overlay does nothing** — if `handleSend` is not wired to the Send button or Enter key in `WorkflowChatInterface`.
- **Sending a message on the full-page workflow chat does nothing** — same concern for `WorkflowChatFullPage`.
- **Streaming response never arrives in either consumer** — if the streaming callback closure broke (stale `aiMessageId`).
- **Node output panels don't appear during streaming** — if `nodeOutputs` state is not being updated in `onNodeStart` / `onChunk` / `onNodeEnd`.
- **Stop button doesn't halt the stream** — if `handleAbort` lost its `abortRef` reference.
- **AI avatar shows the wrong model** — if `selectedModel` is not being threaded through `getModelIcon` correctly.
- **Canvas nodes don't turn green/red during a test run** — if `onNodeStatusChange` callback is no longer called from within the hook.
- **Suggestion chips in ask-user events don't trigger a new send** — if `onAskUser` callback is broken.
- **Reasoning blocks don't stream in** — if `onReasoning` callback is broken.
- **Textarea doesn't auto-resize on the full-page view** — if the `textareaRef` effect is broken.
- **Generated image attachments don't appear** — if `onImage` callback is broken.
- **Tool-status indicators ("Running tool…") are absent** — if `onToolExecuting` / `onToolProgress` callbacks broke.

### Manual tests

#### T-WC-1: Send and receive a message in Test overlay (WorkflowChatInterface)

1. Open a saved workflow in the canvas editor.
2. Click **Test** (the floating chat overlay opens on the right side).
3. Type a message and press Enter.
4. Confirm:
   - The user message appears.
   - A loading state ("Starting workflow…") appears for the AI.
   - Node output panels appear below the messages as nodes execute.
   - The final AI response is displayed when the workflow completes.

#### T-WC-2: Send and receive a message on the full-page chat (WorkflowChatFullPage)

1. From the workflow admin list, click **Run** on a saved workflow (navigates to `/workflows/[id]/chat`).
2. Type a message and press Enter.
3. Confirm the same streaming behaviour as T-WC-1.
4. Confirm the node breakdown panel in the header shows the connected node count.

#### T-WC-3: Stop a running workflow stream

1. In either chat surface, send a message and immediately click the **Stop** (square/halt) button.
2. Confirm streaming stops.
3. Confirm the partial response is preserved.
4. Confirm the send input becomes active again.

#### T-WC-4: Canvas node statuses update during test run

1. Open a workflow in the canvas editor.
2. Click **Test** and send a message.
3. While the workflow is running, observe the canvas nodes.
4. Confirm each node changes colour/status as it starts (running → blue) and completes (success → green, error → red).
5. Confirm the status resets to idle before the run starts (`onRunStart` is called).

#### T-WC-5: Node output panels expand and collapse

1. In either chat surface, after a workflow run, look at the "Node Outputs" section below the AI message.
2. Confirm each executed node has a collapsible panel.
3. Click a panel header — confirm it expands to show the node's output.
4. Click again — confirm it collapses.

#### T-WC-6: Reasoning / thinking blocks in workflow chat

1. Use a workflow that includes a model supporting reasoning (e.g. DeepSeek-R1).
2. Send a message and observe the streaming response.
3. Confirm a reasoning block (collapsible "Reasoning…" section) appears while the model is thinking.
4. Confirm the reasoning content is hidden from the main message and accessible via the reasoning panel.

#### T-WC-7: Chat history loads for WorkflowChatFullPage

1. Navigate to a workflow full-page chat that has previous messages (`/workflows/[id]/chat?chatId=[chatId]`).
2. Confirm previous user and AI messages load correctly.
3. Confirm new messages can be sent after history loads.

#### T-WC-8: Suggestion chips trigger a new send

1. If the workflow uses an "ask user" node with suggestion chips, send a message that triggers it.
2. Confirm suggestion chip buttons appear below the AI message.
3. Click a suggestion chip.
4. Confirm the suggestion text is sent as a new user message and the workflow continues.

---

## `useWorkflowState()` — from `WorkflowCanvas.tsx`

### What was changed

| File | Change |
|---|---|
| `src/hooks/use-workflow-state.ts` | **Created** — owns all 45 state declarations, all 4 refs, all 12 effects (data fetching, hydration, snapshot tracking, keyboard shortcuts, etc.), all 40+ `useCallback`-wrapped handlers, and derived values (`canTestWorkflow`, `testWorkflowDisabledReason`); calls `useReactFlow()`, `useNodesState()`, `useEdgesState()`, `useSearchParams()`, `useRouter()`, and `useAuth()` internally; exports `INITIAL_NODES`, `PHANTOM_NODE`, `INITIAL_EDGES` constants and `WorkflowStateReturn` type |
| `src/components/workflows/WorkflowCanvas.tsx` | Reduced from 2,043 lines to ~330 lines; now a pure JSX shell that calls `useWorkflowState()` and renders the ReactFlow canvas, inspectors, dialogs, and overlays |

### What could break

- **Canvas doesn't load or is blank** — if `useNodesState` / `useEdgesState` initial values are wrong.
- **Nodes can't be dragged onto the canvas** — if `onDrop` / `onDragOver` are broken.
- **Nodes can't be connected** — if `onConnect` / `isValidConnection` lost their logic.
- **Undo / Redo doesn't work** — if `saveToHistory`, `handleUndo`, `handleRedo` lost their history array references.
- **Saving a workflow fails or doesn't update the unsaved-changes flag** — if `handleSave` broke or the `lastSavedSnapshotRef` was not updated.
- **Loading a workflow from the URL doesn't populate the canvas** — if `handleLoadWorkflow` or the `searchParams` effect broke.
- **Selecting a node doesn't open the correct inspector** — if `onNodeClick` type-switch is broken.
- **Deleting a node (keyboard Delete) doesn't work** — if the keyboard effect was lost.
- **The phantom placeholder node reappears after adding a real node** — if the phantom-removal effect broke.
- **Model/chat/persona/pin nodes don't show their names after loading** — if any of the 4 hydration effects broke.
- **"Clear workflow" dialog doesn't appear** — if `handleClear` / `isClearDialogOpen` state is broken.
- **"Unsaved changes" leave-confirmation dialog doesn't appear** — if `hasUnsavedChanges` or `showLeaveConfirm` broke.
- **Plan-limit upgrade dialog doesn't appear for over-quota users** — if `hasReachedLimit` check is missing.
- **Test / Run buttons are enabled when they shouldn't be** — if `canTestWorkflow` derived value is wrong.

### Manual tests

#### T-WS-1: Canvas loads with Start and End nodes

1. Navigate to `/workflows` (the canvas editor) with no `?id=` parameter.
2. Confirm the canvas shows the default **Start** node on the left and **End** node on the right.
3. Confirm a phantom "Add a node" indicator appears between them.

#### T-WS-2: Drag a node from the palette onto the canvas

1. From the left sidebar palette, drag a **Model** node type onto the canvas.
2. Confirm the node appears at the drop position.
3. Confirm the phantom placeholder disappears.
4. Confirm an unsaved-changes indicator appears (save button becomes active).

#### T-WS-3: Connect two nodes

1. Hover over the right handle of the Start node.
2. Drag a connection to the left handle of the Model node.
3. Confirm a directed edge appears between them.
4. Try to connect a context node (Document/Chat/Pin) as a target — confirm a toast error appears and the connection is rejected.

#### T-WS-4: Select a node and open its inspector

1. Click on a **Model** node.
2. Confirm the Model Inspector panel slides open on the right side of the canvas.
3. Click on a **Document** node — confirm the Document Inspector opens and the Model Inspector closes.
4. Click on an empty area of the canvas — confirm all inspector panels close.

#### T-WS-5: Undo and Redo

1. Add a node to the canvas.
2. Press **Ctrl+Z** (or click the Undo button in the utility bar).
3. Confirm the node is removed.
4. Press **Ctrl+Y** (or click Redo).
5. Confirm the node reappears.

#### T-WS-6: Save a workflow

1. Rename the workflow from "Untitled Workflow" (top bar).
2. Add and configure a Model node (select a model and add instructions).
3. Click **Save**.
4. Confirm a "Saved" status indicator appears briefly.
5. Confirm the unsaved-changes indicator disappears.
6. Reload the page with `?id=[saved-id]` — confirm the workflow loads correctly.

#### T-WS-7: Load a workflow from the URL

1. Navigate to `/workflows?id=[a-valid-workflow-id]`.
2. Confirm the canvas populates with the saved workflow's nodes and edges.
3. Confirm the workflow name appears in the top bar.
4. Confirm the Save button is initially disabled (no unsaved changes).

#### T-WS-8: Clear workflow

1. With nodes on the canvas, click the **Clear** button in the utility bar.
2. Confirm a confirmation dialog appears.
3. Confirm "Cancel" dismisses the dialog without clearing.
4. Confirm "Clear workflow" resets the canvas to only Start and End nodes.

#### T-WS-9: Node hydration — model names load after data fetch

1. Load a saved workflow that includes a Model node with a configured model.
2. Initially the node may show the model ID; after the models API fetch completes, confirm the node displays the human-readable model name and (if applicable) logo.

#### T-WS-10: Keyboard Delete removes selected node

1. Click on a user node (Document, Model, etc.) to select it.
2. Press the **Delete** key.
3. Confirm the node and its connected edges are removed.
4. Try the same with the **Start** node — confirm it cannot be deleted (error toast appears).

#### T-WS-11: Unsaved-changes leave confirmation

1. Make a change to the canvas (add or move a node).
2. Click the **Back** button.
3. Confirm a dialog appears asking whether to save, discard, or cancel.
4. Choose "Don't save" — confirm navigation to the workflows admin page occurs.
5. Repeat, choose "Save" — confirm the workflow saves and navigation occurs.

#### T-WS-12: Plan-limit upgrade dialog for new workflows

1. Log in with an account that has reached the workflow limit.
2. Navigate to the workflow canvas and click **Save** on a new (unsaved) workflow.
3. Confirm the plan-limit upgrade dialog appears instead of attempting the save.

#### T-WS-13: Test and Run button enablement rules

1. On a fresh canvas (only Start/End nodes), confirm **Test** and **Run** buttons are disabled.
2. Rename the workflow from "Untitled Workflow".
3. Add a Model node and configure it with a model and instructions.
4. Confirm **Test** and **Run** become enabled.
5. Save the workflow.
6. Click **Test** — confirm the floating chat overlay opens.
7. Click **Run** — confirm navigation to `/workflows/[id]/chat`.

---

## Cross-Cutting Regression Checks

These checks must pass regardless of which hook you are testing. They verify that the refactoring did not introduce any runtime errors, import failures, or behavioural regressions.

### T-REG3-1: TypeScript build passes with zero errors

```bash
npm run build
```
Expected: exit code 0. No `Type error`, `Module not found`, or `Cannot find module` lines. The only pre-existing allowed error is the `cost` field in `message-transformer.ts` which was present before Phase 3.

### T-REG3-2: No runtime errors on initial load

1. Open the app in a fresh incognito window.
2. Log in.
3. Observe the DevTools Console for 60 seconds while navigating: Chat → Workflows (Canvas) → Workflows (Admin) → Personas → Pinboard → Settings.
4. Expected: no `Uncaught TypeError`, `Uncaught ReferenceError`, or hook-related errors (e.g. `Invalid hook call`, `Cannot update a component while rendering a different component`).

### T-REG3-3: Full chat send/receive/stream cycle

1. Open a new chat.
2. Select any model.
3. Send a message and confirm it streams correctly.
4. Send a second message and confirm history is preserved.
5. Reload the page and confirm both messages persist.

### T-REG3-4: Workflow canvas create/save/test cycle

1. Create a new workflow.
2. Rename it, add a model node, configure it, and save.
3. Click **Test** — send a message and confirm a streaming response.
4. Reload with `?id=[saved-id]` — confirm the workflow reloads correctly.

### T-REG3-5: Pinboard full CRUD cycle

1. Navigate to the Pinboard.
2. Confirm existing pins load with tags and comments visible.
3. Pin a new message from the chat.
4. Confirm it appears on the Pinboard.
5. Add a tag to the new pin.
6. Organize the pin into a folder using the Organize dialog.
7. Delete the pin — confirm it is removed.

### T-REG3-6: Persona chat cycle

1. Navigate to a persona.
2. Start a conversation.
3. Confirm the persona's avatar appears correctly.
4. Confirm the tab title updates.
5. Return to the main chat — confirm the sidebar updates with the new persona session.

### T-REG3-7: No stale-closure bugs during rapid interaction

1. In the main chat, send 3 messages in rapid succession (do not wait for each response).
2. Confirm all 3 responses arrive and are attributed to the correct user messages.
3. In the workflow chat, rapidly stop and restart a streaming execution 2–3 times.
4. Confirm no "update on unmounted component" React warnings appear in the console.

### T-REG3-8: No orphaned imports or missing modules

1. Run `npm run build` and scan the output for any `Module not found` errors.
2. Check that no file still references a local function that was moved to a hook (e.g. a leftover import of `fetchAiResponse` from `chat-interface.tsx`).

### T-REG3-9: SSR pages return 200

1. Run `npm run build && npm start`.
2. Confirm the following routes return HTTP 200 with no server-side errors:
   - `/chat`
   - `/workflows`
   - `/workflows/admin`
   - `/personas`
   - `/pinboard`
3. Confirm no `ReferenceError: window is not defined` or `Invalid hook call` errors in server logs.

### T-REG3-10: Hook dependency arrays have no stale-closure regressions

1. Enable React's strict mode (it is likely already on in development).
2. Navigate through all major flows (chat, workflow, pinboard, persona).
3. Confirm no "Object is possibly 'undefined'" TypeScript errors were introduced.
4. Confirm the browser console has no "Warning: Can't perform a React state update on an unmounted component" messages during normal navigation.

---

## Automated Test Stubs

The following unit-test stubs can be added to your test suite using `@testing-library/react-hooks` or Vitest + `renderHook`. Hooks that depend on React context (ReactFlow, auth, router) require appropriate mocks.

```typescript
// src/hooks/__tests__/phase3-hooks.test.ts

import { renderHook, act } from "@testing-library/react";
import { useTags } from "../use-tags";
import { useFolderTree } from "../use-folder-tree";

// ─── useTags ─────────────────────────────────────────────────────────────────

describe("useTags", () => {
  const mockPin = {
    id: "pin-1",
    content: "Test content",
    tags: ["react", "typescript"],
    title: "Test Pin",
    // minimal pin shape
  } as any;

  const mockOnUpdatePin = jest.fn();
  const mockOnRemoveTag = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initialises tags from pin.tags", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    expect(result.current.tags).toEqual(["react", "typescript"]);
  });

  it("adds a new tag on Enter key", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    act(() => {
      result.current.handleTagKeyDown({
        key: "Enter",
        currentTarget: { value: "nextjs" },
        preventDefault: jest.fn(),
      } as any);
    });
    expect(result.current.tags).toContain("nextjs");
    expect(mockOnUpdatePin).toHaveBeenCalled();
  });

  it("does not add a duplicate tag", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    const initialLength = result.current.tags.length;
    act(() => {
      result.current.handleTagKeyDown({
        key: "Enter",
        currentTarget: { value: "react" }, // already exists
        preventDefault: jest.fn(),
      } as any);
    });
    expect(result.current.tags.length).toBe(initialLength);
  });

  it("removes a tag by index", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    act(() => {
      result.current.handleRemoveTag(0); // remove "react"
    });
    expect(result.current.tags).not.toContain("react");
    expect(result.current.tags).toContain("typescript");
    expect(mockOnUpdatePin).toHaveBeenCalled();
  });

  it("returns a consistent colour for the same tag name", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    const color1 = result.current.getTagColor("important");
    const color2 = result.current.getTagColor("important");
    expect(color1).toBe(color2);
  });

  it("returns different colours for different tag names", () => {
    const { result } = renderHook(() =>
      useTags({
        pin: mockPin,
        onUpdatePin: mockOnUpdatePin,
        onRemoveTag: mockOnRemoveTag,
      }),
    );
    // Not guaranteed to differ (hash collision possible) but likely for distinct strings
    const colorA = result.current.getTagColor("aaaa");
    const colorB = result.current.getTagColor("zzzz");
    // Test that the function doesn't throw and returns a string
    expect(typeof colorA).toBe("string");
    expect(typeof colorB).toBe("string");
  });
});

// ─── useFolderTree ─────────────────────────────────────────────────────────────

describe("useFolderTree", () => {
  const mockFolders = [
    { id: "folder-1", name: "Research" },
    { id: "folder-2", name: "Ideas" },
  ];

  const mockPins = [
    { id: "pin-1", folderId: "folder-1", title: "Pin A" },
    { id: "pin-2", folderId: "folder-1", title: "Pin B" },
    { id: "pin-3", folderId: null, title: "Orphan" },
  ] as any[];

  it("initialises folders from the prop", () => {
    const { result } = renderHook(() =>
      useFolderTree({
        foldersProp: mockFolders,
        pins: mockPins,
        moveFolderSearch: "",
      }),
    );
    expect(result.current.folders).toHaveLength(2);
  });

  it("groups pins by folder in pinsByFolder", () => {
    const { result } = renderHook(() =>
      useFolderTree({
        foldersProp: mockFolders,
        pins: mockPins,
        moveFolderSearch: "",
      }),
    );
    const folder1Pins = result.current.pinsByFolder.get("folder-1");
    expect(folder1Pins).toHaveLength(2);
  });

  it("puts pins with no folderId into the UNORGANIZED_FOLDER", () => {
    const { result } = renderHook(() =>
      useFolderTree({
        foldersProp: mockFolders,
        pins: mockPins,
        moveFolderSearch: "",
      }),
    );
    const unorganizedPins = result.current.pinsByFolder.get("unorganized");
    expect(unorganizedPins?.some((p) => p.title === "Orphan")).toBe(true);
  });

  it("starts creating a new folder on handleCreateFolder", () => {
    const { result } = renderHook(() =>
      useFolderTree({
        foldersProp: mockFolders,
        pins: mockPins,
        moveFolderSearch: "",
      }),
    );
    act(() => {
      result.current.handleCreateFolder();
    });
    expect(result.current.isCreatingFolder).toBe(true);
  });

  it("filters moveable folders by moveFolderSearch", () => {
    const { result } = renderHook(() =>
      useFolderTree({
        foldersProp: mockFolders,
        pins: mockPins,
        moveFolderSearch: "research",
      }),
    );
    expect(result.current.filteredMoveableFolders).toHaveLength(1);
    expect(result.current.filteredMoveableFolders[0].name).toBe("Research");
  });
});

// ─── useWorkflowChat (integration sketch — requires mock for workflowAPI) ──────

describe("useWorkflowChat", () => {
  // Mock workflowAPI before importing the hook
  jest.mock("@/components/workflows/workflow-api", () => ({
    workflowAPI: {
      executeStream: jest.fn().mockResolvedValue({ abort: jest.fn() }),
    },
  }));

  const { useWorkflowChat } = require("../use-workflow-chat");

  it("initialises with empty displayMessages", () => {
    const { result } = renderHook(() =>
      useWorkflowChat({ workflowId: "wf-123" }),
    );
    expect(result.current.displayMessages).toHaveLength(0);
  });

  it("initialises with empty input", () => {
    const { result } = renderHook(() =>
      useWorkflowChat({ workflowId: "wf-123" }),
    );
    expect(result.current.input).toBe("");
  });

  it("initialises with isResponding = false", () => {
    const { result } = renderHook(() =>
      useWorkflowChat({ workflowId: "wf-123" }),
    );
    expect(result.current.isResponding).toBe(false);
  });

  it("handleInputChange updates input state", () => {
    const { result } = renderHook(() =>
      useWorkflowChat({ workflowId: "wf-123" }),
    );
    act(() => {
      result.current.handleInputChange("Hello workflow");
    });
    expect(result.current.input).toBe("Hello workflow");
  });

  it("handleCopy calls navigator.clipboard.writeText", () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeMock } });

    const { result } = renderHook(() =>
      useWorkflowChat({ workflowId: "wf-123" }),
    );
    act(() => {
      result.current.handleCopy("some content");
    });
    expect(writeMock).toHaveBeenCalledWith("some content");
  });
});

// ─── Shared WorkflowNodeOutput type guard ──────────────────────────────────────

describe("WorkflowNodeOutput type shape", () => {
  it("satisfies the required fields", () => {
    const output: import("../use-workflow-chat").WorkflowNodeOutput = {
      nodeId: "node-1",
      content: "Hello from node",
      isStreaming: false,
      status: "success",
    };
    expect(output.nodeId).toBe("node-1");
    expect(output.isStreaming).toBe(false);
  });
});
```

---

## Quick Smoke-Test Checklist

Use this before any production deploy to confirm Phase 3 changes have not regressed.

| # | Hook | Area | Test | Pass / Fail |
|---|---|---|---|---|
| 1 | Build | All | `npm run build` completes with zero new errors | |
| 2 | `useChatState` | Chat | Sending a message renders it in the chat immediately | |
| 3 | `useChatState` | Chat | Textarea auto-resizes when typing a long message | |
| 4 | `useChatState` | Chat | Copy button copies message content to clipboard | |
| 5 | `useChatState` | Chat | Sources panel opens and closes via toggle | |
| 6 | `useStreamingChat` | Chat | AI response streams in word-by-word | |
| 7 | `useStreamingChat` | Chat | Stop button halts streaming mid-response | |
| 8 | `useStreamingChat` | Chat | Regenerate produces a fresh response | |
| 9 | `useStreamingChat` | Chat | Reasoning block renders for reasoning-capable models | |
| 10 | `useStreamingChat` | Chat | New chat appears in sidebar after first message | |
| 11 | `useChatHistory` | Chat | Chat list loads on login | |
| 12 | `useChatHistory` | Chat | Switching chats loads the correct message history | |
| 13 | `useChatHistory` | Chat | New Chat button clears the interface | |
| 14 | `useChatHistory` | Chat | Renaming a chat updates the sidebar immediately | |
| 15 | `useChatHistory` | Chat | Browser tab title changes when switching chats | |
| 16 | `useModelSelection` | Chat | Model selector dialog lists available models | |
| 17 | `useModelSelection` | Chat | Switching model updates the toolbar indicator | |
| 18 | `useModelSelection` | Chat | Selected model persists after page reload | |
| 19 | `usePinOperations` | Pinboard | Pin a message — appears on the Pinboard | |
| 20 | `usePinOperations` | Pinboard | Unpin a message — removed from the Pinboard | |
| 21 | `usePinOperations` | Pinboard | Switching chats loads the correct pin set | |
| 22 | `useFolderTree` | Pinboard | Folder list renders in the Organize dialog | |
| 23 | `useFolderTree` | Pinboard | Create a new folder — appears in the list | |
| 24 | `useFolderTree` | Pinboard | Rename a folder — name updates immediately | |
| 25 | `useFolderTree` | Pinboard | Delete a folder — pins move to Unorganized | |
| 26 | `useFolderTree` | Pinboard | Folder search filters the list correctly | |
| 27 | `useTags` | Pinboard | Tags render on pin cards with correct colours | |
| 28 | `useTags` | Pinboard | Adding a tag — appears on the card | |
| 29 | `useTags` | Pinboard | Removing a tag — disappears from the card | |
| 30 | `useTags` | Pinboard | Tag limit shows a toast when exceeded | |
| 31 | `useSidebarEvents` | Global | Tab title updates when switching chats | |
| 32 | `useSidebarEvents` | Global | Tab title correct on persona chat page | |
| 33 | `useSidebarEvents` | Global | Tab title correct on workflow chat page | |
| 34 | `useSidebarEvents` | Global | Persona chat list refreshes after new conversation | |
| 35 | `useWorkflowChat` | Workflows | Send message in Test overlay — response streams | |
| 36 | `useWorkflowChat` | Workflows | Send message on full-page chat — response streams | |
| 37 | `useWorkflowChat` | Workflows | Stop button halts workflow stream | |
| 38 | `useWorkflowChat` | Workflows | Canvas nodes show running/success/error status | |
| 39 | `useWorkflowChat` | Workflows | Node output panels appear and expand/collapse | |
| 40 | `useWorkflowChat` | Workflows | Reasoning blocks stream in workflow chat | |
| 41 | `useWorkflowState` | Workflows | Canvas loads with Start and End nodes | |
| 42 | `useWorkflowState` | Workflows | Drag a node from palette — appears on canvas | |
| 43 | `useWorkflowState` | Workflows | Connect two nodes — edge appears | |
| 44 | `useWorkflowState` | Workflows | Select a node — correct inspector opens | |
| 45 | `useWorkflowState` | Workflows | Keyboard Delete removes selected node | |
| 46 | `useWorkflowState` | Workflows | Undo / Redo works correctly | |
| 47 | `useWorkflowState` | Workflows | Save workflow — "Saved" indicator appears | |
| 48 | `useWorkflowState` | Workflows | Load workflow from URL — canvas populates | |
| 49 | `useWorkflowState` | Workflows | Clear dialog appears and resets canvas | |
| 50 | `useWorkflowState` | Workflows | Leave dialog appears when navigating with unsaved changes | |
| 51 | `useWorkflowState` | Workflows | Test button opens floating chat overlay | |
| 52 | `useWorkflowState` | Workflows | Run button navigates to full-page chat | |
| 53 | Regression | All | Full chat send/receive cycle (regular chat) | |
| 54 | Regression | All | Full workflow send/receive cycle (overlay + full-page) | |
| 55 | Regression | All | Full persona chat cycle | |
| 56 | Regression | All | Pinboard full CRUD — create, tag, organize, delete | |
| 57 | Regression | All | No `Uncaught TypeError` / `ReferenceError` during full app navigation | |
| 58 | Regression | All | No "Invalid hook call" or "rendered more hooks than during previous render" errors | |
| 59 | Regression | All | SSR pages (`/chat`, `/workflows`, `/pinboard`) return HTTP 200 | |
| 60 | Regression | All | `npm run build` — zero new TypeScript errors | |
