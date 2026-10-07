# Chat output fixes: what was done and what is pending

Follow-up to [chat-output-bugs-scan.md](chat-output-bugs-scan.md). Date: 2026-10-04. Front-end only (no `souvenir-server` changes). Everything is **uncommitted** in the working tree, for review.

## TL;DR

- **Fixed:** all question-card issues (Q1–Q6), all reasoning/streaming issues (R1–R10, T1–T5), all formatting issues (F1–F13), data/logic (D1–D4, D1 with one exception) and L2–L5.
- **Fixed in the follow-up (2026-10-05):** E1 + E2 (Enhance calls the backend; line-based diff), editing the same message twice, the `LeftSidebar` hydration risk, and widgets on shared chats.
- **Not done:** L1 mobile layout (skipped), E3 (backend-only), all backend changes.
- **Not reproduced:** T6 "Generation interrupted" (needs a live repro). T7 dev "1 Issue" badge: not seen on `/chat` idle or after a reply (R2 most likely fixed it).
- **New finding, not fixed:** the web search toggle, style picker and connector selection reach the backend nowhere — the chat endpoint doesn't accept them.
- **Checks:** 990 tests pass (2 skipped), `tsc` clean, ESLint shows no new errors, `next build` succeeds. The main behaviours were also checked in a real browser (see "Manual checks" below).

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

