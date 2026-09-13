# Chat Preview Spec V2 — 2026-08-14

> Gap analysis between the `chat-preview` animation prototype, the current **front-end** implementation, and the current **back-end** SSE contract.
> V1 (`CHAT_PREVIEW_SPEC.md`) documents *what the prototype does*. This doc documents *what's still missing to make it real* — split into "frontend work required" and "new backend SSE requirements not yet implemented."
>
> Scanned: `chat-preview/app/chat-preview/page.tsx`, `front-end/src/components/chat/*`, `front-end/src/hooks/use-streaming-chat.ts`, `front-end/src/lib/*`, `back-end/core/sse_schemas.py`, `back-end/services/chat/*`, `back-end/services/brain/*`.

---

## 0. Headline finding

The front-end has been **built ahead of the backend** for part of this contract, and **not yet started** for another part:

- **FE already has live handlers for `research_title`, `reasoning_step`, `model_selected`, and `block`/`structured_block`** in `use-streaming-chat.ts` — code comments literally say *"accept both the app envelope and the chat-preview contract"* (`response-blocks.ts:30`, `use-streaming-chat.ts:749-752`). **The backend does not emit any of these four event names anywhere** (`back-end/core/sse_schemas.py` — not in `CHAT_SSE_RESPONSES` or `BRAIN_SSE_RESPONSES`). This is pure backend work: wire the emitters, FE will pick it up with no FE changes.
- **Nobody has built `phase`, `activity_start` / `activity_result` / `activity_complete`, or `group_complete`** — zero references on either side. This needs backend emitters **and** frontend UI (the FE piece is larger here — see §2).
- Backend's actual live contract today is token/delta + single-status-blob shaped (`content`, `reasoning_heading`/`reasoning_body`, `tool_progress`, `tool_executing`, `tool_complete`), not the discrete-event-per-item shape the prototype assumes.

---

## 1. Backend: current real SSE contract

Source of truth: `back-end/core/sse_schemas.py`. This is what actually ships today.

| Event | Shape | Notes |
|---|---|---|
| `message_saved` | `{message_id}` | Fires once, end of turn |
| `title` | `{title}` | Chat title, not research title |
| `web_search` | `{query, links[]}` | One event per search call; FE turns this into a `web-search` activity + citations |
| `image` / `generated_file` | url/s3_key/filename | Generated media |
| `tool_progress` | `{tool, label, status, filename, step?, message?, code_preview?, elapsed_seconds?, percent?, detail?}` | Single mutable status blob per tool call — updated in place, not a start/result/complete triple |
| `docx_progress` | similar to `tool_progress`, docx-specific | |
| `memory_updated` | `{scope, scope_id, memory, version}` | |
| `tool_connect_prompt` | connector OAuth/API-key prompt | Proactive "Connect X" — different pattern from E1's mid-response failure |
| `user_prompt` / `question_prompt` / `permission_prompt` / `approval_prompt` | mid-stream user-input gates | Not represented in the prototype at all (new UX the prototype never modeled) |
| `external_output` | `{actions[]}` | "Done in the world" card — also not in the prototype |
| `context` (Brain only) | persona/pins/files/connectors/project/docs snapshot | |
| `agent_started` / `agent_content` / `agent_finished` (Brain only) | sub-agent rally | |
| *(inline, `type` field)* `reasoning_heading` / `reasoning_body` / `reasoning` (legacy) | free-text deltas | No `verb` taxonomy (Considered/Evaluated/Mapped/…) — just heading text + body text |
| *(inline)* `content` | token/chunk delta | Functionally equivalent to the prototype's `token` event |
| *(inline)* `tool_calls_streaming` / `tool_executing` / `tool_complete` / `done` / `error` | | |

**Not present anywhere in the backend:** `phase`, `model_selected`, `research_title`, `reasoning_step`, `activity_start`, `activity_result`, `activity_complete`, `group_complete`, `citations`, `block`/`structured_block`.

