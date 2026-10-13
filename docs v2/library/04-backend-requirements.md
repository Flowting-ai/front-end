# 04 Backend requirements

For: backend (`back-end`, FastAPI + SQLAlchemy + Alembic + Postgres/pgvector + S3). We do not edit the backend from this repo; this is the request and the contract. References are to existing code so you can see where each piece plugs in. Names are proposals; the front end adapts to agreed names, but the **behaviour** is required.

## 1. What exists today and what it means for Library

| Existing | Where | Gap for Library |
|---|---|---|
| `MessageFileAttachment` (per message, `s3_key`, `origin` uploaded/generated/chart, `document_id`) | `services/chat/models.py` | Per-message, not a durable owner-scoped file. No title, owner, sharing, trash, size history. Replaced turns lose files (see `chat-output-backend-requirements.md` A2). |
| `Document` + `DocumentPage` (chunks + pgvector embeddings, `user_id`) | `services/document/models.py`, `indexing.py`, `retrieval.py` | Reusable as the extracted-text and RAG store. Owned by one user, no sharing-aware retrieval. |
| `ProjectDocument` (soft delete) | `services/projects/models.py` | Project-scoped files. Stays; may later link to a Library file. |
| Automation files under `automations/{userId}/{automationId}/files/` | `services/automations/folder.py` | Run outputs are not first-class files. |
| `SlackFile` | migration `a1c7e4b93d52` | Slack attachments tracked per channel scope; not user-owned Library files. |
| `OrganizationMember` (role admin/member/service), `OrganizationAuditLog`, `ChatShare`, `persona_shares` + recipients | `services/organizations`, `services/persona_share` | Patterns to copy for grants, audit and removal. |
| `SoftDelete` mixin (`deleted_at`), S3 helpers (`upload_bytes_to_s3`, `get_presigned_url`, `delete_s3_object`, `copy_s3_object`) | `db/base.py`, `services/document/storage.py` | Reuse as is. |
| Chat send takes multipart `files` on `POST /chats/create` and `/chats/{id}/stream` | `services/chat/router.py` | No pre-send upload, no Processing state, no send-by-reference. |

## 2. Principles

1. **One identity per file** (`LibraryFile`). Everything else links to it.
2. **Authorisation is server side and uniform.** One `library.access.resolve(file, user)` used by every surface (web, chat retrieval, citations, Slack, routines). The front end never decides access.
3. **Private by default.** A file is visible to its owner only until a grant exists.
4. **Nothing half-saved.** A file that fails validation, scanning or extraction leaves no row (a staged row is deleted and its S3 object removed).
5. **Retrieval honours access at query time**, not at index time (sections 6.2b and 7b).

## 3. Schema

All tables follow house style: UUID primary keys, `created_at`/`updated_at`, `SoftDelete` only where noted. Postgres enums created once with `create_constraint=False` like `AttachmentOriginType`.

### 3.1 Enums
`LibraryFormat` (pdf, document, sheet, image, audio) . `LibrarySource` (uploaded, generated) . `LibraryPhase` (uploading, processing, ready) . `LibraryLife` (staged, chat_only, active, trashed) . `LibraryVia` (web, slack, routine) . `LibraryAutoSave` (always, ask, never) . `LibraryRole` (viewer) . `LibraryActivityKind` (created, opened, modified, shared).

### 3.2 `LibraryFile`
| Column | Type | Notes |
|---|---|---|
| id | UUID pk | |
| organization_id | UUID fk Organization, null | null = personal/no-org user. Indexed. |
| owner_id | str fk User.auth0_id | indexed. Ownership transfer = update this. |
| title | str(255) | user-visible name incl. extension? Store `title` (no ext) and `extension` separately. |
| extension | str(16) | |
| mime_type | str(127) | sniffed server side, not trusted from client |
| format | LibraryFormat | derived from sniffed type. Values: pdf, document, sheet, slides, text, web, email, image, audio (UI groups them into five filter groups). Anything else is rejected at upload (`unsupported`), never stored (CAP-18). |
| searchable | bool default true | false when no text could be read (scan with no readable text). Stored and previewable, never in retrieval (CAP-17). Ships only if OQ-9 says so. |
| partially_read | bool default false | some pages unreadable; readable parts are searchable (CAP-17) |
| title_is_ai_generated | bool | true for titles Souvenir chose for its own outputs; cleared on rename. Uploads keep their file name as title (ORG-6). |
| indexed_at | timestamp null | set when the file joins the search index, which happens **on send**, not during Processing (section 4) |
| index_scope | enum (chat, library) | `chat` for chat-only files (searchable only inside that chat), `library` once active |
| save_state | enum (none, pending, retrying, saved, failed) | promotion state for the "Couldn't save to Library" flow (section 4) |
| save_attempts | smallint | max 3 automatic retries |
| size_bytes | bigint | |
| content_sha256 | char(64) | stored for Phase 2 dedupe; no unique constraint |
| s3_key | str | unique. Pattern `library/{org_or_user}/{file_id}/{nonce}` (never derive from the title) |
| thumbnail_s3_key | str null | images, first page of pdf/doc |
| source | LibrarySource | |
| via | LibraryVia | web / slack / routine |
| origin_chat_id | UUID fk Chatboard null | on delete set null; keep the provenance text in `origin_label` |
| origin_message_id | UUID fk ChatboardMessage null | |
| origin_automation_id | UUID fk Automation null | |
| origin_run_id | UUID fk AutomationRun null | |
| origin_is_test_run | bool | |
| origin_slack_file_id | fk SlackFile null | |
| origin_label | str(255) | snapshot ("Weekly sales report") so provenance survives deletion of the source |
| phase | LibraryPhase | |
| life | LibraryLife | |
| failure_reason | str null | only while a staged upload is being rejected; the row is then deleted |
| document_id | UUID fk Document null | extracted text + embeddings |
| transcript_status | str null | for audio |
| trashed_at | timestamp null | with `deleted_at` semantics; add `trashed_by` |
| trashed_by | str fk User null | |
| purge_after | timestamp null | `trashed_at + 30d` |
| last_activity_at | timestamp | drives Suggested |
| last_activity_kind | LibraryActivityKind | |
| use_count | int default 0 | drives Frequently used |
| staged_expires_at | timestamp null | staged files not sent within 24 h are purged |

