# [Backend] Library Flow A ("Capture and reuse"): everything the backend needs

| Field | Value |
|---|---|
| Type | Combined requirements ticket (settings, citations, checkpoint findings) |
| Area | Backend `services/library`, `services/chat`, `services/document` (retrieval, uploads, preview) |
| Source | Prototype Flow A checks (`library-prototype/surfaces/library/lib/data.ts`), run live against the dev backend from `front-end`, 2026-10-18/19 |
| Replaces | `2026-10-18/LIBRARY_SETTINGS_TICKET.md`, `2026-10-18/LIBRARY_CITED_PASSAGES_TICKET.md`, and the A sections of `2026-10-18/LIBRARY_CHECKPOINT_BACKEND_TICKET.md` (that file keeps Flow B and C) |
| Front-end contact | _fill in_ |

How to read it: the table below says where each Flow A check stands and which part of this ticket covers its backend work. **Part 1** is the settings endpoints and how saving is enforced, **Part 2** is citations in answers, **Part 3** is the remaining findings, one section per check. Front-end work for every check is already built (behind a flag where the backend is missing) and noted in each section.

## Status of every Flow A check

| Check | What it asks | Status (2026-10-19) | Backend work |
|---|---|---|---|
| A1 | Files save to Library by default; change it in Settings › Library | Default works; settings pages restored behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` | Part 1 §2 (prefs + org-settings endpoints) |
| A2 | Chip shows Uploading → Processing; Send waits | **Pass** (front end) | none |
| A3 | Unsent files stay out of Library; X deletes them | Fail | Part 3 A3 (staged state, discard after processing) |
| A4 | Ask each time / Never on send | Front end built, flag off | Part 1 §2 and §3.1 (`saveToLibrary`) |
| A5 | Row and "Uploaded by You, <chat>" provenance | Pass in an open chat; fail in a new chat | Part 3 A5 (set origin chat on send) |
| A6 | Same file twice = two files | Fail | Part 3 A6 (no de-duplication into one file) |
| A7 | Failed / locked / unsupported / unsafe never becomes a file | Unsupported + unsafe pass; corrupt + locked fail | Part 3 A7 (check before ready, server-side unsafe gate) |
| A8 | Add from Library picker | **Pass** (front end) | none |
| A9 | Citation chip opens the cited passage | Front end built, verified with a mocked stream | Part 2 §3 (BE-1 to BE-5) |
| A10 | Sources panel: cited files, switch a source off | Front end built, verified with a mocked stream | Part 3 A10 (honour `librarySourcesOff`, `document_id` in history) |
| A11 | Recording: transcribing step, timed citation | Step + answer pass; citation and transcript blocked | Part 3 A11, Part 2 BE-3 (time locators) |
| A12 | No upload button, tray or drop area in Library | **Pass** | none |
| A13 | "Search my Library in chats" off → "I couldn't find this in your files." | Fail: chats never search Library | Part 3 A13 (automatic retrieval, switch, groundedness) |
| A14 | "Don't save files from this chat" | Front end built; file still saved | Part 3 A14, Part 1 §3.1 |
| A15 | + menu: Add photos & files, Add from Library | Partial (app design differs: label, width, position) | none |
| Depth 1 | Failed upload: message only, same again | **Pass** | none |
| Depth 2 | Switch a source off → "I couldn't find…", "1 source switched off" | Blocked | Part 3 A10 + A13 |
| Depth 3 | X while Uploading / Processing leaves nothing | Pass while uploading; processing depends on A3 | Part 3 A3 |

## Suggested order

1. **Part 3 A3** (staged uploads) and **A6** (no de-duplication into one file): everything about saving builds on them.
2. **Part 1** (prefs and org settings, `saveToLibrary`) together with **A14** and **A5**: the same send path.
3. **Part 3 A7** (refuse bad files before ready).
4. **Part 2** (citations), then **A10** (sources, switch off) and **A13** (automatic Library search), which reuse its retrieval changes; **A11** (transcripts, time locators) last.

---

## Part 1. Library settings: personal prefs, workspace settings, and enforcing them

### 1. Background

The prototype (`library-prototype/surfaces/library`) has two settings pages:

- **Settings › Library** (everyone): auto-save for files from chats (Always, Ask each time, Never), "Let Souvenir use my Library" (AI reference), storage.
- **Settings › Workspace › Library** (Admin): default auto-save, force auto-save off for everyone, AI use of Library for the workspace, maximum file size, allowed file types.

Prototype Flow A, check 1: *"Files from chats save to Library by default (Always) with no prompt. Changing it is in Settings, Library."* Check 4: *"With Ask each time, sending asks 'Save 1 file to Library?' with Save as the default. With Never, nothing is saved."*

Both pages were built in the front end (commit `e955727c`), then removed in `579f2b94` when Library moved from the mock to the real API, because the backend has no endpoints for them. On 2026-10-18 they were restored behind a feature flag (off by default) so they are ready when this ticket ships:

- Pages: `src/app/(app)/settings/(shell)/library/page.tsx`, `src/app/(app)/settings/(shell)/(org)/workspace-library/page.tsx`
- Components: `src/components/Library/settings/{PersonalLibrarySettings,AdminLibrarySettings,SettingsParts}.tsx`
- Data: `src/lib/library/{schemas,api,queries,mutations}.ts` (`prefsSchema`, `orgSettingsSchema`, `getPrefs`, `updatePrefs`, `getOrgSettings`, `updateOrgSettings`)

#### What the backend has today

- `services/library/router.py` has files, trash, storage, limits and uploads. No prefs, no org settings.
- Chat send always saves attached files to Library (verified live 2026-10-18: a file attached in a chat appears in All files after sending, with no prompt). There is no way to choose Ask each time or Never.
- Retrieval (`services/document/retrieval.py`) never checks an AI-reference switch.
- `/library/limits` exists, but its values are not settable by an Admin.

### 2. Endpoints

All responses camelCase, error body per `04-backend-requirements.md` (`{code, message, details?, requestId}`).

#### 2.1 `GET /library/prefs` → `Prefs`

```json
{
  "autoSave": null,
  "aiReferenceEnabled": true,
  "effectiveAutoSave": "always",
  "forcedOff": false,
  "aiReferenceAllowed": true,
  "settingsChangedAt": "2026-10-18T09:12:00Z",
  "settingsChanges": [{ "key": "defaultAutoSave", "at": "2026-10-18T09:12:00Z", "text": "Default auto-save is now Ask each time" }]
}
```

| Field | Meaning |
|---|---|
| `autoSave` | The person's own choice, `always` / `ask` / `never`, or `null` if they never chose (the workspace default applies). |
| `aiReferenceEnabled` | The person's own "Let Souvenir use my Library" switch. |
| `effectiveAutoSave` | What saving actually does for them: force-off → `never`, else their choice, else the workspace default. |
| `forcedOff` | An Admin forced auto-save off for everyone (the personal control shows disabled). |
| `aiReferenceAllowed` | `false` when an Admin turned AI use of Library off for the workspace. |
| `settingsChangedAt`, `settingsChanges` | Optional. Powers the one-time "an Admin changed Library settings" notice. Can ship later. |

#### 2.2 `PATCH /library/prefs` → `Prefs`

Body: any of `{ "autoSave": "always"|"ask"|"never", "aiReferenceEnabled": boolean }`. Other fields are rejected (400). Returns the full recomputed `Prefs`.

#### 2.3 `GET /library/org-settings` → `OrgSettings` (Admin only, else 403)

```json
{
  "defaultAutoSave": "always",
  "forceAutoSaveOff": false,
  "aiReferenceEnabled": true,
  "maxFileBytes": 52428800,
  "allowedFormats": ["document", "sheet", "image", "audio"],
  "version": 7,
  "updatedBy": { "id": "u_1", "name": "Alex" },
  "updatedAt": "2026-10-18T09:12:00Z"
}
```

`allowedFormats` uses the same format values as `LibraryFile.format`.

#### 2.4 `PATCH /library/org-settings` → `OrgSettings` (Admin only)

- Body: any of `defaultAutoSave`, `forceAutoSaveOff`, `aiReferenceEnabled`, `maxFileBytes`, `allowedFormats`.
- Header `If-Match: <version>`. If the stored version differs, the later write still wins (Admins are equal), but the response carries the new `version`, `updatedBy` and `updatedAt` so the page can say who changed it. Bump `version` on every write.
- Validate `maxFileBytes` against a server ceiling; reject an empty `allowedFormats`.
- Append a `settingsChanges` entry (plain-English line) for members' notice.

#### 2.5 Storage of the values

As in `04-backend-requirements.md`:
- `LibraryUserPrefs(user_id pk, auto_save null, ai_reference_enabled bool default true, updated_at)`. "Chose" = `auto_save is not null`.
- `LibraryOrgSettings(org_id pk, default_auto_save default 'always', force_auto_save_off bool, ai_reference_enabled bool default true, max_file_bytes, allowed_formats, version, updated_by, updated_at)`.
- An individual account (no org) uses defaults for the org fields.

### 3. Enforcement (the part that makes the settings real)

#### 3.1 Auto-save on chat send

Today every file sent in a chat becomes an active Library file. Change so that on send, per `effectiveAutoSave` for the sender:

| Mode | Files sent in the chat |
|---|---|
| `always` | Saved to Library as today. |
| `ask` | The front end shows "Save N files to Library?" (Save is the default) and sends the answer with the message: `saveToLibrary: true|false`. `true` = saved; `false` = chat-only. |
| `never` | Chat-only: the file works in this chat (the model can read it, it shows on the message) but is not in All files, the picker or search. |

Also: the per-chat "Don't save files from this chat" option (prototype "More" menu) is the same as `never` for that chat. A chat-only file needs a lifecycle state (spec `life=chat_only`).

**Front-end status (done 2026-10-18, behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS`):** on send the chat reads `GET /library/prefs` and applies `saveOutcome` (`src/lib/library/sources.ts`) through `useSaveChoice` (`src/components/Library/chat/useSaveChoice.tsx`): Always sends nothing extra; Never and Admin force-off send `saveToLibrary=false` and show "Not saved. Auto-save is Never." / "Your Admin has turned auto-save off"; Ask each time shows "Save N files to Library?" (`AskSaveDialog`, Save focused by default) and sends `saveToLibrary=true|false`. The field goes on `POST /chats`, `POST /chats/{id}/stream` and both Next proxies (`/api/chat`, `/api/persona-chat`), next to `libraryFileIds`. The question is asked **before** the message goes out; the earlier design (an `ask_save` stream event after send plus `POST /library/uploads/resolve`) is dropped, so the backend does not need those.

