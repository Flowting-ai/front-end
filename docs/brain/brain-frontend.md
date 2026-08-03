# Brain — Frontend integration guide

Everything the frontend needs to integrate with the Brain orchestrator chat
surface: HTTP endpoints, every SSE event, the plan card lifecycle, the
approval/counter/cancel round-trip, connector consent inside Brain runs,
failure handling, and the reload-from-GET contract.

If this doc and the backend ever disagree, the backend wins — file a bug
and we'll update this doc.

---

## 1. Mental model

Brain is a separate chat surface, peer to the regular `/chats` and
`/persona/*/chats`. The user opens a Brain chat, types a request, and Brain
(Claude Opus, pinned) decides:

- **Trivial single-shot questions** → answers directly. Stream looks like a
  normal chat: `content` tokens then `done` then `message_saved`. No plan
  card.
- **Anything compound** → emits a structured **plan**, blocks for the user
  to **Approve / Counter / Cancel**, then either executes the approved DAG
  (one tool call per step) or revises after a counter.

Everything happens inside ONE SSE stream per turn. There is no "second
call" after approval; Opus just continues in-context after the
`submit_plan` tool result comes back.

```
user sends turn
    ↓
[SSE opens]
    ↓
Opus calls submit_plan(plan_json)
    ↓
backend emits: plan_proposed + user_prompt  ← FE renders plan card
    ↓
                              [waits for user]
    ↓
FE POSTs /chats/prompts/{prompt_id}    ← decision + optional counter_text
    ↓
backend emits: plan_approved | plan_countered | plan_cancelled
    ↓
   ┌─────────────────────────────────┐
   ↓                                 ↓
approved → executes:           countered → Opus calls submit_plan again
  step_started s1                  with revised plan; cycle repeats
  tool_executing
  tool_complete                cancelled → Opus says one sentence; done
  step_completed s1
  ... repeat per step ...
    ↓
content tokens (synthesis)
    ↓
done → message_saved → [SSE closes]
```

---

## 2. HTTP surface

All routes live under `/brain`. Auth is JWT (same Bearer token as the rest
of the API).

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/brain` | — | `BrainChatListItem[]` — user's Brain chats |
| `POST` | `/brain/create` | multipart form | SSE stream (see §3) |
| `POST` | `/brain/{chat_id}/stream` | multipart form | SSE stream (see §3) |
| `GET` | `/brain/{chat_id}/messages` | — | `BrainMessage[]` (see §8) |
| `GET` | `/brain/{chat_id}/plans` | — | `BrainPlanResponse[]` — every plan revision for the chat |
| `POST` | `/brain/{chat_id}/stop` | — | `{stopped: bool}` |
| `PATCH` | `/brain/{chat_id}/star` | — | `{ok: true}` |
| `PATCH` | `/brain/rename` | `{chat_id, chat_title}` | `{ok: true}` |
| `DELETE` | `/brain` | `{chat_id}` | `{ok: true}` |

**Approval/Counter/Cancel goes to the existing prompt-gate endpoint** —
NOT a Brain-specific route:

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/chats/prompts/{prompt_id}` | `{response: {decision, counter_text?}}` | 204 No Content |

The same endpoint already handles connector permission prompts. Brain
just uses a different `decision` payload shape.

### 2.1 `POST /brain/create` form fields

```ts
type CreateBrainChatForm = {
  input: string;              // required — the user's message
  persona_id?: string;        // optional UUID — apply this persona's prompt
                              // as a suffix to the Brain planner prompt
  pin_ids?: string;           // optional — JSON array of pin UUIDs
                              //   as a string, e.g. '["uuid1","uuid2"]'
  use_mistral_ocr?: boolean;  // reserved, not used in v1
};
```

Response headers on the SSE response include:
- `Content-Type: text/event-stream`
- `X-Chat-Id: <UUID>` — the new chat's id. Capture this immediately;
  you'll need it for follow-up streams and the GET endpoints.

### 2.2 `POST /brain/{chat_id}/stream` form fields

