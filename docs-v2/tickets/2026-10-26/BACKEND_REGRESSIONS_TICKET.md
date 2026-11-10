# [Backend] Agent chat, chat rename and other endpoints the front end still calls

**Date:** 2026-10-26
**Checked against:** `back-end` head `1cfc2031` (26 Oct), live on devapi with the ADMIN test account.
**How it was checked:** every backend path the front end calls (146) was compared with the routes in `back-end`. Each missing path was then requested on devapi: `404 {"detail":"Not Found"}` means the route does not exist (route matching runs before auth). As a control, `GET /chats/{id}/stream` answers `405`.
**Front end meanwhile:** agent chat is switched off behind `NEXT_PUBLIC_ENABLE_AGENT_CHAT` (off by default), so nothing sends `persona_id` any more. Creating, editing, sharing and publishing agents are unaffected. Set the flag to `true` once R1 ships.

Requirements are in priority order.

---

## R1. Chatting with an agent was removed (P0)

Commit `9079f6e3` (22 Oct, "Refactor persona and chat services: remove unused chat-related endpoints") removed all of these:

- `persona_id` from `CREATE_FIELDS` / `STREAM_FIELDS` in `services/chat/router.py`, plus `_resolve_persona` and the `persona=` argument that applied the agent's prompt and model to the turn.
- The agent chat endpoints on the persona router: `/persona/{repo_id}/chats`, `/chats/create`, `/chats/{chat_id}/stream`, `/messages`, `/stop`, `/rename`, `/message/{id}`.

Since 19 Oct the chat endpoints answer `400` to any field they don't accept. So **every chat with an agent attached failed**, with:

```
POST /chats/create  (input, model_id, thinking, persona_id)
400 {"code":"bad_request","message":"This request has a field that isn't accepted."}
```

The front end still calls these endpoints, and they were not unused: the `@agent` mention, "Add agent", "Use agent" / "Use this Agent", and the `/agents/{id}/chat` page all go through them.

| # | Requirement | Acceptance criteria |
|---|---|---|
| R1.1 | Agent on a normal chat | `POST /chats/create` and `POST /chats/{id}/stream` accept `persona_id` (a persona **version** id). The turn uses that version's prompt, model and temperature. A follow-up turn without `persona_id` keeps the chat's agent (`chat.persona_id`), as before `9079f6e3`. Unknown id, or one the user can't use → `404`. |
| R1.2 | Shared and published agents | A version the user received through a share or a published link can be used (R1.1), not only the user's own. |
| R1.3 | Agent's own chat list | Either restore `/persona/{repo_id}/chats` (list, create, stream, messages, stop, rename, delete message), **or** confirm that agent chats are normal chats with `persona_id`. In that case `GET /chats` must return `persona_id` on each chat (and accept a `persona_id` filter), so the sidebar can group chats under their agent. Tell us which one, and the front end will follow. |

## R2. Renaming a chat always fails (P0)

`PATCH /chats/{chat_id}` (added in `45b2ef3e`, 19 Oct, `router.py:252`) is declared **before** `PATCH /chats/rename` (`router.py:279`). FastAPI matches routes in the order they are declared, so `rename` is parsed as a chat id:

```
PATCH /chats/rename  {"chat_id": "61a86846-…", "chat_title": "…"}
422 {"code":"invalid","message":"Input should be a valid UUID … found `r` …","fieldErrors":[{"field":"chat_id", …}]}
```

| # | Requirement | Acceptance criteria |
|---|---|---|
| R2.1 | Fix the route order | Move `@router.patch("/rename")` above `@router.patch("/{chat_id}")`, or type the path parameter so that `rename` can't match it. `PATCH /chats/rename` renames the chat and answers `200 {"ok": true}`. |
| R2.2 | Guard against it | A test that renames a chat through the router. Any future literal path under `/chats/` must be declared above `/{chat_id}` (`GET /chats/create` already answers `422` for the same reason). |

## R3. Agent editor endpoints that no longer exist (P1)

These answer `404` on devapi. The front end still has callers for them in `src/lib/api/persona-versions.ts` and `persona-stream.ts`.