Indexes: `(owner_id, life, created_at desc)`, `(organization_id, life)`, `(owner_id, life, last_activity_at desc)`, `(purge_after) where life='trashed'`, `(staged_expires_at) where life='staged'`, trigram or `tsvector` on `title` for name search, `(origin_chat_id)`, `(origin_automation_id)`.

### 3.3 `LibraryFileGrant`
`id`, `file_id` fk cascade, `grantee_type` (`user` | `organization`), `grantee_user_id` null, `organization_id` null, `role` (viewer), `granted_by`, `via` (web, slack, chat), `created_at`. Check constraint: exactly one grantee column set. Unique `(file_id, grantee_user_id)` and `(file_id, organization_id)`. Index `(grantee_user_id, created_at desc)` for the Shared tab, `(organization_id)`.

### 3.4 `LibraryFileUserState`
`file_id`, `user_id` composite pk; `last_opened_at`, `unread bool default true when a grant is created` (set by grant insert, cleared by open), `open_count`. Powers unread dot, "Opened" cards and per-person Frequently used.

### 3.5 `LibraryFileUse`
`id`, `file_id` fk cascade, `kind` (`chat_scope`, `chat_citation`, `routine_attachment`), `chat_id` null, `message_id` null, `automation_id` null, `created_at`. Unique per `(file_id, kind, chat_id|automation_id)`. Powers "Used in", the delete warning and `use_count`.

### 3.6 `LibraryAccessRequest`
`id`, `file_id`, `requester_id`, `status` (pending, approved, denied), `created_at`, `decided_at`, `decided_by`. Unique pending per `(file_id, requester_id)`. Phase 1: create + notify owner; decisions are Phase 2 (but model them now).

### 3.7 `LibraryUserPrefs`
`user_id` pk, `auto_save` (LibraryAutoSave, null = never chose), `ai_reference_enabled bool default true`, `updated_at`. "Chose" = `auto_save is not null`.

### 3.8 `LibraryOrgSettings`
`organization_id` pk, `default_auto_save` default always, `force_auto_save_off bool`, `ai_reference_enabled bool default true`, `max_file_size_bytes` default 30 MB, `allowed_formats` JSONB (or mime allow-list), `updated_at`, `updated_by`. Every change also writes an `OrganizationAuditLog` row (`library.settings.updated`, key and old/new in JSONB).

### 3.9 Transcripts and extracted structure
- Text documents and PDFs: reuse `Document` / `DocumentPage` (`page_number`, `chunk_index`, `content`, `embedding`). Link by `LibraryFile.document_id`. Citation locator `{type: "page", value: n}`.
- Spreadsheets: extract per sheet and row range into `DocumentPage`-style chunks with `page_number` = sheet index and a `row_start/row_end` (add nullable columns or a JSONB `locator` on `DocumentPage`). Locator `{type: "row", value: "Sheet1!14"}`.
- Audio: new `LibraryFileTranscript(file_id pk, language, duration_ms, segments JSONB [{startMs,endMs,speaker?,text}], summary null)`. Segment text is also chunked into `DocumentPage` with a `locator` of start time so retrieval can cite `{type: "time", value: ms}`.

### 3.10 Changes to existing tables
- `MessageFileAttachment.library_file_id` UUID fk null (nullable; legacy rows stay null).
- `Chatboard`: nothing required; a chat's Library scope is derived from `LibraryFileUse(kind=chat_scope)` plus an excluded set `ChatLibrarySourceOff(chat_id, file_id)` (for the Sources panel switches).
- `AutomationAttachment(automation_id, file_id)` or reuse `LibraryFileUse(kind=routine_attachment)`; pick one, prefer a real join table with `ON DELETE` rules so Trash does not delete the attachment.
- `OrganizationMember` removal flow gains the transfer decision (section 6.7).

### 3.10b Tables added from the PRD edge cases

