# [Backend] Library, all prototype flows (A to H and "All flows"): one detailed ticket, built to the front-end design principles

| Field | Value |
|---|---|
| Type | Combined requirements ticket: one backend work list, the API conventions it must follow, and the front-end side of every item |
| Area | Backend `services/library`, `services/chat`, `services/document`, `services/automations`, `services/slack`, `services/organizations`, `core` (errors, request ids) |
| Source | Prototype checks in `library-prototype/surfaces/library/lib/data.ts` (Flows A to H and "Checks that apply to every flow"), run live against the dev backend from `front-end` on 2026-10-18 and 2026-10-19 (admin account "You", member account "Maya") |
| Built from | `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md`, `2026-10-18/LIBRARY_CHECKPOINT_BACKEND_TICKET.md` (Flows B to H and All flows, all finished runs), and the existing design docs `docs v2/library/04-backend-requirements.md` (the full backend design) and `06-principles-application.md` |
| Principles | `front-end/fe system design/principles/` (56 principles, 6 folders). Part 0 turns the ones that touch the API into backend rules, each with its source |
| Left out on purpose | Everything about **cited passages** (Library citations in chat answers). See "Left out" below |
| Status | **All eight flows (A to H) and "All flows" are done and included.** Flow G was tested against settings endpoints answered by a local stand-in (the backend has none), so its results prove the screens, not the backend |
| Front-end contact | _fill in_ |

## How to read this

- **Part 0** is the set of API rules every item below must follow (errors, idempotency, pagination, caching, events, security, observability, contract), with the principle each comes from, what the backend does today, and which items it touches. Items do not repeat these rules; they name the rule (for example "C-02") and add only what is specific.
- **Part 1** says where each flow stands and which backend items it needs.
- **Part 2** is the backend work: 12 items (BE-01 to BE-12). Each has the checks it fixes, what was seen live, where it sits in the code, numbered requirements with request and response shapes, error codes, data changes, edge cases, authorisation, observability, what the front end has built and reads, rollout, and acceptance tests.
- **Part 3** is the front-end list on its own.
- **Part 4** lists the decisions the backend or product team has to make before building.
- **Part 5** maps every principle used to the items it shaped.

**Words used.** *Routine* is a scheduled task: the prototype says "Routine", the backend says automation (`services/automations`, `/automations/...`), the app says Schedules (`/schedules`). They are one thing. *File* is a Library file (a `Document` row). *Result words:* **Pass** works today, **Partial**, **Fail** (backend), **Blocked** (cannot be checked until something exists or is connected).

**Names are proposals, behaviour is required.** Shapes below marked *proposed* may be renamed by the backend if the front end is told. Fields marked *the front end reads* are already coded against and must keep their names (or the front end must be told first).

## Left out: cited passages

The work that makes an answer carry a Library citation chip, and the chip opening the cited passage, is not in this ticket. It has its own write-up (Part 2 of the Flow A ticket, BE-1 to BE-5). These checks and sub-items depend on it and are **not** covered here:

| Check or sub-item | What is left out |
|---|---|
| A9 | The citation chip and the `library_citations` event |
| A10 (third gap) | The "Cited in answer" mark in the Sources panel |
| A11 | The timed citation ("recording, 0:09") |
| A13 | The per-turn citation ids the model writes. Retrieval, the switch and "not in your files" stay in BE-04 |
| D, Needed 2 | Library file links in Slack answers |
| D4 | The citation that produces a "Locked file" chip. The locked panel and Request access stay (BE-09) |
| E6, E Needed 6 | A citation turning to "Locked file" after a share is removed |
| F11, F-d2, F Needed 6 | A citation reading "File deleted". Leaving trashed files out of retrieval stays (BE-04) |

Where an item says "needs citations", it waits on that other ticket and nothing here changes it.

---

## Part 0. API conventions every item must follow

These are the backend-facing rules from the front-end principles, checked against what the backend does today. "Today" comes from reading `back-end/main.py`, `services/library/{router,library,uploads,schemas}.py` and the existing `04-backend-requirements.md` section 5b, which already asks for most of this. Where 04 already says it, this ticket says **"04 5b"** so nobody builds it twice; the point here is that live testing shows several are **not built yet**.

### C-01. One error contract

**Rule.** Every failure is a non-2xx response with one body shape, a stable machine code, user-safe text, and a reference the person can quote:

```json
{
  "code": "password_protected",
  "message": "This file is password-protected, so it can't be added.",
  "requestId": "9f3c1a7e2b40",
  "details": { "fileId": "..." },
  "fieldErrors": [ { "field": "maxFileBytes", "code": "too_large", "message": "The limit can't be above 200 MiB." } ]
}
```