---

## 2. New backend SSE requirements — not yet implemented

Ranked by what's blocking the most visible gaps.

### 2.1 `phase` — routing state machine *(new — not started)*
No equivalent today. The backend currently goes straight from "loading" to streaming `content`; there's no signal for "routing in progress" vs "model chosen" vs "researching."

```
event: phase
data: { phase: "user-sent" | "souvenir" | "thinking" | "choosing" | "model-chosen" | "researching" | "streaming" | "complete" }
```
Needed so the already-built `StreamingIndicator` component (see §3.1) has something to render against.

### 2.2 `model_selected` — *(FE ready, BE missing)*
FE already parses this exact shape (`use-streaming-chat.ts:678-709`), including the Muse-rebrand case where `model_name` is omitted and only `complexity` is sent. **Zero emitters found in backend.** This is the cheapest win on this list — FE requires no changes.

```
event: model_selected
data: { model_id, model_name?, deployment_name?, company?, complexity?, thinking_enabled?, effort? }
```

### 2.3 `research_title` — *(FE ready, BE missing)*
FE handler exists (`use-streaming-chat.ts:431-435`), reading `text ?? title ?? content`. Backend has nothing that emits a running "Planning…" / "Searching the web…" / "Synthesising…" label — today the FE shows nothing in that slot during tool execution because this event never arrives.

```
event: research_title
data: { text: string }
```

### 2.4 `reasoning_step` — *(FE ready, BE partially there)*
FE handler exists (`use-streaming-chat.ts:437-451`) and expects `{index, verb, detail, summary}` — `verb` drives `ReasoningBlock.tsx`'s icon lookup (Considered/Evaluated/Mapped/Identified/Planned/Strategized/Synthesised). Backend currently only has free-text `reasoning_heading`/`reasoning_body` deltas with **no verb taxonomy** — the model isn't prompted to emit a controlled vocabulary here, so this needs backend prompt/parsing work, not just a new event class.

```
event: reasoning_step
data: { index: number, verb: string, detail: string, summary: string }
```

### 2.5 `activity_start` / `activity_result` / `activity_complete` — *(new — not started, needs FE too)*
Today, one tool call = one `tool_progress` blob mutated in place (start→executing→reading→done), with no per-result granularity and no distinct "index" the way the prototype models results streaming in one-by-one under an activity. Building the discrete triple is a bigger backend lift than §2.2–2.4 because it changes how tool execution reports progress, not just the terminal shape.

```
event: activity_start   data: { index, type, detail?, badge? }
event: activity_result  data: { activityIndex, resultIndex, title, domain }
event: activity_complete data: { index, resultCount? }
```
Also needs the `ActivityType` taxonomy expanded on both sides — see §3.3.

### 2.6 `group_complete` — *(new — not started, needs FE too)*
No concept of "action group" exists anywhere in the backend (or frontend — see §3.2). This is what powers S4/S7/S8/S11/S16/S17's "Ran N actions — {summary}" collapsed row. Requires the backend to decide grouping boundaries (e.g., "read all PDF chapters" as one group) and emit a summary string — this is a product/prompt design question as much as an engineering one, worth scoping separately before building.

```
event: group_complete
data: { groupIndex, activityCount, summary }
```

### 2.7 `block` / `structured_block` — *(FE ready, BE missing)*
FE already accepts this exact shape (`use-streaming-chat.ts:749-767`, via `responseBlockFromEventPayload` in `response-blocks.ts`), for all 13 kinds (`text, table, bar-chart, steps, code, callout, tags, follow-ups, pie-chart, line-chart, card, connector-error, search-timeout`). **Backend has no code path that emits a `block` event live, and no code that populates `response_blocks` on the persisted message either** (confirmed: zero matches for `response_blocks` anywhere in `back-end/`). Structured output today only exists as inline markdown-embedded JSON via `services/chat/artifacts.py` (`{"type":"chart"|"table"|"map"|"code"|"math"|"web_search",...}` blocks embedded in message text) — a completely different, older mechanism that the FE's `ResponseBlocks.tsx` renderer does not consume. **This is the single largest backend gap**: either (a) teach `artifacts.py` to also emit live `block` SSE events + persist `response_blocks`, or (b) have the model target the new block schema directly and retire the inline-JSON-in-markdown approach.