- **`LibraryRunInput`** (RTN-3): `run_id` fk AutomationRun, `file_id` fk LibraryFile (set null on purge, keep `file_title_snapshot`), `status` (`used`, `skipped_trashed`, `missing_deleted`, `lost_access`), `created_at`. One row per attached file per run. Powers "each run records the files it used", the run-history lines ("which file was missing", "the routine lost that file") and the routine pane notes.
- **`LibraryDeletionLedger`** (LIF-6): `id`, `file_id` (not an fk; survives the file), `deleted_by`, `deleted_at`, `kind` (`forever`, `window_ended`, `removal`, `staged_discard`), `derived_cleared_at`, `storage_cleared_at`, `backups_cleared_at`. Contains **no content and no title**. Drives purge monitoring and the "within 60 s / 24 h / 30 d" SLO checks.
- **`LibraryImport`** (Launch readiness): `id`, `user_id`, `organization_id`, `status`, `source` (`chat_attachments`, `routine_outputs`), `selected_count`, `imported_count`, `created_at`. Opt-in only; section 9.
- **`LibraryRemoval`** (ORG-11): `user_id`, `requested_by`, `status` (`awaiting_answer`, `completed`, `cancelled`), `transfer` null until answered.
- **Settings versioning** (GOV): `LibraryOrgSettings.version int` incremented on every write and `updated_by`, `updated_at`; `PATCH` takes `If-Match: <version>`. The later write wins (PRD), but the response to the earlier Admin carries `changedBy` and `changedAt` so the UI can say "Changed by Priya just now". Members' notice is driven by `settingsChangedAt`.
- **Provenance guard**: `origin_*`, `source`, `via`, `created_at` are write-once. Enforce in the repository layer (no update method exposes them) and with a trigger that raises on UPDATE of these columns.

### 3.11 Migration
One Alembic revision (`down_revision` = current head, check `alembic heads` first: there are ~350 revisions and duplicate-numbered ones in the tree). Creates enums, tables, indexes, nullable FKs. Fully reversible. No data backfill in the first revision (section 9).

## 4. Upload and staging flow (new)

```
client                              backend
  | POST /library/uploads (multipart: file, chatId?, via)   --> validate size/type, stream to S3 (staged),
  |                                                              create LibraryFile(phase=uploading->processing, life=staged)
  | <-- 202 {id, phase:"processing"}                             enqueue processing job (core/bg.py)
  | GET /library/uploads/{id}   (poll 2s, or SSE)  --> {phase, failureReason?}
  |                                                    job: sniff mime, size, password check, malware scan,
  |                                                         extract text/OCR, thumbnail, transcribe (audio),
  |                                                         index embeddings  -> phase=ready
  |                                                    on any failure: delete S3 object + row, report reason
  | POST /chats/{id}/stream {libraryFileIds:[...]}         --> on send: for each staged file apply effective auto-save:
  |                                                            always -> life=active  (+ LibraryFileUse chat_scope)
  |                                                            ask    -> life=chat_only, emit ask_save event
  |                                                            never  -> life=chat_only
```

Processing and indexing (CAP-15, PRD Understanding "Processing"):
- **Processing = malware scan, type detection, size checks, text reading (OCR for scans and images), chunking, preview/thumbnail build.** It starts as soon as the file is chosen and ends in `ready` (or the file is removed on failure).
- **Joining the search index happens on send, not during Processing.** Until the message is sent the file is private to the uploader: not in Library, not in search, not in retrieval, not visible to anyone else. The embedding/indexing job is enqueued by the send (promotion) path, with `index_scope = chat` for chat-only files and `library` once `active`. Do not write `DocumentPage` embeddings for a staged file.
- If the uploader removes a staged file, delete it at once with everything derived from it (S3 object, thumbnail, extracted text, chunks). If they abandon the draft, the 24 h purge deletes it the same way.
- The scanner, extractor and transcription tool are called through one `processing` service so failures map to the fixed `reason` list; technical detail is stored for support and returned only as an opaque `detailsId`.
- Processing is bounded: after 10 minutes the file is flagged `slow` (surfaced by the status endpoint), retried once automatically, and failed as `unreadable` if still stuck.
- Uploads are **resumable**: `POST /library/uploads` returns an upload id and an S3 multipart session; the client sends parts and completes with `POST /library/uploads/{id}/complete`. A partial upload is never `ready`. Abandoned multipart sessions are aborted by the staged-expiry job.

Promotion on send (CAP-1, CAP-10, CAP-14):
- Promotion is idempotent and runs after the chat message is persisted. If it fails the message still sends. The row stays `chat_only`, `save_state = retrying`, a background job retries up to 3 times (`save_attempts`), then `save_state = failed` ("Not in Library"). `POST /library/files/{id}/save` retries on demand.
- `POST /library/files/{id}/unsave` (within 10 s of promotion, proposed) demotes `active` to `chat_only`, removes it from the Library index scope and keeps the message attachment. After the window it returns 409 and the file is deleted through Trash like any other.
- The effective auto-save mode is decided server side at promotion time from: Admin force-off, then the person's choice, then the workspace default. A setting changed between upload and send applies the setting at send.

Requirements:
- `POST /library/uploads` is rate limited, size capped by `LibraryOrgSettings.max_file_size_bytes`, and **rejects before storing** when type or size is wrong (413, 415) with a stable `reason` code the front end maps to copy: `too_large`, `unsupported`, `password_protected`, `unsafe`, `unreadable`.
- Processing is asynchronous. It must be **idempotent** and bounded (timeout; a file stuck > 10 min is failed as `unreadable` and removed; the "taking longer than usual" notice is out of Phase 1).
- `GET /library/uploads/{id}` returns only the uploader's own staged file.
- `DELETE /library/uploads/{id}` cancels and removes (S3 + row).
- Staged files not attached to a sent message within `staged_expires_at` (24 h) are purged by a job.
- Chat endpoints accept `libraryFileIds` (staged or active files the user can open) **in addition to** legacy multipart `files`, with the same semantics for the model (files are loaded into the workspace by id). This supersedes the multipart path for Library users and also resolves A2 (replace/regenerate keeps files, because files are no longer message-owned).
- Duplicates: allowed, separate rows.
- The final response of the send includes `savedFileIds` and, for `ask`, an `ask_save` AG-UI event (add to `docs/api/SSE_EVENTS v2.md`) with the message id and file ids. `POST /library/uploads/resolve {messageId, save: bool}` finishes it.

