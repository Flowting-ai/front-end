# SSE Events Reference

Two kinds of events arrive on the same SSE stream:

- **Named events** — `event: <name>\ndata: {...}\n\n`
- **Inline events** — `data: {"type":"<name>",...}\n\n` (no `event:` prefix)

---

## Named events

### `message_saved`
```json
{ "message_id": "string" }
```

### `title`
```json
{ "title": "string" }
```

### `model_selected`
```json
{
  "model_id": "string",
  "model_name": "string",
  "deployment_name": "string|null",
  "company": "string|null",
  "complexity": "string|null",
  "thinking_enabled": "boolean|null",
  "effort": "string|null"
}
```

### `web_search`
```json
{
  "query": "string",
  "links": []
}
```

### `image`
```json
{
  "url": "string",
  "s3_key": "string"
}
```

### `generated_file`
```json
{
  "url": "string",
  "s3_key": "string",
  "filename": "string",
  "mime_type": "string"
}
```

### `tool_progress`
```json
{
  "tool": "string",
  "label": "string|null",
  "status": "string",
  "filename": "string",
  "step": "string|null",
  "message": "string|null",
  "code_preview": "string|null"
}
```

`tool` values: `doc_execute`, `csv_execute`, `read_pages`, `web_search`, `fetch_resource`.

`label` values:
- `doc_execute` → `Generating PDF` | `Generating Word document` | `Generating presentation` | `Generating spreadsheet` | `Generating document`
- `csv_execute` → `Processing spreadsheet`
- `read_pages` → `Reading pages`
- `web_search` → `Searching the web`
- `fetch_resource` → `Fetching resource`

`status` / `step` values:
- `doc_execute`: `start` → `executing` → `extracting` → `uploading` → `done` (or `error`)
- `csv_execute`: `start` → `executing` → `extracting` → `uploading` → `done` (or `error`)
- `read_pages`: `start` → `done` (or `error`)
- `web_search`: `start` → `done`
- `fetch_resource`: `start` → `done` (or `error`)

### `docx_progress`
```json
{
  "label": "string|null",
  "step": "string",
  "message": "string",
  "filename": "string",
  "code_preview": "string|null"
}
```

`label`: always `Generating Word document`.

`step` values: `start`, `unpacking`, `analyzing`, `editing`, `validating`, `packing`, `generating`, `done`, `error`.

---

## Inline events

### `content`
```json
{ "type": "content", "content": "string" }
```

### `reasoning_heading`
```json
{ "type": "reasoning_heading", "content": "string" }
```

### `reasoning_body`
```json
{ "type": "reasoning_body", "content": "string" }
```

### `reasoning` (legacy)
```json
{ "type": "reasoning", "content": "string" }
```

### `tool_calls_streaming`
```json
{
  "type": "tool_calls_streaming",
  "content": "string",
  "tool_call": { }
}
```

### `tool_executing`
```json
{
  "type": "tool_executing",
  "content": "string",
  "label": "string",
  "tool_call": {
    "name": "string",
    "arguments": { },
    "raw_arguments": "string",
    "args_parse_error": "string|null",
    "tool_call_id": "string|null"
  }
}
```

`content` is the raw tool name. `label` is the human verb to render — see the `tool_progress` table above for the full set.

### `tool_complete`
```json
{
  "type": "tool_complete",
  "content": "string",
  "label": "string",
  "tool_call": {
    "name": "string",
    "tool_call_id": "string|null",
    "result": "string",
    "duration_s": "number"
  }
}
```

`result` is capped at 8 KB; if truncated, the string ends with `…[truncated, total N chars]`.

### `done`
```json
{
  "type": "done",
  "usage": { },
  "reasoning_details": [],
  "tool_calls": [],
  "finish_reason": "string|null"
}
```

`finish_reason` of `length`, `incomplete`, or `content_filter` indicates a truncated response.

### `error`
```json
{ "type": "error", "error": "string" }
```

---

## Tool → label map

| `tool` (raw) | `label` (display) |
|---|---|
| `doc_execute` (filename `*.pdf`) | `Generating PDF` |
| `doc_execute` (filename `*.docx`) | `Generating Word document` |
| `doc_execute` (filename `*.pptx`) | `Generating presentation` |
| `doc_execute` (filename `*.xlsx`) | `Generating spreadsheet` |
| `doc_execute` (other / unknown) | `Generating document` |
| `docx_execute` | `Generating Word document` |
| `csv_execute` | `Processing spreadsheet` |
| `read_pages` | `Reading pages` |
| `web_search` | `Searching the web` |
| `fetch_resource` | `Fetching resource` |
| `skills` | `Loading skill` |

