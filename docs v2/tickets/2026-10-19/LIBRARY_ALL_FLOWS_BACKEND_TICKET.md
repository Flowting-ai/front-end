# [Backend] Library, all prototype flows (A to H and "All flows"): one detailed ticket, built to the front-end design principles

| Field | Value |
|---|---|
| Type | Combined requirements ticket: one backend work list, the API conventions it must follow, and the front-end side of every item |
| Area | Backend `services/library`, `services/chat`, `services/document`, `services/automations`, `services/slack`, `services/organizations`, `core` (errors, request ids) |
| Source | Prototype checks in `library-prototype/surfaces/library/lib/data.ts` (Flows A to H and "Checks that apply to every flow"), run live against the dev backend from `front-end` on 2026-10-18 and 2026-10-19 (admin account "You", member account "Maya") |
| Built from | `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md`, `2026-10-18/LIBRARY_CHECKPOINT_BACKEND_TICKET.md` (Flows B to H and All flows, all finished runs), and the existing design docs `docs v2/library/04-backend-requirements.md` (the full backend design) and `06-principles-application.md` |
| Principles | `front-end/fe system design/principles/` (56 principles, 6 folders). Part 0 turns the ones that touch the API into backend rules, each with its source |
| Left out on purpose | Everything about **cited passages** (Library citations in chat answers). See "Left out" below |
| Status | **All eight flows (A to H) and "All flows" are done and included.** Flow G was tested against settings endpoints answered by a local stand-in (the backend has none), so its results prove the screens, not the backend. **Update 2026-10-19 (evening):** the backend shipped three Library commits (`29aba242`, `483125e0`, `8ef67914`, 18 Oct): staged uploads and discard, no merging of copies, `saveToLibrary` on send, the origin chat on send, `libraryState` and `document_id` on chat attachments, `file_gone` for a trashed file on send, the Shared tab and Source: Shared swapped to the prototype meanings, AND search with name hits first, and one `fieldErrors` body. Flows A to H were each re-run in full against it on 2026-10-19 (see the "Flow A retest" to "Flow H retest" and "All flows retest" tables in Part 1), as was "All flows" (X1 to X13), and each item below now has a **Status after the 18 Oct backend** line |
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

**Status after the 18 Oct backend: started.** `core/form_parsing.py` has a `FieldError`, and `main.py` `fieldErrorHandler` answers it with `422`, `application/problem+json` and `{code: "invalid", message, requestId, fieldErrors: [{field, code, message}]}` (seen live for `saveToLibrary=maybe`). Only `parseOptionalBool` raises it so far. `LibraryError` still answers `{code, message}` with no `requestId`, and FastAPI's own `422 {"detail": [...]}` is unchanged. The front end now reads both `fieldErrors` shapes (`src/lib/api/client.ts`).

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

*20 Oct (read in `45b2ef3e`).* Uploads are now sniffed by content (`services/library/inspect.py:33-60`: executable magic bytes and zip/OLE disguised as PDF give `unsafe`; encrypted or pageless PDFs are refused). Still missing: a malware scan, EXIF/GPS stripping of images, and any rate limit (no limiter in the codebase; live Library responses carry no `RateLimit` or `Retry-After`).

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