## 5. Endpoints

Base `/library`. JSON camelCase. Auth: existing Auth0 bearer. Cursor pagination via `services/pagination`. All list endpoints return only files the caller may open.

| Method and path | Purpose | Notes |
|---|---|---|
| `GET /library/files` | list | query: `tab=all\|shared`, `q`, `scope`, `source[]`, `type[]`, `sort=name\|created\|shared`, `dir`, `cursor`, `limit`(<=100). Response rows per front-end `LibraryFileRow`. `tab=all` = owned + granted + workspace-granted, `life=active`, `phase=ready`. `tab=shared` = granted to me (direct or workspace) plus, for the owner, files I shared. |
| `GET /library/files/suggested` | recent, frequent, generated | server applies the selection and returns ids + rows; front end applies display rules |
| `GET /library/files/{id}` | detail | 200 file; 403 `file_locked` (no title leak); 404/410 gone or trashed for non-owner. Includes `access`, `adminCanManage`, provenance, info, preview descriptors. |
| `GET /library/files/{id}/preview` | preview payload | pages / sheet window / transcript lines / signed image URL. Paged. |
| `GET /library/files/{id}/download` | short-lived presigned URL, `Content-Disposition: attachment` | access checked each call |
| `POST /library/files/{id}/opened` | marks opened | idempotent; clears unread; updates `last_activity` |
| `PATCH /library/files/{id}` | rename | owner or Admin-over-workspace-share only; 403 otherwise (`only_owner`) |
| `DELETE /library/files/{id}` | move to Trash | returns `{daysLeft:30}` and the usage summary; keeps grants and attachments |
| `GET /library/files/{id}/usage` | chats and routines using it | only items the caller can see are named; others counted |
| `GET /library/files/{id}/access` | who has access | owner, grants, ways in |
| `POST /library/files/{id}/grants` | `{who: userId\|"workspace"}` | owner only (or Admin-over-share). 409 `already_has_access`. Returns updated access + ways in. |
| `DELETE /library/files/{id}/grants/{grantId}` | revoke | |
| `POST /library/files/{id}/access-requests` | request access | notify owner |
| `GET /library/files/names?ids=` | batch of `{id, title}` for citation chips | returns title **only** if caller may open; else `{id, state:"locked"\|"deleted"}` |
| `GET /library/trash` | trash list | `daysLeft`, `freesBytes` total |
| `POST /library/trash/{id}/restore` | restore with grants | |
| `DELETE /library/trash/{id}` | delete forever | S3 + Document + embeddings + grants + uses |
| `DELETE /library/trash` | Empty Trash | for the caller's deletable files |
| `GET /library/storage` | `{usedBytes, limitBytes\|null, breakdown:{files,images,audio}}` | decision needed whether trashed counts |
| `GET /library/limits` | `{maxFileBytes, allowedMime[], maxFilesPerMessage}` | org-aware |
| `POST /library/uploads`, `GET/DELETE /library/uploads/{id}`, `POST /library/uploads/resolve` | section 4 | |
| `GET/PATCH /library/prefs` | personal | |
| `GET/PATCH /library/org-settings` | Admin | audit event on change. Response has `version`, `updatedBy`, `updatedAt`; PATCH requires `If-Match: version`, later write wins and returns `changedBy` of any overwritten value (3.10b) |
| `GET /library/flags` | `{library, autoSave, aiUse, sharing}` | per-workspace kill switches (section 9) |
| `POST /library/uploads/{id}/complete` | finish a resumable upload | section 4 |
| `POST /library/files/{id}/save`, `POST /library/files/{id}/unsave` | retry promotion / undo within 10 s | section 4 |
| `POST /library/uploads/{id}/retry` | retry a slow or failed processing step once | only if OQ-9 ships "Retry OCR" |
| `GET /library/import/preview`, `POST /library/import`, `GET /library/import/{id}` | opt-in import of existing chat files and routine outputs | section 9 |
| `DELETE /automations/{id}?deleteOutputs=` | delete routine, optionally its outputs | returns `outputCount` on a dry run (`?dryRun=1`) |
| `GET /library/members` | Admin: members with file counts and any pending removal | removal itself is started by the existing workspace member removal (the org service), which creates the `LibraryRemoval` row; the Library front end has no "remove" button of its own |
| `GET /library/members/me/removal`, `POST /library/members/me/removal/answer {transfer: bool}` | the leaver's locked question and answer | section 6.7. Self-leave asks the same question inside the existing leave-workspace flow (not built in the Library front end yet) |
| `GET /library/search?q=&scope=` | optional separate search | may be folded into `GET /library/files?q=` |

Error body: `{code, message, details?}` (house style). Codes the front end relies on: `file_locked`, `file_gone`, `only_owner`, `already_has_access`, `too_large`, `unsupported`, `password_protected`, `unsafe`, `unreadable`, `rate_limited`, `ai_reference_off`.

Idempotency: grant, revoke, trash, restore are naturally idempotent; uploads accept an `Idempotency-Key` header to survive client retries.

### 5b. Contract requirements that come from the front-end design principles (see `06-principles-application.md`)

