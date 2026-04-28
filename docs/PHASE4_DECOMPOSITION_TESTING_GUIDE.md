# Phase 4 — Component Decomposition: Testing Guide

This document covers how to verify every change implemented in Phase 4 — Component Decomposition, confirm that no existing functionality is broken, and detect regressions. Tests are ordered by decomposition task and include both manual browser steps and automated test stubs.

> **Scope of Phase 4:** Six decomposition tasks were completed across `src/components/chat/`, `src/components/layout/`, and `src/components/workflows/`. Large monolithic components were split into focused sub-components, two pairs of near-duplicate dialogs were merged into unified components, and the workflows directory was restructured into four domain sub-folders. No runtime behaviour was changed — only code organisation, component boundaries, and import paths.

---

## Table of Contents

1. [Split `chat-interface.tsx` → ChatInterface + PinMentionDropdown + AttachmentManager + ChatToolbar](#1-split-chat-interfacetsx)
2. [Split `chat-message.tsx` → ChatMessage + CodeBlock + LaTeXRenderer + LinkPreviewCard + ReasoningBlock](#2-split-chat-messagetsx)
3. [Split `app-layout.tsx` → AppLayout + DeleteChatDialog + AppDialogs + useActivePersonas](#3-split-app-layouttsx)
4. [Merge `model-switch-dialog.tsx` + `model-selector-dialog.tsx` → `ModelDialog.tsx`](#4-merge-modeldialog)
5. [Merge `WorkflowChatInterface.tsx` + `WorkflowChatFullPage.tsx` → `WorkflowChat.tsx`](#5-merge-workflowchat)
6. [Reorganize `src/components/workflows/` into sub-folders](#6-reorganize-workflows-sub-folders)
7. [Cross-Cutting Regression Checks](#cross-cutting-regression-checks)
8. [Automated Test Stubs](#automated-test-stubs)
9. [Quick Smoke-Test Checklist](#quick-smoke-test-checklist)

---

## 1. Split `chat-interface.tsx`

**Components created:** `PinMentionDropdown.tsx`, `AttachmentManager.tsx`, `ChatToolbar.tsx`

### What was changed

| File | Change |
|---|---|
| `src/components/chat/chat-interface.tsx` | Reduced from 4,454 → ~1,907 lines (-57%); extracted the three sub-components below |
| `src/components/chat/PinMentionDropdown.tsx` | **Created** — owns the `@`-mention dropdown: filtering, keyboard navigation (`↑`/`↓`/Enter/Escape), insertion into textarea, `pin-insert-to-chat` custom event listener |
| `src/components/chat/AttachmentManager.tsx` | **Created** — owns the attachment strip: file previews, MIME-type icons, Blob URL creation/revocation, file size validation toasts, remove-attachment handler |
| `src/components/chat/ChatToolbar.tsx` | **Created** — owns all compose-footer action buttons: Web Search toggle, pin insert trigger, file upload trigger, voice input toggle, persona picker, framework toggles, and all their submenus |

### What could break

- **`@` mention dropdown does not open** — if the `@` keydown detection or `showMentionDropdown` prop wiring between `chat-interface.tsx` and `PinMentionDropdown` was broken.
- **Mention dropdown does not filter correctly** — if `mentionFilter` state is no longer updated when the user types after `@`.
- **Keyboard navigation in dropdown is broken** — if `handleMentionKeyDown` (↑/↓/Enter/Escape) was not passed as a prop correctly.
- **Selecting a mention does not insert text into the textarea** — if `onSelectMention` callback or the `insertMentionText` ref handler lost its connection.
- **`pin-insert-to-chat` custom events no longer trigger a pin insertion** — if the event listener was not preserved in `PinMentionDropdown`.
- **File attachment strip is empty after selecting a file** — if `AttachmentManager` no longer receives the `attachments` array prop.
- **File MIME-type icons are wrong** — if the MIME-type → icon mapping was broken during the extraction.
- **Removing an attachment does not update the input state** — if `onRemoveAttachment` prop is not correctly wired.
- **Blob URLs leak (DevTools shows many blob: entries)** — if `URL.revokeObjectURL` cleanup in `AttachmentManager` was lost.
- **Web Search toggle has no effect** — if `ChatToolbar`'s toggle is no longer calling the correct setter in `chat-interface`.
- **File upload button opens no dialog** — if `onFileUploadClick` prop is not correctly wired from toolbar to the hidden file input in `chat-interface`.
- **Toast notifications in toolbar actions disappeared** — if `toast.success` / `toast.error` / `toast.info` imports were not carried over to `ChatToolbar.tsx`.
- **Persona picker in the toolbar shows no personas** — if the `personas` prop is not being passed down correctly.

### Manual tests

#### T-D1-1: `@`-mention dropdown opens on typing `@`

1. Open any active chat.
2. Click inside the message textarea.
3. Type `@` — confirm the pin mention dropdown appears immediately below or above the textarea.
4. Confirm the dropdown lists available pins (not an empty list).

#### T-D1-2: Mention dropdown keyboard navigation

1. With the dropdown open (see T-D1-1), press `↓` — confirm the next item in the list is highlighted.
2. Press `↑` — confirm the previous item is highlighted.
3. Press `Enter` — confirm the highlighted pin's title is inserted into the textarea and the dropdown closes.
4. Repeat and press `Escape` instead — confirm the dropdown closes without inserting anything.

#### T-D1-3: Mention dropdown filters by typed text

1. Type `@` followed by the first few characters of a pin name.
2. Confirm the dropdown list narrows to only pins whose names start with / contain the typed filter.
3. Clear to just `@` — confirm the full list returns.

#### T-D1-4: `pin-insert-to-chat` custom event inserts a pin

1. Open the right sidebar's pin panel.
2. Find an "Insert to chat" button (or similar) on a pin.
3. Click it.
4. Switch to the chat area — confirm the pin reference text has been inserted into the textarea.

#### T-D1-5: File attachment strip appears after selecting a file

1. In the chat compose area, click the **Attach file** button in the toolbar.
2. Select any file (image, PDF, or text).
3. Confirm the attachment strip appears above the textarea showing a file preview card with the file name and type icon.
4. Confirm no console errors about missing Blob URL.

#### T-D1-6: Correct MIME-type icons on attachments

1. Attach files of different types: `.pdf`, `.png`/`.jpg`, `.txt`/`.csv`, `.docx`.
2. Confirm each file shows a different icon matching its type (PDF icon, image icon, document icon, etc.).

#### T-D1-7: Removing an attachment clears it from the strip

1. Attach a file (see T-D1-5).
2. Click the `×` or **Remove** button on the attachment card.
3. Confirm the card disappears from the strip immediately.
4. Confirm the file is not sent when the next message is submitted.

#### T-D1-8: File size validation toast

1. Attempt to attach a file that exceeds the size limit (usually 10–20 MB).
2. Confirm a toast notification appears with a message like "File too large".
3. Confirm the oversized file does not appear in the attachment strip.

#### T-D1-9: Web Search toggle in toolbar

1. Click the **Web Search** button in the chat toolbar (globe/search icon).
2. Confirm it visually toggles (active/inactive state changes).
3. Send a message — confirm the web search parameter is included in the request (check Network tab for `web_search: true` in the request body or query).
4. Toggle it off — confirm the next request does not include web search.

#### T-D1-10: Send flow with both attachment and `@`-mention

1. Attach a file.
2. Type `@` and select a pin from the dropdown.
3. Add some text and send.
4. Confirm the message appears with:
   - The pin reference card embedded.
   - The file attachment card below the text.
5. Confirm both items are cleared from the compose area after sending.

---

## 2. Split `chat-message.tsx`

**Components created:** `CodeBlock.tsx`, `LaTeXRenderer.tsx`, `LinkPreviewCard.tsx`, `ReasoningBlock.tsx`

### What was changed

| File | Change |
|---|---|
| `src/components/chat/chat-message.tsx` | Reduced from 2,341 → ~1,762 lines; extracted the four sub-components below |
| `src/components/chat/CodeBlock.tsx` | **Created** — syntax-highlighted code block with a copy button; uses `highlight.js`; renders `<pre><code>` with detected or explicit language class |
| `src/components/chat/LaTeXRenderer.tsx` | **Created** — renders LaTeX expressions using KaTeX; handles both inline (`$…$`) and block (`$$…$$`) math; also renders inline bold markdown segments within mixed text |
| `src/components/chat/LinkPreviewCard.tsx` | **Created** — link preview card UI; module-level LRU cache for `/api/link-metadata` responses; `mailto:` link rendering; source favicon stack; handles missing/partial metadata gracefully |
| `src/components/chat/ReasoningBlock.tsx` | **Created** — collapsible reasoning/thinking section; typewriter streaming effect for partial content; content formatting (bold, code, lists); toggles open/closed |

### What could break

- **Code blocks render as plain text instead of highlighted** — if `CodeBlock` is no longer receiving the `language` prop or `highlight.js` is not being called.
- **Copy button on code blocks does nothing** — if the clipboard handler was not carried over.
- **LaTeX expressions render as raw `$` text** — if `LaTeXRenderer` is not being rendered for math segments in the message.
- **KaTeX block-level equations are misaligned or missing** — if the display-mode flag was dropped.
- **Link preview cards are always blank** — if the module-level metadata cache was reset or the `/api/link-metadata` fetch was broken.
- **Link preview cards fetch on every render (no caching)** — if the module-level cache was converted to component state.
- **`mailto:` links open the wrong handler or crash** — if the mailto rendering branch was lost.
- **Reasoning block never opens** — if the toggle state is not being driven by `ReasoningBlock`'s internal state or the prop wiring.
- **Reasoning block shows the wrong content** — if `thinkingText` prop is not being passed from `chat-message.tsx`.
- **Typewriter animation in reasoning block is gone** — if the streaming effect was lost.
- **Reasoning block auto-expands during streaming and stays expanded after** — this is the intended behaviour; if it collapses while still streaming, something broke.

### Manual tests

#### T-D2-1: Code block renders with syntax highlighting

1. Ask the AI a question that produces a code block, e.g., `Write a Python function to reverse a list`.
2. Confirm the code block renders with coloured syntax highlighting (keywords in different colours from identifiers).
3. Confirm a copy button appears in the top-right corner of the code block.
4. Click the copy button — paste into a text editor and confirm the raw code (without colours) is pasted correctly.
5. Confirm a brief "Copied!" indicator appears on the button.

#### T-D2-2: Code block language label is correct

1. Ask for code in multiple languages: Python, TypeScript, SQL, Bash.
2. Confirm the language label (e.g. "python", "typescript") appears on the code block header.
3. Confirm each language has distinct highlighting (Python strings vs SQL keywords, etc.).

#### T-D2-3: Inline LaTeX expression renders correctly

1. Ask the AI: `What is the quadratic formula in LaTeX inline notation?`
2. Confirm the response renders the formula (e.g. `\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`) as proper typeset math inline with the surrounding text — not raw LaTeX code.

#### T-D2-4: Block LaTeX equation renders on its own line

1. Ask the AI: `Show me the Pythagorean theorem as a display-mode LaTeX equation.`
2. Confirm the equation renders centered on its own line (block mode), not inline.
3. Confirm no raw `$$` delimiters are visible.

#### T-D2-5: LaTeX rendering does not break surrounding text

1. Ask a question that mixes LaTeX with regular text in the same paragraph.
2. Confirm regular text before and after the math is still readable and not garbled.

#### T-D2-6: Link preview card loads metadata

1. Ask the AI to mention a real URL, e.g., `What is https://reactjs.org?`
2. Confirm a link preview card appears below or within the response, showing:
   - A favicon or site icon.
   - A page title.
   - Optionally a description.
3. Click the card — confirm it navigates to the URL.

#### T-D2-7: Link preview card metadata is cached (no repeated fetches)

1. Open DevTools → Network tab and filter for `/api/link-metadata`.
2. Open a chat response that contains a URL.
3. Scroll away and back — confirm the `/api/link-metadata` request is **not** repeated (only one request per URL per page load).

#### T-D2-8: `mailto:` links render as email links

1. Ask the AI to mention a `mailto:` link, e.g., `Contact us at mailto:support@example.com`.
2. Confirm the link is rendered as a clickable email link (using the `mailto:` scheme), not as a blank preview card.
3. Click it — confirm the default email client opens (or the link behaves like a standard mailto).

#### T-D2-9: Reasoning block appears for thinking-capable models

1. Select a model that produces `<think>` blocks (e.g. DeepSeek-R1, Claude with extended thinking).
2. Send a message.
3. Confirm a **Reasoning** collapsible section appears above the main response.
4. Click it to expand — confirm the thinking content is shown.
5. Click again — confirm it collapses.

#### T-D2-10: Reasoning block auto-expands during streaming

1. Send a message with a reasoning-capable model.
2. While the model is still streaming the `<think>` content, confirm the reasoning block is open/visible by default.
3. After streaming completes, confirm the block is still expandable/collapsible.

#### T-D2-11: Typewriter effect plays in reasoning block

1. During active streaming (see T-D2-10), watch the reasoning block content.
2. Confirm text appears character-by-character or token-by-token (typewriter effect), not all at once.
3. After streaming completes, confirm the full reasoning text is present.

#### T-D2-12: Message rendering does not degrade without optional content

1. Open a chat where AI responses have no code, no LaTeX, no links, and no reasoning.
2. Confirm the messages render cleanly as plain markdown paragraphs.
3. Confirm no empty `<CodeBlock>`, `<LaTeXRenderer>`, or `<ReasoningBlock>` wrappers appear or cause layout issues.

---

## 3. Split `app-layout.tsx`

**Extractions:** `DeleteChatDialog.tsx`, `AppDialogs.tsx`, `useActivePersonas.ts`

### What was changed

| File | Change |
|---|---|
| `src/components/layout/app-layout.tsx` | Reduced from 703 → ~547 lines; extracted the components and hook below |
| `src/components/layout/DeleteChatDialog.tsx` | **Created** — canonical `AlertDialog` for confirming chat board deletion; receives `open`, `onConfirm`, `onCancel` props |
| `src/components/layout/AppDialogs.tsx` | **Created** — groups all app-level overlay dialogs: Compare Models dialog, `ModelDialog` (mode="switch"), and Plan Upgrade dialog; driven by `AppLayoutContext` flags |
| `src/hooks/useActivePersonas.ts` | **Created** — fetches personas whose `status === "test"`; triggers on `user` becoming non-null; exposes `activePersonas` array |

### What could break

- **Deleting a chat board shows no confirmation dialog** — if `DeleteChatDialog` is no longer rendered or its `open` prop is stuck `false`.
- **Confirming deletion in the dialog does nothing** — if `onConfirm` is not wired to `handleDeleteChatBoard`.
- **"Cancel" in deletion dialog still deletes the chat** — if `onCancel` and `onConfirm` props were swapped.
- **Compare Models dialog never opens** — if the `AppDialogs` component is missing or the context flag is disconnected.
- **Model switch dialog (`ModelDialog mode="switch"`) never opens mid-chat** — if `AppDialogs` is no longer rendering the switch variant.
- **Plan upgrade dialog never appears when quota is exceeded** — if the `AppDialogs` rendering condition is broken.
- **Active personas list is empty everywhere** — if `useActivePersonas` fails to fetch or the results are not passed into the context.
- **`useActivePersonas` fetches on every render** — if the `user` dependency is not stable (fetch runs in an infinite loop).
- **TypeScript error: user passed as `null` where `undefined` expected** — fixed with `user ?? undefined`; if this regressed, builds would fail.

### Manual tests

#### T-D3-1: Delete chat board — confirmation dialog appears

1. In the left sidebar, hover over an existing chat board.
2. Click the **Delete** button (trash icon).
3. Confirm an `AlertDialog` confirmation popup appears with a message like "Delete this chat?" and **Cancel** / **Delete** buttons.

#### T-D3-2: Delete chat board — Cancel dismisses without deleting

1. Trigger the delete dialog (see T-D3-1).
2. Click **Cancel**.
3. Confirm the dialog closes.
4. Confirm the chat board still appears in the sidebar.

#### T-D3-3: Delete chat board — Confirm deletes the chat

1. Trigger the delete dialog.
2. Click **Delete** (or the confirm action).
3. Confirm the dialog closes.
4. Confirm the chat board disappears from the sidebar list.
5. Reload the page — confirm the chat is gone.

#### T-D3-4: Compare Models dialog opens

1. Find the **Compare** button or link (usually in the chat toolbar or model selector area).
2. Click it.
3. Confirm the Compare Models dialog/panel opens showing at least two model selector columns.

#### T-D3-5: Model switch dialog opens mid-chat

1. Open an existing chat with at least one exchange.
2. Click the model selector (or the "Switch Model" option).
3. Confirm the `ModelDialog` in switch mode opens — it should show the current model, memory/pin settings, and a new-model selector.

#### T-D3-6: Plan upgrade dialog appears when appropriate

1. Log in with an account that has reached its plan limit (or simulate via DevTools by triggering the `showUpgradeDialog` context flag).
2. Confirm the Plan Upgrade dialog opens automatically or upon triggering the quota action.
3. Confirm the dialog shows the upgrade call-to-action, not a blank overlay.

#### T-D3-7: Active personas load in the persona picker

1. Navigate to the chat compose area.
2. Click the **Persona** button or picker in the `ChatToolbar`.
3. Confirm the dropdown lists personas that have `status === "test"` (active/test personas).
4. Confirm the list is not empty (if test personas exist in the system).

#### T-D3-8: Active persona fetch does not loop

1. Open DevTools → Network tab.
2. Navigate to the chat page.
3. Filter requests for the personas API endpoint (usually `/api/personas` or similar).
4. Confirm the fetch for active personas fires **once** on load (not repeatedly).

---

## 4. Merge `ModelDialog`

**New file:** `ModelDialog.tsx` with `mode: "select" | "switch"`. Old files (`model-switch-dialog.tsx`, `model-selector-dialog.tsx`) are backward-compat shims.

### What was changed

| File | Change |
|---|---|
| `src/components/chat/ModelDialog.tsx` | **Created** — unified dialog; `mode="select"` for initial model selection, `mode="switch"` for mid-chat switching; shared `FrameworkSelector` and `ModalityFilters` internal sub-components |
| `src/components/chat/model-switch-dialog.tsx` | Converted to shim — re-exports `ModelDialog` with `mode="switch"` and maps old prop names |
| `src/components/chat/model-selector-dialog.tsx` | Converted to shim — re-exports `ModelDialog` with `mode="select"` and maps old prop names |
| `src/components/chat/model-selector.tsx` | Updated to import `ModelDialog` directly and use `mode="select"` / `mode="switch"` |
| `src/components/layout/AppDialogs.tsx` | Updated to import `ModelDialog` directly for the switch case |

### What could break

- **Initial model selector dialog is blank or doesn't open** — if the `select` mode render path is broken.
- **Model switch dialog is blank or doesn't open** — if the `switch` mode render path is broken.
- **Model list doesn't load in either mode** — if the shared model-fetching logic in `ModelDialog` was broken.
- **Framework selector (Base / Pro) doesn't toggle** — if the shared `FrameworkSelector` internal component lost its state.
- **Modality filters (Text, Image, Audio) don't filter the model list** — if `ModalityFilters` internal component is disconnected.
- **Memory percentage slider doesn't affect the model switch config** — if the slider in switch mode is not updating `ModelSwitchConfig`.
- **Pin selection in switch mode is empty** — if the `pins` prop is not being passed from `AppDialogs`.
- **Choosing a model in `select` mode does not close the dialog** — if the `onModelSelect` callback was not wired.
- **Choosing a model in `switch` mode does not switch the active model** — if `onModelSwitch` was not wired.
- **Old imports from `model-switch-dialog` still work** — the shim must re-export all public types and the component; if any consumer fails, it's a shim bug.
- **`ModelSwitchConfig` type is no longer importable from the old path** — the shim must re-export the type.

### Manual tests

#### T-D4-1: Model selector dialog opens and lists models (`mode="select"`)

1. In the main chat interface, click the **Choose Model** button (usually near the top or bottom of the chat area, or on a new-chat screen).
2. Confirm the model selector dialog opens.
3. Confirm the list of available models is populated (not empty).
4. Confirm models are grouped by provider or category.

#### T-D4-2: Framework selector works in select mode

1. With the model selector dialog open, locate the **Framework** toggle (Base / Pro or similar).
2. Click each option.
3. Confirm the model list updates to show only models matching the selected framework.

#### T-D4-3: Modality filters work in select mode

1. In the model selector dialog, locate the **Modality** filter checkboxes (Text, Image, Audio, or similar).
2. Uncheck "Text" — confirm text-only models are hidden.
3. Check it back — confirm all relevant models return.
4. Check "Image" — confirm only image-capable models are shown (or text+image multimodal models).

#### T-D4-4: Selecting a model in select mode closes the dialog and applies the model

1. In the model selector dialog, click on any model.
2. Confirm the dialog closes.
3. Confirm the selected model is now shown in the model indicator in the chat toolbar or header.

#### T-D4-5: Model switch dialog opens mid-chat (`mode="switch"`)

1. Open a chat with existing messages.
2. Trigger the model switch (click the current model name or a "Switch Model" option).
3. Confirm the dialog opens in switch mode — it should show different UI from the selector (memory controls, pin inclusion options, etc.).

#### T-D4-6: Memory percentage slider works in switch mode

1. With the model switch dialog open, locate the **Memory** slider.
2. Drag the slider to different positions.
3. Confirm the displayed percentage updates and the "messages included" count changes accordingly.

#### T-D4-7: Confirming model switch applies the new model

1. In the switch dialog, select a different model from the list.
2. Configure memory/pin settings.
3. Click **Switch** or **Confirm**.
4. Confirm the dialog closes.
5. Send a new message — confirm the response comes from the new model (check model name in the response metadata badge).

#### T-D4-8: Old import paths still work (backward compatibility shim)

1. Search the codebase for any file that imports from `model-switch-dialog` or `model-selector-dialog` directly:
   ```
   import { ModelSwitchDialog } from "./model-switch-dialog"
   ```
2. Confirm the build still succeeds with no `Cannot find module` or `Module has no exported member` errors.
3. Confirm the `ModelSwitchConfig` type is still importable from the old path.

---

## 5. Merge `WorkflowChat`

**New file:** `WorkflowChat.tsx` with `mode: "overlay" | "fullpage"`. Old files (`WorkflowChatInterface.tsx`, `WorkflowChatFullPage.tsx`) are 6-line shims.

### What was changed

| File | Change |
|---|---|
| `src/components/workflows/chat/WorkflowChat.tsx` | **Created** — 1,241-line unified component; `mode="overlay"` renders the floating test overlay on the canvas; `mode="fullpage"` renders the dedicated full-page chat at `/workflows/[id]/chat`; shared internal sub-components: `NodeReasoningBlock`, `WorkflowCodeBlock`, `processInlineMarkdown`, `renderMarkdownContent` |
| `src/components/workflows/chat/WorkflowChatInterface.tsx` | Converted to shim — `export { WorkflowChat as WorkflowChatInterface }` |
| `src/components/workflows/chat/WorkflowChatFullPage.tsx` | Converted to shim — `export { WorkflowChat as WorkflowChatFullPage }` |
| `src/components/workflows/canvas/WorkflowCanvas.tsx` | Updated to `import { WorkflowChat } from "../chat/WorkflowChat"` and `mode="overlay"` |
| `src/app/workflows/[workflowId]/chat/page.tsx` | Updated to `import { WorkflowChat } from "@/components/workflows/chat/WorkflowChat"` and `mode="fullpage"` |

### What could break

- **The canvas test overlay (mode="overlay") no longer opens** — if `WorkflowCanvas` lost the `WorkflowChat` import or `mode="overlay"` was not passed.
- **The overlay renders the full-page UI instead** — if the `mode` discriminant check is broken.
- **The full-page chat at `/workflows/[id]/chat` is blank** — if the `mode="fullpage"` render path was broken.
- **Sending a message in either mode does nothing** — if the `useWorkflowChat` hook connection was broken.
- **Node output panels don't appear during a workflow run** — if the `nodeOutputs` array from the hook is not being iterated.
- **`NodeReasoningBlock` (thinking display) is missing** — if the internal sub-component was not preserved.
- **`WorkflowCodeBlock` doesn't syntax-highlight** — if the internal sub-component was not preserved.
- **Canvas node status colours don't update during a test run** — if `onRunStart` / `onNodeStatusChange` props are not being passed from `WorkflowCanvas` to the overlay `WorkflowChat`.
- **Chat history doesn't load on the full-page route** — if the `chatId` prop and history-loading effect are broken.
- **Closing the overlay does not hide it** — if `onClose` prop is not wired in `WorkflowCanvas`.
- **Old shim imports still work** — any consumer that imports `WorkflowChatInterface` or `WorkflowChatFullPage` must still resolve.

### Manual tests

#### T-D5-1: Canvas test overlay opens (`mode="overlay"`)

1. Navigate to the workflow canvas (`/workflows?id=[id]`).
2. Click the **Test** button in the top bar.
3. Confirm the floating chat panel opens on the right side of the canvas.
4. Confirm the canvas is still visible and interactive behind the overlay.

#### T-D5-2: Send and receive a message in the overlay

1. With the overlay open (see T-D5-1), type a message and press Enter.
2. Confirm the user message appears.
3. Confirm a loading state ("Starting workflow…" or spinner) appears.
4. Confirm node output sections appear as the workflow executes.
5. Confirm the final AI response renders.

#### T-D5-3: Canvas node statuses update during overlay test run

1. While the test is running (see T-D5-2), observe the ReactFlow canvas nodes.
2. Confirm each node changes to a "running" state (e.g. blue border or pulsing indicator) while it is executing.
3. Confirm it transitions to "success" (green) or "error" (red) on completion.
4. Confirm all node statuses reset before the next run starts.

#### T-D5-4: Closing the overlay from the overlay itself

1. Open the overlay.
2. Click the close button (`×`) inside the overlay panel.
3. Confirm the panel disappears.
4. Confirm the canvas is fully accessible again.

#### T-D5-5: Full-page chat renders (`mode="fullpage"`)

1. Navigate to `/workflows/[workflowId]/chat` (or click **Run** on a workflow).
2. Confirm the full-page chat interface loads — a dedicated chat area without the canvas behind it.
3. Confirm the workflow name or metadata is displayed in the header.
4. Confirm the node breakdown count is displayed.

#### T-D5-6: Send and receive a message on the full-page chat

1. On the full-page chat (see T-D5-5), type a message and press Enter.
2. Confirm the same streaming behaviour as T-D5-2.
3. Confirm node output cards appear below the AI response.

#### T-D5-7: Chat history loads on the full-page route

1. Navigate to `/workflows/[workflowId]/chat?chatId=[existingChatId]`.
2. Confirm previous messages load from history (user and AI messages in the correct order).
3. Confirm new messages can be sent and appear below the loaded history.

#### T-D5-8: Stop streaming in either mode

1. In either the overlay or full-page chat, send a message and immediately click **Stop** (square/halt icon).
2. Confirm streaming stops.
3. Confirm the partial response is preserved.
4. Confirm the input area becomes active again.

#### T-D5-9: Overlay and full-page have correct distinct layouts

1. Open the overlay on the canvas — confirm it is a floating panel with timeline-style node output sections.
2. Open the full-page chat — confirm it is a simpler card-based layout without the timeline.
3. Confirm no visual elements from one mode appear in the other.

---

## 6. Reorganize Workflows Sub-folders

**Structure created:**
```
src/components/workflows/
├── canvas/      WorkflowCanvas, CustomNode, CustomEdge, ContextMenu, UtilitySection, Footer + index.ts
├── inspectors/  DocumentNodeInspector, ChatNodeInspector, PinNodeInspector, ModelNodeInspector, PersonaNodeInspector, RightInspector + index.ts
├── dialogs/     SelectPinsDialog, SelectModelDialog, SelectChatsDialog, AddPersonaDialog, LoadWorkflowDialog, EdgeDetailsDialog + index.ts
├── chat/        WorkflowChat, WorkflowChatInterface (shim), WorkflowChatFullPage (shim), CSS module + index.ts
├── index.ts     (updated barrel — re-exports from all four sub-folders + root files)
├── WorkflowCanvas.tsx  (new root shim → canvas/)
└── WorkflowChat.tsx    (new root shim → chat/)
```

### What was changed

| File | Change |
|---|---|
| `src/components/workflows/canvas/*.tsx` | **Moved** from root; relative imports updated (`"./types"` → `"../types"`, etc.) |
| `src/components/workflows/inspectors/*.tsx` | **Moved** from root; `"./types"` → `"../types"`, dialog imports → `"../dialogs/X"` |
| `src/components/workflows/dialogs/*.tsx` | **Moved** from root; `"./workflow-api"` → `"../workflow-api"`, `"./types"` → `"../types"` |
| `src/components/workflows/chat/*.tsx` | **Moved** from root; `"./workflow-api"` → `"../workflow-api"`, `"./types"` → `"../types"` |
| `src/components/workflows/canvas/index.ts` | **Created** — barrel for canvas sub-folder |
| `src/components/workflows/inspectors/index.ts` | **Created** — barrel for inspectors sub-folder |
| `src/components/workflows/dialogs/index.ts` | **Created** — barrel for dialogs sub-folder |
| `src/components/workflows/chat/index.ts` | **Created** — barrel for chat sub-folder |
| `src/components/workflows/index.ts` | **Updated** — re-exports from all four sub-folder barrels + root utilities |
| `src/components/workflows/WorkflowCanvas.tsx` | **Created** — root shim re-exporting `canvas/WorkflowCanvas` for backward compat |
| `src/components/workflows/WorkflowChat.tsx` | **Created** — root shim re-exporting `chat/WorkflowChat` for backward compat |

**Root files unchanged** (imports unaffected): `types.ts`, `workflow-api.ts`, `workflow-utils.ts`, `workflow-graph.ts`, `workflow-row.tsx`, `workflow-wrapper.tsx`, `TopBar.tsx`, `LeftSidebar.tsx`.

### What could break

- **`Cannot find module` TypeScript errors** — if any relative import in a moved file was not updated correctly (e.g. still reading `"./types"` when the file is now one folder deeper).
- **Workflow canvas page (`/workflows`) is blank** — if the root shim `WorkflowCanvas.tsx` is not re-exporting correctly, or if `app/workflows/page.tsx` cannot resolve its import.
- **Workflow full-page chat (`/workflows/[id]/chat`) is blank** — same for the root `WorkflowChat.tsx` shim.
- **Inspector panels don't render** — if `WorkflowCanvas.tsx` in `canvas/` lost its inspector imports (now `"../inspectors/X"`).
- **Dialog sub-components inside inspectors don't render** — if inspector files lost their dialog imports (now `"../dialogs/X"`).
- **Edge details dialog doesn't open** — if `EdgeDetailsDialog` lost its `workflow-utils` import (`"../workflow-utils"`).
- **Workflow type definitions are not found** — if any moved file didn't update `"./types"` → `"../types"`.
- **Sub-folder index barrel exports are incomplete** — if a file was moved but not added to its sub-folder `index.ts`.
- **External hook imports break** — hooks (`use-workflow-state.ts`, `use-workflow-chat.ts`) import from `@/components/workflows/types` and `@/components/workflows/workflow-api`; both stay at root and are unaffected.

### Manual tests

#### T-D6-1: TypeScript build passes with zero new errors

```bash
npx tsc --noEmit
```

Expected: only the pre-existing `message-transformer.ts` `cost` field error. No `Cannot find module`, `Module has no exported member`, or path-resolution errors in any workflows file.

#### T-D6-2: Workflow canvas page loads

1. Navigate to `/workflows`.
2. Confirm the ReactFlow canvas renders (Start and End nodes visible, palette on the left).
3. Open DevTools → Console — confirm no import errors or `undefined` component warnings.

#### T-D6-3: All inspector panels open from the canvas

1. Load a workflow with multiple node types (Model, Document, Chat/Persona, Pin).
2. Click each node type:
   - **Model node** → confirm `ModelNodeInspector` opens on the right.
   - **Document node** → confirm `DocumentNodeInspector` opens.
   - **Pin node** → confirm `PinNodeInspector` opens.
   - **Persona node** → confirm `PersonaNodeInspector` opens.
   - **Chat node** → confirm `ChatNodeInspector` opens.
3. Click an empty canvas area — confirm all inspectors close.

#### T-D6-4: Dialogs open from inspector panels

1. Open the **Pin Node Inspector** (click a Pin node on the canvas).
2. Click **Select Pins** — confirm `SelectPinsDialog` opens and lists available pins.
3. Open the **Model Node Inspector** and click **Select Model** — confirm `SelectModelDialog` opens.
4. Open the **Chat Node Inspector** and click **Select Chat** — confirm `SelectChatsDialog` opens.
5. Open the **Persona Node Inspector** and click **Add Persona** — confirm `AddPersonaDialog` opens.

#### T-D6-5: Load workflow dialog opens

1. In the workflow canvas top bar, click **Load** or **Open** (if present).
2. Confirm the `LoadWorkflowDialog` opens and shows a list of saved workflows.
3. Confirm the search/filter input works.

#### T-D6-6: Edge details dialog opens

1. In the workflow canvas, click on an existing edge (connection line between two nodes).
2. Confirm the `EdgeDetailsDialog` opens showing the source and target node information.

#### T-D6-7: Context menu appears on canvas right-click

1. Right-click on an empty area of the ReactFlow canvas.
2. Confirm the custom `ContextMenu` (from `canvas/ContextMenu.tsx`) appears with node-type options.
3. Click a node type from the menu — confirm the node is added to the canvas.

#### T-D6-8: UtilitySection and Footer render correctly

1. Load the workflow canvas.
2. Locate the utility toolbar (undo, redo, zoom, save buttons — usually at the bottom or top-right of the canvas).
3. Confirm the `UtilitySection` buttons are present and functional (click Undo to verify it triggers the action).
4. Locate the `Footer` (usually at the bottom of the canvas area).
5. Confirm it renders without errors.

#### T-D6-9: Sub-folder barrel imports resolve correctly

Run the following import checks (verifiable via build or a quick test file):

```typescript
// These should all resolve without error after the reorganization:
import { WorkflowCanvas }         from "@/components/workflows/canvas";
import { DocumentNodeInspector }  from "@/components/workflows/inspectors";
import { SelectPinsDialog }       from "@/components/workflows/dialogs";
import { WorkflowChat }           from "@/components/workflows/chat";
import { workflowAPI, WorkflowDTO } from "@/components/workflows";
```

#### T-D6-10: External consumers (pages and hooks) still resolve

1. Confirm `src/app/workflows/page.tsx` imports `WorkflowCanvas` without error — uses `@/components/workflows/WorkflowCanvas` (root shim).
2. Confirm `src/app/workflows/[workflowId]/chat/page.tsx` imports `WorkflowChat` without error — uses `@/components/workflows/chat/WorkflowChat`.
3. Confirm `src/hooks/use-workflow-state.ts` and `src/hooks/use-workflow-chat.ts` still resolve their workflow imports (`@/components/workflows/types`, `@/components/workflows/workflow-api` — both at root, unchanged).

---

## Cross-Cutting Regression Checks

These checks verify the Phase 4 changes have not introduced any runtime errors, import failures, or behavioural regressions. They must pass regardless of which specific decomposition task you are testing.

### T-REG4-1: TypeScript build passes with zero new errors

```bash
npx tsc --noEmit
```

Expected: only the pre-existing `cost` field error in `src/lib/normalizers/message-transformer.ts` (unrelated to Phase 4). No new `Type error`, `Module not found`, `Cannot find module`, or `has no exported member` errors.

### T-REG4-2: Production build succeeds

```bash
npm run build
```

Expected: exit code 0. No new errors. Bundle output sizes should be within ±5% of the pre-Phase 4 baseline (decomposition is code-organisation only — no new dependencies).

### T-REG4-3: No runtime errors on initial load

1. Open the app in a fresh incognito window.
2. Log in.
3. Open DevTools → Console.
4. Navigate the full app: **Chat → Workflows (Canvas) → Workflows (Admin) → Personas → Pinboard → Settings → back to Chat**.
5. Expected: no `Uncaught TypeError`, `Uncaught ReferenceError`, `Cannot update a component while rendering a different component`, or `Invalid hook call` errors.

### T-REG4-4: Full chat send/receive/stream cycle

1. Open a new chat.
2. Select any model.
3. Type a message that will produce: plain text, a code block, and a math formula in the response (e.g. `Explain quicksort in Python with the formula T(n) = 2T(n/2) + n in LaTeX`).
4. Send and confirm:
   - Response streams correctly.
   - Code block renders with syntax highlighting.
   - LaTeX formula renders with KaTeX.
   - No raw `$` or `` ``` `` delimiters visible.
5. Reload the page — confirm history loads correctly.

### T-REG4-5: Chat compose flow — attachment + mention + send

1. Open a chat.
2. Attach a file.
3. Type `@` and select a pin from the dropdown.
4. Add text and send.
5. Confirm both the attachment card and pin reference appear in the sent message.
6. Confirm the compose area resets (no leftover attachment, no residual `@` text).

### T-REG4-6: Workflow canvas create / save / test cycle

1. Create a new workflow.
2. Add a Model node and configure it.
3. Save the workflow.
4. Click **Test** — confirm the floating overlay opens.
5. Send a message — confirm node output panels appear and the response streams.
6. Close the overlay.
7. Click **Run** — confirm navigation to the full-page chat route.
8. Send a message on the full-page chat.

### T-REG4-7: Model selection and switching

1. Open a new chat.
2. Click **Choose Model** — confirm the `ModelDialog` in `select` mode opens and lists models.
3. Select a model — confirm the dialog closes and the model indicator updates.
4. Send a message.
5. Click the model indicator to switch — confirm `ModelDialog` in `switch` mode opens with memory/pin controls.
6. Switch to a different model — confirm the next response comes from the new model.

### T-REG4-8: Workflow directory structure — no missing files

```bash
# From the project root, verify the four sub-folders exist and contain files:
Get-ChildItem src/components/workflows/canvas/  # Should list WorkflowCanvas.tsx, CustomNode.tsx, etc.
Get-ChildItem src/components/workflows/inspectors/  # Should list *NodeInspector.tsx files
Get-ChildItem src/components/workflows/dialogs/  # Should list Select*Dialog.tsx files
Get-ChildItem src/components/workflows/chat/  # Should list WorkflowChat.tsx, *.module.css, etc.
```

### T-REG4-9: SSR pages return HTTP 200

1. Run `npm run build && npm start`.
2. Confirm the following routes return HTTP 200 with no server-side errors:
   - `/chat`
   - `/workflows`
   - `/workflows/admin`
   - `/workflows/[valid-id]/chat`
   - `/personas`
   - `/pinboard`
   - `/settings/usage-and-billing`
3. Confirm no `window is not defined`, `document is not defined`, or SSR hydration mismatch errors in server logs.

### T-REG4-10: No stale component state across navigation

1. Open a chat and start typing (do not send).
2. Navigate to another route and back.
3. Confirm the textarea is cleared (not retaining the unsent text from a stale state).
4. Repeat with a workflow canvas — navigate away with unsaved changes and return.
5. Confirm the unsaved-changes dialog appears correctly (not skipped due to stale state).

---

## Automated Test Stubs

The following test stubs cover the new sub-components created in Phase 4. Pure rendering components are tested with `@testing-library/react`; component snapshots verify that decomposition has not changed the rendered output.

```typescript
// src/components/chat/__tests__/phase4-decomposition.test.tsx

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── CodeBlock ────────────────────────────────────────────────────────────────

import { CodeBlock } from "../CodeBlock";

describe("CodeBlock", () => {
  it("renders code content inside a <pre><code> block", () => {
    render(<CodeBlock code="const x = 1;" language="javascript" />);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain("const x = 1;");
  });

  it("displays the language label", () => {
    render(<CodeBlock code="SELECT 1;" language="sql" />);
    expect(screen.getByText(/sql/i)).toBeInTheDocument();
  });

  it("renders without a language prop", () => {
    render(<CodeBlock code="echo hello" />);
    const pre = document.querySelector("pre");
    expect(pre).toBeInTheDocument();
  });

  it("copy button triggers clipboard write", async () => {
    const writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeMock },
      writable: true,
    });

    render(<CodeBlock code="const y = 2;" language="typescript" />);
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    await userEvent.click(copyBtn);
    expect(writeMock).toHaveBeenCalledWith("const y = 2;");
  });

  it("shows a 'Copied!' indicator after clicking copy", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
      writable: true,
    });

    render(<CodeBlock code="let z = 3;" language="javascript" />);
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    await userEvent.click(copyBtn);
    await waitFor(() => {
      expect(screen.queryByText(/copied/i)).toBeInTheDocument();
    });
  });

  it("does not inject unsanitized HTML", () => {
    const malicious = '<script>alert("xss")</script>';
    render(<CodeBlock code={malicious} language="html" />);
    // The script tag content should appear as text, not execute
    expect(document.querySelector("script")).toBeNull();
  });
});

// ─── ReasoningBlock ───────────────────────────────────────────────────────────

import { ReasoningBlock } from "../ReasoningBlock";

describe("ReasoningBlock", () => {
  it("renders collapsed by default when not streaming", () => {
    render(<ReasoningBlock text="Let me think about this…" isStreaming={false} />);
    // The button to expand should be present
    const toggleBtn = screen.getByRole("button");
    expect(toggleBtn).toBeInTheDocument();
    // Content should not be immediately visible (collapsed)
    expect(screen.queryByText("Let me think about this…")).not.toBeVisible();
  });

  it("expands to show text on toggle click", async () => {
    render(<ReasoningBlock text="Step 1: analyse the problem." isStreaming={false} />);
    const toggleBtn = screen.getByRole("button");
    await userEvent.click(toggleBtn);
    expect(screen.getByText("Step 1: analyse the problem.")).toBeVisible();
  });

  it("collapses again on second toggle click", async () => {
    render(<ReasoningBlock text="Reasoning content." isStreaming={false} />);
    const toggleBtn = screen.getByRole("button");
    await userEvent.click(toggleBtn);
    await userEvent.click(toggleBtn);
    expect(screen.queryByText("Reasoning content.")).not.toBeVisible();
  });

  it("is auto-expanded when isStreaming is true", () => {
    render(<ReasoningBlock text="Thinking…" isStreaming={true} />);
    expect(screen.getByText("Thinking…")).toBeVisible();
  });

  it("renders null / empty text without crashing", () => {
    expect(() => render(<ReasoningBlock text="" isStreaming={false} />)).not.toThrow();
    expect(() => render(<ReasoningBlock text={null as any} isStreaming={false} />)).not.toThrow();
  });
});

// ─── AttachmentManager ────────────────────────────────────────────────────────

import { AttachmentManager } from "../AttachmentManager";

describe("AttachmentManager", () => {
  const makeFile = (name: string, type: string, size = 1024) =>
    new File(["content"], name, { type, size } as any);

  it("renders nothing when attachments array is empty", () => {
    const { container } = render(
      <AttachmentManager attachments={[]} onRemoveAttachment={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a card for each attachment", () => {
    const attachments = [
      { id: "1", file: makeFile("doc.pdf", "application/pdf"), previewUrl: null },
      { id: "2", file: makeFile("image.png", "image/png"), previewUrl: "blob:fake-url" },
    ];
    render(<AttachmentManager attachments={attachments} onRemoveAttachment={jest.fn()} />);
    expect(screen.getByText("doc.pdf")).toBeInTheDocument();
    expect(screen.getByText("image.png")).toBeInTheDocument();
  });

  it("calls onRemoveAttachment with the correct id when × is clicked", async () => {
    const onRemove = jest.fn();
    const attachments = [
      { id: "attach-1", file: makeFile("test.txt", "text/plain"), previewUrl: null },
    ];
    render(<AttachmentManager attachments={attachments} onRemoveAttachment={onRemove} />);
    const removeBtn = screen.getByRole("button", { name: /remove/i });
    await userEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith("attach-1");
  });

  it("shows a file name for each attachment", () => {
    const attachments = [
      { id: "3", file: makeFile("report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), previewUrl: null },
    ];
    render(<AttachmentManager attachments={attachments} onRemoveAttachment={jest.fn()} />);
    expect(screen.getByText("report.docx")).toBeInTheDocument();
  });
});

// ─── ModelDialog — mode="select" ──────────────────────────────────────────────

import { ModelDialog } from "../ModelDialog";

const mockModels = [
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", modalities: ["text"], framework: "base" },
  { id: "claude-3", name: "Claude 3", provider: "anthropic", modalities: ["text"], framework: "pro" },
];

jest.mock("@/lib/api/ai-models", () => ({
  fetchModels: jest.fn().mockResolvedValue(mockModels),
}));

describe("ModelDialog — select mode", () => {
  it("renders when open=true", () => {
    render(
      <ModelDialog
        mode="select"
        open={true}
        onOpenChange={jest.fn()}
        onModelSelect={jest.fn()}
        onFrameworkSelect={jest.fn()}
        useFramework={false}
        userPlanType="pro"
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when open=false", () => {
    render(
      <ModelDialog
        mode="select"
        open={false}
        onOpenChange={jest.fn()}
        onModelSelect={jest.fn()}
        onFrameworkSelect={jest.fn()}
        useFramework={false}
        userPlanType="starter"
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onModelSelect when a model is clicked", async () => {
    const onModelSelect = jest.fn();
    render(
      <ModelDialog
        mode="select"
        open={true}
        onOpenChange={jest.fn()}
        onModelSelect={onModelSelect}
        onFrameworkSelect={jest.fn()}
        useFramework={false}
        userPlanType="pro"
      />,
    );
    await waitFor(() => screen.getByText("GPT-4o"));
    await userEvent.click(screen.getByText("GPT-4o"));
    expect(onModelSelect).toHaveBeenCalled();
  });
});

describe("ModelDialog — switch mode", () => {
  it("renders when open=true", () => {
    render(
      <ModelDialog
        mode="switch"
        open={true}
        onOpenChange={jest.fn()}
        currentModel={null}
        onModelSwitch={jest.fn()}
        userPlanType="pro"
      />,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("calls onModelSwitch when confirm is clicked", async () => {
    const onModelSwitch = jest.fn();
    render(
      <ModelDialog
        mode="switch"
        open={true}
        onOpenChange={jest.fn()}
        currentModel={null}
        onModelSwitch={onModelSwitch}
        userPlanType="pro"
      />,
    );
    await waitFor(() => screen.getByText("GPT-4o"));
    await userEvent.click(screen.getByText("GPT-4o"));
    const switchBtn = screen.getByRole("button", { name: /switch|confirm/i });
    await userEvent.click(switchBtn);
    expect(onModelSwitch).toHaveBeenCalled();
  });
});

// ─── Workflows sub-folder barrel import verification ──────────────────────────

describe("workflows sub-folder barrel exports", () => {
  it("canvas barrel exports WorkflowCanvas", () => {
    const canvasExports = require("@/components/workflows/canvas");
    expect(typeof canvasExports.WorkflowCanvas).toBe("function");
  });

  it("inspectors barrel exports all inspector components", () => {
    const inspectorExports = require("@/components/workflows/inspectors");
    expect(typeof inspectorExports.DocumentNodeInspector).toBe("function");
    expect(typeof inspectorExports.ChatNodeInspector).toBe("function");
    expect(typeof inspectorExports.PinNodeInspector).toBe("function");
    expect(typeof inspectorExports.ModelNodeInspector).toBe("function");
    expect(typeof inspectorExports.PersonaNodeInspector).toBe("function");
  });

  it("dialogs barrel exports all dialog components", () => {
    const dialogExports = require("@/components/workflows/dialogs");
    expect(typeof dialogExports.SelectPinsDialog).toBe("function");
    expect(typeof dialogExports.SelectModelDialog).toBe("function");
    expect(typeof dialogExports.SelectChatsDialog).toBe("function");
    expect(typeof dialogExports.AddPersonaDialog).toBe("function");
    expect(typeof dialogExports.LoadWorkflowDialog).toBe("function");
    expect(typeof dialogExports.EdgeDetailsDialog).toBe("function");
  });

  it("chat barrel exports WorkflowChat", () => {
    const chatExports = require("@/components/workflows/chat");
    expect(typeof chatExports.WorkflowChat).toBe("function");
  });

  it("root barrel exports workflowAPI and types unchanged", () => {
    const rootExports = require("@/components/workflows");
    expect(typeof rootExports.workflowAPI).toBe("object");
    expect(typeof rootExports.WorkflowCanvas).toBe("function");
    expect(typeof rootExports.WorkflowChat).toBe("function");
  });
});
```

---

## Quick Smoke-Test Checklist

Use this before any production deploy to confirm Phase 4 changes have not regressed.

| # | Task | Area | Test | Pass / Fail |
|---|---|---|---|---|
| 1 | Build | All | `npm run build` completes with zero new errors | |
| 2 | Build | All | `npx tsc --noEmit` shows only the pre-existing `message-transformer.ts` error | |
| 3 | `PinMentionDropdown` | Chat | Typing `@` opens the mention dropdown | |
| 4 | `PinMentionDropdown` | Chat | Arrow-key navigation highlights items correctly | |
| 5 | `PinMentionDropdown` | Chat | Enter selects a pin and inserts text into textarea | |
| 6 | `PinMentionDropdown` | Chat | Escape closes the dropdown without inserting | |
| 7 | `PinMentionDropdown` | Chat | `pin-insert-to-chat` event inserts pin text from the right sidebar | |
| 8 | `AttachmentManager` | Chat | Attaching a file shows a preview card in the strip | |
| 9 | `AttachmentManager` | Chat | Correct MIME-type icon shown for PDF / image / document | |
| 10 | `AttachmentManager` | Chat | Clicking × removes the attachment card | |
| 11 | `AttachmentManager` | Chat | File size validation toast appears for oversized files | |
| 12 | `ChatToolbar` | Chat | Web Search toggle visually activates and includes param in request | |
| 13 | `ChatToolbar` | Chat | File upload button opens the OS file picker | |
| 14 | `ChatToolbar` | Chat | Toast notifications appear for toolbar action confirmations | |
| 15 | `CodeBlock` | Chat | AI code response renders with syntax highlighting | |
| 16 | `CodeBlock` | Chat | Language label is displayed on the code block header | |
| 17 | `CodeBlock` | Chat | Copy button copies raw code and shows "Copied!" feedback | |
| 18 | `LaTeXRenderer` | Chat | Inline `$...$` expression renders as typeset math | |
| 19 | `LaTeXRenderer` | Chat | Block `$$...$$` equation renders centered on its own line | |
| 20 | `LaTeXRenderer` | Chat | No raw `$` delimiters visible in the final rendered output | |
| 21 | `LinkPreviewCard` | Chat | Link preview card renders with favicon and title | |
| 22 | `LinkPreviewCard` | Chat | Metadata fetch fires once per URL (cache prevents repeat fetches) | |
| 23 | `LinkPreviewCard` | Chat | `mailto:` links render as email anchors, not preview cards | |
| 24 | `ReasoningBlock` | Chat | Reasoning block appears for thinking-capable model responses | |
| 25 | `ReasoningBlock` | Chat | Block auto-expands during streaming; is collapsible after | |
| 26 | `ReasoningBlock` | Chat | Typewriter effect plays during active streaming | |
| 27 | `DeleteChatDialog` | Layout | Delete button on a chat board opens the confirmation dialog | |
| 28 | `DeleteChatDialog` | Layout | Cancel closes the dialog without deleting | |
| 29 | `DeleteChatDialog` | Layout | Confirm removes the chat board from the sidebar | |
| 30 | `AppDialogs` | Layout | Compare Models dialog opens correctly | |
| 31 | `AppDialogs` | Layout | Model switch dialog opens with memory and pin controls | |
| 32 | `AppDialogs` | Layout | Plan upgrade dialog appears when quota is exceeded | |
| 33 | `useActivePersonas` | Layout | Active personas (status="test") appear in the persona picker | |
| 34 | `useActivePersonas` | Layout | Persona API is fetched only once on page load (no loop) | |
| 35 | `ModelDialog select` | Chat | Model selector dialog opens and lists all available models | |
| 36 | `ModelDialog select` | Chat | Framework toggle (Base/Pro) filters the model list | |
| 37 | `ModelDialog select` | Chat | Modality filters (Text/Image/Audio) filter the model list | |
| 38 | `ModelDialog select` | Chat | Selecting a model closes the dialog and updates the toolbar | |
| 39 | `ModelDialog switch` | Chat | Switch dialog opens mid-chat with memory slider | |
| 40 | `ModelDialog switch` | Chat | Memory slider updates the "messages included" count | |
| 41 | `ModelDialog switch` | Chat | Confirming the switch applies the new model to subsequent messages | |
| 42 | `ModelDialog shim` | Chat | Old import path `model-switch-dialog` still resolves without error | |
| 43 | `WorkflowChat overlay` | Workflows | Test button opens the floating chat overlay on the canvas | |
| 44 | `WorkflowChat overlay` | Workflows | Message sends and response streams in the overlay | |
| 45 | `WorkflowChat overlay` | Workflows | Canvas node statuses update during a test run | |
| 46 | `WorkflowChat overlay` | Workflows | Closing the overlay hides it and restores canvas focus | |
| 47 | `WorkflowChat fullpage` | Workflows | `/workflows/[id]/chat` route loads the full-page chat | |
| 48 | `WorkflowChat fullpage` | Workflows | Message sends and response streams on the full-page route | |
| 49 | `WorkflowChat fullpage` | Workflows | Chat history loads when `chatId` query param is provided | |
| 50 | `WorkflowChat shim` | Workflows | Old import `WorkflowChatInterface` still resolves | |
| 51 | `WorkflowChat shim` | Workflows | Old import `WorkflowChatFullPage` still resolves | |
| 52 | Sub-folders | Workflows | `canvas/` contains WorkflowCanvas, CustomNode, CustomEdge, ContextMenu | |
| 53 | Sub-folders | Workflows | `inspectors/` contains all five `*NodeInspector` files | |
| 54 | Sub-folders | Workflows | `dialogs/` contains all six `Select*` / `*Dialog` files | |
| 55 | Sub-folders | Workflows | `chat/` contains WorkflowChat.tsx and the CSS module | |
| 56 | Sub-folders | Workflows | Each sub-folder has an `index.ts` barrel that exports all its components | |
| 57 | Canvas inspectors | Workflows | Clicking each node type opens the correct inspector panel | |
| 58 | Canvas dialogs | Workflows | "Select Pins" from PinNodeInspector opens SelectPinsDialog | |
| 59 | Canvas dialogs | Workflows | "Select Model" from ModelNodeInspector opens SelectModelDialog | |
| 60 | Canvas | Workflows | Right-click context menu appears and adds a node to the canvas | |
| 61 | Regression | All | Full chat send/receive/stream cycle — code + LaTeX + links in one response | |
| 62 | Regression | All | Full workflow canvas create/save/test cycle | |
| 63 | Regression | All | Full persona chat cycle — avatar loads, response streams | |
| 64 | Regression | All | Pinboard CRUD — create pin, add tag, organize into folder | |
| 65 | Regression | All | No `Uncaught TypeError` or `ReferenceError` during full app navigation | |
| 66 | Regression | All | No `Invalid hook call` or React rendering order warnings in console | |
| 67 | Regression | All | SSR pages (`/chat`, `/workflows`, `/pinboard`) return HTTP 200 | |
