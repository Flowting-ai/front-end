# API Documentation

Base URL: `http://localhost:8000` (override with `NEXT_PUBLIC_BACKEND_URL` in the frontend).

All requests should send and receive JSON (`Content-Type: application/json`) and include cookies (`credentials: include`). Mutating requests require the CSRF header shown below.

- Auth: Session cookies + CSRF. Obtain a CSRF token from `GET /login/` (or `/signup/`) and send it as `X-CSRFToken` on every non-GET request.
- Errors: JSON responses typically include one of `detail`, `message`, or `error`. See the error reference table below.

## Endpoint Summary (18 total paths)

| # | Method(s) | Path | Purpose |
|---|-----------|------|---------|
| 1 | GET, POST | /login/ | Get CSRF token and authenticate |
| 2 | GET, POST | /signup/ | User registration |
| 3 | GET | /chats/ | List chats |
| 4 | POST | /chats/ | Create chat (with first message) |
| 5 | GET | /chats/{chatId}/ | Chat details |
| 6 | DELETE | /chats/{chatId}/ | Delete chat |
| 7 | GET | /chats/{chatId}/messages/ | List messages in a chat |
| 8 | POST | /chat/ | Send message (supports streaming) |
| 9 | DELETE | /chats/{chatId}/messages/{messageId}/ | Delete a message and following |
| 10 | PATCH, DELETE | /chats/{chatId}/messages/{messageId}/reaction/ | Add or remove emoji reaction |
| 11 | GET | /chats/{chatId}/pins/ | List pins for a chat |
| 12 | POST | /chats/{chatId}/pins/ | Pin/bookmark a message |
| 13 | DELETE | /pins/{pinId}/ | Delete a pin |
| 14 | POST | /documents/ | Upload document for RAG |
| 15 | GET | /documents/search/ | Semantic search within documents |
| 16 | POST | /generate-image/ | Text-to-image generation |
| 17 | GET | /tokens/ | Token balance |
| 18 | GET | /get_models | List available LLM models |

## Common Response Shapes

```json
// Success (example)
{
  "data": { /* resource */ },
  "csrfToken": "string",          // sometimes returned for convenience
  "message": "optional info"
}

// Error (examples)
{ "detail": "Reason" }
{ "message": "Reason" }
{ "error": "Reason" }
{ "errors": { "field": ["msg"] } }
```

## Authentication

### GET /login/
- Purpose: Retrieve CSRF token and current session (if any).
- Headers: none required.
- Response 200:
  ```json
  { "csrfToken": "abc123", "user": { "id": 1, "email": "user@example.com", "name": "Ada" } }
  ```
- Errors: 500 (server unavailable).

cURL:
```bash
curl -i http://localhost:8000/login/
```

### POST /login/
- Purpose: Authenticate with username/password.
- Headers: `Content-Type: application/json`, `X-CSRFToken`.
- Body:
  ```json
  { "username": "ada", "password": "correcthorsebatterystaple" }
  ```
- Response 200:
  ```json
  {
    "user": { "id": 1, "email": "ada@example.com", "name": "Ada" },
    "csrfToken": "abc123"
  }
  ```
- Errors: 400 (missing fields), 401 (invalid credentials), 403 (CSRF missing/invalid), 429 (too many attempts).

JS fetch:
```js
const csrf = await (await fetch("/login/")).json();
const loginResp = await fetch("/login/", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json", "X-CSRFToken": csrf.csrfToken },
  body: JSON.stringify({ username, password }),
});
```

### GET /signup/
- Purpose: CSRF seed for registration.
- Response 200:
  ```json
  { "csrfToken": "abc123" }
  ```

### POST /signup/
- Purpose: Create an account and authenticate.
- Headers: `Content-Type: application/json`, `X-CSRFToken`.
- Body (all fields string):
  ```json
  { "username": "ada", "email": "ada@example.com", "password": "..." }
  ```
- Response 201:
  ```json
  { "user": { "id": 1, "email": "ada@example.com", "name": "Ada" }, "csrfToken": "abc123" }
  ```
- Errors: 400 (validation), 409 (username/email exists), 403 (CSRF), 429 (rate limited).

## Chats

### GET /chats/
- Purpose: List chats for the authenticated user.
- Query: optional `page`, `page_size`.
- Response 200:
  ```json
  [
    { "id": "c1", "title": "Research notes", "updated_at": "2024-01-01T00:00:00Z", "pin_count": 2 }
  ]
  ```
  May also return `{ "results": [...], "csrfToken": "..." }`.
- Errors: 401 (not logged in).

### POST /chats/
- Purpose: Create a chat; optionally send the first message in one call.
- Headers: `X-CSRFToken`.
- Body:
  ```json
  {
    "title": "Weekly sync",
    "firstMessage": "Draft an agenda",
    "model": { "companyName": "openai", "modelName": "gpt-4o", "version": "1" },
    "user": { "id": 1, "email": "ada@example.com", "name": "Ada" }
  }
  ```