| Need | Why (principle) | Requirement |
|---|---|---|
| **Batch upload status** `GET /library/uploads?ids=a,b,c` | #36, client rate limiter is 100 req/min; per-file polling at 2 s with ten attachments is about 300 req/min | one call returns `{id, phase, slow, failureReason?, detailsId?}[]` for the caller's staged uploads |
| **Thumbnail rendition** field `thumbnailUrl` (and `thumbnailWidth/Height`) on list rows | #48, #49: lists must never load originals | small private-cacheable image (<= 20 KB), `Cache-Control: private, max-age`, `ETag`; absent for formats without one (client shows the type icon) |
| **Windowed preview** `GET /library/files/{id}/preview?sheet=&rowStart=&rowCount=` and page-based text preview | #47, #46: no spreadsheet parser in the client bundle | JSON windows of up to 200 rows; extracted text pages; passage/row/time locators |
| **Short-lived presigned URLs** for download, audio and PDF bytes, and bucket CORS for the web origin (`PUT`, `GET`, `HEAD`, exposed `ETag`) | #21, #41, #42, CSP | TTL <= 15 min; the client never sends our bearer to the storage origin |
| **Cursor contract** `{items, nextCursor|null}` with an opaque cursor bound to filter and sort (reuse with a different sort = 400) | #39 | deterministic order: sort key + unique id tiebreaker; no totals; separate summary endpoint for counts and storage |
| **Error model** | #45 | one body shape `{code, message, details?, requestId, fieldErrors?}`; standard status codes (never 200-with-error); `Retry-After` on 429; FastAPI 422 `detail[]` mapped to `fieldErrors` |
| **Idempotency** | #45 | `Idempotency-Key` honoured on upload init/complete and grants; PUT/DELETE grants use explicit target state |
| **OpenAPI coverage** | #37 | every Library endpoint and schema documented in `back-end/openapi.yaml` so the front end contract test can run in CI |
| **Resumable multipart** | #36, CAP-15/17 | per-part presign, re-presign on expiry (`upload_url_expired`), complete with part ETags, abort; parts idempotent |
| **Tiny files-in-use events on the chat stream** | #44 | `sourceEvents`, `files_truncated`, `groundedness`, `ask_save` added to `SSE_EVENTS v2.md` with zod-able shapes |

## 6. Logic and wiring

### 6.1 Access resolution (single function)
`resolve(file, user)` returns `owner | viewer | None`:
1. user removed from org -> None.
2. `file.owner_id == user` -> owner (even if trashed, for Trash).
3. `file.life != active or phase != ready` -> None.
4. grant to user, or grant to `file.organization_id` where user is an active member -> viewer.
Admin-over-share: if user is an org Admin and a workspace grant exists, `adminCanManage = true` (rename, share, delete) but **content open of private files is never granted**.
Used by: list queries (as SQL predicates, not post-filtering), detail, preview, download, names, chat file loading, retrieval, Slack, routines, search.

### 6.1b Propagation timing contract (SHR-7, LIF-6, GOV-2)

| Event | Browsing and downloads | Retrieval / AI | Notes |
|---|---|---|---|
| Revoke a grant | immediate (next request) | within 60 s | do not cache access decisions in retrieval for more than 60 s; prefer a fresh `resolve()` before content reaches the model |
| Trash a file | immediate | immediate (leaves search, picker, shares) | search index entry removed within 60 s |
| Delete forever / window ends | immediate | search and shares gone within 60 s | derived data (text, chunks, embeddings, previews, caches) within 24 h; storage including backups within 30 days (proposed, Legal to confirm) |
| Admin turns AI reference off | n/a | within 60 s for everyone | browsing, search and manual attach keep working |
| Admin changes any Library setting | n/a | new activity straight away | existing files unaffected; people's own choices kept unless force-off |
| Member removed | access and routine grants end immediately (GOV-7) | immediate | transfer or delete per the answer |
| Slack channel membership changes between question and answer | checked at request time, not at message time | | |

Delete forever writes an audit entry (who, what, when, no content) and **anonymises usage records**. Derived-data clean-up carries lineage (every derived artifact stores its source file id) and retries until it succeeds; a failure is alerted to the team and shows nothing to the person (LIF-6). Purge monitoring samples production for 100 % propagation within the windows.

### 6.2 Sharing semantics
- Grant insert sets `LibraryFileUserState.unread = true` for the grantee and writes `last_activity` `shared`. Notify the grantee via the existing notifications service.
- "Ways in" = grants matching the caller. Revoking the direct grant leaves access if a workspace grant exists.
- Grants never extend to Trash. Restore re-enables them.

### 6.2b Retrieval rules from the PRD (FIND-13 to FIND-24, section 11)