- `code` is stable and branched on by the front end; `message` is plain language that says what happened and what to do, never a stack trace, SQL, host name or upstream provider text; `requestId` is the same value as the `X-Request-Id` response header; `details` and `fieldErrors` are optional.
- `Content-Type: application/problem+json` (RFC 9457) is preferred. If adopted, map `title` to a short title, `detail` to `message`, `status` to the HTTP status, `instance` to the request id, and keep `code`, `fieldErrors` as extension members. The front end reads `code`, `message`, `requestId`, `fieldErrors` either way.
- **Validation (422)** carries one `fieldErrors` entry per bad field, with the field path (FastAPI's `loc`) mapped to a field name, so a form can highlight each field. Echo nothing secret back.
- **Status codes, used consistently:** 400 malformed or unknown field or `bad_cursor`; 401 missing or expired session (handled globally); 403 not allowed (`file_locked`, `only_owner`, `forbidden`); 404 missing or gone (`file_gone`); 409 conflict or duplicate (`already_has_access`, `already_running`, `upload_done`, `only_admin`); 413 `too_large`; 415 `unsupported`; 422 validation; 429 `rate_limited` with `Retry-After`; 5xx only for real server faults, and `Retry-After` on 503. **Never 200 with an error in the body**; 2xx bodies always match the documented schema; empty successes are `204` with no body.
- A failure after a stream has started cannot change the HTTP status, so it is sent as an explicit error event (see C-06).

**Principles.** 45 (stable codes, per-field `loc`, `Retry-After`, `x-request-id`, RFC 9457, no 200-with-error), 37 (correct status codes, standard error format), 19 (stable `code` plus safe `message`, request reference, 4xx vs 5xx), 20 (messages that say the problem and the fix, not colour or a bare code), 35 (structured per-field errors, no stack traces), 13 (expected failures returned as values).

**Today.** `LibraryError` is turned into `{"code","message"}` only (`main.py` `libraryErrorHandler`): no `requestId`, no `details`, no `fieldErrors`. Request validation errors take a different shape, `422 {"detail": [...loc/msg...]}`, so the front end has to join them into one string and forms cannot highlight a field (45, FE observation). The request id exists only as the `X-Request-Id` header (set by `request_id_middleware`, already in CORS `expose_headers`). Other services raise `HTTPException(detail={code,message})`. 04 5b already asks for `{code, message, details?, requestId, fieldErrors?}`.

**Applies to.** Every item. Specific new codes are listed in each item's error table.

### C-02. Idempotency: a retry or a double click never duplicates work

**Rule.**

- `PUT` and `DELETE` are idempotent and carry the target state (for example a grant is "this person has access", not "flip"); settings `PATCH` takes the desired end state, so repeating it is safe.
- Every `POST` that creates something or starts work accepts an `Idempotency-Key` header (a client UUID): `POST /library/uploads`, `POST /library/uploads/{id}/complete`, `POST /chats` and `POST /chats/{id}/stream` (send), `POST /automations/proposals/{id}/confirm`, `POST /library/files/{id}/grants`, `POST /library/files/{id}/access-requests`, `POST /library/members/me/removal/answer`. *Proposed semantics:* the key is stored per user for 24 hours with a hash of the request body and the response. The same key and body returns the stored response with `Idempotent-Replay: true` and does the work **once**. The same key with a different body returns `422 idempotency_key_reuse`.
- Where the natural answer is "already happening", say so with a code instead of pretending success: a second run of a routine returns `409 already_running`, a repeat share returns `409 already_has_access`, a repeat request returns 204 (idempotent per person and file).
- Client-made temporary ids are never accepted as real ids; every create returns the real id.

**Principles.** 37 and 45 (`Idempotency-Key` for retryable `POST`, idempotent `PUT`/`DELETE`, keys for create operations), 33 (idempotent target-state writes, desired end state not a delta), 53 (server-side idempotency because any client can ignore its timers, disabled button is not enough), 13 and 19 (the front end will not auto-retry a non-idempotent write).

**Today.** Trash, restore and `opened` are naturally repeatable; grants return 409 on repeat; one running routine run is enforced by the `uq_automationrun_one_running` index but the API still answers `started: true` (BE-07). No `Idempotency-Key` is honoured on Library or chat endpoints (searched `back-end` for the header: nothing outside the Slack event table). 04 section 5 asks for it on uploads and grants.

**Applies to.** BE-02, BE-03, BE-07, BE-08, BE-09, BE-11.

### C-03. Mutations return the updated thing, and list and detail agree

**Rule.**

- Each mutation returns the full updated entity (or the updated list that changed) so the front end writes the server's truth into its cache and does not refetch or guess. Return real ids, counts and timestamps the server decided.
- A file has **one set of field names and meanings** in the list row, the detail, the picker and Trash; a list row may carry fewer fields, never different ones, so the front end can merge without a partial row overwriting a full one.
- Relations come back as ids (`ownerId`, `originChatId`) or as nested objects that carry their own `id`. No cyclic or duplicated nested copies.
- Where a permission outcome depends on the server (share, request access, remove a member), the front end waits for the response; make those calls fast and authoritative.

**Principles.** 30, 31, 33, 38 (return the entity from a mutation; merge, do not replace; stable ids), 13 (server is the source of truth).

**Today.** Good: `PATCH /library/files/{id}` returns `FileRow`, `DELETE /library/files/{id}` returns `Trashed {daysLeft}`, grants return `AccessList`. Gaps: restore, delete forever, empty trash and `opened` return `204` with nothing, so the front end invalidates and refetches; org settings and prefs do not exist (BE-01).

**Applies to.** BE-01, BE-02, BE-05, BE-07, BE-09, BE-11, BE-12.

### C-04. Lists: keyset cursor, bounded, filters as real parameters

**Rule.**

- **Cursor, not offset.** Every list uses a keyset (seek) cursor: order by the sort key plus the unique `id` as a tiebreaker (`WHERE (sort_key, id) < (:k, :id)`), fetch `limit + 1` to know if there is more, and back it with a composite index. The cursor is **opaque, versioned (`v`), and bound to the filter and sort it was made for**. A cursor reused with a different filter or sort, or a tampered one, returns `400 bad_cursor`, never a 500 or a SQL error.
- Response: `{items, nextCursor}` where `nextCursor` is `null` on the last page. No exact totals on large lists; show counts from the separate summary (C-12).
- **Bounds.** Every list endpoint takes `limit` with a default and a server maximum (`maxPageSize: 100` in `services/document/settings/library.yaml`), including Trash and search.
- **Filters, sort, search and tab are explicit, stably named query parameters** (the front end keeps them in the URL and in its cache keys): `tab`, `q`, `source[]`, `type[]`, `sort`, `dir`, `unreadFirst`, `cursor`, `limit`. Unknown values are `422` with a field error, not ignored. Names are a public API.
- **Rows are complete.** A list row carries everything needed to draw it (title, extension, format, source, owner, access, summary of who has access, size, dates, unread, processing phase and failure, thumbnail URL and size) so the front end makes no per-row request while scrolling.
- **Search** needs a minimum query length (the front end sends 0 or 2 or more characters), must be fast enough for type-ahead after a 250 ms debounce, and must stop work when the request is cancelled. Ranked search may use a capped offset or a score-plus-id cursor.

**Principles.** 39 (cursor for lists that change, unique tiebreaker, opaque validated bound cursor, `limit` default and cap, no totals), 30 and 38 (`nextCursor` or null, filters as parameters), 34 (named parameters are a public API, bad values degrade without a 500), 51 and 53 (bounded lists, complete rows, search that filters data not DOM, cancellation), 37 (pagination, filtering, sorting through query parameters).

**Today.** `GET /library/files` has the right parameters and a `limit` capped by `maxPageSize`. But the cursor is an **offset in disguise**: `cursorAt` encodes `{"o": offset, "k": key}` (`services/library/library.py` ~lines 271-293), and `page()` runs `statement.offset(offset).limit(limit + 1)`. That is the pattern principle 39 calls a correctness bug on live data: a file added or removed while someone scrolls makes rows repeat or vanish at page boundaries. The `k` key does bind the cursor to its filter and sort (good) and a bad one gives `400 bad_cursor` (good). `GET /library/trash` takes no `limit` (fixed `pageSize`). `FileRow` has no `thumbnailUrl`. Sort ties are broken by `Document.id` in some queries; confirm it is in all. Library search uses `anyWord(q)` (any one word matches, in the chosen sort order, `library.py` ~lines 324-327), so "net 30" returned 15 files in Flow H (BE-12 R3).

**Applies to.** BE-12 (files, Shared, Trash, search), BE-04 (search), and every list added by other items (run history, members).

### C-05. Concurrency and caching headers

**Rule.**

- Personalised JSON (`/library/*`, `/automations/*`, `/chats/*`) is `Cache-Control: private` (or `no-store`), with `Vary: Authorization`. Never publicly cacheable, never behind a shared cache.
- `GET` of a file detail or list may send an `ETag` and honour `If-None-Match` with `304`, so the front end can revalidate cheaply.
- Settings that two Admins can edit use a `version` and `If-Match` (BE-01). A stale write still wins (Admins are equal) but the response says who changed it last.
- **File bytes** are never served through the API origin or the front-end proxy: short-lived signed URLs (`linkSeconds: 900`, 15 minutes, already the Library setting), `Content-Disposition` set, `X-Content-Type-Options: nosniff`, user files `private`. **Thumbnails and previews** use content-addressed (hashed) URLs with a long `Cache-Control` and `ETag`, so changing a file changes its URL. Chat history must not mint a fresh link for a file that is in Trash (BE-05).
- Never put a token in a URL or query string other than the signature of a signed URL.

**Principles.** 9 (private for personalised, immutable for hashed assets, no `Set-Cookie`/`Authorization` in shared cache), 37 (`ETag`/`If-None-Match`, `Cache-Control`), 49 (URL changes when content changes, small renditions), 21 and 42 (no tokens in URLs, no bearer to the storage origin), 10 (never cache error responses).

**Today.** Signed URLs use the 15-minute Library TTL (good). `ETag` is exposed in CORS and used on upload parts only. No `Cache-Control` or `ETag` on `/library` JSON (searched). No `thumbnailUrl`.

**Applies to.** BE-01, BE-05, BE-06, BE-12.

### C-06. Event streams and long-running work

**Rule.**

- **Chat stream (SSE).** `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, no proxy buffering, a heartbeat comment about every 15 seconds. Checks that decide the HTTP status (auth, `file_gone`, `file_locked`, too many files) run **before** the first byte. A failure after streaming starts is sent as an explicit error event with `code`, `message` and `requestId`.
- **Event shape.** Every event has `type`, a monotonic `id`, and a protocol `version`; custom events (`routine_proposal`, `routine_created`, `library_shared`, tool progress labels) are self-describing, carry the entity `id` and a timestamp, and are safe to apply twice and out of order. The same events that change what a chat shows are **also stored with the message and returned by `GET /chats/{id}/messages`**, so a reload shows the same card. Replay by `Last-Event-ID` where the stream supports reconnect. New event shapes are added to `docs/api/SSE_EVENTS v2.md` with a schema.
- **Long-running work is a status resource, not a guess.** Uploads, processing, transcripts, routine runs and removals expose an explicit status enum with terminal states and, where known, `progress` and `updatedAt`, so the front end can poll until done and stop. Status endpoints take **batches** (`GET /library/uploads?ids=a,b,c`) so ten uploads do not exceed the client rate limiter (100 requests a minute).
- Never stream another person's data on a shared channel; authorise per user on every stream.

**Principles.** 36 (event ids, replay, heartbeats, idempotent out-of-order handlers, pollable job status, per-user authorisation), 44 (typed events with ids and version, heartbeat, replay or gap fetch), 7 and 41 (no buffering, status decided before streaming), 19 (status is already 200 mid-stream), 20 (status fields so busy states can be announced), 9 and 10 (never cache streams).

**Today.** Chat SSE exists and the front end proxies it with `no-cache, no-transform` (`src/app/api/chat/route.ts`). `GET /library/uploads?ids=` already batches. Custom Library events do not exist yet; the front-end repo has no SSE parsing for them (BE-07, BE-08). The Library front end deliberately uses polling for status and no socket (06, principles 36 and 44).

**Applies to.** BE-02, BE-03, BE-04, BE-06, BE-07, BE-08.

### C-07. Security and authorisation

**Rule.**

- **Authorise on the server, on every endpoint and every read path**, including retrieval, thumbnails, previews, chat history links and Slack. One resolver decides access (04 section 6.1). Scope every query to the caller's user and organisation; never trust a client-sent user id, role, flag or tenant. Admin force-off beats a client `saveToLibrary: true`.
- **Do not leak existence.** `file_locked` (403) is only for someone who was linked to the file (a share, a chat attachment); anyone else gets `404 file_gone`. A locked or gone response carries no title, owner, size or snippet (04 section 7).
- **Return minimal DTOs.** No storage keys, bucket paths, internal ids or whole rows.
- **Validate every input on the server** with a schema: unknown fields rejected, enums checked, numbers with a server ceiling, titles stripped of control characters and path separators and capped at 255.
- **Uploads:** detect the real type from magic bytes (not the extension or the client's content type), enforce size and dimension limits, scan for malware, refuse encrypted or unreadable files before the file exists, re-encode user images and strip EXIF and GPS.
- **Rate limits** with `429` and `Retry-After` on uploads, shares, access requests and search. Messages that could reveal whether something exists are generic.
- State is never changed by `GET`. CORS stays an explicit origin list (it is today); cookie-authenticated writes check Origin.
- **Sessions and sensitive actions:** removing a member ends their access and routine grants at once; a revoked session stops working server-side; re-authentication for sensitive actions where the product has them. Slack calls use a purpose-issued token, never a forwarded browser session.
- Log security events (permission failures, refused uploads, share and removal) with ids only.

**Principles.** 21 (authorise every endpoint, scope queries, minimal DTOs, schema validation, upload checks, rate limits, no state change on GET, CORS), 42 and 43 (never trust client identity, ownership at the data layer, revoked sessions, purpose-issued tokens), 49 (magic bytes, re-encode, strip metadata), 41 (authorise again in the service, the front-end proxy is not a trust boundary), 35 (server re-validates, limits and uniqueness checked server side), 32 (HttpOnly session cookies, CSRF checks, no reliance on client storage).

**Today.** Access resolution is in `services/library/library.py` (`open`, `owned`, `adminCanManage`). CORS has one allowed origin. There is no rate limiting in `services/library` (the only 429 in the backend is the LLM concurrency guard, `services/llm/concurrency.py`), no `Cache-Control` on Library responses, and no `traceparent` or OpenTelemetry handling (all searched). `uploads.py` creates the file before refusal checks run (BE-02). Nothing raises `unsafe` on the server (BE-02). 04 sections 6.1, 7 and 7b already ask for most of this.

**Applies to.** All items; most strongly BE-02, BE-08, BE-09, BE-10, BE-11.

### C-08. Observability

**Rule.**

- Accept and propagate a W3C `traceparent` and return `X-Request-Id` on **every** response, errors included (the middleware does this); put the same id in the error body (C-01).
- Structured server logs carry the request id, route, release, and a user or session **id** only. File names, extracted text, tokens, emails and request bodies stay out of logs and analytics (04 section 7).
- 4xx are expected user errors; 5xx are real faults. Do not return 5xx for something the person caused, and do not return 4xx for a transient server fault, so alerts on 5xx spikes mean something.
- Emit named signals for the critical flows so the front end and dashboards can line up: upload (by outcome and reason), send with files, share, restore, delete forever, routine run (by kind and outcome), member removal and transfer, settings change. *Proposed:* one structured log event and one counter per flow, tagged by outcome and `code`.

**Principles.** 55 (request id and trace propagation, 4xx vs 5xx, structured logs without personal data, critical-flow signals), 19 (server logs the reference), 45 (`x-request-id` on every response).

**Today.** `X-Request-Id` is set and exposed. The error body does not carry it. No `traceparent` handling found. 04 section 8 lists the metrics.

**Applies to.** All items.

### C-09. Contract, documentation and compatibility

**Rule.**

- Every endpoint and schema in this ticket is documented in `back-end/openapi.yaml` with request, response, **error** examples and the codes in each item's table, so the front end's contract test can run in CI and types are generated, not hand-written.
- Changes are **additive**: a new field is optional; a field is never renamed or removed without a deprecation period (`Deprecation` and `Sunset` headers) and a note to the front end. Where this ticket corrects a name (B's `generatedFrom` / `usedFiles` became `provenance` / `runInputs`), the old name stays until the front end confirms.
- Payloads are strictly typed, camelCase, with ISO-8601 instants and ids as strings. Resources are nouns in plural collections; where an action is not a resource it is a clearly named sub-resource (`.../confirm`, `.../answer`, `.../restore`), and no new endpoint puts a verb in the root of the path.
- Keep old and new clients working across a rollout window (04 section 9 feature flags: `library`, `auto_save`, `ai_use`, `sharing`).
- Contract tests on the backend side check every documented error code and shape so they do not drift.

**Principles.** 37 (OpenAPI as source of truth, additive changes, `Deprecation`/`Sunset`, nouns), 43 and 45 (backward compatible across a rollout window, contract tests against OpenAPI), `base-primitive-rules.md` (the front end adapts to and documents the contract rather than changing it).

**Today.** The front end hand-maintains Zod schemas beside `openapi.yaml` (37, FE observation), so any undocumented field is invisible to the contract test. 04 5b asks for OpenAPI coverage.

**Applies to.** All items.

### C-10. Messages and metadata that make the product accessible

**Rule.** The text a failure carries must make sense read aloud with no colour or icon: say what happened and what to do ("This file is password-protected, so it can't be added."). A busy state is a status field (`phase`, `status`), never only an animation. Audio files carry a transcript (BE-06); files carry a name and type the front end can use as accessible text; a signed link that expires says so with a distinct code (`upload_url_expired`) instead of failing silently.

**Principles.** 20 (errors described in text and announced, busy states announced, transcripts for audio, do not rely on timeouts), 45 (`upload_url_expired`).

**Today.** Upload refusal reasons exist in the schema (`failureReason`) but are not produced (BE-02). The audio preview has no transcript (BE-06).

**Applies to.** BE-02, BE-06, BE-07.

### C-11. Images and thumbnails

**Rule.** List rows carry a small server-made **thumbnail rendition** (`thumbnailUrl`, `thumbnailWidth`, `thumbnailHeight`, about 20 KB or less, `Cache-Control: private, max-age`, `ETag`, hashed URL), so a list never loads originals and does not shift while loading. Absent for formats with no thumbnail (the front end shows the type icon). User-uploaded images are re-encoded and stripped of EXIF and GPS on upload (C-07). Authenticated image URLs must work in a plain `<img>`: signed, short-lived, no bearer header.

**Principles.** 49, 48, 56 (small renditions, explicit width and height, image weight budget, URL changes with content), 04 5b.

**Today.** `FileRow` has no thumbnail fields (read in `services/library/schemas.py`). 04 5b already asks for them.

**Applies to.** BE-12 (list rows), BE-02 (re-encode on upload), BE-06.

### C-12. One call per screen, and screens that degrade

**Rule.**

- A screen that needs several small facts gets them in one call. `GET /library/files/suggested` already returns the three Suggested lists; add `GET /library/summary` returning `{sharedWithMeCount, unreadSharedCount, trashCount, storage}` with **approximate** counts allowed, so the header tabs and unread dot need no list request.
- A partial failure is expressed per section: if the Generated list fails, Suggested still returns Recent and Frequently used with an `error` on the failed section instead of a whole-page 500, and never `200` with empty data and no signal.
- Every downstream call the Library makes (storage, scanner, transcription, Slack) has a timeout, retries only idempotent calls, and fails fast with a clear code; the front end shows stale data with a "couldn't refresh" banner.

**Principles.** 41 (one request per screen, partial failure per section, no swallowed errors, timeouts), 37 (sparse fields or includes), 30 and 38.

**Today.** The front end checks "is anything shared" by listing files (`useHasShared` in `src/lib/library/queries.ts`), because no summary exists. Suggested returns one object; a failure in one list fails the call.

**Applies to.** BE-12, BE-01 (settings read), BE-04.

---

## Part 1. Where every flow stands

| Flow | What it covers | Result today | Backend items | Front end |
|---|---|---|---|---|
| **A** Capture and reuse | Auto-save, staging, provenance, same file twice, bad files, picker, sources, recordings, search switch, no-save chat | Mixed. A2, A8, A12 and Depth 1 pass. A3, A5, A6, A7 (corrupt and locked), A13, A14 fail. A1 and A4 wait for settings endpoints | BE-01 to BE-04, BE-06 | Built; settings and save choice behind a flag |
| **B** Set up a routine | Attach files on create, test run, attached files, run outputs, privacy | B4 partial (front end fixed). B1 to B3, B-d1, B-d2 blocked. B5 fails. B6 partial | BE-07 | Cards and sections built, waiting on events and fields |
| **C** A routine run saves its output | Output rows, message-only runs, failed runs, Slack "ready", provenance, double Run now, skipped files | C1, C3 to C6, C9, C-d1 pass. C2 partial. C7 blocked (no Slack). C8, C-d2 blocked | BE-07 | Built; double Run now and "Private" fixed |
| **D** Ask in Slack | Library answers in Slack, save from Slack, find, locked file, request access | 8 of 9 checks blocked: Slack is not connected and the code is not built. D4 partial | BE-09, BE-10 | Locked panel fixed; Request access built behind a flag |
| **E** Share files | Share dialog, Shared tab, unread, share by asking, admin over workspace shares | Dialog side passes (E1 to E5, E10, E11). E7, E8, E-d1 (chat half) fail. E9 blocked | BE-08, BE-12 | Dialog side built; chat confirmation with Undo not built (needs an event) |
| **F** Delete and restore | Trash, delete forever, empty trash, delete a chat, deleted links, answers | F1, F3, F5 to F8 pass. F2, F4, F9, F10 partial. F11, F-d1, F-d2 blocked | BE-04, BE-05, BE-07 | Built; File page "No longer available" fixed |
| **G** Admin sets the switches | Admin settings, member view, notice, Phase 2 pages, removing a member, leaving | **Done (G1 to G9, G-d1, G-d2), tested against a stand-in for the missing settings endpoints.** Pass: G5. Partial: G1, G2, G3, G4, G8, G9. **Blocked (backend): G6, G7, G-d1, G-d2.** Backend causes: no prefs or org-settings endpoints, send ignores `saveToLibrary` and force-off, AI reference not enforced, removal and leave are one step and ignore Library files | BE-01, BE-03, BE-04, BE-11 | Notice restored, chat note, wording, MiB, Audit log and Inventory pages, all behind the flag |
| **H** Browse and find | Header, Suggested, All files, filter, sort, menus, search, Shared, Trash, states, narrow window | **Done (25 checks, 4 depth items, every-flow list).** Pass: H1, H5 to H7, H9 to H11, H13 to H17, H21 to H25, H-d1 to H-d4 (H10, H11 and H25 after front-end fixes). Partial: H2, H3, H4, H8, H12, H18, H20. **Fail (backend): H19.** Backend causes: Shared tab holds files you own, Source: Shared means the opposite of the prototype, search matches any one word, routine origin missing on Generated, Recent order uses a time the card does not show | BE-12 (also BE-06, BE-07) | Seven fixes made: Shared-tab check, search label, Recent dot, Sort and Filter ticks, sparkle tooltip, narrow layout, Processing badge |
| **All flows** (X1 to X13) | Wording, roles, states, accessibility, icons, no upload | **Done.** 12 pass (X12 after a front-end fix), X3 partial: the Uploading state cannot be shown because no file is ever returned while uploading (`FileDetail.phase` is always `"ready"`) | BE-02 R1 and R9 | Icon box removed, unused "Items" string removed |

### Flow G results by check (G1 to G9, G-d1, G-d2; run live 2026-10-19)

The checkpoint ticket numbers these as in the prototype (G1 to G9, G-d1, G-d2); the doc-12 ids used elsewhere in this ticket are G-C01 to G-C09, G-D01, G-D02 in the same order. Stand-ins: admin "You" = test01@email.com, member "Maya" = "OS8 Test01"; no Sam exists; "Payment terms" and "Return policy 2026" do not exist here, so test files `g2-return-note` ("Return window is 45 days") and `g8-payment-terms`, both Maya's, were used.

**How it was tested.** The backend has no `/library/prefs` or `/library/org-settings` (live: both `404` for You and Maya), so with `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` turned on for the run, **both endpoints were answered by a local stand-in in the test browser that follows the contract in BE-01**. Everything else was the real app and backend (`GET /library/storage`, chat send, Library lists, Members). Nothing was removed or transferred: Remove was opened and cancelled, and G7 and G-d1 were checked by reading code. The stand-in started at Always / Force off / AI reference on, was set to Ask each time, then Force on and AI reference off, and set back and confirmed after reload. The flag was taken out of `.env.local` afterwards. So these results prove the screens, not the backend.

| Result | Checks | Notes |
|---|---|---|
| **Pass** | G5 (Audit log and Inventory, static, "Phase 2", Admin only; front end only, behind the flag) | Were not built; now built |
| **Partial** | **G1** (every row and the real Storage figure show; "of 20 GB" only when the API gives a limit, `limitBytes: null` today; File size limit read "52 MB" for 50 MiB, fixed; with the real backend the card says "Couldn't load your files"), **G2** (row and send pass in the front end: "Never", disabled, `saveToLibrary=false`, no dialog; **backend still saves**: both test files are in Maya's All files), **G3** (switch off and disabled with the line; chat note was missing, now built; browse, search "return" and Add from Library work; the switch changes nothing server side), **G4** (Admin pages gone for Maya; the "Your Admin changed Library settings" notice was missing on the Library page, now restored with up to three lines, Dismiss, gone after reload; needs `settingsChanges` from the backend), **G8** (row shows "Using your workspace's default" and "Ask each time"; the send asks "Save 1 file to Library?" with Save focused; Don't save gives "Not saved. It stays in this chat."; the file was saved anyway), **G9** (with the file added from Library: "Your return window is 45 days."; with nothing added the agent searched and said "Which store or policy document should I check? I don't have your return policy in this chat.") | Backend causes: BE-01, BE-03, BE-04 |
| **Blocked (backend)** | **G6** (Remove shows an inline Cancel and Confirm remove with no question and removes at once), **G7** (no Yes or No and no transfer; offboarding never touches Library files; not run), **G-d1** (Who has access would keep listing the person; "Viewing as" is prototype-only; not run), **G-d2** (there is no Leave in the UI: the only one is off, `SHOW_DANGER_ZONE = false`; the backend leave route has no question) | BE-11 |

### Flow H results by check (25 checks and 4 depth items, run live 2026-10-19)

Test data: admin "You" (61 files, 18 Generated) and Maya (31 files); Maya stands in for Sam, and no third person exists, so the "+2" avatar and "As Sam" were not tested. Counts were compared with `GET /library/files` for each filter, not with the prototype's 15/4/11/8.

| Result | Checks | Notes |
|---|---|---|
| **Pass** | H1, H5, H6, H7, H9, H13, H14, H15, H16, H17, H21, H22, H23, H24, H-d1, H-d2, H-d3, H-d4 | Download really downloads; Ask about this opens a new chat with the file attached; Loading, Empty and Error pass on Suggested, All files, Shared, Trash and search |
| **Pass after a front-end fix** | H10, H11 (ticks on the chosen option), H25 (at 800 px and below the Name column shrank to nothing; now Type, then the date, give way) | |
| **Partial** | H2 (Shared tab appears for someone who only shared out), H3 (Recent order can disagree with the line shown), H4 (Generated holds chat images, no "Run of" line), H8 (routine wording needs the routine origin; tooltip itself fixed in the front end), H12 (counts match the API, but Source: Shared means only shared with you), H18 ("net 30" returns 15 files, recording never found), H20 (Shared list also holds files you own) | Backend causes are R1 to R6 of BE-12 |
| **Fail (backend)** | H19 ("In Shared" returned files You own) | BE-12 R1 |

### All flows results by check (X1 to X13, run live 2026-10-19)

| Result | Checks | Notes |
|---|---|---|
| **Pass** | X1 (no banned words; an unused "Items moved to Trash…" string was removed), X2, X4, X5, X6, X7 (search clears on leaving, stays on open and close; no state switch exists in the real app), X8, X9, X10, X11, X13 | Only File, Trash, Upload and Output appear; roles, states, status words, tabs, Recent wording, Filter and Sort, "N used", no upload control |
| **Fixed in the front end** | X12 (file icons sat in tinted rounded boxes; the box is gone in `FormatGlyph.tsx`, the tint stays on the icon) | No On or Off word on any switch |
| **Partial (backend)** | X3 (Ready, In Trash, Locked, Processing and failed all have a look; **Uploading cannot be shown** because no file is returned while uploading, `FileDetail.phase` is always `"ready"`) | BE-02 R1 and R9 |

---

## Part 2. Backend work

**Suggested order.** BE-02 and BE-03 first (everything about saving builds on them), then BE-01 (same send path), then BE-04, then BE-05, BE-07, BE-09, BE-11, BE-12, BE-08, BE-06, and BE-10 last (it needs Slack connected to test). In parallel, the cross-cutting rules in Part 0 (C-01 error body, C-02 idempotency, C-04 real keyset cursor) should land first, because every item below returns errors and most create things.

**Each item uses this layout:** Covers, Seen live, Where in the code, Requirements (with contracts), Errors, Data, Edge cases, Authorisation, Observability, Front end, Rollout, Acceptance tests.

---

### BE-01. Library settings: personal prefs, workspace settings, and enforcing them

**Covers:** A1, A4; Flow G checks G1 to G5, G8 (doc-12 ids G-C01 to G-C05, G-C08). **Blocks:** A4 live test, and re-running Flow G against the real backend. **Related:** BE-03 (send), BE-04 (retrieval switch).

**Seen live.**
- `GET /library/prefs` and `GET /library/org-settings` return `404 {"detail":"Not Found"}` for both accounts.
- `GET /library/limits` returns `{maxFileBytes: 52428800, allowedFormats: [...], extensions: {...}}` but nothing lets an Admin change it.
- A file attached in a chat is always saved. Retrieval never checks an AI-reference switch.
- `GET /library/storage` returns `limitBytes: null`, so "`<used>` of `<total>` used" (G1) can only show "`<used>` used" today. Live: `usedBytes` 52,620,839 (You) and 12,403,438 (Maya).
- **Flow G, with the contract answered by a stand-in:** the Admin page lists every row with the real Storage figure; Auto-save default Ask each time, Force auto-save off on (the default select turns disabled) and AI reference off all save and show toasts; Maya's Settings, Library then reads "Save files from chats: Your Admin has turned auto-save off, Never (disabled)" and "Search my Library in chats: Your Admin turned this off (off, disabled)", and her Library page shows the notice with three lines. The page needs `settingsChanges` for that notice.

**Where in the code.** `services/library/router.py` has files, trash, storage, limits and uploads only. `services/document/retrieval.py` and `chat/service.py` `injected_document_context` are where the AI switch must be read. Limits come from `services/document/settings/library.yaml`.

**Requirements.**

R1. `GET /library/prefs` (any signed-in user) returns *(the front end reads these)*:
```json
{
  "autoSave": null,
  "aiReferenceEnabled": true,
  "effectiveAutoSave": "always",
  "forcedOff": false,
  "aiReferenceAllowed": true,
  "settingsChangedAt": "2026-10-18T09:12:00Z",
  "settingsChanges": [ { "key": "defaultAutoSave", "at": "2026-10-18T09:12:00Z", "text": "Auto-save default is now Ask each time" } ]
}
```
`autoSave` is the person's own choice (`always|ask|never`) or `null` if they never chose. `effectiveAutoSave` is computed server side: force-off gives `never`, else the person's choice, else the workspace default. `forcedOff` and `aiReferenceAllowed` say why a control is disabled. `settingsChanges` powers the one-time "Your Admin changed Library settings" notice and may ship later.

R2. `PATCH /library/prefs` accepts only `autoSave` and `aiReferenceEnabled`, each as the desired end state; any other field is `400`. Returns the full recomputed prefs (C-03). Repeating the call changes nothing (C-02).

R3. `GET /library/org-settings` (Admin only, `403 forbidden` for members):
```json
{
  "defaultAutoSave": "always", "forceAutoSaveOff": false, "aiReferenceEnabled": true,
  "maxFileBytes": 52428800, "allowedFormats": ["document","sheet","image","audio"],
  "version": 7, "updatedBy": { "id": "u_1", "name": "Alex" }, "updatedAt": "2026-10-18T09:12:00Z"
}
```
`allowedFormats` uses the same values as `LibraryFile.format`.

R4. `PATCH /library/org-settings` (Admin only) takes any of those fields as end state, and an `If-Match: <version>` header. A stale version still wins (Admins are equal); the response carries the new `version`, `updatedBy` and `updatedAt` so the page can say who changed it last. Bump `version` on every write. Validate: `maxFileBytes` between 1 byte and a server ceiling, `allowedFormats` not empty and each a known format; report each as a `fieldErrors` entry (C-01). Append a plain-English line to `settingsChanges` and write an audit entry (04 section 7).

R5. **Enforcement.** The effective settings are read **on the server at the moment they matter**:
- *On send* (BE-03): auto-save mode decides active vs chat-only. Admin force-off beats any client value.
- *On retrieval* (BE-04): when the workspace **or** the person has AI reference off, automatic Library retrieval is off for that person's chats; files attached by hand still work.
- *On upload and limits:* `POST /library/uploads` and `GET /library/limits` read `maxFileBytes` and `allowedFormats` from the org settings, not `library.yaml`. A refusal uses `413 too_large` or `415 unsupported` (BE-02).

R6. **Storage total.** `GET /library/storage` returns `limitBytes` when the workspace has a plan limit and `null` when it does not; the front end shows "`<used>` of `<limit>`" only when it is present. *Decision needed* (Part 4): does a limit exist in this phase?

R7. **Kill switches** (`04` section 9: `GET /library/flags` with `library`, `autoSave`, `aiUse`, `sharing`) are separate from these settings and win over them. A flipped switch writes an audit entry.

**Errors.**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | PATCH has a field this endpoint does not accept |
| 403 | `forbidden` | A member calls either org-settings endpoint |
| 422 | `validation_failed` with `fieldErrors` | `maxFileBytes` above the ceiling or below 1; empty `allowedFormats`; unknown format |

**Data (proposed, `04` sections 3.7 and 3.8).** `LibraryUserPrefs(user_id pk, auto_save null, ai_reference_enabled default true, updated_at)`. `LibraryOrgSettings(org_id pk, default_auto_save default 'always', force_auto_save_off, ai_reference_enabled default true, max_file_bytes, allowed_formats, version, updated_by, updated_at)`. "Chose" means `auto_save is not null`. An individual account with no org uses the defaults. A `LibrarySettingsChange(org_id, key, text, at, by)` log feeds `settingsChanges`.

**Edge cases.**
- A person who never chose follows the workspace default, so changing the default changes their behaviour; a person who chose keeps it unless force-off is on.
- A setting changed between upload and send applies at **send**.
- Two Admins saving at once both succeed; the later write is kept and the earlier Admin is named in the next response.
- Turning force-off on does not delete anyone's saved files; it stops new saves.
- Propagation: AI reference off reaches every chat within 60 seconds; other settings apply to new activity immediately and never touch existing files (`04` section 6.1b).

**Authorisation.** Org settings: Admin of that organisation only, checked on the server; scope by the caller's organisation, never a client-sent org id. Prefs: the caller's own row only.

**Observability.** Structured event on every settings write with `key`, old and new value, actor id and request id (no file data). Counter of `effectiveAutoSave` distribution is useful for the rollout exit criteria.

**Front end.**
- *Built, behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` (off):* both pages (`src/app/(app)/settings/(shell)/library/page.tsx`, `.../(org)/workspace-library/page.tsx`), `src/components/Library/settings/*`, `prefsSchema` / `orgSettingsSchema` and the four calls in `src/lib/library/{schemas,api,queries,mutations}.ts`. Both `useUpdatePrefs` and `useUpdateOrgSettings` (`src/lib/library/mutations.ts`) are optimistic with rollback; on success they replace the cache with the **server's response**, so both `PATCH` calls must return the full entity (C-03), and the org call sends the `version` it holds (the `If-Match` value).
- *Added during Flow G (2026-10-19, same flag):* the "Your Admin changed Library settings" notice back on the Library page (`LibraryHeader.tsx`, `SettingsChangedNotice`, up to three lines, Dismiss, gone after reload; the different notice inside Settings, Library was removed); the composer note "Your Admin has turned off Library search. Attaching files still works." (`src/components/Library/chat/LibrarySearchOffNote.tsx` and a test, on the new-chat page and in an open chat); the wording "Your Admin turned this off"; File size limit counted in MiB like its saved toast (it read "52 MB" for 50 MiB); and the static **Audit log** and **Inventory** pages with a Phase 2 badge in the Admin sidebar (`PhaseTwoPage.tsx`, `(org)/audit-log`, `(org)/inventory`; Maya gets "Only workspace admins can see this page"). tsc and eslint are clean and the Library tests pass (280, plus 10 new for the note and the settings notice). The existing `settingsChangeLines` / `unseenChanges` and the Dismiss rule live in `src/lib/library/settings-notice.ts`.
- *When this ships:* turn the flag on, confirm both pages load, save and toast, re-run G1 to G5, G8 and G9 against the real backend (and G6, G7, G-d1, G-d2 once BE-11 exists), then remove the flag. The flag was off in `.env.local` before Flow G, was turned on for the run, and was taken out again afterwards.

**Rollout.** Additive: new endpoints, new tables, no existing response changes. Ship the endpoints before enforcement so the front end can switch on first.

**Acceptance tests.**
1. New user: `GET /library/prefs` gives `autoSave: null`, `effectiveAutoSave` equal to the workspace default.
2. `PATCH {autoSave: "never"}` twice: same response both times; then sending a file leaves it readable in that chat and absent from `GET /library/files?tab=all`.
3. `PATCH {foo: 1}` returns `400`; `PATCH` with `autoSave: "sometimes"` returns `422` with a field error.
4. Admin sets `forceAutoSaveOff: true`: every member's `effectiveAutoSave` is `never`, `forcedOff` is `true`, and a send with `saveToLibrary: true` still saves nothing.
5. A member calling either org-settings endpoint gets `403`.
6. Admin lowers `maxFileBytes`: an upload above it is refused (`413 too_large`) and `/library/limits` shows the new value. A value above the ceiling is `422` with a field error.
7. Two Admins `PATCH` with the same stale `If-Match`: both return `200`; the second shows the new `version` and `updatedBy`.
8. AI reference off at the workspace: within 60 seconds a chat with nothing attached gets no Library context (BE-04); attaching the file still answers.

---

### BE-02. Upload lifecycle: staged files, discard, no merging of copies, refusing bad files, visible phase

**Covers:** A3, A6, A7, Depth 3, X3. **Blocks:** BE-03 (promotion), BE-04 (sources). **Related:** C-04 (list predicate), C-07 (upload checks).

**Seen live.**
- A3: attach, wait for ready, do not send. The file is in All files, found by search, and removing it with X leaves it in All files (not in Trash).
- A6: the same bytes sent twice give **one** row.
- A7: `.exe` and `.zip` are refused in the browser (pass). A corrupt PDF and a password-protected PDF come back `phase: "ready"` with a `fileId` and become files (fail).
- X3: `FileDetail.phase` is always `"ready"`, so the Uploading and Processing banners can never appear.

**Where in the code.**
- `services/library/uploads.py` `read()` (~line 235) creates an ordinary `Document` as soon as the bytes are read, so every list and search sees it.
- `UploadController.cancel` (~line 150) only works while `phase == "uploading"` and answers `409 upload_done` after.
- `read()` (~line 242) looks for an active `Document` of the same owner with the same `sha256` and points the upload at it (`upload.reused = True`).
- Refusal checks (`ProcessingRejected("password_protected" | "unreadable" | "too_large")`, `services/document/indexing.py` ~lines 135-193) run **after** the file exists. Nothing raises `"unsafe"` (the reason exists only in `schemas.py` `failureReason`).
- Stale-upload job: `uploads.py` ~line 281.

**Requirements.**

R1. **Staged state.** A processed upload that no message has used yet is *staged*: it has a `Document` (so it can be attached and read) but is excluded from `GET /library/files` (all tabs), search, the picker, Suggested, storage totals, counts and the index (no embeddings are written for a staged file, `04` section 4). *Proposed:* `Document.life` enum `staged | chat_only | active | trashed` (the names `04` section 3.1 already uses), with `staged_at` and `staged_expires_at`. Every list predicate adds `life = 'active'` (back it with a partial index so list p95 stays under 300 ms, `04` section 8).

R2. **Promote on send.** When `POST /chats` or `/chats/{id}/stream` carries `libraryFileIds`, each staged file the sender owns becomes `active` or `chat_only` per BE-03's rule. Idempotent: promoting twice is a no-op.

R3. **Discard.** `DELETE /library/uploads/{id}` works at any time before promotion:
- If the upload produced a **new** staged `Document`: delete the S3 object, thumbnail, extracted text, pages and embeddings, and the row, all in one go (derived data carries lineage so nothing is orphaned).
- It never touches an existing active file (see R5 for why that case no longer exists).
- `204` both ways; `409 upload_done` only if a send already promoted it.

R4. **Cleanup.** A staged document not promoted within `staged_expires_at` (24 hours) is purged by the existing stale-upload job with the same rules as discard, and abandoned multipart sessions are aborted.

R5. **One upload, one file.** Every upload makes its own `Document` (own id, `created_at`, name, origin chat), even when the bytes match an existing file of the same owner. De-duplication, if wanted for cost, lives at the **storage layer only**: several rows of one owner may share one S3 object and one set of extracted pages and embeddings, reference-counted, deleted when the last row is purged. Never share an object **across owners** and never answer "already exists" (`04` section 7b). This removes the A3 risk of discarding a file the person already had.

R6. **Refuse before ready, leave no row.** Before `phase = "ready"` run, in the one `processing` service (`04` section 4): content-type sniff from magic bytes, size and dimension limits, malware scan, encryption check (PDF `/Encrypt`, Office encryption flag), zip-bomb and decode checks, and a real parse with the same extractor indexing uses. On any failure: `phase = "failed"`, a `failureReason` from the fixed list, delete the staged S3 object, create **no** `Document`. Technical detail goes to logs and an opaque `detailsId` only.

R7. **Unsafe gate.** Executables, scripts and archives fail as `unsafe` by content, not extension: `tool.exe` renamed to `tool.pdf` must still be refused. Re-encode user images and strip EXIF and GPS (C-07).

R8. **Late indexing failure.** If indexing can still fail after `ready` (for example an OCR timeout), either retry (bounded, `04` section 4: after 10 minutes the file is flagged `slow`, retried once, then failed as `unreadable` and removed) or hide it from lists; it must never be a visible broken file. *Decision in Part 4.*

R9. **Visible phase.** `GET /library/files/{id}` for the **owner** returns a staged or processing file with `phase: "uploading" | "processing" | "ready" | "failed"` (it stays out of lists). `GET /library/uploads?ids=a,b,c` (exists) returns `{id, phase, slow, failureReason?, detailsId?, fileId?}[]`; cap `ids` at 50 (`400` above that).

R10. **Init-time refusals.** `POST /library/uploads` is rate limited, refuses before storing when size or type is wrong (`413 too_large`, `415 unsupported`) using `maxFileBytes` and `allowedFormats` from BE-01, and accepts an `Idempotency-Key` (C-02), so a retried init does not make two uploads.

**State machine.**
```
init -> uploading --complete--> processing --ok--> ready(staged) --send--> active | chat_only
          |                         |                   |
          cancel                    fail                X or 24 h
          v                         v                   v
        removed                  failed (no row)      purged
```

**Errors.**

| Status | Code | When |
|---|---|---|
| 413 | `too_large` | Over `maxFileBytes` at init or found at parse |
| 415 | `unsupported` | Type not in `allowedFormats` |
| (status resource) | `password_protected`, `unreadable`, `unsafe` | Reported as `failureReason` on the upload, not as an HTTP error, because processing is asynchronous |
| 409 | `upload_done` | Discard after a send promoted the file |
| 410/404 | `upload_gone` | Discard or status for an upload that was already removed |
| 429 | `rate_limited` | Too many uploads per minute for this user (`Retry-After`) |
| 400 | `bad_request` | More than 50 ids in a status call |

**Data.** `Document.life`, `staged_at`, `staged_expires_at`; storage refcount (a `StorageObject(key, refs)` table or `Document.s3_key` shared with a counter); index on `(user_id, life)`. Migration backfills existing rows to `active`.

**Edge cases.**
- Dedup and staging: a copy of an active file is a new staged row; deleting it never touches the original.
- An upload finishing after its chat was deleted or the user was removed: purge (`04` section 6.7).
- A file moves from Processing to `failed` after the person has already pressed Send: Send was blocked while it processed (front end), and the server refuses `libraryFileIds` for a non-ready file (`409 not_ready`).
- Processing is bounded and idempotent (a retry of the same job gives the same result).

**Authorisation.** An upload, its status and its discard belong to the uploader; anyone else gets `404`. `libraryFileIds` on a send must pass the single access resolver (C-07).

**Observability.** One event per upload outcome with `reason`, size bucket, format, duration; counters for scan hits, `slow` flags, staged purges (`04` section 8).

**Front end.**
- *Built:* the composer uploads into Library on attach with chip states Uploading, Processing, ready and Send waiting (A2 passes). A refused upload leaves the composer, is never sent, and its reason shows once above the composer for 6 seconds without a file name (`UploadNotices`). Program extensions are blocked as `unsafe` in `src/lib/library/upload/validate.ts` (a convenience, not a control). The composer already calls cancel on X (`cancelComposerUpload`). The Uploading and Processing banners exist in `FileStates.tsx` (`FileStates.test.tsx`).
- *Reads exactly:* `id`, `phase`, `slow`, `failureReason`, `fileId` from `GET /library/uploads?ids=` (the existing `UploadStatus`; `detailsId` is the optional addition `04` section 5b names) (polling 2 s for the first ten polls, then up to 10 s, stops at a terminal phase, `refetchInterval`, 36); `FileDetail.phase` for the banner.
- *Needed:* nothing new for R1 to R8; cancel on a ready upload starts working by itself. After R9 the banner has data.

**Rollout.** Ship staging and discard together (the front end already calls both). Ship R5 (no merge) with a migration note: existing merged rows are untouched. R6 and R7 can ship later than R1 to R5 without breaking anything.

**Acceptance tests.**
1. Attach, wait for ready, do not send: not in All files, search, picker or Suggested; `GET /library/storage` unchanged; `GET /library/files/{id}` as the owner returns `phase: "ready"`, as Maya `404`.
2. Send: the file appears in All files.
3. Attach, wait for ready, press X: `DELETE /library/uploads/{id}` returns `204`; the file is nowhere, including Trash; S3 object gone.
4. Attach a copy of a file already in Library, press X: the original is still there and readable.
5. Close the tab with a staged file: after the cleanup window it is gone.
6. Send the same file twice: two rows, same name, different Created. Rename, share or delete one: the other is unchanged; deleting one keeps the other readable.
7. Upload a corrupt PDF, a password-protected PDF, and an `.exe` renamed `.pdf`: each ends `failed` with the right `failureReason`, no `Document` row, no S3 object, nothing in All files.
8. Repeat `POST /library/uploads` with the same `Idempotency-Key`: the same upload id, one S3 session.
9. A status call with 51 ids returns `400`.
10. While a large file uploads, open it by id as the owner: `phase: "uploading"`, then `"processing"`, then `"ready"`.

---

### BE-03. Chat send: honour the "save" choices, and link a new file to its chat

**Covers:** A4, A5, A14; G-C08. **Depends on:** BE-02 (staging), BE-01 (prefs). **Related:** C-02, C-06.

**Seen live.**
- A4 cannot be checked (no prefs endpoint).
- A5: a file attached in an **open** chat reads "Uploaded by You, <chat>" with a link (pass, after a front-end fix that sends `chatId` on `POST /library/uploads`). In a **new** chat it reads "Uploaded by You" with no link (fail).
- A14: with "Don't save files from this chat" on, the request carries `saveToLibrary=false` and the file is **still saved**.
- Flow G (G2, G8): with Force auto-save off (stand-in), a send shows the toast "Your Admin has turned auto-save off" and posts `saveToLibrary=false`; with Ask each time, Don't save posts `false` too. `GET /library/files?tab=all&q=g2-return` and `q=g8-payment` as Maya **still list both files** (owner "OS8 Test01").

**Where in the code.** In a new chat the chat does not exist when `POST /library/uploads` runs, so `Document.origin_chat_id` stays null (`uploads.py` `read()` ~line 251). Nothing reads `saveToLibrary` on `POST /chats` (create) or `/chats/{id}/stream`. Before A2, `document/workspace.py` (~line 439) set the origin itself.

**Requirements.**

R1. **Request fields** on `POST /chats` and `POST /chats/{id}/stream`: `libraryFileIds: string[]` (exists), `saveToLibrary?: boolean`, `librarySourcesOff?: string[]` (BE-04). Unknown fields are rejected. Both accept `Idempotency-Key` (C-02) so a retried send does not attach or promote twice.

R2. **Who decides what happens to each attached file.** Evaluated on the server at send time, in this order, first match wins:

| # | Condition | Result |
|---|---|---|
| 1 | Admin force-off is on | `chat_only` (a client `true` is ignored) |
| 2 | The chat has `libraryDontSave` | `chat_only` |
| 3 | `saveToLibrary` is `false` | `chat_only` |
| 4 | `saveToLibrary` is `true` | `active` |
| 5 | `saveToLibrary` absent | follow `effectiveAutoSave`: `always` gives `active`; `ask` and `never` give `chat_only` |

Only staged files **owned by the sender** change state. A file that is already `active` (picked from Library) is never demoted or re-owned. A `chat_only` file works in this chat (the model can read it, it shows on the message) but is not in All files, the picker, search, Suggested or counts; it is deleted with the chat.

R3. **Origin chat.** On promotion set `origin_chat_id` to the chat for each document that the sender owns and that has `origin_chat_id IS NULL`. Never overwrite an existing origin. Applies to both `active` and `chat_only`.

R4. **Per-chat flag.** Store `Chatboard.library_dont_save bool`. `PATCH /chats/{id} {libraryDontSave: true|false}` sets the end state; `GET /chats/{id}` returns it; it is applied on every send even when the client sends nothing.

R5. **Order and failure.** Promotion runs **after the message is persisted**. If it fails the message still sends; the file stays `chat_only` with a retry state and a bounded background retry (`04` section 4); the end-of-turn event reports `savedFileIds` and `chatOnlyFileIds` so the front end can say "Not saved" accurately.

R6. **Checks before the stream opens** (C-06): every `libraryFileIds` entry passes the single access resolver; a trashed file is `404 file_gone` (BE-05); a file the sender cannot open is `403 file_locked`; more files than `maxFilesPerMessage` (from `/library/limits`) is `422` with a field error `too_many_files`; a file still processing is `409 not_ready`.

**Errors.**

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Unknown request field |
| 403 | `file_locked` | A listed file the sender cannot open |
| 404 | `file_gone` | A listed file that is gone or in Trash |
| 409 | `not_ready` | A listed file is still uploading or processing |
| 422 | `too_many_files` (field `libraryFileIds`) | Over the per-message limit |

**Data.** `Chatboard.library_dont_save` (default false); `Document.origin_chat_id` (exists); promotion retry fields (`save_state`, `save_attempts`, `04` section 4).

**Edge cases.**
- Setting changed between attach and send: the setting at send time applies.
- `ask`: the front end asks **before** sending and sends an explicit true or false, so the backend does **not** need an `ask_save` stream event or `POST /library/uploads/resolve` (the earlier design in `04` section 4 is dropped).
- Regenerate or replace a turn: the files stay (they are files, not message-owned).
- Deleting the chat deletes its `chat_only` files; its `active` files stay (BE-05).

**Authorisation.** Admin force-off and the chat flag are read from the server, never from the request. The sender can only promote files they own.

**Observability.** One event per send with counts of `active`, `chat_only`, and the reason code of the deciding rule (1 to 5); counter of promotion failures.

**Front end.**
- *Built:* `useSaveChoice` and `AskSaveDialog`; `saveToLibrary` on `POST /chats`, `POST /chats/{id}/stream` and the proxies `/api/chat`, `/api/persona-chat`; the composer sends `chatId` on upload for open chats; "Don't save files from this chat" in the open chat's More menu (`DontSaveChatItem.tsx`) with the message "Not saved. This chat doesn't save files." and a localStorage copy (`library-dont-save.ts`) until R4 exists.
- *Reads exactly:* `libraryDontSave` on `GET /chats/{id}`; `savedFileIds`, `chatOnlyFileIds` on the end-of-turn event once added; `provenance.chatId` on `GET /library/files/{id}`.
- *Needed after the backend ships:* read `libraryDontSave` from the chat instead of localStorage; turn on `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` (BE-01).

**Rollout.** All new fields optional; old clients that send nothing get the workspace behaviour.

**Acceptance tests.**
1. New chat, attach, send: the file page reads "Uploaded by You, <chat title>" and the link opens that chat. A file picked from Library into a new chat keeps its original provenance.
2. With `ask`: `saveToLibrary: true` gives a file in All files; `false` gives none and the file still works in the chat.
3. With `never` or force-off: `saveToLibrary: true` still saves nothing.
4. `PATCH /chats/{id} {libraryDontSave: true}`, send a file with `saveToLibrary` absent: not in All files, search or picker; other chats still save.
5. The same send repeated with the same `Idempotency-Key`: one message, one promotion.
6. A trashed file id in `libraryFileIds`: `404 file_gone` before any stream byte.

---

### BE-04. Chats use the person's Library, honour "switch off", and say what each attachment is

**Covers:** A10 (without citations), A13 (without citation ids), Depth 2, G-C03, G-C09, F11 (without the citation half). **Depends on:** BE-01 (switch), BE-03 (`librarySourcesOff` field). **Excluded:** citation ids and chips (cited-passages ticket).

**Seen live.**
- A13: with "Search my Library in chats" on and nothing attached, a new chat asked about a fact only in two Library files. The model ran 6 actions and answered "I don't see any files attached to this chat". A chat never searches Library unless a file is attached, so the setting has nothing to switch off.
- A10: the next message sends `librarySourcesOff=["<fileId>"]` and nothing reads it. `GET /chats/{id}/messages` has `file_attachments` with `file_name, s3_key, mime_type, file_size, origin` and no `document_id`.
- Flow G (G9): Maya, new chat, nothing attached, "What is our return window?": the activity showed "Searching for context / Running tool — return window returns refund policy", then "Which store or policy document should I check? I don't have your return policy in this chat." With `g2-return-note` added from Library, the same question answers "Your return window is 45 days." (the pass half, front end only). So the "I couldn't find this in your files." answer does not exist and the AI-reference switch is not read.
- F11: with the file active and in Trash alike, the answer was the agent's own "I couldn't find the Quokka access code." — nothing leaked, but the wording is not the prototype's.

**Where in the code.** `services/document/retrieval.py` (retrieval), `chat/service.py` `injected_document_context`, `services/document/knowledge.py` (~lines 37-60, project knowledge, already drops trashed documents), `chat/repository.py` ~line 135 (`json_build_object` for `file_attachments`).

**Requirements.**

R1. **Automatic retrieval on every turn.** Search the asking user's Library with the same retrieval the attached-file path uses, behind the **access predicate in SQL** (not post-filtering): files the user can open, `life = 'active'`, `phase = 'ready'`, not in this chat's `librarySourcesOff`, **never Trash**, and `source != 'generated'` (no self-contamination, `04` section 6.2b). Hybrid search (words and meaning) across title and content; the model gets the best passages.

R2. **The switch.** Skip R1 when the workspace or the person has AI reference off (BE-01). Evaluated **per message**, so an Admin change reaches the next message and the whole workspace within 60 seconds (`04` section 6.1b). Attached files keep working. The model is told why retrieval is off so it can say so.

R3. **Say when the files do not cover it.** When the question is about the person's files and nothing relevant is found (or the only source is switched off) the answer says "I couldn't find this in your files." and, when a source is switched off, adds "1 source switched off". Emit `groundedness: "none" | "partial" | "grounded"` on the answer event (`04` section 6.2b), plus `files_truncated` and `searchedCount` when limits apply.

R4. **Sources off, stored.** Accept `librarySourcesOff` (array of file ids, same format as `libraryFileIds`) on both chat endpoints; store per chat as `ChatLibrarySourceOff(chat_id, file_id, created_at)` with a unique pair; leave those files out of the always-on context, `searchKnowledge` and the files the turn reads; return the list as `librarySourcesOff` on `GET /chats/{id}`. Sending the full list each time is the end-state write; an empty array clears it (C-02).

R5. **History names the file.** Add `document_id` to each `file_attachments` entry in `GET /chats/{id}/messages` (the row already has it). Keep it after Delete forever (BE-05 R3). The id is the only new field; no storage keys.

R6. **Content is data, not commands** (carry over `04` sections 6.2b and 7b): retrieved text is wrapped as data with provenance markers; hidden text is treated like visible text; any side-effecting action that follows from reading a file needs an explicit confirmation naming the file; the assistant never edits a Library file in place.

**Errors.** No new HTTP errors; refusals are answers, not failures. `ai_reference_off` may be returned by the Library search tool to the model, not to the browser.

**Data.** `ChatLibrarySourceOff`; `groundedness` and `searchedCount` on the persisted answer so a reload shows the same mark.

**Edge cases.**
- Trash and revoke: a file in Trash leaves retrieval at once; a revoked grant leaves retrieval within 60 seconds; do not cache access decisions longer than that.
- A very large Library: bounded search time and page size from settings (not hard-coded); report `searchedCount` and suggest narrowing.
- Fail closed: if the policy resolver cannot decide, retrieve less, never more.
- In a Slack channel the rule is stricter (BE-10).

**Authorisation.** Every retrieved chunk passes the single resolver for the asking user; add the test that fails if a Library query is added without the access predicate (`04` section 7).

**Observability.** Per turn: retrieval on or off and why, number of files searched, groundedness value; counters for "not in your files" answers.

**Front end.**
- *Built:* `ChatSources.tsx` mounts the Sources panel ("Sources · N" beside Share); switching a file off shows "Off for this chat" and sends `librarySourcesOff`; the list is kept in sessionStorage (`src/lib/library/library-sources-off.ts`) until R4. `lib/api/chat.ts` and `message-transformer.ts` already read `document_id` as `libraryFileIds`, so R5 makes earlier files appear after a reload. `LibrarySearchOffNote` shows the "search turned off" note.
- *Reads exactly:* `librarySourcesOff` on the chat; `document_id` on attachments; `groundedness` (not rendered yet).
- *Needed:* read `librarySourcesOff` from the chat instead of sessionStorage; render a mark from `groundedness` if design wants one. Verified so far only with a mocked reply.

**Rollout.** Behind the `ai_use` kill switch (`04` section 9) so retrieval can be turned off per workspace without a deploy.

**Acceptance tests.**
1. Switch on, nothing attached, ask about a fact only in a Library file: the answer uses it. Switch off: "I couldn't find this in your files." Attach the file: answered again.
2. Send a file, open Sources, switch it off, ask again: not used, "1 source switched off". Reload: still off and `GET /chats/{id}` returns the id; files from earlier messages are listed.
3. Put the file in Trash and ask: not used; restore and ask again: used.
4. As Maya, ask about a file only the admin owns: not used (no leak), same wording.
5. Generated run outputs are not retrieved until attached.
6. A file named in a hidden-text instruction cannot trigger an action without confirmation.

---

### BE-05. A chat must not hand out a deleted file, and deleting a chat must be undoable

**Covers:** F2, F4, F9, F10. **Depends on:** BE-03 (origin chat), BE-04 R5 (`document_id` in history). **Related:** C-05 (signed links), C-07 (access).

**Seen live.**
- `GET /chats/{chat}/messages` for a chat where the file was sent returns the attachment with a fresh signed `file_link`; fetching it returned `200` and the file's text while the file was in Trash. The chat chip kept the file name.
- `POST /chats/create` with `libraryFileIds: ["<id of a file in Trash>"]` as its owner returned `200` and created a chat (the aborted test chat was deleted again).
- `DELETE /chats` removed chat E for good (`GET …/messages` is `404`); its two files stayed `active`. With the box ticked the front end trashed the file afterwards. There is no file question from the server and no Undo.
- `GET /library/files/{id}` for files saved by a chat returns `provenance: {kind: "upload", label: "", via: "web", canOpenChat: false}` with no `chatId`, and `file_attachments` has no `document_id`.
- As the owner, a trashed file that Maya also had was `404 file_gone` for Maya, and her Trash stayed empty (correct: only the owner restores).

**Where in the code.**
- `get_chat_messages` (`services/chat/repository.py` ~lines 135-147) returns each attachment's `s3_key`; the schema (`services/chat/schemas.py` ~lines 56-63) signs a link on every read with no check of `Document.trashed_at`.
- `Library.attachable` (`services/library/library.py` ~lines 494-500) calls `open` (~lines 151-159), which lets an owner open their own trashed file; `chat/router.py` (~lines 170, 254) and `persona/router.py` (~lines 383, 452) pass the result straight to the turn.
- `remove_document` (`services/document/indexing.py` ~line 297) sets `MessageFileAttachment.document_id` to NULL.
- `DELETE /chats` (`chat/router.py` ~lines 308-314) goes to `delete_chat` (`chat/service.py` ~lines 963-969) then `hard_delete_chat` (`chat/repository.py` ~line 543). `soft_delete_chat` (~line 523) exists but no route uses it and nothing restores.

**Requirements.**

R1. **No link for a trashed or gone file.** In `GET /chats/{id}/messages` each attachment carries a state resolved **for the reader** (never the same state for everyone):
```json
{ "document_id": "…", "file_name": "Return policy 2026.pdf", "mime_type": "application/pdf", "file_size": 81234, "origin": "uploaded",
  "libraryState": "open", "file_link": "https://…signed…" }
```
`libraryState` is `open | deleted | locked`. A file in Trash or deleted reads `deleted`; a file the reader cannot open reads `locked`. When the state is not `open`, `file_link` is **absent** and `file_name` is withheld for `locked` (no title leak, 04 section 7). No signed link is minted for a file that is not open, so the file's contents are never served after the delete. The front end already reads `document_id`; `libraryState` is new and optional.

R2. **`attachable` refuses a trashed file** for everyone, the owner included: `404 file_gone` on every chat and persona send, before the stream opens (C-06, BE-03 R6). The picker already hides it; the API must too.

R3. **Keep saying what an attachment is, after Delete forever.** Stop NULLing `MessageFileAttachment.document_id`: keep the id (no foreign-key cascade to NULL) and set `document_deleted_at` on the attachment, so history can say `libraryState: "deleted"` instead of showing a name and a dead link. *Proposed:* `ALTER TABLE ... ADD COLUMN document_deleted_at timestamptz`, and change the `document_id` constraint to `ON DELETE NO ACTION` with the purge job setting `document_deleted_at` first. Back-fill old NULLs as "deleted, unknown file".

R4. **A chat's saved files.** The Delete chat dialog needs the files this chat saved, owned by the caller, still `active`:
- *Option A (proposed):* `savedFiles: [{id, title, generated}]` on `GET /chats/{id}` (end state, one call).
- *Option B:* `originChatId` filter on `GET /library/files`.
Either way only files with `origin_chat_id = chat`, `owner = caller`, `life = active` count; files that were only picked from Library are never listed (they have another origin). Needs BE-03 R3.

R5. **Delete a chat and, optionally, its files; undo it.**
- Keep the existing delete route and add `deleteFiles` (boolean, default `false`): when `true`, trash the files from R4 **in the same transaction** and record `Document.trashed_with_chat_id`. The response is `{deletedChatId, savedFiles: n, trashedFileIds: [...]}` so the notice needs no extra read ("Chat deleted. 1 file stays in Library." / "Chat deleted. 1 file in Trash.").
- `DELETE` uses `soft_delete_chat` (sets `deleted_at`, hides the chat and its messages from every list and from retrieval).
- `POST /chats/{id}/restore` (end-state, idempotent) brings back messages, attachments and file links, **and** restores the files trashed by that same delete (`trashed_with_chat_id = chat`) in one transaction. Window: 30 days like Trash (decision in Part 4). A later purge job removes the chat for good; `chat_only` files go with it (BE-03).
- Restoring after the window: `404 chat_gone`.

**Errors.**

| Status | Code | When |
|---|---|---|
| 404 | `file_gone` | Send with a file that is in Trash or deleted |
| 403 | `file_locked` | Send with a file the sender cannot open |
| 404 | `chat_gone` | Restore a chat that is purged or not the caller's |
| 409 | `chat_not_deleted` | Restore a chat that is not deleted (or treat as idempotent `200`; pick one and document it) |

**Data.** `MessageFileAttachment.document_deleted_at`; `Document.trashed_with_chat_id` (nullable); `Chatboard.deleted_at` (exists via the soft-delete mixin) and a purge job; index on `(user_id, deleted_at)`.

**Edge cases.**
- A shared chat: a participant who can read the chat but cannot open the file sees `libraryState: "locked"` and never the name or link (04 section 6.4).
- Restoring a file from Trash makes the attachment `open` again on the next read with a fresh link; nothing is cached (C-05).
- Deleting a chat that the caller does not own is `403`/`404` as today; the files option only ever touches files the caller owns.
- If the file trash step fails, the chat delete still succeeds and the response lists the files that were **not** trashed; the front end never deletes files when the chat is still there.
- Idempotent: deleting an already-deleted chat returns the same `204`/body; restore twice is a no-op.

**Authorisation.** Every attachment state is computed with the single access resolver for the reader. The restore endpoint is limited to the chat's owner.

**Observability.** One event per chat delete (counts of files kept, trashed, failed) and per restore; counter of attach attempts refused with `file_gone`.

**Front end.**
- *Built (done 2026-10-19):* `FileScreen.tsx` shows "No longer available" for a trashed file unless it was opened from a Trash row (`?from=trash`, set in `TrashScreen.tsx`), so a link never shows the name, even to the owner (verified live). `SentLibraryAttachment.tsx` (used by `ChatMessage.tsx`) reads "File deleted" or "Locked file" when an attachment carries `libraryFileId` (from `document_id`); verified by adding `document_id` to the history in the browser, inert until the backend sends it. `DeleteChatHost` in `AppDialogs.tsx` opens the prototype's dialog (`DeleteChatWithFilesDialog`: saved files listed, "Also delete these files" off by default, red Delete, loading state) with files read by `useChatSavedFiles.ts`; while history cannot name them it falls back to the old confirm. With the box ticked it deletes the chat first, then moves the files to Trash, and never touches files if the chat is still there. Notices: "Chat deleted.", "Chat deleted. N file(s) stay(s) in Library.", "Chat deleted. N file(s) in Trash." (`useChatSavedFiles.test.ts`, 6 passing).
- *Reads exactly:* `document_id`, `libraryState`, `file_link` (absent means no link) on attachments; `savedFiles` (or `provenance.chatId`) for the dialog.
- *Not built, needs R5:* an **Undo** action on the "Chat deleted" notice that calls `POST /chats/{id}/restore`. Build it when the endpoint exists.

**Rollout.** R1 to R3 are additive (a new optional field, an extra column). R5's soft delete changes what `DELETE` does for old clients: they still see the chat disappear, so it is safe; schedule the purge job in the same release.

**Acceptance tests.**
1. Send a file in a chat, move it to Trash, reload the chat: the attachment has `libraryState: "deleted"` and no `file_link`; the chip reads "File deleted". Restore: `open`, name and a fresh link return.
2. `POST /chats/create` with a trashed file id returns `404 file_gone` before any stream byte; the picker still does not list it.
3. A chat that saved one file: the dialog's list has exactly that file; a file only picked from Library is not listed.
4. Delete with `deleteFiles=false`: "Chat deleted. 1 file stays in Library." and the file is in All files. With `deleteFiles=true`: "1 file in Trash", Trash lists it with 30 days.
5. `POST /chats/{id}/restore`: the chat is back with messages and chips, and the file is back in All files if it was trashed by that delete. A second restore is harmless.
6. Delete forever a file a chat used: history shows `libraryState: "deleted"`, not the name or a dead link.
7. As a participant of a shared chat who cannot open the file: `libraryState: "locked"`, no name, no link.

---

### BE-06. Recordings: a "Transcribing" step and a transcript on the File page

**Covers:** A11 (without the timed citation), and the recording half of H18 (a recording is never found by search). **Related:** C-06 (events, status), C-10 (transcripts), C-07 (no internal paths).

**Seen live.** With a real speech recording (`supplier-call-a11.wav`, 1.1 MB): upload goes Uploading, Processing, ready; the turn runs the `transcribe_audio` tool; the answer is right. The step row read "Running tool — /sandbox/input/supplier-call-a11.wav" (the front end now shows "Transcribing — <file>"). The File page shows only a player: `services/library/preview.py` ~line 96 returns `AudioPreview(url, durationMs=0, lines=[])`.

**Requirements.**

R1. **Label the step.** Emit `tool_executing` / `tool_progress` for the transcription call with `label: "Transcribing"` and the **file name** as detail. Never send the sandbox path (`/sandbox/input/...`) or any other internal path to the browser (C-07). The front end infers the label from the tool name today; a backend label wins.

R2. **Persist the transcript.** Transcribe once, at upload or the first time it is needed, and store it: `LibraryFileTranscript(file_id, language, status, segments jsonb, created_at)` where `segments` is `[{startMs, endMs, speaker?, text}]` (`04` section 3.9). Derived data is deleted with the file and carries its source file id (`04` section 6.1b).

R3. **Return it from the preview.** `GET /library/files/{id}/preview` for audio returns:
```json
{ "kind": "audio", "url": "https://…signed 15 min…", "durationMs": 74000,
  "transcriptStatus": "ready",
  "lines": [ { "startMs": 0, "endMs": 4200, "speaker": "A", "text": "…" } ],
  "nextLine": null }
```
`transcriptStatus` is `pending | ready | failed` so the page can say "Transcribing…" or "Transcript unavailable" instead of showing an empty list (C-06, C-10). `lines` is windowed like the sheet preview (`lineStart`, `lineCount`, default and maximum set in settings, `nextLine` null at the end) so a long call does not become one huge response (C-04). The audio `url` is a short-lived signed URL (C-05); the front end plays it with `preload="metadata"`.

R4. **Plain text only.** Transcript lines are plain strings, never HTML or markup (21: treat model and transcription output as untrusted; the front end renders structured data as components).

R5. **Access.** The transcript is returned only to someone who can open the file (single resolver). A locked or gone file returns nothing.

R6. **Searchable.** The stored transcript text is indexed so Library search finds a recording by what is said in it (BE-12 R4): in Flow H, "net 30" never found the Supplier call recording because `preview` returns only `{kind: "audio", url}` and nothing transcribes it in Library. The snippet in a result comes from the transcript.

**Errors.**

| Status | Code | When |
|---|---|---|
| 409 | `preview_not_ready` | Preview requested while the file is still processing (code already in use: "The Library preview is not ready…") |
| 200 with `transcriptStatus: "failed"` | | Transcription failed; the file itself still opens and downloads |

**Edge cases.** A recording that is silent or unintelligible returns `ready` with zero lines and `durationMs` set. Transcription is bounded in time; a stuck job is failed and `transcriptStatus: "failed"` is shown, never an endless spinner. Re-asking about the same recording must not transcribe again (R2).

**Authorisation and observability.** As above. One event per transcription with duration, audio length and outcome; no transcript text in logs.

**Front end.**
- *Built:* the step row infers "Transcribing" from the tool name `transcribe_audio` or an audio path (`src/lib/activity.ts` `activityVerb`, verified live). `AudioViewer` renders lines, seeks on click and highlights the line at `?cite=time:<ms>`.
- *Reads exactly:* `durationMs`, `lines[].{startMs,endMs,speaker,text}`; will read `transcriptStatus` once added.
- *Needed:* nothing once lines arrive; show `transcriptStatus` text when it exists.

**Rollout.** Additive. Existing recordings get a transcript on first need (lazy), not a backfill.

**Acceptance tests.**
1. Attach a recording and ask about it: a step labelled "Transcribing <file>" (no path), then the answer.
2. Open the recording's File page: the player plays, transcript lines are listed, clicking a line seeks the player; `transcriptStatus: "ready"`.
3. Open a recording whose transcription is still running: "Transcribing…", not an empty list.
4. Ask about the same recording twice: one transcription event.
5. As Maya on the admin's private recording: `file_locked` / `404`, no lines.

---

### BE-07. Routines (scheduled tasks): attached files, create flow, test run, run outputs, privacy

**Covers:** B1, B2, B3, B5, B6, B-d1, B-d2, C1, C2, C7, C8, C-d1, C-d2, F1, F-d1, and the routine-origin half of H4 and H8 (Generated tiles and the sparkle tooltip). **Related:** C-02 (run twice), C-06 (events), BE-11 (owner removed).

**Seen live (B).** Asking a new chat for a weekly routine gives the generic question card (questions change per run, Library files never mentioned, no Routine details card). Creating "Draft product copy" makes routine `90fd1216…` with `runs: []`, no test run, no card. `GET /automations/{id}` has no file field. Run now works (~21 s) and Library gains `files/Draft_product_copy_2026-10-18.docx`, Source Generated, `generatedFrom: {kind: "chat", label: "Draft product copy"}`. As Maya the routine is listed under **Organization**.

**Seen live (C).** Two runs on one day gave two files with the identical name `files/Draft_product_copy_2026-10-19.docx` (C1). A message-only run adds a "Completed" line and no file but the page still shows Run outputs (C2). `GET /library/files/{id}` returns `provenance: {kind: "chat", label, via: "web", chatId}` for a run output: no `routineId`, `runLabel` or `runInputs` (C8). `POST /automations/{id}/run` twice quickly: both return `200 {"started": true}`, one run is created (C-d1).

**Where in the code.**
- `Automation` (`services/automations/models.py` ~lines 26-90): no file column or join table. `automation_manage create` (`tool.py` ~lines 75-150) takes no file ids; `PATCH /automations/{id}` (`router.py`) only pauses, resumes, renames or edits the summary. `DocumentUse.automation_id` (`services/document/models.py` ~line 98) records files a run *read*, not files *attached*. `create` (`tool.py` ~lines 287-300) never fires a run.
- A run's file reaches Library through `services/document/workspace.py` `library()` (~lines 416-447) with `filename=file.name[:255]`, so `files/…` leaks into the title; `generatedFrom` is always `kind="chat"` (`library.py` ~lines 264, 408).
- `automationDict` (`repository.py` ~line 212) has no output kind; `RunResponse` (`schemas.py` ~line 192) leaves out `AutomationRun.files` (`models.py` ~line 128).
- `GET /automations/organization` (`router.py` ~line 136) returns every other member's live automations.
- `POST /automations/{id}/run` (`router.py` ~lines 184-194) always returns `started: true`; `runner.py` (~lines 350-355) hits `uq_automationrun_one_running` and silently skips.

**Requirements.**

R1. **Attached files.** Add an `AutomationDocument(automation_id, document_id, added_at)` table (or `attached_document_ids`). Set it with an **end-state** call, `PUT /automations/{id}/attached-files {fileIds: [...]}`, owner only, idempotent, returning the updated automation (C-02, C-03). Validate each id with the single resolver *for the routine's owner*, `active` and `ready`, within the per-message file limit; a bad id is a `422` with a field error on `fileIds[i]`. Revalidate at save and again at every run (`04` section 6.6). `GET /automations/{id}` returns:
```json
{ "attachedFiles": [ { "id": "…", "title": "Return policy 2026", "format": "pdf", "state": "ready" } ] }
```
`state` is `ready | trashed | deleted | no_access` so the page can say "unavailable, the next run skips it". Never return the title of a file the **viewer** of this response cannot open.

R2. **Proposal before create.** When the agent is ready to create a routine, it emits a `routine_proposal` event and **stops** (C-06):
```json
{ "type": "routine_proposal", "id": 41, "version": 1, "messageId": "…",
  "proposalId": "…", "name": "Draft product copy", "schedule": "Every Monday 9:00", "deliversTo": "Word document",
  "candidateFiles": [ { "id": "…", "title": "Return policy" } ] }
```
`candidateFiles` is built from the Library files this chat attached; `[]` means the card asks nothing about files. The event is stored with the message so a reload shows the same card.

R3. **Confirm, test run, created.** `POST /automations/proposals/{proposalId}/confirm {attach: boolean}` (accepts `Idempotency-Key`; the proposal belongs to the chat's owner and expires, `404 proposal_gone` after, proposed 24 hours) creates the routine with or without the files, fires **one test run** (`AutomationRun.kind = "test"`), stores a `routine_created` event with the message, and returns the automation. `routine_created` carries `{automationId, name, schedule, deliversTo, attachedFiles, testRun: {runId, status}}`. The test run is a status resource: the front end polls `GET /automations/{id}` until `testRun.status` is terminal (`running | succeeded | failed`), and the file it made appears in `testRun.fileId`.

R4. **Run outputs: name, origin, inputs.**
- The Library title is the **basename only** (never `files/…`). A test run's file is "Test run - <short label>"; a normal run's is "<Routine name> - <run date>"; when that title already exists for the routine the next one gets " (2)", " (3)".
- `GET /library/files/{id}` returns *(the front end reads these)*:
```json
{ "provenance": { "kind": "routine", "via": "routine", "label": "Draft product copy",
                   "routineId": "…", "runId": "…", "runLabel": "Mon 19 Oct", "isTestRun": false },
  "runInputs": [ { "id": "…", "title": "Return policy 2026", "state": "used" } ] }
```
`runInputs[].state` is `used | skipped_trashed | missing_deleted | lost_access` (`04` section 6.6b). List rows carry `generatedFrom: {kind: "routine", label}`. (The names `generatedFrom` / `usedFiles` in the Flow B ticket were wrong; keep both `generatedFrom` and `provenance` until the front end confirms.)
- A run writes its output to a temporary key and copies it only on success, so a failed or partly failed run creates **no** file (`04` section 6.6b). Message-only and failed runs create nothing. Over the size limit: not saved, with the note "Not saved: the file is over the size limit.", and the message is still delivered.

R5. **Output kind and files per run.** `output: "file" | "message"` on `GET /automations` and `GET /automations/{id}` (set on create or edit, or derived from the program). Each run in `runs[]` has `files: [{id, title}]` (empty for a message or failed run) and `status: running | succeeded | failed`.

R6. **Skipped files.** Each run records what happened to every attached file (`LibraryRunInput`, `04` section 3.10b) and `runs[]` returns `skippedCount` and `skippedFileIds`, so run history can say "Skipped 1 file". The run goes ahead without a missing file.

R7. **Duplicate Run now.** `POST /automations/{id}/run` returns `409 {"code": "already_running", "details": {"runId": "…"}}` when a run is in progress, instead of `started: true`. The front end already blocks a second POST; this makes the server honest for every other caller (C-02).

R8. **Privacy (decision first).** Either routines are private and `GET /automations/organization` returns only routines whose owner chose to share (`Automation.shared`, default `false`), or org-wide visibility stays and the prototype check changes. Either way: **never expose attached file names to people who cannot open those files**, and outputs of a private routine are private to its owner (`04` section 6.6b).

R9. **Delete a routine.** `DELETE /automations/{id}?deleteOutputs=true|false`; `?dryRun=1` returns `{outputCount}` first so the dialog can say "Also delete its N run outputs".

R10. **Optional (product call): "ready" notice.** When a routine is connected to Slack, post "<Routine> is ready." with a link once a run saves its output (C7). Without it, C7 depends on each routine's own script.

**Errors.**

| Status | Code | When |
|---|---|---|
| 409 | `already_running` | Run now while a run is in progress (`details.runId`) |
| 404 | `proposal_gone` | Confirm a proposal that expired or is not the caller's |
| 403 | `only_owner` | Attach, detach or delete someone else's routine |
| 422 | `validation_failed` (`fieldErrors[].field` = `fileIds[i]`) | An attached file that is not ready, not active, or not readable by the owner; too many files |
| 409 | `already_confirmed` | Confirm twice with a different body; the same `Idempotency-Key` replays the first result |

**Data.** `AutomationDocument`; `AutomationRun.kind` (`run | test`), `AutomationRun.output_file_ids`, `LibraryRunInput(run_id, document_id, state)`; `Automation.output`, `Automation.shared`; `Document.origin_run_id`, `origin_is_test_run`; proposals table with TTL.

**Edge cases.**
- A routine reads only files attached to it and can read only what its **owner** can read; if the owner loses access the routine loses it and run history says so.
- A routine keeps using the file attached to it even when a newer copy is uploaded; the owner attaches the new copy in place.
- A run that never finishes is marked failed after a configured wait.
- Owner removed: paused and handed to the Admin with its outputs (BE-11; `04` section 6.6b offers the PRD alternative, decision OQ-19).
- Retention (keep the last 30, Keep pin) is out of this phase; keep `AutomationRun.output_file_id(s)` stable so it can be added without migrating old runs.

**Authorisation.** Owner-only for attach, detach, delete and test run; every file id passes the resolver for the owner at save and at run time.

**Observability.** One event per run (kind, outcome, files saved, files skipped, duration), per proposal confirm, per test run; counter of `already_running`.

**Front end.**
- *Built, waiting on the backend:*
  - `src/components/Library/routines/RoutineChatCards.tsx`: `RoutineClarifyCard` (Routine details; Attach both / Not now; Create routine disabled until answered; "No files attached" after Not now) and `RoutineCreatedCard` (Name, Schedule, Delivers to, Attached files or "None", "Test run: Done", Open routine, Run outputs). Needs R2, R3. `RoutineChatCards.test.tsx`, 5 passing.
  - `RoutineLibrarySections.tsx`: `RoutineAttachedFiles` (list, Add files picker, remove, "No files attached."), `RoutineRunHistory` (kinds output / message / fail), `RoutineUnavailableNote` ("…The next run skips it."). Needs R1, R5, R6.
  - File info renders "Made by routine <link>, run of …" and "Files this run used" from `provenance` and `runInputs` (`FileInfoCard.tsx`). Needs R4.
  - The routine page swaps Run outputs for "Results stay in run history, not in Library." once `output` arrives. Needs R5.
- *Done 2026-10-18 and 19:* the routine page has a Run outputs section with "All run outputs in Library", opening `/library?tab=all&source=generated` (B4, verified live). Run now marks the routine running as soon as the POST succeeds, stays disabled until polling sees the run end, and shows "Running now" (`use-schedules.ts`, `SchedulesScreen.tsx`); File info says "Private" when only the owner has access (C6).
- *Needed after R7:* treat `409 already_running` as "Running now" instead of success. Not built yet.

**Rollout.** All fields additive. Ship R1 and R5 to R7 first (they unblock most of the page), then R2 and R3 (the chat cards) together, then R4's name change.

**Acceptance tests.**
1. In a chat that used two Library files, ask for a weekly routine: a Routine details card offers "Attach <file 1> and <file 2>?"; Create routine stays greyed until Attach both or Not now.
2. Attach both, Create: the card shows name, schedule, delivery, both files, "Test run: Done". `GET /automations/{id}` has one `test` run; All files (Source: Generated) has one "Test run - …" whose File info names the routine. A reload keeps the card. Confirming twice with the same `Idempotency-Key` makes one routine.
3. The routine page lists both files; `PUT …/attached-files` with one id keeps one; both survive a reload; a bad id is `422` with a field error.
4. Run now: a new "<Routine> - <date>" with no `files/`; a second run the same day is "… (2)"; File info lists the files this run used with a state; Run history gains a line.
5. A message-only routine returns `output: "message"`, its runs have `files: []`, its page says "Results stay in run history, not in Library."
6. Two `POST …/run` within a second: the second is `409 already_running`; one run in history.
7. Attach two files, trash one, Run now: the output lists only the other; `runs[]` reports `skippedCount: 1`.
8. As Maya, the routine is in neither Mine nor Organization (if "private" is chosen) and no attached file name is visible.
9. Not now, then Create: the card says "Attached files: None", the page "No files attached."
10. A failed run leaves no file and no partial file in Library.

---

### BE-08. Sharing by asking in chat

**Covers:** E7, E8, E-d1 (chat half), and the chat half of E9. **Related:** BE-10 (Slack channel rule), BE-12 (unread, trash), C-02, C-06.

**Seen live.** "@Souvenir share the e4 weekly sales report with OS8 Test01" returned "Sharing requires using the Souvenir web interface; approve browser access and I can share that chat with OS8 Test01." Nothing was shared, no confirmation, no Undo. A file Maya owns, a name matching several files, and a person not in Souvenir each got a browser-access offer instead of the fixed reply. `GET /library/files/{id}/access` stayed `[owner]`.

**Where in the code.** Sharing exists only as `POST` / `DELETE /library/files/{id}/grants` (`services/library/router.py` ~lines 111-118, `library.py` `share` / `unshare` ~lines 565-599). Nothing outside `services/library` calls `Library.share`. The chat agent is only pointed at a "product/souvenir" skill for sharing (`services/llm/agent.py` ~lines 53-60). `share` already refuses with `not_a_member` and `already_has_access` (~lines 570-586) and `manage` with `only_owner` (~line 164), but nothing turns those into replies.

**Requirements.**

R1. **A "share a Library file" tool for the chat agent** (and the Slack bot, BE-10): given the asker's words, find the file among files the asker can open and the person among workspace members, then call `Library.share` **as the asker**. The reply text comes from the tool and is relayed verbatim (the model does not rewrite it):

| Case | Reply |
|---|---|
| No such person | "Who should I share it with? Try <member names>." |
| The asker themself | "You already have it." |
| No file named | "Which file? Name it, like “the Weekly sales report”." |
| None found | "I couldn't find a file called “<name>” that you can open." |
| Several | "Which one: <up to 3 names>?" (several files with one name, or all from one routine, pick the newest) |
| Not allowed to share it | "I can only share files you own." (an Admin over a workspace share counts as allowed, as in the dialog) |
| Already has it | "<Person> can already open it." |
| Done | "Shared <file> with <Person> as Viewer." |

Nothing is shared in any reply except the last. Matching: exact (case- and extension-insensitive) title first, then prefix or contains; members matched by display name. *Proposed:* an ambiguous person gets "Which one: …?" too.

R2. **A confirmation event** (C-06) so the chat can show an Undo:
```json
{ "type": "library_shared", "id": 52, "version": 1, "messageId": "…",
  "fileId": "…", "grantId": "…", "label": "Weekly sales report", "personName": "Maya" }
```
It is stored with the message so a reload shows it. Undo calls the existing `DELETE /library/files/{id}/grants/{grantId}`; the front end then shows "Sharing undone". Idempotent: undoing twice is `200`/`204` the same way.

R3. **Channel-safe wording in Slack** (with BE-10): in a DM or web chat the confirmation names the file; in a channel it names the file only when everyone in the channel can open it (shared with the whole workspace, not a Slack Connect channel), otherwise "Done. Shared with <Person>."

R4. **Notify and audit.** Add a `library.shared` notification for the grantee (`04` section 6.9) and an audit entry for each share and revoke (`04` section 7). Rate limit shares per file per minute (C-07).

**Errors.** The tool turns the underlying errors into the replies above; the HTTP errors on the grants endpoints are unchanged (`400 not_a_member`, `409 already_has_access`, `403 only_owner`, `404 file_gone`).

**Data.** None new; `grantId` already exists on each access entry.

**Edge cases.** Sharing to a person who already opened the file again marks it unread (BE-12 R7). A name matching a file in Trash never matches. The asker's role is read on the server.

**Authorisation.** The tool acts with the asker's identity only; the owner or Admin-over-share check is the same function the dialog uses.

**Observability.** One event per tool call with the outcome (which of the eight replies), never the file name.

**Front end.**
- *Built:* the whole dialog side (`dialogs/ShareDialog.tsx`: people and Whole workspace, staged chips, the teammates line, Who has access with "Shared directly" and "Whole workspace", the remove confirm with the "answers stay, citations lock" and "can still open it through the workspace" lines, Undo on the toast, people who already have access not offered). The Shared tab, unread dot and its clearing (`FileTable.tsx`, `markOpened`), "Only the owner can change this" tooltips (`access.ts`, `file.ts` `caps`), the Admin "can manage" rules and "You: Viewer / Admin, can manage" in File info. No front-end change was needed for the checks that pass.
- *Not built, waiting on R1 and R2:* the chat confirmation with Undo. It was never in git history and is not something 579f2b94 removed. Build it as soon as `library_shared` exists: render `label` and `personName`, an Undo button that calls the grants DELETE and shows "Sharing undone", and restore it from history on reload.
- *Reads exactly:* `library_shared.{fileId, grantId, label, personName}`.

**Rollout.** The tool can ship before the event (the reply text alone fixes E7/E8); the Undo needs the event.

**Acceptance tests.**
1. In a chat, "@Souvenir share the Weekly sales report with Maya": "Shared Weekly sales report with Maya as Viewer." with Undo; Maya's Shared lists it; Undo returns `GET …/access` to `[owner]`.
2. "share Payment terms with Sam" (not yours), "share the supplier contract with Maya" (two files), "share the Weekly sales report with Lena" (not a member): the three fixed replies, and `GET …/access` unchanged for all three.
3. Repeat step 1: "Maya can already open it."
4. Reload the chat after step 1: the confirmation and Undo are still there.
5. In #ops (BE-10), the reply does not name the file unless it is shared with the whole workspace.

---

### BE-09. Request access to a file

**Covers:** D4 (the panel is front end and done; the button needs the endpoint). **Related:** C-02, C-07 (existence, rate limits), `04` section 6.9 (notification).

**Seen live.** `POST /library/files/8d081d29…/access-requests` as Maya returns `404 {"detail":"Not Found"}`: the route does not exist (`services/library/router.py` has no `access-requests`; `04` section 5 and 6.9 list it and `library.access_requested`). With the flag on against the real backend the button stays "Request access" and an error toast shows. With the POST mocked to `204` the panel button becomes "Request sent" (disabled) and the File page for the same file also reads "Request sent" after a reload.

**Requirements.**

R1. `POST /library/files/{id}/access-requests` (no body; accepts `Idempotency-Key`, C-02) returns `204` for a signed-in person who **cannot** open the file. Idempotent per person and file: asking again is `204` and does not notify again. `409 already_has_access` if they can open it. `404 file_gone` if the file does not exist or is in Trash.

R2. **Notify the owner** with a `library.access_requested` notification through the existing notifications pipeline (`04` section 6.9; the front end already consumes `src/lib/notifications`), once per (file, requester) while the request is pending. The notification carries the file id and the requester's name, never the file's content.

R3. **Remember it.** `LibraryAccessRequest(file_id, requester_id, status pending|granted|dismissed, created_at)` (`04` section 3.6). When the owner (or an Admin over a workspace share) shares the file with the requester, the request becomes `granted`.

R4. **Survive another device.** Return `details: {"requested": true}` in the `file_locked` error body for a person with a pending request, so "Request sent" shows on any device (the front end keeps a local copy until then).

R5. **Rate limit** requests per file per person per day (`04` section 7) with `429 rate_limited` and `Retry-After`; use the same generic response for every refusal so the call cannot be used to probe which files exist (C-07).

**Errors.**

| Status | Code | When |
|---|---|---|
| 409 | `already_has_access` | The person can already open the file |
| 404 | `file_gone` | No such file, or in Trash |
| 429 | `rate_limited` | Too many requests for this file |

**Edge cases.** The requester must be an active member of the file's workspace (otherwise `404`). A file in Trash reads as gone. A request on a file whose owner was removed goes to the Admin who received it (BE-11).

**Authorisation.** Anyone signed in to the workspace may ask; the response never confirms who owns the file or what it is called. *Note (hardening):* `GET /library/files/{id}` already answers `403 file_locked` for any existing file the caller cannot open, which confirms existence; `04` section 7 prefers `404` unless the caller was linked to the file. Decide whether to tighten that (Part 4).

**Observability.** One event per request with outcome; counter of requests per file.

**Front end.**
- *Built (done 2026-10-19):* a "Locked file" chip opens the locked panel beside the chat (`src/lib/library/chat-file-panel.ts`, `ChatFilePanelSlot.tsx` mounted in `ChatInterface.tsx`, opened from `library-citations.tsx`); the panel and the File page share `LockedState` and read "You don't have access / Ask the owner to share it", never the title. The Request access button is restored behind `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS` (`libraryApi.requestAccess`, `useRequestAccess`, `FileStates.tsx`), remembered per person and file in a local copy. Verified with the POST mocked. Tests: `FileStates.test.tsx`, `chat-file-panel.test.ts`.
- *Reads exactly:* `204`, `409 already_has_access`, and `details.requested` on `file_locked` (when added).
- *Needed:* turn the flag on when the endpoint ships; read `details.requested` if added. (The chip that opens the panel comes from citations, which are left out.)

**Rollout.** New endpoint and table, nothing else changes. Flag off until it ships.

**Acceptance tests.**
1. As Maya on a locked file, press Request access: `204`, the button reads "Request sent", the owner gets a `library.access_requested` notification.
2. Press it again, and reload: still "Request sent", no second notification.
3. As someone who can open the file: `409 already_has_access`.
4. After the owner shares the file with Maya, her request is `granted` and the file opens.
5. The 21st request in a day for one file returns `429` with `Retry-After`.

---

### BE-10. Library in Slack: answers, save, find, channel rule

**Covers:** D1 to D3, D5 to D7, D-d1, D-d2, E9. All checks except the File-page half of D1 are **Blocked (environment)**: `GET /slack/status` returns `{"workspaces":[]}`, so no Slack message could be sent; the code behind them is also not built. **Needs before testing:** a connected Slack test workspace with the bot. **Related:** BE-04 (retrieval), BE-08 (share tool), C-07.

**Where in the code.**
- `services/slack` imports nothing from `services/library`. A Slack turn builds its files in `turn.py` (~lines 664-675) from the thread's uploads plus project knowledge, with `priorAttachments=[]`. A turn runs as the linked member (`models.py` ~line 65, `turn.py` ~line 223), in a channel too, so there is no "files everyone in the channel can open" rule and no "left out" sentence.
- Slack attachments go to S3 only (`Workspace.addUploads`, `services/document/workspace.py` ~lines 135-170). `persistMany` (~line 383), which makes the `Document` row, is called only from web chat (`chat/service.py` ~line 689) and the sandbox (`sandbox/session.py` ~line 818), never from a Slack turn. `Document` has only `origin_chat_id` (`document/models.py` ~line 31), no channel, message or `via`; Library always answers `via="web"` (`library.py` ~lines 408-410) though `schemas.py` ~lines 75-77 allows `"slack"`.
- The Slack agent has no Library tool; `services/slack/prompt.py:25` tells the bot not to stay silent, so an unknown question gets a free-form answer.
- Slack Connect: `extShared` (`slack/router.py` ~lines 883-890) only picks which bot team answers; Library is never told.

**Requirements.**

R1. **One resolver, two audiences.** Library search in a Slack turn uses the same access resolver as the web (BE-04 R1) with an audience:
- **DM:** files the asker can open.
- **Channel:** only files **every member of that channel can open** (granted to the whole workspace), checked **at answer time**, not when the question was typed. Membership comes from Slack at that moment.
- **Slack Connect** (`is_ext_shared`) or any external member: **no** Library files and no saving; the bot says why (fail closed, `04` section 6.8b).
- If any files were left out, end the answer with "I used only files everyone in this channel can open. N relevant file(s) was/were left out." without naming them. Never use Trash.
- If the policy service cannot decide, show less (C-07).

R2. **Not in your files.** A question the files do not cover gets "I couldn't find this in your files." (not silence, not a guess).

R3. **Save from Slack.** An attachment plus "save this to Library" creates a `Document` through the **same pipeline as web** (download from Slack, stage, process, activate: BE-02) with owner = the linked sender, private, `source = uploaded`, `via = slack`, and the channel and message recorded (`origin_slack_channel_id`, `origin_slack_message_ts`, `origin_slack_file_id`). Reply "Saved to Library as <name>." with a link to `<web app>/library/files/{id}`. `GET /library/files/{id}` then returns `provenance: {kind: "slack", via: "slack", ...}`. Without the phrase nothing is saved and the reply says "Got it. Say “save this to Library” and I'll keep it." Unreadable, locked or unsafe files follow BE-02 R6 and R7 and the bot says it could not read the file.

R4. **Find.** "find <words>" replies "Found 1 file." / "Found N files." with a link each, or "I couldn't find “<words>” in files you can open." DM lists the asker's open files; a channel only workspace-granted ones; never Trash; at most five.

R5. **Edge replies** (`04` section 6.8b): a file still processing, "I'm still reading it" and answer when ready; a Slack file that cannot be fetched, "I couldn't read the file" with nothing saved; Library unreachable, "I couldn't reach Library just now." and no guessing; several matches, "Which one: …?".

R6. **Share by asking** is BE-08 R1 and R3 on the same resolver.

R7. **Safety.** Slack events are retried by Slack, so every action here is idempotent per event id (the Slack idempotency record, `slack/models.py` ~line 232, already exists). Calls from Slack into Library use a **purpose-issued token**, never a forwarded browser session (C-07), and every downstream call has a timeout (C-12).

**Errors.** Replies, not HTTP errors; the Library endpoints keep their codes (C-01).

**Data.** `Document.via` (`web | slack | routine`), `Document.origin_slack_channel_id`, `origin_slack_message_ts`, `origin_slack_file_id`.

**Edge cases.** A file attached by a member who later leaves the channel stays theirs. A channel that changes between question and answer uses the membership at answer time. Duplicates of the same attachment make separate files (BE-02 R5).

**Authorisation.** The bot never gains access of its own: it is the linked member in a DM, and the intersection of every member in a channel.

**Observability.** One event per Slack Library action (answer, save, find) with audience (`dm | channel | external`), outcome, count of files left out; no file names.

**Front end.** *Nothing to build.* File info already reads "Uploaded by <name> in Slack" when `provenance.kind` or `via` is `"slack"` (`FileInfoCard.tsx`, checked live with a patched response). Library already keeps a file private to its owner by default (live as Maya: `file_locked`, not in her search; Library search already leaves Trash out). Once R3 saves through the same table, D7 holds without more work. Library file links in Slack answers need citations (left out).

**Rollout.** Behind the `library` and `ai_use` kill switches. Test with a real workspace first.

**Acceptance tests (Slack connected).**
1. In #ops, with a member who cannot open the Acme contract, ask "What are the Acme payment terms?": the answer says it used only files everyone in the channel can open and that one file was left out, without a name. The same question by DM uses the Acme contract.
2. Attach a file and send "save this to Library": the bot says where, the file is in the sender's All files, File info reads "Uploaded by You in Slack"; as another member it is not in All files or search and `GET /library/files/{id}` is `file_locked`.
3. Attach a file and send no "save this": nothing new in Library; the bot says how to save it.
4. "find the return policy": "Found 1 file." with a link; a file in Trash is not listed; in #ops only workspace-granted files are listed.
5. Ask something the files do not cover: "I couldn't find this in your files."
6. In a Slack Connect channel: no Library file is used or saved, and the bot says why.
7. Redeliver the same Slack event: one file, one reply.

---

### BE-11. Removing a member and leaving the workspace: what happens to their Library files

**Covers:** Flow G checks G6, G7, G-d1, G-d2 (the doc-12 ids G-C06, G-C07, G-D01, G-D02). All four are **Blocked (backend)**; G7 and G-d1 were checked by reading code, and nothing was removed or transferred in the live run. **Related:** BE-07 (routines of the leaver), BE-05 (chats removed with them), C-02, C-07. **Rules:** `01-product-rules.md` section 9; design: `04-backend-requirements.md` sections 5 and 6.7.

**Seen live (Flow G, 2026-10-19).**
- Members as You: two rows (You, OS8 Test01), each with Remove. Remove on OS8 Test01 swaps the button for an inline "Cancel" and "Confirm remove" with **no question**; Cancel returned to "Remove" and **no `DELETE` was sent**. In code, Confirm sends `DELETE /organizations/{id}/members/{memberId}` and the backend removes the person at once.
- There is **no Leave anywhere in the UI**: Settings, Library has none, and the only Leave button (Settings, General) is switched off (`SHOW_DANGER_ZONE = false`, `general/_components/GeneralParts.tsx:16`).
- `GET /library/prefs` and `/org-settings` are `404` (BE-01), so no "what changed" lines exist either.

**Where in the code.**
- `DELETE /organizations/{id}/members/{member_id}` (`services/organizations/router.py` ~lines 444-451) takes no body and calls `Organization.removeMember` (`organization.py` ~lines 314-338), which calls `offboardFromOrganization` (`offboarding.py` ~lines 61-78). Nothing is pending and nothing waits for the leaving person: the only checks are "billing admin" and "last admin".
- `clearPersonalAssets` (`offboarding.py` ~lines 46-58) hard-deletes the person's private chats and projects, project memberships and chat shares; `repository.remove_member` (`organizations/repository.py` ~lines 310-326) removes the member row and unshares their connectors. **Nothing reads `Document.user_id`** (`services/document/models.py` ~line 19), so the person's files stay owned by someone who is gone; there is no transfer, no delete of never-shared files, and the `DocumentShare` rows to or from them (`models.py` ~lines 58-70) stay, so `accessList` (`library.py` ~lines 502-511) keeps listing them under Who has access.
- `POST /organizations/{id}/leave` (`router.py` ~lines 454-462) takes only `successorAdminUserId` (`schemas.py` ~lines 131-137) and runs the same offboarding (`organization.py` ~lines 340-367). The last Admin must already name a successor (enforced).

**The rules (`01-product-rules.md` section 9, and the prototype `remove-member` in `lib/reducer.ts` ~lines 1012-1055).**
1. An Admin confirms "Remove <name>". The person leaving then sees **one locked question**: transfer their shared files or delete them. The removal completes when they answer.
2. **Yes:** files shared with the whole workspace, and files shared with the removing Admin, go to that Admin; any other shared file goes to the first person it was shared with (earliest grant), who keeps access. **No:** those files are deleted outright (not Trash). Files **never shared** are deleted either way. Chats go with them; routines they own are handed to the Admin together with their run outputs (BE-07); their grants on other people's files are cleared.
3. Leaving yourself asks the same question, can be cancelled, and is **blocked for the only Admin** ("Name another Admin first").
4. **Nothing is deleted or transferred until the leaver answers.** From the moment of removal the member's access, routine grants and sessions end immediately (GOV-7), even while the question is unanswered. A workspace always has an Admin.

**Requirements.**

R1. **A pending removal.** An Admin's Remove records `LibraryRemoval(id, user_id, requested_by, requested_at, status awaiting_answer|completed|cancelled, transfer bool null, answered_at)` and **does not remove the member yet**; it ends the member's access, routine grants and sessions at once and notifies them (`library.removal_pending`, repeated as a reminder). `GET /organizations/{id}/members` returns `removal: {by, at} | null` on each member so the row can read "Waiting for their answer". The existing `DELETE .../members/{memberId}` keeps its path and now starts this request (or returns `202` with the removal), so the front end's Confirm keeps working.

R2. **Read the pending question.** `GET /library/members/me/removal` (the `04` section 5 name; Flow G's ticket wrote the shorter `GET /library/my-removal`, either is fine once agreed) for the signed-in person:
```json
{ "status": "awaiting_answer", "by": { "id": "…", "name": "Alex" }, "requestedAt": "…", "canCancel": false }
```
(`pending: false` or `status: "none"` when there is nothing.) It returns nothing about other people's files. The app opens a locked dialog "<Admin> is removing you" on the next load. The leaver's access to the workspace has ended, so scope the token to this one purpose (C-07).

R3. **Answer it.** `POST /library/members/me/removal/answer {transfer: boolean}` is the only way to finish the removal (accepts `Idempotency-Key`, C-02; the same answer twice is `200`, a different answer `409 already_answered`). In **one transaction**: apply the hand-off in rule 2 (re-point `Document.user_id` and keep grants on Yes; delete on No); delete never-shared files and their chats; **drop the person's `DocumentShare` grants and `DocumentView` rows** so they are gone from Who has access on every file; hand routines and their outputs to the Admin; then remove the `OrganizationMember` and release the seat through the existing org service. Post-commit S3 and derived-data deletes go through an **outbox** so a crash cannot orphan data (`04` section 6.1b). Deletion uses the same path as Delete forever (`services/document/indexing.py` `remove_document` ~line 297).

R4. **Leave carries the answer.** `POST /organizations/{id}/leave` accepts `transferSharedFiles: boolean`, **required** when the person owns a Library file; it runs R3's hand-off in the same transaction. The last Admin must still name a successor first (already enforced), so Leave is dimmed with "Name another Admin first"; the backend enforces it as `409 only_admin`, not only the UI. Removing or demoting the last Admin is also `only_admin`; serialise concurrent Admin removals with a lock on the organisation row.

R5. **Admin cancel.** An Admin can cancel a pending removal (`POST /library/members/{userId}/removal/cancel`, proposed): status `cancelled`, access restored, nothing deleted. *Product decision (Part 4):* what if the person never signs in again (a time limit, or an Admin force)? Until decided, nothing is deleted or transferred.

R6. **After removal (G-d1).** The person shows as **Removed** in Members and is gone from "Who has access" on every file (`GET /library/files/{id}/access` omits them; the share picker already reads the workspace's member list so it drops them on its own). "Viewing as" in the prototype is a prototype-only switch with no real equivalent.

R7. **Audit and events.** Audit entries for removal request, answer, transfer counts and deletion counts (no content), in `OrganizationAuditLog` (`04` section 7).

**Errors.**

| Status | Code | When |
|---|---|---|
| 409 | `only_admin` | The last Admin leaves, is removed or demoted |
| 409 | `already_answered` | A second answer with a different value |
| 422 | `validation_failed` (field `transferSharedFiles`) | Leave by someone who owns Library files without the answer |
| 403 | `forbidden` | A non-Admin removes, cancels or lists |
| 404 | `removal_gone` | No pending removal for this person |

**Data.** `LibraryRemoval`; an outbox table for post-commit deletes; `Document.user_id` re-point (`04` section 3.10); audit rows. No change to `DocumentShare` other than deleting the leaver's rows.

**Edge cases.**
- A recipient leaving: their access ends; files they shared are handed over or deleted as they chose; files they never shared are deleted.
- Moving a file to a person who already has it through a grant: the grant is dropped, ownership wins.
- A member removed while holding staged uploads: the staged files are discarded with the draft (BE-02).
- "Sam keeps access" and "goes to You and Sam" cannot be shown in testing: only two accounts exist.
- Sessions of a removed member stop working server side at the request step, not only in the browser (C-07).

**Authorisation.** Only the leaver answers; only an Admin cancels or lists; the transfer target is derived from data (grants, roles), never from the request. Removal and billing-admin checks stay.

**Observability.** One event per phase with counts transferred, deleted and failed; alert on any outbox item older than the configured window.

**Front end.**
- *Existing:* Members page with the app's own inline "Cancel / Confirm remove" (`.../(org)/members/_components/*`); it stays until R1 exists.
- *Not built:* the leaver's question dialog ("Transfer your shared files to other members?", Yes and No, Confirm off until chosen), "Waiting for their answer" on Members, Leave in Settings, Library (and Cancel, and "Name another Admin first"). A version of the dialog (`MyRemovalPrompt.tsx`), `src/lib/library/members.ts` and the Members rows existed against the old sample data and were removed by 579f2b94 (`git show 579f2b94^:src/components/Library/settings/MyRemovalPrompt.tsx`); rebuild from them when the endpoints exist. Leave stays hidden (`SHOW_DANGER_ZONE = false`) until its answer can be sent.
- *Reads exactly (proposed):* `removal: {by, at}` on members; `GET /library/members/me/removal` fields above; `409 only_admin`.
- *Needed after the backend ships:* build the three pieces above; show Removed in Members; re-run G6, G7, G-d1 and G-d2.

**Rollout.** Ship behind the `library` kill switch. The two-phase removal changes the existing offboarding path, so keep a flag to fall back to the one-step removal for workspaces with no Library files.

**Acceptance tests.**
1. As Admin, Remove a member: the row reads "Waiting for their answer", they are still a member in the list, and their access and routine grants have ended; on next load they see a locked dialog, and Confirm is off until they pick Yes or No.
2. They answer **Yes**: a file shared with the Admin goes to the Admin; a file shared only with one other person goes to them with their access kept; a file they never shared is deleted; they are no longer a member and appear in no file's Who has access.
3. Repeat with another member answering **No**: shared files are deleted outright (not in Trash); an unshared file is deleted either way.
4. Their chats are gone; their routines and run outputs went to the Admin.
5. As a Member, Settings, Library, Leave shows the same question and Cancel closes it. As the only Admin, Leave is dimmed with "Name another Admin first" and `POST .../leave` returns `409 only_admin`. `POST .../leave` without `transferSharedFiles` for someone who owns a file returns `422`.
6. Two Admins removed at the same moment: exactly one request succeeds.
7. An Admin cancels a pending removal: access is back and nothing was deleted.
8. Kill the process between "answer" and the S3 deletes: the outbox finishes the deletes on restart; no orphaned objects.

---

### BE-12. Library lists and search: the Shared tab and Source filter, search ranking, Suggested, unread, Trash, keyset cursor, summary call

**Covers:** Flow H (H2, H3, H4, H8 backend half, H12, H13, H18, H19, H20, H-d4), Flow E (E3 and E-d2 unread edge, E10 Trash), and the list rules in C-04, C-11 and C-12. Flow H is complete (25 checks, 4 depth items, "every flow" list); its backend findings are R1 to R6. **Related:** BE-06 (transcripts for search), BE-07 (routine origin on rows), C-04.

**Seen live (Flow H, 2026-10-19).** The real accounts hold their own files (admin "You": 61 files, 18 Generated; Maya: 31), so counts were compared with `GET /library/files` for each filter, not the prototype's 15/4/11/8. No third person exists, so the "+2" avatar and "As Sam" were not tested.
- **Shared tab.** `GET /library/files?tab=shared` as You returned 8 rows: 4 files You own and shared out (h1, h2, e1, f1…) and files shared with You (h5, Maya's lighthouse image). As Maya, her own `h5-maya-brief` is in her Shared. "In Shared" search returned `e3-supplier-contract-nova` and `h2-nova-notes`, files You own (H19 **Fail**).
- **Source: Shared.** `?tab=all&source=shared` returned 2 for You and 3 for Maya: only files shared **with** them. The prototype counts "a file others can open": one you shared **or** one shared with you (H12 **Partial**, counts otherwise match for every filter).
- **Search.** "net 30" as You returned 15 rows, including `a2-states-…` ("…is 30 days"), Catalog export ("Item 30") and Return policy 2026, and no audio. "nova" returned 4 correct rows. A recording is never found.
- **Suggested.** Maya's Generated row holds three images made in her chats (lighthouse and two "cat" images) and no "Run of <date>" line. Maya's Frequently used has 6 entries (the front end shows 3). `lastActivityKind` is `"shared"` for files shared with her. Recent for You lists a file "Opened today" below files "Created today", ordered by a use the row does not show.
- **Audio preview.** `GET /library/files/{id}/preview` for the two recordings returns only `{kind: "audio", url}`.
- **Unread edge (Flow E).** Sharing e1 again with Maya, who had opened it, gave `unread: false`.
- **Trash (Flow E10).** After the Admin deleted Maya's workspace-shared file, the Admin's Trash did not list it; only Maya's did.
- **States.** Loading, empty and error on Suggested, All files, Shared, Trash and search all pass (call held 9 s, answered `{items: []}`, answered `500`); Try again recovers each one.

**Where in the code.**
- `services/library/library.py` ~lines 312-314: `tab == "shared"` is `or_(and_(~owned, sharedWithMe), and_(owned, anyShare))`.
- `library.py` ~lines 317-321: `source=shared` maps to `and_(~owned, sharedWithMe)`. The prototype's `isShared` (`library-prototype/surfaces/library/lib/access.ts`) is the other meaning, and `components/library.tsx` line 72 builds the tab from `file.owner !== person && life === "active" && phase === "ready" && waysFor(file, person).length > 0`. The tab and the filter have their meanings **swapped**.
- `library.py` ~lines 324-327: search uses `anyWord(q)` (`services/document/indexing.py` ~lines 303-306, `&` replaced by `|`), written for chat retrieval; results come in the chosen sort order, not best match first.
- `library.py` ~line 264 and ~line 408: `generatedFrom` is always `kind: "chat"`. `suggested()` (~lines 371-374) fills Generated from every `source == "generated"` file, chat outputs included.
- `library.py` ~lines 363-369 rank Recent by `greatest(last_activity_at, opened_at, usedAt)` where `usedAt` is the latest chat or routine use, while `row()` (~lines 234-236) reports only `last_activity_at` or the open time. Frequently used ranks by opens plus uses but its line says "Opened N times" (opens only).
- `library.py` ~lines 271-293: the cursor is `{"o": offset, "k": key}` and `page()` runs `statement.offset(offset).limit(limit + 1)` (C-04). `GET /library/trash` takes no `limit`. `library.py` ~line 257: `unread` is `not owned and bool(mine) and view is None`; `unshare` leaves the person's `DocumentView`. `trash()` (~lines 379-390) lists only `owned()` files. `FileRow` has no thumbnail fields.

**Requirements.**

R1. **`tab=shared` is only files shared with the caller:** `and_(~owned, sharedWithMe)` with `life = active`, `phase = ready`. Drop the `owned & anyShare` branch. "In Shared" search and `unreadFirst` use the same predicate, so the Shared dot means what the prototype says. Files the person shared out stay discoverable through the Access column and the Share dialog.

R2. **`source=shared` is "a file others can open":** `or_(and_(~owned, sharedWithMe), and_(owned, anyShare))`. R1 and R2 are one move of that clause from the tab to the filter. **Ship them in the same release**, because the front end's "is anything shared with me" check currently uses `source=shared` (see Front end) and would start counting files the person only shared out. This is a change in the meaning of named query parameters, so announce it to the front end the day it ships (C-09, principle 34).

R3. **Search ranks and ANDs.** Library search ANDs the words (or tries the exact phrase first and falls back), ranks phrase matches first and then best match, and keeps `anyWord` for chat retrieval only. "net 30" must list Supplier contract - Acme and the recording first, and a file that only has "30 days" must not appear. Ranked results use a score-plus-id cursor (C-04). Keep a minimum query length of 2, support cancellation, and apply the access predicate in SQL.

R4. **Recordings are searchable.** Index recordings' transcripts (BE-06 R2) so "net 30" can find a recording, with the snippet taken from the transcript. Access-filtered like any other text.

R5. **Generated knows its origin.** Send the routine origin (BE-07 R4): `generatedFrom: {kind: "routine", label, runLabel?}` on rows and `provenance` on detail, so a tile reads "Run of <date>" and the sparkle tooltip reads "Generated by the <routine> routine". **Decide** whether Suggested's Generated row is only routine run outputs (prototype) or every generated file; the front end shows whatever the list sends (Part 4).

R6. **Recent and Frequently used tell the truth.** The row reports the time and kind the order actually used: `lastActivityAt` / `lastActivityKind` equal the latest of change, open **and use** (kind `opened` for a use), and `openCount` plus a `useCount`; or rank Frequently used by opens only so "Opened N times" is true. Return exactly the number of Frequently used entries the screen shows (3), or document that the front end trims.

R7. **Unread again.** When a grant is added for someone who already opened the file, make `unread` true again: clear their `DocumentView.opened_at`, or keep a `shared_seen_at` older than the grant. Removing the grant must not leave the file unread for them (`04` section 6.2).

R8. **Trash for the person who deleted.** `GET /library/trash` also lists files where `trashed_by = me`, with Restore left to the owner (the row says "Only the owner can restore it").

R9. **Real keyset cursor** on `GET /library/files`, `GET /library/trash` and search (C-04): order by sort key plus `id`, `WHERE (sort_key, id) < (…)`, opaque versioned cursor bound to the filter and sort (`400 bad_cursor` otherwise), `limit` with a default and a cap on **every** list including Trash, a composite index per sort. Keep `{items, nextCursor}`.

R10. **Summary call.** `GET /library/summary` returns `{sharedWithMeCount, unreadSharedCount, trashCount, storage: {usedBytes, limitBytes, breakdown}}`. Counts may be approximate and count only files the viewer can open. The header tabs and the unread dot use it instead of listing files. Keep `GET /library/storage`.

R11. **Complete rows.** List rows carry `thumbnailUrl`, `thumbnailWidth`, `thumbnailHeight` (C-11), the processing phase and failure (exist), `unread`, `sharedAt`, `sharedBy`, `generatedFrom`, and every field a row is drawn from, so no row triggers a request. `Cache-Control: private` and an `ETag` on lists and detail (C-05).

R12. **Suggested degrades per section.** `GET /library/files/suggested` returns `{recent, frequent, generated}` and, if one query fails, the others with an `error` on the failed section and `200`, never a whole-page `500` and never empty-with-no-signal (C-12). Prototype limits stay: Recent five, Frequently used up to three and never repeating Recent, Generated up to three.

**Errors.**

| Status | Code | When |
|---|---|---|
| 400 | `bad_cursor` | Tampered cursor, or a cursor reused with another filter or sort |
| 422 | `validation_failed` (`fieldErrors`) | An unknown `type`, `source`, `sort` or `dir` value; `limit` above the cap is clamped, not an error |

**Data.** Indexes on `(owner_id, life, created_at desc, id desc)` and one per sort used; a full-text or trigram index that supports AND and phrase queries; `DocumentView.opened_at` or `shared_seen_at`; `useCount` (derived from `DocumentUse`); thumbnail columns or a rendition table; transcript text indexed (BE-06).

**Edge cases.**
- Counts and `sharedWithMeCount` count only files the viewer can open, never a total that includes hidden ones.
- After an upload completes the front end patches or prepends; it never refetches page 1 and replaces loaded pages, so the cursor must stay valid across inserts.
- A file both owned and shared out is "shared" for `source=shared` but not in the Shared tab.
- Two files with the same name are two rows with different Created times in All files, search and the picker (H-d3 passes; keep it so after R9).

**Authorisation.** Every list and search predicate includes the access resolver in SQL (not post-filtering); add the test that fails if a Library query is added without it.

**Observability.** List latency by tab and sort (target p95 under 300 ms at 10,000 files per user, `04` section 8), search latency, `bad_cursor` count, summary latency.

**Front end (Flow H done, 2026-10-19).**
- `src/lib/library/queries.ts` (`useHasShared`): the Shared tab and its unread dot read `tab=all&source=shared`, so they appear only when something is shared with the person (H2). The Shared list itself still calls `tab=shared`, so it still holds files the person owns until R1. **When R1 and R2 ship**, `useHasShared` must go back to `tab=shared` (or to `GET /library/summary`), because `source=shared` will then include files the person shared out.
- `SuggestedView.tsx`: a Recent card's unread dot sits right after the title (H3).
- `SortMenu.tsx`, `FilterPanel.tsx`: the chosen option carries a tick (H10, H11).
- `FileMarks.tsx`: the sparkle and the unread dot sit above a row's stretched link, so hover shows "Generated in …" and "Unread"; the sparkle takes Tab focus (H8).
- `FileTable.module.css`, `FileTable.tsx`, `FormatGlyph.tsx`: below about 480 px of list width Type (and Shared's Access) hide, then the date at about 300 px, the list takes a 16 px side margin under 900 px, and the file icon no longer shrinks, so Name always stays (H25, which was a real failure at 800 px and below). Rows of a file still being prepared carry a "Processing" badge (a status in a word, not only colour, EV-05).
- `LibrarySearch.tsx`: placeholder and label "Search Library" (H1).
- *Verified and unchanged:* filters, chips, Reset, sort headings, search state, Trash screen, Loading / Empty / Error states (H5 to H7, H9, H12 to H17, H21 to H24, H-d1 to H-d4). `tsc` clean; vitest on the Library folders passes (37 files, 280 tests); one pre-existing eslint warning on the file list virtualizer (untouched). The "Processing" badge and the 600 px layout are covered by tests and a width script only.
- *Built:* the list is virtualised (`useVirtualizer`, principle 51), `useInfiniteQuery` with `nextCursor`, and list rows merge into detail without downgrading fields (`patchFileEverywhere`, principle 31).
- *Reads exactly:* `items`, `nextCursor`, the row fields in R11, `lastActivityAt`, `lastActivityKind`, `openCount`, `generatedFrom`, and `GET /library/summary` once it exists.
- *Needed after the backend ships:* switch `useHasShared` (above); header counts from `summary`; thumbnails from `thumbnailUrl`; "Run of <date>" from `provenance` or `generatedFrom.runLabel`.

**Rollout.** R9 is invisible to the front end except that duplicates and skips stop; do it with a flag per tab and compare results before and after. **R1 and R2 together**, with a same-day note to the front end. R3 changes which files a search returns: tell the front end and re-run H18 and H19. Keep `anyWord` for chat retrieval so BE-04 does not change.

**Acceptance tests.**
1. As a person who only shared files out, open Library: no Shared tab. Have someone share a file with them: the tab appears with a dot until they open it. (H2)
2. On Shared, search a word that is in a file You own and shared out and in one shared with You: "In Shared" lists only the second; "All of Library" lists both. The Shared list never contains a file You own. (H19, H20)
3. All files, Source: Shared lists files You shared and files shared with You, and its count matches the list; with Shared and Uploaded ticked the list is the union. (H12, H13)
4. Search "net 30": Supplier contract - Acme and the Supplier call - Acme recording come first; a file that only has "30 days" does not appear. (H18)
5. Run a routine: Suggested's Generated tile reads "Run of <date>", and the sparkle in All files says "Generated by the <routine> routine". (H4, H8)
6. Use a file in a chat today and do not open it: its Recent card reads "Opened today" (or the kind the order used) and ranks by that time. (H3)
7. Scroll All files while another tab uploads a file: no row repeats or disappears at a page boundary. A cursor from `sort=created` used with `sort=name` returns `400 bad_cursor`; a hand-edited cursor returns `400`, not `500`; `limit=100000` is clamped on every list, including Trash.
8. Share a file with Maya, she opens it (dot clears), share it again: the dot is back. Remove the share: no dot, not in her Shared.
9. As Admin, trash a file of Maya's that is shared with the whole workspace: it is in Admin's Trash (Restore disabled with "Only the owner can restore it") and in Maya's.
10. `GET /library/summary` matches the list counts (within the stated approximation) for both accounts, in one request.
11. Force the Generated query to fail: Suggested still returns Recent and Frequently used with an `error` on Generated.

---

## Part 3. Front-end list, in one place

### Switch on when the backend ships

| Flag or item | Turn on when | Notes |
|---|---|---|
| `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` | BE-01 (prefs and org settings) is on the dev backend | Controls both settings pages, the save choice dialog, the header notice, the composer note, the Phase 2 pages, and, once built, the removal question and Leave control. Remove the flag later |
| `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS` | BE-09 | In `feature-flags.ts` |
| `libraryDontSave` and `librarySourcesOff` local copies | BE-03 R4 and BE-04 R4 | Replace localStorage and sessionStorage with the value on `GET /chats/{id}` |

### Still to build (not built today)

| What | Needs | Where it would go |
|---|---|---|
| Chat confirmation for a share, with Undo and "Sharing undone" | BE-08 `library_shared` event | Chat message renderer; history restore |
| Undo on the "Chat deleted" notice | BE-05 R5 (`POST /chats/{id}/restore`) | `AppDialogs.tsx` notice |
| Treat `409 already_running` as "Running now" | BE-07 R7 | `use-schedules.ts` |
| Chat-created routine: poll the test run until terminal | BE-07 R3 | `RoutineCreatedCard` |
| A mark from `groundedness` | BE-04 R3 and a design call | Chat answer |
| Library removal question, "Waiting for their answer" on Members, Leave in Settings, Library with Cancel and "Name another Admin first" | BE-11 (shapes in BE-11 R1 to R4) | Rebuild from `git show 579f2b94^:src/components/Library/settings/MyRemovalPrompt.tsx` and `src/lib/library/members.ts`; the Leave button stays off (`SHOW_DANGER_ZONE = false`) until its answer can be sent |
| Extend `ApiError` with `kind`, `code`, `fieldErrors`, `requestId`, `retryable`; map FastAPI `detail[]` to `fieldErrors`; stop matching message text | C-01 | `src/lib/api/client.ts` (the shared change `06` names for principle 45) |
| Send `Idempotency-Key` on uploads init and complete, chat send, routine confirm, grants, access requests, removal answer | C-02 | `src/lib/api/client.ts` and the Library API functions |
| Switch `useHasShared` from `tab=all&source=shared` back to `tab=shared` (or `GET /library/summary`) **in the same release** that changes the Shared tab and Source: Shared meanings | BE-12 R1, R2, R10 | `src/lib/library/queries.ts` |
| Header counts from `GET /library/summary`; thumbnails from `thumbnailUrl`; "Run of <date>" from the routine origin | BE-12 R10, R11, R5 | `LibraryHeader.tsx`, `SuggestedView.tsx`, `FileTable.tsx` |
| Re-run Flow G against the real backend (today it ran against a stand-in) | BE-01, BE-11 | Test as You and Maya |

### Built and waiting for a backend field (no front-end work expected)

Routine chat cards and attached-files section (BE-07); sent-file chip reading "File deleted" / "Locked file" and the Delete chat dialog's saved files (BE-04 R5, BE-05); Uploading and Processing banners (BE-02 R9); transcript lines on the audio viewer (BE-06); "Uploaded by … in Slack" (BE-10); File info "Made by routine …" and "Files this run used" (BE-07 R4); thumbnails (BE-12 R11).

### Done in the front end during these runs (for the record)

| Area | Change |
|---|---|
| Flow B | Routine page has a Run outputs section and "All run outputs in Library" |
| Flow C | Run now no longer sends a second POST or re-enables during a run; File info says "Private" when only the owner has access |
| Flow D | "Locked file" chip opens the locked panel; Request access built behind a flag |
| Flow F | File page reads "No longer available" (no name, tab title "File") for a trashed file unless opened from a Trash row; Delete chat dialog and notices |
| Flow G | "Your Admin changed Library settings" notice back on the Library page; composer note "Your Admin has turned off Library search…" with a test; wording "Your Admin turned this off"; File size limit in MiB; Audit log and Inventory static Phase 2 pages and sidebar entries; all behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` |
| Flow H | Search placeholder "Search Library"; Recent card dot after the title; ticks on Sort and Filter menus; Shared tab and dot read `source=shared`; sparkle tooltip and "Unread" label reachable by hover and Tab; narrow-window layout (Name never collapses); "Processing" badge on list rows |
| All flows | No box around file icons (`FormatGlyph.tsx`); unused "Items moved to Trash…" string removed (`messages.ts`) |

---

## Part 4. Decisions needed before building

| # | Decision | Affects | Options |
|---|---|---|---|
| 1 | Are routines private, or visible to the whole org? | BE-07 R8 (check B5) | Private with an opt-in `shared` flag, or keep org-wide and change the prototype check |
| 2 | What happens when indexing fails after a file is already ready (for example an OCR timeout)? | BE-02 R8 | Retry then remove, or hide it |
| 3 | Should a routine post "<Routine> is ready." to Slack on its own? | BE-07 R10 (check C7) | Built in, or left to each routine's script |
| 4 | The Shared tab and the Source: Shared filter. The prototype: tab = only files shared **with** you (`library.tsx:72`); Source: Shared = a file others can open, shared in **or** out (`lib/access.ts` `isShared`). The backend has them swapped, and `04` section 5 says the tab also lists files you shared out | BE-12 R1, R2 | Prototype meanings for both (recommended, and update `04`), or keep the backend and change the prototype checks H2, H12, H19, H20 |
| 5 | How long does a deleted chat stay restorable? | BE-05 R5 | 30 days like Trash is simplest |
| 6 | What if the leaving person never signs in again to answer the removal question? | BE-11 R5 (OQ-20) | Nothing happens until they answer (current rule), a time limit, or an Admin can force the removal. Also settle the endpoint names (`GET /library/members/me/removal` in `04`, `GET /library/my-removal` in Flow G's ticket) |
| 7 | Does the workspace have a storage limit this phase? | BE-01 R6 (G1 "of <total>") | `limitBytes` null and the page says "<used> used", or a real limit |
| 8 | Should a locked or missing file answer `403` or `404` to someone never linked to it? | BE-09, C-07 | `04` section 7 prefers `404` unless linked; the code answers `403 file_locked` for any existing file |
| 9 | Idempotency window and key storage | C-02 | 24 hours per user is proposed |
| 10 | Adopt RFC 9457 `application/problem+json` for errors, or keep `{code, message, requestId, ...}` | C-01 | The front end reads the same fields either way |
| 11 | Is Suggested's Generated row only routine run outputs (prototype) or every generated file (today: chat images too)? | BE-12 R5 | Routine outputs only, or all generated files with a different label |
| 12 | Does "Frequently used" rank by opens only, or by opens plus uses? Its line says "Opened N times" | BE-12 R6 | Opens only (the line is then true), or add a use count to the row |
| 13 | Search words: AND, or exact phrase first then fall back? | BE-12 R3 | Phrase first with AND fallback (recommended) |

---

## Part 5. Which principle shaped which rule

Principles are in `front-end/fe system design/principles/`. Only the ones that put a requirement on the backend are listed; the others (rendering, bundling, component patterns and similar) are front-end only.

| Principle | What it asks of the backend here | Where |
|---|---|---|
| 7 Streaming SSR and Suspense | Decide status before streaming; mid-stream failure is an event; no buffering | C-06, BE-03, BE-04 |
| 9 CDN and Edge Delivery | `private` on personalised responses; immutable hashed assets; streams not cached | C-05 |
| 10 Service Workers and Caching | Never cache error responses; correct status codes | C-05, BE-05 |
| 13 One-Way Data Flow | Server is the source of truth; mutations return new state; idempotent writes | C-02, C-03 |
| 19 Error Boundaries | Stable `code`, safe `message`, request reference, 4xx vs 5xx | C-01, C-08 |
| 20 Accessibility | Messages that say the problem and the fix; status fields for busy states; transcripts | C-10, BE-02, BE-06 |
| 21 Frontend Security | Authorise every endpoint; minimal DTOs; schema validation; upload checks; rate limits | C-07 |
| 30 Server State | Return the entity; `nextCursor`; filters as parameters; no 2xx errors | C-03, C-04 |
| 31 Data Normalisation | Stable ids; same field names in list and detail | C-03, BE-12 |
| 32 Cookies, LocalStorage, IndexedDB | Server owns durable truth (prefs, flags); do not rely on client storage | BE-01, BE-03, BE-04 |
| 33 Optimistic Updates | Idempotent target-state writes; clear failure statuses; not optimistic for permissions | C-02, BE-08, BE-11 |
| 34 URL as State | Named, stable query parameters; bad values never 500 | C-04, BE-12 |
| 35 Form State | Server re-validates; per-field errors | C-01, BE-01 |
| 36 Real-Time State | Event ids and replay; heartbeats; status resources with terminal states | C-06, BE-02, BE-07 |
| 37 REST vs GraphQL | Status codes, error format, `Idempotency-Key`, `ETag`, OpenAPI, additive changes | C-01, C-02, C-05, C-09 |
| 38 React Query Patterns | `nextCursor` or end signal; entity from mutations; 4xx not retried | C-03, C-04 |
| 39 Offset vs Cursor | Keyset cursor, opaque, bound to filter and sort, capped `limit` | C-04, BE-12 |
| 41 Backend for Frontend | One call per screen; per-section partial failure; timeouts; authorise again | C-12, BE-12 |
| 42 Authentication | Never trust client identity; revoke sessions server side; purpose-issued tokens | C-07, BE-10, BE-11 |
| 43 tRPC | Backward compatible across a rollout window; error codes | C-09 |
| 44 WebSocket Architecture | Typed events with ids and version; heartbeat; replay | C-06 |
| 45 API-Layer Error Handling | Stable codes, per-field errors, `Retry-After`, `x-request-id`, RFC 9457, idempotency keys | C-01, C-02 |
| 49 Image Optimisation | Small renditions, dimensions, hashed URLs, re-encode and strip EXIF, magic bytes | C-11, BE-02 |
| 51 List Virtualisation | Bounded server-side pages, stable ids, complete rows, search that filters data | C-04, BE-12 |
| 53 Debounce and Throttle | Server rate limits and idempotency; cancellation; minimum search length | C-02, C-04, C-07 |
| 55 Observability | Request id and trace propagation; structured logs; critical-flow signals | C-08 |
| 56 Performance Budget | Small thumbnails, seeded test account | C-11 |
| `base-primitive-rules.md` | The front end adapts to and documents the contract; typed payloads; server validation | C-09 |

## Open items on this ticket

- **Flow G** was tested against a local stand-in for the missing prefs and org-settings endpoints, so its results prove the screens, not the backend; re-run G1 to G5, G8 and G9 once BE-01 exists. G6, G7, G-d1 and G-d2 were not run live (Remove and Leave were opened and cancelled, the rest read from code), because the backend has no question and no transfer.
- Flow G, Flow H and "All flows" are complete. Flow H changed BE-12 the most: the Shared tab and the Source: Shared filter have opposite meanings from the prototype, search needs ranking, and routine origin and recording transcripts feed Generated and search.
- `04-backend-requirements.md` already describes most of the target design (tables, endpoints, rules). This ticket adds what live testing showed is **not built**, the exact shapes the front end reads, and the API conventions from the principles. Where the two disagree (the Shared tab, `ask_save`), this ticket says which one the front end follows.
- The Flow A, B to F and X sections of the source tickets hold every seen-live detail, ids and request and response samples. This ticket keeps what the backend needs to build and what the front end must do.