- Response 201:
  ```json
  {
    "chat": { "id": "c1", "title": "Weekly sync", "created_at": "2024-01-01T00:00:00Z" },
    "initialResponse": "Here is an agenda...",
    "initialMessageId": "m-uuid",
    "csrfToken": "abc123"
  }
  ```
- Errors: 400 (missing `firstMessage`), 401/403 (auth or CSRF), 429 (rate limited).

### GET /chats/{chatId}/
- Purpose: Retrieve chat metadata (title, timestamps, counts).
- Path: `chatId` (UUID or int).
- Response 200:
  ```json
  { "id": "c1", "title": "Weekly sync", "updated_at": "2024-01-01T00:00:00Z", "pin_count": 3 }
  ```
- Errors: 404 (not found), 403 (forbidden).

### DELETE /chats/{chatId}/
- Purpose: Delete a chat and all messages.
- Headers: `X-CSRFToken`.
- Response 200:
  ```json
  { "message": "Chat deleted" }
  ```
- Errors: 404 (chat missing), 403 (forbidden/CSRF).

## Messages

### GET /chats/{chatId}/messages/
- Purpose: List messages in a chat.
- Response 200:
  ```json
  [
    {
      "id": "m1",
      "sender": "user",
      "content": "Hi",
      "chat": "c1",
      "model_name": "gpt-4o",
      "provider_name": "openai",
      "input_tokens": 12,
      "output_tokens": 56,
      "created_at": "2024-01-01T00:00:00Z",
      "is_pinned": false
    }
  ]
  ```
- Errors: 404 (chat not found), 401/403.

### POST /chat/
- Purpose: Send a prompt and receive an AI message. Supports streaming (SSE) or non-streaming JSON.
- Headers: `X-CSRFToken`.
- Body (non-streaming):
  ```json
  {
    "prompt": "Explain transformers",
    "chatId": "c1",
    "model": { "companyName": "openai", "modelName": "gpt-4o", "version": "1" },
    "user": { "id": 1, "email": "ada@example.com", "name": "Ada" },
    "referencedMessageId": "m0",          // optional (reply threading)
    "regenerateMessageId": "m1",          // optional (retry a previous turn)
    "userMessageId": "m1-user",           // optional (frontend id to bind backend id)
    "pinIds": ["pin-1", "pin-2"]          // optional (include pinned context)
  }
  ```
- JSON Response 200 (non-streaming):
  ```json
  {
    "message": "Transformers use attention...",
    "messageId": "m2",
    "metadata": {
      "modelName": "gpt-4o",
      "providerName": "openai",
      "inputTokens": 120,
      "outputTokens": 256,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  }
  ```
- Streaming (SSE) request: `GET /chat/?stream=true&prompt=Hello&chatId=c1&referencedMessageId=m0&pinIds=pin-1,pin-2`
  - Headers: `Accept: text/event-stream`
  - Event payloads:
    ```
    data: {"chunk": "Hello"}
    data: {"chunk": " world"}
    data: {"done": true, "messageId": "uuid"}
    ```
- Disambiguation response example:
  ```json
  {
    "disambiguation": true,
    "options": [
      { "index": 1, "label": "HW7 – Problem 1" },
      { "index": 2, "label": "HW6 – Problem 1" }
    ],
    "messageId": "m2"
  }
  ```
- Errors: 400 (missing prompt/chatId), 401/403, 404 (chat missing), 409 (chat locked), 429 (rate limited), 500 (model failure).

cURL (non-streaming):
```bash
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -H "X-CSRFToken: $CSRF" \
  -b "csrftoken=$CSRF" \
  -d '{"prompt":"Hi","chatId":"c1"}'
```

JS streaming example:
```js
const es = new EventSource(`/chat/?stream=true&prompt=${encodeURIComponent(prompt)}&chatId=${chatId}`);
es.onmessage = (evt) => {
  const data = JSON.parse(evt.data);
  if (data.chunk) appendToUI(data.chunk);
  if (data.done) { saveMessageId(data.messageId); es.close(); }
};
```

### DELETE /chats/{chatId}/messages/{messageId}/
- Purpose: Delete a message and all following messages in that chat (branching behavior).
- Headers: `X-CSRFToken`.
- Response 200:
  ```json
  {
    "deleted_count": 3,
    "deleted_message_ids": ["m2", "m3", "m4"],
    "message": "Deleted follow-up messages"
  }
  ```
- Errors: 404 (chat/message not found), 403/401.
- cURL:
  ```bash
  curl -X DELETE http://localhost:8000/chats/c1/messages/m2/ \
    -H "X-CSRFToken: $CSRF" -b "csrftoken=$CSRF"
  ```