- **Hybrid search** (exact words plus meaning) across title and content (FIND-1); results are access-filtered in SQL and **result totals count only accessible files** (never a total that includes hidden ones).
- **Automatic search runs only when both the Admin AI-reference switch and the person's Search my Library control are on**; attaching a file by hand always works. Outcome is re-evaluated per message, so an Admin change reaches the next message and the whole workspace within 60 s.
- **No self-contamination:** `source = generated` files (chat outputs and run outputs) are excluded from automatic retrieval until a person attaches them (from Phase 2, approves them). Same for files produced by routines.
- **Verified citations:** before the answer is emitted, every cited passage must exist in the named file (page, row or time). Unverifiable citations are dropped and the claim ships without them. Citation accuracy gate >= 98 %.
- **Grounding:** if no file covers the question the model says it could not find the answer; any general answer is marked as not from the files (`groundedness` field in the answer event: `grounded`, `partial`, `none`).
- **Limits:** a maximum of files in use per chat; beyond it best matches are used and the answer says so (`files_truncated`); search time-out and page size are configured, not hard-coded (OQ-17). For a very large Library the answer states how many files were searched (`searchedCount`) and suggests narrowing.
- **Fail closed:** if the policy service cannot decide, show less. Titles, snippets and suggestions never expose anything the viewer cannot open.
- **Content is data, not commands** (prompt injection): text in files, including hidden text, never changes instructions. Any side-effecting action that would follow from reading a file (price change, email, ad spend, editing a live document in a connected tool, writing to another file) requires explicit confirmation and the approval request carries the prompting file id. The AI never edits an uploaded Library file in place; changes are saved as a new file.
- **Freshness and contribution transparency** (notes about an old source, a newer Approved file, "added by Maya") need Approved status (Phase 2) or extra metadata; ship the `addedBy` and `addedAt` fields on citations now and the freshness notes later (OQ-14).
- **Index separation:** each workspace's search index is kept separate; content is encrypted in transit and at rest; Library content is not used to train models (Legal wording, OQ-12).

### 6.3 Trash and purge
- Delete sets `life=trashed`, `trashed_at`, `trashed_by`, `purge_after=now+30d`. Routine attachments and grants are kept.
- Citation and Used-in resolvers treat trashed as "File deleted".
- Job (`services/maintenance.py` pattern, daily): hard-delete rows past `purge_after`: S3 object and thumbnail, `Document` + pages + embeddings, transcript, grants, uses, user state.
- Delete chat with "Also delete these files": `DELETE /chats/{id}?deleteFiles=true` trashes files whose `origin_chat_id` is that chat and which the caller owns.

Staged-file and workspace deletions use the same pipeline and write `LibraryDeletionLedger` rows (3.10b). Closing a workspace enqueues a purge of every file, grant and derived artifact on the published schedule. Moving files between workspaces is not supported.

### 6.4 Chat wiring
- On send with `libraryFileIds`: authorise each id with `resolve`, load into the model workspace (`services/document/workspace.py`), record `LibraryFileUse(chat_scope)`.
- Citations: the stream emits `{fileId, locator:{type,value}}`; `ChatContext.uploaded_files` keeps working for legacy; persist structured sources (this is B1 in `chat-output-backend-requirements.md`).
- Chat outputs (`generated`/`chart` origins) are saved as `LibraryFile(source=generated, life=active|chat_only per auto-save, origin chat+message)`. Decide whether `chart` outputs are Library files (recommendation: yes, format image).
- Persona/agent chats and shared chats (`ChatShare`): a participant reading a shared chat does not gain file access; citations to files they cannot open render locked.

### 6.5 Retrieval and "AI reference"
- Library search tool for the model queries `DocumentPage` embeddings **joined to LibraryFile with the access predicate for the asking user**, `life=active`, `phase=ready`, not in the chat's `sourcesOff`.
- Disabled (tool not exposed) when `LibraryOrgSettings.ai_reference_enabled = false` or the user's `ai_reference_enabled = false`; the model is told why so the answer can say it.
- In a **Slack channel**, retrieval uses only files every channel member can open (workspace-granted); in a **DM**, the asker's access.

### 6.6 Routines (automations)
- Attach: validate `resolve(file, routine_owner)` and `ready/active` on save and again at each run.
- Run: when a run produces an output file, create `LibraryFile(source=generated, via=routine, owner=routine owner, origin_*=automation/run, origin_is_test_run)` in the run finalisation in `services/automations/runner.py`; S3 copy from the run folder (`copy_s3_object`). Message-only and failed runs create nothing. The run record stores `output_file_ids`.
- At run time, skip attachments that are trashed or no longer accessible and record a `skipped` note on the run for the routine pane.
- Routine owner removed: pause and reassign to the Admin with its outputs (ownership transfer of `LibraryFile.owner_id`).

### 6.6b Routine edge cases (RTN-1 to RTN-15)

- **Each run records the files it used** (`LibraryRunInput`, 3.10b): `used`, `skipped_trashed`, `missing_deleted`, `lost_access`. The run goes ahead without a missing file and run history says which one. A pre-run warning is Phase 2.
- A routine reads only files attached to it and writes only its own run outputs, and can read only what its **owner** can read. If the owner loses access to an attached file the routine loses it too and run history says so.
- A routine keeps using the file attached to it even when a newer copy is uploaded. The owner attaches the new copy in place of the old; automatic updates are Phase 3.
- **Output too large:** "Not saved: the file is over the size limit." The routine's message is still delivered.
- **Partial failure:** a run that fails after writing part of its output creates **no** file (write to a temp key and copy only on success); the failure shows in run history.
- **Unfinished run timeout:** a run that never finishes is marked failed after a configured wait (OQ-17).
- **Visibility:** outputs of a private routine are private to its owner; outputs of a routine shared with the workspace are shared with the workspace (grant row created at write time). Outputs are not searched automatically.
- **Routine deleted:** its run outputs stay unless the caller sets `deleteOutputs=true` (the API returns the count first so the UI can say "Also delete its N run outputs"). Pinned outputs are never deleted by expiry.
- **Owner removed:** the routine is paused. Prototype decision: handed to the Admin together with its run outputs; PRD: paused until a new owner is named and outputs follow the leaving-member rule (OQ-19).
- Retention (keep last 30, Keep pin) is deliberately out of Phase 1 by the owner (decision 4); keep `AutomationRun.output_file_id` stable so it can be added without a migration of old runs.
- Slack parity: the routine owner can ask the bot to attach or remove files on a routine (SLK-5); same validation and audit as the web pane.