### 2.8 Discrete `citations` event — *not required as a new event*
The prototype's `{1}{2}{3}{4}` numbered citations already work end-to-end today via the existing `web_search` event + `message_saved.sources` — `ResponseBlocks.tsx` numbers citations by array position in `webCitations`, not by a dedicated event. **No backend work needed here.**

### 2.9 `token` — *not required as a new event*
The prototype's word-granular `token` event is functionally covered by the existing `content` inline delta (`ChatMessage.tsx`'s `StreamingTextContent` already does the word-reveal timing client-side off whatever chunk size arrives). **No backend work needed here.**

---

## 3. Frontend work required

### 3.1 Wire the existing routing-phase animation into real chat *(build exists, not connected)*
`src/components/StreamingIndicator/index.tsx` is a near 1:1 port of the prototype's cycling-thinking-words → "Choosing the best model…" → glow-burst model swap, complete with matching spring constants. It's used in `src/templates/Brain/StreamingIndicator.tsx` and `EnhanceScanningState`, but **`src/components/chat/ChatMessage.tsx` doesn't use it** — real chat instead shows a static shimmering "Souvenir" label + `BreathingDot` (`ChatMessage.tsx:783-807`) and jumps straight to the resolved model label once it arrives. `ModelChoosingIndicator.tsx` also exists and is unused/orphaned.
**Work:** swap `ChatMessage.tsx`'s loading-state block to render `StreamingIndicator`, driven by the new `phase` event (§2.1). Blocked on §2.1 shipping first (or can be built against a mocked phase sequence in the interim).

### 3.2 Build action-group collapse UI *(doesn't exist)*
`ActivityRow.tsx`/`ActivitiesSection` render a flat staggered list only. There is no "Ran N actions — {summary}" collapsed row, no expand-to-reveal-subitems interaction — confirmed zero references to grouping concepts anywhere in `front-end/src`. This blocks correct rendering of S4, S7, S8, S11, S16, S17.
**Work:** net-new component (collapsed summary row + expand/collapse, per the `AnimatedTable`-adjacent motion patterns already used elsewhere). Can be built in parallel with §2.6 using mocked data, since the UI doesn't depend on the backend's grouping *logic*, only its *shape*.

