# BE: Every chat message fails, `MCPTools` called with removed `sandboxId` argument

**Severity:** Critical. No chat turn completes on devapi (new or existing chats).
**Introduced by:** `2b22bd25` "Integrate CodeSandbox into MCPTools and related components…" (2026-11-05)

## What happens
- `POST /chats/{chat_id}/stream` returns a bare `500 Internal Server Error` (text/plain, no `X-Turn-Id`).
- `POST /chats/create` returns 200 but the stream ends with:
  `RUN_ERROR "MCPTools.__init__() got an unexpected keyword argument 'sandboxId'. Did you mean 'sandbox'?"` (code `guarded_stream`)

## Repro (devapi, no frontend involved)
```
POST https://devapi.getsouvenir.com/chats/<owned chat id>/stream
Authorization: Bearer <token>
Content-Type: multipart/form-data
input=hello
-> 500 Internal Server Error
```
Seen on chats `062a9180-907c-402a-a7f0-6519143697e8`, `45bba7e1-559f-4da9-b399-444cc11393ef`, `878beac6-23aa-4765-81f4-d21541fad9d2` (2026-11-05).

## Cause
`2b22bd25` changed `MCPTools.__init__` (`services/connectors/mcp/builtin.py:75-78`) from `sandboxId: str` to `sandbox: CodeSandbox | None`. The chat callers were not updated:
- `services/chat/chat.py:710`: `MCPTools("souvenir", self.userId, allowedSlugs=allowedSlugs, sandboxId=audioSandboxId)`
- `services/chat/chat.py:733`: `MCPTools("souvenir", self.userId, agentsEnabled=True, allowedSlugs=allowedSlugs, sandboxId=audioSandboxId)`

The stream route awaits `chat.send(...)` before returning the `StreamingResponse`, so the TypeError becomes a plain 500. On `/chats/create` the send runs inside the stream, so it shows up as `RUN_ERROR`.

## Suggested fix
In `services/chat/chat.py` around 639-643, keep the `CodeSandbox` object instead of `.sandbox_id`:
```python
audioSandbox = None
if any(isAudioFile(file.name, file.mime_type) for file in workspace.files.values()):
    audioSandbox = CodeSandbox(sandboxSession.sessionId, userId=sandboxSession.userId, chatId=sandboxSession.chatId)
    await prepareTree(sandboxSession, audioSandbox)
```
and pass `sandbox=audioSandbox` at lines 710 and 733 (same pattern as `services/slack/toolset.py:197`).

## Also worth doing
- Add a test that runs a chat turn through `Chat.send` so a signature change like this fails CI.
- Consider returning a JSON error body (with request id) instead of a bare 500 from `/chats/{id}/stream` when setup fails.

## Acceptance
- `POST /chats/{id}/stream` with `input=hello` streams a reply.
- `POST /chats/create` finishes without `RUN_ERROR`.
- A turn with an audio attachment still transcribes.
