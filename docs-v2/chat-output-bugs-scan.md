# Chat output, formatting, reasoning & question-card issues

Scan date: 2026-10-04. Method: Playwright against the running dev app with the `.env.local` test account, plus mocked SSE streams (`POST /api/chat` rerouted) and ~8 real chats. Read-only; nothing here is fixed yet unless marked **Fixed**.

## TL;DR

- **Question cards are broken:** Skip, X and Next do nothing; Skip ignores the backend `required` flag; empty Send advances; option + custom text double-submits and can lose the card.
- **Reasoning/streaming feel janky:** height jump at first answer token, saw-tooth growth, "undefined" code flash, code/table pop-in, auto-scroll dying on widget-heavy replies.
- **Formatting gaps:** inline-backtick `<chart>`/`<table>` hangs the message, single newlines collapse, headings h3–h6 undistinguished, math with `\$`, uppercase widget tags, map pins invisible.
- **Data/logic:** Regenerate duplicates the turn in history and drops web search/persona/style; `mergeStreamingText` drops repeated deltas; stream errors erase partial text.
- **Enhance prompt** ignores the backend and flattens structure in the diff.
- **Fixed already:** Stop now halts the text reveal; no lingering blur filter on message rows.

Severity: **H** high, **M** medium, **L** low.

## 1. Question cards

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| Q1 | H | Skip, top-right X ("Dismiss question") and Next do nothing, no request sent | `ChatPromptCard.tsx:80-98` passes no `onSkip`/`onNext`; `ClarificationCard.tsx:84` wires `onClose={onSkip}` |
| Q2 | H | Skip shows on required questions; backend `required` flag ignored | `parseChatPrompt` (`prompts.ts:~144`) parses it, `ChatPromptCard` never reads it |
| Q3 | M | Next arrow does nothing, yet is in tab order | same as Q1 |
| Q4 | H | Send with empty "Something else" box advances a required question | `QuestionCard/index.tsx:697-698` → `submit("")`, no emptiness check |
| Q5 | H | Option + custom text then Send runs `onOpenEndedSubmit` and `onSend` on stale state. 1 question: two POSTs. 2+: card jumps/vanishes, nothing sent, agent waits to timeout | `QuestionCard/index.tsx:698` |
| Q6 | M | A11y: focus stays on body, option rows are plain divs (no role/aria), "Something else" is a `<p onClick>` unreachable by keyboard, no aria-live, Enter in custom box does nothing | `QuestionCard/index.tsx:649` |

**Proposed fix:** show Skip only for optional questions; disable Send until non-blank on required; hide X unless all remaining are optional; empty Send on optional = skip; send only custom text when present and only once; give rows roles/keyboard support; focus the card when it appears; add tests per case. Backend note: the model decides which questions are optional.

## 2. Reasoning & streaming

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| R1 | M | Reasoning block height jumps 114 → ~165 → 141 → 167px at first answer token (reproduced twice, real backend) | `ReasoningBlock.tsx:308-337`, instant collapse in the frame the answer mounts |
| R2 | L | Saw-tooth growth (111–139px, drops, regrows) for up to 6s while reasoning | real backend |
| R3 | L | Code block first frame renders `<code>undefined</code>` | `markdown-utils.tsx:~163`, `String(children)` on empty fence |
| R4 | L | Code block pops in (article 80 → 227px); unhighlighted ~127ms, lazy hljs | `CodeBlock.tsx` `loadHljs` |
| R5 | L | Partial tags (`<tabl`) show as literal text ~1.5s on a stalled stream | `findNextOpenTag` |
| R6 | M | Auto-follow scroll dies in real replies with reasoning + table/code (3/3 runs, 1000px below fold). Plain prose is fine. Root cause not isolated | suspect `ChatInterface.tsx:686,699-701` |
| R7 | L | XML widget pop-in (a no-whitespace table is one "word"); completion shifts layout ±24px | `ChatMessage.tsx:~245` |
| R8 | L | Reveal runs ~27ms/word; Copy/Regenerate/Sources appear while only ~55% is visible; reveal ends ~10s after the stream; live region says "complete" early. Copy returns full text | `ChatMessage.tsx:249-258` |
| R9 | M | Stream drop or `RUN_ERROR` replaces already-streamed text with an error message | mock repro |
| R10 | M | Tool-activity rows lost after reload (heading only). May be backend persistence | real repro |

## 3. Formatting / rendering

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| F1 | H | Inline `` `<chart>` `` / `` `<table>` `` in single backticks swallows the rest of the message; "Rendering chart…" persists after reload | `content-parser.ts:31-40` handles only triple fences |
| F2 | M | Unclosed or stopped XML widget hides all later text permanently (also after reload) | `content-parser.ts:118-122`, `PendingBlockPlaceholder` |
| F3 | M | Single newlines collapse into one line | one `<p>` with literal `\n`, no `<br>` |
| F4 | L | Literal `<think>…</think>` stripped from prose, even in backticks; unclosed `<think>` stays raw | `parsers/content-parser.ts:5-35` |
| F5 | M | Map pins invisible: MapLibre can't parse `var(--…)` colours (console errors) | `XmlMapCanvas.tsx:32,35,49,169,173` |
| F6 | L | `\$` inside math garbles (`$\$5$`); plain `\$5` outside math is fine | `markdown-preprocess.ts` |
| F7 | L | h1 renders `<h2>` (20px); h3 same size as body; h4–h6 identical to body | `typography.css:53`, `markdown-utils.tsx:326` |
| F8 | L | Uppercase widget tags (`<TABLE>`) render literal | `findNextOpenTag` case-sensitive |
| F9 | L | One-line fenced block with no language renders as inline pill, no Copy, no margin | `markdown-utils.tsx:~160-166` |
| F10 | L | Language labels mangled: `c++`→"C", `objective-c`→"OBJECTIVE" | regex `/language-(\w+)/` |
| F11 | L | `node="[object Object]"` leaks onto DOM nodes (p, table, th, td, ul, li, h2, blockquote) | `{...props}` spread in `markdown-utils.tsx` |
| F12 | L | Footnote links open in a new tab; task-list items show bullet + checkbox | `BaseLink` |
| F13 | L | Citations stay plain `[1][2]` with real web search (no `web_search` event; `TOOL_CALL_*` not mapped in `to-app-event.ts`). Duplicate Sources list only appears when a `web_search` event is mocked | partly confirmed |