Backend contract for the field: absent = apply the sender's `effectiveAutoSave` yourself (the front end may not have read prefs); `true` = save; `false` = chat-only. Never trust `true` over Admin force-off.

#### 3.2 AI reference

When the workspace `aiReferenceEnabled` is false **or** the person's `aiReferenceEnabled` is false, automatic Library retrieval is off for that person's chats: no always-on injection of Library files (`chat/service.py` `injected_document_context`) and no Library hits from `searchKnowledge`. Files attached by hand to the chat still work. The model is told why so it can say "I couldn't find this in your files" (prototype Flow A check on "Search my Library in chats").

#### 3.3 Limits

`GET /library/limits` and upload validation read `maxFileBytes` and `allowedFormats` from the org settings instead of fixed values.

### 4. Acceptance criteria

1. `GET /library/prefs` for a new user returns `autoSave: null`, `effectiveAutoSave` equal to the workspace default (`always` by default).
2. `PATCH /library/prefs {autoSave:"never"}` then sending a file in a chat: the file is readable in that chat and not in `GET /library/files?tab=all`.
3. With `ask` and `saveToLibrary:false`: same as never. With `saveToLibrary:true`: saved.
4. Admin sets `forceAutoSaveOff: true`: every member's `effectiveAutoSave` is `never`, `forcedOff` is `true`, and sending does not save.
5. A member calling `GET/PATCH /library/org-settings` gets 403.
6. Admin turns AI reference off: a chat without attachments asking about a Library file's content gets no Library context; attaching the file by hand still answers.
7. Admin lowers `maxFileBytes`: an upload above it is rejected at `POST /library/uploads` with the size error, and `/library/limits` reflects the new value.
8. Two Admins saving with the same stale `version` both succeed; the second response shows the new `version` and `updatedBy`.

### 5. Turning it on in the front end

When 2.1-2.4 are deployed to the dev backend:

