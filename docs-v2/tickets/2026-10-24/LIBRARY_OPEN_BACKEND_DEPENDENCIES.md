# [Backend + Front end] Library: open backend dependencies and front-end follow-ups

**As of 2026-10-25.** Checked against `back-end` `origin/Development` head `c03695a0`, which is deployed to devapi (`openapi.json` lists the new routes). The 24 Oct version of this page was checked against `77d5839b`.

**Status:** 8 of the 12 backend tickets below shipped in `c03695a0`, 3 shipped in part, and 1 (BE-07, routines) is untouched. 36 checks in `../2026-10-20/LIBRARY_FLOWS_CHECKLIST.md` are marked 🔁 to retest live.

**Sources:**
- Full requirements, with request and response shapes: `../2026-10-19/LIBRARY_ALL_FLOWS_BACKEND_TICKET.md`.
- Per-check status: `../2026-10-20/LIBRARY_FLOWS_CHECKLIST.md`.

## What changed since 24 Oct

One Library commit: **`c03695a0`** (25 Oct, "Library open items: chat searches the Library, sharing by asking, Slack, leaving, lists"), 38 files, +1875/−192. The other two commits (`69b0613d` Slack account links, `b51d3831` Meta Ads through Pipeboard) don't touch Library.

## Part 1. Backend dependencies

