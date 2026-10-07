# Chat output: what the backend needs to do

For: backend (`souvenir-server`). Date: 2026-10-04. Context: the front-end fixes in [chat-output-fixes.md](chat-output-fixes.md). Those fixes are front-end only and **work without any backend change**. This doc lists the backend changes that remove the remaining gaps, and the contracts the front end now relies on.

## Summary

| # | What | Priority | Unblocks on the front end |
|---|---|---|---|
| A1 | Accept per-turn composer settings (web search, style/tone, temperature, connectors, system prompt) | **High** (feature currently broken) | Web search toggle, style picker, connector picker actually doing something |
| A2 | Keep a turn's uploaded files and pins when it is replaced (regenerate / edit) | **High** | Regenerate on turns with files stops duplicating history; edit stops losing files |
| B1 | Send and persist structured sources | Medium | Citations no longer depend on parsing the model's text |
| B2 | Store richer tool-call metadata | Medium | Exact tool rows after reload (order, failures, `ask_agent`) |
| B3 | Persist reasoning duration | Low | "Thought for 12s" after reload (today it reads "Thought") |
| B4 | Tell the model what skipped / dismissed answers mean | Low | Better agent behaviour after a dismissed question card |
| B5 | Every stream ends with `RUN_FINISHED` or `RUN_ERROR`; confirm partial turns are saved | Medium | Root cause of "Generation interrupted. Please retry." (T6) |
| B6 | Fix the tag colour example in the prompts | Low | None (front end already compensates) |
| C | Contracts the front end now depends on | Must not break | — |
| D | Deferred: prompt enhancement | Later | E1–E3 |

---

## A1. Accept per-turn composer settings (High)

**Problem.** The composer's web search toggle, style picker, temperature and connector selection do nothing. The front end sends them, but the backend never reads them:

- `POST /chats/create` (`services/chat/router.py` ~134) and `POST /chats/{chat_id}/stream` (~217) accept only: `input, model_id, algorithm, pin_ids, reference_message_id, replace_message_id, use_mistral_ocr, system_instruction, thinking, effort, persona_id, files` (and `project_id` on create).
- Fields the front end sends that are dropped: `web_search` ("true"), `tone_id`, `temperature`, `system_prompt`.
- Name mismatch: the front end sends **`system_prompt`**; the backend reads **`system_instruction`**.
- Connector slugs are not even sent today (front-end gap, see "Front-end follow-up" below).
- `git log -S` shows `web_search` and `tone_id` never existed on the chat router.

**Needed: a product decision first.** For each control, wire it up or remove it from the UI. If wired up:

| Field (multipart form) | Suggested behaviour |
|---|---|
| `web_search: bool` | When `false`, don't expose web tools for this turn (`resources.web_tools`, populated in `services/llm/mcp.py:87`). Agree the default (today web tools are always on) |
| `tone_id: str` | Map to a tone instruction. The tone catalogue (ids → instructions) must be agreed with the front end |
| `temperature: float` | Pass through to the model call, clamped per model |
| `system_instruction: str` | Already accepted. Either the backend also accepts `system_prompt` as an alias, or the front end renames (tell us which) |
| `connector_slugs: list[str]` | Restrict or prioritise connectors for this turn. Agree the field name (front end currently calls it `connectorSlugs`) |

**Acceptance:** with web search off, no web tool is called; with a style chosen, the reply follows it; the same fields are accepted on `/create` and `/{id}/stream` and are honoured when `replace_message_id` is set (regenerate/edit send the current composer settings).

## A2. Keep files and pins when a turn is replaced (High)

**Problem.** Regenerate and edit send `replace_message_id`. `create_message` (`services/chat/service.py` ~264) soft-deletes the target turn and every later one (`repository.py:622-644`). The replaced turn's uploaded files are `MessageFileAttachment` rows keyed by that message id (`models.py:66-70`), and `get_chat_file_attachments` filters `ChatboardMessage.deleted_at == None` (`repository.py:396-421`). So after a replace, the model can no longer see those files, and the front end has no `File` objects to re-upload after a reload. Pins attached to the turn (`MessagePinAttachment`) are lost the same way.

