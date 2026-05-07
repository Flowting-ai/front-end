# SSE Events Reference

Every Server-Sent Event the backend emits, grouped by emitter. Each event is one `data: <json>\n\n` block on the wire; named events also carry an `event: <name>\n` line in front.

Schemas live in `core/sse_schemas.py`. The unnamed (anonymous) `data:` events come from `modules/llm/service.py:_sse()` and carry a `StreamEvent` payload (schema in `modules/llm/schemas.py`).

---

## 1. Stream events (`event:` field absent — model output)

All emitted by `modules/llm/service.py` via `_sse(StreamEvent(...))`. Frontend reads these with `JSON.parse(data)` and switches on `type`.

| `type`                  | When                                                                      | Key fields                                                                                                |
|-------------------------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `reasoning`             | Model is emitting reasoning / thinking text                               | `content`                                                                                                  |
| `content`               | Visible assistant text token                                               | `content`                                                                                                  |
| `image`                 | Model produced an inline image                                            | `images: string[]` (data URLs)                                                                             |
| `tool_calls_streaming`  | Model is streaming the JSON args of a tool call (per-fragment)            | `content` (tool name), `tool_call: {name, args_delta, args_length}`                                        |
| `tool_executing`        | Backend is about to run the tool                                          | `content` (tool name), `tool_call: {name, arguments, raw_arguments, args_parse_error, tool_call_id}`       |
| `tool_complete`         | Tool finished                                                              | `content` (tool name), `tool_call: {name, tool_call_id, result, duration_s}`                              |
| `done`                  | One LLM round finished (multiple per agentic turn)                         | `usage`, `reasoning_details`, `tool_calls`, `finish_reason`                                                |
| `error`                 | Stream / LLM / on_complete failure                                         | `error`                                                                                                    |

Sources:
- `modules/llm/stream.py:151,154,157,162,170,185,196,227,252,267,271,277`
- `modules/llm/service.py:161,176,185,205,210,213,222,233,273,314,343,372`

---

## 2. Named events — shared

| Event              | Schema (`core/sse_schemas.py`) | Fields                                                  | Emitted from                                                                 |
|--------------------|---------------------------------|---------------------------------------------------------|------------------------------------------------------------------------------|
| `message_saved`    | `MessageSavedEvent`             | `message_id`                                            | `chat/service.py:593`, `persona/service.py:583`                              |
| `title`            | `TitleEvent`                    | `title`                                                 | `chat/service.py:649`, `persona/service.py:629`, `workflow/service.py:318`   |
| `web_search`       | `WebSearchEvent`                | `query`, `links[]`                                      | `chat/service.py:489`, `persona/service.py:415`, `workflow/engine.py:435`    |
| `image`            | `ImageEvent`                    | `url`, `s3_key`                                         | `chat/service.py:525` (CSV charts)                                           |
| `generated_file`   | `GeneratedFileEvent`            | `url`, `s3_key`, `filename`, `mime_type`                | `document/doc_tools.py:300`, `docx/doc_execute.py:168,281`                   |
| `tool_progress`    | `ToolProgressEvent`             | `tool`, `status`, `filename`, `step?`, `message?`, `code_preview?` | `document/csv_tools.py:24`, `document/tools.py:282` (read_pages), `document/fetch_tools.py:63`, `chat/service.py:484` (web_search) |
| `docx_progress`    | `DocxProgressEvent`             | `step`, `message`, `filename`, `code_preview?`          | `docx/doc_execute.py:91` (helper used at every operation step)               |

### `tool_progress` `status` values seen

`web_search`: `start`, `done`
`read_pages`: per-step status (e.g. `start`, `reading`, `done`)
`csv_execute`: per-step status (`start`, `executing`, `done`)
`fetch_resource`: `start`, `done`

### `docx_progress` `step` values

Defined in the file header at `modules/docx/doc_execute.py:1-17`:
`start`, `unpacking`, `analyzing`, `generating`, `editing`, `validating`, `packing`, `done`, `error`.

---

## 3. Chat-only

| Event             | Schema             | Fields                                                                                       | Emitted from                  |
|-------------------|--------------------|----------------------------------------------------------------------------------------------|-------------------------------|
| `model_selected`  | `ModelSelectedEvent` | `model_id`, `model_name`, `deployment_name?`, `company?`, `complexity?`, `thinking_enabled?`, `effort?` | `chat/service.py:609`         |

---

## 4. Workflow-only

All in `modules/workflow/engine.py`.

| Event               | Schema                  | Fields                                                | Emitted at                   |
|---------------------|-------------------------|-------------------------------------------------------|------------------------------|
| `workflow_start`    | `WorkflowStartEvent`    | `workflow_id`, `workflow_name`, `node_count`          | `engine.py:149`              |
| `node_start`        | `NodeStartEvent`        | `node_id`, `node_type`, `name`                        | `engine.py:161`              |
| `content`           | `NodeContentEvent`      | `node_id`, `content`                                  | `engine.py:172,216,244`      |
| `reasoning`         | `NodeReasoningEvent`    | `node_id`, `content`                                  | `engine.py:182,221,250`      |
| `node_image`        | `NodeImageEvent`        | `node_id`, `url`, `s3_key`                            | `engine.py:231`              |
| `node_complete`     | `NodeCompleteEvent`     | `node_id`, `node_type`, `name`, `is_kb_node?`         | `engine.py:236`              |
| `node_failed`       | `NodeFailedEvent`       | `node_id`, `error`                                    | `engine.py:431`              |
| `workflow_complete` | `WorkflowCompleteEvent` | `final_output`                                        | `engine.py:260`              |
| `error`             | `WorkflowErrorEvent`    | `error`                                               | `engine.py:63,70,263`        |

Workflow streams **also** emit the shared events (`title`, `web_search`, `generated_file`, `tool_progress`) and the unnamed `data:` stream events from any LLM nodes inside the workflow.

---

## 5. LLM playground / model-test

`modules/llm/router.py:41,50` emits raw `data: {...}\n\n` lines (no `event:`):

| Shape                                                                                        | When                              |
|----------------------------------------------------------------------------------------------|-----------------------------------|
| `{model_id, model_name: "unknown", type: "error", error: "Model not found"}`                 | Bad model id passed to test endpoint |
| `{model_id, model_name, ...stream payload}`                                                  | Per-token output during model test |

---

## 6. Transport-level

| Line                | Source                              | Purpose                                                                                  |
|---------------------|-------------------------------------|------------------------------------------------------------------------------------------|
| `: heartbeat\n\n`   | `core/sse.py:heartbeat_stream` (75) | SSE comment line. Sent every 10s of silence to keep proxies/CDNs from timing out the connection. EventSource clients silently ignore it. |

---

## Endpoints that surface these

| Route                                  | Wrapped via                         | Catalogue                       |
|----------------------------------------|-------------------------------------|---------------------------------|
| `POST /chat/{id}/messages` (stream)    | `chat/router.py:52` heartbeat_stream | `CHAT_SSE_RESPONSES`            |
| `POST /persona/.../messages` (stream)  | `persona/router.py:56` heartbeat_stream | `PERSONA_SSE_RESPONSES`     |
| Workflow streaming                     | (workflow router)                    | `WORKFLOW_SSE_RESPONSES`        |
| LLM playground stream                  | `llm/router.py`                      | (raw, no catalogue)             |

The `*_SSE_RESPONSES` blocks (in `core/sse_schemas.py:198–239`) inject the JSON schemas into FastAPI's OpenAPI under `x-sse-events` so Swagger UI shows the shapes.
