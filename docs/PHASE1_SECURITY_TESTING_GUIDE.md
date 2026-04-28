# Phase 1 — Security Hardening: Testing Guide

This document covers how to verify every change implemented in Phase 1 — Security Hardening, confirm that no existing functionality is broken, and detect regressions. Tests are ordered by feature area and include both manual browser steps and automated unit-test stubs.

---

## Table of Contents

1. [S1 — DOMPurify for `dangerouslySetInnerHTML`](#s1--dompurify-for-dangerouslysetinnerhtml)
2. [S4 — URL Sanitization in Markdown Link Rendering](#s4--url-sanitization-in-markdown-link-rendering)
3. [S9 — Input Sanitization for Folder / Tag Names](#s9--input-sanitization-for-folder--tag-names)
4. [S12 — Replace Counters with `crypto.randomUUID()`](#s12--replace-counters-with-cryptorandomuuid)
5. [Console Log Removal — Auth Headers & Sensitive Data](#console-log-removal--auth-headers--sensitive-data)
6. [Cross-Cutting Regression Checks](#cross-cutting-regression-checks)
7. [Automated Test Stubs](#automated-test-stubs)

---

## S1 — DOMPurify for `dangerouslySetInnerHTML`

### What was changed

| File | Change |
|---|---|
| `src/lib/security.ts` | Added `sanitizeKaTeX()` and `sanitizeInlineMarkdown()` backed by `isomorphic-dompurify` |
| `src/components/chat/chat-message.tsx` | KaTeX blocks now use `sanitizeKaTeX()` |
| `src/components/compare/compare-models.tsx` | KaTeX blocks now use `sanitizeKaTeX()` |
| `src/components/workflows/WorkflowChatInterface.tsx` | Inline markdown lines now use `sanitizeInlineMarkdown()` |

### What could break

- **KaTeX rendering fails / goes blank** — if `sanitizeKaTeX` is too aggressive and strips tags that KaTeX relies on (e.g., `<svg>`, `<use>`, `<path>`, MathML tags).
- **Bold / italic / code in workflow chat disappears** — if `sanitizeInlineMarkdown` strips `<strong>`, `<em>`, `<code>`, or `<span>`.
- **SSR crash** — `isomorphic-dompurify` must handle the server-side (no `document` object) gracefully.

### Manual tests

#### T-S1-1: KaTeX renders correctly in chat

1. Open any chat that produces a math formula (e.g., send the message `Explain Euler's formula e^(iπ) + 1 = 0 using LaTeX`).
2. Confirm the rendered equation appears as a proper mathematical symbol, not raw LaTeX text or an empty box.
3. Inspect the DOM — the `.katex` element should contain intact SVG/MathML children, not stripped markup.

#### T-S1-2: KaTeX renders correctly in compare-models view

1. Navigate to the model comparison page.
2. Ask both models a math question that produces LaTeX output.
3. Verify both columns render the equation correctly.

#### T-S1-3: Inline markdown renders in workflow chat

1. Open a workflow and send a message that produces **bold**, *italic*, and `code` in the response.
2. Confirm the text is styled — bold appears bold, italic appears italic, inline code uses a monospace style.
3. Confirm no raw `<strong>` or `<em>` HTML tags are visible as text.

#### T-S1-4: XSS is blocked

1. In a dev/staging environment, craft a response containing:
   ```
   <img src=x onerror="alert('XSS')">
   <script>alert('XSS')</script>
   <a href="javascript:alert('XSS')">click</a>
   ```
2. Confirm no JavaScript alert fires.
3. Confirm the `<script>` tag is stripped entirely.
4. Confirm the `<img>` tag either strips the `onerror` attribute or removes the element.
5. Confirm the `javascript:` link is either stripped or rendered as plain text.

#### T-S1-5: SSR does not crash

1. Run `npm run build` — it must complete without errors.
2. Start the server with `npm start` and hard-refresh a page that renders KaTeX or inline markdown.
3. Confirm no `window is not defined` or `document is not defined` error in the server logs.

---

## S4 — URL Sanitization in Markdown Link Rendering

### What was changed

| File | Change |
|---|---|
| `src/lib/security.ts` | `sanitizeURL()` rewritten from blocklist to strict allowlist (`http:`, `https:`, `mailto:` only) |
| `src/components/chat/chat-message.tsx` | `LinkPreview`, `formatCellHtml`, search-result links, reasoning-block links, file-attachment links |
| `src/components/compare/compare-models.tsx` | `SimpleLinkPreview` |
| `src/components/chat/citations-panel.tsx` | `SourceCard` href, favicon, hostname |
| `src/components/chat/chat-interface.tsx` | Attachment links |
| `src/components/personas/PersonaChatFullPage.tsx` | Attachment links |

### What could break

- **Legitimate links go missing / rendered as plain text** — if `sanitizeURL` is too strict (e.g., rejects relative URLs or `www.` domains without protocol).
- **Citation panel sources show no link** — if source URLs from the backend are non-`http(s)` for some reason.
- **Attachment preview links are dead** — if attachment URLs are relative paths or presigned S3 URLs with unusual formats.
- **`mailto:` links for contact info break** — if the allowlist is not respected.

### Manual tests

#### T-S4-1: Normal `https://` links work end-to-end

1. Send a message asking the AI to include a link, e.g., `What is the URL for OpenAI's website?`
2. When the AI responds with `https://openai.com`, confirm it renders as a clickable hyperlink.
3. Click the link — it should navigate (or open in a new tab) correctly.

#### T-S4-2: `javascript:` links are blocked

1. In dev/staging, inject a message that contains a markdown link like:
   ```
   [Click me](javascript:alert('XSS'))
   ```
2. Confirm the link renders as plain text `Click me` with no `href`, OR the `href` attribute is absent.
3. Confirm no JS alert fires on click.

#### T-S4-3: `data:` URI links are blocked

1. Inject:
   ```
   [img](data:text/html,<script>alert(1)</script>)
   ```
2. Confirm no rendered link points to a `data:` URI.

#### T-S4-4: Relative URLs used in the app remain functional

1. Check any navigation links that use relative paths (e.g., `/settings`, `/chat/new`).
2. These are **not** passed through `sanitizeURL` in the implementation (only user/AI-provided URLs are sanitized) — confirm they still work.
3. If any internal `<Link>` components appear broken, verify they do not pass through `sanitizeURL`.

#### T-S4-5: Citation panel renders source URLs

1. Ask a question that triggers web search or citations (e.g., a factual question with sources).
2. Open the citations panel.
3. Confirm each source card shows a favicon, hostname, and a clickable `https://` link.
4. Confirm the link opens the correct source page.

#### T-S4-6: File attachment links open correctly

1. Upload a file in chat, then view it in the attachment viewer.
2. Confirm the "Open" or "View" link works and navigates to the file URL (typically an S3 presigned `https://` URL).

#### T-S4-7: `mailto:` links render correctly

1. If the app or an AI response contains a `mailto:example@domain.com` link, confirm it renders as a clickable `mailto:` link.
2. Clicking it should open the system email client.

#### T-S4-8: `www.` URLs without protocol render correctly

> `sanitizeURL` upgrades bare `www.example.com` → `https://www.example.com`.

1. In a markdown response, produce a link like `[website](www.example.com)`.
2. Confirm it renders as `https://www.example.com` (not stripped).

---

## S9 — Input Sanitization for Folder / Tag Names

### What was changed

| File | Change |
|---|---|
| `src/lib/security.ts` | Added `sanitizeFolderName()` (max 100 chars) and `sanitizeTagName()` (max 50 chars) |
| `src/lib/api/pins.ts` | `createPinFolder()` validates name before sending to backend |
| `src/components/pinboard/organize-pins-dialog.tsx` | Folder create / rename / move-and-create use sanitization + `maxLength` on inputs |
| `src/components/pinboard/pin-item.tsx` | Tag add, folder create use sanitization + `maxLength` on inputs |

### What could break

- **Folder creation silently fails** — if a valid folder name is incorrectly treated as empty after sanitization.
- **Renaming a folder fails** — if `sanitizeFolderName` strips characters that the UI uses for rename.
- **Tags with spaces or hyphens are rejected** — if the sanitizer incorrectly collapses valid tag text.
- **Long folder names typed in one go are silently truncated** — user may be confused; the UI `maxLength` prevents this at input level.

### Manual tests

#### T-S9-1: Normal folder name creates successfully

1. Open the pin organizer dialog.
2. Create a new folder named `My Projects`.
3. Confirm the folder appears in the folder list with exactly that name.

#### T-S9-2: Leading/trailing whitespace is trimmed

1. Create a folder named `   Trimmed   ` (with surrounding spaces).
2. Confirm the folder is saved as `Trimmed` (no surrounding spaces).

#### T-S9-3: Folder name with control characters is cleaned

1. Using a browser console or a test script, attempt to POST a folder name containing a null byte: `Valid\u0000Name`.
2. Confirm the API rejects it with an error, or the backend receives `ValidName` (null byte stripped).
3. Confirm no crash or 500 error occurs.

#### T-S9-4: Excessively long folder name is truncated

1. In the organize dialog, paste 200 characters into the folder name field.
2. Confirm the input's `maxLength={100}` prevents entering beyond 100 characters.
3. Even if `maxLength` is bypassed (e.g., via browser dev tools), confirm `sanitizeFolderName()` truncates the name to 100 characters before the API call.

#### T-S9-5: Empty folder name is rejected

1. Open the folder creation dialog.
2. Enter only whitespace or control characters (e.g., `   `, or paste a zero-width space `\u200B`).
3. Confirm the "Create" button remains disabled OR an error message appears — the folder must NOT be created.

#### T-S9-6: Tag with normal text is added

1. Open a pin item.
2. Add a tag named `important`.
3. Confirm the tag appears on the pin.

#### T-S9-7: Tag name max length is enforced

1. Attempt to add a tag with 60+ characters.
2. Confirm the input's `maxLength={50}` prevents entering beyond 50 characters.
3. Confirm the tag is saved as at most 50 characters if the limit is bypassed.

#### T-S9-8: Tag with only whitespace is rejected

1. Type only spaces in the tag input and press Enter.
2. Confirm no empty tag is added to the pin.

#### T-S9-9: Folder rename works normally

1. Right-click (or use the edit icon) on an existing folder.
2. Rename it to `Renamed Folder`.
3. Confirm the folder name updates in the UI and persists on reload.

---

## S12 — Replace Counters with `crypto.randomUUID()`

### What was changed

| File | Change |
|---|---|
| `src/components/workflows/WorkflowCanvas.tsx` | Removed `let id = 0` counter and `syncIdCounter`; node IDs are now UUIDs |
| `src/components/workflows/CustomNode.tsx` | Removed dead `let id = 0` counter block |
| `src/components/workflows/WorkflowChatInterface.tsx` | Message IDs use `crypto.randomUUID()` |
| `src/components/workflows/RightInspector.tsx` | Uploaded file IDs use `crypto.randomUUID()` |
| `src/components/chat/chat-message.tsx` | Loading message ID uses `crypto.randomUUID()` |
| `src/components/chat/chat-interface.tsx` | Loading message ID, `turnId`, temp `chatId` use `crypto.randomUUID()` |
| `src/components/personas/PersonaChatFullPage.tsx` | Message IDs, temp `chatId` use `crypto.randomUUID()` |
| `src/components/pinboard/organize-pins-dialog.tsx` | Fallback folder IDs, copy IDs use `crypto.randomUUID()` |
| `src/components/layout/app-layout.tsx` | All 4 fallback/temp ID generation points use `crypto.randomUUID()` |
| `src/app/personas/new/configure/utils.ts` | `generateFileId()` returns `crypto.randomUUID()` |

### What could break

- **Workflow nodes lose connections on save/load** — if the node ID format changed from `node_0` to a UUID and any code compares IDs by pattern (`node_` prefix).
- **Hot reload resets workflow state** — actually this is the *intended fix*; a counter resetting to 0 on hot reload could cause ID collisions. UUIDs eliminate this. Regression: verify state is preserved correctly.
- **`crypto.randomUUID()` throws in an unsupported environment** — very old browsers or non-HTTPS contexts do not support `crypto.randomUUID()`.
- **React key collisions** — if UUIDs are not being generated fresh per render and some memoization bug causes the same UUID to be reused.

### Manual tests

#### T-S12-1: Workflow canvas — add multiple nodes

1. Open the workflow canvas.
2. Drag in 5+ nodes of different types (start, end, chat, model, persona).
3. Confirm each node has a unique ID in the React DevTools or by inspecting the workflow JSON.
4. Confirm no two nodes share the same ID.

#### T-S12-2: Workflow canvas — save and reload

1. Build a workflow with 3+ connected nodes.
2. Save the workflow.
3. Navigate away and return to the workflow.
4. Confirm all nodes and edges are present and correctly connected.
5. Confirm node IDs in the loaded state are UUIDs (not `node_0`, `node_1`, etc.).

#### T-S12-3: Workflow canvas — hot reload does not cause ID collisions

1. Start `npm run dev`.
2. Build a workflow with nodes.
3. Edit a source file and save (triggering HMR).
4. Confirm the existing nodes on the canvas retain their IDs (they are not reset to `node_0` again).
5. Add a new node after HMR — confirm it gets a new unique UUID, not one that conflicts with existing nodes.

#### T-S12-4: Chat — messages get unique IDs

1. Open a chat and send 3 messages in quick succession.
2. In React DevTools or by logging `chatHistory`, confirm each message has a unique `id` field.
3. Confirm no two messages share the same ID even when sent within milliseconds.

#### T-S12-5: Workflow chat — AI and user messages have unique IDs

1. Open a workflow chat.
2. Send a message and wait for the AI response.
3. Confirm both the user message and AI response message have distinct UUIDs.

#### T-S12-6: File upload in RightInspector gets unique ID

1. Open the workflow right inspector.
2. Upload the same file twice.
3. Confirm both uploaded files appear in the list with different IDs (previously `Date.now()` + `Math.random()` could theoretically collide under rapid uploads).

#### T-S12-7: `crypto.randomUUID()` availability

1. Open the browser console on a production build served over HTTPS.
2. Run `crypto.randomUUID()` — confirm it returns a valid UUID string without error.
3. If the app must support HTTP (dev only), confirm `npm run dev` does not surface any `crypto.randomUUID is not a function` errors.

---

## Console Log Removal — Auth Headers & Sensitive Data

### What was changed

| File | Change |
|---|---|
| `src/components/workflows/workflow-api.ts` | Removed `console.debug("[SSE] Event:", eventType)` (ran in production); guarded `console.warn("[SSE] Failed to parse event JSON:")` with `NODE_ENV === "development"` |
| `src/lib/api/chat.ts` | Removed `console.debug("[Chat GET] raw messages response:", ...)` (dumped entire message history) |
| `src/components/layout/app-layout.tsx` | Removed two `console.debug("[DEBUG] Raw backend messages:")` and `"[DEBUG] Normalized messages:"` calls |
| `src/components/workflows/WorkflowChatInterface.tsx` | Removed 7 unguarded streaming callbacks logs (workflow start, node start, chunk content, updated content, node end, node complete, workflow complete) |

### What could break

- **Streaming appears to hang** — if any removed log was inadvertently masking a bug (unlikely, but possible).
- **Developers lose visibility into SSE frame parsing errors** — intentional; now dev-only.
- **Chat history loads silently fail** — the `[Chat GET]` log was the only indicator of a successful load; real errors surface through the existing error-handling paths.

### Manual tests

#### T-LOG-1: Browser console is clean in production

1. Build the app: `npm run build && npm start`.
2. Open the browser DevTools Console.
3. Navigate through the app: open a chat, send a message, wait for streaming response.
4. Confirm **no** `[SSE]`, `[WorkflowAPI]`, `[Stream]`, `[Chat GET]`, `[DEBUG]` prefixed messages appear in the console.
5. The console should be silent except for any legitimate `console.error` from actual failures.

#### T-LOG-2: SSE parsing errors surface only in development

1. Run `npm run dev`.
2. Using browser DevTools > Network, find the SSE stream connection.
3. Simulate a malformed SSE frame by temporarily patching the server or using a proxy to inject `data: {broken json`.
4. Confirm `[SSE] Failed to parse event JSON:` appears in the console **only** in dev mode.
5. Build for production and repeat — confirm the warning does NOT appear.

#### T-LOG-3: Workflow streaming still works end-to-end

1. Open a workflow with at least 2 nodes.
2. Send a message in the workflow chat.
3. Confirm streaming responses appear in real time in the UI.
4. Confirm node output panels update progressively as each node completes.
5. Confirm the final response is correctly assembled.

> The removed `console.debug` calls were observation-only. If streaming breaks here, the root cause is elsewhere — check network and the `onError` callback.

#### T-LOG-4: Chat message history loads correctly

1. Open an existing chat with 10+ messages.
2. Confirm all messages load and display in the correct order.
3. Confirm attachments (images, files) still appear on the messages that had them.
4. Confirm thinking/reasoning blocks still expand correctly.

> The removed `[Chat GET] raw messages response` log was a debugging artifact. If messages fail to load, inspect the Network tab for the `GET /chats/{id}/messages` response instead.

#### T-LOG-5: No sensitive data visible in the console

1. With DevTools Console open, log in, open a chat, and send a message.
2. Confirm the following are **NOT** printed to the console at any point:
   - JWT / Bearer token values
   - Full message history as JSON
   - Streaming chunk content (the actual text being generated)
   - Raw backend payloads with user data

---

## Cross-Cutting Regression Checks

These checks must pass regardless of which specific S-task you are testing.

### T-REG-1: Application builds without TypeScript errors

```bash
npm run build
```
Expected: exit code 0, no `Type error` lines in output.

### T-REG-2: No runtime errors on app load

1. Open the app in a fresh incognito window.
2. Log in.
3. Observe the console for 60 seconds while navigating chat, workflows, pinboard.
4. Expected: no `Uncaught TypeError`, `Uncaught ReferenceError`, or `Failed to fetch` errors.

### T-REG-3: Chat flow — full send/receive cycle

1. Open a new chat.
2. Select a model.
3. Send a message.
4. Confirm the response streams in and completes.
5. Confirm the message is persisted (reload the page — the message should still be there).

### T-REG-4: Workflow flow — create, run, view output

1. Create a new workflow with at least one chat node.
2. Connect start → chat node → end.
3. Save the workflow.
4. Open workflow chat.
5. Send a message.
6. Confirm the streaming output appears in the node output panel and the final message.

### T-REG-5: Pinboard — create folder, add pin, add tag

1. Navigate to the pinboard.
2. Create a new folder named `Test Folder`.
3. Move a pin into that folder.
4. Add a tag `test-tag` to the pin.
5. Confirm all three operations succeed and reflect in the UI.

### T-REG-6: SSR pages do not crash

1. With JavaScript disabled in the browser (or by checking server response HTML), open:
   - `/chat`
   - `/workflows`
   - `/pinboard`
2. Confirm the server returns valid HTML (status 200) without internal server errors.
3. Re-enable JavaScript and confirm hydration completes without console errors.

---

## Automated Test Stubs

The following unit-test stubs can be added to your test suite (Jest / Vitest). They cover the pure functions in `src/lib/security.ts`.

```typescript
// src/lib/__tests__/security.test.ts

import { sanitizeURL, sanitizeFolderName, sanitizeTagName, sanitizeInlineMarkdown, sanitizeKaTeX } from "../security";

// ─── sanitizeURL ────────────────────────────────────────────────────────────

describe("sanitizeURL", () => {
  it("passes through valid https URLs", () => {
    expect(sanitizeURL("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
  });

  it("passes through valid http URLs", () => {
    expect(sanitizeURL("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("passes through mailto links", () => {
    expect(sanitizeURL("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("upgrades bare www. URLs to https", () => {
    expect(sanitizeURL("www.example.com")).toBe("https://www.example.com");
  });

  it("returns empty string for javascript: URLs", () => {
    expect(sanitizeURL("javascript:alert(1)")).toBe("");
  });

  it("returns empty string for data: URIs", () => {
    expect(sanitizeURL("data:text/html,<script>alert(1)</script>")).toBe("");
  });

  it("returns empty string for vbscript: URLs", () => {
    expect(sanitizeURL("vbscript:msgbox(1)")).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeURL("")).toBe("");
  });

  it("handles encoded javascript: bypass attempt", () => {
    expect(sanitizeURL("javascript%3Aalert(1)")).toBe("");
  });
});

// ─── sanitizeFolderName ──────────────────────────────────────────────────────

describe("sanitizeFolderName", () => {
  it("returns a normal name unchanged", () => {
    expect(sanitizeFolderName("My Projects")).toBe("My Projects");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeFolderName("  hello  ")).toBe("hello");
  });

  it("strips null bytes", () => {
    expect(sanitizeFolderName("Valid\u0000Name")).toBe("ValidName");
  });

  it("strips C0 control characters", () => {
    expect(sanitizeFolderName("Name\u0001\u001FEnd")).toBe("NameEnd");
  });

  it("strips C1 control characters", () => {
    expect(sanitizeFolderName("Name\u0080\u009FEnd")).toBe("NameEnd");
  });

  it("collapses multiple internal spaces", () => {
    expect(sanitizeFolderName("foo   bar")).toBe("foo bar");
  });

  it("truncates to 100 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeFolderName(long).length).toBe(100);
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeFolderName("   ")).toBe("");
  });

  it("returns empty string for control-character-only input", () => {
    expect(sanitizeFolderName("\u0000\u0001\u001F")).toBe("");
  });
});

// ─── sanitizeTagName ─────────────────────────────────────────────────────────

describe("sanitizeTagName", () => {
  it("returns a normal tag unchanged", () => {
    expect(sanitizeTagName("important")).toBe("important");
  });

  it("trims whitespace", () => {
    expect(sanitizeTagName("  tag  ")).toBe("tag");
  });

  it("strips null bytes", () => {
    expect(sanitizeTagName("ta\u0000g")).toBe("tag");
  });

  it("truncates to 50 characters", () => {
    const long = "t".repeat(100);
    expect(sanitizeTagName(long).length).toBe(50);
  });

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeTagName("   ")).toBe("");
  });
});

// ─── sanitizeInlineMarkdown ──────────────────────────────────────────────────

describe("sanitizeInlineMarkdown", () => {
  it("allows bold markup through", () => {
    expect(sanitizeInlineMarkdown("<strong>bold</strong>")).toContain("bold");
  });

  it("strips script tags", () => {
    const result = sanitizeInlineMarkdown("<script>alert(1)</script>text");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert(1)");
  });

  it("strips onerror attributes", () => {
    const result = sanitizeInlineMarkdown('<img src=x onerror="alert(1)">');
    expect(result).not.toContain("onerror");
  });

  it("strips javascript: href attributes", () => {
    const result = sanitizeInlineMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain("javascript:");
  });
});

// ─── sanitizeKaTeX ───────────────────────────────────────────────────────────

describe("sanitizeKaTeX", () => {
  it("preserves SVG elements from KaTeX output", () => {
    const katexHtml = '<span class="katex"><svg><path d="M0 0"/></svg></span>';
    const result = sanitizeKaTeX(katexHtml);
    expect(result).toContain("<svg>");
    expect(result).toContain("<path");
  });

  it("strips script tags inside KaTeX output", () => {
    const malicious = '<span class="katex"><script>alert(1)</script></span>';
    const result = sanitizeKaTeX(malicious);
    expect(result).not.toContain("<script>");
  });

  it("strips event handlers on any element", () => {
    const malicious = '<span class="katex" onmouseover="alert(1)">x</span>';
    const result = sanitizeKaTeX(malicious);
    expect(result).not.toContain("onmouseover");
  });
});
```

---

## Quick Smoke-Test Checklist

Use this before any production deploy to confirm Phase 1 changes have not regressed.

| # | Test | Pass / Fail |
|---|---|---|
| 1 | `npm run build` completes with no errors | |
| 2 | KaTeX formula renders in chat | |
| 3 | Inline bold/italic/code renders in workflow chat | |
| 4 | `javascript:` link in AI response is blocked | |
| 5 | Citation panel source links open correctly | |
| 6 | File attachment links open correctly | |
| 7 | Folder creation works with a normal name | |
| 8 | Empty folder name is rejected | |
| 9 | Tag creation works with a normal tag | |
| 10 | Workflow canvas nodes have UUID-format IDs after adding | |
| 11 | Workflow save + reload preserves all nodes and edges | |
| 12 | Chat send/receive cycle completes end-to-end | |
| 13 | Console is silent (no `[SSE]`, `[DEBUG]`, `[Stream]` logs) in production build | |
| 14 | No sensitive data visible in browser console during chat | |
| 15 | SSR pages return 200 without server-side errors | |
