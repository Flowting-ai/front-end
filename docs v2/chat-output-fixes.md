# Chat output fixes: what was done and what is pending

Follow-up to [chat-output-bugs-scan.md](chat-output-bugs-scan.md). Date: 2026-10-04. Front-end only (no `souvenir-server` changes). Everything is **uncommitted** in the working tree, for review.

## TL;DR

- **Fixed:** all question-card issues (Q1–Q6), all reasoning/streaming issues (R1–R10, T1–T5), all formatting issues (F1–F13), data/logic (D1–D4, D1 with one exception) and L2–L5.
- **Not done (out of scope for this pass):** L1 mobile layout, E1–E3 prompt enhancement, all backend changes.
- **Not done (needs a live repro):** T6 "Generation interrupted", T7 dev "1 Issue" badge.
- **New finding, not fixed:** the web search toggle, style picker and connector selection reach the backend nowhere — the chat endpoint doesn't accept them.
- **Checks:** 957 tests pass (2 skipped), `tsc` clean, ESLint shows no new errors, `next build` succeeds. Not yet checked in a real browser.

Status: **Fixed**, **Partly fixed**, **Not done**.

## Decisions made with the product owner

| Topic | Decision |
|---|---|
| Skipped optional question | Sent to the model as `null` |
| Dismiss (X) on a question card | Unanswered questions are sent as `"(dismissed by the user — not answered)"`; answered ones keep their answers |
| Dismiss (X) on an approval card | Sends `"reject"` (every backend caller treats anything but `approve` as no) |
| Dismiss (X) on confirm-style prompts (browser takeover, connected-code consent) | Hidden: any reply there means "done", so there is no safe "no" |
| Multi-choice + typed text | Both sent: `[...ticked, "typed text"]`. Single choice: typed text replaces the option |
| Card focus | Focus moves to a new card only when nothing else has focus |
| Thinking panel while streaming | Never opens on its own; one live status line ("Thinking · …") |
| Thinking panel when done | "Thought for 12s" ("Thought" when duration is unknown, e.g. after reload) |
| Single reasoning step | Expanded by default |
| Question asked mid-reply | Marker row in the Thinking timeline |
| Scroll while streaming | Follow to bottom until the user scrolls up |
| Text reveal | Adaptive: ≤ ~1s behind the stream, finishes ≤300ms after it ends; Copy/Regenerate/Sources wait for it |
| Stream error after some text | Keep the text, add an inline error banner with Retry |
| Widgets while generating | Skeleton shaped like the widget (table rows, chart bars…), then fade in when complete |
| Unclosed widget after the stream ends | Mid-sentence mention → literal text; on its own line → "Couldn't display this … — the response ended early" + raw XML collapsed; text after it still renders |
| Single newlines | Line breaks everywhere (adds `remark-breaks`) |
| Citations | Parse the model's own "Sources:" block into chips, hide the raw block, show one source list |
| h4–h6 | Same style as h3 |
| Leading `<think>` never closed | Show it as reasoning and mark the answer incomplete |
| Regenerate | Replace the turn, using the current composer settings; turns with uploaded files keep appending |
| Sidebar hydration | Store collapsed state in a cookie read on the server |
| Composer while streaming | Stays focused and editable; Enter is blocked until the reply finishes |
| Contrast | Chat widgets only; no shared token changes |
| Meta pixel | Removed until there is a consent banner |
| Edit button / shortcut hints | Reveal on row hover and keyboard focus; ⌘ on Mac, Ctrl elsewhere |
| Hardcoded JWT | Env-driven script, delete scratch files, no history rewrite |
| Scope | Front-end only; skip L1, E1–E3 and backend work for now |