Same shape as `/create` but no need to capture `X-Chat-Id` (you already
have it). Use this for every turn after the first.

### 2.3 `POST /chats/prompts/{prompt_id}` body

```ts
type PromptResponse = {
  response: {
    decision: "approve" | "counter" | "cancel";
    counter_text?: string;    // required when decision === "counter"
  };
};
```

Other prompt kinds (e.g. connector consent) use different `response`
shapes — see §6.

---

## 3. SSE event inventory

Brain streams use the same SSE protocol as the regular chat surface: two
event shapes share the wire.

### 3.1 Named events

Wire format:
```
event: <name>\ndata: {...}\n\n
```

#### Plan lifecycle

##### `plan_proposed`
Fires the moment Opus calls `submit_plan`. **The FE renders the plan card
from this event's payload.**

```ts
type PlanProposedEvent = {
  plan_id: string;            // UUID of the BrainPlan row
  summary: string;            // 1–2 sentence headline shown as card title
  steps: PlanStep[];          // ordered list — see §4 for full shape
  required_connectors: string[]; // connector slugs the plan needs
};
```

Always paired with a `user_prompt` event (same `prompt_id` in its
metadata). FE renders the plan card body from `plan_proposed`; FE uses
the `respond_url` from `user_prompt` to POST the decision.

##### `plan_approved`
Fires when the user clicks Approve. FE locks the card to "Approved" state.
Execution events follow.

```ts
type PlanApprovedEvent = { plan_id: string };
```

##### `plan_countered`
Fires when the user counters. FE can show "Revising…" — Opus will call
`submit_plan` again shortly with a new plan_id (and a fresh
`plan_proposed` + `user_prompt`).

```ts
type PlanCounteredEvent = { plan_id: string; counter_text: string };
```

##### `plan_cancelled`
Fires when the user cancels or the prompt times out (5 min default).
The stream then closes with a one-line Opus message acknowledging.

```ts
type PlanCancelledEvent = { plan_id: string };
```

#### Step execution

These fire only for tool calls that map to an approved plan step. If
Opus calls a tool that isn't in the plan (rare; shouldn't happen if the
system prompt is followed) only the standard `tool_executing` /
`tool_complete` events fire — no step events.

##### `step_started`
Fires immediately before the tool handler runs.

```ts
type StepStartedEvent = { plan_id: string; step_id: string };
```

##### `step_completed`
Fires after the tool handler returns successfully.

```ts
type StepCompletedEvent = { plan_id: string; step_id: string };
```

##### `step_failed`
Fires when a tool handler raises. **The plan halts here** — Opus will
narrate the failure in `content` events, then `done`.

```ts
type StepFailedEvent = { plan_id: string; step_id: string; error: string };
```

#### User prompt (reused from chat surface)

##### `user_prompt`
The generic mid-stream "the model is asking the user something" event.
Carries the `prompt_id` and `respond_url` the FE uses to POST the user's
answer back. Brain uses this for plan approval AND for connector consent
mid-execution.

```ts
type UserPromptEvent = {
  prompt_id: string;          // hex UUID; included in respond_url path
  kind: "permission" | "confirm" | "choice" | "input" | "plan";
  title: string;              // headline (e.g. "Approve plan?")
  description: string;        // optional longer body (e.g. plan summary)
  options: PromptOption[];    // for choice-style kinds
  metadata: object;           // kind-specific context (see below)
  respond_url: string;        // path to POST back, e.g. "/chats/prompts/abc..."
};

type PromptOption = {
  value: string;              // "approve" | "counter" | "cancel" for plans
  label: string;              // human label
  style?: "primary" | "danger" | undefined;
};
```

How Brain uses `kind`:
- `kind: "plan"` — plan approval. Pair with the preceding `plan_proposed`
  via `metadata.plan_id`.
- `kind: "permission"` — connector consent (existing flow; see §6).

The `respond_url` is always `/chats/prompts/{prompt_id}`. The FE POSTs
`{"response": {...}}` to it.