1. Set `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS=true` and check both pages load, save, and show the saved toast.
2. When 3.1 ships, wire chat send to `saveOutcome` and `saveToLibrary` (front-end task).
3. Remove the flag once the pages read and write real data in all environments.

---

## Part 2. Library citations in chat answers

### 1. Background

#### 1.1 Question that started this

> In the front-end chat output, for answers that use the Library, did we add the cited passage (as in the Library prototype)?

**Answer: no.** Most of the front-end building blocks exist, but nothing in a chat answer uses them, and the backend sends no Library citation data to the browser. So a chat answer cannot cite a Library file today.

#### 1.2 Target behaviour (prototype)

From `library-prototype/surfaces/library/page.md` and `changelog.md` item 9:

- An answer that used a Library file shows an inline **citation chip** after the sentence it supports.
- The chip shows the **file name only** (no page, row or time). Exception: an audio citation adds the time ("Supplier call - Acme, 0:42").
- Tooltip: "Open the cited passage".
- Clicking the chip opens the file in a **panel beside the chat** with the cited **passage** (documents), **row** (sheets) or **time** (audio) highlighted. The panel has "Open file page" (keeps the highlight via `?cite=`).
- The **Sources panel** lists the chat's files and marks the ones the answer cited "Cited in answer". A source can be switched off for the rest of the chat.
- **Locked** file (viewer lost or never had access): chip reads "Locked file", lock glyph, opens the locked panel with Request access. Never shows the title.
- **Deleted** file: chip reads "File deleted", not clickable, never shows the title.
- No "Sources used" row under the answer and no "Saved to Library" toast (owner decision, prototype changelog items 7 and 8).

#### 1.3 What exists today

**Front-end (`front-end/src`), built but not connected to chat:**

| Piece | File | State |
|---|---|---|
| Citation chip (open / locked / deleted, link or side-panel mode) | `components/Library/chat/LibraryCitationChip.tsx` | Done, **not imported anywhere** |
| File panel beside the chat (preview, locked, gone states, "Open file page") | `components/Library/chat/ChatFilePanel.tsx` | Done, **not imported anywhere** |
| Sources panel | `components/Library/chat/SourcesPanel.tsx` | Exists, **not imported anywhere** |
| Locator model `{type: page\|row\|time, value, passage?}` | `lib/library/schemas.ts:183` (`CiteLocator`) | Done |
| `?cite=` / `?passage=` encode + parse, passage matching | `lib/library/cite.ts` (+ tests) | Done |
| Chip label, file-page href, `FileRef` (open/locked/deleted), `applySourceEvents` | `lib/library/sources.ts` | Done |
| Highlighting in viewers (PDF passage, text passage, sheet row, audio time) | `components/Library/viewers/*` | Done |
| File page reads `?cite=` + `?passage=` | `components/Library/FileScreen.tsx:50` | Done |

**Front-end chat output today** renders only **web** citations:
- `components/chat/CitationChip.tsx` (numbered chip, hover card, opens URL).
- Markers parsed in `components/chat/TextBlockContent.tsx:86-108`, `lib/line-renderer.tsx:199,229`, `lib/markdown-utils.tsx:196`.
- `WebCitation` (`types/chat.ts:285`) is `{title, url?, domain?}`: no file id, no locator, no passage.
- Sources come from parsing the model's own "Sources:" block (`lib/citations.ts`, stop-gap contract C2).

**Backend (`back-end/services`)**:
- Retrieval already has everything a citation needs. `document/retrieval.py:48 search_knowledge` returns `[{text, score, document_name, document_id, page, url}]`.
- But those hits only reach the **model prompt** as text:
  - Always-on injection: `chat/service.py:418` → `injected_document_context` → `render_hits` (`retrieval.py:100`), rendered as `[Source: name](url)` + `<chunk page="N">…</chunk>`.
  - On-demand tool: `sandbox/session.py:386 searchKnowledge` returns hits to the sandboxed model only.