### 3a. Stray symbols while streaming (found 2026-10-05)

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| F14 | M | **Fixed** | While a reply streamed, the unfinished tail of the last paragraph flashed as raw symbols and then reshaped: an unclosed `` ` ``, `**`, `*word`, a half-written `[text](http…`, raw `\frac{…` before the math closed (or a red KaTeX error), a table header with no separator row, a lone `-` / `1.` / `#`. `healStreamingTail` (streaming only, last paragraph only) closes unclosed inline code, bold, strikethrough and italic, holds back an opener with no text yet, keeps only the text of a half-written link (drops a half-written image/footnote), and holds back unfinished math (`$$`, `\[`, `\(`, and a single `$…` that reads as math — `$A = 1{,}000…` — but not a price like `$5`), a table that isn't one yet, and a lone list/heading marker. A closer goes right after the last word, not after trailing whitespace. Open code fences are left to `closeOpenFences`. The final text is never touched. The live "Thinking" text was watched in the same scans and showed nothing | `lib/markdown-preprocess.ts`, `lib/markdown-utils.tsx` (`streaming` prop), `lib/content-renderer.tsx` |

Found by sampling the reply's text every ~60ms during real streams and flagging odd characters absent from the final text. After the fix the same scan found none, on a markdown prompt, a table + math prompt, and a links/bold/quote/strikethrough prompt.

## 4. Data and logic

| # | Sev | Status | What changed | Where |
|---|---|---|---|---|
| D1 | H | **Partly fixed** | Regenerate sends `replaceMessageId` (no duplicate after reload) and one shared options builder is used by send, initial send, edit and regenerate, so they can't drift. It also no longer uses stale settings. **Exception:** turns with uploaded files still append (the backend soft-deletes a replaced turn's files) | `ChatInterface.tsx`, `lib/turn-options.ts`, `lib/replace-message-id.ts` |
| D2 | M | **Fixed** | `mergeStreamingText` is plain concatenation (backend sends deltas only — verified). Reasoning merges fixed too; same-titled sections no longer merge | `lib/streaming.ts`, `lib/reasoning.ts` |
| D3 | M | **Fixed** | Sidebar state lives in a `sidebar_collapsed` cookie read by the `(app)` layout; localStorage is still written. Remounts (e.g. back from Settings) use the latest toggle; existing users' localStorage value is copied into the cookie once | `(app)/layout.tsx`, `AppLayout.tsx`, `LeftSidebar.tsx`, `storage-keys.ts` |
| D5 | M | **Fixed** | A saved model that is no longer usable now switches automatically. `use-model-selection` kept a stale saved selection ("rather than clobbering it with an arbitrary `fetched[0]`"), so a chat opened on a model retired from the catalog — or blocked — and the send failed. `resolveStoredSelection` keeps the saved model when it is in the catalog and usable (by id, then name + company); otherwise it picks the closest usable one (same provider, then pricing tier, then size class — `pickReplacementModel`), saves it, and shows a toast once. Nothing else usable → the saved model is kept. Agent chats already did this on load (Tier 3 in `PersonaChatInterface`). A send-time retry was tried and removed: the backend has no 'model retired' response at send time | `lib/model-fallback.ts`, `hooks/use-model-selection.ts` |
| D4 | L | **Fixed** | `scripts/sse-probe.mjs` reads `SOUVENIR_JWT` and `BACKEND_URL` from env. `test-sse.mjs`, `tmp-next-dev*.log` and the `.vsix` are deleted (`git rm`, staged); `.gitignore` updated. The expired token remains in git history | `scripts/`, `.gitignore` |

## 5. Layout, accessibility, console

| # | Sev | Status | What changed |
|---|---|---|---|
| L1 | M | **Not done** | Out of scope for this pass. Measured later: below ~768px the sidebar does not collapse or become a drawer, so the chat is unusable while it is open (see L8) |
| L2 | L | **Fixed** | Composer stays enabled and focused while streaming (Enter blocked, button stays Stop). Focus returns after the reply only if the user was typing there, and not on touch devices. Image paste is blocked while streaming (attachments are locked then) |
| L3 | L | **Fixed (chat widgets)** | Table footer, caption, action buttons and tag title use `--neutral-600`; model-coloured tag text is darkened to ≥4.5:1; Atom One Light code colours overridden with AA shades of the same hues (light theme) |
| L4 | L | **Fixed** | Meta pixel unmounted (it was always blocked by the CSP); map errors gone (F5); Mixpanel debug logs only with `NEXT_PUBLIC_MIXPANEL_DEBUG=true` |
| L5 | L | **Fixed** | The edit/copy bar appears on hover anywhere across the message's width and on keyboard focus; focus returns to Edit after save/cancel. Shortcut hints show ⌘ on Apple, Ctrl elsewhere (hydration-safe) |

### 5a. Dark theme (checked 2026-10-05)

Dark was switched on with `localStorage['souvenir-theme']='dark'` (theming is on in `.env.local`) and checked in a real browser: screenshots plus an automated audit of every visible text node's contrast and of light surfaces left on screen. Surfaces covered: empty chat and sidebar, a reply with table / chart / steps / callout widgets, a markdown reply (table, code, blockquote, math), the map widget, code blocks, the Context panel, a question card, the agent editor with Enhance open.

| # | Sev | Status | What was found / changed |
|---|---|---|---|
| L6 | H | **Fixed** | Code blocks were unreadable in dark: only `atom-one-light` is bundled, so plain code text was `#383a42` on the dark surface (1.6:1) and the token colours were the light-theme ones. `CodeBlock.module.css` now has an Atom One Dark palette under `[data-theme="dark"]` (comment colour lifted to ≥4.5:1). Verified: code reads cleanly, audit clean |
| L7 | M | **Fixed** | `--neutral-400` (`#6E6E6E` in dark, 3.3:1 on cards; `#9C938B` in light, ~3:1) was used as *text* across the chat widgets: chart axis and bar labels, table sub-lines, card subtitles, the follow-ups label, tooltip text, funnel and source-card meta, activity and attachment labels. Those text uses (CSS `color:` / SVG text `fill` only) now use `--neutral-600`, the value L3 already chose for widget text. Icons, strokes, chart series colours and backgrounds still use `--neutral-400`. No token values changed. Re-audited in dark: 0 low-contrast text on the home screen, widgets, markdown and map views |
| L9 | L | **Fixed (light)** | Light-theme text on `--neutral-500` (`#827A74`) was 4.1:1 on the page and 3.8:1 on the warm cards — sidebar workspace name, "Ideas for you", step descriptions, map and email captions, agent handles, settings section labels, tab labels, agent card descriptions. The light primitive `--neutral-500` is now `#756D67` (4.9:1 / 4.6:1), with its two alpha variants kept in step; dark has its own ramp and is unchanged (`theme.css` differs only by the line below). The reasoning/"Thought for…" text (`--thinking-text`, 3.0:1) is `#776F69` in light (4.8:1) — changed in `scripts/generate-dark-theme.mjs` and the generated `theme.css`. Left as is: the pink selected chip ("Default" tone, brand accent on a pink tint, 3.8:1). A light sweep of home, widgets, map, Mermaid + email, long code, agents, the editor, usage, connectors, schedules and Enhance now reports only the audit's false positives (light text on dark gradient buttons) and that chip |
| L8 | M | **Checked** | Dark at phone width (390px, sidebar collapsed to its rail): no horizontal scroll or overflow on home, widgets, map, Mermaid + email, long code lines (they scroll inside the block), agents, settings pages and the Enhance result; 0 low-contrast text. The Enhance questions, diff and Markdown preview were walked through end to end in dark. **At 390px with the sidebar expanded the chat is unusable** — see L1 |
| — | — | **Checked, fine** | Context panel card (`--neutral-white` resolves to a dark surface in dark, so the earlier white-card change is light-only), question card, widgets, tables, Enhance panel, sidebar: no unthemed light surfaces and no low-contrast text beyond L7. The map's attribution box (MapLibre's own control) and the agent card's "Use in chat" button are white in dark by design/third-party |

## 6. Prompt enhancement

