# 02 Frontend logic

Conventions to follow (all already in the repo): Next.js 16 App Router (read `node_modules/next/dist/docs/` before writing, per `AGENTS.md`), `src/app/(app)` route group, TanStack Query for server state (`QueryProvider`, pattern in `src/lib/queries/personas.ts`), API modules in `src/lib/api/*.ts` using `apiFetch` / `apiFetchJson` from `./client` and endpoint constants in `src/lib/config.ts`, zod schemas next to the API module (`connector-schemas.ts`, `persona-schemas.ts`), camelCase at the UI boundary, Mixpanel only through `src/lib/analytics`.

## 1. Routes

| Route | Screen | Notes |
|---|---|---|
| `/library` | Library page | `?tab=suggested\|all\|shared` (default `suggested`), `?q=`, `?scope=tab\|all`, `?source=`, `?type=`, `?sort=`. URL is the source of truth for tab, query, filters and sort so back/forward and shared links work. |
| `/library/trash` | Trash screen | Breadcrumb "Library > Trash". Not a tab. No storage label here. |
| `/library/files/[fileId]` | File page | `?cite=<locator>` highlights a passage, row or time. `?from=<tab>` only for the back link. |
| `/settings/library` | Personal Library settings | Auto-save, AI reference switch, storage, Leave workspace. Replaces `settings/(shell)/files` (see 05 open question 5). |
| `/settings/workspace-library` | Admin Library settings | Default auto-save, force off, AI reference, file limits, storage, Members (read only, with a link to the workspace Members page). Admin only (reuse the guard the other `org/*` pages use). Audit log and Inventory are static "Coming soon" pages. |

Sidebar: add a "Library" row to `FlatSidebar` (icon from `@strange-huge/icons`). Active state matches `/library*`. Hidden when `LIBRARY_ENABLED` is off.

Route segments each get `loading.tsx` (skeleton that matches the final layout) and `error.tsx`, as `agents/` does. The File page uses `notFound()` only for a malformed id; a missing, trashed or locked file is a **state**, not a 404 (section 7).

## 2. Folder layout

```
src/
  app/(app)/library/
    page.tsx                  server shell, renders <LibraryScreen/>
    loading.tsx  error.tsx
    trash/page.tsx
    files/[fileId]/page.tsx
  app/(app)/settings/(shell)/library/page.tsx
  app/(app)/settings/(shell)/(org)/workspace-library/page.tsx   (Admin guard comes from the (org) layout; Audit log and Inventory are static rows on this page)
  components/library/          presentational components (03-components.md)
  lib/library/
    api.ts          fetch functions, one per endpoint
    schemas.ts      zod schemas + inferred types (the only place wire shapes live)
    normalizers.ts  wire -> UI model
    keys.ts         query key factory
    queries.ts      useLibraryFiles, useLibraryFile, useLibraryStorage, ...
    mutations.ts    rename, trash, restore, grant, revoke, ...
    access.ts       caps(), isInLibrary(), citable() (pure, unit tested)
    suggested.ts    recent / frequent / generated selection (pure)
    format.ts       when(), agoShort(), size, typeId, accessTip
    messages.ts     every user-facing string for errors, toasts, empty states
    upload/         useLibraryUpload (state machine), validators
    mock/           mock adapter + fixtures (dev and tests only)
  (no library context provider: upload state is an external store in lib/library/upload/store.ts with a tiny LibraryUploadHost mounted in (app)/layout.tsx; picker config is a scoped context created at the dialog. See 07 sections 2 and 6)
```

No Redux-style global store. The prototype's single reducer is a prototype device; production splits it into URL state, server state (Query) and a small amount of UI state local to components.

## 3. Wire types and the API layer

`schemas.ts` defines zod for: `LibraryFile`, `LibraryFileDetail`, `Grant`, `Origin`, `Usage`, `StorageSummary`, `LibraryPrefs`, `LibraryOrgSettings`, `UploadStatus`, `Citation`. Parse every response (`safeParse`, log and throw a typed `LibraryApiError` on mismatch, as the connectors API does). Field names are camelCase to match how `services/projects` serialises.

Key UI model fields (from the backend list endpoint, 04 section 5):