- No SSE event carries sources or citations (`core/sse_schemas.py` has none; `MessageSavedEvent` is `message_id` only). No structured sources are persisted. This is the same gap as B1 in `chat-output-backend-requirements.md`, for Library files instead of web results.
- No `GET /library/files/names?ids=` batch endpoint yet (spec'd in `04-backend-requirements.md` line 179).

#### 1.4 Can the front end do it alone?

Not properly. The front end cannot highlight a passage it never receives, and it cannot tell which sentence a file supported. The only front-end-only option is to turn `[Source: name](url)` links the model sometimes copies into chips. That opens the file with no passage, only when the model happens to write the link, and the spec forbids synthesising chips from text (`02-frontend-logic.md` §8b.1). **Rejected.** Backend work below is required.

### 2. Goal

1. Every answer sentence that relies on a Library file carries a chip linked to that file **and the exact place** (page + passage, sheet row, or audio time).
2. Clicking the chip opens the file beside the chat with that place highlighted.
3. Citations survive a reload (persisted with the message).
4. Access is enforced server side: chips for files the viewer cannot open render locked or deleted, never leaking a title.

#### Non-goals (this ticket)
- Web citations (stay on the existing path; B1 covers them).
- Freshness notes, "added by" display, Approved status (Phase 2, OQ-14). Ship the fields if cheap, the UI comes later.
- Slack rendering of citations (separate surface, same backend data).
- Changing retrieval ranking or chunking.

### 3. Backend requirements

#### BE-1. Number the passages the model is given

In `render_hits` (`document/retrieval.py:100`), give every hit a stable per-turn id and render it into the prompt so the model can refer to it:

```text
[Source: Return policy 2026]
<chunk id="L1" page="2">Customers can return items within 30 days...</chunk>
<chunk id="L2" page="3">...</chunk>
```

- Ids are unique within the turn across both paths (injected context and every `searchKnowledge` call). Use a per-turn counter on the chat turn / workspace, `L1`, `L2`, ...
- Keep a per-turn registry `id → {fileId, documentName, locator, passage}` server side. The model never sees file ids.
- `fileId` is the **Library file id** (what `/library/files/{id}` takes). Confirm whether that equals `document_id` (Library is built on `Document`, `services/library/library.py`) or needs a lookup.

#### BE-2. Tell the model how to cite

Add to the system prompt (next to the web citation rules, `core/prompts/system.yaml` ~181-192):

- After a sentence that uses a Library passage, write the marker `[[L<n>]]` with the chunk id (several allowed: `[[L1]][[L3]]`).
- Only cite chunk ids that were provided in this turn. Never invent ids.
- Do not write a "Sources:" block for Library files, and do not write file names as links.

Marker syntax is a proposal; any unambiguous token that cannot collide with web `[N]` markers or Markdown links works. Agree it with the front end before building.

#### BE-3. Locator and passage per hit

| File kind | Locator | Passage |
|---|---|---|
| PDF / text document | `{type:"page", value:"<page>"}` | the chunk text the model was given (trimmed, ≤ 500 chars, the front end ignores longer) |
| Spreadsheet | `{type:"row", value:"<Sheet>!<row>"}` | optional |
| Audio | `{type:"time", value:"<ms>"}` | optional (the transcript line) |

Today only `page` exists (`DocumentPage.page_number`). Rows and times depend on the sheet/audio indexing in `04-backend-requirements.md` §3.9. Ship `page` first; the others plug into the same shape.

#### BE-4. Verify, then emit citations on the stream

When the answer finishes (before `message_saved`), resolve every `[[Ln]]` marker the model wrote:

- Unknown id → drop the marker (claim ships without a chip, §6.2 "Verified citations").
- Known id → re-check access for the **asking user** (`library.access.resolve`). Open → full entry. Not allowed → `state:"locked"`, no title, no passage. Trashed/purged → `state:"deleted"`.

New custom SSE event in `core/sse_schemas.py` (or extra fields on `MessageSavedEvent`):

```json
{
  "type": "library_citations",
  "messageId": "<turn id>",
  "citations": [
    {
      "id": "L1",
      "fileId": "9c1e…",
      "state": "open",
      "title": "Return policy 2026",
      "format": "document",
      "locator": { "type": "page", "value": "2", "passage": "Customers can return items within 30 days of delivery." }
    },
    { "id": "L4", "fileId": "77ab…", "state": "locked" }
  ],
  "groundedness": "grounded"
}
```

- `citations` lists only ids the answer text actually uses, so the front end can trust every marker it finds.
- `groundedness`: `grounded` | `partial` | `none` (spec §6.2). Optional in v1.
- During streaming the front end will show markers as pending (see FE-4), so emitting once at the end is fine. If cheap, also emit incrementally per new id.

#### BE-5. Persist and return with history

- Store the citation list with the message (`MessageMetadata` or a `message_library_citations` table) and return it in `GET /chats/{id}/messages` as `libraryCitations` with the same shape.
- On read, **re-resolve state** for the current viewer (renamed file shows the new title; lost access → locked; deleted → deleted). Never return a stored title for a file the viewer cannot open. This also covers shared chats (`ChatShare`): a reader does not gain access through a citation.
- Record a `LibraryFileUse(kind="chat_citation")` per cited file (`04-backend-requirements.md` §3.5) so "Used in" and the delete warning count it.

#### BE-6. Sources panel data (can follow BE-1..5)

- `sources` for the chat: files in scope + which the latest answer cited (`cited: true`).
- `sourceEvents: [{fileId, state:"removed"|"locked"}]` on the next turn when access changed (front end already handles this in `applySourceEvents`).
- `PATCH /chats/{id}` `libraryScope` to switch a source off (`02-frontend-logic.md` §8).

#### BE-7. Names batch (only if BE-5 cannot re-resolve on read)

`GET /library/files/names?ids=` → `[{id, title} | {id, state:"locked"|"deleted"}]` (spec line 179). Not needed if history already returns resolved state.

#### Backend acceptance criteria

1. Asking "What is our return window?" in a chat with *Return policy 2026* in scope streams a `library_citations` event with `state:"open"`, `locator.type:"page"`, the right page, and a passage that exists on that page.
2. The answer text contains `[[L1]]` (or the agreed marker) right after the supported sentence, and every marker in the text has an entry in `citations`.
3. A made-up marker in the model output (`[[L99]]`) is removed from the saved text and has no entry.
4. Reloading the chat returns the same citations in `GET /chats/{id}/messages`.
5. After the owner removes the viewer's access, reloading shows `state:"locked"` with no title or passage. After the file is trashed, `state:"deleted"`.
6. A shared-chat reader without access sees `locked`.
7. Web citations and the `Sources:` block behaviour (contract C2) are unchanged.

### 4. Front-end implementation plan

All work in `front-end/src`. No backend changes. Steps 1-3 can land before the backend ships (behind the existing `LIBRARY_ENABLED` flag), driven by a fixture.

> **Status 2026-10-18 (checkpoint A9):** FE-1, FE-2, FE-3 and FE-4 are built against the format in §3 (`[[L<n>]]` markers + the `library_citations` CUSTOM event, `libraryCitations` / `library_citations` on history). No flag is needed: with no event and no markers nothing changes. Code: `src/components/Library/chat/library-citations.tsx` (parsing, markers → `libcite://` links, provider, marker → `LibraryCitationChip`), `src/lib/markdown-utils.tsx` (renders them), `src/hooks/use-streaming-chat.ts` (event), `src/lib/api/chat.ts` + `src/lib/normalizers/message-transformer.ts` (history), copy strips markers (`ChatMessage.tsx`). Unit tests: `library-citations.test.tsx`. Verified live with a mocked stream: chip shows the file name only with "Open the cited passage", an unknown marker renders nothing, and clicking opens the File page with the passage highlighted ("Cited passage"). **Not done yet:** FE-5 (opening in a panel beside the chat instead of the File page), FE-6 Sources panel, FE-7 groundedness; the share page has not been checked for stripped markers. If the backend picks a different marker or event name, only `LIBRARY_MARKER` and the event name in `use-streaming-chat.ts` change.

#### FE-1. Types and parsing

- `types/chat.ts`: add `LibraryCitation` (`{id, fileId, state, title?, format?, locator?}`) and `libraryCitations?: LibraryCitation[]` on `Message` and on the text content block (next to `webCitations`, line 385).
- `lib/library/schemas.ts`: zod schema for the event/history payload; parse with `safeParse`, log and drop on mismatch (same as other Library parsing).
- Map a `LibraryCitation` to the existing `FileRef` (`lib/library/sources.ts`): `open` → `{id, state:"open", title, format}`, `locked`/`deleted` as is.
- `lib/library/cite.ts` already validates locators and passage length; reuse `parseCite`-style checks on the incoming locator.

#### FE-2. Stream and history wiring

- AG-UI handler (`src/lib/agui`, see `docs/api/SSE_EVENTS v2.md`): handle `library_citations`, attach the list to the assistant message by `messageId`.
- History load: read `libraryCitations` from `GET /chats/{id}/messages` into the same field.
- Apply `sourceEvents` to the chat's `FileRef` map with `applySourceEvents` so old chips turn locked/deleted without rewriting the answer text.

#### FE-3. Render chips inline

- Add the agreed marker (`[[L<n>]]`) to the inline tokenizer in the three renderers: `components/chat/TextBlockContent.tsx`, `lib/line-renderer.tsx`, `lib/markdown-utils.tsx`. Keep it a separate branch from web `{N}` / `[N]` so the two never mix.
- Marker with a matching citation → `<LibraryCitationChip fileRef={…} locator={…} onOpen={openPanel} onOpenLocked={openPanel} />`.
- Marker with no matching citation → render nothing (spec §8b.1: never synthesise a chip; tolerate a claim that lost its chip).
- Consecutive markers for the same file and locator collapse into one chip.
- Strip markers from copy-to-clipboard, share and export text (check `ChatMessage` copy action and `chat-shares/[shareId]/page.tsx`).

#### FE-4. Streaming behaviour

- While the answer streams, markers arrive before the `library_citations` event. Hide markers until the event arrives (no flashing raw `[[L1]]`), then render chips with the same fade the web `SourceList` uses.
- A partially streamed marker (`[[L`) at the end of the buffer must not render as text (same guard the widget tags use, contract C3).
- If the stream ends with no event (old backend), markers render nothing.

#### FE-5. File panel beside the chat

- Mount `ChatFilePanel` in the chat page layout as a right-hand panel (same slot pattern as other chat side panels). State: `{fileId, cite} | null`, kept in the URL (`?file=<id>&cite=page:2&passage=…`) so back/forward and refresh keep it. Reuse `citeQuery` / `parseCite`.
- Chip click → open panel with that file + locator; clicking another chip swaps it; Close or Escape closes it and returns focus to the chip.
- "Open file page" in the panel already keeps the highlight (`citationHref`).
- Locked chip → panel in `LockedState` with Request access. Deleted chip is not clickable.
- Narrow screens (< 1024px): open the File page (`citationHref`) instead of a panel.
- Track `citation_opened` (`trackLibrary`) for both panel and page opens.

#### FE-6. Sources panel (after BE-6)

- Mount `components/Library/chat/SourcesPanel.tsx` from the chat header. List scope files; mark cited ones "Cited in answer"; switch off via `PATCH /chats/{id}` `libraryScope`.
- Do **not** add a "Sources used" list under answers (prototype changelog item 7).

#### FE-7. Not-in-files and limits (after BE-4 `groundedness`)

- `groundedness:"none"` → "I couldn't find this in your files." and mark general parts as not from files (`02-frontend-logic.md` §8b.3). `files_truncated`, `searchedCount` per §8b.6-7. Can ship after the chips.

#### FE-8. Tests

- Unit: marker tokenizer (single, multiple, same-file collapse, unknown id, partial marker at buffer end, coexistence with web `{N}`); `LibraryCitation` → `FileRef` mapping; zod parsing of good/bad payloads.
- Component: `LibraryCitationChip` open/locked/deleted labels and tooltips; audio label with time; no title for locked/deleted.
- Flow (Playwright, recipe in the two-account test docs): ask about a seeded PDF → chip shows file name only → click → panel opens with the passage highlighted → "Open file page" keeps the highlight → reload keeps chips → second account without access sees "Locked file" and Request access.
- Visual: chip and panel in light and dark.

#### Front-end acceptance criteria

1. An answer using *Return policy 2026* shows a chip "Return policy 2026" after the supported sentence, with the tooltip "Open the cited passage".
2. Clicking it opens the file beside the chat, scrolled to and highlighting the cited passage. A passage not found on the page falls back to highlighting the page.
3. A sheet citation highlights the row; an audio citation's chip reads "Name, 0:42" and starts the player there.
4. Locked chip: "Locked file" with lock glyph, opens the locked panel; deleted chip: "File deleted", not clickable. Neither shows the title anywhere (DOM, tooltip, URL).
5. No raw `[[Ln]]` text is ever visible, including while streaming and in copied text.
6. Reload, back/forward and a shared chat all show the same chips (with the viewer's own access).
7. Web citations look and behave exactly as before.

### 5. Delivery plan

| Step | Owner | Depends on | Ships |
|---|---|---|---|
| 0 | BE + FE | — | Agree the marker token and the `library_citations` payload (this doc §3 BE-2, BE-4). |
| 1 | FE | 0 | FE-1, FE-3, FE-5 against a fixture event, behind `LIBRARY_ENABLED`. No user-visible change until the backend sends data. |
| 2 | BE | 0 | BE-1, BE-2, BE-3 (page only), BE-4. |
| 3 | FE | 2 | FE-2, FE-4: live stream wiring; end-to-end test on PDFs and text files. |
| 4 | BE | 2 | BE-5 persistence + re-resolve on read, `chat_citation` uses. |
| 5 | FE | 4 | History load, shared chats, FE-8 flow tests. |
| 6 | BE + FE | 5 | BE-6 / FE-6 Sources panel; BE-3 rows and times once sheet/audio indexing exists; FE-7 groundedness. |

### 6. Open questions

1. **Marker token**: `[[L1]]` or something else the model writes reliably? Needs a quick prompt test on the default chat model.
2. **Library file id vs `document_id`**: are they the same id for Library files, and what about project knowledge documents that are not Library files? Should those cite the same way (chip opens the project document) or not at all in v1?
3. **Passage granularity**: is the whole retrieved chunk an acceptable passage, or should the backend narrow it to the sentence(s) the model used? The front end highlights whatever it gets; shorter is better.
4. **Event timing**: one event at the end, or incremental? End-only is simpler; the front end hides markers until it arrives.
5. **Persist where**: `MessageMetadata` JSON vs a table. A table makes "Used in" and reverse lookups (which answers cite this file) cheap.
6. **Sandbox answers**: when the model reads a Library file directly from `/sandbox/input/` (not via retrieval), it has no chunk id. Cite the file without a locator, or not at all?

---

## Part 3. Findings from the Flow A checkpoints

Each section: the check, what was seen live, why it is backend, what is needed, how to verify.

### A3. Unsent chat attachments must stay out of Library, and X must delete them

**Check (prototype Flow A):** "Until the message is sent, the file is not in All files, the picker or search, and removing it with its X deletes it."

**Context:** since 2026-10-18 the chat composer uploads a file into Library the moment it is attached (`POST /library/uploads` → parts → `complete` → processing → ready), so the chip can show Uploading / Processing and Send waits (check A2). The message then refers to the file by `libraryFileIds`.

**Seen live (2026-10-18, admin account):** attached `a3unsent<stamp>.txt`, waited until ready, did not send.

| Where | Expected | Seen |
|---|---|---|
| `GET /library/files?tab=all` and All files page | not listed | **listed** |
| `GET /library/files?q=<name>` and Library search | not found | **found** |
| Removed with its X in the composer | file deleted | **still in All files**, not in Trash |

**Why it is backend:**

1. `services/library/uploads.py` `read()` (line ~235) creates an ordinary `Document` as soon as processing finishes, so every list and search query sees it.
2. `UploadController.cancel` (line ~150) only works while `phase == "uploading"`; after that it answers `409 upload_done`. The front end has no way to discard a processed but unsent upload.
3. The front end cannot safely delete the document itself: `read()` de-duplicates by content hash and may point the upload at a file the person **already had** (`upload.reused = True`). Deleting "the unsent file" would then delete their existing file.

**Needed:**

1. **Staged state.** A processed upload that no message has used yet is *staged*: it has a `Document` (so it can be attached and read) but is excluded from `GET /library/files` (all tabs), search, the picker, Suggested, storage totals and counts. Spec: `04-backend-requirements.md` §2.4 "Nothing half-saved" and the `staged` life state. A column such as `Document.staged_at` (null = active) or `life = 'staged'` works.
2. **Promote on send.** When `POST /chats` or `/chats/{id}/stream` receives `libraryFileIds`, every staged file in it becomes active (apart from auto-save `never` / `ask`→no, see Part 1 §3.1, where it becomes chat-only instead). Promotion is idempotent.
3. **Discard.** `DELETE /library/uploads/{id}` also works after processing: if the upload produced a **new** staged document, delete it (S3 object, `Document`, pages and embeddings); if it was `reused` (pointed at an existing file), only drop the upload row and never touch the existing file. Return 204 in both cases; 409 only if the document was already promoted by a send.
4. **Cleanup.** A staged document not promoted within N hours (e.g. 24) is purged by the existing stale-upload job (`uploads.py` ~line 281), same rules as discard.
5. **Dedup and staging:** if the content matches an existing *active* file, reuse it as today (nothing is staged). If it matches only a *staged* file of the same person, reuse that staged one.

**Front-end follow-up (no backend change needed for these):** the composer already calls `cancel` on X (`src/lib/library/upload/composer-uploads.ts` `cancelComposerUpload`). Once discard works after processing, it will call it for ready uploads too. The "Add from Library" picker is not wired into the chat composer yet (separate check); when it is, it uses the same list endpoint, so (1) covers it.

**Verify (A3):**

1. Attach a file, wait for ready, do not send: not in All files, search or picker; `GET /library/storage` unchanged.
2. Send the message: the file appears in All files.
3. Attach, wait for ready, press X: `DELETE /library/uploads/{id}` returns 204; the file is nowhere, including Trash.
4. Attach a copy of a file already in Library (same bytes), press X: the original file is still there.
5. Attach and close the tab: after the cleanup window, the staged document is gone.

---

### A4. Ask each time and Never on send

**Check (prototype Flow A):** "With Ask each time, sending asks 'Save 1 file to Library?' with Save as the default. With Never, nothing is saved."

**Status:** front end built 2026-10-18 (`useSaveChoice`, `AskSaveDialog`, `saveToLibrary` on the send request), off behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` because the backend has no `GET /library/prefs`. Cannot be checked live until the backend ships it.

**Backend work:** fully specified in Part 1 §2.1-2.2 (prefs endpoints) and §3.1 (honour `saveToLibrary` on chat send, chat-only files for `false`). Depends on A3's staged state above: a file sent with `saveToLibrary=false` must stay out of Library the same way an unsent one does.

**Verify:** with the flag on and prefs set to Ask each time, send a file: the dialog shows "Save 1 file to Library?" with Save focused; Save → file in All files; Don't save (or closing) → "Not saved. It stays in this chat." and the file is not in All files. With Never: no dialog, "Not saved. Auto-save is Never.", file not in All files.

---

### A5. A file uploaded in a new chat must link back to that chat

**Check (prototype Flow A):** "The new file's row shows only your avatar under Access, source Uploaded and the date created, and its provenance line reads 'Uploaded by You' with a link to the chat."

**Seen live (2026-10-18):**

| Case | Row | Provenance line |
|---|---|---|
| File attached in an **open** chat | only your avatar ("Only you"), Uploaded, created date | "Uploaded by You, Return Window Details" with the chat link. **Pass** (after a front-end fix the same day: the composer now sends `chatId` on `POST /library/uploads`) |
| File attached in a **new** chat | same, correct | "Uploaded by You" with **no chat link**. **Fail** |

**Why it is backend:** the composer uploads a file the moment it is attached (check A2). In a new chat the chat does not exist yet, so `POST /library/uploads` has no `chatId` and `Document.origin_chat_id` stays null (`uploads.py` `read()`, ~line 251). The chat is created by the same request that carries `libraryFileIds`. Before A2, files rode with the message and `document/workspace.py` (~line 439) set `origin_chat_id` itself.

**Needed:** when `POST /chats` (or `/chats/{id}/stream`) attaches documents by `libraryFileIds`, set `origin_chat_id` to that chat for each document that is **owned by the sender** and has `origin_chat_id IS NULL`. Never overwrite an existing origin (a file picked from Library keeps the chat it came from). Fits naturally with A3's "promote on send".

**Verify:** in a new chat, attach a file, send; its file page reads "Uploaded by You, <chat title>" and the link opens that chat. Picking an older Library file into a new chat does not change that file's provenance.

---

### A6. Sending the same file again must make a second file

**Check (prototype Flow A):** "Sending the same file again saves it as a separate file with the same name. The Created time tells the two apart."

**Seen live (2026-10-18):** sent `a6-same-<stamp>.txt` twice (identical bytes, two separate uploads and messages in the same chat). All files shows **one** row. **Fail.** Same as finding F2 of the 2026-10-15 run (`docs v2/library/10-test-cases-and-results.md`).

**Why it is backend:** `services/library/uploads.py` `read()` (~line 242) looks for an active `Document` of the same owner with the same `sha256` and, if found, points the upload at it (`upload.reused = True`) instead of creating a new file. The second send therefore attaches the first file.

**Needed:** every upload creates its own `Document` (own id, own `created_at`, own name, own origin chat), even when the bytes match an existing file. If storage cost is the reason for de-duplication, keep it at the storage layer only: several `Document` rows may share one S3 object and one set of extracted pages/embeddings (reference-counted, deleted when the last row is purged). The person always sees separate files.

This also removes the A3 risk where discarding an unsent upload could hit a file the person already had (a reused document).

**Verify:** send the same file twice: two rows with the same name and different Created times; renaming, sharing or deleting one does not change the other; deleting one keeps the other readable in chat.

---

### A7. Unreadable, password-protected and unsafe files must be refused before they become files

**Check (prototype Flow A):** "A failed, password-protected, unsupported or unsafe upload never becomes a file: no chip, no row, nothing saved. Only a short message with no file name shows, at once, above the composer. It clears after 6 seconds."

**Seen live (2026-10-18), after the front-end fixes below:**

| File | Upload result | Composer | In Library |
|---|---|---|---|
| `.exe` | refused in the browser (`unsafe`) | chip gone, "Blocked: this file looks unsafe.", cleared after ~6 s | no. **Pass** |
| `.zip` | refused in the browser (`unsupported`, not in the server's extension map) | chip gone, "This file type isn't supported.", cleared after ~6 s | no. **Pass** |
| corrupt `.pdf` (random bytes between `%PDF-1.4` and `%%EOF`) | backend: `phase: "ready"` with a `fileId` | normal chip, Send on | **yes. Fail** |
| password-protected `.pdf` (trailer has `/Encrypt`, Standard handler) | backend: `phase: "ready"` with a `fileId` | normal chip, Send on | **yes. Fail** |

**Why it is backend:**

1. `services/library/uploads.py` `processStep` marks the upload `ready` and creates the `Document` as soon as the bytes are read (`read()`, ~line 235). The content checks that can refuse a file (`ProcessingRejected("password_protected")`, `"unreadable"`, `"too_large"`) live in `services/document/indexing.py` (~lines 135-193), which runs **after** the file already exists. The upload never reports `failed`, so the composer cannot show the message, and the file stays in Library.
2. Nothing raises `"unsafe"` anywhere in the backend (the reason exists only in `library/schemas.py` `failureReason`). There is no server-side block of executables or content sniffing. The front end now blocks common program extensions, but that is a convenience, not a control (renaming `tool.exe` to `tool.pdf` passes the browser check).

**Needed:**

1. Run the refusal checks **before** `phase = "ready"`: open/parse the file with the same extractor indexing uses (or a cheap pre-flight: PDF `/Encrypt`, Office encryption flag, zip-bomb/size, can the text layer or image be decoded at all). On failure set `phase = "failed"`, `failureReason` (`password_protected` / `unreadable` / `too_large`), delete the staged S3 object, and create **no** `Document`. `GET /library/uploads?ids=` then returns the reason; the composer already shows the matching message.
2. Content-type sniffing and an executable/malware gate on the server that fails the upload with `unsafe` (magic bytes, not the extension).
3. If indexing can still fail later (e.g. OCR timeout), it must not leave a visible broken file: either retry, or mark it so it is not listed (decide with product).

**Front-end changes made for A7 (2026-10-18):** a refused upload now leaves the composer (chip removed, never sent, not even as bytes) and its reason shows once above the composer through `UploadNotices`, without the file name, for 6 seconds. The old composer pre-checks that toasted "`<name>` isn't supported" / "exceeds 50 MB" are skipped for the Library-backed composers so the Library check reports instead. Program extensions (`.exe`, `.msi`, `.bat`, `.sh`, ...) are refused as `unsafe` in `src/lib/library/upload/validate.ts`.

**Verify:** upload a corrupt PDF and a password-protected PDF in a chat: within a few seconds the chip disappears, "This file couldn't be read." / "This file is password-protected, so it can't be added." shows above the composer and clears after 6 s, and neither file is in All files. Rename an `.exe` to `.pdf` and upload: "Blocked: this file looks unsafe.", nothing saved.

---

### A9. Answers must carry Library citations

**Check (prototype Flow A):** "The answer carries a citation chip, and clicking it opens the file with the cited passage highlighted."

**Status (2026-10-18):** front end built and verified with a mocked stream (chip with the file name only, tooltip "Open the cited passage", click opens the File page with the passage highlighted). **Blocked live:** the backend sends no Library citations, so real answers never show a chip.

**Backend work:** fully specified in Part 2 §3 (BE-1 to BE-5): give each retrieved passage a per-turn id, tell the model to write `[[L<n>]]` after the sentence it supports, verify and emit a `library_citations` CUSTOM event `{messageId, citations: [{id, fileId, state, title, format, locator: {type, value, passage}}]}`, and return the same list as `libraryCitations` with the message history (state re-resolved for the viewer).

**Verify:** ask "What is our return window?" in a chat with a policy file attached: the answer shows a chip with the file name after the sentence; clicking it opens the file at the right page with that sentence highlighted; reloading the chat keeps the chip.

---

### A10. Sources panel: list the chat's files and honour "switch off"

**Check (prototype Flow A):** "The Sources panel lists the file as cited in the answer, and lets you switch a source off for the rest of the chat."

**Status (2026-10-18):** front end built (`src/components/Library/chat/ChatSources.tsx` mounts the existing `SourcesPanel` with a "Sources · N" button beside Share). Verified with a mocked reply in an existing chat: the picked file is listed "Cited in answer"; switching it off shows "Off for this chat"; the next message sends `librarySourcesOff=["<fileId>"]`. **Blocked live** on three backend gaps:

1. **Switch-off is ignored.** Nothing reads `librarySourcesOff`. Needed: on `POST /chats` and `POST /chats/{id}/stream`, accept `librarySourcesOff` (JSON array of file ids, same format as `libraryFileIds`), store it per chat (spec: `ChatLibrarySourceOff(chat_id, file_id)`, `04-backend-requirements.md` §3.10), and leave those files out of the always-on context (`chat/service.py` `injected_document_context`), `searchKnowledge`, and the files the turn reads. Return the stored list on `GET /chats/{id}` (`librarySourcesOff`) so another device or a reload shows the same switches (the front end keeps a sessionStorage copy until then: `src/lib/library/library-sources-off.ts`). If a question can only be answered from switched-off files the answer says "I couldn't find this in your files." (prototype adds "1 source switched off").
2. **History does not say which Library file an attachment is.** `services/chat/repository.py` (~line 135) builds `file_attachments` with `file_name, s3_key, mime_type, file_size, origin` but not `MessageFileAttachment.document_id`, which the row already has. Add `"document_id"` to that `json_build_object`. The front end already reads it (`lib/api/chat.ts` → `message-transformer.ts` → `libraryFileIds`), so after a reload the panel lists files sent in earlier messages.
3. **Cited** marks need the A9 citations (Part 2 ).

**Verify:** in a chat, send a file and get an answer citing it; open Sources: the file shows "Cited in answer". Switch it off and ask again: the answer does not use it. Reload: still off, and files from earlier messages are listed.

---

### A11. Recordings: transcribing step, timed citation, transcript on the file page

**Check (prototype Flow A):** "Whatever you ask with a recording attached, a transcribing step shows, then a short answer whose citation opens the recording at the cited time."

**Seen live (2026-10-19)** with a real speech recording (`supplier-call-a11.wav`, 1.1 MB, made with Windows text-to-speech): the upload goes Uploading → Processing → ready, the turn runs the `transcribe_audio` tool in the sandbox, and the answer is right ("customers can return items within 30 days of delivery, provided they're unused").

| Part | Result |
|---|---|
| Transcribing step | **Pass** after a front-end change: the row now reads "Transcribing — supplier-call-a11.wav" (it read "Running tool — /sandbox/input/supplier-call-a11.wav") |
| Short answer | Pass |
| Citation opens the recording at the cited time | **Blocked (backend)**: no citation is sent. Front end verified with a mocked `library_citations` event (`locator: {type: "time", value: "9000"}`): chip "supplier-call-a11, 0:09", click opens the File page with the player at 9 s |
| Transcript on the File page | **Fail (backend)**: `library/preview.py` ~line 96 returns `AudioPreview(url, durationMs=0, lines=[])`, so the page shows only a player; no transcript lines to read, click or highlight at the cited time |

**Needed:**

1. **Label the step.** Emit `tool_executing` / `tool_progress` with `label: "Transcribing"` (and the file name as the detail) for the transcription call, so the front end does not have to infer it. The front end currently infers it from the tool name `transcribe_audio` or an audio path (`src/lib/activity.ts` `activityVerb`); a backend label wins.
2. **Timed citations.** Part of Part 2 BE-3: chunks of a transcript carry `{type: "time", value: <startMs>}` so a cited sentence from a recording gets a time locator (`04-backend-requirements.md` §3.9 `LibraryFileTranscript` segments).
3. **Transcript in the preview.** Persist the transcript the first time a recording is transcribed (or at upload) and return it from the preview: `durationMs` and `lines: [{startMs, endMs, speaker?, text}]`. The File page's `AudioViewer` already renders lines, seeks on click and highlights the line at `?cite=time:<ms>`.

**Verify:** attach a recording and ask about it: a "Transcribing <file>" step, then the answer with a chip "<file>, m:ss"; clicking opens the recording at that time with the matching transcript line highlighted.

---

### A13. Chats must search the person's Library on their own, and say when the files do not cover it

**Check (prototype Flow A):** "Turn off 'Search my Library in chats' in Settings, Library. In a new chat, ask 'What is our return window?' without attaching anything: Souvenir says 'I couldn't find this in your files.' Attach Return policy 2026 and ask again to get the answer."

**Seen live (2026-10-19):** with the switch in its default (on) state and nothing attached, a new chat asked "According to my files, how many business days do Acme orders take to ship?" (the answer is in two Library files). The model ran 6 actions and replied "I don't see any files attached to this chat. Upload the file with the Acme shipping details". **Fail:** a chat never searches Library unless a file is attached, so the setting has nothing to switch off.

**Needed:**

1. **Automatic Library retrieval** for every chat turn: search the asking user's Library (files they can open, `life=active`, not switched off in the chat's Sources, not agent outputs) with the same retrieval the attached-file path uses (`document/retrieval.py`), and feed the best passages to the model with citation ids (Part 2 BE-1).
2. **The switch:** skip (1) when the user's or the workspace's AI reference is off (Part 1 §3.2). Attached files keep working.
3. **"Not in your files":** when the question is about the user's files and nothing relevant is found (or the source was switched off), the answer says "I couldn't find this in your files." and, if a source is switched off, notes "1 source switched off" (prototype depth check). Emit `groundedness: "none" | "partial" | "grounded"` on the answer so the front end can mark it (`02-frontend-logic.md` §8b.3).

**Verify:** with the switch on, ask about a fact that is only in a Library file, with nothing attached: the answer uses it and cites it. Turn the switch off: "I couldn't find this in your files." Attach the file: answered again.

---

### A14. "Don't save files from this chat"

**Check (prototype Flow A):** "In a chat, choose More, then 'Don't save files from this chat'. A file sent there is not saved and shows 'Not saved. This chat doesn't save files.'"

**Status (2026-10-19):** front end built. The open chat's More options menu (sidebar row) has "Don't save files from this chat" / "They stay in this chat" (`src/components/Library/chat/DontSaveChatItem.tsx`). With it on, sending a file shows "Not saved. This chat doesn't save files." and the request carries `saveToLibrary=false`. Seen live: the request is right, but **the file is still saved to Library** (found by `GET /library/files?q=`). **Fail (backend).**

**Needed:** honour `saveToLibrary=false` (chat-only file), as in Part 1 §3.1, which depends on A3's staged state. Store the per-chat flag server side (e.g. `Chatboard.library_dont_save bool`, settable with `PATCH /chats/{id}` `{libraryDontSave: true}` and returned on `GET /chats/{id}`); apply it on send even if the client does not send `saveToLibrary`. The front end keeps a localStorage copy until then (`src/lib/library/library-dont-save.ts`).

**Verify:** turn it on for a chat, send a file: the message's chip says "Not saved. This chat doesn't save files.", and the file is not in All files, search or the picker. Other chats still save.
