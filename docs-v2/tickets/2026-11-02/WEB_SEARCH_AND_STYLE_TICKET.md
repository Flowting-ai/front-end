# Backend ticket: chat fields for Web search and Use style

**Date:** 2026-11-02
**Repo:** souvenir-server, branch `Development` (checked at `241db28f`)
**Asked by:** front-end
**Blocks:** the composer's **Web search** switch and **Use style** menu (both hidden in the app today)

## Summary

The chat composer has two controls the backend no longer reads, so the front end hides them:

| Control | Field the front end sends | Backend today |
|---|---|---|
| Web search switch | `web_search` | Not read since `aa934dfe` (2 Oct, "Refactor web search functionality"). The model decides on its own when to search. |
| Use style menu | `tone_id` | Not read. |

Neither field is in `CREATE_FIELDS` / `STREAM_FIELDS` in `services/chat/router.py`. The chat endpoints refuse fields outside those sets, so the front-end proxy (`src/app/api/chat/route.ts`, `keepAcceptedFields`) strips both before forwarding. Showing the controls would let people change settings that do nothing.

We'd like both fields accepted and honoured on `POST /chats/create` and `POST /chats/{chat_id}/stream`.

## R1: `web_search`

**Shape:** multipart form field `web_search`, string `"true"`. It is only sent when the switch is on; no field means "off" (same convention as today's other optional flags).

**Wanted behaviour:**
- `"true"`: the model may search the web for this turn (today's behaviour).
- Field absent: the model does not search the web for this turn.

If the product decision is that search stays automatic and can't be turned off, tell us and we'll remove the switch from the design instead.

**Per turn, not per chat.** The switch is in the composer and can change between messages, so it should apply to the turn it's sent with.

## R2: `tone_id`

**Shape:** multipart form field `tone_id`, string, max 50 characters. It is sent only when a style other than None is picked.

**Values** (from `front-end/src/lib/tone-options.ts`):

| `tone_id` | Label | Meaning shown to the user |
|---|---|---|
| `professional` | Professional | Polished, structured, business-ready |
| `balanced` | Balanced | Friendly yet professional |
| `casual` | Casual | Relaxed and conversational |
| `witty` | Witty | Sharp, clever, playful |
| `concise` | Concise | Short, direct, no fluff |
| `executive` | Executive | Strategic, decision-oriented |
| `academic` | Academic | Scholarly, precise, well-cited |
| `creative` | Creative | Imaginative and unconventional |
| `teaching` | Teaching | Step-by-step, builds understanding |
| `socratic` | Socratic | Guides through questions |
| `empathetic` | Empathetic | Warm, supportive, emotionally aware |

`none` (Default AI behavior) is never sent.

**Wanted behaviour:** the reply for that turn follows the chosen style. An unknown `tone_id` should be a 400 with the usual validation body (`{code, message, requestId, fieldErrors}`), not silently ignored, so mistakes show up.

**Agents:** when the chat has a `persona_id`, the agent's own tone should win over `tone_id`, or `tone_id` should be refused for agent chats. Tell us which, and we'll hide the menu in agent chats if it's refused.

**Optional:** if the backend owns the list of styles, a `GET` endpoint returning `[{id, label, description}]` would let the front end drop its copy in `tone-options.ts`.

## How the front end will switch them on

Once a field ships, we'll:

1. add it to `CHAT_CREATE_FIELDS` / `CHAT_STREAM_FIELDS` in `src/lib/chat-form-fields.ts`, so the proxy stops stripping it;
2. set `NEXT_PUBLIC_ENABLE_COMPOSER_WEB_SEARCH=true` or `NEXT_PUBLIC_ENABLE_COMPOSER_STYLE=true`;
3. test it live on devapi.

Please tell us the backend commit, and whether the two ship together or separately.