## 4. Data and logic

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| D1 | H | Regenerate duplicates the turn in history after reload and drops web search, persona, style, connectors (no `replaceMessageId`) | `ChatInterface.tsx:839-886` |
| D2 | M | `mergeStreamingText` drops repeated deltas (`"ha","ha"`→`"ha"`, `"a","ab"`→`"ab"`); AG-UI sends only deltas, so the snapshot heuristic is unneeded | `src/lib/streaming.ts`; used at `use-streaming-chat.ts:445`, `reasoning.ts:40,320` |
| D3 | M | Hydration mismatch when `localStorage.sidebar_collapsed="true"` (294px server vs 48px client) | `lib/storage-keys.ts:8`, `LeftSidebar.tsx` `FlatSidebar` |
| D4 | L | Hardcoded expired JWT in `front-end/test-sse.mjs` | should not be in the repo |

## 5. Layout, accessibility, console

| # | Sev | Issue |
|---|---|---|
| L1 | M | No responsive layout at 390px: expanded sidebar leaves the main pane ~95px; collapsed, floating icons overlap the message and heading |
| L2 | L | Focus stays on body after send and after completion |
| L3 | L | Low contrast: highlighted code (~3.1:1), tag label (2.7:1), table footer (1.7:1), tag-section title (2.9:1) |
| L4 | L | Console noise on every load: `fbevents.js` blocked by CSP, MapLibre errors (~30 per map), Mixpanel debug logs |
| L5 | L | Edit message works only when hovering the bubble itself; hint shows "⌘↵" on Windows (may be intentional) |

## 6. Prompt enhancement (agent editor)

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| E1 | M | Enhance uses a local regex and ignores the backend `enhanced_prompt` (zero non-GET requests observed) | `EnhancePromptField/index.tsx:120,184`; backend caller only in `lib/agent-generate.ts:81` |
| E2 | M | Diff splits on sentence punctuation, so headings and bullets glue to the next sentence | `enhance/index.ts:217` |
| E3 | L | Platform formatting block overrides prompt format instructions (always `<table>`, `<steps>`, `<chart>`). Needs the read-only backend prompt | backend |

**Proposed fix:** fixed section template (Role, Goal, Tone, Constraints, Output format, Examples), line-based diff, Markdown preview in the editor, Output-format wording aligned with the real widget set.

## 7. Reasoning block follow-up (2026-10-05)

Live check with Thinking effort = Medium, prompt "Research a topic for me…", then answering the card with "Hypotenuse Theorem". The model is non-deterministic (card vs plain-text question, reasoning vs none), so only one run covered both steps; bodies of sections 2-4 were not read.

| # | Sev | Issue | Evidence / location |
|---|---|---|---|
| T1 | M | **Single child needs two clicks.** With one reasoning step, the outer "Thinking · Clarifying the topic" opens to one inner row "Clarifying the topic", which must be clicked again to show one paragraph. The heading is shown twice | `ReasoningBlock.tsx:632-692` (`ReasoningContent`); the dedupe comment at `:740-743` only covers the collapsed summary |
| T2 | L | Reasoning from the card turn and the follow-up turn is merged into one "Thinking" block (4 sections) with nothing marking where the first reply ended | live DOM |
| T3 | L | Dividers are drawn only between a reasoning section and the tool row after it, not between a tool row and the next reasoning section, so spacing is uneven | `ReasoningBlock.tsx:658` |
| T4 | L | Tool row reads "Searching the web — search web" (second part repeats the first) | live DOM |
| T5 | L | Streaming label "Clarifying… the topic" puts the ellipsis mid-phrase; the summary then switches to the latest heading when done | `ReasoningBlock.tsx:286-300` |
| T6 | L | One run ended with "Generation interrupted. Please retry."; cause (backend or front-end) not determined | live run |
| T7 | L | Dev "1 Issue" badge appeared after the card turn; not inspected | live run |

Formatting of the one body that was read (section 1) is fine: a single clean paragraph under the left rule, no stray markup.

**Proposed fix for T1:** when the timeline has exactly one reasoning step and no tool rows, render its heading and body directly under the single "Thinking" disclosure (no inner disclosure). Keep the nested layout for two or more sections or when tool rows exist. Tidy T3 and T4 at the same time.

## Fixed already

- Stop halts the text reveal (re-checked: no regression).
- No computed `filter` other than `none` on message rows (re-checked).

## Not verified

- Dark mode (theming flag `NEXT_PUBLIC_ENABLE_THEMING` is off during the scan).
- Real question cards (backend never emitted one; only mocked single/multi-choice cards tested; rank/info types untested). Answers reaching the backend verified only for the 1-question case.
- Root cause of R6; background-tab reveal throttling; reasoning body persistence after reload.

## Suggested order

1. Question cards (Q1–Q6)
2. Regenerate (D1), auto-scroll (R6), reasoning jump (R1), single-child reasoning (T1)
3. F1, F2, F3, D2, R9
4. Enhance prompt (E1–E2), responsive layout (L1), hydration (D3)
5. Remaining low-severity items
