# 09 Implementation status (2026-10-13)

What is built in `front-end`, how to run it, how it was checked, and what is deliberately not built yet. The Library backend does not exist yet, so everything runs on a typed in-memory mock behind two flags. Nothing here changes behaviour for anyone while the flags are off.

## Run it

```
NEXT_PUBLIC_ENABLE_LIBRARY=true NEXT_PUBLIC_LIBRARY_MOCK=true npx next dev -p 3000
# optional: NEXT_PUBLIC_LIBRARY_MOCK_ROWS=5000   (adds generated rows for performance checks)
# optional: NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN=https://<bucket-origin>   (CSP: connect-src and media-src, for the real API)
```

Pages: `/library`, `/library/trash`, `/library/files/<id>`, `/settings/library`, `/settings/workspace-library` (Admin), and the dev-only `/dev/library` (composer pieces and mock failure switches). Sample ids for the states: `f_lookbook` (locked), `nope` (gone), `f_return_2026` (PDF), `f_catalog` (1,200-row sheet), `f_call_acme` (audio with transcript, `?cite=time:2500`). In the mock, file names choose upload outcomes: "password", "virus", "corrupt", "slow", and `.exe` for an unsupported type.

## Built

| Area | What exists |
|---|---|
| Flags and wiring | `LIBRARY_ENABLED`, `LIBRARY_MOCK` (`lib/feature-flags.ts`); sidebar row and settings rows only when on; routes 404 when off; analytics feature `library` registered in `docs/analytics/mixpanel-setup-notion.txt` first; screens mapped in `lib/analytics/screens.ts`; CSP storage origin from env (`next.config.ts`) |
| Data layer (`lib/library`) | zod wire schemas, URL codec, key factory (workspace id in every key), React Query hooks (`queries.ts`), optimistic mutations with rollback (`mutations.ts`), one cache writer (`cache.ts`), error mapping (`errors.ts`), copy in one file (`messages.ts`), access rules, formatting, citations locators, safe URL checks, observability shim, analytics wrapper |
| API | `LibraryApi` interface; REST adapter (`api.real.ts`, zod-parsed, `ApiError("contract_error")` on drift); mock adapter with the same rules (private by default, Viewer-only grants, locked leaks nothing, Trash keeps shares, cursor bound to filters, uploads rejected or processed by file name) |
| Shared change | `ApiError` now carries `fieldErrors`, `requestId`, `retryable`, `retryAfterSeconds` (backward compatible); `buildApiError` and `apiFetchVoid` added to `lib/api/client.ts` |
| Library page | header, storage label, Suggested / All files / Shared tabs (Shared only when something is shared), search with scope chip, Filter (two sections, chips), Sort, Trash link, virtualised ARIA table (fixed 52 px rows, sort headings with `aria-sort`, whole-row real link, hover-warmed file chunks, scroll memory), Suggested cards and tiles, empty / loading / error / filtered-empty states, URL state with race-safe updates |
| File page | PDF (pdf.js, hashed worker, page canvases drawn when near the viewport), text pages, windowed sheets with row citations, image, audio with transcript and time citations, each in an error boundary; info card; locked, gone and Trash states; Share, Rename, Download, Delete; Ask-about link |
| Dialogs | `ui/dialog.tsx` (Radix, token styled), Rename (shared zod schema), Share (typeahead, ways in, remove), Delete with usage, Delete forever and Empty Trash (ConfirmModal) |
| Trash | breadcrumb, freed space, days left, Restore, Delete forever, Empty Trash |
| Settings | personal (auto-save, "let Souvenir use my Library", storage, one-time change notice); Admin (default, force-off, AI use, file size and types, storage, data-use text, "Changed by X just now"); leaver's locked transfer question. By owner decision (2026-10-14) the Library settings pages carry no Workspace/Leave section, no Members section and no Phase 2 (Audit log, Inventory) pages or nav entries. The member-removal API methods and hooks (`lib/library/members.ts`) remain but have no UI |
| Chat, composer and routine pieces (2026-10-14) | built against the 02/04 contract and shown only in `/dev/library` (live chat, `ChatInput` and Schedules unchanged): Library citation chips (open, audio time, locked with Request access, File deleted), Sources panel (`lib/library/sources.ts`), sent-file chips, Add from Library (optional flag-gated `ChatAddMenu` prop, not passed yet), Save files prompt, "Don't save files from this chat", Library-search-off note, AI-generated output card, delete chat with "Also delete these files", routine Attached files / unavailable warning / run outputs / run history, routine clarify and created cards. Code in `components/Library/chat` and `components/Library/routines` |
| Prototype parity pass (2026-10-14) | list: filters carry across tabs and are ignored while searching, container-query narrow layout, drop guard, Shared unread-first default, access avatar rules, prototype empty states and copy, mint sparkle with source tooltip, Suggested tile lines, grouped filter chips, PDF glyph, Trash "Deleted by", Admin-changed notice on the Library page. File page: Share stages people then Share, with Undo, a Remove confirm and the 60-second line; sentence-level citation highlight with "Cited …" labels; richer provenance and "Files this run used"; "Move to Trash" dialog; prototype toasts; Close returns to the list you came from; Request access remembered; Uploading/Processing progress; Ask box "+". New optional wire fields the backend should send: `trashedBy`, `generatedFrom`, `openCount`, `settingsChanges`, `provenance.by`, `canOpenChat`, `runLabel`, `runInputs`, plus server-side unread-first order on Shared |
| Upload system | pure state machine, external store, controller (3 parallel 8 MB parts straight to presigned URLs with no Authorization header, retries with backoff and jitter, re-presign on 403, offline pause and resume, one batch status poll, hidden-tab pause, abort on sign-out or workspace switch), `LibraryUploadHost` mounted lazily in the app layout, attachment cards, notices, picker dialog |