#### Standard chat events Brain reuses

These behave identically to the main chat surface:

- `message_saved` — `{message_id: string}` — the assistant message row is
  persisted. Fires once at the very end of the stream.
- `title` — `{title: string}` — chat title auto-generated (first turn only).
- `web_search` — `{query: string, links: [...]}` — when web_search runs.
- `image` — `{url, s3_key}` — generated image.
- `generated_file` — `{url, s3_key, filename, mime_type}` — generated file.
- `tool_progress` — long-running tool progress (`elapsed_seconds`,
  `percent`, `detail`).
- `tool_connect_prompt` — connector not yet linked; FE renders a Connect
  button.

### 3.2 Inline events

Wire format (no `event:` prefix):
```
data: {"type":"<name>", ...}\n\n
```

These are the streaming LLM events — identical to the chat surface:

- `content` — `{type: "content", content: string}` — assistant text token.
  Concatenate into the assistant message body.
- `reasoning_heading` — `{type, content}` — opens a new reasoning section.
- `reasoning_body` — `{type, content}` — appends to current reasoning
  section.
- `tool_calls_streaming` — `{type, content, tool_call?}` — tool call args
  arriving live before execution. UX hint: "Calling X…".
- `tool_executing` — `{type, content, tool_call}` — tool started.
- `tool_complete` — `{type, content, tool_call}` — tool finished;
  `tool_call.result` has a string preview (≤8KB).
- `done` — `{type, usage, finish_reason, tool_calls}` — end of stream.
  Followed by `message_saved`.
- `error` — `{type, error}` — stream-level error.

---

## 4. The plan_json shape

This is the structure Brain emits in `plan_proposed.steps` and that
gets stored in the DB. The frontend renders the plan card from it.

```ts
type PlanStep = {
  // Authored by Brain at plan time:
  id: string;                 // unique within plan, e.g. "s1"
  title: string;              // one-line label rendered on the card
  description: string;        // plain English
  kind: "skill" | "connector" | "tool" | "synthesis";
  tool?: string;              // tool the step will call, e.g. "web_search"
  connector_slug?: string;    // present when kind === "connector"
  depends_on?: string[];      // ids of upstream steps
  args_preview?: object;      // advisory only, not binding

  // Mutated by the orchestrator during execution:
  status?: "pending" | "running" | "completed" | "failed";
  result_preview?: string;    // truncated tool result on completed (≤2KB)
  error?: string;             // on failed
  started_at?: string;        // ISO-8601 datetime
  completed_at?: string;
};

type PlanJson = {
  summary: string;
  steps: PlanStep[];
  required_connectors: string[];
};
```

**Critical for reload:** the execution-mutated fields (`status`,
`result_preview`, `error`, timestamps) get written back into the same
`plan_json` row in the DB as steps run. So when the user reloads mid-run
or after-run, `GET /brain/{chat_id}/messages` returns `plan_json` with
those fields populated — the frontend renders the plan card identically
to what it showed during the stream.

---

## 5. Plan-card lifecycle (FE state machine)

```
INITIAL (no plan yet)
  │
  ├─ plan_proposed received ─→ PROPOSED
  │                              │
  │                              ├─ user clicks Approve ─→ APPROVED
  │                              │   POST /chats/prompts/{id}
  │                              │   { decision: "approve" }
  │                              │     ↓
  │                              │   plan_approved received
  │                              │     ↓
  │                              │   step_started s1 → step_completed s1
  │                              │   step_started s2 → step_completed s2
  │                              │   ... or step_failed Sx → FAILED
  │                              │     ↓
  │                              │   content tokens (synthesis)
  │                              │     ↓
  │                              │   done → message_saved → DONE
  │                              │
  │                              ├─ user clicks Counter ─→ REVISING
  │                              │   POST /chats/prompts/{id}
  │                              │   { decision: "counter",
  │                              │     counter_text: "..." }
  │                              │     ↓
  │                              │   plan_countered received
  │                              │     ↓
  │                              │   wait for next plan_proposed
  │                              │     ↓
  │                              │   (replace card; back to PROPOSED)
  │                              │
  │                              └─ user clicks Cancel ─→ CANCELLED
  │                                  POST /chats/prompts/{id}
  │                                  { decision: "cancel" }
  │                                    ↓
  │                                  plan_cancelled received
  │                                    ↓
  │                                  content (acknowledgement)
  │                                    ↓
  │                                  done → message_saved → DONE
```