### 6.7 Member removal and leaving
- Removing a member through the existing workspace Members page (org service) creates `LibraryRemoval(user_id, requested_by, status=awaiting_answer)`; the leaver gets a blocking prompt on next load (and a notification).
- `answer {transfer:bool}`: if true, run the transfer rules in `01-product-rules.md` section 9 in one transaction (re-point `owner_id`, keep grants); if false, hard-delete the rest. Always hard-delete never-shared files, remove their chats, clear their grants on others' files, then remove `OrganizationMember` and release the seat through the existing org service. Everything is one transaction plus post-commit S3 deletes via an outbox so a crash cannot orphan data silently.
- Self-leave uses the same path; reject if the caller is the only Admin (`only_admin`).
- Emit audit events for removal, transfer and deletion counts.
- **Until answered**: access, routine grants and sessions end immediately (GOV-7); the data is untouched; the `LibraryRemoval` row stays `awaiting_answer`; a reminder notification repeats; an Admin can cancel the removal (status `cancelled`, access restored). If the leaver never answers, nothing is deleted or transferred (open: OQ-20 on an expiry).
- Removing or demoting the last Admin returns `only_admin`. Concurrent removals of two Admins are serialised with a lock on the organization row so the check cannot race.
- A member who is removed while holding staged uploads: staged files are discarded with the draft.
- The leaver's routines are paused and handled per 6.6b; their chats are removed with them; their grants on others' files are cleared.

### 6.8 Slack
Map to existing `services/slack`:
- **Save**: attachment + "save this to Library" creates `LibraryFile(via=slack, origin_slack_file_id)` through the same upload pipeline (download from Slack, stage, process, activate). Without the phrase nothing is stored; the bot explains how.
- **Share**: `@Souvenir share <file> with <person>`: shared resolver (same code as web) with the rules in prototype `flows.md` section 4; reply with Undo (`undo` token valid until used); in a channel the file is named only if workspace-granted.
- **Find**: `find <words>` returns files the asker can open (and, in channels, only workspace-granted), each with a link.
- Cited answers under the asker's access (6.5).

### 6.8b Slack edge cases (SLK-1 to SLK-8, FIND-19/20)

- **External members (Slack Connect):** in a channel with external members the bot neither saves files nor uses Library files, and says why (fail closed). Detect from the channel's `is_ext_shared` flag on every request.
- **Membership is checked at request time**, not when the question was typed; if membership changed in between, the answer uses the membership at the moment of answering.
- **Channel answers** use only files every member can open and say when files were left out, without naming them. **DMs** use the asker's own access.
- A file attached to the bot that is still processing: the bot says it is still reading and answers once the file is Ready.
- A Slack file that cannot be fetched: the bot says it could not read the file; everything else in the message still works; nothing is saved.
- Library unreachable: "I couldn't reach Library just now." The bot says so and does not guess.
- Duplicates or several matches: the bot asks which one to use.
- Parity (SLK-1): add (save on message or file), find, use (name a file), routine attach/remove (owner only), share (Viewer, with Undo), and delete or restore by asking (the same usage summary and recovery window are shown before the bot acts). Web-only exceptions (proposed): previews, list views, Admin settings and **Delete forever**; the bot replies with a link.
- Slack-saved files record the channel and message in provenance and `via = slack`.

### 6.9 Notifications
Add types: `library.shared` (someone shared a file), `library.access_requested`, `library.removal_pending` (leaver), `library.run_output_ready` (optional). Use the existing notifications pipeline the front end already consumes (`src/lib/notifications`).

### 6.10 Storage accounting
`usedBytes = SUM(size_bytes)` over the caller's owned files with `life in (active, chat_only, trashed)` (proposal; confirm). Breakdown by `format` group. Cache per user for 60 s, invalidate on writes. `limitBytes` null in Phase 1.

## 7. Security and compliance

- Validate by sniffing content (magic bytes) not by extension or the client MIME; block executables and archives; scan every upload (ClamAV or managed scanner) before `ready`; reject password-protected PDFs/Office files at extraction.
- S3 keys never contain user-provided names; objects private; only presigned GET with short TTL (<= 15 min for preview/download, not the current 7-day default in `get_presigned_url`). Files served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; SVG/HTML previews rendered through sanitisation server side or served from a sandboxed domain.
- Authorisation on **every** read path including retrieval and thumbnails. Add a test that fails if a Library query is added without the access predicate.
- Titles are untrusted input: strip control characters, cap at 255, no path separators.
- Locked responses leak nothing (no title, owner, size, existence confirmation beyond 403 vs 404 policy; prefer 403 for "exists but locked" only when the caller was linked to it by a citation or share, else 404).
- Rate limits: uploads per user per minute, grants per file, access requests per file per user per day.
- Audit: share, revoke, rename, delete, restore, delete forever, empty trash, settings change, removal and transfer, Admin management of workspace files. Written to `OrganizationAuditLog` now; the Audit page UI is Phase 2.
- Data use line in Settings is placeholder wording pending Legal; backend retention for embeddings follows file purge.
- Privacy: file names and extracted text must not reach analytics (Mixpanel), logs (`core/obs.py`, Sentry) or the cost ledger; log ids only.
- DSAR/delete-account: account deletion path must include Library files.

### 7b. Security additions from the PRD