| Ticket | Status | What shipped / what's still missing | Checks |
|---|---|---|---|
| **BE-04** Chat uses the Library | ✅ | Chat searches every file the user can open. It honours the personal and workspace switches and per-chat `librarySourcesOff` (now accepted on `POST /chats/create` and `/chats/{id}/stream`, stored, and returned by `GET /chats/{id}`). It says "I couldn't find this in your files." when nothing covers the question. | A10, A13, A-Depth2, G3, G9 |
| **BE-05 R6** Trashed files | ✅ | Trashed, deleted or switched-off files are kept out of the turn. | F11 |
| **BE-05 R4, R5** Chat files | ✅ | `GET /chats/{id}` returns `savedFiles [{id, title, generated}]`. `DELETE /chats` takes `deleteFiles` and returns `{deletedChatId, trashedFileIds}`, and restore brings the files back. | F4, F10 |
| **BE-01 R5** Enforce settings | ✅ | Retrieval reads both switches. | G3, G9 |
| **BE-06** Recordings | ✅ | A timed transcript is made at indexing (Whisper) and is searchable. `AudioPreview` has `transcriptStatus: pending \| ready \| failed` and `lines [{startMs, endMs, text}]`. | A11, H18 |
| **BE-07** Routines | ❌ | Nothing in `services/automations` changed. R1 to R11 are all still open: attached files, `routine_proposal` and confirm, test run, output titles and routine provenance, `output: file \| message`, files used, `409 already_running`, Slack "is ready". | B1–B3, B6, B-d1, B-d2, C1, C2, C7, C8, C-d1, C-d2, F-d1, H8 |
| **BE-08** Sharing in chat | ✅ | `share_library_file` and `find_library_files` tools with fixed replies. The `library_shared` SSE event carries `{messageId, fileId, grantId, label, personName}`. The tool forbids the browser route. The same tools run in Slack. | E7, E8, E9, E-d1 |
| **BE-09** Request access | ✅ | `POST /library/files/{id}/access-requests` (`204`, `Idempotency-Key`) and `GET /library/access-requests` (owner's list). A locked file is `403` only for someone who saw it in a chat, `404` for everyone else (decision 6). | D4 |
| **BE-10** Library in Slack | ✅ code | DMs use the sender's files. A channel uses only workspace-shared files and gives a left-out count. Slack Connect gets none. Files save only when asked (decision 7), with `via: "slack"`. Find and the fallback reply are in. **Slack still isn't connected on the test workspace**, so nothing here is tested. | D1–D3, D5–D7, D-d1, D-d2, E9 |
| **BE-11** Removing a member or leaving | 🟡 | `services/library/handoff.py` runs on leave and on removal: each recipient gets a copy of what the person shared with them, then the person's files are deleted. **There is no removal question (R1 to R4), so the design's Yes/No choice has nothing to call.** | G6, G7, G-d1, G-d2 |
| **BE-12** Lists and search | 🟡 | Done: R6 (per-viewer Recent lines, `useCount`, Frequently used capped at 3 and never repeating Recent), R7 (re-share is unread again), R9 (keyset cursor on files and Trash, Trash honours `limit`), R10 (`GET /library/summary` → `{sharedWithMeCount, unreadSharedCount, trashCount, storage}`), R11 (`thumbnailUrl`, `thumbnailWidth`, `thumbnailHeight`). **Open: R5**, routine origin (`generatedFrom.kind` is still always `"chat"`; needs BE-07). | H2, H3, H4, H8, H21, X8, E-d2, H-new2, H-new3 |
| **BE-02 R9** Upload phase | ✅ | A refused upload stays readable as `phase: "failed"` with `failureReason`. Preview and download of an uploading file answer `409`. | X3 |
| **C-01 / C-02 / C-05** API conventions | 🟡 | C-02 ✅: `Idempotency-Key` on upload start and complete, grants, access requests and chat send. C-05 ✅: `Cache-Control: private, no-store` and `Vary: Authorization` on `/library`, `/chats` and `/automations` (no `ETag`). C-01 🟡: validation errors now use the same body as Library errors (`{code, message, requestId, fieldErrors}`), still without `kind` or `retryable`. | None directly |

## Part 2. Front-end follow-ups

### 25 Oct: built and tested live

Everything in 2.1 is built. It was tested live against devapi with ADMIN and MEMBER from `.env.local`: `tsc` is clean and 1847 tests pass (2 skipped). Nothing is committed.

| What | Where | Live result |
|---|---|---|
| Share confirmation from `library_shared`: the toast "Shared with Maya · Undo", as in the prototype (`reducer.ts:259`); Undo revokes the grant ("Sharing undone"). An inline card was tried first and removed, since the prototype only uses one in Slack | `lib/library/library-shares.ts`, `components/Library/chat/library-share-toast.ts`, `hooks/use-streaming-chat.ts` | E7 ✅ |
| `librarySourcesOff` accepted by the proxy, always sent once the chat has a list (an empty list clears it), seeded from `GET /chats/{id}` | `lib/chat-form-fields.ts`, `app/api/chat/route.ts`, `lib/library/library-sources-off.ts`, `library-dont-save.ts` | A10 ✅ |
| Delete chat: list from `savedFiles`; "Also delete these files" sends `deleteFiles`, and Undo is offered because restore brings the files back (agent chats fall back to trashing files one by one) | `lib/api/chat.ts` (`deleteFilesWithChat`), `DeleteChatFiles.tsx`, `useChatSavedFiles.ts` | F4, F10 ✅ |
| Request access on by default; a pending request (`details.requested`) shows "Request sent" on load | `lib/feature-flags.ts`, `lib/api/client.ts` (`ApiError.details`), `lib/library/errors.ts`, `FileStates.tsx` | D4 ✅ |
| Shared tab, unread dot and storage label from `/library/summary`; the summary refreshes after any change | `queries.ts` (`useLibrarySummary`), `keys.ts`, `mutations.ts`, `LibraryHeader.tsx` | H2 ✅ |
| Audio: "Transcribing…" while `pending` (polls every 15 s), a note when `failed`, and timed lines | `AudioViewer.tsx`, `FilePreview.tsx`, `queries.ts` | A11 lines ✅ |
| Refused upload page: the reason banner, with no preview, Download or Ask | `FileStates.tsx` (`UploadRefusedBanner`), `FileScreen.tsx`, `FileInfoCard.tsx` | X3 ✅ |
| `Idempotency-Key` on grants, access requests, upload complete and chat send (browser per send; the proxy forwards it) | `lib/library/api.ts`, `use-streaming-chat.ts`, `app/api/chat/route.ts` | Sent; no errors |
| Schemas: `useCount`, `thumbnailWidth/Height`, `failureReason`, `transcriptStatus`, `summary`, `accessRequest` | `lib/library/schemas.ts`, `file.ts` | — |
| Thumbnails and the keyset cursor needed no change (already built) | — | H-new2, H-new3 ✅ |

Still open, from what the live tests found:
- **Backend:** files from before 25 Oct have no thumbnail and get their transcript late, so the backend should backfill them.
- **Backend:** "find the return policy" in web chat answered from the file instead of using `find_library_files`. Recheck this in Slack (D6).
- **Front end:** there's no screen listing incoming access requests for the owner (`GET /library/access-requests`). This needs a design.
- **Front end:** a row's … menu still offers Ask about this on a refused upload. The row has no `phase`, so this is minor.

### 2.1 Unblocked now

| What | Backend | Where |
|---|---|---|
| Turn on `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS` | BE-09 | `.env.local`, deploy envs |
| Send `librarySourcesOff` with each message, and read it and `libraryDontSave` from `GET /chats/{id}`; delete the local copies | BE-04 R4, BE-03 R4 | Sources panel, chat send |
| Read `savedFiles` from `GET /chats/{id}` in the delete-chat dialog instead of a lookup per file | BE-05 R4 | `DeleteChatFiles.tsx` |
| Send `deleteFiles` on chat delete; offer Undo also when files went to Trash | BE-05 R5 | `AppDialogs.tsx` |
| Share confirmation in chat from `library_shared`, with Undo (`DELETE …/grants/{grantId}`) and "Sharing undone"; also on history restore | BE-08 | Chat stream handler, message renderer |
| Header counts and storage from `/library/summary` | BE-12 R10 | `LibraryHeader.tsx` |
| Thumbnails on tiles and rows | BE-12 R11 | `SuggestedView.tsx`, `FileTable.tsx` |
| Check paging with the keyset cursor (no offset assumptions) | BE-12 R9 | Library list query |
| Audio viewer: transcript lines, "Transcribing…" while `pending`, a note when `failed` | BE-06 | Audio viewer |
| Failed File page shows the `failureReason`; handle `409` on preview and download while uploading | BE-02 R9 | `FileScreen.tsx`, viewers |
| Send `Idempotency-Key` on upload complete, chat send, grants and access requests | C-02 | `src/lib/api/client.ts`, Library API |
| Read the new `422` body (`fieldErrors[].field` without `body.` prefix) | C-01 | `src/lib/api/client.ts` |

### 2.2 Still waiting on the backend

| What | Needs |
|---|---|
| Routine chat cards, attached files, test-run polling, "Running now" on `409` | BE-07 |
| "Made by routine…", "Files this run used", "Run of <routine>", routine sparkle tooltip | BE-07 R4, BE-12 R5 |
| `kind` and `retryable` on `ApiError` from the server | C-01 |
| Removal question, "Waiting for their answer", Leave with the question | BE-11 R1 to R4, or a product call that the automatic hand-off replaces them (then the front end only needs a Leave confirm that explains the hand-off) |
| Turn on `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` | BE-11 decision above |

### 2.3 Retests once the front end is in

| Flow | Checks |
|---|---|
| A, F, G (chat answers) | A10, A11, A13, A-Depth2, F11, G3, G9 |
| E (share by chat) | E7, E8, E-d1, E-d2 |
| D4 (request access) | D4 |
| H, X (lists) | H2, H3, H4, H18, H21, H-new2, H-new3, X3, X8 |
| F (chat delete) | F4, F10 |
| G (leaving) | G6, G7, G-d1, G-d2, after the BE-11 decision |
| D, C7, E9 | Once Slack is connected |

### 2.4 Front-end only, nothing to wait for

| ID | What |
|---|---|
| A15 | Decide whether the app-wide + menu should match the prototype's width and placement. |

## Part 3. Product decisions

| # | Decision | Affects | Status |
|---|---|---|---|
| 1 | Are routines private, or visible to the whole org? | BE-07 R8 | Open |
| 2 | Should a routine post "<Routine> is ready." to Slack on its own? | BE-07 R10 | Open |
| 3 | How long can a deleted chat be restored? (30 days, like Trash, is proposed) | BE-05 R5 | Open |
| 4 | What happens if the person leaving never answers the removal question? | BE-11 R5 | **Changed**: the backend now hands off automatically with no question. Confirm this replaces the question. |
| 5 | Is there a workspace storage limit this phase? | BE-01 R6 | Open |
| 6 | Should a locked file return `403` or `404` to someone never linked to it? | BE-09, C-07 | **Decided in code**: `404`; `403` only for someone who saw it in a chat |
| 7 | Slack DM auto-save: save only when asked? | BE-10 R3 | **Decided in code**: only when asked |
| 8 | Is the Generated row only routine outputs, or every generated file? | BE-12 R5 | Open |
| 9 | Does Frequently used rank by opens only, or by opens plus uses? | BE-12 R6 | Answered in code: opens and uses (`useCount`), never repeating Recent |