Because of this, the front end currently **does not replace** turns that had uploaded files. It appends instead, which leaves a duplicate turn in history after reload.

**Needed:** when `replace_message_id` is set and the request carries no new files:
1. Before soft-deleting, read the target turn's `origin=uploaded` file attachments and its pin ids.
2. Include those files in this turn's workspace load.
3. After the new turn row is written, insert copies of the attachment rows with the new message id (same `s3_key`, no re-upload).
4. If the request sends no `pin_ids`, default to the replaced turn's pins.

Alternative: an explicit `carry_attachments: bool = Form(False)` flag that the front end sets.

**Please confirm:** soft-deleting a message never purges its S3 objects.

**Acceptance:** regenerate a turn that had a PDF → the new answer can still read the PDF; after reload there is one turn, not two. Same for edit. When this ships, tell the front end so we remove the "append for turns with files" exception.

## B1. Structured sources (Medium)

**Problem.** No citation data reaches the front end. There is no web-search event in `core/sse_schemas.py`; `MessageSavedEvent` has only `message_id` (`sse_schemas.py:45-47`); `WebSearchToolCall` rows are still read (`repository.py:152`) but no longer written (insert removed in commit `aa934dfe`). The front end now parses the model's own "Sources:" block as a stop-gap (see contract C2).

**Needed:**
- Emit sources for the turn, numbered to match the `[N]` markers the model writes, either on `message_saved` or as a `sources` custom event: `sources: [{ "index": 1, "url": "…", "title": "…", "snippet"?: "…" }]`.
- Persist them and return them in `GET /chats/{id}/messages` (field `sources`) so reloads match.

The front end already prefers backend sources over parsed ones, so this can ship without front-end changes.

## B2. Richer tool-call metadata (Medium)

**Problem.** `services/llm/stream.py` ~244 stores each call as `{tool, args, output, duration_s}` in `MessageMetadata.tool_calls`. After reload the front end can only show tool rows as "done", grouped after the reasoning, with no failure state and no order. `outcome` exists only in `toolResults`/`chat_context` (~250), which isn't returned. Control-flow tools (`ask_user`, `ask_agent`, `retrieve_persona`, `list_pins`) are never recorded. The full `output` string is returned in the history payload, which can be large.

**Needed** (the data is already in `stream.py`):
- Add `tool_call_id`, `outcome` (`ok` / `error`), a display `label`, and `round_index` to each `tool_calls` entry.
- Store reasoning per round (or one ordered timeline of reasoning and tool entries) so the order can be rebuilt.
- Decide whether `ask_agent` (and other control-flow tools) should appear after reload.
- Drop or truncate `output` in `GET /messages` (the front end ignores it).

## B3. Persist reasoning duration (Low)

The front end measures thinking time live and shows "Thought for 12s". After reload there's no value, so it reads "Thought". If wanted, store `reasoning_duration_ms` per turn (first reasoning event → first answer token) and return it with the message.

## B4. Question cards: say what skipped and dismissed mean (Low)

The front end POSTs `{"response": {"answers": {...}}}` to `/chats/prompts/{prompt_id}` as before. New values the model may now receive:

| Case | Value for that question id |
|---|---|
| Optional question skipped | `null` |
| Card dismissed with X, question unanswered | `"(dismissed by the user — not answered)"` |
| Multi-choice with typed text | `["opt_a", "opt_b", "typed text"]` |
| Single choice with typed text | `"typed text"` |

`ask_user` (`services/skills/ask_user/tool.py`) passes these through unchanged, which works. Suggested: add one line to the tool description (or the tool result) saying `null` means skipped and the dismissed string means the user declined, so the model shouldn't guess those answers. Optional: also accept a top-level `"dismissed": true` and add a note to the tool result; tell the front end if you do and we'll send it.

## B5. Stream endings and partial turns (Medium)