## 1. Question cards

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| Q1 | H | **Fixed** | Skip, X and Next are wired up. A control with no handler is hidden (Skip, X) or disabled (arrows), so nothing on the card is dead | `QuestionCard/index.tsx`, `ClarificationCard.tsx`, `ChatPromptCard.tsx` |
| Q2 | H | **Fixed** | Skip shows only for `ask_user` questions with `required: false`. Every other prompt kind always needs an answer | `lib/chat-prompt-answers.ts` |
| Q3 | M | **Fixed** | Next is enabled only for questions already reached; Back restores the saved answer (options and typed text). Changes made after going Back are kept | `ChatPromptCard.tsx` |
| Q4 | H | **Fixed** | Send is disabled on a required question until an option is selected or the custom box has non-blank text. Empty Send on an optional question counts as Skip | `QuestionCard` `requireAnswer` prop |
| Q5 | H | **Fixed** | One click sends one response. Typed text is held in a ref and only one submit runs; a second click is blocked while the first is in flight | `ChatPromptCard.tsx` |
| Q6 | M | **Fixed** | Options are a labelled `radiogroup`/`group` with `radio`/`checkbox` rows and `aria-checked`; single choice uses one tab stop. "Something else" is a real button. Enter sends from the custom box (Shift+Enter = newline, IME-safe); Escape returns focus to the trigger. Questions are announced via `aria-live`. Focus moves to the card only when focus is idle, without scrolling | `QuestionCard/index.tsx` |

The agent editor's `QuestionStep` and the configure page's help card share `QuestionCard`; both keep working (they pass every handler, and the new behaviour is opt-in through props).

Tests: `lib/chat-prompt-answers.test.ts`, `components/chat/ChatPromptCard.test.tsx` (jsdom, 17 cases). Against the original code, 9 of them fail.

## 2. Reasoning & streaming

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| R1 | M | **Fixed** | The panel opens only on click. While live, the trigger shows one fixed-height line: "Thinking · <running tool / waiting for your answer / latest step>" | `ReasoningBlock.tsx` |
| R2 | L | **Fixed** | Step rows were keyed by their body text, so every delta remounted them and replayed the height animation. Keys are now stable (`index-heading`) | `ReasoningBlock.tsx` |
| R3 | L | **Fixed** | Block code is rendered from the `pre > code` node; an empty fence no longer renders `undefined` | `markdown-utils.tsx`, `pin-markdown.tsx` |
| R4 | L | **Fixed** | Once highlight.js is loaded, code highlights on first render; it starts loading as soon as a fence appears. Lazy languages (sql, go, rust, cpp…) are now actually registered via `ensureLanguage` | `CodeBlock.tsx`, `highlight-loader.ts`, `highlight.ts` |
| R5 | L | **Fixed** | While streaming, a partial tag at the end (`<`, `<tabl`) is hidden; a complete tag name with no closing `>` yet shows the skeleton | `content-parser.ts` |
| R6 | M | **Fixed** | Follow logic rewritten. Follow turns off only when the view moves toward history (wheel, touch, keys, scrollbar, find-in-page, jumps to a message), never because content grew. It's driven by a ResizeObserver, so it covers the reveal tail, code highlighting and charts. Content growth only drives follow while a reply is streaming or revealing (plus a 1.5s grace), so expanding a panel when idle doesn't scroll away. The "jump to start of new reply" behaviour is removed; scroll anchoring is off; the streaming row is excluded from the virtualizer's resize compensation | `ChatInterface.tsx`, `lib/stick-to-bottom.ts`, `lib/chat-scroller.ts` |
| R7 | L | **Fixed** | Type-specific skeletons with heights close to the real widget; the widget fades in. The reveal shows a complete widget in one step instead of word by word. The cursor is out of normal flow, so completion doesn't shift the layout | `WidgetSkeleton.tsx`, `content-renderer.tsx`, `lib/reveal.ts` |
| R8 | L | **Fixed** | Adaptive reveal per animation frame (capped at ~30 updates/s): catches up when it falls behind and finishes ≤300ms after the stream ends. A hidden tab shows everything at once. Copy, Pin, Sources, `aria-busy`, Regenerate and the "response complete" announcement wait for the reveal. A row remounted mid-stream doesn't replay the reveal | `ChatMessage.tsx`, `lib/reveal.ts`, `ChatInterface.tsx` |
| R9 | M | **Fixed** | Every way a turn can end goes through one path. Streamed text is kept, and the error is shown as a banner with Retry; the full-error message is used only when nothing was shown. Reasoning is finalised and running tools are marked stopped. A 401 (session expired) no longer leaves the reply loading forever | `use-streaming-chat.ts`, `lib/turn-outcome.ts`, `ChatMessage.tsx` |
| R10 | M | **Fixed (front end)** | Tool rows are rebuilt from the backend's `tool_calls` on reload (the large `output` field is dropped). Limits: order relative to reasoning, error status and `ask_agent` rows aren't stored by the backend | `lib/api/chat.ts`, `normalizers/message-transformer.ts` |