*20 Oct.* `back-end/openapi.yaml` has no `/library` path. The generated `GET /openapi.json` on devapi lists all 22 `/library` routes (including `/prefs` and `/org-settings`), but each has only `200` and FastAPI's `422`: no documented error codes or bodies (`LibraryError` codes, `403 file_locked`, `404 file_gone`, `409`), and no examples.

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
| **A** Capture and reuse | Auto-save, staging, provenance, same file twice, bad files, picker, sources, recordings, search switch, no-save chat | **Re-run 2026-10-19 against the 18 Oct backend.** Pass: A2, A3, A5, A6, A8, A12, A14, Depth 1, Depth 3 (A3, A5, A6, A14 were Fail). Partial: A7 (corrupt, password-protected and disguised `.exe` still become files), A10 (switch is front end only), A15 (menu wording). Fail: A13, Depth 2. Blocked: A1, A4 (no settings endpoints), A11 (BE-06 not built). Left out: A9 (citations) | BE-01, BE-02 R6 to R10, BE-03 R4 to R6, BE-04, BE-06 | Built; staged uploads and the history `libraryState` wired on 2026-10-19; settings behind a flag |
| **B** Set up a routine | Attach files on create, test run, attached files, run outputs, privacy | **Re-run 2026-10-19 (no routines backend change since 16 Oct).** Pass: B4. Fail: B1, B2, B3, B5, B6 (worse than before: a routine the chat writes as instructions, `kind: "model"`, saves **no** file to Library). Blocked: B-d1, B-d2 (no card) | BE-07 | Cards and sections built, waiting on events and fields |
| **C** A routine run saves its output | Output rows, message-only runs, failed runs, Slack "ready", provenance, double Run now, skipped files | **Re-run 2026-10-19 (no routines backend change since 16 Oct).** Pass: C3, C4, C5, C6, C9, C-d1 (C-d1 after a front-end fix: a double-click still sent two POSTs). Partial: C1 (every output is titled `files/Draft_product_copy_<date>`, five with the identical name), C2 (no message-only note: no output kind). Fail: C8 (origin reads "Made by Souvenir in a chat", no routine, no Files this run used). Blocked: C7 (no Slack), C-d2 (no attached files) | BE-07 | Built; double Run now and "Private" fixed |
| **D** Ask in Slack | Library answers in Slack, save from Slack, find, locked file, request access | **Re-run 2026-10-19.** Slack is still not connected (`/slack/status` → `{"workspaces":[]}` for both accounts), so D1 to D3, D5 to D7, D-d1 and D-d2 are **Blocked** and were checked in code: the only change is that a Slack **DM** attachment is now saved to Library, without being asked to (D-d1 would now fail) and without "in Slack" on the File page. D4 **Partial**: chip, panel and wording pass; Request access is still `404` | BE-09, BE-10 | Locked panel fixed; Request access built behind a flag |
| **E** Share files | Share dialog, Shared tab, unread, share by asking, admin over workspace shares | **Re-run 2026-10-19 against the 18 Oct backend.** Pass: E1 to E5, E10, E11, E-d2 (E4 now also right on the server: the owner's Shared tab no longer lists files they shared out). Partial: E-d1 (dialog half passes, chat half fails). Fail: E7, E8. Blocked: E9 (Slack). Left out: E6 (citations) | BE-08, BE-12 R7 | Dialog side built; chat confirmation with Undo not built (needs BE-08) |
| **F** Delete and restore | Trash, delete forever, empty trash, delete a chat, deleted links, answers | **Re-run 2026-10-19 against the 18 Oct backend.** Pass: F1 to F9 (F2 and F4 were Partial: a trashed file's chat link is gone, and the Delete chat dialog now lists the chat's saved files). Partial: F10 (notice right, no Undo). Fail: F11 (and the agent named a file that is in Trash). Blocked: F-d1 (BE-07 R1). F-d2: the sent-file chip reads "File deleted" (pass); the citation half is left out | BE-04, BE-05 R4 and R5, BE-07 R1 | Built; nothing new needed until BE-05 R5 |
| **G** Admin sets the switches | Admin settings, member view, notice, Phase 2 pages, removing a member, leaving | **Re-run 2026-10-19 against the 18 Oct backend.** `GET /library/prefs` and `/library/org-settings` are still `404`, so the screens were run against a stand-in again (results prove the screens, not the backend). Pass: G5. Partial: G1, G2, G3, G4, G8, G9 (screens pass; checked live, the backend enforces none of the switches: a send without `saveToLibrary` is saved, and `librarySourcesOff` / `aiReferenceEnabled` are silently ignored). **Blocked (backend): G6, G7, G-d1, G-d2** (offboarding unchanged) | BE-01, BE-03, BE-04, BE-11 | Unchanged since 19 Oct; all behind the flag |
| **H** Browse and find | Header, Suggested, All files, filter, sort, menus, search, Shared, Trash, states, narrow window | **Re-run 2026-10-19 against the 18 Oct backend.** Pass: H1, H2, H5 to H7, H9 to H17, H19 to H24, H-d1 to H-d4 (H2, H12, H19 and H20 were Partial or Fail: BE-12 R1 and R2 work). Partial: H3, H4, H8, H18, H25. Backend causes left: no phrase-first ranking and no recording transcripts in search (R3, R4), routine origin on Generated (R5), Recent and Frequently used lines (R6) | BE-12 R3 to R11 (also BE-06, BE-07) | Column headings are plain labels while searching (results come best match first); narrow-window tab row still clips |
| **All flows** (X1 to X13) | Wording, roles, states, accessibility, icons, no upload | **Re-run 2026-10-19 against the 18 Oct backend.** Pass: X1, X2, X4 to X7, X9 to X13. Partial: X3 (a File page still cannot show Uploading: `FileDetail.phase` is only `"ready"`), X8 (an unread shared file's Recent card reads "Modified") | BE-02 R1 and R9, BE-12 R6 | Icon box removed, unused "Items" string removed |

### Flow A retest (A1 to A15 and Depth 1 to 3; run live 2026-10-19 against the 18 Oct backend)

**How it was run.** The real app on `localhost:3000` against `devapi.getsouvenir.com`, as You (admin) and Maya (member). Each check was run twice: once through the screens (Playwright) and once by calling the API directly, so a pass means both the screen and the server behave. Test files are named `a19o4o-*`, `u2*-*` and `rno7z-*`. The backend was then read to say what is still missing. The front-end changes made for this backend are in Part 3 ("Done in the front end").

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| A1 Auto-save by default, no prompt | **Blocked** | `GET /library/prefs` and `/library/org-settings` are still `404`. With nothing sent, the server saves (the default "Always" behaviour holds) | BE-01 |
| A2 Uploading, Processing, Send waits | **Pass** | A 6 MB file showed "Uploading… N%" then "Processing"; Send stayed off until it was ready | — |
| A3 Not listed until sent; X deletes it | **Pass** (was Fail) | A ready, unsent upload is not in All files, content search, or storage totals (`usedBytes` unchanged). The owner can open it by id (`phase: "ready"`); Maya gets `403`. X sends `DELETE /library/uploads/{id}` → `204`; the file is then `404 file_gone` and is not in Trash. After a send the same call is `409 upload_done` | — (R1 to R4 done; see BE-02 for the gaps) |
| A4 Ask each time / Never | **Blocked** | The send half works: `saveToLibrary=false` keeps the file out (see A14). The setting itself needs BE-01 | BE-01 |
| A5 Row and provenance | **Pass** (was Fail) | In a **new** chat the file reads "Uploaded by You, <chat title>" with a link to the chat; `provenance.chatId` is set and `canOpenChat: true`. The row has source `uploaded`, access `owner` only; Maya `403 file_locked` | — |
| A6 Same file twice is two files | **Pass** (was Fail) | The same bytes twice give two file ids, both titled `a19o4o-a6-same`, with different Created times. In the chat itself the second copy is shown as `a19o4o-a6-same (2).txt` (the chat's working name, not the Library title) | — |
| A7 Bad files never become files | **Partial** | `.exe` ("Blocked: this file looks unsafe.") and `.zip` ("This file type isn't supported.") are refused, with no file name, cleared after 6 s, and the server refuses them too (`415 unsupported` at init). **Still failing:** a corrupt PDF, a password-protected PDF and an `.exe` renamed `.pdf` all come back `phase: "ready"`, are sent, and then sit in All files with `processing: "failed"`. They are also offered in the Add from Library picker | BE-02 R6, R7 |
| A8 Add from Library picker | **Pass** | Search, type chips (All files, Images, Documents, Spreadsheets, PDFs, Audio, Run outputs), list/grid toggle, multi-select, date and time on each row, "2 files selected". Staged files are not offered | — (A7 files in the list are a BE-02 effect) |
| A9 Citation chip | Left out | Cited-passages ticket | — |
| A10 Sources panel, switch off | **Partial** | "Sources · N" opens the panel; the file has a switch; switching shows "Off for this chat". Nothing on the server stores or reads `librarySourcesOff` (no code reads it) | BE-04 R4 (and the "cited" mark is the citations ticket) |
| A11 Recording: Transcribing step | **Blocked** | Not re-run: nothing changed. `preview.py` still returns `AudioPreview(durationMs=0, lines=[])` | BE-06 |
| A12 Files come in through a chat | **Pass** | Library has no Upload button and no drop area | — |
| A13 Library answers with nothing attached | **Fail** | New chat, nothing attached, a fact only in a saved, indexed file ("The Wombat Store return window is 73 days"): the answer was "The Wombat Store return window is 30 days from delivery for unused items." The model made up a number instead of searching Library or saying "I couldn't find this in your files." The chat's knowledge is still only the chat's own files (`chat/service.py` `available_documents_hint(knowledge)`) | BE-04 R1 to R3, BE-01 (switch) |
| A14 "Don't save files from this chat" | **Pass** (was Fail) | The More menu item turns it on; the send carries `saveToLibrary=false` with the file id; the file shows on the message, "Not saved. This chat doesn't save files." appears, and the file is not in All files. The owner can still open it by id, and the chat's history shows it as `libraryState: "open"` | BE-03 R4 (the flag is still only in the browser's localStorage) |
| A15 + menu | **Partial** | Add files and Add from Library are there, and opening the menu clears an upload message. The first item reads "Add files or photos"; the prototype says "Add photos & files" | Front end wording only |
| Depth 1 Failed upload has no Retry | **Pass** | Only the short message shows | — |
| Depth 2 Source switched off | **Fail** | Same cause as A10 and A13 | BE-04 R2 to R4 |
| Depth 3 X while Uploading or Processing | **Pass** | X while uploading leaves no chip, no upload record and no row | — |

**Also verified in this run (BE-05, on Flow A files).** A sent file moved to Trash: the chat history returns `libraryState: "deleted"` with no `file_link`, and the chat shows "File deleted" (front end fixed today: it used to drop the chip because the link is empty). Sending that file again is `404 file_gone` before the stream. Restore: `libraryState: "open"` and a fresh link. `saveToLibrary=maybe` is `422` with `{code: "invalid", message, requestId, fieldErrors: [{field: "saveToLibrary", ...}]}`.

**Side effects seen.** With a search term, `GET /library/files` ignores `sort` and orders by name hit, then rank (two files with the same title came back oldest first under `sort=created&dir=desc`). That is BE-12 R3 working as designed; the Sort menu should say so or be disabled while searching (front end, not built).

### Flow A retest 2026-10-20 (against backend `45b2ef3e`)

All of Flow A was re-run live; results are in `tickets/2026-10-20/LIBRARY_FLOWS_CHECKLIST.md` (A: 14 pass, 3 partial, 2 fail, 1 left out). What changed for the backend:

| Check | Result | Backend left |
|---|---|---|
| A1, A4 auto-save | **Pass** after a front-end fix (the composer now always reads `/library/prefs`). The server treats Ask each time with no `saveToLibrary` as "don't save" (services/library/prefs.py:41-47), so the client must ask | None. Optional: say "ask" in the send response so a client that skipped prefs still asks |
| A7 bad files | **Pass**. Byte checks return `unreadable`, `password_protected` and `unsafe` (services/library/inspect.py:33-93); failed uploads leave no row | None |
| A-new2 send limits | **Pass**. `422 too_many_files` (10) and `409 not_ready` | None |
| A11 recording | **Partial**, was blocked. The agent calls `transcribe_audio` and the chat shows "Transcribing"; the answer is right | BE-06: transcript with timed lines on the file, and a "transcribing" event that doesn't rely on the agent choosing the tool |
| A13 Library with nothing attached | **Fail**. "30 days" again; the stream shows it read the agent memory file `/memories/business/customer-fulfillment.md`, not Library | BE-04 R1 to R3 (and decide whether agent memory may answer questions about the person's files) |
| A10, Depth 2 sources switch | **Fail / partial**. `librarySourcesOff` is still `400 bad_request` (services/library/library.py:100-103) | BE-04 R4 |

### Flow B retest (B1 to B6, B-d1, B-d2; run live 2026-10-19)

**How it was run.** As You, a new chat with two Library files attached (`b3acbf Return policy.txt`, `b3acbf Shipping rates.txt`, stand-ins for Return policy and Shipping rates), asking: "Set up a routine called \"b3acbf Draft product copy\" that drafts product copy every Monday at 9:00 and delivers a Word document. Use the two files I attached. Do not ask me any questions; create it now." Then the routine page, Run now, Library, and Maya's view. The stream, `GET /automations/{id}`, `/automations/organization` and `/library/files` were read directly. `services/automations` has had no commit since 16 Oct, so this mostly re-checks the 18 Oct results; the new finding is B6.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| B1 Routine details card ("Attach the Return policy and Shipping rates?") | **Fail** | The agent read the files and called `automation_manage` in the same turn, then wrote "Created **b3acbf Draft product copy**. It runs every Monday at 9:00 AM IST…". No `routine_proposal` event, no card, no question about files. Stream: `skills`, `read_file`, `execute`, `automation_manage`, `edit_file`, text | BE-07 R2 |
| B2 Routine created card, "Test run: Done", one "Test run - product copy" | **Fail** | Nothing after create: `runs: []`, no `routine_created` event, no file | BE-07 R3 |
| B3 Attached files listed on the routine | **Fail** | `GET /automations/{id}` has no file field (keys: id, name, summary, schedule_json, trigger, is_active, status, error, next_run_at, last_run_at, run counts, is_running, created_at, updated_at, kind, entry, instructions, model, chat_id, runs, success_rate). The page shows no Attached files section (it appears only when the field exists) | BE-07 R1 |
| B4 "All run outputs in Library" opens All files with Source: Generated | **Pass** | Opens `/library?tab=all&source=generated` | — |
| B5 Not visible to Maya | **Fail** | Not in Maya's own list, and `GET /automations/{id}` is `404` for her, but `GET /automations/organization` lists it with its name and summary ("…grounded in the supplied shipping and return policies") | BE-07 R8 (decision 1) |
| B6 Run now saves "Draft product copy - <date>" listing the attached files; Run history gains a line | **Fail** (was Partial) | Two quick Run now calls: both `200 {"started": true}`, one run. The run **succeeded** and its answer says "Attached `b3acbf-product-copy-2026-10-19.docx` as the run result.", Run history shows "Completed", but **no file reached Library** (nothing new under Source: Generated, nothing for "b3acbf" in search). This routine is `kind: "model"` (`entry: scripts/automation.md`). The older script routine "Draft product copy" (`kind: "script"`, `scripts/automation.py`) still saves on Run now: a new `files/Draft_product_copy_2026-10-19.docx`, the **same title as the three before it**, `generatedFrom: {kind: "chat"}`, `provenance.kind: "chat"`, no `runInputs` | BE-07 R4, R5, plus the new R11 below |
| B-d1 Not now → "Attached files: None" / "No files attached." | **Blocked** | No card to press | BE-07 R1 to R3 |
| B-d2 Create routine greyed until a choice | **Blocked** | No card | BE-07 R2 |

**Side check (C6):** Maya opening a run output is `403 file_locked` (Pass).

### Flow C retest (C1 to C9, C-d1, C-d2; run live 2026-10-19)

**How it was run.** As You, three existing routines stood in for the prototype's: "Draft product copy" (`90fd1216…`, `kind: "script"`, saves a `.docx`) for Weekly sales report, "Daily sales message" (`4983e23b…`, answers one line) and "Always fails" (`328da2a0…`, throws). Run now was pressed through the API (twice in parallel on the first) and through the routine page (a double-click). Then All files with Source: Generated, the row menu, Delete, Trash, Restore and File info were driven in the app, and Maya's list and File page were checked. `services/automations` has had no commit since 16 Oct, and the three Library commits do not touch it (the new `Document.listed` defaults to `true`, so run outputs are still listed).

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| C1 New run output is a row, newest first, Generated, only your avatar; Run now again adds a row; never removed | **Partial** | Run now made `2d60bd56…`, the top row under Source: Generated: "Generated", "Today, 3:55 PM", access `owner` only (`accessSummary.people` = You). Earlier outputs stay. But the title is `files/Draft_product_copy_2026-10-19`, and five outputs now have exactly that name (a sixth is `…_2026-10-18`), so the rows cannot be told apart | BE-07 R4 (title without `files/`, unique per run) |
| C2 Message-only run: a run history line only; pane says results stay in run history | **Partial** | Run `24509640…` succeeded with "Sales today: 42 orders, $1,980." and no file; run history gained "Completed". The pane still shows **Run outputs** and "All run outputs in Library", not "Results stay in run history, not in Library." (the string and `RoutineRunOutputs messageOnly` exist; the page cannot choose without a field) | BE-07 R5 (`output: "file" \| "message"`) |
| C3 Failed run in history, no file | **Pass** | Run `2a52bc5b…` `failed` ("Something in its script failed…"), history reads "Failed", no new Library row | — |
| C4 Ordinary file menu, no Keep, marked generated | **Pass** | Menu: Open, Ask about this, Share, Download, Rename, Delete. The row reads "Generated" | — |
| C5 Delete goes to Trash with days left; Restore brings it back | **Pass** | "Move … to Trash? Recoverable for 30 days." → `life: "trashed"`, `daysLeft: 30`; Trash row "30 days"; Restore → `life: "active"`, back in All files | — |
| C6 Not in Maya's All files; File info says Private | **Pass** | Maya's Generated list has no `Draft_product_copy` row; `GET /library/files/2d60bd56…` as Maya → `403 file_locked`; her File page reads "You don't have access" with no title. You's File info: "Who has access: You, Owner … Private" | — (the routine itself is still listed to Maya under Organization: B5, BE-07 R8) |
| C7 Slack #ops "Weekly sales report is ready." | **Blocked** | Slack not connected (`{"workspaces":[]}`) | BE-07 R10, a Slack test workspace |
| C8 File info names the routine and run, links to it, lists Files this run used | **Fail** | `provenance: {kind: "chat", label: "Draft product copy", via: "web", chatId}`, `generatedFrom.kind: "chat"`, no `routineId`, `runLabel` or `runInputs`. File info: "Made by Souvenir in a chat, Draft product copy" (a link to the routine's chat) and "Used in 1 chat, 0 routines". The front end already renders "Made by routine …, run of …" and "Files this run used" when the fields come | BE-07 R4 |
| C9 Ordinary rows, no Routine outputs tab; "All run outputs in Library" and Suggested See all open All files with the Generated chip; removing it shows all | **Pass** | Both open `/library?tab=all&source=generated` with a "Generated" chip; removing it goes to `/library?tab=all` | — |
| C-d1 Run now twice quickly does not start two runs | **Pass** (after a front-end fix) | Server: two parallel `POST /automations/{id}/run` → both `200 {"started": true}`, **one** run. Screen: a double-click on Run now still sent **two** POSTs (the button is disabled only after a re-render). Fixed with a synchronous guard (`src/lib/schedules/run-guard.ts`, used by `use-schedules.ts`; tests in `run-guard.test.ts`). Re-run: a double-click plus a third click → one POST, the button disabled until the run ends, one run | BE-07 R7 (`409 already_running`; today the second call says `started: true`) |
| C-d2 A trashed attached file is skipped: pane says so, output lists only the rest, history says "Skipped 1 file" | **Blocked** | No routine can have attached files (`GET /automations/{id}` has no file field), so there is nothing to skip. The pane line ("… is unavailable. The next run skips it.") is built and waits for the field | BE-07 R1, R6 |

**Test data from this run.** You: one new output `2d60bd56…` (`files/Draft_product_copy_2026-10-19.docx`, trashed and restored twice, now in All files), one more run on "Draft product copy", three on "Daily sales message", one on "Always fails".

### Flow D retest (D1 to D7, D-d1, D-d2; run live 2026-10-19)

**How it was run.** `GET /slack/status` as You and as Maya → `{"workspaces":[]}`: Slack is still not connected for the test workspace, so no Slack message could be sent and every Slack check is **Blocked (environment)**. Each was checked by reading `services/slack` after the 18 Oct commits. D4 was run live as Maya (standing in for Sam) on "Supplier contract - Acme" (`8d081d29…`, You's, not shared), in her chat `d272aec0…`, with the dev server started with `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS=true`. The backend still sends no `library_citations` (citations are left out), so the chat history response was patched in the browser to carry one locked citation, as in the 18 Oct run.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| D1 Return window answer cites Return policy; citation opens its File page | **Blocked** | No Slack. In code a Slack turn's knowledge is the thread's files plus project knowledge (`turn.py` ~line 675, `priorAttachments=[]`); nothing searches Library. The citation half is left out | BE-10 R1, BE-04 R1 |
| D2 Channel answer uses only files everyone in the channel can open, says one was left out | **Blocked** | No Slack. No channel audience in code: a turn runs as the linked member in a channel too | BE-10 R1 |
| D3 Same question as a DM cites the Acme contract | **Blocked** | No Slack. Same cause as D1 | BE-10 R1 |
| D4 As Sam, "Locked file" opens a panel "You don't have access"; Request access → "Request sent" | **Partial** | The chip opens the File panel beside the chat: "Locked file / You don't have access / Ask the owner to share it / Request access", no title or owner. `GET /library/files/8d081d29…` as Maya → `403 file_locked`; the File page reads the same. **Request access against the real backend:** `POST /library/files/8d081d29…/access-requests` → `404 {"detail":"Not Found"}`, the button stays "Request access" and an error toast shows. With the POST mocked to `204`: "Request sent" | BE-09 R1 to R4 |
| D5 Bot confirms where the file was saved; file in Library; File page says uploaded in Slack | **Blocked** | No Slack. **Changed in code:** `turn.py` `libraryNames` now saves every new uploaded attachment in a **DM** through `Workspace.library(origin=UPLOADED)`: a `Document` with `source: "uploaded"`, the sender as owner and `origin_chat_id` = the Slack turn's chat. Channels save nothing. The bot is not told and cannot confirm, and Library still answers `provenance.via: "web"` (`library.py` ~line 429), so the File page cannot say "in Slack" (the front end reads `via: "slack"`) | BE-10 R3 (confirmation, `via: "slack"`, channel rule) |
| D6 "find the return policy" → "Found 1 file." with a link; Trash and channel rules | **Blocked** | No Slack. No find command or Library tool in `services/slack` | BE-10 R4 |
| D7 A file saved from Slack is private to its sender | **Blocked** (would pass in code) | No Slack. The DM save creates an owner-only `Document` with no shares, so it is listed to its sender only | — |
| D-d1 An attachment without "save this" is not saved, and the bot says how to save it | **Blocked** (would fail in code) | No Slack. The new DM save keeps **every** new DM attachment, asked or not, and there is no "how to save" reply. This is the opposite of the prototype; decide which rule holds | BE-10 R3 (save only when asked), Part 4 |
| D-d2 An unknown question gets the prototype reply, not silence | **Blocked** | No Slack. `slack/prompt.py` tells the bot not to stay silent, so it answers freely; there is no "I couldn't find this in your files." | BE-10 R2 |

**Test data from this run.** None: no Slack message was sent, and the access request was refused (`404`) or mocked.

### Flow E retest (E1 to E11, E-d1, E-d2; run live 2026-10-19)

**How it was run.** As You (admin) and Maya (member, "OS8 Test01"; Maya stands in for Sam, no third person exists). Files `e3uj8y-*`, `v3ztiq Brand guidelines` and `v45f5r Brand guidelines`, each saved through a chat so it has a use. Every check was done through the API (grants, lists, detail, access) and the main ones again on screen.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| E1 Share dialog | **Pass** | "Teammates can use shared files in their chats and routines.", people and the whole workspace, "Not shared yet" before the first share; sharing with OS8 Test01 shows "Shared with OS8 Test01" with Undo | — |
| E2 Who has access says how | **Pass** | "OS8 Test01 · Shared directly"; API entries `owner:owner`, `user:direct` | — |
| E3 In Maya's Shared, unread, owner-only actions off | **Pass** | First in Maya's Shared with `unread: true`, `access: viewer`; Share and Delete disabled on her File page, "You: Viewer"; rename, share and delete through the API are `403 only_owner` | — |
| E4 Shared tab layout and meaning | **Pass** (was Partial) | Columns Name, Access, Date shared, Type; unread mark. **New:** the owner's Shared tab no longer lists the file they shared out (BE-12 R1), and Source: Shared lists it for both people (R2) | — |
| E5 Direct and workspace together | **Pass** | Entries owner, direct, workspace; Maya's Shared has it once; her `ways` are `["direct", "workspace"]` | — |
| E6 Remove a person, the citation locks | Left out | Cited-passages ticket | — |
| E7 Share by asking in chat | **Fail** | "@Souvenir share the file … with OS8 Test01": the agent only ran `list_chats` and replied "I can't share files through a connected service here. Sharing it via the Souvenir web interface requires browser access… Approve browser access and I'll share it". No share tool, no `library_shared` event. **Note:** the agent offering to drive the web app in a browser to share a file is a risk on its own | BE-08 |
| E8 Refusals (not owner, several matches, not in Souvenir) | **Fail** | Same cause | BE-08 |
| E9 Slack confirmation | **Blocked** | Slack not connected | BE-08, BE-10 |
| E10 Admin over a workspace share | **Pass** | Maya shared her file with the workspace; You: `adminCanManage: true`, access list `canManage: true`, rename `200` | — |
| E11 Remove direct, workspace remains | **Pass** | Revoke `200`; Maya still opens it, `ways: ["workspace"]`, still in Shared | — |
| E-d1 "Maya can already open it." | **Partial** | Dialog half: a second workspace grant is `409 already_has_access`. Chat half: no share by chat | BE-08 |
| E-d2 Unread clears on open | **Pass** | `POST …/opened`, then `unread: false`. (Unread again after a re-share is BE-12 R7, not re-run) | BE-12 R7 |

### Flow F retest (F1 to F11, F-d1, F-d2; run live 2026-10-19)

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| F1 Delete dialog | **Pass** | "Move v45f5r Brand guidelines.txt to Trash? 1 chat Quick Test · 0 routines None · Shared with OS8 Test01 · Recoverable for 30 days. Answers already written stay as they are." | — |
| F2 Trash with days left; out of search, picker and Maya's Shared | **Pass** (was Partial) | `daysLeft: 30`; not in search or the picker list; gone from Maya's Shared, `404 file_gone` for her. **New:** the chat that sent it now returns `libraryState: "deleted"` with no link (it used to hand out a working signed link), and sending it again is `404 file_gone` | — |
| F3 Restore keeps shares | **Pass** | From the Trash row menu and through the API: back with the workspace grant, Maya opens it again | — |
| F4 Delete chat asks about saved files, default keep | **Pass** (was Partial) | "Delete Quick Test? 1 saved file stays in Library." with the file listed and "Also delete these files" unticked. Works now because the history sends `document_id` | BE-05 R4 (`savedFiles`) would save the front end one read per file |
| F5 No Archive | **Pass** | None on the File page or menus | — |
| F6 Trash is private | **Pass** | Maya's Trash does not list You's trashed file. (The prototype's seeded "Return policy 2025" does not exist here) | — |
| F7 Delete forever | **Pass** | `204`, then `404 file_gone`. **New:** the chat history keeps the attachment with `document_id`, `libraryState: "deleted"` and no name (BE-05 R3) | — |
| F8 Trash screen | **Pass** | `/library/trash`, "Library > Trash", no storage label, Empty Trash with "Frees up 4 KB", columns Name, Days left ("30 days"), Size, Deleted; row menu Restore, Delete forever; "Delete 4 files forever? This frees up 4 KB and can't be undone."; Cancel kept everything | — |
| F9 Deleted link | **Pass** | "No longer available", no file name, tab title "File \| Library" | — |
| F10 Notice and Undo after deleting a chat | **Partial** | "Chat deleted. 1 file stays in Library." and the file stays. No Undo: there is no restore endpoint | BE-05 R5 |
| F11 Trashed file not used in answers | **Fail** | File in Trash, nothing attached: "I can identify the file, but its contents aren't available in this chat. Please attach **e3uj8y Brand guidelines.txt** here…". Contents did not leak, but the agent **named a file that is in Trash** (it found it through its chat tools), and the answer is not "I couldn't find this in your files." | BE-04 R1 to R3; chat tools must not name trashed files (BE-05) |
| F-d1 Routine says the file is unavailable | **Blocked** | Routines have no attached files | BE-07 R1, R6 |
| F-d2 "File deleted", never the name | **Pass** (sent-file chip) | The chip reads "File deleted" (Flow A run); the citation half is left out | — |

### Flow G retest (G1 to G9, G-d1, G-d2; run live 2026-10-19 against the 18 Oct backend)

This replaces the first Flow G run of the same day; it covers every check again. The doc-12 ids used elsewhere in this ticket are G-C01 to G-C09, G-D01, G-D02 in the same order.

**How it was run.** First, live: `GET /library/prefs` and `GET /library/org-settings` are still `404 {"detail":"Not Found"}` for You and for Maya (so is `GET /library/summary`). So the **screens** were run again with `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS=true` set for the dev server process only (`.env.local` untouched) and both endpoints answered by a Playwright stand-in that follows the BE-01 contract. **Those results prove the screens, not the backend.** Second, **without a stand-in**, what the backend does with the switches it should enforce was checked by calling `POST /chats/create` as Maya directly (files `g19x-mvf79dvr-*`). Third, `services/organizations` was read (no commit since before 16 Oct). Maya was not removed and nobody left: Remove was opened and cancelled, and Leave was looked for. Stand-ins: no Sam; Maya's `g2-return-note` and `g8-payment-terms` stand in for Return policy 2026 and Payment terms.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| G1 Admin page rows, Storage "of 20 GB" with a bar | **Partial** | (Stand-in.) Auto-save default, Force auto-save off, AI reference, File size limit "50 MB", File types, and Storage from the real `GET /library/storage`: "52.7 MB used", Files 38.6 MB · 61 files, Images 12.9 MB · 15, Audio 1.2 MB · 2. No "of 20 GB": `limitBytes: null`. Without the stand-in the page cannot load | BE-01 R1 to R6; decision 7 |
| G2 Force auto-save off: Maya's row "Never", turned off; a sent file is not saved | **Partial** | (Stand-in.) Maya's row: "Your Admin has turned auto-save off", "Never", disabled; the composer sends `saveToLibrary=false`, which the backend now honours. **Live, no stand-in:** the backend has no force-off of its own. Maya's send **without** `saveToLibrary` saved and listed the file (`449f37f2…`, chat `29bc8c6f…`); with `saveToLibrary=false` the file stayed out (chat `afd6079f…`). So force-off holds only while the client sends `false` | BE-01 R5 (enforce on the server), BE-03 R2 rule 1 |
| G3 AI reference off: Maya's switch off with "Your Admin turned this off", chat note, browse and search still work | **Partial** | (Stand-in.) Switch off and disabled with the line; composer: "Your Admin has turned off Library search. Attaching files still works."; Library browse and search "return" work. **Live:** nothing reads the setting. A send carrying `librarySourcesOff=true` and `aiReferenceEnabled=false` returned `200`, the fields were silently dropped and the file was saved (`649ccd19…`, chat `1d252f22…`) | BE-01 R5, BE-04 R4 |
| G4 Maya: no Admin pages; notice that defaults changed | **Partial** | (Stand-in.) Maya's Settings has no Workspace section; opening `/settings/workspace-library` reads "Only workspace admins can see this page". Library shows "Your Admin changed Library settings" with the three lines the stand-in sent. The real backend sends no `settingsChanges` | BE-01 R1 (`settingsChanges`) |
| G5 Audit log and Inventory, static, "Phase 2" | **Pass** | Both pages and sidebar entries read "Phase 2", Admin only (front end only, behind the flag) | — |
| G6 Remove asks the leaving person one mandatory question | **Blocked** | Members → Remove on OS8 Test01 shows an inline "Cancel / Confirm remove", no question; Cancel kept her. `DELETE /organizations/{id}/members/{memberId}` still runs `offboardFromOrganization` at once: projects, private chats, memberships and share targets go, no Library step, no pending state | BE-11 R1 to R4 |
| G7 Yes transfers shared files, No deletes; never-shared files deleted either way | **Blocked** (not run) | `offboarding.py` never touches `Document` rows, so Maya's Library files would stay hers, with their shares, after removal | BE-11 R2, R3 |
| G8 Before force-off: row shows the default; Ask each time asks "Save 1 file to Library?" | **Partial** | (Stand-in.) Maya's row: "Using your workspace's default", "Ask each time". On 19 Oct Don't save still saved the file; since the backend now honours `saveToLibrary=false` the send half works, but the default itself lives only in the stand-in | BE-01 |
| G9 AI reference off: "I couldn't find this in your files."; normal answer once the file is added | **Partial** | **Live:** with nothing attached, Maya asked for a fact only in her `g19x-…-0` note (chat `421ec7d6…`). The agent ran `list_chats`, `read_chat`, `ls`, `execute`, then said "I can't access the contents of the earlier `g19x-mvf79dvr-0.txt` note from this chat. Please upload it again". So Library is not searched (there is no Library retrieval, switch on or off), the wording is not the prototype's, and the agent reached the file name through chat tools. The "file added" half passed on 19 Oct ("Your return window is 45 days.") and was not re-run | BE-04 R1 to R3, BE-01 R5 |
| G-d1 Removed person: "Removed", gone from Who has access | **Blocked** (not run) | Same cause as G7: removal leaves her shares in place. "Viewing as" is prototype-only | BE-11 R6 |
| G-d2 Leave asks the same question; Admin's Leave dimmed "Name another Admin first" | **Blocked** | No Leave button for Maya on Settings → Library, General or Account (`SHOW_DANGER_ZONE = false`). `POST /organizations/{id}/leave` takes only `successor_admin_user_id` and runs the same offboarding, no question | BE-11 R4 |

### Flow H retest (H1 to H25, H-d1 to H-d4; run live 2026-10-19 against the 18 Oct backend)

**How it was run.** The real app on `localhost:3000` against `devapi.getsouvenir.com`, as You (admin, 79 listed files) and Maya (member, 36). Every list, filter, search and Suggested call was also made directly to the API for both accounts (all pages, `limit=100`), so a pass means both the screen and the server agree. Loading, Empty and Error were forced with Playwright routes, as on the first run. No third person exists, so "+2" and "As Sam" use Maya. No test files were made for H; it used the files earlier flows left (`h1-terms-net30`, `h2-nova-notes`, `h5-maya-brief`, `e3uj8y Payment terms` and others). The first H run (next section) is superseded by this table; it is kept for the counts and notes it records.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| H1 Header, "N used" everywhere but Trash, Filter and Sort then search and Trash, no Upload | **Pass** | "Library 52.7 MB used" on every tab and while searching ("Search 52.7 MB used"), not on Trash; icon buttons, "Search Library", Trash icon; 0 upload controls | — |
| H2 Suggested and All files always; Shared once something is shared with you, dot while unread | **Pass** (was Partial) | `tab=shared` now holds **no** owned files: You 3 (all `viewer`, 1 unread), Maya 7 (all `viewer`, 4 unread). Both see the tab; its dot is labelled "Unread". A person who only shared out gets no tab, since the tab reads `tab=shared` | — (R10 would replace the list call) |
| H3 Recent: five cards, newest activity first, Opened / Modified / Shared with a short time; unread dot after the title | **Partial** | Five cards in time order ("Opened today" ×3, "Modified today", "Shared today"). But `e3uj8y Payment terms`, shared with You and **unread**, reads "Modified today" (`lastActivityKind: "modified"`), where the prototype says an unread shared file reads "Shared". The order still ranks by a chat or routine use the row does not report (`suggested()` `touched` includes `usedAt`) | BE-12 R6 |
| H4 Frequently used up to three, "Opened N times", no repeats; Generated up to three "Run of" tiles, only for You | **Partial** | Frequently used shows 3 (the API sends 6), none from Recent. Generated as You: three `files/Draft_product_copy_2026-10-19.docx` tiles with no "Run of" line (`generatedFrom: {kind: "chat"}`); as Maya: three images made in her chats (lighthouse, two `cat.png`) | BE-12 R5, R6; BE-07 R4; decision 11 |
| H5 See all | **Pass** | Recent → `/library?tab=all`; Generated → `/library?tab=all&source=generated` with the chip | — |
| H6 Card opens the file, close returns to Suggested; … opens the menu only | **Pass** | Card → `/library/files/6d76e1a8…`, Close → `/library`. The card's … menu: Open, Ask about this, Share, Download, Rename, Delete, URL unchanged; Escape closes it | — |
| H7 All files columns and Access avatars | **Pass** | Name, Access, Source, Created ("Today, 4:00 PM"), Type, and a … per row, newest first. Owner first: "T O" for a file shared with Maya, the building circle for a workspace share | — |
| H8 Sparkle on every Generated file, tooltip says where from | **Partial** | Sparkle on every Generated row, unread dot after it. The tooltip can only say "Generated in <chat>": run outputs carry `kind: "chat"` (e.g. "Draft product copy") | BE-12 R5, BE-07 R4 |
| H9 Only Name and Created sort, arrows always, reverse on second click | **Pass** | `aria-sort` none / descending; Name → `sort=name` (rows from `a1-autosave…`), again → `dir=desc`; Access, Source, Type plain | — |
| H10 Sort button choices, tick matches the heading | **Pass** | "Sort by" Name ✓ / Created, then Z to A ✓ with the Name heading's down arrow; outside click closes | — |
| H11 Filter panel sections and options | **Pass** | Source: Uploaded, Generated, Shared. File type: Images, Documents, Spreadsheets, PDFs, Audio | — |
| H12 Counts per filter | **Pass** (was Partial) | API and list agree. You: all 79, Uploaded 58, Generated 21, **Shared 10 (7 owned and shared out + 3 shared with You)**, Images 16, Documents 48, Spreadsheets 3, PDFs 10, Audio 2. Maya: Shared 10 (3 + 7). The prototype's 15/4/11/8 are sample data | — |
| H13 Two in one section widen; one in each narrows | **Pass** | Uploaded + Generated 79 (= all); Shared + Uploaded 59 (the union); Generated + Documents 6 | — |
| H14 Chips, X, Reset | **Pass** | "Uploaded" and "Audio" chips beside Filter; the list shows the two recordings | — |
| H15 "No files match" with Reset filters | **Pass** | As Maya, Generated + Audio: "No files match", Reset filters → `/library?tab=all`, 22 rows on screen | — |
| H16 … menu items; Download; Ask about this | **Pass** | Open, Ask about this, Share, Download, Rename, Delete. Download and Ask about this not re-run (passed on the first run; unchanged code) | — |
| H17 As Sam, Share, Rename, Delete off with "Only the owner can change this" | **Pass** (first run, as Maya) | Not re-run; unchanged front end, and `403 only_owner` holds (Flow E retest) | — |
| H18 Search: no tabs, Filter or Sort; snippets; "net 30" finds the contract and the recording; never Trash | **Partial** (better) | Words are ANDed: "net 30" gives **6** rows (was 15), all containing both words; "30 net" the same; "supplier nova" 3; "zzz" none; trashed files absent. Snippets show. Tabs, Filter and Sort are hidden. **Still:** Supplier contract - Acme is 4th, after `qa-seed-return-policy` (no phrase-first step, rank only), and the Supplier call recording is never found (no transcript indexed). Sort is ignored while searching (same order for all four sorts), so the headings are now plain labels (front end, below) | BE-12 R3 (phrase first), R4 (BE-06 R2) |
| H19 "In Shared" leaves out your files; All of Library; no match | **Pass** (was Fail) | You, "nova": In Shared → 1 (`h5-maya-brief`, Maya's); All of Library → 4 (three of You's + Maya's). Maya, "nova": In Shared → `h2-nova-notes` only. From All files both scopes give the same list. "zzz": "No files match / Try other words / Clear search" | — |
| H20 Shared columns, unread first then newest | **Pass** (was Partial) | Name, Access, Date shared, Type. Maya: four unread (newest first), then three read; You: the unread `e3uj8y` first. No owned file in either | — |
| H21 Trash screen | **Pass** | "Library > Trash", no tabs, Filter, Sort or search; "Frees up 4 KB", Empty Trash; Name, Days left ("30 days"), Size, Deleted. Maya: "Trash is empty". `GET /library/trash?limit=2` still returns all 3 (no `limit`) | BE-12 R9 (limit) |
| H22 Loading, Empty, Error, search error | **Pass** | Skeletons while held; "No files yet / Attach a file in a chat / New chat" on Suggested and All files; "Couldn't load your files. / Try again"; search: "Search is unavailable right now / You can still browse and attach files by hand / Try again" | — |
| H23 No upload in Library | **Pass** | No Upload button, tray or drop area | — |
| H24 Escape, outside click, Tab, Enter | **Pass** | Escape closes the card menu, an outside click closes Sort, Enter on a focused card opens its file | — |
| H25 Narrower window | **Partial** (front end) | All files: 1300 px all columns; 1000 px Source hidden; 800 px Access and Type hidden; 600 px Name only. Shared: 1000 px Type hidden. Toolbar wraps with no overlap and no page scroll. **But** at 600 px the tab row cuts "Shared" off, and at 420 px the app sidebar stays open and leaves the Library about 130 px (the header is clipped) | — (front end: sidebar and `Tabs` at narrow widths) |
| H-d1 Filter ticks carry over and are ignored while searching | **Pass** | Search sends no filters; unit tests in `query-params.test.ts` | — |
| H-d2 Sort fallback between tabs | **Pass** | Unchanged; unit tests | — |
| H-d3 Same name twice is two rows | **Pass** | `a19o4o-a6-same.txt` twice under Name sort, with different Created times | — |
| H-d4 Open from Shared or a search result, close returns there | **Pass** | Back to `/library?tab=shared` and to `/library?tab=all&q=nova` | — |

**Also checked on the API.** A tampered cursor → `400 bad_cursor` ("This list changed. Please reload."). `sort=size` → FastAPI's own `422 {"detail": [...]}` (not the `fieldErrors` body, C-01). `limit=100000` is clamped (`200`). A one-letter `q=a` is accepted by the server (the front end only searches from two letters). `GET /library/summary` → `404`. List rows have no thumbnail fields.

**Front end changed in this run.** While searching, the Name and Created / Date shared headings are plain labels (no arrows, no `aria-sort`), the hidden result count says "N results, best matches first", and the list request no longer varies by a sort left in the URL (nor by Shared's unread-first order), so a stale sort does not refetch the same results. `headingSort` and `toListParams` in `src/lib/library/query-params.ts`, used by `FilesView.tsx` and `FileTable.tsx`; tests in `query-params.test.ts`.

### Flow H results by check (25 checks and 4 depth items, run live 2026-10-19)

*Superseded by "Flow H retest" above; kept for its counts and notes.*

Test data: admin "You" (61 files, 18 Generated) and Maya (31 files); Maya stands in for Sam, and no third person exists, so the "+2" avatar and "As Sam" were not tested. Counts were compared with `GET /library/files` for each filter, not with the prototype's 15/4/11/8.

| Result | Checks | Notes |
|---|---|---|
| **Pass** | H1, H5, H6, H7, H9, H13, H14, H15, H16, H17, H21, H22, H23, H24, H-d1, H-d2, H-d3, H-d4 | Download really downloads; Ask about this opens a new chat with the file attached; Loading, Empty and Error pass on Suggested, All files, Shared, Trash and search |
| **Pass after a front-end fix** | H10, H11 (ticks on the chosen option), H25 (at 800 px and below the Name column shrank to nothing; now Type, then the date, give way) | |
| **Partial** | H2 (Shared tab appears for someone who only shared out), H3 (Recent order can disagree with the line shown), H4 (Generated holds chat images, no "Run of" line), H8 (routine wording needs the routine origin; tooltip itself fixed in the front end), H12 (counts match the API, but Source: Shared means only shared with you), H18 ("net 30" returns 15 files, recording never found), H20 (Shared list also holds files you own) | Backend causes are R1 to R6 of BE-12 |
| **Fail (backend)** | H19 ("In Shared" returned files You own) | BE-12 R1 |

### All flows retest (X1 to X13; run live 2026-10-19 against the 18 Oct backend)

This replaces the first "All flows" run of the same day; it covers every check again. As You and Maya on `localhost:3000`; X4 to X6, X9 to X11 and X13 reuse the Flow H retest of the same afternoon.

| Check | Result | What happened | Still needed (backend) |
|---|---|---|---|
| X1 Only File, Trash, Upload, Output; never Item, Shelf, Folder, Collection | **Pass** | No banned word on Suggested, All files, Shared, Trash, a File page or Settings → Library | — |
| X2 Owner manages, Viewer opens only, no access sees the locked page, Admin pages Admin only | **Pass** | You on your own output: Share and File info enabled. Maya on You's `h1-terms-net30` (shared): Share, Rename, Manage access and Delete disabled. Maya on You's private `2d60bd56…`: "You don't have access / Ask the owner to share it". Maya on `/settings/workspace-library`: "Ask an admin in your workspace if you need a change here." | — |
| X3 Every file state has a look | **Partial** | Ready, Locked (above), Trash ("No longer available / Back to Library" for `315c0b35…`) and failed processing ("Library processing failed. The original file is still available in chat and for download. / Try again" on `u2aygg-a5-note.txt`) pass, and the composer shows "Uploading… N%" and "Processing" (A2). A **File page** still cannot show Uploading: staged uploads have a phase only on `GET /library/uploads`, and `FileDetail.phase` is still `Literal["ready"]` | BE-02 R1 (`phase` on the file), R9 |
| X4 Lists have loading, empty and error | **Pass** | H22 | — |
| X5 Status shows a word or icon, not only colour | **Pass** | Unread dot labelled "Unread", "Processing" badge, "AI-generated" on the File page | — |
| X6 Suggested, All files, Shared; Trash from the header button; run outputs in All files as Generated | **Pass** | H1, H2, H5, H21 | — |
| X7 Search clears on leaving Library, stays after opening a result | **Pass** | `q=nova`, Schedules, then Library in the sidebar: back on `/library` with an empty box. Open and close from results keeps `q=nova` (H-d4). No file state switch exists in the real app | — |
| X8 Recent wording, unread shared reads "Shared", "Opened N times" | **Partial** | Wording and short times right, but an unread file shared with You reads "Modified today" (H3) | BE-12 R6 |
| X9 Sparkle after a Generated name, Access column, unread dot beside the name | **Pass** | H7, H8 (the tooltip's routine wording waits on BE-12 R5) | — |
| X10 Filter and Sort icon buttons, only Name and Created sort, two sections, chips, Reset | **Pass** | H9 to H15 | — |
| X11 "N used" beside the title on every tab | **Pass** | H1 | — |
| X12 No box around file icons; switches show no On or Off word | **Pass** | 0 icon wrappers with a background in All files rows. The settings switches (G retest, stand-in) read only their label | — |
| X13 Files come in through a chat; no Upload button or drop area | **Pass** | H23 | — |

---

## Part 2. Backend work

**Suggested order.** BE-02 and BE-03 first (everything about saving builds on them), then BE-01 (same send path), then BE-04, then BE-05, BE-07, BE-09, BE-11, BE-12, BE-08, BE-06, and BE-10 last (it needs Slack connected to test). In parallel, the cross-cutting rules in Part 0 (C-01 error body, C-02 idempotency, C-04 real keyset cursor) should land first, because every item below returns errors and most create things.

**Each item uses this layout:** Covers, Seen live, Where in the code, Requirements (with contracts), Errors, Data, Edge cases, Authorisation, Observability, Front end, Rollout, Acceptance tests.

---

### BE-01. Library settings: personal prefs, workspace settings, and enforcing them

**Covers:** A1, A4; Flow G checks G1 to G5, G8 (doc-12 ids G-C01 to G-C05, G-C08). **Blocks:** A4 live test, and re-running Flow G against the real backend. **Related:** BE-03 (send), BE-04 (retrieval switch).

**Status after the 18 Oct backend: not started.** `GET /library/prefs` and `/library/org-settings` are still `404` (checked live 2026-10-19, and again for both accounts in the Flow G retest). Keep `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` off. **Flow G retest (Part 1):** the screens pass against a stand-in; live, the server enforces nothing (R5): a send without `saveToLibrary` is saved whatever the Admin chose, and `librarySourcesOff` / `aiReferenceEnabled` on a send are dropped silently with `200`. `limitBytes` is still `null` (R6, decision 7).

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

R8. **(New, 20 Oct Flow G run) Storage on the Admin page is the workspace's.** `GET /library/storage` sums only the caller's own listed files (`services/library/library.py:701-720`), and trashed files count. The Admin page showed the admin's 53.2 MB, while Maya's page showed her 12.4 MB, both "of 20 GB". Either return workspace usage for Admins (for example `?scope=workspace`), or document that the limit is per person. Decide whether Trash counts. The limit is one global value (`services/document/settings/library.yaml:2`, 20 GiB), not per workspace.

R9. **(New, 20 Oct) Force auto-save off on the uploads endpoint.** `POST /library/uploads` with `staged: false` makes a listed Library file (`services/library/uploads.py:299, 305`) even when the workspace forces auto-save off. Only `maxFileBytes` and `allowedFormats` are checked (`prefs.py:166`). The web composer always stages, so the app is not affected, but the API is. With force-off on, treat every upload as staged, or refuse `staged: false` with `403 autosave_forced_off`.

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

**Status after the 18 Oct backend (read in code and re-run live, Flow A retest).**

| Req | Status | How it was built |
|---|---|---|
| R1 Staged state | **Done, differently** | `POST /library/uploads` takes `staged: true`; the `Document` is made with `listed = false` (a boolean, not the `life` enum). Every list, search, Suggested, storage total and the picker add `listed = true`. A staged file is **not indexed** until send (`processUpload` skips the index when unlisted). No partial index was added |
| R2 Promote on send | **Done** | `Library.show()` sets `listed = true` and enqueues indexing |
| R3 Discard | **Done** | `DELETE /library/uploads/{id}` after processing deletes the unsent document through `remove_document`; `409 upload_done` once it is listed or attached to a message |
| R4 Cleanup | **Done** | `sweepUploads` removes unsent staged documents with the stale upload records (`uploadHours`) |
| R5 One upload, one file | **Done** | The `sha256` reuse was removed; each upload is its own `Document`. No storage-level sharing |
| R6 Refuse before ready | **Not done** | The checks still run in indexing, now **after send**. A corrupt or password-protected PDF is `ready` at upload, then `processing: "failed"` in All files and in the picker |
| R7 Unsafe gate by content | **Not done** | `.exe` renamed `.pdf` is accepted; only the extension is checked (`415` at init) |
| R8 Late indexing failure | **Not done** | Failed files stay listed with a failed badge (decision 2 in Part 4) |
| R9 Visible phase | **Partly** | The owner can open a staged file by id (`phase: "ready"`), but `FileDetail.phase` is still never `uploading` or `processing` (X3) |
| R10 Init refusals, `Idempotency-Key`, rate limit | **Partly** | `413`/`415` at init exist; no idempotency key, no rate limit |

Front end: composer uploads now send `staged: true`, and X on a finished, unsent file calls discard (`controller.ts`, `composer-uploads.ts`, 2026-10-19).

**20 Oct (X3 retest, live against `45b2ef3e`).** R9 now works for `uploading` and `processing`: a 40 MB upload left unfinished opens with `phase: "uploading"`, and while the checks run the detail says `phase: "processing"`, `processingPhase: "queued"`. R6 runs before ready now (`services/library/inspect.py:33-60`): a corrupt PDF ends `failed: unreadable` and a password-protected one `failed: password_protected`. Gaps left:
- **R9: `failed` never reaches the File page.** `failUpload` (`services/library/uploads.py:266-276`) deletes the unlisted `Document` and clears `upload.document_id`, so the File page of a refused upload answers `404 file_gone` ("No longer available"), and the reason is shown only in the composer. Either keep the detail readable for the owner with `phase: "failed"` and `failureReason` until the sweep, or document that `failed` is only ever the Library-processing failure (`processingPhase: "failed"` on a listed file).
- **R9: preview of an uploading file is `500`.** `Library.preview()` (`services/library/library.py:479-489`) only checks `processingPhase` for formats that need conversion; a PDF still uploading goes on to sign a link to bytes that are not there and fails with `500`. Answer `409 preview_processing` while the upload phase is `uploading` or `processing`. (The front end now skips the preview while uploading, but its first warm-up request is sent before the detail arrives.)

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

**Status after the 18 Oct backend.** **R1 partly:** `saveToLibrary` is read on `POST /chats/create`, `/chats/{id}/stream` and both persona routes (`true`/`false`/absent, anything else `422`); `librarySourcesOff` and `Idempotency-Key` are not. **R2 partly:** rules 3 to 5 work (`false` keeps the file unlisted, absent or `true` lists it, also for plain multipart `files` through `workspace.persistMany`); rules 1 and 2 (force-off, the chat flag) need BE-01 and R4. **R3 done:** `show()` sets `origin_chat_id` with `coalesce`, so a new chat links its file and an existing origin is kept (A5 passes). **R4 not done** (no `library_dont_save`; the front end keeps it in localStorage). **R5 not done** (no `savedFileIds` / `chatOnlyFileIds` event). **R6 partly:** `404 file_gone` for a trashed file, `403 file_locked`; no `not_ready` or `too_many_files`. Re-run: A5 and A14 pass. Slack DMs now save attached files to Library (`slack/turn.py` `libraryNames`), channels do not. **Flow G retest (2026-10-19):** `saveToLibrary=false` keeps Maya's file out and an absent flag saves it, so G2 and G8 hold only while the client sends `false`; R2 rule 1 (force-off on the server) is still missing. Unknown form fields (`librarySourcesOff`, `aiReferenceEnabled`) are accepted and ignored, against R1's "unknown fields are rejected".

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

**Status after the 18 Oct backend.** **R5 done** (`document_id` on every attachment in `GET /chats/{id}/messages`, kept after Delete forever, see BE-05). **R1 to R4 and R6 not done.** Re-run A13 (2026-10-19): with nothing attached, the answer to a question only a saved file can answer was a made-up "30 days" (the file says 73), so the missing retrieval now also produces wrong answers, not only "I don't see any files". Nothing reads `librarySourcesOff`. **Flow G retest (G9, 2026-10-19):** with nothing attached, asked for a fact only in Maya's saved note, the agent ran `list_chats` and `read_chat`, named the file (`g19x-mvf79dvr-0.txt`) and asked her to upload it again. Not "I couldn't find this in your files." (R3), and with the Admin's AI reference off it should not reach Library files through chat tools either (R2). **Re-run 2026-10-20 (backend `45b2ef3e`):** still not done. A13 answered "30 days" from the agent's memory file `/memories/business/customer-fulfillment.md`; `aiReferenceEnabled` (user and org) is stored but read only in services/library/prefs.py; `librarySourcesOff` is now refused with `400 bad_request`, so the front end keeps it in the browser.

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

**Status after the 18 Oct backend (re-run on Flow A files).** **R1 done:** each attachment has `libraryState` (`open | deleted | locked`, worked out for the reader), and a non-open file has `file_link: ""` (empty, not absent) and, when locked or purged, `file_name: ""`. A trashed file keeps its name for the owner. **R2 done:** `attachable` answers `404 file_gone` for a trashed file, owner included (seen live). **R3 done:** `remove_document` sets `MessageFileAttachment.document_deleted_at` and keeps `document_id` (the foreign key was dropped). **R4 and R5 not done** (no `savedFiles`, no soft delete, no restore). Front end, 2026-10-19: the history no longer drops an attachment whose link is empty; deleted and locked ones keep a chip that reads "File deleted" / "Locked file" straight from `libraryState` (seen live: Trash → "File deleted", Restore → the name again).

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

R6. **(New, 20 Oct Flow F run) The model never sees a trashed file's contents.** Seen live: a file sent in a chat, then moved to Trash; asked in that same chat "What is our return window according to the file I uploaded earlier?", the answer was the file's own fact ("61 days from delivery") with no tool call. In a new chat the sandbox correctly said "Available files: none". Cause: `get_chat_file_attachments` (`services/chat/repository.py:387-412`) filters only on message `deleted_at` and origin, never on `Document.trashed_at` or `MessageFileAttachment.document_deleted_at`. Through `fetch_prior_atts` (`chat/service.py:263-267`) and `Workspace.adoptAttachments` (`document/workspace.py:173-189`) the file stays in `<available_files>` (`llm/context_evidence.py:27`) with its original s3 key. Also check that earlier turns' extracted text in the message history is dropped or redacted for trashed files. The history read path already does this right (`chat/repository.py:146-169`). Acceptance: trash a file used in a chat, ask about it there: no contents, no name, and "I couldn't find this in your files."

R7. **(New, 20 Oct) Restore brings back the files trashed with the chat.** `restore_chat` (`chat/service.py:984-992`, `chat/repository.py:552-569`) brings back the chat, its messages and its pins only. The front end trashes the files itself after the delete (no `deleteFiles` or `trashed_with_chat_id` yet), so the restored chat shows "File deleted" (seen live). Until R5's `deleteFiles` and file restore land, the front end hides Undo when files went to Trash. Also, `soft_delete_chat` hard-deletes `ChatContext` rows (`chat/repository.py:583`), and restore does not bring them back.

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

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits touches this item. **Re-run 2026-10-20:** partly there by another route. With a `.wav` attached, the agent calls the `transcribe_audio` tool (sandbox/router.py:194-205, returns `{name, text}` only), the chat shows "Transcribing — <file>" and the answer is right. Still missing: a stored transcript with timed lines on the file (services/files/models.py:228 keeps transcription an explicit operation), so no citation into the recording and no search hit (H18).

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

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits touches this item, and `services/automations` has no commit since 16 Oct. Flow B re-run on 2026-10-19 (Part 1, "Flow B retest"): B1 to B3, B5, B6 fail, B4 passes. **New:** a routine the chat creates as instructions (`kind: "model"`, `entry: scripts/automation.md`) finishes "succeeded" with an answer naming a `.docx`, and no Library file is made (see R11). **Flow C re-run on 2026-10-19** (Part 1, "Flow C retest"): C3 to C6, C9 pass; C-d1 passes on the server (one run) and in the app after a front-end fix (a double-click sent two POSTs); C1 and C2 partial (R4 titles, R5 output kind), C8 fails (R4: still `provenance.kind: "chat"`), C7 and C-d2 blocked (R10; R1 and R6).

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

R11. **Every routine kind saves its output file to Library (new, 2026-10-19).** A `kind: "model"` run (the agent follows `scripts/automation.md`) must hand each file it produces to the same Library path as script runs and chat turns (`Workspace.library`, source `generated`), with R4's name and provenance. Seen live: run `0e9449f9…` of routine `8d09a205…` answered "Attached `b3acbf-product-copy-2026-10-19.docx` as the run result." and no `Document` exists for it. In code, the model path ends in `finishRun(files=runState["generated_attachments"])` (`runner.py` ~line 474), and only files that go through `registry.persist` / `Workspace.library` become Library files; a file the agent only writes into the routine's folder does not. If the run says it made a file and none was saved, the run must not read "Completed" with no output (C-06): either save it or mark the run failed with a reason.

R10. **Optional (product call): "ready" notice.** When a routine is connected to Slack, post "<Routine> is ready." with a link once a run saves its output (C7). Without it, C7 depends on each routine's own script.

R12. **Return `shared` (new, 2026-10-20).** `PATCH /automations/{id} {shared}` works: on the 20 Oct retest, Maya saw the routine only while it was `true`. But no response includes the flag. `automationDict` (`services/automations/repository.py:212-236`) and `AutomationBase` (`schemas.py:220`) leave it out, so even the PATCH response doesn't say whether the routine is shared. Add `shared: bool` to the list, detail and PATCH responses (C-03) so the front end can show a "Share routine" control with its current state.

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
11. A routine created from chat as instructions (`kind: "model"`) that is asked for a Word document: Run now adds that document to All files (Source: Generated) with R4's name; a run that claims a file but saves none is not "Completed".

---

### BE-08. Sharing by asking in chat

**Covers:** E7, E8, E-d1 (chat half), and the chat half of E9.

**Status after the 18 Oct backend: not started.** Re-run E7 (2026-10-19): no share tool; the agent offered to share the file by driving the web app in a browser ("Approve browser access and I'll share it"). Until R1 exists, the agent should say sharing is done from the Share dialog instead of offering browser automation. **Related:** BE-10 (Slack channel rule), BE-12 (unread, trash), C-02, C-06.

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits touches this item.

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

R5. **No browser automation for sharing (added 2026-10-20, ship before R1).** Re-run live 20 Oct against `45b2ef3e` (no backend commit since): all four prompts ("share the Weekly sales report with OS8 Test01", "share Payment terms with OS8 Test01" (a file You does not own), "share the Weekly sales report with Lena" (not a member), "share Brand guidelines with OS8 Test01" (already has it)) ran only `skills` / `execute` / `list_chats`, sent no `library_shared` event, shared nothing (`GET …/access` unchanged), and **each** reply offered to share "through Souvenir's browser interface" if approved. For Lena it asked "Do you approve that route to share it with Lena?", and for Payment terms it offered to share a file the asker cannot share. Approving would have the agent click through the web app as the user, skipping R1's refusals. Until R1 exists, the agent prompt (`services/llm/agent.py:55-58`, which points sharing at the `product/souvenir` skill) and the `browser` skill must not offer to drive the Souvenir web app to share, rename or delete Library files. Reply instead: "I can't share files from chat yet. Use Share on the file in Library." After R1, the browser route stays off for Library actions. Code refs today: `services/library/router.py:144-151` (grants routes), `services/library/library.py:663-697` (`share` / `unshare`); nothing outside `services/library` calls them.

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

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits touches this item. Re-run 2026-10-19 (D4, Part 1 "Flow D retest"): `POST /library/files/8d081d29…/access-requests` as Maya is still `404 {"detail":"Not Found"}`; with the flag on, the button stays "Request access" and an error toast shows. Keep `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS` off.

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

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits builds R1, R2 or R4 to R7. **R3 partly, and against the prototype:** `slack/turn.py` `libraryNames` now saves every new uploaded attachment in a **direct message** to Library (`Workspace.library(origin=UPLOADED)`: `source: "uploaded"`, owner = sender, `origin_chat_id` = the Slack turn's chat), without being asked, with no confirmation from the bot, and still answered as `via: "web"`; channels save nothing. So D7 (private to the sender) would pass and D-d1 ("not saved unless asked") would fail. Re-checked 2026-10-19: Slack is still not connected (`/slack/status` → `{"workspaces":[]}` for both accounts), so D1 to D3, D5 to D7, D-d1 and D-d2 stay **Blocked** (Part 1, "Flow D retest").

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

R8. **Save files the bot fetched, too** (found 2026-10-20, code read at `45b2ef3e`). A file the bot pulls from the Slack thread with its fetch tool is registered with `origin=SLACK` (`services/slack/tools.py:981`), but `libraryNames` keeps only `origin == UPLOADED` (`services/slack/turn.py:123-129`) and `Workspace.library` maps no source for `"slack"` (`services/document/workspace.py:423-425`, returns early). So "save this to Library" about a file sent in an earlier message of the thread can never be saved. R3's save must cover both origins, and the save must go through the BE-02 pipeline, not the direct `Document` insert at the chat file's `s3_key` (`workspace.py:434-446`).

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

**Status after the 18 Oct backend: not started.** Nothing in the three Library commits touches this item. **Flow G retest (2026-10-19):** `services/organizations` has no new commit. Members → Remove on Maya still shows only an inline "Cancel / Confirm remove" (opened and cancelled), `DELETE /organizations/{id}/members/{memberId}` and `POST /organizations/{id}/leave` both run `offboardFromOrganization` at once, which never touches `Document` rows or their shares, and there is still no Leave button (`SHOW_DANGER_ZONE = false`). G6, G7, G-d1 and G-d2 stay **Blocked**; nothing was removed and nobody left.

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

**Status after the 18 Oct backend (read in code and re-run live, Flow H retest in Part 1).** **R1 done:** `tab=shared` is `sharedTab()` = not owned and shared with me. Live: You's Shared holds 3 files, Maya's 7, none owned by the caller; "In Shared" search leaves owned files out (H2, H19, H20 pass). **R2 done:** `source=shared` is `sharedSource()` = shared with me **or** owned and shared out (decision 4 taken the prototype's way). Live: 10 for You (7 shared out + 3 shared in), 10 for Maya (3 + 7); with Uploaded it is the union (H12, H13 pass). The front end switched `useHasShared` to `tab=shared` in the same change (2026-10-19). **R3 partly:** search ANDs the words (`everyWord` = `plainto_tsquery`): "net 30" went from 15 rows to 6, all holding both words. It orders by a whole-query name match first and then `ts_rank`, and ignores `sort` (the same order for all four sorts; the front end now shows plain headings while searching). Still missing: the phrase-first step (Supplier contract - Acme is 4th for "net 30"), a server minimum length (`q=a` is accepted), and a rank cursor (the same offset cursor, C-04). **R4 to R12 not done:** no recording in search (R4), `generatedFrom.kind` always `"chat"` (R5), Recent ranks by an unreported use and an unread shared file reads "modified", Frequently used sends 6 (R6), unread again after a re-share (R7, not re-run), Trash lists only owned files and ignores `limit` (R8, R9), offset cursor (R9), `GET /library/summary` `404` (R10), no thumbnail fields (R11), Suggested has no per-section `error` (R12).

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

*20 Oct (X8 retest).* The front end now reads an unread shared file as "Shared <sharedAt>" itself (`unread` and `sharedAt` are on the row, `library.py:286-288`), so that half needs nothing more. Still wrong: `last_activity_kind` is one value per document, not per viewer. The owner sharing with someone else (`library.py:687`) or renaming (`library.py:629`) changes every viewer's line, so a file the member already opened reads "Shared today" (Supplier contract - Acme, seen live) and `row()` (`library.py:261-263`) only corrects it when the viewer's own open is later. Report the kind and time per viewer: the viewer's own share time, open or use, or the owner's change.

R7. **Unread again.** When a grant is added for someone who already opened the file, make `unread` true again: clear their `DocumentView.opened_at`, or keep a `shared_seen_at` older than the grant. Removing the grant must not leave the file unread for them (`04` section 6.2). **Seen live 2026-10-20 (E-d2):** Supplier contract - Acme, which Maya had opened on 19 Oct, was shared → `unread: false` straight away; opened, unshared, shared again → still `unread: false`, and it sits in Maya's Shared with no dot. Cause: `unread=not owned and bool(mine) and view is None` (`services/library/library.py:284`) never compares the view with the grant's `created_at`, and `share` / `unshare` (`library.py:663-697`) leave `DocumentView` alone. A file opened for the first time does clear (Brand guidelines: unread → `POST …/opened` → not unread, dot gone).

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
- `src/lib/library/queries.ts` (`useHasShared`): the Shared tab and its unread dot read `tab=all&source=shared`, so they appear only when something is shared with the person (H2). The Shared list itself still calls `tab=shared`, so it still holds files the person owns until R1. **Done 2026-10-19:** R1 and R2 shipped together on 18 Oct, and `useHasShared` now asks `tab=shared` again (`GET /library/summary` can replace it once R10 exists).
- `SuggestedView.tsx`: a Recent card's unread dot sits right after the title (H3).
- `SortMenu.tsx`, `FilterPanel.tsx`: the chosen option carries a tick (H10, H11).
- `FileMarks.tsx`: the sparkle and the unread dot sit above a row's stretched link, so hover shows "Generated in …" and "Unread"; the sparkle takes Tab focus (H8).
- `FileTable.module.css`, `FileTable.tsx`, `FormatGlyph.tsx`: below about 480 px of list width Type (and Shared's Access) hide, then the date at about 300 px, the list takes a 16 px side margin under 900 px, and the file icon no longer shrinks, so Name always stays (H25, which was a real failure at 800 px and below). Rows of a file still being prepared carry a "Processing" badge (a status in a word, not only colour, EV-05).
- `LibrarySearch.tsx`: placeholder and label "Search Library" (H1).
- *Verified and unchanged:* filters, chips, Reset, sort headings, search state, Trash screen, Loading / Empty / Error states (H5 to H7, H9, H12 to H17, H21 to H24, H-d1 to H-d4). `tsc` clean; vitest on the Library folders passes (37 files, 280 tests); one pre-existing eslint warning on the file list virtualizer (untouched). The "Processing" badge and the 600 px layout are covered by tests and a width script only.
- *Built:* the list is virtualised (`useVirtualizer`, principle 51), `useInfiniteQuery` with `nextCursor`, and list rows merge into detail without downgrading fields (`patchFileEverywhere`, principle 31).
- *Reads exactly:* `items`, `nextCursor`, the row fields in R11, `lastActivityAt`, `lastActivityKind`, `openCount`, `generatedFrom`, and `GET /library/summary` once it exists.
- *Needed after the backend ships:* header counts from `summary`; thumbnails from `thumbnailUrl`; "Run of <date>" from `provenance` or `generatedFrom.runLabel`.

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
| `libraryDontSave` and `librarySourcesOff` local copies | BE-03 R4 and BE-04 R4 (still not shipped on 18 Oct) | Replace localStorage and sessionStorage with the value on `GET /chats/{id}` |

### Still to build (not built today)

| What | Needs | Where it would go |
|---|---|---|
| Chat confirmation for a share, with Undo and "Sharing undone" | BE-08 `library_shared` event | Chat message renderer; history restore |
| Undo on the "Chat deleted" notice | BE-05 R5 (`POST /chats/{id}/restore`) | `AppDialogs.tsx` notice |
| Treat `409 already_running` as "Running now" | BE-07 R7 | `use-schedules.ts` |
| Chat-created routine: poll the test run until terminal | BE-07 R3 | `RoutineCreatedCard` |
| A mark from `groundedness` | BE-04 R3 and a design call | Chat answer |
| Library removal question, "Waiting for their answer" on Members, Leave in Settings, Library with Cancel and "Name another Admin first" | BE-11 (shapes in BE-11 R1 to R4) | Rebuild from `git show 579f2b94^:src/components/Library/settings/MyRemovalPrompt.tsx` and `src/lib/library/members.ts`; the Leave button stays off (`SHOW_DANGER_ZONE = false`) until its answer can be sent |
| Extend `ApiError` with `kind`, `retryable`; stop matching message text (`code`, `requestId` and both `fieldErrors` shapes are read since 2026-10-19) | C-01 | `src/lib/api/client.ts` (the shared change `06` names for principle 45) |
| Send `Idempotency-Key` on uploads init and complete, chat send, routine confirm, grants, access requests, removal answer | C-02 | `src/lib/api/client.ts` and the Library API functions |
| Header counts from `GET /library/summary`; thumbnails from `thumbnailUrl`; "Run of <date>" from the routine origin | BE-12 R10, R11, R5 | `LibraryHeader.tsx`, `SuggestedView.tsx`, `FileTable.tsx` |
| Re-run Flow G against the real backend (re-run 2026-10-19, still against a stand-in: the endpoints are `404`) | BE-01, BE-11 | Test as You and Maya |
| Narrow window: the app sidebar stays open below about 600 px, leaving Library about 130 px at 420 px, and the Library tab row clips "Shared" at 600 px (H25) | Nothing (front end only) | App shell sidebar (collapse or overlay when narrow) and the shared `Tabs` list (wrap or scroll) |

### Built and waiting for a backend field (no front-end work expected)

Routine chat cards and attached-files section (BE-07); sent-file chip reading "File deleted" / "Locked file" and the Delete chat dialog's saved files (BE-04 R5, BE-05); Uploading and Processing banners (BE-02 R9); transcript lines on the audio viewer (BE-06); "Uploaded by … in Slack" (BE-10); File info "Made by routine …" and "Files this run used" (BE-07 R4); thumbnails (BE-12 R11).

### Done in the front end during these runs (for the record)

| Area | Change |
|---|---|
| Flow B | Routine page has a Run outputs section and "All run outputs in Library" |
| Flow C | Run now no longer sends a second POST or re-enables during a run (2026-10-19 retest: a double-click still got two POSTs through before the re-render; a synchronous guard now drops the second, `src/lib/schedules/run-guard.ts` in `use-schedules.ts`, tests in `run-guard.test.ts`); File info says "Private" when only the owner has access |
| Flow D | "Locked file" chip opens the locked panel; Request access built behind a flag |
| Flow F | File page reads "No longer available" (no name, tab title "File") for a trashed file unless opened from a Trash row; Delete chat dialog and notices |
| Flow G | "Your Admin changed Library settings" notice back on the Library page; composer note "Your Admin has turned off Library search…" with a test; wording "Your Admin turned this off"; File size limit in MiB; Audit log and Inventory static Phase 2 pages and sidebar entries; all behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` |
| Flow H | Search placeholder "Search Library"; Recent card dot after the title; ticks on Sort and Filter menus; Shared tab and dot read `source=shared`; sparkle tooltip and "Unread" label reachable by hover and Tab; narrow-window layout (Name never collapses); "Processing" badge on list rows |
| All flows | No box around file icons (`FormatGlyph.tsx`); unused "Items moved to Trash…" string removed (`messages.ts`) |
| Flow H retest (2026-10-19) | Search results come best match first and the server ignores `sort`, so while searching the Name and date headings are plain labels (no arrows, no `aria-sort`), the hidden result count reads "N results, best matches first", and the list request no longer changes with a sort left in the URL or Shared's unread-first order (`headingSort`, `toListParams` in `query-params.ts`; `FilesView.tsx`, `FileTable.tsx`; tests in `query-params.test.ts`). Typecheck clean, lint clean apart from the existing virtualizer warning, 282 Library tests pass. The Sort button was already hidden while searching |
| 18 Oct backend (2026-10-19) | Composer uploads send `staged: true` (`upload/controller.ts`, `schemas.ts`); X on a finished, unsent file discards it on the server (`controller.ts` `cancel`, `composer-uploads.ts`; test updated); the chat history keeps deleted and locked attachments (empty link) and reads `libraryState` for the chip (`message-transformer.ts`, `api/chat.ts`, `types/chat.ts`, `SentLibraryAttachment.tsx`, `ChatMessage.tsx`); `useHasShared` asks `tab=shared` (BE-12 R1 and R2 shipped together); `buildApiError` reads the backend's `fieldErrors` list (`api/client.ts`). Typecheck, lint and 372 Library, chat and API tests pass |

---

## Part 4. Decisions needed before building

| # | Decision | Affects | Options |
|---|---|---|---|
| 1 | Are routines private, or visible to the whole org? | BE-07 R8 (check B5) | Private with an opt-in `shared` flag, or keep org-wide and change the prototype check |
| 2 | What happens when indexing fails after a file is already ready (for example an OCR timeout)? | BE-02 R8 | Retry then remove, or hide it |
| 3 | Should a routine post "<Routine> is ready." to Slack on its own? | BE-07 R10 (check C7) | Built in, or left to each routine's script |
| 4 | The Shared tab and the Source: Shared filter. The prototype: tab = only files shared **with** you (`library.tsx:72`); Source: Shared = a file others can open, shared in **or** out (`lib/access.ts` `isShared`). The backend has them swapped, and `04` section 5 says the tab also lists files you shared out | BE-12 R1, R2 | **Taken (18 Oct backend): prototype meanings for both.** Update `04` section 5 to match |
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

- **Flows C and D were re-run on 2026-10-19** (Part 1, "Flow C retest" and "Flow D retest"). C: unchanged backend; C3 to C6, C9, C-d1 pass (C-d1 after a front-end fix), C1 and C2 partial, C8 fails, C7 and C-d2 blocked (BE-07 R1, R4 to R7, R10). D: Slack is still not connected, so every Slack check is blocked; the new DM save (`libraryNames`) saves attachments nobody asked to save, which conflicts with D-d1 and needs a decision (BE-10 R3). D4 still needs BE-09. Test data left in You's account: output `2d60bd56…` and five new runs on "Draft product copy", "Daily sales message" and "Always fails"; nothing in Maya's.
- **Flows E and F were re-run on 2026-10-19** (Part 1). E: only the chat side (BE-08) and Slack remain. F: only Undo (BE-05 R5), answers while a file is in Trash (BE-04, and the agent naming a trashed file) and routines (BE-07) remain. Test data left: files `e3uj8y-*`, `v3ztiq Brand guidelines`, `v45f5r Brand guidelines` (You), `e3uj8y Payment terms` (Maya, shared with the workspace), and a few "Quick Test" chats.
- **Flow B was re-run on 2026-10-19** (Part 1, "Flow B retest"): unchanged backend, B4 passes, the rest fail or are blocked, and a new gap (BE-07 R11: model routines save no output). Test data left in You's account: routine `b3acbf Draft product copy` (`8d09a205…`), its chat, two `b3acbf` files, and one more `files/Draft_product_copy_2026-10-19.docx`.
- **Flow A was re-run on 2026-10-19 against the 18 Oct backend** (Part 1, "Flow A retest"). Left for the backend from Flow A: BE-01 (A1, A4), BE-02 R6 to R10 (A7, X3), BE-03 R4 to R6, BE-04 R1 to R4 (A10, A13, Depth 2), BE-06 (A11). Flows E, F and H have since been re-run for BE-05 R1 to R3 and BE-12 R1 to R3 (Part 1).
- Running locally: the Library mock is gone (its data was removed in `579f2b94`; the unused `NEXT_PUBLIC_LIBRARY_MOCK` flag and the mock-only inline PDF path were removed on 2026-10-19). Give a fresh `next dev` time to compile before a live test: the first upload in a just-started server can sit at "Uploading… 0%".
- **Flow G was re-run on 2026-10-19** (Part 1, "Flow G retest"). The prefs and org-settings endpoints are still `404`, so the screens were run against a stand-in again and prove the screens, not the backend; re-run G1 to G4, G8 and G9 once BE-01 exists. Live, without a stand-in, the backend enforces none of the switches (BE-01 R5, BE-03 R2 rule 1, BE-04 R2 to R4). G6, G7, G-d1 and G-d2 stay blocked on BE-11 (Remove opened and cancelled, no Leave exists). Test data left in Maya's account: `g19x-mvf79dvr-0.txt` (`449f37f2…`) and `g19x-mvf79dvr-2.txt` (`649ccd19…`) in All files, the unlisted `g19x-mvf79dvr-1.txt`, and four chats (`29bc8c6f…`, `afd6079f…`, `1d252f22…`, `421ec7d6…`); nothing in You's.
- **"All flows" (X1 to X13) was re-run on 2026-10-19** (Part 1, "All flows retest"): 11 pass; X3 (Uploading on a File page, BE-02 R1, R9) and X8 (unread shared card reads "Modified", BE-12 R6) partial. No test data made.
- **Flow H was re-run on 2026-10-19** (Part 1, "Flow H retest"). BE-12 R1 and R2 work (H2, H12, H19, H20 now pass) and R3 ANDs the words; left for the backend: phrase-first ranking and a server minimum length (R3), recordings in search (R4, BE-06), routine origin on Generated (R5, BE-07 R4), Recent and Frequently used lines (R6), unread again (R7), Trash for the deleter and its `limit` (R8, R9), a keyset cursor (R9, C-04), `GET /library/summary` (R10), thumbnails (R11), per-section Suggested errors (R12). H25 is a front-end gap (narrow window). No test data was made for H.
- `04-backend-requirements.md` already describes most of the target design (tables, endpoints, rules). This ticket adds what live testing showed is **not built**, the exact shapes the front end reads, and the API conventions from the principles. Where the two disagree (the Shared tab, `ask_save`), this ticket says which one the front end follows.
- The Flow A, B to F and X sections of the source tickets hold every seen-live detail, ids and request and response samples. This ticket keeps what the backend needs to build and what the front end must do.