| # | Sev | Status | Notes |
|---|---|---|---|
| E1 | M | **Fixed** | Enhance calls `POST /persona/enhance-prompt`: the first call returns a draft and up to 3 questions (shown in the existing Q&A card with a typed "Other" row); the answers go back in a second call for the final draft, then the diff. No questions → straight to the diff. A failed call falls back to the old local flow; a failed second call shows the first draft; a reply that arrives after Close is ignored. While a call is in flight there is a visible Cancel; after 8s it adds "Still working on it — this can take a little while", and after 45s it gives up (first call → the local check, with a toast; refine call → the first draft). Measured live: ~14s for the first call, ~18s for the refine. The endpoint is still unmetered, and a click can now make up to two LLM calls | `EnhancePromptField/index.tsx`, `enhance/index.ts` (`fromBackendQuestions`) |
| E2 | M | **Fixed** | The diff is line-based (LCS) instead of splitting on sentence punctuation, so headings and bullets stay on their own rows; blank lines and CRLF are ignored; indentation kept. `diffSentences` stays as an alias. The result has a Changes / Preview toggle: Preview renders the enhanced prompt as Markdown (headings, lists, bold) before you apply it. Not done: the fixed Role/Goal/Tone section template from the original proposal — the backend decides the structure | `enhance/index.ts` (`diffLines`) |
| E3 | L | **Not done** | Backend-only (the platform formatting block overrides the prompt's format instructions; locked in by `test_prompt_contract.py`) |

## 7. Reasoning block follow-up

| # | Sev | Status | What changed |
|---|---|---|---|
| T1 | M | **Fixed** | A single step with nothing else in the panel opens expanded, so one click shows the text |
| T2 | L | **Fixed** | A question card adds a marker row: "Waiting for your answer" while open, then "Asked you a question → you answered" or "→ you dismissed it". The waiting state follows the turn, not `isThinkingInProgress`, which the ask_user round already clears |
| T3 | L | **Fixed** | Dividers between all adjacent groups |
| T4 | L | **Fixed** | Tool rows show the search query (or URL/file) from the tool arguments; a detail that just repeats the tool name is hidden. Progress and completion events no longer overwrite it |
| T5 | L | **Fixed** | No mid-phrase ellipsis; settled label is "Thought for Ns" |
| T6 | L | **Partly fixed** | Root cause not found (needs a live repro). Related bug fixed: card-only or file-only turns are no longer flagged "empty"/"interrupted" |
| T7 | L | **Explained; duplicate log removed** | Not seen on `/chat` idle or after a reply. It does appear in dev (the Next overlay counts every `console.error`) whenever a stream request fails — e.g. a chat with an agent whose model was retired returns 409, the UI shows "This model is no longer available", and the overlay says "2 Issues". The failure was logged twice (`Stream request failed`, then `Error`); a `FriendlyStreamError` is now logged once, where it is raised. Duplicate React keys (R2) were the other candidate. Dev-only |

## Behaviour changes to know about

- An agent chat that answers 409 now says "This agent isn't available to chat right now — it may not be published yet, or it was paused or disabled" instead of "This model is no longer available". The backend returns 409 for an unpublished, paused or disabled agent (found with a draft agent), never for a retired model. A failed stream request is logged once instead of twice.
- A saved model that is gone or blocked is replaced automatically on load, with a one-time toast (D5).
- Chat widget text that used `--neutral-400` is darker (L7).

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
- L1 mobile layout (skipped). Measured at 390px: the left sidebar keeps its fixed 294px, so with it open the chat column is squeezed to ~70px and the composer is unusable; with the sidebar collapsed to its 48px rail every screen checked fits (L8). A phone-width fix needs the sidebar to start collapsed and open over the page (a drawer) — not built.
- E3 (the platform formatting block overrides an agent's own format instructions).
- `/persona/enhance-prompt` is unmetered, and Enhance can now make two calls per click.

**Engineering follow-ups**
- Done 2026-10-05: editing the same message twice sent a stale `replace_message_id` (a turn is one backend row, only the reply's id is swapped after a stream; the edit now takes the id from the reply that follows, `resolveEditReplaceId`). Persona chat has no edit path, so it isn't affected.
- Done 2026-10-05: `LeftSidebar` read sessionStorage during render (`billingSnap`, draft avatars). Both are now gated on `useIsClient()`, so the first client render matches the server. Cost: one frame of the default state.
- Done 2026-10-05: the shared-chat view (`chat-shares/[shareId]`, not `/share/[id]`, which is the invite landing page) rendered Markdown directly. It now uses `ContentRenderer`, and each reply also shows its reasoning (collapsed, from the `reasoning` field the API already returned) and its sources (the model's "Sources:" block parsed into `[N]` chips and a source list). Covered by `chat-shares/[shareId]/page.test.tsx`.
- T6 needs a live repro.

**Manual checks (run in a real browser with Playwright, 2026-10-05)**
- Follow-to-bottom on a long reply: holds while streaming; scrolling up stops it and the view doesn't jump at the end. **Pass.**
- Reveal speed on a fast stream: the text finished growing before the stream reported finished (no lag after the end). **Pass.**
- Stop part-way through a table: "Couldn't display this table — the response ended early" with raw output collapsed. **Pass.**
- Multi-question card: Next disabled until answered, Send advances, Previous restores the answer, Dismiss sends a reply, Skip shows only on optional questions and sends `null`, Enter sends from the custom box and Shift+Enter keeps a newline, the question is announced via `aria-live`. **Pass.**
- Sidebar: collapse, Settings and back (client-side navigation), reload — stays collapsed, no hydration warning. **Pass.** (A full-page load of Settings followed by the browser Back button showed the stale page; that is the browser's cache, not the app.)
- Map pins: three pins render. Only light theme was checked; the console showed only headless-WebGL "GPU stall" warnings.
- Not checked: dark theme for maps; other routes for the dev "Issue" badge.

## Checks run

- `npx vitest run`: 96 files, 1032 passed, 2 skipped (re-run 2026-10-05 after the follow-up; new tests for the line diff, question mapping, `EnhancePromptField` (backend flow, slow call, timeout, preview), `useIsClient`, `resolveEditReplaceId`, `healStreamingTail`, `model-fallback`, and the shared chat page).
- `npx tsc --noEmit -p .`: 0 errors.
- ESLint: no modified file has more errors than at HEAD (two have fewer); all new files clean. The remaining errors in `Sidebar`, `AnimatedTable`, `XmlTable` and `StreamingMessageBubble` were already there.
- `npx next build`: succeeds.
- Four separate code reviews of the combined change; ~20 findings were reproduced, fixed and covered by tests.

## Files

**Modified:** `.gitignore`, `package.json`, `package-lock.json`, `docs/analytics/mixpanel-backend-contract.md`, `src/app/(app)/layout.tsx`, `src/app/layout.tsx`, `src/components/AccountMenu/index.tsx`, `src/components/MessageBubble/index.tsx`, `src/components/MetaPixel/index.tsx` (comment only), `src/components/QuestionCard/index.tsx`, `src/components/Sidebar/index.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/layout/LeftSidebar.tsx`, `src/components/chat/` (`ActivityRow`, `AnimatedTable`, `AnimatedTags`, `ChatInput`, `ChatInterface`, `ChatMessage`, `ChatPromptCard`, `CitationChip`, `ClarificationCard`, `CodeBlock`, `ReasoningBlock`, `StreamingContentRenderer`, `StreamingMessageBubble`, `XmlMapCanvas`, `XmlTable`), `src/hooks/use-streaming-chat.ts`, `src/lib/` (`analytics/mixpanel.ts`, `api/chat.ts`, `chat-scroller.ts`, `content-parser.ts`, `content-renderer.tsx`, `highlight.ts`, `markdown-preprocess.ts`, `markdown-utils.tsx`, `model-error.ts`, `normalizers/message-transformer.ts`, `parsers/content-parser.ts`, `pin-markdown.tsx`, `reasoning.ts`, `storage-keys.ts`, `streaming.ts`), `src/types/chat.ts` (additions).

**New:** `scripts/sse-probe.mjs`, `src/components/chat/WidgetSkeleton.tsx` (+ `.module.css`), `src/components/chat/CodeBlock.module.css`, `src/components/chat/XmlMap.colors.ts`, `src/components/chat/AnimatedTags.contrast.ts`, `src/lib/` (`activity-detail.ts`, `chat-prompt-answers.ts`, `citations.ts`, `highlight-loader.ts`, `platform.ts`, `replace-message-id.ts`, `reveal.ts`, `stick-to-bottom.ts`, `turn-options.ts`, `turn-outcome.ts`), plus a test file for each new module and for `ChatPromptCard`, `ChatInput` (streaming), `CodeBlock`, `ReasoningBlock` (DOM), `StreamingTextContent`, `WidgetSkeleton`, `MessageBubble`, `ActivityRow`, `use-streaming-chat`, `message-transformer`, `parsers/content-parser`, `pin-markdown`, `storage-keys`, `streaming`.

**Deleted (staged):** `test-sse.mjs`, `tmp-next-dev.log`, `tmp-next-dev.err.log`, `github.copilot-chat-0.48.1.vsix`.

**Not touched (owner's in-progress work in the same tree):** `ContextPanel/*`, `BrowserPanel/*`, `app/browser-verify/`, `chat-context-store.ts`, `feature-flags.ts`, `lib/plan.ts`, `api/sse-schemas.ts` (`plan_updated`).