## 3. Formatting / rendering

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| F1 | H | **Fixed** | One code-range scanner covers ``` and ~~~ fences (unclosed runs to the end; fences behind list or quote markers too) and inline code spans. Tags inside code are never widgets | `content-parser.ts` (`findCodeRanges`) |
| F2 | M | **Fixed** | `parseContentSegments(content, { streaming })`. When the stream is done, nothing stays "pending" and parsing never stops early (see the decision above). The `[Response interrupted: …]` marker is never swallowed, even inside an open code fence | `content-parser.ts`, `content-renderer.tsx`, `model-error.ts` |
| F3 | M | **Fixed** | `remark-breaks` added to chat Markdown and pins | `markdown-utils.tsx`, `pin-markdown.tsx`, `package.json` |
| F4 | L | **Fixed** | Only a `<think>` block at the very start counts as reasoning, live and on reload; tags elsewhere (incl. code) are left alone. If it never closes: shown as reasoning + "The response ended before the answer was written" | `parsers/content-parser.ts`, `lib/api/chat.ts` |
| F5 | M | **Fixed** | Map colours are read from the CSS tokens at runtime (hex fallbacks) and re-read when the theme changes; MapLibre never receives `var(…)`. Pins visible; ~30 console errors per map gone | `XmlMapCanvas.tsx`, `XmlMap.colors.ts` |
| F6 | L | **Fixed** | `\$` inside math becomes `\text{\textdollar}`; code (any fence, inline, indented) is untouched | `markdown-preprocess.ts` |
| F7 | L | **Fixed** | h4–h6 styled like h3, semantic tags kept. h1→h2 and h3 sizes unchanged (signed-off spec) | `markdown-utils.tsx` |
| F8 | L | **Fixed** | Tags at the start of a line match in any case (`<TABLE>`); mid-line only lowercase, so `<Table>` in prose stays text. Closing tags are found on the original string | `content-parser.ts` |
| F9 | L | **Fixed** | A one-line fenced block without a language renders as a code block with Copy | `markdown-utils.tsx` |
| F10 | L | **Fixed** | Language read verbatim (`c++`, `objective-c`); aliases added | `markdown-utils.tsx`, `highlight.ts` |
| F11 | L | **Fixed** | `node` is stripped from props before reaching the DOM | `markdown-utils.tsx`, `pin-markdown.tsx` |
| F12 | L | **Fixed** | In-page links (footnotes) open in the same tab with ids unique per message; the "Footnotes" label is visually hidden; task lists show a checkbox and no bullet | `markdown-utils.tsx` |
| F13 | L | **Fixed (front end)** | The model's trailing "Sources:" block becomes `[N]` chips and one source list with the real numbers. The block is only removed when it is last, outside code, and every line parses. Citations the backend sends itself still take priority. Reference-style links (`[text][1]`) are left alone | `lib/citations.ts`, `ChatMessage.tsx`, `CitationChip.tsx` |

## 4. Data and logic

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| D1 | H | **Partly fixed** | Regenerate sends `replaceMessageId` (no duplicate after reload) and one shared options builder is used by send, initial send, edit and regenerate, so they can't drift. It also no longer uses stale settings. **Exception:** turns with uploaded files still append (the backend soft-deletes a replaced turn's files) | `ChatInterface.tsx`, `lib/turn-options.ts`, `lib/replace-message-id.ts` |
| D2 | M | **Fixed** | `mergeStreamingText` is plain concatenation (backend sends deltas only — verified). Reasoning merges fixed too; same-titled sections no longer merge | `lib/streaming.ts`, `lib/reasoning.ts` |
| D3 | M | **Fixed** | Sidebar state lives in a `sidebar_collapsed` cookie read by the `(app)` layout; localStorage is still written. Remounts (e.g. back from Settings) use the latest toggle; existing users' localStorage value is copied into the cookie once | `(app)/layout.tsx`, `AppLayout.tsx`, `LeftSidebar.tsx`, `storage-keys.ts` |
| D4 | L | **Fixed** | `scripts/sse-probe.mjs` reads `SOUVENIR_JWT` and `BACKEND_URL` from env. `test-sse.mjs`, `tmp-next-dev*.log` and the `.vsix` are deleted (`git rm`, staged); `.gitignore` updated. The expired token remains in git history | `scripts/`, `.gitignore` |

## 5. Layout, accessibility, console

| # | Sev | Status | What changed |
|---|---|---|---|
| L1 | M | **Not done** | Out of scope for this pass |
| L2 | L | **Fixed** | Composer stays enabled and focused while streaming (Enter blocked, button stays Stop). Focus returns after the reply only if the user was typing there, and not on touch devices. Image paste is blocked while streaming (attachments are locked then) |
| L3 | L | **Fixed (chat widgets)** | Table footer, caption, action buttons and tag title use `--neutral-600`; model-coloured tag text is darkened to ≥4.5:1; Atom One Light code colours overridden with AA shades of the same hues (light theme) |
| L4 | L | **Fixed** | Meta pixel unmounted (it was always blocked by the CSP); map errors gone (F5); Mixpanel debug logs only with `NEXT_PUBLIC_MIXPANEL_DEBUG=true` |
| L5 | L | **Fixed** | The edit/copy bar appears on hover anywhere across the message's width and on keyboard focus; focus returns to Edit after save/cancel. Shortcut hints show ⌘ on Apple, Ctrl elsewhere (hydration-safe) |

## 6. Prompt enhancement

| # | Sev | Status | Notes |
|---|---|---|---|
| E1 | M | **Not done** | Out of scope. Research is done: backend `POST /persona/enhance-prompt` returns `enhanced_prompt` and up to 3 questions; it is currently unmetered and not budget-gated |
| E2 | M | **Not done** | Out of scope |
| E3 | L | **Not done** | Out of scope (backend prompt change; the current behaviour is locked in by `test_prompt_contract.py`) |

## 7. Reasoning block follow-up

| # | Sev | Status | What changed |
|---|---|---|---|
| T1 | M | **Fixed** | A single step with nothing else in the panel opens expanded, so one click shows the text |
| T2 | L | **Fixed** | A question card adds a marker row: "Waiting for your answer" while open, then "Asked you a question → you answered" or "→ you dismissed it". The waiting state follows the turn, not `isThinkingInProgress`, which the ask_user round already clears |
| T3 | L | **Fixed** | Dividers between all adjacent groups |
| T4 | L | **Fixed** | Tool rows show the search query (or URL/file) from the tool arguments; a detail that just repeats the tool name is hidden. Progress and completion events no longer overwrite it |
| T5 | L | **Fixed** | No mid-phrase ellipsis; settled label is "Thought for Ns" |
| T6 | L | **Partly fixed** | Root cause not found (needs a live repro). Related bug fixed: card-only or file-only turns are no longer flagged "empty"/"interrupted" |
| T7 | L | **Not done** | Not inspected. One candidate (duplicate React keys) is fixed by R2 |

## Behaviour changes to know about

- Every `(app)` route is now rendered per request instead of being statically prerendered, because the layout reads the sidebar cookie.
- A widget the model starts **mid-sentence** shows as raw XML while streaming and becomes the widget once it closes. Models nearly always start widgets on their own line; this rule is what keeps `<Table>` in prose from being swallowed.
- Pasting an image while a reply streams does nothing (attachments can't be added or removed until it finishes).
- After a mouse click on Copy/Retry, the message action bar stays visible until focus moves elsewhere.
- "Thought for Ns" includes time spent answering a question card.
- Persona chat was not given follow-to-bottom (it never had it; it scrolls once to each new reply).

## Pending

**Product / backend (need a decision or backend work)**
- **Web search, style and connectors are no-ops end to end (new finding).** `POST /chats/{id}/stream` accepts no `web_search`, `tone_id` or connector field, and connector slugs are never even sent. The front end also sends `system_prompt` while the backend expects `system_instruction`.
- Regenerate/edit on a turn with uploaded files: needs a backend carry-over of the turn's attachments and pins before it can replace instead of append.
- R10 full fidelity: the backend would need to store each tool call's order, status and round.
- F13 long term: the backend should send sources itself rather than the front end parsing the model's text.
- L1 mobile layout, E1–E3 prompt enhancement.

**Engineering follow-ups (pre-existing, found during review)**
- Editing the same message twice can send an outdated `replace_message_id` (the user message's id isn't updated after its turn is replaced).
- `LeftSidebar` still reads sessionStorage during render (`billingSnap`, `personaAvatarUrl`) — the same hydration risk as D3.
- Shared chats (`/share/[id]`) render Markdown directly, so widgets show as raw XML there.
- T6 and T7 need a live repro.

**Manual checks before shipping (nothing here was run in a real browser)**
- Long replies with reasoning + tables + code: does follow-to-bottom hold, and does scrolling up stop it?
- Reveal speed on a fast stream; Stop part-way through a widget.
- A multi-question card: Back/Next, Skip, X, Enter in the custom box, screen-reader announcement.
- Collapse the sidebar, go to Settings and back, reload: still collapsed, no hydration warning.
- Map widget pins in light and dark theme.

## Checks run

- `npx vitest run`: 88 files, 957 passed, 2 skipped.
- `npx tsc --noEmit -p .`: 0 errors.
- ESLint: no modified file has more errors than at HEAD (two have fewer); all new files clean. The remaining errors in `Sidebar`, `AnimatedTable`, `XmlTable` and `StreamingMessageBubble` were already there.
- `npx next build`: succeeds.
- Four separate code reviews of the combined change; ~20 findings were reproduced, fixed and covered by tests.

## Files

**Modified:** `.gitignore`, `package.json`, `package-lock.json`, `docs/analytics/mixpanel-backend-contract.md`, `src/app/(app)/layout.tsx`, `src/app/layout.tsx`, `src/components/AccountMenu/index.tsx`, `src/components/MessageBubble/index.tsx`, `src/components/MetaPixel/index.tsx` (comment only), `src/components/QuestionCard/index.tsx`, `src/components/Sidebar/index.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/LeftSidebar.tsx`, `src/components/chat/` (`ActivityRow`, `AnimatedTable`, `AnimatedTags`, `ChatInput`, `ChatInterface`, `ChatMessage`, `ChatPromptCard`, `CitationChip`, `ClarificationCard`, `CodeBlock`, `ReasoningBlock`, `StreamingContentRenderer`, `StreamingMessageBubble`, `XmlMapCanvas`, `XmlTable`), `src/hooks/use-streaming-chat.ts`, `src/lib/` (`analytics/mixpanel.ts`, `api/chat.ts`, `chat-scroller.ts`, `content-parser.ts`, `content-renderer.tsx`, `highlight.ts`, `markdown-preprocess.ts`, `markdown-utils.tsx`, `model-error.ts`, `normalizers/message-transformer.ts`, `parsers/content-parser.ts`, `pin-markdown.tsx`, `reasoning.ts`, `storage-keys.ts`, `streaming.ts`), `src/types/chat.ts` (additions).

**New:** `scripts/sse-probe.mjs`, `src/components/chat/WidgetSkeleton.tsx` (+ `.module.css`), `src/components/chat/CodeBlock.module.css`, `src/components/chat/XmlMap.colors.ts`, `src/components/chat/AnimatedTags.contrast.ts`, `src/lib/` (`activity-detail.ts`, `chat-prompt-answers.ts`, `citations.ts`, `highlight-loader.ts`, `platform.ts`, `replace-message-id.ts`, `reveal.ts`, `stick-to-bottom.ts`, `turn-options.ts`, `turn-outcome.ts`), plus a test file for each new module and for `ChatPromptCard`, `ChatInput` (streaming), `CodeBlock`, `ReasoningBlock` (DOM), `StreamingTextContent`, `WidgetSkeleton`, `MessageBubble`, `ActivityRow`, `use-streaming-chat`, `message-transformer`, `parsers/content-parser`, `pin-markdown`, `storage-keys`, `streaming`.

**Deleted (staged):** `test-sse.mjs`, `tmp-next-dev.log`, `tmp-next-dev.err.log`, `github.copilot-chat-0.48.1.vsix`.

**Not touched (owner's in-progress work in the same tree):** `ContextPanel/*`, `BrowserPanel/*`, `app/browser-verify/`, `chat-context-store.ts`, `feature-flags.ts`, `lib/plan.ts`, `api/sse-schemas.ts` (`plan_updated`).