| Endpoint | Front-end use | Ask |
|---|---|---|
| `POST /persona/{repo}/versions/{v}/test` | "Try it" preview while editing an agent | Restore it, or confirm it's gone so the front end can delete it |
| `POST /persona/{repo}/versions/{v}/document`, `DELETE …/document/{id}`, `POST …/knowledge-url`, `GET …/files` | Agent knowledge (files and URLs) | Same. If agent knowledge now comes from the Library, say how a version links to Library files |
| `PUT / DELETE /persona/{repo}/versions/{v}/blocked-connectors[/{slug}]` | Connectors an agent may not use | Same (removed in `44ccd64f`, 12 Oct) |

## R4. Other paths the front end calls that return 404 (P2): confirm they're intentionally gone

| Endpoint | Front-end caller | What we need to know |
|---|---|---|
| `POST /stripe/trial` | Welcome modal "Start free trial"; Billing "Claim free 1,000 credits" | The trial now seems to be granted at signup (`services/users/service.py`, `FREE_TRIAL_ENABLED`). Confirm, and the front end will remove the claim step. The welcome modal already skips the call when `isTrial` is true. |
| `POST /connectors/{slug}/complete` | Zapier-hosted connector setup (`completeZapierLink`) | Is Zapier support gone for good? |
| `POST /chats/files/{id}/save-to-drive` | `saveFileToDrive` (no UI calls it any more) | Confirm it's gone (removed in `474f9513`, 7 Oct). The front end will delete the dead code. |
| `POST /chats/prompts/{id}` | Fallback in `respondToChatPrompt` when a prompt event has no `respond_url` | Confirm every prompt event carries `respond_url`. The fallback can then go. |

## R5. Super link stats were dropped (P2)

`9079f6e3` removed `conversations` and `conversations_delta_pct` from `ShareDashboardSummary` (`GET /persona-shares/dashboard`), and `message_count` from `ShareRecipientSummary`. The Agents → Super links tab, the link drawer and the per-recipient rows read these values, so they now show 0 or blank.