```ts
type LibraryFileRow = {
  id: string; title: string; extension: string; format: Format;
  source: "uploaded" | "generated"; owner: PersonRef;
  access: "owner" | "viewer"; adminCanManage: boolean;
  accessSummary: { everyone: boolean; people: PersonRef[] };   // owner first, server ordered
  sizeBytes: number; createdAt: string; lastActivityAt: string;
  lastActivityKind: "opened" | "modified" | "created" | "shared";
  unread: boolean; phase: "ready"; life: "active" | "trashed";
  trashedAt?: string; daysLeft?: number; sharedAt?: string; sharedBy?: PersonRef;
  snippet?: string;                                             // search only
};
```

`caps` come from `access` and `adminCanManage`; never derive from the viewer's role.

Errors: map HTTP codes in `lib/http-errors.ts` style: 401 -> existing auth redirect, 403 `file_locked` -> locked state, 404 or 410 -> gone state, 409 -> conflict toast ("This file changed. Try again."), 413 and 415 and 422 on upload -> the fixed upload messages (section 6), 429 -> the existing rate-limit toast. `secureFetch` already retries and circuit-breaks; do not stack a second retry on top. Only the JSON control plane (init, presign, complete, batch status, lists) goes through `apiFetch` and the proxy. **Part bytes go straight to the presigned storage URL with a plain `XMLHttpRequest`/`fetch` and no Authorization header** (never send our bearer to a third-party origin), so neither `uploadRateLimiter` nor the 320 MB proxy cap applies to them. Fetch a fresh token before each control-plane call; uploads can outlive the 60 s refresh buffer. Authoritative design: `07-build-plan.md` sections 5 and 6 (this doc's key list in section 4 is superseded by 07 section 5.1).

## 4. Query keys and caching

```ts
libraryKeys = {
  all:       ["library"] as const,
  lists:     () => [...all, "list"],
  list:      (p: ListParams) => [...all, "list", p],            // tab, q, scope, filters, sort, cursor
  suggested: () => [...all, "suggested"],
  file:      (id) => [...all, "file", id],
  usage:     (id) => [...all, "file", id, "usage"],
  access:    (id) => [...all, "file", id, "access"],
  trash:     () => [...all, "trash"],
  storage:   () => [...all, "storage"],
  picker:    (p) => [...all, "picker", p],
  prefs:     () => [...all, "prefs"],
  orgSettings: () => [...all, "org-settings"],
  members:   () => [...all, "members"],
}
```

- **Every key carries the active workspace id** (`["library", orgId, ...]`). Library is scoped to the workspace the person is acting in (`TeamSwitcher`, `org-context`). Switching workspace must change the keys, abort in-flight Library requests, clear the picker target and any staged upload tray, and never show the previous workspace's rows even for a frame. Individuals without a workspace use `orgId = "personal"` (open question OQ-2).
- One `QueryClient` (already global). Lists use `useInfiniteQuery` with a cursor. `staleTime` 30 s for lists, 0 for the File page when `phase !== ready`.
- **Invalidation matrix** (single place, `mutations.ts`):

| Mutation | Invalidate |
|---|---|
| rename | `file(id)`, `lists()`, `suggested()`, `picker` |
| trash | `lists()`, `suggested()`, `trash()`, `storage()`, `file(id)`, `picker`, and chat/routine usage caches |
| restore | same as trash |
| delete forever / empty trash | `trash()`, `storage()`, `file(id)` removed |
| grant / revoke | `access(id)`, `file(id)`, `lists()` (Access column), `shared` list |
| chat send that saved files | `lists()`, `suggested()`, `storage()` |
| routine run completes | `lists()`, `suggested()` |
| open a file | `suggested()` (lastActivity), clears unread in the cached row |

- Optimistic updates only for: rename, trash (move row to Trash cache with `daysLeft = 30`), restore, revoke. Pattern: `cancelQueries` -> snapshot -> `setQueryData` -> return a rollback, exactly like `optimisticTogglePause`. Share is **not** optimistic (server resolves ways in and may reject).
- Undo toasts: trash, share, delete chat. The Undo calls the inverse mutation (restore, revoke, restore chat). The toast carries `{ label, action }` through the existing `sonner`/`UndoToast` component, one action only.
- Realtime freshness without a socket: refetch on window focus for lists; poll `UploadStatus` and a File page in `processing` every 2 s with backoff to 10 s, stop on `ready` or terminal failure; routine run completion and shares arrive through the existing notifications channel (`src/lib/notifications`) which triggers `invalidateQueries(libraryKeys.lists())`.

## 5. Page logic

### 5.1 Tabs
- Order: Suggested, All files, Shared. **Shared renders only if the viewer has at least one shared-in file** (`GET /library/files?tab=shared&limit=1` result cached; also drives the count-less tab). Landing on `?tab=shared` with none redirects to All.
- Trash is a ghost icon button at the far right of the header, not a tab.
- The storage label is fetched once (`storage()`) and shown beside the title on every tab, in search, and in loading/empty/error states.

### 5.2 Suggested
Server returns `{ recent, frequent, generated }`; the client applies the owner's display rules from `suggested.ts`:
- Recent: one row of cards, each says what last happened (Opened, Modified, Created, Shared + `agoShort`).
- Frequently used and Generated: compact tiles, at most three each, no file type on tiles, empty rows hidden, Frequently used skips any file already in Recent.
- "See all" for Frequently used is an open product item; render nothing for it.

### 5.3 All files and Shared
- Columns All files: Name, Access, Source, Created, Type. Shared: Name, Access, Date shared, Type.
- Only Name and Created (Date shared on Shared) sort. Headings always show an arrow; the Sort button does the same. Sort goes in the URL and to the API (`sort=name|created|shared`, `dir`).
- Filter panel has two sections only: Source (Uploaded, Generated, Shared) and File type (Images, Documents, Spreadsheets, PDFs, Audio). Nothing ticked = everything; ticking narrows. Selected values render as at most two chips beside the Filter button (then "+N"). Same panel on Shared.
- Name cell: type glyph, name, generated sparkle (generated only), unread dot (if `unread`), name goes semibold while unread.
- Access cell: owner avatar first, then up to one more avatar, then "+N", or the building avatar for workspace. Photo if the person has one, else initial. Tooltip from `accessTip` ("Owner: You. Shared with Maya and Sam").
- Row click opens the File page. Row `...` menu: Share, Rename, Download, Delete (red). Viewers see Rename/Share/Delete disabled with the tooltip. Menu is keyboard reachable and also opens on right click.
- Pagination: cursor, 50 rows/page, `@tanstack/react-virtual` (already a dependency) once a list passes ~200 rows. Row height fixed at 50px so virtualisation is trivial.
- Created shows date and time (`whenTime`).

### 5.4 Search
- A search pill with a scope chip: "In All files" (current tab) or "All of Library". Debounce 250 ms, min 2 chars, AbortController cancels the previous request. Results show a snippet (server returns highlight offsets, `highlightMatch.tsx` renders them). Empty and unavailable states exist (05 states table). Search is server side: names and extracted text. Never filter client-side across pages.

### 5.5 Trash
- Grey banner: "Empty Trash" action plus plain text with the space it frees (`freesBytes` from the API). Columns Name, Days left, Size, Deleted. Row menu: Restore, Delete forever. Both confirm only for delete forever and Empty Trash (`ConfirmModal`).

### 5.6 File page
- Header: title pill (type icon, chevron menu with File info), zoom, download, Share, close (returns to `from` tab or `/library`).
- Preview by format: `document` (page list with passage highlight), `sheet` (virtualised table, row highlight), `image`, `audio` (player + transcript lines, time highlight; clicking a line seeks). PDF render via existing `pdfjs-dist` dependency, lazy-loaded (`next/dynamic`, `ssr: false`) so it stays out of the Library page bundle.
- State banner by phase/life (uploading, processing, trashed with Restore, locked, gone). A `ready` file is the normal case; `processing` shows progress and polls.
- Provenance line: Uploaded in chat X / Generated in chat X / Run of Routine Y / Uploaded in Slack, each linking if the viewer can open the source.
- "Used in" lists chats and routines (only those the viewer can see; counts for the rest). "Who has access" lists the owner, people, workspace row with Remove (owner/Admin). File info card: Type, Updated, Created, Size, Your access.
- "Ask about this" starts or continues a chat with the file as scope: navigate to `/chat` with `?libraryFileId=` and let the chat page seed `scope`. Do not duplicate the composer on the File page; the dock is a link-styled input that hands off.
- Opening a file fires `POST /library/files/{id}/opened` once per session per file (idempotent) and clears unread.

## 6. Upload pipeline in the composer

Library has no upload UI. Everything is in `ChatInput` and the Slack/routine integrations. This is the largest behavioural change to existing code.

State machine per attachment (`useLibraryUpload`), replacing the local-only `PendingAttachment` flow in `use-file-upload.ts`:

```
selected -> validating(client) -> uploading(progress) -> processing -> ready
                 |                     |                   |
                 +----------------> failed(reason) <-------+     (failed is a message, not a card)
```

- `validating`: size and MIME against server-provided limits (`GET /library/limits`, cached) with the hard-coded `FILE_CONSTRAINTS` as the fallback. Duplicates are **allowed**.
- `uploading`: `POST /library/uploads` (multipart, `directUpload`), progress via `XMLHttpRequest` or `fetch` with a `ReadableStream` wrapper; abortable (Cancel on the card).
- `processing`: one **batch** poll `GET /library/uploads?ids=` for every in-flight upload through a single `refetchInterval` function (2 s for the first 10 polls, then 5 s, then 10 s, stop when all are terminal, no background polling). Per-file polling would exceed the 100 req/min `apiRateLimiter` with ten attachments.
- `failed`: remove the card, show one toast-like message above the composer, auto-clear after 6 s. The message never names the file. Reasons: `too_large`, `unsupported`, `password_protected`, `unsafe`, `unreadable`, `network`. Copy in `messages.ts`.
- Attachment card shows only the name and file type plus a status icon/word (Uploading 42%, Processing, Ready). Status is never colour alone.
- **Send is disabled until every attachment is `ready`** (and the tooltip says why). Switching away from a chat keeps the draft and its staged uploads (`drafts` keyed by chat id). Removing a card before send calls `DELETE /library/uploads/{id}`.
- On send, the chat request carries `libraryFileIds` (staged ids) instead of multipart files. The server promotes each file per the effective auto-save mode and returns `savedFileIds`; the client invalidates lists and shows "Saved to Library" with a View action only when something was saved. In `ask` mode the stream returns `ask_save` and the client shows `AskSaveDialog` for that message; the answer calls `POST /library/uploads/resolve`.
- Existing multipart send stays as a fallback while `LIBRARY_ENABLED` is off.

PRD edge cases for this pipeline (CAP-1, CAP-10, CAP-15, CAP-17):

1. **Uploads outlive the route.** The upload state machine lives in an external store (`lib/library/upload/store.ts`, `useSyncExternalStore` with per-upload selectors, writes coalesced to one rAF or 100 ms per item) hosted by a tiny `LibraryUploadHost` above the route group, not in `ChatInput` and not in a React context (high-frequency state in context re-renders every consumer), so navigating between chats, to Library or to Settings never cancels or restarts an in-flight upload. Drafts and their staged files are keyed by chat id and survive navigation. Only Cancel, Remove, or a workspace switch aborts.
2. **Connection drops.** On `offline` or a network error mid-upload the card shows "Upload paused. It will continue when you are back online." and resumes on `online` using the resumable upload protocol (04 section 4: chunked, resumable by upload id). A partial file never shows Ready and never enables Send. Manual Retry is also offered.
3. **Slow processing.** If `processing` lasts more than 10 minutes the card adds "This is taking longer than usual." with Remove; Send stays off; the server does one automatic retry; if it still fails the attachment is removed with the generic failure message. The client timer is informational only; the server decides failure.
4. **Remove before send.** Removing a card (or discarding the draft) calls `DELETE /library/uploads/{id}` immediately, which deletes the file and everything derived from it. Leaving the chat without sending keeps the draft; the server purges unsent staged files after 24 h (proposed, OQ-16). A purged draft file shows "This file was removed. Upload it again." when the person returns.
5. **Duplicates are separate files.** Two identical uploads (even by the same person) produce two rows. The client never says "already exists" and never queries by hash, so nothing can reveal that a colleague holds the same content. The duplicate-upload metric is computed server side.
6. **Undo after save.** After a send that saved files, "Saved to Library" with Undo for 10 s (proposed). Undo calls `POST /library/files/{id}/unsave` (server demotes to `chat_only`; the file stays attached to that message). After 10 s Undo disappears; the person deletes it like any file (Trash).
7. **Save fails after send.** The message always sends. If promotion fails the server reports `saveState: "retrying"` on the attachment; the client shows `SaveRetryNotice` ("Couldn't save to Library. Trying again."). After 3 automatic server retries the file shows `NotInLibraryBadge` and the notice gains **Save again** (`POST /library/files/{id}/save`). The chat keeps working with the file throughout.
8. **Auto-save is force-off.** The composer and Settings show "Your Admin has turned auto-save off". Files stay chat-only. A person's own `Always` choice is kept in their prefs but not applied.
9. **Ask each time.** One dialog per message ("Save 2 files to Library?", Save as default button). Dismissing the dialog equals "don't save" for that message and keeps the files chat-only; it never blocks the answer.
10. **Only file-like outputs auto-save.** Plain text answers and pasted text are never saved automatically (CAP-2). "Save this answer" is a Phase 2 snippet action; do not build a Phase 1 stand-in.
11. **Too many attachments.** The 10-per-message cap stays (`FILE_CONSTRAINTS`); beyond it the extra files are rejected with the existing toast. The cap on files in use in one chat is a server limit surfaced as `TooManyFilesNotice` (OQ-17).
12. **Send held while Processing.** A file chosen from Library that is itself still Processing cannot occur (only Ready files are in Library), so the PRD line "a file still Processing can be chosen" applies only to the composer's own attachments.
- Files dropped through `use-file-drop.ts` and pasted images go through the same hook.

Picker ("Add from Library"): the `+` menu has "Add photos & files" (native chooser -> pipeline above) and "Add from Library" (dialog). The picker uses `picker(p)` queries (ready + active + accessible only), supports search and a type chip row (All, PDFs, Documents, Sheets, Images, Audio, Run outputs), multi-select with a footer "N selected / Cancel / Add to chat". Picked files are attached by reference: `libraryFileIds` plus `source: "library"` so they are never re-uploaded or re-saved.

## 7. Locked, gone, and other access states

`GET /library/files/{id}` returns one of: the file; `403 {code: "file_locked", title: null}`; `404/410` (gone or trashed and not yours). The page renders `LockedState` (with Request access -> `POST /library/files/{id}/access-requests`, button becomes "Request sent") or `GoneState`. The locked response must not leak the title, owner or size.

## 8. Chat integration

- Citations: the SSE stream (`src/lib/agui`, `docs/api/SSE_EVENTS v2.md`) delivers citations as `{ fileId, locator: {type, value} }`. `src/lib/citations.ts` gains a Library resolver; the chip shows the name from a lightweight `GET /library/files/names?ids=` batch (cached). Locked or deleted entries render the PRD chip text.
- Sources panel: list from the turn's `sources` plus the chat `scope`; toggling a source off persists per chat (`PATCH /chats/{id}` field `libraryScope`).
- Delete chat dialog gains "Also delete these files" (default off) when the chat produced saved files.
- Slack and routines are mostly backend; the front end surfaces their results (Generated files, routine pane "skipped a file in Trash", attach picker on the routine editor in `schedules/`).

### 8b. PRD edge cases in the chat and answer surface (FIND, SHR, LIF, section 11)

1. **Citations are verified server side before display** (section 11). The client therefore never has to handle an unverified citation, but it must tolerate an answer whose claim lost its chip (render the text, no chip). Never synthesise a chip from text.
2. **Sources used.** Every answer that used Library files ends with `SourcesUsedList` (the cited files) in addition to inline chips. A chip shows the file's **current** name (citations store the file id; a renamed file shows its new name everywhere, FIND-23).
3. **Not in the files.** If the answer event carries `groundedness: "none"` render "I couldn't find this in your files." and, when the model gave a general answer, mark that part with `NotFromFilesMarker` so sourced and general statements are visibly separate.
4. **Access or deletion mid-chat.** The next message re-checks access server side. The stream returns `sourceEvents: [{fileId, state: "removed" | "locked"}]`; the client removes the file from the Sources panel, shows "This file is no longer available" (deleted) or locks old chips (access removed) with Request access, and leaves earlier answer text untouched. Earlier answers are never rewritten (LIF-8). No polling: the check happens on the next message and on File page focus.
5. **Revoked while open.** A File page or preview that is open when access is removed fails its next request with 403/404; the page swaps to `GoneState`/`LockedState` without a full reload and without exposing the title.
6. **Too many files in use.** On `files_truncated` render `TooManyFilesNotice` ("Too many files to read at once.") and indicate which best matches were used (proposed); the Sources panel marks the unused ones.
7. **Very large Library.** If the answer event includes `searchedCount`, show "Searched N files. Narrow with filters." as a quiet line. Never show counts of files the person cannot open.
8. **Search is down.** Web: "Search is unavailable right now. You can still browse and attach files by hand." with Try again; browsing and the picker keep working. It recovers by itself (retry with backoff, then on focus).
9. **AI reference off.** "Search my Library" shows disabled with "Your Admin has turned this off". If an Admin flips it during a chat, the next message simply stops automatic search and the chat shows a single inline note. Files attached by hand keep working.
10. **Agent-made files are not sources.** Outputs and run outputs are excluded from automatic retrieval until a person attaches them (no self-contamination, section 11). The picker and Sources panel still list them normally; attaching one by hand makes it usable.
11. **Actions that follow from reading a file.** Any side-effecting action (price change, email, ad spend, editing a live document, writing another file) arrives as an approval request that carries `sourceFile` (id and current name). `ApprovalCard` shows "Prompted by <file name>" and never auto-confirms. Library content is data, not commands.
12. **Ask about this** with a file whose access was just removed opens the chat with a locked state, not an error page.
13. **Slack channel results** appear in Library only as ordinary files (the front end has no Slack-specific list logic).

## 9. Settings logic

- Personal: auto-save select (Always, Ask each time, Never; disabled with explanation when force-off), "Let Souvenir use my Library" switch (disabled with "Your Admin has turned this off"), storage block, Leave workspace.
- Admin: default auto-save, force off, AI reference switch, max file size, allowed types, storage breakdown (Files, Images, Audio rows), Members table with Remove -> RemoveMemberDialog. Changes write an audit event server side; the Audit page is static.
- Saves are explicit per control (PATCH on change with optimistic UI and rollback), no big "Save" button, consistent with `settings/` pages.
- **Concurrent Admins.** Every settings response carries `version`, `updatedBy`, `updatedAt`. PATCH sends `If-Match: version`. The later write wins server side; if the response shows another Admin changed the same key meanwhile, show `ChangedByNotice` ("Changed by Priya just now") next to the control and refresh it to the winning value.
- **Failure.** "Couldn't save this setting. Nothing changed." with the previous value restored.
- **Members' notice.** When `settingsChangedAt` is newer than the member's last-seen value (kept in `localStorage`, wrapped in try/catch), show `SettingsChangedNotice` once with what changed (e.g. auto-save default, AI reference). Dismiss stores the timestamp.
- **Force-off.** Personal auto-save control disabled with "Your Admin has turned auto-save off"; the person's own value stays visible but inactive.
- **AI reference off.** "Use my Library" switch disabled with "Your Admin has turned this off".
- **Kill switches.** `GET /library/flags` returns `{ autoSave, aiUse, sharing, library }`; a false value renders `KillSwitchNotice` where the feature would be (Share action disabled with reason, composer saves nothing, AI note) and never hides stored files. `LIBRARY_ENABLED` false hides the whole feature and falls back to the legacy attach path without data loss.
- **Last Admin.** Members table and Leave disable removal of the only Admin with "Name another Admin first".
- **Import to Library (opt-in).** Settings, Library shows an Import card when `GET /library/import/preview` returns counts (past chat files, delivered routine outputs). `ImportToLibraryDialog` lets the person choose sources, shows counts, runs `POST /library/import` (resumable, progress via polling) and ends with a link to Library. Nothing is imported automatically; dismissing the card is remembered per user.

## 10. Cross-cutting

- **Feature flag:** `LIBRARY_ENABLED` in `src/lib/feature-flags.ts` (env driven like `PINS_ENABLED`); sidebar item, routes and composer integration all check it.
- **Analytics:** add one `FeatureName` per the repo rules (no new event, no free text): `library` with property enums only: `action` (`open_tab`, `open_file`, `search`, `filter`, `sort`, `share`, `revoke`, `trash`, `restore`, `delete_forever`, `empty_trash`, `rename`, `download`, `ask_about`, `pick_from_library`, `request_access`), `tab`, `format`, `source`, `scope`. Never log file names, titles, queries or emails. Update `docs/analytics/mixpanel-setup-notion.txt` first, then `events.ts`.
- **A11y:** the list is a real `<table>` (or `role="grid"` once virtualised) with sortable `aria-sort` headers; row actions reachable by Tab and menu key; dialogs trap focus (`use-focus-trap.ts` or Radix); live region announces upload status and toasts; unread, generated and status never rely on colour; all icon buttons labelled; reduced motion respected for the skeleton shimmer and sparkle.
- **Performance:** Library route budget goes into `perf-budget.json` (page JS, no `pdfjs` or chart code in the list route). Images use thumbnails from the API (`thumbnailUrl`), never full-size in lists. Rows are pure components keyed by id (React Compiler is on: no habitual `memo`/`useMemo`/`useCallback`; add one only with a measured reason). The Access cell avatars lazy-load. `/library` is a dynamic route, so `perf-budget.json` `pages` cannot hold it (the script fails "not prerendered"); it is budgeted by `scripts/perf-library.mjs` (07 section 9).
- **Time and locale:** display in the viewer's timezone (the prototype fixed UTC for demo only). Relative text (`Today`, `Yesterday`, `2d ago`) from `format.ts` with a single clock injection for tests.
- **Security:** treat file names as untrusted text (render as text, never HTML); previews of user HTML/SVG/markdown go through `isomorphic-dompurify` or are shown as text/sandboxed iframe; presigned URLs are fetched per view with short expiry, never cached in Query for more than their TTL; downloads use `Content-Disposition: attachment` from the API.
- **Errors and offline:** list error state has Retry; mutations that fail roll back and toast "Couldn't do that. Try again." with no stack or id; circuit-breaker open state reuses the existing banner.

## 10b. Additional screens and flows from the PRD

- **Delete routine dialog** (in `schedules/`): when the routine has run outputs it shows "Also delete its N run outputs" (unchecked by default; N from the dry run). Pinned outputs are not a Phase 1 concept.
- **Routine pane notes per run**, from `runInputs`: "<file> was deleted and skipped", "This routine lost access to <file>", "<file> is in Trash and was skipped". Output over limit: "Not saved: the file is over the size limit." Failed runs show their reason and create no file.
- **Search states** exactly as the PRD table: Searching (short indicator), Results (title, matched snippet, where it came from), No results ("No files match. Try other words or clear the filters." with Clear filters), Unavailable (copy in 8b item 8).
- **Deep links** to something the person cannot open: "You don't have access" with Request access, no title or metadata; deleted: "No longer available", no hint the file existed.
- **Attach limits** per routine and per share are server limits (OQ-17); surface the server's message, do not hard-code numbers.
- **Provenance and made-by** are read-only everywhere; there is no edit affordance.

## 11. Pure logic to unit test (vitest, no DOM)

PRD edge-case logic (each maps to an EC id in `01-product-rules.md` section 14): upload provider survives route changes (EC-15), offline pause and resume, 10-minute slow notice (EC-16), promotion retry and Save again (EC-17), unsave within 10 s, removing a staged file (EC-18), workspace switch resets keys and aborts requests (EC-39), settings concurrency notice (EC-25), force-off display (EC-26), last-Admin guard (EC-27), Sources panel reaction to `removed`/`locked` events (EC-20, EC-21), citation chip uses current name (EC-09), "No longer available" swap on revoke (EC-12), no count that includes hidden files, kill-switch states, duplicate upload never queries by hash (EC-01, EC-02); `caps`/`accessOf` matrix; `isInLibrary`/`citable`; `effectiveAutoSave`; suggested selection (skips Recent duplicates, max three, hides empty); sort comparator including unread; filter semantics (empty section = all); `accessTip`; `when`/`agoShort`/`whenTime` with injected clock; upload state machine transitions including cancel and fail; size formatting and total; share-resolution UI strings; optimistic update + rollback helpers; URL <-> filter state codec.

## 12. Open questions (log)

This doc depends on: OQ-2 (individuals without a workspace), OQ-5 (replace Settings > Files), OQ-7 (Import to Library), OQ-9 (not searchable / Retry OCR), OQ-10 (first-use notice), OQ-13 (audio transcription timing), OQ-14 (freshness notes), OQ-16 and OQ-17 (numbers and limits), OQ-18 (sharing kill switch), OQ-21 (file names in failure messages), OQ-22 (owner prototype items), OQ-23 (Office preview). Master log with assumptions: `05-delivery-plan-and-qa.md` section 8.