**Reconciling step events with the card:** maintain a `plan_id → {steps:
Map<step_id, step>}` lookup. On `step_started/completed/failed`, mutate
the step's status. Subsequent `tool_executing` / `tool_complete` events
in the same window are the actual tool execution — they fire *between*
`step_started` and `step_completed` for the same step. Use those to show
sub-progress ("Calling web_search…", "Got 8 results.") inside the row.

---

## 6. Connector consent inside a Brain run

If an approved plan needs a connector the user hasn't linked, the
existing connector consent flow fires mid-execution:

1. The step's tool handler tries to dispatch to a connector tool.
2. The connector layer emits a `user_prompt` event with
   `kind: "permission"` and `metadata.connector_slug: "gmail"` (or
   similar).
3. Backend blocks on `prompt_gate.ask_user`.
4. FE renders the consent UI (typically inline in the step row); user
   clicks Allow/Block.
5. FE POSTs `/chats/prompts/{prompt_id}` with the existing connector
   response shape (see [services/connectors/](../services/connectors/)).
6. Backend resumes; the tool either runs or returns NOT_CONNECTED.

For a connector that has zero connection at all (no OAuth set up yet),
the backend emits `tool_connect_prompt` instead — the FE renders a
Connect button that kicks off OAuth. Once the user finishes OAuth they
have to re-send their message; v1 does not auto-resume the stream.

The plan card during all this stays in `APPROVED` state with the current
step in `running`. When the connector resolves the step continues
normally.

---

## 7. Failure handling

Brain's rule: **stop on first failure, narrate, don't retry, don't skip.**

Wire trace:
```
step_started s2
tool_executing  (the failing tool)
tool_complete   (with error body in tool_call.result)
step_failed s2  { error: "..." }
content tokens  ← Opus narrates the failure in plain English
done
message_saved
```