| # | Requirement | Acceptance criteria |
|---|---|---|
| R5.1 | Conversation counts | `GET /persona-shares/dashboard` returns `conversations` (chats started through the user's links in the period) and `conversations_delta_pct` (change against the previous period, or `null`). Each link carries its own `conversations`. |
| R5.2 | Messages per recipient | Each recipient summary returns `message_count`. If these numbers no longer exist now that agent chat is gone (R1), say so and the front end will remove them. |

## R6. Web search and style controls do nothing (P2): product decision

The composer had a **Web search** switch and a **Use style** menu. The chat endpoints don't read `web_search` (search settings were removed in `aa934dfe`, 2 Oct; the model now decides when to search) or `tone_id`. The front end has hidden both behind flags (`NEXT_PUBLIC_ENABLE_COMPOSER_WEB_SEARCH`, `NEXT_PUBLIC_ENABLE_COMPOSER_STYLE`, both off).

| # | Ask |
|---|---|
| R6.1 | Should the user be able to force web search on or off for a message? If yes, accept `web_search: true \| false` on `/chats/create` and `/chats/{id}/stream`. If no, confirm, and the front end will delete the switch. |
| R6.2 | Styles (Professional, Teaching, …): accept `tone_id` on both endpoints and apply it to the turn, or confirm that styles are gone. |

## R7. Gaps found in the 26 Oct end-to-end UI pass (P2)

Four testers clicked through the whole app with the ADMIN and MEMBER accounts. These need the backend.

| # | Problem | Evidence | Ask |
|---|---|---|---|
| R7.1 | **Stop doesn't stop the save.** The answer saved after `POST /chats/{id}/stop` is longer than what the user saw stop. | 40-line poem stopped at ~230 characters: the live bubble had 247; after reload it had 303 and no "stopped" marker. | Stop writing and saving at the stop request, and mark the saved message as stopped (e.g. `stopped: true`) so the reloaded chat matches what the user saw. |
| R7.2 | **Turns with no text.** Some turns finish with reasoning and tool calls but `output: ""`. | "Write a 300 word story about a fox" did this 3 out of 3 times; owl and heron prompts never did. | Find why the final text is empty for these turns. The front end now shows a "No response came back" placeholder with retry, but the model should answer. |
| R7.3 | **No unarchive.** Archived chats can't be brought back: there's no unarchive endpoint. | `POST /chats/{id}/archive` exists; nothing reverses it. | Add `POST /chats/{id}/unarchive` (or `PATCH` `archived: false`). The front end will add Undo and Unarchive. |
| R7.4 | **Search covers titles only.** Global search can't find a chat by its contents. | Searching words from a chat's first message, or from a project file ("PELICAN"), returns nothing. | A search endpoint that matches message text (and project files, if wanted), returning chat id, title and a snippet. |
| R7.5 | **No way to ask for access.** A member opening a file that wasn't shared with them gets 404 `file_gone`, so the front end can't offer "Request access". | `GET /library/files/{id}` as MEMBER on an ADMIN file returns 404 `file_gone`; `/library/access-requests` is `[]`. | Answer 403 `no_access` (or `locked`) for a file that exists but isn't shared with the caller, so the Request access flow (`POST /library/files/{id}/access-requests`, already built) can start. Keep 404 for files that are really gone. |
| R7.6 | **Renames don't reach the repo.** Renaming an agent only renames its version; the repo and shares keep the old name. | `GET /persona/{id}`: `name` is the old name and `active_version.name` the new one. `persona-shares` returns the old `persona_name`. | Update the repo name (and therefore `persona_name` on shares) when the active or working version's name changes. The front end now shows the version's name, but the share recipient's preview and the Super links table read the stale one. |
| R7.7 | **Times have no time zone.** `persona-shares` timestamps (`created_at`, `last_used_at`, …) are UTC with no zone marker. | `"created_at":"2026-10-26T12:53:05.140189"` | Send ISO 8601 with `Z` or an offset, as the other services do. The front end now assumes UTC for these, but other screens may read them as local time. |
| R7.8 | **Null is ignored on profile updates.** `PATCH /users/me` skips `null`, so a field can't be cleared with null. | `{"profile_picture": null}` returns 200 but the old picture stays; the same happens for `first_name`/`last_name`. | Treat `null` as "clear" (the front end now sends `""` as a workaround), or document `""` as the way to clear a field. |
| R7.9 | **Upload processing looks stuck.** A 30-byte `.txt` uploaded through `/library/uploads` was still `not_ready` (409 on chat send and on preview) after more than 30 seconds. | Seen twice during the retest on 26 Oct. | Check the processing queue on dev. The same files uploaded through the chat composer earlier were ready within seconds. |
| R7.11 | **Accepting a shared agent is slow.** | As MEMBER, `POST /persona-shares/{id}/accept` took 6.8s the first time and 1.1s on a repeat. The front end now shows "Copying agent…" while it waits. | Profile the accept (copying the version and image?) and bring it under about 1s, or make it return before the copy finishes. |
| R7.10 | **Rate limiting.** nginx answers 429 under modest parallel use (4 testers on one account): `/users/me`, `/organizations/{id}`, `/plan`, `/members`, `/library/prefs`, `/automations/{id}`. | Many 429s during the pass. | Check the dev limits are what you intend. The schedules list also fetches every automation one by one: a list endpoint that includes the details the cards need would cut the load. |

---

## Fixed in the front end on 26 Oct (no backend action)

These came out of the same scan. They're listed so nobody "fixes" them again on the backend side.

- **Agent picture upload:** now uses `PUT /persona/{repo}/versions/{v}/image`. It was using the removed `PUT …/files`.
- **Project context on the first message:** a new chat started in a project now sends `project_id` on `/chats/create`. Before, the chat was linked afterwards, so the first answer ignored the project's instructions and files.
- **Signup memory:** onboarding now sends `{ memory }` to `POST /memory/user`. It was sending `content`, which got a 422, so the "about you" text was never saved.
- **Deleting a chat inside a project:** this now calls `DELETE /chats`. It used to call only `DELETE /projects/{pid}/chats/{cid}`, which left the chat alive outside the project.
- **"Ask about this file":** now sends the file by `libraryFileIds`. It used to download the file and upload it again, which made a duplicate in Library.
- **Chat error messages:** the front end now shows the backend's own message for `not_ready`, `too_many_files`, `file_gone` and `file_locked`. It used to read the response before the body arrived and show a generic per-status message, e.g. "model no longer available" for a 409.
- **Free trial:** the welcome modal no longer offers the trial to users who aren't already on it, because `POST /stripe/trial` is gone (R4).

---

## Process ask

Three of these (R1, R2, `/stripe/trial`) broke screens that were working, and the commits that caused them describe the endpoints as unused or dead. Before removing a route or a form field, please search `front-end/src/lib/config.ts` for the path. A short "removing X" note to the front end would have avoided all of them.
