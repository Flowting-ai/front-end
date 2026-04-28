# Phase 2 — Extract Shared Utilities: Testing Guide

This document covers how to verify every change implemented in Phase 2 — Extract Shared Utilities, confirm that no existing functionality is broken, and detect regressions. Tests are ordered by shared module and include both manual browser steps and automated unit-test stubs.

> **Scope of Phase 2:** Six new shared utility modules were created under `src/lib/`. All duplicate local implementations were removed from their original component and page files. No behaviour was changed — only location.

---

## Table of Contents

1. [format-utils — `maskEmail`, `normalizePct`, `formatDate`](#format-utils--maskemail-normalizepct-formatdate)
2. [tag-utils — `normalizeTagList`, `normalizeCommentStrings`](#tag-utils--normalizetaglist-normalizecommentstrings)
3. [avatar-utils — `getFullAvatarUrl`, `isUnoptimizedAvatarUrl`](#avatar-utils--getfullavatarurl-isunoptimizedavatarurl)
4. [normalize-utils — `isValidUUID`, `normalizeUuid`, `normalizeUrl`](#normalize-utils--isvaliduuid-normalizeuuid-normalizeurl)
5. [content-parser — `extractThinkingContent`, `extractSources`](#content-parser--extractthinkingcontent-extractsources)
6. [message-transformer — `extractMetadata`, `normalizeBackendMessage`](#message-transformer--extractmetadata-normalizebackendmessage)
7. [Cross-Cutting Regression Checks](#cross-cutting-regression-checks)
8. [Automated Test Stubs](#automated-test-stubs)
9. [Quick Smoke-Test Checklist](#quick-smoke-test-checklist)

---

## format-utils — `maskEmail`, `normalizePct`, `formatDate`

### What was changed

| File | Change |
|---|---|
| `src/lib/utils/format-utils.ts` | **Created** — canonical home for `maskEmail`, `normalizePct`, `formatDate` |
| `src/context/auth-context.tsx` | Removed local `normalizePct`; imports from `format-utils` |
| `src/app/workflows/admin/page.tsx` | Removed local `maskEmail`, `formatDate`; imports from `format-utils` |
| `src/app/personas/admin/page.tsx` | Removed local `maskEmail`, `formatDate`; imports from `format-utils` |
| `src/app/personas/new/configure/page.tsx` | Removed local `maskEmail`; imports from `format-utils` |
| `src/app/settings/usage-and-billing/page.tsx` | Removed local `formatDate`, `normalizePct`; imports from `format-utils`; 7 `formatDate` call sites updated with `{ fallback: "-", year: true }` |
| `src/components/workflows/SelectPinsDialog.tsx` | Removed local `formatDate`, `getOrdinalSuffix`; imports from `format-utils` with `{ ordinal: true }` |
| `src/components/workflows/SelectChatsDialog.tsx` | Removed local `formatDate`, `getOrdinalSuffix`; imports from `format-utils` with `{ ordinal: true }` |

### What could break

- **Email masking breaks on admin user lists** — if `maskEmail` trims too aggressively or the fallback changes.
- **Usage/billing percentages display 0% or NaN** — if `normalizePct` fraction/integer detection logic changed.
- **Dates show wrong format on usage-and-billing page** — the updated call sites now pass `{ fallback: "-", year: true }`, changing the display from a bare `""` to `"-"` and adding the year; this is an intentional improvement but must be verified.
- **Ordinal dates ("15th Jan") disappear from pin/chat selectors** — if `{ ordinal: true }` is not being passed through correctly.

### Manual tests

#### T-FMT-1: Email masking in admin user list

1. Log in as an admin and navigate to **Workflows → Admin** (or **Personas → Admin**).
2. Find a user with an email longer than 3 characters before the `@`, e.g. `john.doe@example.com`.
3. Confirm the displayed email is `joh*****@example.com` (first 3 chars, then `*` per remaining local-part character, then `@domain`).
4. Find a user with an email with 3 or fewer characters before `@`, e.g. `ab@example.com`.
5. Confirm it is displayed as-is: `ab@example.com`.
6. Confirm a null/missing email renders as `your@email.com`.

#### T-FMT-2: Usage percentage bars render correctly

1. Navigate to **Settings → Usage & Billing**.
2. Confirm percentage values (e.g. "75%", "100%", "0%") display correctly for all usage meters.
3. If the API returns a fractional value (e.g. `0.75`), confirm it displays as `75%`, not `0.75%`.
4. If the API returns a value over 100 (e.g. `120`), confirm it is clamped to `100%`.
5. Confirm `null` or `undefined` usage values render as `0%` (the fallback in this context) rather than `NaN%` or crashing.

#### T-FMT-3: Dates on usage-and-billing page include year

1. On the **Settings → Usage & Billing** page, locate any date displays (e.g. "Next billing date", "Member since", "Last active").
2. Confirm dates display with the year included, e.g. `Jan 15, 2025`.
3. Confirm missing/null dates display as `-` (not a blank space or `""`).

#### T-FMT-4: Ordinal dates in pin / chat selectors

1. Open the **Select Pins** dialog from a workflow (usually via "Add Pins" or similar).
2. Confirm pin creation dates display with ordinal suffixes: `15th Jan`, `1st Mar`, `22nd Apr`, `3rd Nov`.
3. Open the **Select Chats** dialog and confirm chat dates use the same ordinal format.

#### T-FMT-5: Regular (non-ordinal) dates in admin pages

1. On **Workflows → Admin** and **Personas → Admin**, locate date columns (e.g. "Created At", "Last Active").
2. Confirm dates display in the standard `Jan 15` format (month-short + day, no year unless specified).
3. Confirm null/missing dates display as `""` or the configured fallback, not as `Invalid Date`.

---

## tag-utils — `normalizeTagList`, `normalizeCommentStrings`

### What was changed

| File | Change |
|---|---|
| `src/lib/utils/tag-utils.ts` | **Created** — canonical home for `normalizeTagList`, `normalizeCommentStrings` |
| `src/components/pinboard/pin-item.tsx` | Removed local `normalizeTagList`; imports from `tag-utils` |
| `src/components/layout/right-sidebar.tsx` | Removed local `normalizeTagStrings`, `normalizeCommentStrings`; 4 call sites renamed to `normalizeTagList` |
| `src/components/layout/app-layout.tsx` | Removed inline `toTagStrings`, `toCommentStrings` lambdas from `backendPinToLegacy`; 4 call sites updated |

### What could break

- **Tags disappear on pin cards** — if the field priority order changed (`tag_name` → `name` → `label` → `text`).
- **Tags disappear in the right sidebar** — the rename from `normalizeTagStrings` → `normalizeTagList` must be in sync at all 4 call sites.
- **Comments disappear in the right sidebar** — if the `comment_text` → `text` → `content` priority changed.
- **Pin data fails to load in app-layout** — if the `backendPinToLegacy` transformation broke due to the lambda replacement.

### Manual tests

#### T-TAG-1: Tags display correctly on pin cards

1. Navigate to the **Pinboard**.
2. Open a pin that has tags assigned to it.
3. Confirm all tags display as chip/badge labels on the pin card.
4. Confirm tags with surrounding whitespace appear trimmed.

#### T-TAG-2: Tags display in the right sidebar

1. Click on a pin in the pinboard to open it in the right sidebar.
2. Confirm the **Tags** section lists all tags that were assigned to this pin.
3. Add a new tag and confirm it appears immediately in the list.
4. Remove a tag and confirm it disappears.

#### T-TAG-3: Comments display in the right sidebar

1. Open a pin in the right sidebar that has user comments.
2. Confirm all comments are displayed in the **Comments** section.
3. Confirm comment text is not blank even when the backend sends objects with a `content` key (not `text`).

#### T-TAG-4: Pin data integrity after app-layout transformation

1. Log in and navigate to the **Pinboard** — pins should load without errors.
2. Open the right sidebar for a pin that has both tags and comments.
3. Confirm both appear correctly.
4. Reload the page — confirm data persists and reloads without issue.
5. Search or filter by a tag — confirm the tag filter still works.

#### T-TAG-5: Pins with no tags or comments don't crash

1. Find (or create) a pin with zero tags and zero comments.
2. Open it in the right sidebar.
3. Confirm the Tags and Comments sections render as empty (not crashing with `undefined is not iterable` or similar).

---

## avatar-utils — `getFullAvatarUrl`, `isUnoptimizedAvatarUrl`

### What was changed

| File | Change |
|---|---|
| `src/lib/utils/avatar-utils.ts` | **Created** — canonical home for `getFullAvatarUrl`, `isUnoptimizedAvatarUrl` |
| `src/app/personas/admin/page.tsx` | Removed local `getFullAvatarUrl`; removed `API_BASE_URL` import; imports from `avatar-utils` |
| `src/app/personas/page.tsx` | Removed local `getFullAvatarUrl`; removed `API_BASE_URL` import; imports from `avatar-utils` |
| `src/app/personas/new/configure/page.tsx` | Removed local `getFullAvatarUrl`; removed dead `shouldUseUnoptimized`; imports from `avatar-utils` |
| `src/components/personas/PersonaChatFullPage.tsx` | Replaced 6-line inline resolution with `getFullAvatarUrl()`; kept `API_BASE_URL` (used elsewhere) |

### What could break

- **Persona avatars go blank on the admin list** — if `getFullAvatarUrl` resolves relative paths differently.
- **Persona avatars go blank on the personas directory page** — same concern.
- **Avatar in configure page is broken** — if the old `shouldUseUnoptimized` removal affected the `<Image>` `unoptimized` prop.
- **Persona chat avatar is wrong** — the 6-line inline resolution in `PersonaChatFullPage.tsx` was replaced; if the new function misses an edge case that the inline code handled.
- **Next.js `<Image>` throws an error** — if an external URL is passed without `unoptimized={true}`, Next.js may error when the domain is not in `remotePatterns`.

### Manual tests

#### T-AVT-1: Persona avatars load on the personas list page

1. Navigate to the **Personas** directory page (e.g. `/personas`).
2. Confirm every persona card shows its avatar image (not a broken image icon).
3. Confirm avatars for personas stored with relative paths (e.g. `/media/avatars/…`) resolve correctly to the full API base URL.

#### T-AVT-2: Persona avatars load on the admin page

1. Navigate to **Personas → Admin**.
2. Confirm all persona rows show their avatar thumbnails without errors.
3. Open the browser DevTools → Network tab and confirm avatar requests go to the correct URL (not a relative path).

#### T-AVT-3: Avatar on persona configure page

1. Navigate to **Personas → New → Configure** (or edit an existing persona).
2. Confirm the avatar preview shows the current image if one exists.
3. Upload a new avatar image.
4. Confirm the new avatar preview updates correctly.
5. Save the persona and navigate back — confirm the saved avatar is still shown.

#### T-AVT-4: Avatar in persona chat view

1. Open a conversation with a persona.
2. Confirm the persona's avatar appears in the chat header and/or beside AI messages.
3. For a persona with a relative-path avatar, confirm the image loads (not 404).
4. For a persona with a `data:` URI avatar, confirm it renders (no Next.js unoptimized error in console).

#### T-AVT-5: Null/missing avatar does not crash

1. If any persona has no avatar assigned, navigate to its card, admin row, and chat view.
2. Confirm the avatar placeholder (initials, default icon, or empty state) renders correctly.
3. Confirm no `Uncaught TypeError` in the console related to `getFullAvatarUrl(undefined)`.

---

## normalize-utils — `isValidUUID`, `normalizeUuid`, `normalizeUrl`

### What was changed

| File | Change |
|---|---|
| `src/lib/normalizers/normalize-utils.ts` | **Created** — canonical home for `isValidUUID`, `normalizeUuid`, `normalizeUrl` |
| `src/components/compare/compare-models.tsx` | Removed `UUID_REGEX`, `UUID_URN_PREFIX`, `normalizeIdCandidate`, local `normalizeUuid`; 2 `UUID_REGEX.test()` calls → `isValidUUID()`; imports from `normalize-utils` |
| `src/components/workflows/WorkflowChatFullPage.tsx` | Removed inline `isValidUUID` arrow function; imports from `normalize-utils` |
| `src/components/chat/chat-interface.tsx` | Removed `normalizeUrlForMatch`; 3 call sites → `normalizeUrl()`; imports from `normalize-utils` |
| `src/components/workflows/workflow-api.ts` | **Intentionally unchanged** — retains stricter RFC-4122 `UUID_REGEX` with version/variant-bit checking |
| `src/components/chat/chat-interface.tsx` | **Intentionally kept** — `normalizeUuidReference` (UI-local suffix-stripping logic not appropriate for a general utility) |

### What could break

- **Compare-models page fails to load / filter models** — if `isValidUUID` (loose) behaves differently from the old `UUID_REGEX.test()` (also loose) for the model IDs returned by the backend.
- **Workflow chat fails to match message IDs to sessions** — if `isValidUUID` rejects IDs that the old inline function accepted.
- **Chat active-link highlighting breaks** — `normalizeUrl` replaced `normalizeUrlForMatch`; if the old function had different stripping behaviour, the current-page link detection may fail.
- **Workflow API rejects message IDs** — the RFC-4122 strict validator in `workflow-api.ts` was intentionally left alone; confirm it is unaffected.

### Manual tests

#### T-NORM-1: Compare-models page loads and filters correctly

1. Navigate to the **Compare Models** page.
2. Confirm the model list loads and all models are displayed.
3. Select two models and confirm the comparison view renders responses for both.
4. Filter/search for a model by name — confirm filtering still works.

#### T-NORM-2: Compare-models page — model IDs with URN prefix

1. If the backend sends model IDs in `urn:uuid:` format (can be verified in Network tab), confirm these are resolved correctly and models still appear in the selector.
2. Confirm no "invalid UUID" errors appear in the console.

#### T-NORM-3: Workflow chat — message session matching

1. Open an existing workflow.
2. Send a message in workflow chat.
3. Confirm the streaming response is attributed to the correct session.
4. Confirm no "session not found" or ID mismatch errors appear in the console.

#### T-NORM-4: Chat active link highlighting in the sidebar

1. Open the app and navigate between different chats using the left sidebar.
2. Confirm the currently active chat is highlighted correctly in the sidebar.
3. Confirm switching between chats updates the active highlight immediately.
4. Confirm the highlight works even when chat URLs contain query parameters or hash fragments.

#### T-NORM-5: `normalizeUrl` strips query and hash for comparison

> This is a pure function test — verifiable in the browser console.

1. Open any page and run in the browser console:
   ```js
   // If the function were exposed — instead, verify via sidebar behaviour:
   // Navigate to /chat/some-id?ref=sidebar#section
   // Confirm the sidebar still highlights the correct chat item.
   ```
2. Navigate to a chat with a URL containing `?` or `#` parameters.
3. Confirm the sidebar correctly identifies and highlights it as the active chat.

---

## content-parser — `extractThinkingContent`, `extractSources`

### What was changed

| File | Change |
|---|---|
| `src/lib/parsers/content-parser.ts` | **Created** — canonical home for `extractThinkingContent`, `extractSources`, `ThinkingParseResult`, `ContentSource` |
| `src/lib/thinking.ts` | Converted to a **backward-compatibility re-export shim** — `export { extractThinkingContent }` and `export type { ThinkingParseResult }` from `content-parser` |
| `src/components/chat/chat-interface.tsx` | Removed 27-line local `extractSourcesFromContent`; 4 call sites → `extractSources()`; import updated to `content-parser` |
| `src/components/layout/app-layout.tsx` | Import updated from `thinking.ts` → `content-parser` |
| `src/components/workflows/WorkflowChatInterface.tsx` | Import updated from `thinking.ts` → `content-parser` |
| `src/components/workflows/WorkflowChatFullPage.tsx` | Import updated from `thinking.ts` → `content-parser` |
| `src/components/personas/PersonaChatFullPage.tsx` | Import updated from `thinking.ts` → `content-parser` |

### What could break

- **`<think>` blocks appear as raw text in AI responses** — if `extractThinkingContent` is no longer called, or the import resolution broke.
- **Reasoning/thinking panel is empty** — if `thinkingText` is not being returned correctly.
- **Sources / citations panel shows no sources** — if `extractSources` produces a different result than the old `extractSourcesFromContent`.
- **Multiple `<think>` blocks only show the first one** — the new implementation joins multiple blocks with `\n\n`; verify this is correct.
- **Imports from `src/lib/thinking.ts` break** — the shim must re-export correctly so any indirect consumer still works.

### Manual tests

#### T-CP-1: Thinking blocks are stripped from visible chat response

1. Send a message to a model that supports thinking/reasoning (e.g. DeepSeek-R1, Claude with extended thinking).
2. Confirm the visible message content does **not** contain any `<think>` or `</think>` tags.
3. Confirm the visible message is a clean, readable response.

#### T-CP-2: Reasoning panel receives the thinking content

1. After a response that includes thinking (see T-CP-1), click "Show reasoning" or expand the thinking block in the chat message.
2. Confirm the reasoning panel shows the content that was inside the `<think>` tags.
3. Confirm it is readable and correctly formatted.

#### T-CP-3: Multiple `<think>` blocks are all captured

1. If a model emits two separate `<think>` blocks in one response, confirm both are visible in the reasoning panel (joined by a blank line).
2. Confirm neither block bleeds into the visible response text.

#### T-CP-4: Thinking works across all chat contexts

1. Test thinking extraction in:
   - **Regular chat** (`chat-interface.tsx`)
   - **Workflow chat** (`WorkflowChatInterface.tsx` / `WorkflowChatFullPage.tsx`)
   - **Persona chat** (`PersonaChatFullPage.tsx`)
2. In all three contexts, confirm thinking blocks are stripped from the visible message and the reasoning panel shows the content.

#### T-CP-5: Sources / citations panel populates correctly

1. Ask a question that produces an AI response with embedded links (e.g. `List 3 sources about climate change with links`).
2. Open the **Citations** or **Sources** panel.
3. Confirm source URLs are extracted correctly from:
   - Markdown links: `[Title](https://example.com)` — should show title + URL.
   - Bare URLs: `https://example.com` — should show URL only.
4. Confirm duplicate URLs appear only once.

#### T-CP-6: `src/lib/thinking.ts` shim still resolves

1. Confirm the build succeeds (`npm run build` — no module-not-found errors).
2. In any environment that might transitively import from `src/lib/thinking`, confirm it still resolves without error.

---

## message-transformer — `extractMetadata`, `normalizeBackendMessage`

### What was changed

| File | Change |
|---|---|
| `src/lib/normalizers/message-transformer.ts` | **Created** — canonical home for `extractMetadata`, `normalizeBackendMessage` |
| `src/components/layout/app-layout.tsx` | Removed ~200-line local `extractMetadata` and `normalizeBackendMessage`; imports from `message-transformer`; 3 `extractMetadata` call sites + 1 `normalizeBackendMessage` call site unchanged |

### What could break

- **Chat history fails to load** — `normalizeBackendMessage` transforms every message from the API; any regression breaks history display.
- **Model name / provider name missing from message metadata** — `extractMetadata` resolves 6+ field-name variants; if any lookup path changed, metadata badges disappear.
- **Token counts / cost missing from message info** — same concern for `inputTokens`, `outputTokens`, `cost`, `latencyMs`.
- **Web search results don't appear in chat** — `webSearch` payload extraction is complex (multiple field-name variants, single vs array); regression here hides search results.
- **Pin references disappear from loaded chat history** — `pinIds` and `mentionedPins` are extracted in `extractMetadata`; if broken, pin-attachment cards won't re-render.
- **Attachment cards disappear from loaded history** — `normalizeBackendMessage` parses `attachments` array; if broken, uploaded file cards won't show.
- **Sender / role is wrong** — a user message displayed as AI or vice versa.
- **Message IDs are not stable** — if `crypto.randomUUID()` is called too eagerly, IDs change on re-render, causing React key instability.

### Manual tests

#### T-MT-1: Chat history loads with correct sender attribution

1. Open an existing chat that has several messages (both user and AI).
2. Confirm user messages appear on the right (or with user styling) and AI messages on the left (or with AI styling).
3. Confirm no message appears with the wrong sender.

#### T-MT-2: Model name and provider display on AI messages

1. In a chat, confirm each AI message shows a "Model info" indicator (e.g. "GPT-4o via OpenAI" or similar metadata badge).
2. The model name should match what was selected when the message was sent.
3. Reload the chat — confirm the model name persists from the stored history (not re-fetched live).

#### T-MT-3: Token count and cost appear correctly

1. In a chat with a model that returns token usage, expand the message info panel.
2. Confirm `Input tokens`, `Output tokens`, and `Cost` (if applicable) are displayed correctly.
3. Confirm `null` or missing values do not show `NaN` or `undefined`.

#### T-MT-4: Web search results appear in loaded history

1. If web search is enabled, send a message that triggers a web search.
2. After the response, confirm the web search result links appear below the response.
3. Navigate away and return to the chat.
4. Confirm the web search results are still visible in the loaded history (not lost on reload).

#### T-MT-5: Pin references appear in loaded history

1. Send a message that references a pin (using `@pin` mention or similar).
2. Confirm the pin card appears embedded in the message.
3. Reload the chat.
4. Confirm the pin card is still present in the loaded history.

#### T-MT-6: File attachments appear in loaded history

1. Upload a file in a chat message.
2. Confirm the file attachment card appears in the message.
3. Reload the chat.
4. Confirm the attachment card is still present in the loaded history.

#### T-MT-7: Reactions / user reaction field is preserved

1. If the app supports message reactions, react to an AI message.
2. Reload the chat.
3. Confirm the reaction is still displayed on the correct message.

#### T-MT-8: Referenced messages resolve correctly

1. If a message has a `referencedMessageId` (e.g. a reply), confirm the referenced message is shown correctly in context.
2. Confirm no `null` or `undefined` reference ID causes a crash.

---

## Cross-Cutting Regression Checks

These checks must pass regardless of which module you are testing. They verify that the refactoring did not introduce any runtime errors, import failures, or behavioural regressions.

### T-REG-1: TypeScript build passes with zero errors

```bash
npm run build
```
Expected: exit code 0. No `Type error`, `Module not found`, or `Cannot find module` lines.

### T-REG-2: No runtime errors on initial load

1. Open the app in a fresh incognito window.
2. Log in.
3. Observe the DevTools Console for 60 seconds while navigating: Chat → Workflows → Personas → Pinboard → Settings.
4. Expected: no `Uncaught TypeError`, `Uncaught ReferenceError`, or `Failed to fetch` errors.

### T-REG-3: Full chat send/receive cycle

1. Open a new chat.
2. Select any model.
3. Send a message.
4. Confirm the response streams in and completes.
5. Confirm the message persists on page reload.

### T-REG-4: Full workflow send/receive cycle

1. Open an existing workflow or create a new one with at least one chat node.
2. Send a message in workflow chat.
3. Confirm the response streams correctly.
4. Confirm node output panels update as expected.

### T-REG-5: Persona chat send/receive cycle

1. Select a persona and open a chat.
2. Send a message.
3. Confirm the response streams and the persona avatar appears correctly.

### T-REG-6: Pinboard operations work end-to-end

1. Navigate to the Pinboard.
2. Confirm pins load with tags and comments visible.
3. Create a new pin, add a tag, add a comment.
4. Confirm all three operations succeed and reflect in the UI.

### T-REG-7: SSR pages return 200

1. Run `npm run build && npm start`.
2. Using `curl` or browser network tab, confirm the following routes return HTTP 200:
   - `/chat`
   - `/workflows`
   - `/personas`
   - `/pinboard`
   - `/settings/usage-and-billing`
3. Confirm no server-side `ReferenceError: window is not defined` or similar SSR crash.

### T-REG-8: No orphaned imports or missing modules

1. Run `npm run build` and scan the output for any `Module not found` errors.
2. In particular, check that no file still tries to import a function that was removed (e.g. a deleted local function that was exported before the refactor).

---

## Automated Test Stubs

The following unit-test stubs can be added to your test suite (Jest / Vitest). They cover all pure functions in the six shared utility modules. All tested functions have **zero side effects** and are easy to unit-test in isolation.

```typescript
// src/lib/__tests__/phase2-utilities.test.ts

import { maskEmail, normalizePct, formatDate } from "../utils/format-utils";
import { normalizeTagList, normalizeCommentStrings } from "../utils/tag-utils";
import { getFullAvatarUrl, isUnoptimizedAvatarUrl } from "../utils/avatar-utils";
import { isValidUUID, normalizeUuid, normalizeUrl } from "../normalizers/normalize-utils";
import { extractThinkingContent, extractSources } from "../parsers/content-parser";

// ─── maskEmail ───────────────────────────────────────────────────────────────

describe("maskEmail", () => {
  it("masks the local part beyond 3 characters", () => {
    expect(maskEmail("john.doe@example.com")).toBe("joh*****@example.com");
  });

  it("returns the email as-is when local part is 3 characters or fewer", () => {
    expect(maskEmail("ab@example.com")).toBe("ab@example.com");
    expect(maskEmail("abc@x.com")).toBe("abc@x.com");
  });

  it("returns the fallback for null input", () => {
    expect(maskEmail(null)).toBe("your@email.com");
  });

  it("returns the fallback for undefined input", () => {
    expect(maskEmail(undefined)).toBe("your@email.com");
  });

  it("returns the fallback for an empty string", () => {
    expect(maskEmail("")).toBe("your@email.com");
  });
});

// ─── normalizePct ─────────────────────────────────────────────────────────────

describe("normalizePct", () => {
  it("converts a 0-1 fraction to a percentage", () => {
    expect(normalizePct(0.75)).toBe(75);
    expect(normalizePct(0)).toBe(0);
    expect(normalizePct(1)).toBe(100);
  });

  it("passes through a value already in 0-100 range", () => {
    expect(normalizePct(85)).toBe(85);
    expect(normalizePct(50)).toBe(50);
  });

  it("clamps values above 100 to 100", () => {
    expect(normalizePct(120)).toBe(100);
    expect(normalizePct(1.5)).toBe(100);
  });

  it("clamps values below 0 to 0", () => {
    expect(normalizePct(-10)).toBe(0);
  });

  it("returns null for null with no fallback", () => {
    expect(normalizePct(null)).toBeNull();
    expect(normalizePct(undefined)).toBeNull();
  });

  it("returns the numeric fallback when provided", () => {
    expect(normalizePct(null, 0)).toBe(0);
    expect(normalizePct(undefined, 50)).toBe(50);
  });

  it("returns null for NaN", () => {
    expect(normalizePct(NaN)).toBeNull();
  });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns a locale date string for a valid ISO date", () => {
    const result = formatDate("2025-01-15");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("includes the year when { year: true }", () => {
    const result = formatDate("2025-01-15", { year: true });
    expect(result).toContain("2025");
  });

  it("returns an ordinal date when { ordinal: true }", () => {
    expect(formatDate("2025-01-15", { ordinal: true })).toMatch(/15th Jan/);
    expect(formatDate("2025-01-01", { ordinal: true })).toMatch(/1st Jan/);
    expect(formatDate("2025-01-02", { ordinal: true })).toMatch(/2nd Jan/);
    expect(formatDate("2025-01-03", { ordinal: true })).toMatch(/3rd Jan/);
    expect(formatDate("2025-01-11", { ordinal: true })).toMatch(/11th Jan/);
    expect(formatDate("2025-01-12", { ordinal: true })).toMatch(/12th Jan/);
    expect(formatDate("2025-01-13", { ordinal: true })).toMatch(/13th Jan/);
  });

  it("returns the fallback for null", () => {
    expect(formatDate(null, { fallback: "-" })).toBe("-");
  });

  it("returns the fallback for undefined", () => {
    expect(formatDate(undefined, { fallback: "-" })).toBe("-");
  });

  it("returns empty string by default for invalid input", () => {
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate(null)).toBe("");
  });

  it("accepts epoch timestamps", () => {
    const result = formatDate(1705276800000); // 2024-01-15 UTC
    expect(result).toMatch(/Jan/);
  });
});

// ─── normalizeTagList ─────────────────────────────────────────────────────────

describe("normalizeTagList", () => {
  it("passes through plain string arrays and trims whitespace", () => {
    expect(normalizeTagList(["AI", "  react "])).toEqual(["AI", "react"]);
  });

  it("extracts tag_name from object tags", () => {
    expect(normalizeTagList([{ tag_name: "design" }])).toEqual(["design"]);
  });

  it("falls back to name, label, text in priority order", () => {
    expect(normalizeTagList([{ name: "ux" }])).toEqual(["ux"]);
    expect(normalizeTagList([{ label: "concept" }])).toEqual(["concept"]);
    expect(normalizeTagList([{ text: "draft" }])).toEqual(["draft"]);
  });

  it("drops empty strings and unresolvable objects", () => {
    expect(normalizeTagList([{ foo: "bar" }, "", "  "])).toEqual([]);
  });

  it("returns [] for null", () => {
    expect(normalizeTagList(null)).toEqual([]);
  });

  it("returns [] for non-array input", () => {
    expect(normalizeTagList("tag")).toEqual([]);
    expect(normalizeTagList(undefined)).toEqual([]);
  });
});

// ─── normalizeCommentStrings ──────────────────────────────────────────────────

describe("normalizeCommentStrings", () => {
  it("passes through plain strings and trims whitespace", () => {
    expect(normalizeCommentStrings(["Great find!", "  Note  "])).toEqual(["Great find!", "Note"]);
  });

  it("extracts comment_text from comment objects", () => {
    expect(normalizeCommentStrings([{ comment_text: "Useful" }])).toEqual(["Useful"]);
  });

  it("falls back to text, then content", () => {
    expect(normalizeCommentStrings([{ text: "Follow up" }])).toEqual(["Follow up"]);
    expect(normalizeCommentStrings([{ content: "See also" }])).toEqual(["See also"]);
  });

  it("drops empty strings and unresolvable objects", () => {
    expect(normalizeCommentStrings([{ foo: "bar" }, ""])).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(normalizeCommentStrings(undefined)).toEqual([]);
  });
});

// ─── getFullAvatarUrl ─────────────────────────────────────────────────────────

describe("getFullAvatarUrl", () => {
  it("returns absolute https URLs unchanged", () => {
    expect(getFullAvatarUrl("https://cdn.example.com/avatar.png"))
      .toBe("https://cdn.example.com/avatar.png");
  });

  it("returns http URLs unchanged", () => {
    expect(getFullAvatarUrl("http://cdn.example.com/avatar.png"))
      .toBe("http://cdn.example.com/avatar.png");
  });

  it("returns data URIs unchanged", () => {
    const data = "data:image/png;base64,abc123";
    expect(getFullAvatarUrl(data)).toBe(data);
  });

  it("returns blob URLs unchanged", () => {
    const blob = "blob:https://example.com/some-blob";
    expect(getFullAvatarUrl(blob)).toBe(blob);
  });

  it("prepends API_BASE_URL to relative paths without leading slash", () => {
    const result = getFullAvatarUrl("media/avatars/123.png");
    expect(result).toMatch(/\/media\/avatars\/123\.png$/);
  });

  it("prepends API_BASE_URL to relative paths with leading slash", () => {
    const result = getFullAvatarUrl("/media/avatars/123.png");
    expect(result).toMatch(/\/media\/avatars\/123\.png$/);
    // Must not double the slash
    expect(result).not.toMatch(/\/\//);
  });

  it("returns null for null input", () => {
    expect(getFullAvatarUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getFullAvatarUrl(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(getFullAvatarUrl("")).toBeNull();
    expect(getFullAvatarUrl("   ")).toBeNull();
  });
});

// ─── isUnoptimizedAvatarUrl ───────────────────────────────────────────────────

describe("isUnoptimizedAvatarUrl", () => {
  it("returns true for data URI inputs", () => {
    expect(isUnoptimizedAvatarUrl("data:image/png;base64,abc")).toBe(true);
  });

  it("returns true for blob URL inputs", () => {
    expect(isUnoptimizedAvatarUrl("blob:https://example.com/id")).toBe(true);
  });

  it("returns true for external https URLs (not in remotePatterns)", () => {
    expect(isUnoptimizedAvatarUrl("https://cdn.example.com/avatar.png")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isUnoptimizedAvatarUrl(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isUnoptimizedAvatarUrl("")).toBe(false);
  });
});

// ─── isValidUUID ─────────────────────────────────────────────────────────────

describe("isValidUUID", () => {
  it("accepts a valid v4 UUID", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a UUID with uppercase hex", () => {
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidUUID("")).toBe(false);
  });

  it("rejects a UUID with a urn:uuid: prefix", () => {
    // The loose validator does not strip prefixes — use normalizeUuid for that
    expect(isValidUUID("urn:uuid:550e8400-e29b-41d4-a716-446655440000")).toBe(false);
  });
});

// ─── normalizeUuid ────────────────────────────────────────────────────────────

describe("normalizeUuid", () => {
  it("strips the urn:uuid: prefix and returns lowercased UUID", () => {
    expect(normalizeUuid("urn:uuid:550e8400-e29b-41d4-a716-446655440000"))
      .toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("lowercases an uppercase UUID", () => {
    expect(normalizeUuid("550E8400-E29B-41D4-A716-446655440000"))
      .toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns null for null", () => {
    expect(normalizeUuid(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalizeUuid(undefined)).toBeNull();
  });

  it("returns null for an invalid string", () => {
    expect(normalizeUuid("not-a-uuid")).toBeNull();
    expect(normalizeUuid("bad")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeUuid("")).toBeNull();
  });

  it("accepts numeric input (coerced to string)", () => {
    // A numeric value that happens to be a UUID-formatted string won't match;
    // a non-UUID number returns null.
    expect(normalizeUuid(12345)).toBeNull();
  });
});

// ─── normalizeUrl ─────────────────────────────────────────────────────────────

describe("normalizeUrl", () => {
  it("strips fragment and query string", () => {
    expect(normalizeUrl("https://example.com/page/?ref=abc#section"))
      .toBe("https://example.com/page");
  });

  it("preserves the root path", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("strips trailing slash from non-root paths", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
  });

  it("falls back to trimmed input for non-URL strings", () => {
    expect(normalizeUrl("  not a url  ")).toBe("not a url");
  });

  it("handles URLs without path", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
  });
});

// ─── extractThinkingContent ───────────────────────────────────────────────────

describe("extractThinkingContent", () => {
  it("strips a single <think> block and captures reasoning", () => {
    const result = extractThinkingContent("<think>Let me reason…</think>The answer is 42.");
    expect(result.visibleText).toBe("The answer is 42.");
    expect(result.thinkingText).toBe("Let me reason…");
  });

  it("strips multiple <think> blocks and joins reasoning", () => {
    const result = extractThinkingContent(
      "<think>Step 1</think>Middle text<think>Step 2</think>Final."
    );
    expect(result.visibleText).toContain("Middle text");
    expect(result.visibleText).toContain("Final.");
    expect(result.thinkingText).toContain("Step 1");
    expect(result.thinkingText).toContain("Step 2");
  });

  it("returns the full text as visibleText when no <think> blocks exist", () => {
    const result = extractThinkingContent("No reasoning here.");
    expect(result.visibleText).toBe("No reasoning here.");
    expect(result.thinkingText).toBeNull();
  });

  it("returns empty visibleText and null thinkingText for null", () => {
    const result = extractThinkingContent(null);
    expect(result.visibleText).toBe("");
    expect(result.thinkingText).toBeNull();
  });

  it("returns empty visibleText and null thinkingText for undefined", () => {
    const result = extractThinkingContent(undefined);
    expect(result.visibleText).toBe("");
    expect(result.thinkingText).toBeNull();
  });

  it("removes a leading dash separator after the think block", () => {
    const result = extractThinkingContent("<think>Reasoning</think>— The answer is yes.");
    expect(result.visibleText).toBe("The answer is yes.");
  });

  it("handles multiline reasoning blocks", () => {
    const input = "<think>\nLine 1\nLine 2\n</think>Response.";
    const result = extractThinkingContent(input);
    expect(result.thinkingText).toContain("Line 1");
    expect(result.thinkingText).toContain("Line 2");
    expect(result.visibleText).toBe("Response.");
  });

  it("is case-insensitive for <THINK> tags", () => {
    const result = extractThinkingContent("<THINK>Reasoning</THINK>Answer.");
    expect(result.visibleText).toBe("Answer.");
    expect(result.thinkingText).toBe("Reasoning");
  });
});

// ─── extractSources ───────────────────────────────────────────────────────────

describe("extractSources", () => {
  it("extracts a Markdown link with title and URL", () => {
    const result = extractSources("See [OpenAI](https://openai.com) for more.");
    expect(result).toEqual([{ url: "https://openai.com", title: "OpenAI" }]);
  });

  it("extracts a bare URL without title", () => {
    const result = extractSources("Visit https://anthropic.com for details.");
    expect(result).toEqual([{ url: "https://anthropic.com" }]);
  });

  it("extracts both Markdown links and bare URLs, deduplicating", () => {
    const result = extractSources(
      "See [OpenAI](https://openai.com) and https://anthropic.com."
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ url: "https://openai.com", title: "OpenAI" });
    expect(result[1]).toEqual({ url: "https://anthropic.com" });
  });

  it("deduplicates URLs that appear in both Markdown and bare form", () => {
    const result = extractSources("[Example](https://example.com) — https://example.com");
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com");
  });

  it("trims trailing punctuation from bare URLs", () => {
    const result = extractSources("See https://example.com.");
    expect(result[0].url).toBe("https://example.com");
  });

  it("returns [] for content with no URLs", () => {
    expect(extractSources("No links here.")).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(extractSources("")).toEqual([]);
  });

  it("does not extract non-http links", () => {
    const result = extractSources("Email mailto:user@example.com or ftp://old.example.com");
    expect(result).toEqual([]);
  });
});
```

---

## Quick Smoke-Test Checklist

Use this before any production deploy to confirm Phase 2 changes have not regressed.

| # | Area | Test | Pass / Fail |
|---|---|---|---|
| 1 | Build | `npm run build` completes with zero errors | |
| 2 | format-utils | Admin user list shows masked emails correctly | |
| 3 | format-utils | Usage & Billing percentage bars render (no NaN or crash) | |
| 4 | format-utils | Usage & Billing dates show year, fallback "-" for missing | |
| 5 | format-utils | Select Pins / Select Chats dialogs show ordinal dates ("15th Jan") | |
| 6 | tag-utils | Pin cards show tags in the Pinboard | |
| 7 | tag-utils | Right sidebar shows tags and comments for a selected pin | |
| 8 | tag-utils | Pin with no tags/comments renders without crash | |
| 9 | avatar-utils | Persona list page loads avatars (no broken images) | |
| 10 | avatar-utils | Persona configure page shows avatar preview | |
| 11 | avatar-utils | Persona chat shows avatar in header | |
| 12 | avatar-utils | Persona with no avatar shows placeholder (no crash) | |
| 13 | normalize-utils | Compare models page loads and both columns return responses | |
| 14 | normalize-utils | Sidebar highlights the correct active chat | |
| 15 | normalize-utils | Workflow chat attributes responses to correct session | |
| 16 | content-parser | AI response with `<think>` blocks — reasoning panel opens | |
| 17 | content-parser | Visible chat response contains no raw `<think>` tags | |
| 18 | content-parser | Citations panel populates from a response with embedded links | |
| 19 | content-parser | Thinking works in workflow chat and persona chat (not just regular chat) | |
| 20 | message-transformer | Chat history loads with correct user / AI sender attribution | |
| 21 | message-transformer | Model name metadata displays on AI messages | |
| 22 | message-transformer | Attachments in loaded chat history still render | |
| 23 | message-transformer | Pin references in loaded chat history still render | |
| 24 | Regression | Full send/receive cycle in regular chat | |
| 25 | Regression | Full send/receive cycle in workflow chat | |
| 26 | Regression | Full send/receive cycle in persona chat | |
| 27 | Regression | Pinboard CRUD — create pin, add tag, add comment | |
| 28 | Regression | No `Uncaught TypeError` or `ReferenceError` in console during full navigation | |
| 29 | Regression | SSR pages return HTTP 200 without server-side errors | |