### PATCH /chats/{chatId}/messages/{messageId}/reaction/
- Purpose: Add an emoji reaction (8 supported).
- Headers: `X-CSRFToken`.
- Body:
  ```json
  { "reaction": "👍" }
  ```
- Response 200:
  ```json
  { "messageId": "m2", "reaction": "👍", "userId": 1 }
  ```
- Errors: 400 (invalid reaction), 404, 403/401.
- JS fetch:
  ```js
  await fetch(`/chats/${chatId}/messages/${messageId}/reaction/`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: JSON.stringify({ reaction: "👍" }),
  });
  ```

### DELETE /chats/{chatId}/messages/{messageId}/reaction/
- Purpose: Remove a reaction.
- Headers: `X-CSRFToken`.
- Response 200:
  ```json
  { "message": "Reaction removed", "messageId": "m2" }
  ```
- Errors: 404, 403/401.
- cURL:
  ```bash
  curl -X DELETE http://localhost:8000/chats/c1/messages/m2/reaction/ \
    -H "X-CSRFToken: $CSRF" -b "csrftoken=$CSRF"
  ```

## Pins

### GET /chats/{chatId}/pins/
- Purpose: List pins for the chat.
- Response 200:
  ```json
  [
    { "id": "pin-1", "chat": "c1", "content": "Key insight...", "created_at": "2024-01-01T00:00:00Z" }
  ]
  ```
- Errors: 404 (chat not found), 401/403.
- JS fetch:
  ```js
  const pins = await (await fetch(`/chats/${chatId}/pins/`, { credentials: "include" })).json();
  ```

### POST /chats/{chatId}/pins/
- Purpose: Bookmark a message (or arbitrary content) in a chat.
- Headers: `X-CSRFToken`.
- Body:
  ```json
  { "messageId": "m2", "content": "Key insight to revisit" }
  ```
- Response 201:
  ```json
  { "id": "pin-1", "chat": "c1", "messageId": "m2", "content": "Key insight to revisit", "created_at": "2024-01-01T00:00:00Z" }
  ```
- Errors: 400 (missing messageId/content), 404 (chat/message), 403/401.
- cURL:
  ```bash
  curl -X POST http://localhost:8000/chats/c1/pins/ \
    -H "Content-Type: application/json" -H "X-CSRFToken: $CSRF" -b "csrftoken=$CSRF" \
    -d '{"messageId":"m2","content":"Key insight to revisit"}'
  ```