### 3.3 Expand the `ActivityType` taxonomy *(front-end/src/lib/activity.ts:13-23)*
Today `toolNameToType()` maps everything to one of 9 generic buckets (`web-search, read-pages, csv-execute, fetch-resource, tool-call, doc-execute, docx-progress, skills, other`). Notion/Drive/Slack/GitHub connector calls, image scans, pin reads, code runs, calculations, image generation, and audio processing all fall into the generic `'tool-call'` bucket and lose their distinct icon + default verb (vs. the prototype's 16 specific types with per-connector icons in `ACTIVITY_ICON`/`ACTIVITY_VERB`).
**Work:** extend `ActivityType` + `toolNameToType()` mapping, and add the corresponding icon/verb entries (mirroring `chat-preview/app/chat-preview/page.tsx:211-247`). Purely additive, no backend dependency — `label`/`detail` free text already carries through, only the icon/verb defaults need the new type buckets.

### 3.4 Per-type attachment chip styling
`AttachmentManager.tsx`/`PinChipStrip.tsx` render a generic upload-progress chip with a plain type-badge label, not the prototype's distinct per-type treatment (PDF badge styling, Image badge, brown/bookmark Pin styling, CSV badge). Affects S4/S5/S6.
**Work:** FE-only styling pass, no backend dependency.

### 3.5 `activitiesFirst` ordering support
Zero references to `activitiesFirst` in front-end. S6 requires activities to render before reasoning steps instead of the fixed reasoning-first order everything else uses.
**Work:** small FE change once §2.5 activities are live — low priority, single scenario affected.

### 3.6 Design decision: inline `SourceList` vs. side-drawer `CitationsPanel`
Not a gap so much as a divergence to resolve: the prototype shows a horizontal-scroll `SourceCard` row inline below the response after completion; front-end instead (or additionally) has a slide-in side-drawer (`CitationsPanel.tsx`). Both are separately implemented and animated — this needs a product call, not more engineering, unless the decision is "support both."

---

## 4. Per-scenario readiness (19 scenarios)

Legend: ✅ ready today · 🟡 FE ready, blocked on backend emitting the event · 🔶 needs both FE and BE work

| # | Scenario | Blocked by |
|---|---|---|
| S1 | Simple answer | ✅ none |
| S2 | Deep reasoning | 🟡 §2.1 phase, §2.3 research_title, §2.4 reasoning_step (verb taxonomy); §3.1 wiring |
| S3 | Web research | 🟡 same as S2, citations already work (§2.8) |
| S4 | PDF analysis | 🔶 §2.5 activities + §2.6 groups + §3.2 collapse UI |
| S5 | Image analysis | 🟡 §2.5 activities (generic icon until §3.3) |
| S6 | Pins + reasoning | 🔶 + §3.5 activitiesFirst |
| S7 | Connector: Notion | 🔶 §2.5 + §2.6 + §3.2 + §3.3 (Notion-specific icon) |
| S8 | CSV + code | 🔶 §2.5 + §2.6 + §3.2 |
| S9 | Mixed: Vision+Pins+Web | 🟡 §2.5 activities, no grouping needed |
| S10 | Output: Table (9 variants) | ✅ block rendering fully built (§3 n/a), blocked only on §2.7 backend emitting `block` |
| S11 | Output: Bar chart (6 variants) | 🔶 output ready (§2.7 only); research phase needs §2.6/§3.2 |
| S12 | Output: Steps | 🟡 §2.7 only |
| S13 | Text+Table+Follow-ups | 🟡 §2.7 only |
| S14 | Text+Callout+Tags/Card | 🟡 §2.7 only |
| S15 | Code+Text | 🟡 §2.7 only |
| S16 | Text+Pie+Follow-ups | 🔶 §2.7 (output) + §2.6/§3.2 (research) |
| S17 | Line chart+Text | 🔶 §2.7 (output) + §2.6/§3.2 (research) |
| E1 | Connector auth failure | 🟡 §2.7 only — `AnimatedConnectorError` already built |
| E2 | Web search timeout | 🟡 §2.7 only — `AnimatedSearchTimeout` already built |

**Reading this table:** shipping §2.2/§2.3/§2.4/§2.7 (the four events FE already parses) unblocks 12 of 19 scenarios to at least 🟡. The remaining 🔶 scenarios all share the same two blockers: activity grouping (§2.6 backend + §3.2 frontend) and, for S4/S5/S6/S7/S9, the activity-type taxonomy (§3.3).

---

## 5. Suggested sequencing

1. **Backend ships §2.2 `model_selected`, §2.3 `research_title`, §2.7 `block`** — zero FE work, unblocks S10–S15, E1, E2 immediately (7 scenarios).
2. **Frontend wires §3.1 StreamingIndicator** against §2.1 `phase` (needs backend to also ship `phase` — bundle with step 1).
3. **Backend + frontend build activity grouping together** (§2.5, §2.6, §3.2) — this is the biggest remaining joint effort and the only thing blocking S4/S7/S8/S11/S16/S17.
4. **Frontend polish**: §3.3 taxonomy, §3.4 chip styling, §3.5 ordering — can happen anytime, no cross-team blocking.
5. **Product decision** on §3.6 (inline vs. drawer citations) — resolve before final QA pass, not blocking earlier work.