---

## Per-tool event sequences

### `doc_execute`
```
data: {"type":"tool_executing","content":"doc_execute","label":"Generating PDF","tool_call":{...}}
event: tool_progress     {tool:"doc_execute", label:"Generating PDF", status:"start", ...}
event: tool_progress     {tool:"doc_execute", label:"Generating PDF", status:"executing", ...}
event: tool_progress     {tool:"doc_execute", label:"Generating PDF", status:"extracting", ...}
event: tool_progress     {tool:"doc_execute", label:"Generating PDF", status:"uploading", ...}
event: generated_file    {url, s3_key, filename, mime_type}
event: tool_progress     {tool:"doc_execute", label:"Generating PDF", status:"done", ...}
data: {"type":"tool_complete","content":"doc_execute","label":"Generating PDF","tool_call":{...,"duration_s":N}}
```

### `docx_execute`
```
data: {"type":"tool_executing","content":"docx_execute","label":"Generating Word document","tool_call":{...}}
event: docx_progress     {label:"Generating Word document", step:"start", ...}
event: docx_progress     {label:"Generating Word document", step:"unpacking", ...}
event: docx_progress     {label:"Generating Word document", step:"analyzing", ...}
event: docx_progress     {label:"Generating Word document", step:"editing", ...}
event: docx_progress     {label:"Generating Word document", step:"validating", ...}
event: docx_progress     {label:"Generating Word document", step:"packing", ...}
event: generated_file    {url, s3_key, filename, mime_type}
event: docx_progress     {label:"Generating Word document", step:"done", ...}
data: {"type":"tool_complete","content":"docx_execute","label":"Generating Word document","tool_call":{...}}
```

### `csv_execute`
```
data: {"type":"tool_executing","content":"csv_execute","label":"Processing spreadsheet","tool_call":{...}}
event: tool_progress     {tool:"csv_execute", label:"Processing spreadsheet", status:"start", ...}
event: tool_progress     {tool:"csv_execute", label:"Processing spreadsheet", status:"executing", ...}
event: tool_progress     {tool:"csv_execute", label:"Processing spreadsheet", status:"extracting", ...}
event: tool_progress     {tool:"csv_execute", label:"Processing spreadsheet", status:"uploading", ...}
event: tool_progress     {tool:"csv_execute", label:"Processing spreadsheet", status:"done", ...}
data: {"type":"tool_complete","content":"csv_execute","label":"Processing spreadsheet","tool_call":{...}}
```

### `read_pages`
```
data: {"type":"tool_executing","content":"read_pages","label":"Reading pages","tool_call":{...}}
event: tool_progress     {tool:"read_pages", label:"Reading pages", status:"start", ...}
event: tool_progress     {tool:"read_pages", label:"Reading pages", status:"done", ...}
data: {"type":"tool_complete","content":"read_pages","label":"Reading pages","tool_call":{...}}
```

### `web_search`
```
data: {"type":"tool_executing","content":"web_search","label":"Searching the web","tool_call":{...}}
event: tool_progress     {tool:"web_search", label:"Searching the web", status:"start", ...}
event: web_search        {query, links}
event: tool_progress     {tool:"web_search", label:"Searching the web", status:"done", ...}
data: {"type":"tool_complete","content":"web_search","label":"Searching the web","tool_call":{...}}
```

### `fetch_resource`
```
data: {"type":"tool_executing","content":"fetch_resource","label":"Fetching resource","tool_call":{...}}
event: tool_progress     {tool:"fetch_resource", label:"Fetching resource", status:"start", ...}
event: tool_progress     {tool:"fetch_resource", label:"Fetching resource", status:"done", ...}
data: {"type":"tool_complete","content":"fetch_resource","label":"Fetching resource","tool_call":{...}}
```

### `skills`
```
data: {"type":"tool_executing","content":"skills","label":"Loading skill","tool_call":{...}}
data: {"type":"tool_complete","content":"skills","label":"Loading skill","tool_call":{...}}
```