### DELETE /pins/{pinId}/
- Purpose: Remove a pin.
- Headers: `X-CSRFToken`.
- Response 200: `{ "message": "Pin deleted" }`
- Errors: 404, 403/401.
- JS fetch:
  ```js
  await fetch(`/pins/${pinId}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": csrf },
  });
  ```

## Documents / RAG

### POST /documents/
- Purpose: Upload a document, chunk it, and attach it to a chat.
- Headers: `X-CSRFToken`.
- Body:
  ```json
  {
    "chatId": "c1",
    "documentName": "assignment.pdf",
    "sourceUrl": "https://university.edu/assignment.pdf",
    "text": "Document plain text fallback",
    "fileContent": "BASE64_STRING"
  }
  ```
- Response 201:
  ```json
  {
    "documentId": "doc-123",
    "fileLink": "/media/documents/doc-123.pdf",
    "chunkCount": 42,
    "message": "Uploaded"
  }
  ```
- Errors: 400 (invalid/missing file), 401/403, 413 (file too large), 415 (unsupported type), 429 (rate limited).

### GET /documents/search/
- Purpose: Semantic search over uploaded documents.
- Query params:
  - `query` (required): search text.
  - `chatId` (optional): restrict to a chat.
  - `topK` (optional int): number of results (default 5).
- Response 200:
  ```json
  {
    "query": "problem 1",
    "results": [
      {
        "documentId": "doc-123",
        "chunkId": "chunk-9",
        "score": 0.82,
        "snippet": "Solution for problem 1...",
        "sourceUrl": "https://university.edu/assignment.pdf"
      }
    ]
  }
  ```
- Errors: 400 (missing query), 401/403.
- JS fetch:
  ```js
  const search = await fetch(`/documents/search/?query=${encodeURIComponent(q)}&chatId=${chatId}`, {
    credentials: "include",
  }).then(r => r.json());
  ```

## Image Generation

### POST /generate-image/
- Purpose: Generate an image from text; optionally tie to a chat.
- Headers: `X-CSRFToken`.
- Body:
  ```json
  { "prompt": "astronaut riding a horse", "chatId": "c1", "width": 1024, "height": 1024 }
  ```
- Response 200:
  ```json
  { "imageUrl": "/media/images/uuid.png", "jobId": "img-uuid" }
  ```
- Errors: 400 (bad prompt/params), 401/403, 429 (rate limited), 500 (model error).
- cURL:
  ```bash
  curl -X POST http://localhost:8000/generate-image/ \
    -H "Content-Type: application/json" -H "X-CSRFToken: $CSRF" -b "csrftoken=$CSRF" \
    -d '{"prompt":"astronaut riding a horse","chatId":"c1"}'
  ```
- JS fetch:
  ```js
  const img = await fetch("/generate-image/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": csrf },
    body: JSON.stringify({ prompt: "astronaut riding a horse", chatId }),
  }).then(r => r.json());
  ```

## Tokens

### GET /tokens/
- Purpose: Retrieve token usage and balance.
- Response 200:
  ```json
  { "availableTokens": 12000, "totalTokensUsed": 8000 }
  ```
- Errors: 401/403.
- JS fetch:
  ```js
  const tokens = await fetch("/tokens/", { credentials: "include" }).then(r => r.json());
  ```

## Models

### GET /get_models
- Purpose: List available LLM models.
- Response 200:
  ```json
  [
    {
      "companyName": "openai",
      "modelName": "gpt-4o",
      "version": "1",
      "modelType": "paid",
      "inputLimit": 200000,
      "outputLimit": 8000
    }
  ]
  ```
- Errors: 500 (catalog unavailable).
- cURL:
  ```bash
  curl http://localhost:8000/get_models
  ```

## Common Workflows

1) **Login + CSRF bootstrap**
- `GET /login/` -> store `csrfToken`.
- `POST /login/` with `X-CSRFToken` -> receive `user` + refreshed CSRF, keep cookies (`credentials: include`).

2) **Start a chat with the first AI reply**
- `POST /chats/` with `firstMessage` and `model`.
- Use `initialResponse` + `initialMessageId` to render the first assistant message without a separate `/chat/` call.

3) **Send follow-up with streaming + disambiguation handling**
- Open `EventSource` on `/chat/?stream=true&prompt=...&chatId=...`.
- Concatenate `chunk` fields. On `{done:true,messageId}` close the stream.
- If you receive `{disambiguation:true, options:[...]}`, present options and resend to `/chat/` with the chosen `index` in the prompt or as a follow-up payload.

4) **Reply to a specific message and include pins**
- `POST /chat/` body with `referencedMessageId` and `pinIds`.
- UI should display the referenced bubble (WhatsApp-style) and resolve pins from `/chats/{chatId}/pins/`.

5) **Upload a document then search and ask**
- `POST /documents/` with base64 content and `chatId`.
- `GET /documents/search/?chatId=c1&query=problem%201`.
- Send the search result snippets back to `/chat/` (e.g., include in `prompt` or as context text).

6) **Emoji reactions and pinning**
- `PATCH /chats/{chatId}/messages/{messageId}/reaction/` with `{reaction:"👍"}`.
- `POST /chats/{chatId}/pins/` with `{messageId:"m2",content:"..."}` to bookmark.

7) **Delete a branch**
- `DELETE /chats/{chatId}/messages/{messageId}/` to remove the message and all that follow; update UI with `deleted_message_ids`.

8) **Generate an image in-chat**
- `POST /generate-image/` with `{prompt, chatId}` and render the returned `imageUrl` in the transcript.

## Error Reference

| Code | Meaning | Typical Fix |
|------|---------|-------------|
| 400 | Validation failed | Check required fields and JSON structure |
| 401 | Not authenticated | Login and resend with cookies |
| 403 | CSRF or forbidden | Ensure `X-CSRFToken` and `credentials: include` |
| 404 | Resource not found | Verify `chatId`, `messageId`, `pinId` |
| 409 | Conflict (e.g., duplicate signup, locked chat) | Adjust request or retry |
| 413 | Payload too large | Reduce file size or prompt length |
| 415 | Unsupported media type | Send allowed file types/base64 |
| 429 | Rate limited | Back off and retry |
| 500 | Server/model error | Retry or switch model |

## Troubleshooting

- **Missing CSRF**: Always call `GET /login/` (or `/signup/`) first and send `X-CSRFToken` on non-GET requests with `credentials: include`.
- **Streaming stalls**: Ensure `Accept: text/event-stream`, use HTTPS keep-alive, and avoid proxies buffering SSE.
- **Disambiguation loops**: When `disambiguation:true` appears, ask the user to pick an `option.index` and resend the clarified prompt.
- **Deleted message gaps**: After `DELETE /chats/{chatId}/messages/{messageId}/`, remove all ids in `deleted_message_ids` from local state and unpin any affected pins.
- **Large files**: If a document upload fails, try sending `text` only (plaintext) or a smaller `fileContent`.
