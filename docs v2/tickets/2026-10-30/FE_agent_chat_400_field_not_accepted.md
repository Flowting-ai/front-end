# FE: sending a message with an agent attached fails with 400

**Date:** 2026-10-30 · **Owner:** front-end · **Branch:** `main` (production)

## Symptom

Attach an agent to a chat with **+ → Add agent**, then send a prompt. The send fails with:

```json
{ "code": "bad_request", "message": "This request has a field that isn't accepted.", "requestId": "725176bd4201" }
```

## Cause

When an agent is selected, the chat send adds the agent's `system_prompt` and `temperature` to the form. Since 19 Oct the backend returns `400 bad_request` for any field missing from its accepted list on `/chats/create` and `/chats/{id}/stream`. Those two fields aren't on it. The backend reads the agent's settings from `persona_id`, which it accepts.

On a deployed site the browser posts straight to the backend (`useDirectBackend` in `src/hooks/use-streaming-chat.ts`), so nothing removes the fields. On localhost the `/api/chat` proxy forwarded them too.

Confirmed live on 2026-10-30 against devapi with the ADMIN account, using the agent "Research Assistant" (version `8e035240-…`):

| `POST /chats/create` body | Result |
|---|---|
| `input`, `persona_id` | 200 |
| … + `system_prompt` | 400 field isn't accepted |
| … + `temperature` | 400 field isn't accepted |

## Fix

The changes below stop the front end from sending `system_prompt` and `temperature`. `persona_id` is still sent.

- `src/hooks/use-streaming-chat.ts`: the direct-to-backend body no longer adds `system_prompt` or `temperature`.
- `src/app/api/chat/route.ts`: the proxy no longer reads or forwards `systemPrompt` or `temperature`.

This is scoped to those two fields. Other fields the direct path sends (`web_search`, `tone_id`) were not tested against the production backend and are unchanged.

## Retest

1. On the deployed site, go to **New chat → + → Add agent**, pick an agent, and send a prompt. Expect a streamed reply with no 400.
2. Send a follow-up in the same chat. Expect a reply.
3. Check that the reply follows the agent's instructions. If it doesn't, the backend is not applying the agent from `persona_id`, and that needs a backend ticket.

## Notes

- `ds-dev` already fixes this in another way. `keepAcceptedFields()` in `src/lib/chat-form-fields.ts` filters every send against the backend's field list. Merging `ds-dev` into `main` will replace this patch.
- `ds-dev` sends `persona_id` only when `NEXT_PUBLIC_ENABLE_AGENT_CHAT=true`. The dev backend accepts `persona_id` again (version id; a repo id gives 404), so the flag can be turned on.