The plan card should:
- Mark step s2 with the failed style + the error string.
- Leave subsequent steps in `pending` — they were never attempted.
- Render the final `content` synthesis as the assistant message body
  (it'll explain what went wrong and what the user can do).

The `BrainPlan.status` flips to `failed` and `final_error` is populated.

---

## 8. GET /brain/{chat_id}/messages — reload contract

This is the endpoint the FE calls when re-opening a Brain chat. Each
message arrives with its plan attached so the card re-renders
identically to the live stream.

```ts
type BrainMessage = {
  id: string;
  input: string;              // user text
  output: string;             // assistant synthesis text
  reasoning?: string;
  reasoning_sections?: ReasoningSection[];
  model_name?: string;        // typically the Opus model name
  created_at: string;         // ISO-8601
  tool_calls?: ToolCall[];    // from MessageMetadata; same shape as the
                              // chat surface
  plan?: BrainPlanResponse;   // null if this turn was answered directly
                              // (no submit_plan call)
};

type BrainPlanResponse = {
  id: string;                 // BrainPlan UUID
  status: "proposed" | "approved" | "countered" | "cancelled"
        | "executing" | "completed" | "failed";
  supersedes_id?: string;     // prior revision in the counter chain
  counter_text?: string;      // the counter the user typed for THIS revision
  plan_json: PlanJson;        // full DAG with per-step status baked in
  final_error?: string;
  created_at: string;
};
```

The `plan` field is **the latest revision** for that message. To get the
full counter history, call `GET /brain/{chat_id}/plans` (see §9).

**Reload mid-stream:** if the user reopens the tab while a stream is
still running, you'll see the BrainPlan in `proposed` or `approved`
state, with `plan_json.steps[i].status` reflecting whatever steps had
completed before the page reload. v1 does **not** resume the stream —
the user has to re-send.

---

## 9. GET /brain/{chat_id}/plans — full revision history

Returns every `BrainPlan` row for the chat, ordered by `created_at`.
Useful when the FE wants to show "Plan v1 (countered) → v2 (approved)"
trail. Default chat-messages view only shows the latest per message.

```ts
type Response = BrainPlanResponse[];
```

Each row's `supersedes_id` links to the prior revision; the row with no
`supersedes_id` is the original.

---

## 10. Wire traces

### 10.1 Happy path — single connector, single step

```
POST /brain/create  input="Search my last 5 unread emails and summarize"

event: tool_executing
data: {"type":"tool_executing","content":"submit_plan","tool_call":{...}}

event: plan_proposed
data: {"plan_id":"a1...","summary":"I'll pull your last 5 unread emails and summarize the threads.","steps":[{"id":"s1","title":"Search Gmail","kind":"connector","connector_slug":"gmail","tool":"run_connector_tool","status":"pending"}],"required_connectors":["gmail"]}

event: user_prompt
data: {"prompt_id":"b2...","kind":"plan","title":"Approve plan?","description":"I'll pull your last 5 unread emails and summarize the threads.","options":[{"value":"approve","label":"Approve","style":"primary"},{"value":"counter","label":"Counter"},{"value":"cancel","label":"Cancel","style":"danger"}],"metadata":{"plan_id":"a1..."},"respond_url":"/chats/prompts/b2..."}

[FE → POST /chats/prompts/b2... body: {"response":{"decision":"approve"}}]

event: plan_approved
data: {"plan_id":"a1..."}

event: tool_complete
data: {"type":"tool_complete","content":"submit_plan","tool_call":{"result":"{\"decision\":\"approved\"}"}}

event: step_started
data: {"plan_id":"a1...","step_id":"s1"}

event: tool_executing
data: {"type":"tool_executing","content":"run_connector_tool","tool_call":{...}}

event: tool_complete
data: {"type":"tool_complete","content":"run_connector_tool","tool_call":{"result":"...emails..."}}

event: step_completed
data: {"plan_id":"a1...","step_id":"s1"}

data: {"type":"content","content":"Here's a summary of your last 5 unread emails:\n\n"}
data: {"type":"content","content":"1. From: ..."}
...

data: {"type":"done","usage":{...},"finish_reason":"stop"}

event: message_saved
data: {"message_id":"m9..."}
```

### 10.2 Counter path

Same start as 10.1 through the `user_prompt`, then:

```
[FE → POST /chats/prompts/b2... body: {"response":{"decision":"counter","counter_text":"Only emails from this week, and don't summarize — just list them."}}]

event: plan_countered
data: {"plan_id":"a1...","counter_text":"Only emails from this week, and don't summarize — just list them."}

event: tool_complete
data: {"type":"tool_complete","content":"submit_plan","tool_call":{"result":"{\"decision\":\"countered\",\"counter_text\":\"...\"}"}}

[Opus thinks, then calls submit_plan again with the revised plan]

event: tool_executing
data: {"type":"tool_executing","content":"submit_plan","tool_call":{...}}

event: plan_proposed
data: {"plan_id":"a2...","summary":"I'll list this week's unread emails (no summary).","steps":[...],"required_connectors":["gmail"]}

event: user_prompt
data: {"prompt_id":"c3...","kind":"plan",...,"metadata":{"plan_id":"a2..."},"respond_url":"/chats/prompts/c3..."}

[user can now approve, counter again, or cancel]
```

FE should **replace** the card (don't stack two) — the new `plan_proposed`
carries a different `plan_id`. The previous card's data is preserved in
the DB for audit (`GET /brain/{chat_id}/plans`), but the live UI shows
only the active revision.

### 10.3 Failure path

```
event: plan_approved
data: {"plan_id":"a1..."}

event: step_started
data: {"plan_id":"a1...","step_id":"s2"}

event: tool_executing
data: {"type":"tool_executing","content":"run_connector_tool",...}

event: tool_complete
data: {"type":"tool_complete","content":"run_connector_tool","tool_call":{"result":"Error: Mixpanel API returned 401 unauthorized"}}

event: step_failed
data: {"plan_id":"a1...","step_id":"s2","error":"Error: Mixpanel API returned 401 unauthorized"}

data: {"type":"content","content":"I couldn't fetch the Mixpanel events — looks like the API key needs a refresh. "}
data: {"type":"content","content":"Open Settings → Connectors → Mixpanel and reconnect, then resend."}

data: {"type":"done","usage":{...},"finish_reason":"stop"}

event: message_saved
data: {"message_id":"m9..."}
```

The plan card visually:
- s1: completed (green)
- s2: **failed** (red, with error inline)
- s3, s4, ...: pending (greyed out, "not attempted")

`BrainPlan.status` in the DB is `failed`. The assistant message body is
the synthesis content explaining the failure.

### 10.4 Cancellation

```
event: plan_proposed
data: {...}

event: user_prompt
data: {...}

[FE → POST /chats/prompts/b2... body: {"response":{"decision":"cancel"}}]

event: plan_cancelled
data: {"plan_id":"a1..."}

event: tool_complete
data: {"type":"tool_complete","content":"submit_plan","tool_call":{"result":"{\"decision\":\"cancelled\"}"}}

data: {"type":"content","content":"Cancelled. Let me know when you'd like to revisit."}

data: {"type":"done","usage":{...}}

event: message_saved
data: {"message_id":"m9..."}
```

### 10.5 Trivial answer (no plan)

```
POST /brain/create  input="What is 2+2?"

[no submit_plan call]

data: {"type":"content","content":"4."}

data: {"type":"done",...}

event: message_saved
data: {"message_id":"m9..."}
```

No plan card, no approval gate. The FE just renders the content like
normal chat. `plan` in the GET response will be `null` for this message.

---

## 11. Edge cases & gotchas

### 11.1 Timeout on user_prompt

`prompt_gate.ask_user` has a 300-second timeout. If the user walks away
without responding:
- Backend treats it as **cancel**.
- Emits `plan_cancelled`.
- Opus narrates a short cancellation.
- Stream closes normally.

The FE should re-enable the input box on `plan_cancelled` regardless of
whether the user clicked Cancel or just timed out.

### 11.2 Multiple plan revisions in one turn

A user can Counter as many times as they want before Approving. Each
counter creates a new `BrainPlan` row linked via `supersedes_id`. They
all share the same `message_id` because they all belong to the same
assistant turn. The live UI shows only the active revision; the audit
endpoint shows the chain.

### 11.3 Step events without matching plan steps

If Opus calls a tool that wasn't in the plan (e.g. uses `web_search`
mid-synthesis even though it wasn't a step), no `step_*` events fire —
only the standard inline `tool_executing` / `tool_complete`. Render
those as a small inline indicator outside the plan card.

### 11.4 The plan card itself is mutable during the stream

`plan_json.steps[i].status` and friends are updated in the DB as the
stream runs. If the user reloads mid-stream, GET returns the latest
state — but the live SSE on the original page also keeps going. Don't
try to reconcile both; pick one source (typically the live stream while
the tab is open, the GET payload on reload).

### 11.5 `tool_executing` for submit_plan

The `submit_plan` tool fires `tool_executing` + `tool_complete` like
every other tool. The FE should typically **not** show those in the UI
— the `plan_proposed` and `plan_approved/countered/cancelled` events
are the user-visible signal. Suppress raw `submit_plan` tool events.

### 11.6 Chat-level operations

Renaming, starring, deleting, and stopping a Brain chat use the
endpoints in §2. They work the same as the regular `/chats/*`
equivalents.

### 11.7 Persona override

Pass `persona_id` on create/stream form. The persona's prompt is
**appended** to the Brain planner prompt (it does not replace it — the
plan/approval gate still applies, persona just shapes synthesis voice).

### 11.8 Pins

Pass `pin_ids` as a JSON-encoded array in the form. Pin contents are
injected into the system prompt at turn start. Pins are NOT shown to
the user mid-stream; they're invisible context.

---

## 12. TypeScript type bundle

Copy-paste into a `brain-types.ts` shared module:

```ts
// ── HTTP request shapes ────────────────────────────────────────────
export interface CreateBrainChatForm {
  input: string;
  persona_id?: string;
  pin_ids?: string;           // JSON-encoded UUID array
  use_mistral_ocr?: boolean;
}

export type SendBrainMessageForm = CreateBrainChatForm;

export interface PromptResponseBody {
  response:
    | { decision: "approve" }
    | { decision: "counter"; counter_text: string }
    | { decision: "cancel" };
}

// ── Plan ──────────────────────────────────────────────────────────
export interface PlanStep {
  id: string;
  title: string;
  description?: string;
  kind: "skill" | "connector" | "tool" | "synthesis";
  tool?: string;
  connector_slug?: string;
  depends_on?: string[];
  args_preview?: Record<string, unknown>;
  status?: "pending" | "running" | "completed" | "failed";
  result_preview?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
}

export interface PlanJson {
  summary: string;
  steps: PlanStep[];
  required_connectors: string[];
}

// ── SSE named-event payloads ──────────────────────────────────────
export interface PlanProposedEvent {
  plan_id: string;
  summary: string;
  steps: PlanStep[];
  required_connectors: string[];
}
export interface PlanApprovedEvent  { plan_id: string }
export interface PlanCounteredEvent { plan_id: string; counter_text: string }
export interface PlanCancelledEvent { plan_id: string }

export interface StepStartedEvent   { plan_id: string; step_id: string }
export interface StepCompletedEvent { plan_id: string; step_id: string }
export interface StepFailedEvent    { plan_id: string; step_id: string; error: string }

export interface UserPromptEvent {
  prompt_id: string;
  kind: "permission" | "confirm" | "choice" | "input" | "plan";
  title: string;
  description: string;
  options: { value: string; label: string; style?: "primary" | "danger" }[];
  metadata: Record<string, unknown>;
  respond_url: string;
}

export interface MessageSavedEvent { message_id: string }
export interface TitleEvent { title: string }

// ── SSE inline-event payloads ─────────────────────────────────────
export interface ContentEvent  { type: "content"; content: string }
export interface DoneEvent     { type: "done"; usage?: object; finish_reason?: string; tool_calls?: object[] }
export interface ErrorEvent    { type: "error"; error: string }
export interface ToolExecutingEvent { type: "tool_executing"; content: string; tool_call: { name: string; arguments?: object } }
export interface ToolCompleteEvent  { type: "tool_complete";  content: string; tool_call: { name: string; result?: string } }

// ── GET response shapes ───────────────────────────────────────────
export interface BrainChatListItem {
  chat_id: string;
  chat_title: string;
  starred: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrainPlanResponse {
  id: string;
  status: "proposed" | "approved" | "countered" | "cancelled"
        | "executing" | "completed" | "failed";
  supersedes_id?: string;
  counter_text?: string;
  plan_json: PlanJson;
  final_error?: string;
  created_at: string;
}

export interface BrainMessage {
  id: string;
  input: string;
  output: string;
  reasoning?: string;
  reasoning_sections?: unknown[];
  model_name?: string;
  created_at: string;
  tool_calls?: unknown[];
  plan: BrainPlanResponse | null;
}
```

---

## 13. SSE consumer skeleton (browser EventSource won't work — POST body required)

Browsers' `EventSource` doesn't support `POST`. For the Brain SSE
endpoints you'll need `fetch` + manual chunked parsing or a small SSE
library that supports POST (e.g. `@microsoft/fetch-event-source`).

Sketch with `fetch` + a custom parser:

```ts
async function streamBrain(
  url: string,
  formData: FormData,
  jwt: string,
  on: {
    onNamed: (name: string, data: any) => void;
    onInline: (data: any) => void;
    onClose?: () => void;
    onError?: (e: Error) => void;
  },
) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: formData,
  });
  if (!res.ok || !res.body) {
    on.onError?.(new Error(`HTTP ${res.status}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      // Each block is "event: <name>\ndata: <json>" or just "data: <json>"
      const lines = raw.split("\n");
      let eventName = "";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventName = line.slice(7).trim();
        else if (line.startsWith("data: ")) dataStr += line.slice(6);
      }
      if (!dataStr) continue;
      let data: any;
      try { data = JSON.parse(dataStr); } catch { continue; }

      if (eventName) on.onNamed(eventName, data);
      else on.onInline(data);
    }
  }
  on.onClose?.();
}
```

Usage:

```ts
const fd = new FormData();
fd.append("input", "Pull my last 5 unread emails and summarize");