- The message "Generation interrupted. Please retry." appears when the HTTP stream ends with 2xx but no `RUN_FINISHED`/`RUN_ERROR` and no text. It was seen once after a question-card turn. Please check that every run ends with `RUN_FINISHED` or `RUN_ERROR`, especially around the prompt gate (`core/prompt_gate.py`, 300s wait) and its timeout.
- The front end now keeps partial text on a stream error and shows a banner. Please confirm whether the partial output of a failed turn is saved; if not, the text disappears on reload.

## B6. Tag colour example (Low)

`core/prompts/system.yaml:325,332` and `chat.yaml:488` use `color="#C8920A"` as the example. As text on its tint it is 2.7:1 (fails WCAG AA). The front end now darkens tag text automatically, but the example teaches the model a failing colour. Suggest a darker example (e.g. `#966D07`) or palette names.

---

## C. Contracts the front end now depends on (don't change without telling us)

| # | Contract | Where it's defined | What breaks if it changes |
|---|---|---|---|
| C1 | `TEXT_MESSAGE_CONTENT` and reasoning custom events carry **deltas only**, never the accumulated text | `services/llm/stream.py` ~115-136, `reasoning_split.py` | The front end concatenates, so snapshots would duplicate text |
| C2 | Cited answers end with a `Sources:` block of `[N] [title](url)` lines, numbers matching the `[N]` markers | `core/prompts/system.yaml` ~181-192 | Citation chips and the source list (until B1 ships) |
| C3 | Widget blocks (`<table>`, `<chart>`, `<steps>`…) start on their own line | `system.yaml` ~146-163 | A widget opened mid-sentence shows as raw XML until it closes; an unclosed mid-line tag stays literal text |
| C4 | `<think>` reasoning, if a model emits it in content, is only recognised at the very start of the answer | — | Tags elsewhere are shown as text |
| C5 | Question prompts: `required` (default `true`) controls whether Skip is offered; answers use the shape in B4 | `ask_user/tool.py`, `QuestionPromptEvent` | Skip/required behaviour of the card |
| C6 | Approval prompts: any response other than `approve`/`approve_all` is a rejection. The front end sends `"reject"` when the card is dismissed | `organizations/tools.py` ~415/508, `slack/actions.py` ~680 | A dismissed approval could be treated as approved |
| C7 | Confirm-style prompts (`kind="confirm"`, e.g. browser takeover; connected-code consent) treat any reply as "done". The front end offers no dismiss on them | `skills/web/tool.py` ~478, `skills/connected_code/tool.py` ~311 | — |
| C8 | `message_saved.message_id` is the turn id; `replace_message_id` with it replaces that turn and all later ones | `services/chat/router.py` ~236, `service.py` ~264 | Regenerate/edit |

## Front-end follow-up once the backend ships

- **A1:** send connector slugs (the direct path in `use-streaming-chat.ts` and the `/api/chat` proxy never forward them today) and align field names.
- **A2:** remove the "append for turns with files" exception in regenerate (`ChatInterface.tsx`).
- **B1 / B2 / B3:** map the new fields; no UI work needed.
- **Not backend-dependent:** editing the same message twice can send an outdated `replace_message_id`. The front end will fix that by updating the user message's id from `message_saved`.

## D. Deferred (not needed now)

From the scan's prompt-enhancement items (out of scope for this pass, listed so nothing is lost):
- `POST /persona/enhance-prompt` is not metered and not budget-gated: `structuredCompletion` passes no `billing_user_id`, and the route has no `require_usage_budget` (compare `router.py:157`). Needs metering (e.g. `usage_category="utility"`), the budget guard and a per-user rate limit before the front end calls it on every Enhance click.
- The enhance prompt (`core/prompts/utilities.yaml` ~141) should keep the managed `Tone: …` line verbatim and only name widgets that exist.
- E3: agent/persona format instructions can't override the platform formatting block (`system.yaml:6-21`, `112-361`; locked by `core/tests/test_prompt_contract.py:175-190`). If product wants "prose only" agents, split the block into render rules (absolute) and presentation defaults (overridable).