## How it was checked

- `npx tsc --noEmit` clean. ESLint on all new and changed files: 0 errors, 1 warning (React Compiler skips `FileTable` because TanStack Virtual's API cannot be memoised; expected).
- 140 unit tests in 14 files under `src/lib/library`, green in four time zones. The rest of the suite: 1,317 pass; 2 fail in `src/lib/api/plan.test.ts`, a **pre-existing** time-zone dependence (they pass with `TZ=UTC`; untouched by this work).
- Driven in a real browser (Playwright, Chromium) against the dev server on the mock: list, tabs, search, filters (including two quick ticks), sort, file page for every format, citations, locked and gone, rename, share and revoke, delete with usage, Undo, Trash, Restore, Empty Trash dialog, both settings pages, uploads (success, every failure, slow, offline pause and resume, 10 file cap, 6 second message clear), picker. No console errors from Library code. With 5,000 generated rows the table keeps at most about 32 row elements in the DOM, loads 50 rows per page on scroll, and scrolls at 60 fps (median and p95 16.7 ms) even in a dev build.
- 2026-10-14 parity pass: `tsc` clean, 180 unit tests in 17 files under `src/lib/library` green, ESLint 0 errors (same one expected warning). Not yet driven in a browser.
- Two real bugs were found this way and fixed: `Button asChild` crashes for every variant except the primary (use `LinkButton`); upload failure messages never cleared while other uploads re-rendered the composer.

## Deliberately not built (and why)

| Item | Why it waits |
|---|---|
| Wiring uploads and the picker into `ChatInput` and the chat send (`libraryFileIds`, `savedFileIds`, `ask_save`, Undo after save, save retries) | needs the backend upload and chat contract (04 sections 4 and 5b); changing the live chat send without it risks the main product. The building blocks are done and exercised in `/dev/library` |
| Putting citations, the Sources panel, `ApprovalCard` source file and delete-chat "Also delete these files" into the live chat (components are built, see above) | need the SSE additions (`sourceEvents`, `groundedness`, `files_truncated`) and a "files saved from this chat" list |
| Putting the routine pieces into Schedules (components are built, see above); delete routine with outputs | needs backend run outputs and run inputs |
| Import to Library dialog; kill-switch notices for auto-save and AI use (only the sharing switch is honoured); "Remove member" with the transfer question inside the existing Members page | need backend endpoints and the org service to start a removal |
| CI workflow, Playwright suite in the repo, axe, `perf-library` script and budgets, global `useReportWebVitals`, `global-error.tsx`, Sentry | shared tooling that does not exist in the repo yet (08 plan audit, SP-2 to SP-6); none was added to avoid touching unrelated features |
| shadcn `components.json` and the other primitives | only `ui/dialog.tsx` was needed; existing Dropdown, Tabs, Switch, Checkbox and Skeleton were reused instead of adding duplicates |

## Things to know

1. **Malformed ids return HTTP 200 with the not-found screen**, not 404, because the route segments have `loading.tsx` (streaming starts before `notFound()` runs). Harmless for an authenticated page; a true 404 would need removing both `loading.tsx` files.
2. **Backend asks that this build assumes** (all in 04 section 5b): batch `GET /library/uploads?ids=`, `POST /library/uploads/{id}/parts` (re-presign), thumbnails on list rows, windowed preview, `Prefs` carrying `effectiveAutoSave`, `forcedOff`, `aiReferenceAllowed`, `settingsChangedAt`, bucket CORS (PUT, GET, HEAD, expose ETag), `NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN` for the CSP.
3. People ids: the share typeahead uses the existing workspace members endpoint, so the grants endpoint must accept those same user ids.
4. The mock is a lazy chunk (dynamic import) and is deleted when the real contract passes; `NEXT_PUBLIC_LIBRARY_MOCK` is then removed.