- **Duplicate privacy:** `content_sha256` is indexed per owner only. No cross-owner lookup, no "already exists" response, no shared storage object between owners (the same bytes from two members are two S3 objects) so nothing leaks through deletion, timing or size counters.
- **Prompt injection (launch gate):** retrieved text is wrapped as data with provenance markers; tool calls that cause side effects require an approval event naming the file(s) in context; hidden text (white-on-white, metadata, alt text) is treated the same as visible text; a poisoned reviews / supplier email / invoice / scraped page suite must show zero unconfirmed side effects.
- **Permission red-team:** automated and manual tests across roles, revocations, routines and Slack channels; any leak blocks release. Policy decisions are made by one service; fresh authorisation happens before content reaches the model.
- **Personal data in uploads:** private by default, full deletion support including derived data. Content scanning is deferred (first governance topic to revisit).
- **Evaluation gates:** retrieval recall@10 on a golden set per file type (including catalog spreadsheets), citation accuracy >= 98 %, honest abstention >= 90 %, deletion propagation 100 %.
- **Error detail:** user-facing reasons are the fixed list; technical detail goes behind an opaque `detailsId` for support.

## 8. Non-functional

| Item | Target |
|---|---|
| List `GET /library/files` p95 | < 300 ms at 10k files per user, keyset pagination, covered by the indexes above |
| Search p95 | < 600 ms (name trigram + vector for text) |
| Upload to `ready` | p50 < 15 s for a 5 MB PDF, audio bounded by transcription (report progress states) |
| Max upload | 30 MB default, configurable per org up to a platform cap |
| Availability | upload and processing failures never block chat; chat with only `library` features degraded still works |
| Observability | metrics: uploads by outcome and reason, processing latency, scan hits, trash purge counts, access-denied counts; Sentry tags without file data |
| Tests | access matrix (owner, viewer, workspace grant, Admin over share, removed, no access), trash/restore/purge, transfer/removal transaction, upload failure leaves no row, retrieval never returns an inaccessible chunk, Slack share resolver table from `flows.md` |

## 9. Existing data and rollout

- No big-bang backfill. Phase 1 ships forward only: new uploads and outputs create `LibraryFile`.
- **Existing content is imported only by the person, opt-in, one time** (PRD Launch readiness): files in past chats and routine outputs already delivered. `GET /library/import/preview` returns counts per source for the caller (only chats they own and routines they own); `POST /library/import` creates `LibraryFile` rows in batches (resumable, idempotent per source id) as private `active` files owned by the importer, origin = the original chat or run, `Created` = original time, no re-upload (copy the S3 object or reference by key). Nothing is imported automatically and never on someone else's behalf. Never expose a file the owner could not already open.
- **Kill switches** (server side, per workspace, instant): `library`, `auto_save`, `ai_use`, `sharing`. `auto_save` off: no promotion (files stay chat-only). `ai_use` off: retrieval tool not exposed. `sharing` off: new grants refused, existing grants keep working (OQ-18). `library` off: UI and retrieval for the phase stop, **no data is deleted** (rollback without data loss). Every flip writes an audit event.
- **Staged rollout:** per-phase and per-workspace flags (internal dogfood, then a growing share of workspaces); exit criteria are auto-save opt-out rate and ingestion speed on target plus Gate 1 (permission and Slack tests clean, injection and deletion tests passing).
- **Learn before widening:** count what people attach and what routines produce by format (`GET`-less, a metrics job), and log unsupported attempts (pasting a URL, saving a text answer, folders, replacing a file, daily-number history) as an enum counter to order Phase 2.
- `ProjectDocument` and project Knowledge stay as they are. A project file can later be "Saved to Library" as a copy.
- Feature flag on the server too (`LIBRARY_ENABLED` setting) so the front end and server can roll out per org.

## 10. Backend deliverables checklist (what the front end needs, in order)

1. Migration + models + `resolve()` + list/detail/rename/trash/restore/grants endpoints (unblocks Library page, File page, Share, Trash).
2. Upload staging + processing + `libraryFileIds` on chat endpoints + auto-save promotion + `savedFileIds` + `ask_save` event (unblocks composer).
3. Citations with locators + names batch + retrieval access predicate (unblocks citations and Sources).
4. Routine output files + attachments (unblocks Routines).
5. Prefs, org settings, storage, limits, members removal (unblocks Settings and Admin).
6. Slack save/find/share/manage, external-member fail-closed, routine attach by bot.
7. Audio storage and on-demand transcription.
8. Run inputs, deletion ledger and purge monitoring, settings versioning, kill switches, opt-in import (hardening).
Each step lists its OpenAPI additions in `back-end/openapi.yaml` so the front end can regenerate types; update `docs/api` usage docs alongside.

## 11. Open questions (log)

This doc depends on: OQ-1 (storage accounting), OQ-2 (nullable organization), OQ-3 and OQ-13 (transcription provider and timing), OQ-4 (malware scanner), OQ-6 (chart outputs), OQ-7 (import), OQ-8 (shared chats), OQ-9 (unreadable files), OQ-11 (access requests), OQ-12 (purge windows, data-use wording), OQ-14 (citation metadata), OQ-15 (zip and unsupported types), OQ-16 and OQ-17 (numbers and limits), OQ-18 (sharing kill switch), OQ-19 and OQ-20 (routine owner removed, leaver never answers), OQ-24 (name search), OQ-25 (Slack exceptions). Master log with assumptions: `05-delivery-plan-and-qa.md` section 8.