streamBrain("/brain/create", fd, jwt, {
  onNamed: (name, data) => {
    switch (name) {
      case "plan_proposed":   renderPlanCard(data);            break;
      case "user_prompt":     attachRespondUrl(data);          break;
      case "plan_approved":   markPlanApproved(data.plan_id);  break;
      case "plan_countered":  showRevising(data);              break;
      case "plan_cancelled":  closePlanCard(data.plan_id);     break;
      case "step_started":    setStepStatus(data, "running");  break;
      case "step_completed":  setStepStatus(data, "completed");break;
      case "step_failed":     setStepStatus(data, "failed", data.error); break;
      case "message_saved":   commitMessage(data.message_id);  break;
      case "tool_progress":   showProgress(data);              break;
      case "title":           setChatTitle(data.title);        break;
      case "web_search":      noteWebSearch(data);             break;
    }
  },
  onInline: (data) => {
    if (data.type === "content")  appendAssistantText(data.content);
    if (data.type === "done")     finishStream(data);
    if (data.type === "error")    showStreamError(data.error);
    // Suppress tool_executing/tool_complete for the submit_plan tool
    // (the plan_proposed event is the user-visible signal there).
    if (data.type === "tool_executing" && data.content === "submit_plan") return;
    if (data.type === "tool_complete"  && data.content === "submit_plan") return;
  },
});
```

POSTing the user's plan decision:

```ts
async function respondToPrompt(
  promptId: string,
  body: PromptResponseBody,
  jwt: string,
) {
  await fetch(`/chats/prompts/${promptId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  // Backend returns 204; no body. The next SSE events on the active
  // stream will carry the result of this decision.
}
```

---

## 14. Quick reference card

| When you see this SSE event | Update plan card to |
|---|---|
| `plan_proposed` | render new card (replace if revising) |
| `plan_approved` | lock buttons; show "Executing" |
| `plan_countered` | show "Revising…" loading state |
| `plan_cancelled` | close card; show cancellation text |
| `step_started` | step row → running |
| `step_completed` | step row → completed |
| `step_failed` | step row → failed; keep later steps as pending |
| `tool_executing` (non-submit_plan) | optional inline progress text |
| `tool_complete` (non-submit_plan) | optional inline result preview |
| `tool_progress` | optional progress bar in step row |
| `tool_connect_prompt` | render Connect button for missing connector |
| `user_prompt` kind=plan | the approval question — show Approve/Counter/Cancel |
| `user_prompt` kind=permission | connector consent — show Allow/Block |
| `message_saved` | commit the assistant message to history |
| `done` | stream finished |
| inline `content` | append to assistant message text |

Backend reference files (read these when debugging):
- [services/brain/orchestrator.py](../services/brain/orchestrator.py)
- [services/brain/router.py](../services/brain/router.py)
- [services/brain/planner_tools.py](../services/brain/planner_tools.py)
- [core/sse_schemas.py](../core/sse_schemas.py)
- [core/prompt_gate.py](../core/prompt_gate.py)
- [core/prompts/brain.yaml](../core/prompts/brain.yaml)
