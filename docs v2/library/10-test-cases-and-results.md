# 10 Library: test cases and test log (2026-10-15)

Detailed test cases derived from the clickable prototype (`library-prototype/surfaces/library`: `page.md`, `flows.md`, and the Flow A to H checklists in `lib/data.ts`), run against the real Library feature in this `front-end` app. Every case below was run against the app, or marked NOT BUILT (checked in the UI, routes and code) or BLOCKED (cannot be reached here) with the reason; the result and the evidence are in the table of its area. Section 4 says what is done and what is missing.

## 1. What was tested, and how

| Item | Value |
|---|---|
| App under test | `front-end` (Next dev server, `http://localhost:3000`), sidebar entry **Library**, routes `/library`, `/library/files/<id>`, `/library/trash` |
| Backend | the shared dev backend (`devapi.getsouvenir.com`) through the app's `/api/backend` proxy. This is the **real** Library API, not the in-memory mock described in `09-implementation-status.md` (the mock and `/dev/library` no longer exist in this tree; the `NEXT_PUBLIC_LIBRARY_*` flags in `.env.local` are not read by the code any more) |
| Account | the test login from `.env.local` (`PROFILE_EMAIL` / `PROFILE_PASSWORD`; user "test 01", workspace `test01-workspace`). The password is not repeated here |
| Browser | Chromium driven by Playwright, 1440x900 unless the case says otherwise |
| Test data | The Library was empty. Because Library itself has no Upload button, 12 files were put in through the Library upload API (create upload, PUT to storage, complete): 4 PDFs (Return policy 2025 and 2026, Supplier contract Acme and Nova), 2 spreadsheets with the same name (Price list Q4, different content), a 1,200 row CSV (Catalog export), a PNG (Autumn window display), a WAV (Supplier call - Acme), a DOCX (Brand guidelines), a Markdown file and a text file. They mirror the prototype's sample files. Throw-away `scratch-*` files were created and removed by the destructive cases |
| Simulated states | Loading, empty, error, 401/403/404/500, offline and the 5,000-row list were produced by intercepting requests in the test browser only. Nothing was changed in the app or the backend |
| Not done on purpose | No source file, `.env*` file or backend code was changed. No commit or push. The Playwright scripts live in the session scratch folder (they are not in the repo) |

Case IDs: `NAV` navigation and header, `SUG` Suggested, `ALL` All files table, `SORT`, `FILT` filter, `Q` search, `FP` file page, `SH` sharing, `TR` delete and Trash, `ST` list states, `PF` performance, `A11` accessibility, `UP` uploads, `CH` chat, `RT` routines, `SL` Slack, `SET` and `AD` settings and admin, `REG` regression of other app areas.

### Result legend

| Result | Meaning |
|---|---|
| PASS | Built and behaves as the prototype or PRD says |
| PARTIAL | Built and works, but differs from the prototype in a way worth a decision (the note says how) |
| FAIL | Built, but wrong or broken |
| NOT BUILT | The feature is not in the app (checked in the UI, the routes and the code) |
| BLOCKED | Cannot be exercised in this environment (needs a second login, a Generated file source, Slack, etc.) |

## 2. Prototype coverage

The prototype checklist has 8 flows (A to H), 93 checks and 19 depth checks, plus 13 checks that apply to every flow. The cases below cover each of them or say why they cannot be covered; the matrix is in section 5.

## 3. Results at a glance

| Result | Cases |
|---|---|
| PASS | 113 |
| PARTIAL | 11 |
| FAIL | 15 |
| BLOCKED | 5 |
| NOT BUILT | 13 |
| **Total** | **157** |

| Area | PASS | PARTIAL | FAIL | BLOCKED | NOT BUILT | NOT RUN |
|---|---|---|---|---|---|---|
| Navigation and header | 6 | 1 |  |  |  |  |
| Suggested tab | 7 |  |  | 1 |  |  |
| All files table | 9 | 1 |  | 1 |  |  |
| Sort | 5 | 1 |  |  |  |  |
| Filter | 13 |  |  |  |  |  |
| Search | 10 | 1 |  |  |  |  |
| File page | 9 |  | 3 | 2 |  |  |
| File page previews | 5 |  | 3 |  |  |  |
| Sharing (owner side) | 7 |  | 1 | 1 |  |  |
| Delete and Trash | 10 | 1 |  |  | 1 |  |
| List states | 7 |  | 1 |  |  |  |
| Performance | 2 |  |  |  |  |  |
| Accessibility | 1 | 1 | 2 |  |  |  |
| Uploads | 4 |  | 4 |  |  |  |
| Chat integration |  | 1 |  |  | 6 |  |
| Routines |  |  |  |  | 1 |  |
| Slack |  |  |  |  | 1 |  |
| Settings and Admin | 1 |  |  |  | 4 |  |
| Regression: other app areas | 17 | 4 | 1 |  |  |  |

## 4. What is done and what is missing

### 4.1 Done (built and verified against the prototype)

| Area | What works |
|---|---|
| Entry and header | Sidebar Library entry, opens on Suggested, tabs Suggested and All files, storage label beside the title on every tab, search, Trash button, no Upload button or drop area, sign-in required, state kept in the URL with working Back/Forward |
| Suggested | Recent (5 cards, "Opened/Created today"), Frequently used ("Opened N times", never repeats Recent), empty rows hidden, card opens the file, Close returns, full name on hover, See all |
| All files table | Columns Name / Access / Source / Created / Type, newest first, owner avatar with "Only you", duplicates shown as two rows, whole-row link, row menu (Open, Ask about this, Share, Download, Rename, Delete), working Download (exact bytes), narrow-window column hiding |
| Sort and filter | Name and Created sort with arrows and `aria-sort`, Sort menu, URL kept; Filter panel with the two sections, every file-type filter returns the right files, widen/narrow rules, chips, Reset, "No files match" with Reset filters, ticks carry between tabs and are ignored during search, bad URL values fall back safely |
| Search | Turns the page into Search, snippets, finds words inside files, scope chip, "No files match / Try other words / Clear search", two-character minimum, race-safe typing, case-insensitive, HTML in the query is not executed, "Search is unavailable right now" state |
| File page | Layout and File info card, text, markdown, image, spreadsheet (including a windowed 1,200 row CSV) previews, exact-bytes Download, Rename (extension kept, blank/over-long/slash names refused, Cancel/Escape safe), HTML in a file name stays text, deep links and reload, Close returns to the list you came from, "No longer available" for unknown ids without leaking a name |
| Sharing (owner side) | Share dialog, whole-workspace grant, access list, confirm text for removing access (including the 60-second line), Undo, Copy link, unknown person refused, duplicate grant answered cleanly |
| Delete and Trash | Delete dialog with usage and the 30-day line, Cancel/Escape, Move to Trash, In Trash banner with days left and Restore, Trash screen layout (breadcrumb, "Frees up", columns, row menu), Restore (shares kept), Delete forever and Empty Trash with confirmation, empty Trash state |
| States | Loading skeletons, empty state with "Attach a file in a chat" and New chat, error state with Try again that recovers, unexpected backend shape handled, Trash error/empty, expired session sent to sign-in, 5,000-row list virtualised (about 30 DOM rows, pages load on scroll) |
| Upload API | Unsupported type, empty file and over-limit size refused at the start, cancel works, processing then ready, limits and storage endpoints return sensible data |
| Other app areas | Home chat, Agents, Schedules, Connectors, Settings (Account, Usage, Plans and Billing, AI, Help, Workspace General, Members, Activity, Plans, Report a bug, Feature request), sidebar and a streamed chat reply all load and work with no new errors |

### 4.2 Built but broken or different (needs a fix or a decision)

| # | Severity | Finding | Cases | Where the fix is |
|---|---|---|---|---|
| F1 | **High** | **The browser cannot reach the file storage.** The app's Content-Security-Policy allows only `devapi...`, Auth0 and a few others in `connect-src`, and only `'self' blob:` in `media-src`. `NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN` is not set in `.env.local` / `.env.development.local`, so `https://souvenirai-storage.s3.amazonaws.com` is blocked. Effects seen: PDF and Word previews show "This preview isn't available"; audio cannot load (readyState 0); "Ask about this" and the file-page Ask box say "Couldn't attach this file. Opening a new chat without it."; PDF page citations cannot render; **attaching a file in a normal chat and pressing Send no longer delivers the file**: the chip shows "Upload paused. It will continue when you are back online." and nothing reaches Library (chat Send now uploads through Library first, `hooks/use-streaming-chat.ts`). This is a regression of normal chat attachments, not only a Library gap | FP-03, FP-07, FP-08, FP-18, FP-19, FP-20, UP-07, UP-08, REG-22 | Front-end config: set the variable to the storage origin for every environment and rebuild (`next.config.ts` already reads it for both `connect-src` and `media-src`). Then re-test, because the bucket CORS (PUT, GET, HEAD, expose ETag) cannot be checked until the CSP lets the request out. Also worth fixing: the "Upload paused. It will continue when you are back online" message is wrong when the cause is a blocked request |
| F2 | **High** | **Identical content is stored once.** Uploading the same bytes twice, or under a second name, returns the first file's id; the later name is lost. The PRD and prototype say a duplicate is saved as a separate file with the same name | UP-01 | Backend (content de-duplication on upload). Front-end cannot fix it |
| F3 | Medium | **The Shared tab appears for the owner** after they share their own file with the workspace. The list endpoint `tab=shared` returns files the person owns and has shared out. The prototype shows Shared only for files shared with you | SH-03 | Backend filter (exclude owned files) or hide the tab in the front-end when every file is owned |
| F4 | Medium | **A corrupt PDF is accepted as Ready** and listed. The prototype says unreadable files never become a file | UP-04 | Backend content validation (it only validates type and size) |
| F5 | Medium | **Offline during a search leaves a blank white page** (the Next router falls back to a full navigation, the browser shows its own error page). Error and retry states work for failed requests, but not for a dropped connection | ST-06 | Front-end: search should not trigger a server navigation, or the route needs an offline-safe error boundary |
| F6 | Medium | **No phone layout.** At 375 px the sidebar stays open and Library gets about 45 px. This is the app shell, not Library, but Library inherits it | A11-04 | App shell (a Library-only fix is not possible) |
| F7 | Low | Accessibility details: focus is lost to the page body after the Share dialog closes with Escape (should return to the Share button); no visible focus ring on file links when tabbing; the sidebar Library link has no `aria-current`; Sort menu ticks are visual only | A11-02, A11-01, NAV-01, SORT-04 | Front-end |
| F8 | Low | Search is word-OR, not phrase: "net 30" also returns the Nova contract, the CSV, Return policy 2026 and a text file. The prototype expects the Acme files only | Q-03 | Backend ranking/matching |
| F9 | Low | Created shows minutes only, so the two "Price list Q4.xlsx" rows read the same time. The prototype relies on Created to tell duplicates apart | ALL-05 | Front-end (show seconds or a tooltip with the full time) |
| F10 | Low | Storage "used" still counts files that are in Trash (restoring returns it). Prototype figures are samples, so this needs a product decision | TR-11 | Product decision |
| F11 | Info | The Documents filter also returns Text files (.txt, .md); the Type column calls them "Text". File names show their extension ("Brand guidelines.docx") where the prototype's sample names have none | FILT-06 | Product decision |
| F12 | Info | `09-implementation-status.md` is out of date for this tree: the in-memory mock, `/dev/library`, `/settings/library`, `/settings/workspace-library` and the `NEXT_PUBLIC_LIBRARY_ENABLE/MOCK` flags no longer exist or are not read | SET-01, SET-02, CH-01 | Docs |
| F13 | Info | Console noise seen while testing chat attachments: React "unique key" warning in `AttachmentManager` and a hydration mismatch warning on the chat page | REG-22, UP-08 | Front-end |
| F14 | Info | Four Settings pages (Preferences, Security, Notifications, Files) are preview pages hidden by `SETTINGS_PREVIEW_ENABLED`. They answer 404 as intended, but the 404 shows as "Something went wrong" inside the Settings shell. Not a regression | REG-06, REG-07, REG-08, REG-19 | Optional polish |

### 4.3 Missing (not built in this app)

These parts of the prototype exist in code as components or API methods but are **not connected to any screen**, or have no code at all:

| Feature | Cases | State |
|---|---|---|
| "Add from Library" picker in the chat + menu | CH-01 | Component exists (`components/Library/picker`), not passed to the composer |
| Upload chip (Uploading, Processing, Ready) and Send held until Ready | CH-02 | Upload only starts at Send |
| Auto-save modes, "Save 1 file to Library?", "Don't save files from this chat", Library-search switch | CH-03, CH-07 | No setting; `/library/prefs` returns 404 on the backend |
| Citations, Sources panel, "File deleted" chips | CH-04 | Components exist, 0 imports outside the Library folder |
| Delete chat with "Also delete these files" | CH-05 | Component exists, not used |
| Chat outputs and routine run outputs saved to Library (Generated files, sparkle, "Run of ...") | CH-06, RT-01, SUG-07 | Nothing creates Generated files |
| Routines: attach files, run history, unavailable-file warning | RT-01 | Components exist, not used by Schedules |
| Slack: save, find, share by command, cited answers | SL-01 | None |
| Settings > Library and Admin > Library (auto-save default, force-off, AI reference, limits, storage, members and transfer question) | SET-01, SET-02, SET-04 | Routes return 404; only read-only limits and storage endpoints exist |
| Audit log and Inventory | AD-01 | Out of scope by owner decision |

### 4.4 Blocked (could not be tested here)

| Feature | Cases | Needed |
|---|---|---|
| Everything a second user sees: Shared tab with unread dot, viewer with controls turned off, locked page and Request access (only simulated, ST-08), unread dot clearing, Admin vs member views | ALL-10, FP-21, FP-22, SH-08 | A second signed-in user in the test workspace |
| Share with a named person | SH-08 | The workspace has no other member |
| Generated files and run outputs | SUG-07 | Needs the missing routine/chat output connection |


## 5. Prototype coverage matrix

Every check of the prototype checklist (`lib/data.ts`, Flow A to H plus the checks for every flow), the case IDs that exercise it, and the resulting status. When several cases cover one check the worst result is shown. Checks with no case have no test because the feature is not in the app or cannot be reached here; the reason is given.

### Flow A: Capture and reuse

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| A1 | Files from chats save to Library by default; change in Settings, Library | - | NOT BUILT | No auto-save setting or settings page (CH-03, SET-01) |
| A2 | Chip shows Uploading, Processing; Send held until Ready | CH-02, UP-06 | PARTIAL |  |
| A3 | Until sent the file is not in All files, picker or search; X deletes it | UP-08 | FAIL |  |
| A4 | Ask each time prompt "Save 1 file to Library?"; Never saves nothing | - | NOT BUILT | CH-03 |
| A5 | New row: your avatar, Uploaded, date; provenance "Uploaded by You" with chat link | ALL-03, ALL-04, FP-01 | PASS |  |
| A6 | Same file again saves a separate file with the same name | UP-01, UP-02, ALL-05 | FAIL |  |
| A7 | Failed, password, unsupported, unsafe uploads never become a file; message clears after 6 s | UP-03, UP-04, UP-05 | FAIL |  |
| A8 | Add from Library picker: search, type filter, list/grid, multi-select | - | NOT BUILT | CH-01 (PickerDialog is not connected to the composer) |
| A9 | Citation chip opens the file at the cited passage | FP-20, CH-04 | FAIL |  |
| A10 | Sources panel lists cited files; switch a source off | - | NOT BUILT | CH-04 |
| A11 | Recording: transcribing step, answer cites the time | FP-07, FP-20 | FAIL |  |
| A12 | No Upload button, tray or drop area; Sample files off outside a chat | NAV-04 | PASS |  |
| A13 | Search my Library switch off: "I couldn't find this in your files." | - | NOT BUILT | CH-07 |
| A14 | "Don't save files from this chat" | - | NOT BUILT | CH-03 |
| A15 | + menu: Add photos & files, Add from Library; .exe blocked, .zip unsupported | CH-01, UP-03 | NOT BUILT |  |
| A-d1 | Failed upload has no Retry/Delete, only a message | UP-04 | FAIL |  |
| A-d2 | Source switched off in Sources, then asked again | - | NOT BUILT | CH-04 |
| A-d3 | Removing a file while Uploading/Processing leaves nothing behind | UP-05 | PASS |  |

### Flow B: Set up a routine

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| B1 | Routine details card asks to attach Return policy and Shipping rates | - | NOT BUILT | RT-01 |
| B2 | Routine created card; Test run output in All files (Generated) | - | NOT BUILT | RT-01 |
| B3 | Routine pane lists attached files, add/remove | - | NOT BUILT | RT-01 |
| B4 | "All run outputs in Library" opens All files with Source: Generated | FILT-10 | NOT BUILT | RT-01 (the Source: Generated filter itself is covered by FILT-08, FILT-10) |
| B5 | Routines lists the new routine; hidden from Maya | - | BLOCKED | RT-01 and needs a second login |
| B6 | Run now saves "Draft product copy - <date>" with its input files | - | NOT BUILT | RT-01 |
| B-d1 | Not now: Attached files None | - | NOT BUILT | RT-01 |
| B-d2 | Create routine disabled until answered | - | NOT BUILT | RT-01 |

### Flow C: A routine run saves its output

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| C1 | New run output row, Generated, only your avatar; runs never removed | - | NOT BUILT | RT-01, SUG-07 |
| C2 | Message-only run stays in run history, not in Library | - | NOT BUILT | RT-01 |
| C3 | Failed run creates no file | - | NOT BUILT | RT-01 |
| C4 | Run output menu is the ordinary file menu; no Keep | ALL-07 | PASS |  |
| C5 | Deleted run output goes to Trash with days left; Restore | TR-03, TR-05 | PASS |  |
| C6 | As Maya/Sam no run output shows; File info says Private | - | BLOCKED | second login |
| C7 | Slack #ops posts "Weekly sales report is ready." | - | NOT BUILT | SL-01 |
| C8 | File info says which routine and run made it, with Files this run used | - | NOT BUILT | RT-01 |
| C9 | See all on Generated and the routine pane open All files with a Source chip | SUG-05, FILT-08 | PASS |  |
| C-d1 | Run now twice quickly = one run | - | NOT BUILT | RT-01 |
| C-d2 | Attached file in Trash: next run skips it | - | NOT BUILT | RT-01, TR-12 |

### Flow D: Ask in Slack

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| D1-D7 | Slack: cited answers, channel vs DM access, Request access, save from Slack, find | - | NOT BUILT | SL-01 (Library has no Slack behaviour in this front-end; the locked page is simulated in ST-08) |
| D-d1/2 | Attachment without "save" is not saved; unknown question gets a reply | - | NOT BUILT | SL-01 |

### Flow E: Share files

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| E1 | Share dialog adds people or whole workspace; "Teammates can use the files..." | SH-01, SH-02, SH-07 | PASS |  |
| E2 | "Who has access" lists each way, e.g. "Shared directly" | SH-02, SH-08 | BLOCKED |  |
| E3 | As Sam/Maya: Shared with unread dot; Share, Rename, Delete turned off | FP-22 | BLOCKED |  |
| E4 | Shared tab: flat list, unread and newest first, same Filter/Sort | ALL-10, SH-03 | FAIL |  |
| E5 | Direct and workspace both listed; Sam sees the file once | SH-08 | BLOCKED |  |
| E6 | Removing access warns that citations lock; Sam loses the file | SH-04 | PASS |  |
| E7 | Share by command in chat/Slack with Undo | SH-05 | NOT BUILT | The chat/Slack command is not built; Undo of a dialog share is covered by SH-05 |
| E8 | Unowned file / ambiguous name / unknown person replies | SH-07, SH-09 | PASS |  |
| E9 | Slack confirmation does not name files the channel cannot open | - | NOT BUILT | SL-01 |
| E10 | Admin can rename, share and delete a file Maya shared workspace-wide | - | BLOCKED | second login |
| E11 | Removing a direct grant when workspace also has it: still open through workspace | - | BLOCKED | needs a person grant (workspace has no second member) |
| E-d1 | Already has access: not offered / "can already open it" | SH-09 | PASS |  |
| E-d2 | Unread dot clears once opened | - | BLOCKED | second login |

### Flow F: Delete and restore

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| F1 | Delete dialog lists usage, 30-day window, "answers not rewritten" | TR-01 | PASS |  |
| F2 | Deleted file in Trash with days left; leaves search and picker; leaves Sam's Shared | TR-03, TR-12 | NOT BUILT |  |
| F3 | Restore brings back the file with its shares | TR-05, TR-06 | PASS |  |
| F4 | Delete chat asks "Also delete these files" | - | NOT BUILT | CH-05 |
| F5 | No Archive anywhere | ALL-07, NAV-02 | PASS |  |
| F6 | Return policy 2025 starts in Trash, private; restore to All files | TR-05 | PASS |  |
| F7 | Delete forever asks to confirm; file gone | TR-07 | PASS |  |
| F8 | Trash screen: breadcrumb, banner, Frees up, columns, menu; Empty Trash dialog | TR-04, TR-08, TR-09 | PASS |  |
| F9 | Link to a deleted file says "No longer available", never the name | TR-07, FP-16 | PASS |  |
| F10 | Chat delete notice with Undo | - | NOT BUILT | CH-05 |
| F11 | Trashed file no longer cited in chat answers | - | NOT BUILT | CH-04, TR-12 |
| F-d1/2 | Routine says unavailable; citation reads "File deleted" | - | NOT BUILT | RT-01, CH-04 |

### Flow G: Admin sets the switches

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| G1-G9 | Admin page rows, force-off, AI reference, Maya's view, member removal with transfer question | SET-03 | NOT BUILT | SET-01, SET-02, SET-04 (routes /settings/library and /settings/workspace-library do not exist; only the limits and storage endpoints exist, SET-03) |
| G-d1/2 | Removed member shown as Removed; Leave and "Name another Admin first" | - | NOT BUILT | SET-04 |

### Flow H: Browse and find in Library

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| H1 | Header: title, storage label, search, Trash button; no Upload | NAV-03, NAV-04 | PASS |  |
| H2 | Tabs Suggested, All files; Shared only when something shared; no Archived | NAV-02, SH-03 | FAIL |  |
| H3 | Recent: five cards, Opened/Modified/Shared + time; unread dot | SUG-01, SUG-02 | PASS |  |
| H4 | Frequently used up to three, "Opened N times", no repeat; Generated row | SUG-06, SUG-07, SUG-08 | BLOCKED |  |
| H5 | See all: Recent = nothing ticked; Generated = Source chip; Frequently has none | SUG-05 | PASS |  |
| H6 | Card opens file, Close returns; ... opens menu; names in full on hover | SUG-03, SUG-04 | PASS |  |
| H7 | Columns, Access avatars and tooltip, Source, Created date and time | ALL-01, ALL-02, ALL-03, ALL-04 | PASS |  |
| H8 | Sparkle on Generated files; unread dot after it | ALL-10 | BLOCKED |  |
| H9 | Only Name and Created sort; arrows; click twice reverses | SORT-01, SORT-02, SORT-03 | PASS |  |
| H10 | Sort button lists choices; ticked matches heading | SORT-04 | PARTIAL |  |
| H11 | Filter panel: two sections, icons, ticks | FILT-01 | PASS |  |
| H12 | Counts per filter option | FILT-02, FILT-03, FILT-04, FILT-05, FILT-06 | PASS |  |
| H13 | Widen within a section; narrow across sections | FILT-07, FILT-08 | PASS |  |
| H14 | Chips beside Filter, two at most, "3 picked"; X clears a section; Reset | FILT-09 | PASS |  |
| H15 | "No files match" with Reset filters | FILT-08, FILT-10 | PASS |  |
| H16 | Row menu: Open, Ask about this, Share, Download, Rename, Delete | ALL-07, ALL-09, FP-18 | FAIL |  |
| H17 | Viewer: Share, Rename, Delete turned off with tooltip | FP-22 | BLOCKED |  |
| H18 | Search turns the page into Search; snippets; finds words inside files; Trash excluded | Q-01, Q-02, Q-03, TR-03 | PARTIAL |  |
| H19 | Search scope chip; no match with Try other words and Clear search | Q-04, Q-06 | PASS |  |
| H20 | Shared tab columns and sort | ALL-10, SH-03 | FAIL |  |
| H21 | Trash screen without tabs/Filter/Sort/search | TR-04 | PASS |  |
| H22 | Loading, Empty, Error states; search unavailable | ST-01, ST-02, ST-03, ST-05, Q-11 | PASS |  |
| H23 | No upload; drag over Library does nothing | NAV-04 | PASS |  |
| H24 | Escape/outside click close menus; Tab reaches cards and buttons; Enter opens | ALL-08, FILT-11, A11-01, A11-02 | FAIL |  |
| H25 | Narrow window hides Source then Access; toolbar wraps | ALL-11, A11-04 | FAIL |  |
| H-d1 | Filter ticks carry between tabs; ignored while searching | FILT-13 | PASS |  |
| H-d2 | Tab-only sort falls back to the other | SORT-06 | PASS |  |
| H-d3 | Two files with the same name are two rows | ALL-05 | PARTIAL |  |
| H-d4 | Opening from Shared or a search result and closing returns there | Q-07, FP-17, SUG-03 | PASS |  |

### Checks that apply to every flow

| Check | What the prototype checks | Cases | Status | Note |
|---|---|---|---|---|
| X1 | Wording: File, Trash, Upload, Output; never Item, Shelf, Folder | NAV-07 | PASS |  |
| X2 | Owner / Viewer / no access; only Admin sees Admin pages | FP-21, FP-22 | BLOCKED |  |
| X3 | Every file state has a designed look | TR-03, ST-08, FP-16 | PASS |  |
| X4 | Lists have loading, empty and error states | ST-01, ST-02, ST-03, ST-05 | PASS |  |
| X5 | Status is not colour alone (word or icon) | A11-03 | PASS |  |
| X6 | Suggested, All files, Shared; Trash as a screen; run outputs as files | NAV-02, TR-04 | PASS |  |
| X7 | Search clears when leaving Library, stays after opening a file | Q-07, Q-08 | PASS |  |
| X8 | Recent card wording ("Opened 1d ago", "Opened 6 times") | SUG-01, SUG-06 | PASS |  |
| X9 | Generated sparkle and Access column; unread dot beside the name | ALL-03, ALL-10 | BLOCKED |  |
| X10 | Filter and Sort icon buttons; arrows; chips; Reset | SORT-01, FILT-09 | PASS |  |
| X11 | "N used" beside the title on every tab | NAV-03, TR-11 | PARTIAL |  |
| X12 | File icons without a box; switches without On/Off word | ALL-04 | PARTIAL | visual only, judged on screenshots: icons are in tinted rounded squares in lists (the prototype says no box) |
| X13 | Library has no Upload button and no drop area | NAV-04 | PASS |  |

Coverage totals (checks, not cases): NOT BUILT 33, PARTIAL 6, FAIL 12, PASS 44, BLOCKED 13.

## 6. Test cases and results

Each row: the case, where it comes from in the prototype, what was done, what should happen, and what actually happened. "Notes" holds the evidence when a case is not a clean PASS (and the measured values for some PASSes). Failure screenshots are not stored in the repo; they were kept in the test run folder.

### Navigation and header

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| NAV-01 | Library entry in the sidebar opens /library | Flow H step 1; page.md "What the page does" | Open the app home. Click "Library" in the left sidebar. | URL becomes /library; the sidebar row is marked as the current page; page heading reads "Library". | PARTIAL | Library opens, but the sidebar link has no aria-current marker |
| NAV-02 | Library opens on Suggested, tabs are Suggested and All files only | Flow H check 2; page.md "Library opens on Suggested" | Open /library with no query string. Read the tab list. | Suggested is the selected tab. Tabs: Suggested, All files. No Shared tab while nothing is shared with you. No Archived tab. | PASS |  |
| NAV-03 | Header: title, storage label beside the title, search, Trash button | Flow H check 1; page.md "1.93 GB used stays beside the title on every… | On Suggested, then All files, read the header. | Title "Library" with a "<size> used" label beside it on both tabs; a search box; a Trash icon button/link at the right end. On All files the Filter and Sort icon buttons come first. | PASS |  |
| NAV-04 | No Upload button, no uploads tray, no drop area; a dragged file does nothing | Flow H check 23; A check 12; flows.md section 0 row 19 | On All files look for any Upload control. Dispatch dragover and drop events carrying a file onto the page and watch network traffic. | No control named Upload, no file input in the page, no POST to /library/uploads after the drop, no drop overlay. | PASS |  |
| NAV-05 | Tab and query state live in the URL; reload and back/forward keep them | implementation status "URL state with race-safe updates" | Click All files, reload, click Suggested, use browser Back then Forward. | ?tab=all appears and survives reload; Back returns to the previous tab; Forward returns to the next. | PASS |  |
| NAV-06 | Signed-out visitor is sent to login | security baseline (not in prototype) | In a fresh browser with no session, open /library and /library/files/<id>. | Redirect to /auth/login with returnTo; no Library data is shown. | PASS |  |
| NAV-07 | Wording: only File, Trash, Output, Run output; never Item, Shelf, Folder, Collection | every-flow check 1; flows.md section 7 | Read all visible copy on Suggested, All files, a File page, Trash. | None of the banned words appear in Library copy. | PASS |  |

### Suggested tab

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| SUG-01 | Recent shows up to five cards, newest activity first, each with an action and time | Flow H check 3; every-flow check 8 | Open Suggested. Read the Recent row. | At most 5 cards; each reads Opened / Modified / Created / Shared plus a short time (e.g. "Opened today"). The most recently touched file is first. | PASS | 6 cards: Brand guidelines.docx \| Opened today |
| SUG-02 | Opening a file moves it to the front of Recent as "Opened" | Flow H check 3; implementation "markOpened" | Open the file page of Return policy 2025, close it, return to Suggested. | Return policy 2025.pdf is the first card and reads "Opened ...". | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/0910cd17deb94] |
| SUG-03 | A card opens its file; Close returns to Suggested | Flow H check 6; depth 4 | Click the first card. On the file page press the X at top right. | File page opens; after closing the URL is /library and Suggested is selected. | PASS |  |
| SUG-04 | Full file names are available on hover or via tooltip when cut off | Flow H check 6 | Hover a card with a long name ("Product copy draft - Autumn.md"). | A tooltip or title attribute shows the whole name. | PASS |  |
| SUG-05 | Recent "See all" opens All files with nothing ticked | Flow H check 5 | Press See all beside Recent. | All files opens, no filter chips, full list. | PASS |  |
| SUG-06 | Frequently used: up to three files, "Opened N times", never repeats a Recent card | Flow H check 4; every-flow check 8 | Open Return policy 2026 six times (POST /opened). Open 5 other files so they take the Recent slots. Read Frequently used. | A "Frequently used" row lists Return policy 2026 reading "Opened 6 times"; none of its files is also a Recent card. | PASS | Opened 13 times |
| SUG-07 | Generated row (chat and routine outputs) with sparkle and "Run of <date>" | Flow H check 4, 8; Flow B/C | Create a Generated file by running a routine or chat output; open Suggested. | A Generated row of up to 3 files reading "Run of <date>". | BLOCKED | Cannot create a Generated file: Routines and chat outputs are not connected to Library in this build (no Library UI in Schedules or chat). Empty Generated row correctly stays hidden (see SUG-01 text). |
| SUG-08 | Empty rows are hidden: no Generated heading when there are no generated files | page.md "empty rows hidden" | Open Suggested with no Generated files. | No "Generated" heading and no empty placeholder tiles. | PASS |  |

### All files table

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| ALL-01 | Columns: Name, Access, Source, Created, Type, Actions (no Made by, no Archived) | Flow H check 7; flows.md section 0 rows 15, 20 | Open All files and read the column headings. | Exactly Name, Access, Source, Created, Type and a row-actions column. | PASS |  |
| ALL-02 | All seeded files are listed, newest first by default | Flow H check 7 "newest first to start" | Open All files. Compare the row order with Created times from the API. | 12 rows, ordered by Created descending. | PASS |  |
| ALL-03 | Access shows only the owner avatar for a private file, with a "Only you" label | Flow H check 7; Flow A check 5 | Read the Access cell of any row and hover it. | One avatar; accessible name / tooltip "Only you". | PASS |  |
| ALL-04 | Source reads Uploaded; Created shows date and time; Type reads the file kind | Flow H check 7; Flow A check 5 | Read Source, Created and Type for each seeded file. | Source "Uploaded". Created like "Today, 4:19 PM". Types: PDF, Spreadsheet, Image, Audio, Document, Text. | PASS |  |
| ALL-05 | Two files with the same name are two separate rows with different Created times | Flow A check 6; flows.md section 1 row 8; Flow H depth 3 | Look for the two "Price list Q4.xlsx" rows (also in search). | Two rows, two different ids, different Created times. | PARTIAL | Two separate rows, but both show the same Created text (Today, 4:16 PM) because the list shows minutes only; the prototype relies on Created to tell duplicates apart |
| ALL-06 | Whole row is a link: click, and Enter on the name, open the File page | implementation "whole-row real link"; Flow H check 24 | Click the middle of a row (not on the name). Go back, focus a name link and press Enter. | The File page opens both ways, at /library/files/<id>. | PASS |  |
| ALL-07 | Row menu has Open, Ask about this, Share, Download, Rename, Delete | Flow H check 16; Flow C check 4 | Open the ... menu on a row. | Items in order: Open, Ask about this, Share, Download, Rename, Delete (Delete in red). No Keep, no Archive. | PASS |  |
| ALL-08 | Row menu closes on Escape and on outside click | Flow H check 24 | Open a row menu, press Escape. Open again, click the page background. | Menu closes both times; focus returns to the ... button after Escape. | PASS |  |
| ALL-09 | Row menu Open and Share work; Download triggers a real file download | Flow H check 16 | Row menu > Open. Back. Row menu > Share. Row menu > Download. | Open navigates to the file; Share opens the Share dialog; Download starts a browser download with the right file name and size. | PASS |  |
| ALL-10 | Sparkle after the name marks Generated files; unread dot marks files shared with you | Flow H check 8; every-flow check 9 | Find a Generated file and a file shared with you but not yet opened. | Soft-mint sparkle after the name of Generated files; unread dot beside the name of unopened shared files. | BLOCKED | Needs a Generated file (no routine/chat-output path in this build) and a second user to share a file with this one (only one test login in .env.local). Not demonstrable in this environment. |
| ALL-11 | Narrow window hides Source first, then Access; toolbar wraps without overlap | Flow H check 25 | Resize to 1100, 900, 700, 500 px wide. | Source column disappears first, then Access; Filter/Sort/search/Trash never overlap; no horizontal page scroll. | PASS | 1440px: Name/Access/Source/Created/Type/Actions ; 1100px: Name/Access/Created/Type/Actions ; 900px: Name/Created/Type/Actions ; 700px: Name/Created/Type/Actions ; 500px: Name/Created/Type/Actions |

### Sort

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| SORT-01 | Only Name and Created sort; each heading shows an arrow; Access/Source/Type are plain | Flow H check 9; every-flow check 10 | Inspect the column headings. | Name and Created are buttons ("Sort by ..."); Access, Source, Type are not interactive. | PASS |  |
| SORT-02 | Click Name: A to Z, click again: Z to A; aria-sort follows | Flow H check 9 | Click the Name heading twice. | Rows alphabetical ascending, then descending; aria-sort ascending/descending on Name. | PASS |  |
| SORT-03 | Click Created: oldest first, then newest first | Flow H check 9 | Click the Created heading (starts newest first). | First click: oldest first (ascending); second click: newest first. | PASS |  |
| SORT-04 | Sort button lists Name and Created with Newest/Oldest first or A to Z/Z to A; current choice ticked | Flow H check 10 | Open the Sort icon button on All files; choose Name, then Created. | Menu shows Sort by: Name, Created and the direction labels for the chosen field; the active one is marked; choosing matches the heading. | PARTIAL | Menu works; no menuitem exposes a checked state to assistive tech (visual tick only) |
| SORT-05 | Sort choice is kept in the URL and survives reload | implementation "URL state" | Sort by Name, reload. | URL carries sort=name&dir=asc and the page re-renders in that order. | PASS |  |
| SORT-06 | A tab-only sort falls back safely (Date shared on All files → Created) | Flow H depth 2 | Open /library?tab=all&sort=shared&dir=desc. | No error; list shows newest first by Created. | PASS |  |

### Filter

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| FILT-01 | Filter panel: Source (Uploaded, Generated, Shared) and File type (Images, Documents, Spreadsheets, PDFs, Audio) | Flow H check 11; flows.md section 0 row 17 | Open the Filter icon button. | Two labelled sections with exactly those options, each with an icon. Nothing ticked by default. | PASS |  |
| FILT-02 | Ticking Images narrows the list to one image | Flow H check 12 | Open Filter, tick Images. | Only 1 row(s): Autumn window display.png. URL gains type=images. A removable chip "Images" appears and Filter reads "on". | PASS |  |
| FILT-03 | Ticking Spreadsheets narrows the list to two xlsx + one csv | Flow H check 12 | Open Filter, tick Spreadsheets. | Only 3 row(s): Price list Q4.xlsx, Catalog export.csv. URL gains type=spreadsheets. A removable chip "Spreadsheets" appears and Filter reads "on". | PASS |  |
| FILT-04 | Ticking PDFs narrows the list to four PDFs | Flow H check 12 | Open Filter, tick PDFs. | Only 4 row(s): Supplier contract - Nova.pdf, Supplier contract - Acme.pdf, Return policy 2026.pdf, Return policy 2025.pdf. URL gains type=pdfs. A removable chip "PDFs" appears and Filter reads "on". | PASS |  |
| FILT-05 | Ticking Audio narrows the list to one audio file | Flow H check 12 | Open Filter, tick Audio. | Only 1 row(s): Supplier call - Acme.wav. URL gains type=audio. A removable chip "Audio" appears and Filter reads "on". | PASS |  |
| FILT-06 | Ticking Documents narrows the list to the .docx plus the two text files (the Documents filter also covers Text) | Flow H check 12 | Open Filter, tick Documents. | Only 3 row(s): Brand guidelines.docx, Product copy draft - Autumn.md, qa-seed-return-policy.txt. URL gains type=documents. A removable chip "Documents" appears and Filter reads "on". | PASS |  |
| FILT-07 | Two options in the same section widen the list (PDFs + Audio = 5) | Flow H check 13 | Tick PDFs, then Audio. | 5 rows. One chip listing both names. | PASS |  |
| FILT-08 | One option in each section narrows (Uploaded + PDFs = 4; Generated + PDFs = no match) | Flow H check 13, 15 | Tick Uploaded and PDFs; then untick Uploaded and tick Generated. | Uploaded+PDFs = 4 rows. Generated+PDFs = "No files match" with a "Reset filters" button. | PASS |  |
| FILT-09 | Chip X clears its section; Reset clears every tick; at most two chips ("3 picked") | Flow H check 14 | Tick Images, Documents, PDFs and Uploaded. Click a chip X; then Reset in the panel. | Chips: File type "3 picked" and Source "Uploaded" (two at most). X removes that section; Reset removes all. | PASS |  |
| FILT-10 | Filter options with Source = Shared / Generated show empty state, not an error | Flow H check 15 | Tick Shared (nothing is shared with this account). | "No files match" with Reset filters; Reset restores the table. | PASS |  |
| FILT-11 | Escape and an outside click close the Filter panel | Flow H check 24 | Open Filter, press Escape; open again, click outside. | Panel closes both times. | PASS |  |
| FILT-12 | Tampered query values fall back safely (?type=evil, ?tab=bogus, ?sort=zzz) | robustness (not in prototype) | Open /library?tab=bogus&type=evil,<script>&sort=zzz&dir=sideways. | No crash or error screen; page behaves as defaults; nothing injected into the DOM. | PASS |  |
| FILT-13 | Filter ticks carry between All files and Shared and are ignored while searching | Flow H depth 1 | Tick Images on All files, search for "return", then clear the search. | While searching, the image filter is ignored (Return policy files appear); after clearing, the filter applies again. | PASS |  |

### Search

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| Q-01 | Typing turns the page into Search: no tabs, Filter or Sort; storage label and Trash stay | Flow H check 18 | On All files type "return" in the search box. | Heading reads Search; tabs, Filter and Sort buttons are gone; "<size> used" and the Trash button remain; URL gains q=return. | PASS |  |
| Q-02 | Results show a snippet of the matching text, and find words inside files | Flow H check 18 ("net 30 finds the contract") | Search "payment terms". | Supplier contract - Acme.pdf and - Nova.pdf are listed (their text, not names, contain the words) each with a snippet. | PASS |  |
| Q-03 | Search "net 30" finds the Acme contract (precision check) | Flow H check 18 | Search "net 30". | Supplier contract - Acme.pdf listed. Ideally only files that contain the phrase. | PARTIAL | Acme is found, but the search is word-OR not phrase: 4 unrelated files also match (Catalog export.csv \| Supplier contract - Nova.pdf \| Return policy 2026.pdf \| qa-seed-return-policy.txt). Prototype expects "net 30" to find the Acme files only. |
| Q-04 | No match: "No files match" with "Try other words" and Clear search | Flow H check 19 | Search "zzqxv". | Empty state titled "No files match", line "Try other words", Clear search button that brings back the tab. | PASS |  |
| Q-05 | Search starts at two characters; one character searches nothing | implementation MIN_SEARCH_LENGTH | Type "r" only. | The page stays on the normal tab (no Search mode, no results request). | PASS |  |
| Q-06 | Scope chip: "In All files" / "All of Library" switches scope and updates the URL | Flow H check 19; flows.md section 0 row 6 | Search "return"; use the scope chips. | Two scope choices; picking All of Library adds scope=all to the URL; results are the same or wider. | PASS |  |
| Q-07 | Opening a result and closing it returns to the same search results | Flow H depth 4; every-flow check 7 | Search "return", open a result, press Close. | Back on /library?...q=return with the search box still filled. | PASS |  |
| Q-08 | Search clears when you leave Library and come back from the sidebar | every-flow check 7 | Search "return", click Agents in the sidebar, then Library. | Library opens with an empty search box on Suggested. | PASS |  |
| Q-09 | Search text is shown as text (no HTML execution) and an over-long query is handled | security baseline | Search for <img src=x onerror=window.__pwn=1>, then a 400-character string. | No script runs, no <img> is injected from the query, no crash; URL q is capped at 200 chars. | PASS |  |
| Q-10 | Search is case-insensitive and rapid typing ends on the results for the final text | implementation "race-safe updates" | Type "RETURN" (caps). Then type "acme" and immediately replace it with "nova". | Return-policy files for RETURN; final list reflects "nova" (Nova contract) with no Acme leftovers. | PASS |  |
| Q-11 | Search unavailable (backend 500) shows "Search is unavailable right now" | Flow H check 22; flows.md section 1 row 19 | Make the search request fail, then search. | Title "Search is unavailable right now" with "You can still browse and attach files by hand"; no raw error text. | PASS |  |

### File page

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| FP-01 | File page layout: title, type line, preview, header actions, File info card | page.md "File page"; implementation "File page" | Open Supplier contract - Acme.pdf. | Title, "PDF · .pdf", preview; header: file actions menu, Download, Share, File info toggle, Close. File info: name + pencil, "Library / All files", "Uploaded by You", Type, Owner, Created, Size, Used in, Who has access, Manage access, Ask about this, Download… | PASS |  |
| FP-02 | File info card can be hidden and shown; its X closes only the card | implementation "info card" | Press the File info toggle, then its X in the card. | Card hides and shows; the file page stays open. | PASS |  |
| FP-11 | Download from the file page saves the exact bytes | page.md "Download" | Press Download in the header and in the info card. | Browser downloads the file with its name; byte size equals the Size shown. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/7c9eacf7b7274] |
| FP-12 | Rename dialog: prefilled without the extension, "The file type stays .ext", Save updates title everywhere | Flow H check 16 (Rename); page.md "Rename" | On a scratch file press the pencil; change the name; Save. Check the list. | Dialog "Rename file" shows the name without extension and the note "The file type stays .txt". After Save the page title, info card, browser tab and All files row show the new name with .txt kept; toast "Renamed". | PASS |  |
| FP-13 | Rename validation: empty, whitespace-only, too long, and path characters | implementation "Rename (shared zod schema)" | Try empty, spaces only, 300 characters, and "a/b\c". | Empty/whitespace blocked (Save disabled or inline error); over-long blocked or trimmed with a message; no request sent for invalid input; slashes handled safely. | PASS | empty: blocked; spaces: blocked; 300 chars: blocked; slashes: blocked; PATCH requests: 1 |
| FP-14 | A file named with HTML is shown as text everywhere (no markup injected) | security baseline | Rename a scratch file to <img src=x onerror=window.__pwn2=1>. Open list, search and file page. | The characters appear literally; no script runs. | PASS |  |
| FP-15 | Cancel and Escape leave the name unchanged | dialog rules (flows.md section 7) | Open Rename, type something, Cancel; again and press Escape. | Name unchanged; no PATCH request. | PASS |  |
| FP-16 | A file id that does not exist shows "No longer available" with no file name | Flow F check 9; flows.md section 2 rules | Open /library/files/<random uuid> and /library/files/not-a-uuid. | Page "No longer available" / "This page doesn't exist or isn't available to you." and a Back to Library button; nothing about any file name. | PASS |  |
| FP-17 | Deep link survives a reload; Back from a file returns to the list it came from | implementation "Close returns to the list you came from" | Open All files sorted by Name, open a file, reload, then Close. | File page reloads at the same URL; Close returns to /library?tab=all&sort=name... | PASS |  |
| FP-18 | "Ask about this" opens a new chat with the file attached | Flow H check 16 (Ask about this opens a new chat with the file attach… | Press Ask about this on a file page. | A new chat opens with the file attached as a chip in the composer. | FAIL | file not attached in the new chat. URL http://localhost:3000/chat. Toast: "Couldn't attach this file. Opening a new chat without it." (storage fetch blocked by the Content-Security-Policy, same cause as FP-03) [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| FP-19 | The "Ask about this file" box on the file page starts a chat about the file | implementation "Ask box +" | Type a question in the box under the preview and send. | A chat opens with the file attached and the question sent. | FAIL | question not in the chat. URL http://localhost:3000/chat. Toast: "Couldn't attach this file. Opening a new chat without it." (same cause as FP-18) [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| FP-20 | Citation locators in the URL: ?cite=page:1 / row:5 / time:2000 open the file at that spot | Flow A check 9; page.md "Citations ... open the file with the passage… | Open the audio file with ?cite=time:2000, the CSV with ?cite=row:5, the PDF with ?cite=page:1. | Audio is positioned near 2 s; the CSV scrolls to and highlights row 5; PDF shows page 1 with a "Cited" label. | FAIL | audio currentTime=0.0; csv "Cited" labels=1; pdf could not render (storage CSP, see FP-03), page citation untestable [console: Loading media from  'https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/189b3d4a518d46] |
| FP-21 | Locked file ("You don't have access") with Request access, as a user with no access | Flow D check 4; Flow E | As a second user, open a private file of the owner. | Locked panel with Request access button turning to "Request sent"; no title leaked. | BLOCKED | Needs a second login. .env.local only has one account (PROFILE_EMAIL). Not testable here. |
| FP-22 | Viewer (shared) sees Share, Rename, Delete turned off with "Only the owner can change this" | Flow E check 3; Flow H check 17 | As a viewer, open a file shared with you. | Share, Rename, Delete disabled with the tooltip. | BLOCKED | Needs a second login. The owner-side of sharing is covered in SH-xx. |

### File page previews

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| FP-03 | Preview renders for PDF | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Supplier contract - Acme.pdf. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | FAIL | preview shows "This preview isn't available" with Try again / Download \| cause: browser blocks the storage origin (Content-Security-Policy connect-src lacks https://souvenirai-storage.s3.amazonaws.com; NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN is not set) [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/1c6422649e8e… |
| FP-04 | Preview renders for Spreadsheet (xlsx) | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Price list Q4.xlsx. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | PASS |  |
| FP-05 | Preview renders for Spreadsheet (csv, 1,200 rows, windowed) | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Catalog export.csv. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | PASS | 100 of 1,200 rows in the DOM |
| FP-06 | Preview renders for Image | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Autumn window display.png. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | PASS |  |
| FP-07 | Preview renders for Audio | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Supplier call - Acme.wav. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | FAIL | audio element has a source but cannot load it (readyState 0, error code 4) \| cause: Content-Security-Policy media-src is only self and blob:, it does not allow the storage origin \| cause: browser blocks the storage origin (Content-Security-Policy connect-src lacks https://souvenirai-storage.s3.amazonaws.com; NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN is not set) [console: Loading me… |
| FP-08 | Preview renders for Word document | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Brand guidelines.docx. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | FAIL | preview shows "This preview isn't available" with Try again / Download \| cause: browser blocks the storage origin (Content-Security-Policy connect-src lacks https://souvenirai-storage.s3.amazonaws.com; NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN is not set) [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e950… |
| FP-09 | Preview renders for Markdown/text | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open Product copy draft - Autumn.md. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | PASS |  |
| FP-10 | Preview renders for Plain text | implementation "File page: PDF, text, sheets, image, audio"; page.md … | Open qa-seed-return-policy.txt. | The real content is shown (not the "Couldn't load the preview" error or an empty box). | PASS |  |

### Sharing (owner side)

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| SH-01 | Share dialog: title, field, helper line, Who has access, Copy link, Done | Flow E check 1, 2 | Press Share on a file page. | Dialog "Share <name>": combobox "Add people or the whole workspace", line "Teammates can use shared files in their chats and routines.", Who has access listing "You Owner", Copy link, Done, Close. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| SH-02 | Whole workspace can be added; "Who has access" lists it as "Whole workspace"; backend agrees | Flow E steps 4; check 2, 5 | On a scratch file: Share > pick "Whole workspace" > Share. | Toast "Shared with everyone"; access list gains "Whole workspace"; GET /access returns a workspace grant. | PASS |  |
| SH-03 | List shows workspace-shared files with a workspace Access marker; owner gets no Shared tab | Flow H check 7 (lilac building circle); flows.md section 0 row 20 | After SH-02 open All files; check the Access cell of the scratch file and the tab bar. | Access cell reads a whole-workspace marker (building icon / "Whole workspace" label) instead of "Only you". Shared tab does not appear (nothing shared WITH you). | FAIL | Shared tab appeared for the owner: Suggested, All files, Shared |
| SH-04 | Removing workspace access asks to confirm (names the consequences), then removes it | Flow E check 6; flows.md section 1 row 12 | In Who has access press Remove on Whole workspace; read the confirm; confirm. | Confirm text says they lose the file now, answers already received stay but citations lock, and Souvenir stops using it within 60 seconds. After confirming the access list is owner-only (also on the backend). | PASS |  |
| SH-05 | Undo in the toast reverses a share | Flow E check 7 (Undo) | Share a scratch file with the whole workspace, press Undo in the toast. | Toast "Sharing undone"; backend has no workspace grant. | PASS |  |
| SH-06 | Copy link puts the file URL on the clipboard | implementation "Share dialog ... Copy link" | Press Copy link in the Share dialog. | Clipboard holds <origin>/library/files/<id>; toast "Link copied". | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| SH-07 | Typeahead lists only other workspace members; unknown names say "No one called …" | Flow E step 2; flows.md section 4 ("an unknown person") | In Share, type a name that is not in the workspace. | Listbox "No one called "<text>""; nothing staged. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| SH-08 | Share with a named teammate (grant by person) and see them in Who has access | Flow E steps 1-2 | Share a file with Maya and Sam (here: any other member of the test workspace). | Chips for each person; list "Shared directly". | BLOCKED | The test workspace (test01-workspace) has no other signed-up member, so the people list is empty and a person grant cannot be made from the UI. Needs a second user in the workspace. |
| SH-09 | Grant API refuses an unknown person id and a duplicate workspace grant cleanly | flows.md section 4 (unknown person; already has access); messages.onl… | POST /files/{id}/grants with who="auth0\|nobody"; POST workspace twice. | Unknown person: 4xx with a message (not 500). Duplicate workspace: idempotent success or 409, never 500, and only one workspace entry. | PASS | unknown person -> 400; duplicate workspace -> 200/409 |

### Delete and Trash

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| TR-01 | Delete dialog lists usage (chats, routines, shared with), the 30-day window and the "answers not rewritten" line | Flow F check 1 | On a file page press Delete. | Dialog "Move <name> to Trash?" with rows "N chats", "N routines", "Shared with …" and "Recoverable for 30 days. Answers already written stay as they are." Cancel and Move to Trash buttons. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| TR-02 | Cancel and Escape leave the file where it was | dialog rules | Open the delete dialog, Cancel; again, press Escape. | No DELETE request; file still in All files. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| TR-03 | Move to Trash: file page shows "In Trash / 30 days left / Restore"; file leaves All files, Suggested and search | Flow F steps 1-2; check 2 | Delete a scratch file from its page. Then look at All files, Suggested, search. | File page shows a banner "In Trash" + "30 days left" + Restore button. The file is absent from All files, Suggested (Recent) and search results. | PASS |  |
| TR-04 | Trash screen layout: breadcrumb, banner with Empty Trash, columns Name / Days left / Size / Deleted | Flow F check 8; Flow H check 21 | Open the Trash button at the top right of Library. | Title "Library > Trash" (Library links back); no tabs/Filter/Sort/search; no storage label; a banner with Empty Trash; columns Name, Days left ("30 days"), Size, Deleted; row menu with Restore and Delete forever. | PASS |  |
| TR-05 | Restore from the Trash row menu brings the file back to All files | Flow F step 3; check 3 | Trash > row menu > Restore. | Toast "Restored <name>"; row leaves Trash; file is back in All files with the same id. | PASS |  |
| TR-06 | Restore keeps the shares (workspace grant survives Trash) | Flow F check 3; flows.md section 2 "Moving to Trash keeps shares" | Share a scratch file with the workspace, delete it, restore it, read access. | After restore the workspace grant is still there. | PASS |  |
| TR-07 | Delete forever asks to confirm, then the file is gone and its link says "No longer available" | Flow F step 6; check 7, 9 | Trash > row menu > Delete forever > confirm. Open the old link. | Confirm dialog "Delete <name> forever?" with "This frees up <size> and can't be undone." After confirm the row is gone; the old link shows "No longer available" and never the name. | PASS | [API: 404 GET /api/backend/library/files/10d8a384-3c2b-4ca8-abe2-af3707841c13] |
| TR-08 | Empty Trash: confirm dialog counts files, Cancel leaves everything, confirm clears Trash | Flow F steps 6-7; check 8 | Put two scratch files in Trash. Empty Trash > Cancel. Empty Trash > confirm. | Dialog "Delete 2 files forever?" + "This frees up … and can't be undone."; Cancel keeps both; confirm empties Trash ("Trash emptied") and Empty Trash becomes disabled. | PASS |  |
| TR-09 | Trash empty state reads "Trash is empty"; breadcrumb Library returns to Suggested | Flow H check 22; Flow F check 8 | Open Trash with nothing in it. Click Library in the breadcrumb. | "Trash is empty"; Library link opens /library on Suggested. | PASS |  |
| TR-10 | Delete from the All files row menu works the same as from the file page | Flow H check 16 | Row menu > Delete on a scratch file; confirm. | Same dialog; file leaves the list and appears in Trash. | PASS |  |
| TR-11 | Storage label follows delete and restore | Flow H check 1 ("1.93 GB used") — sample figure in prototype | Note "<size> used"; delete the 1,200-row CSV; read again; restore. | Used size drops while the file is in Trash (or is documented to stay) and returns after restore. | PARTIAL | Storage stays 98874 B while a file is in Trash (counts Trash as used). Restore returns it correctly. |
| TR-12 | A trashed file never appears in the Add-from-Library picker, citations, or a chat | Flow F check 2, 11 | Delete a file used by chats and routines; look in picker, chat, routine. | Excluded from picker; citation reads "File deleted"; routine says unavailable. | NOT BUILT | Picker, citations and routine attachments are built as components but not connected to the live chat or Schedules in this app (no "Add from Library" in the chat + menu; see CH-01). |

### List states

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| ST-01 | Loading: All files shows row placeholders (no empty or error text) while the list loads | Flow H check 22 (Lists = Loading) | Delay the files request by 6 s and open All files. | Skeleton rows are shown; "No files yet" and error text are not; once the data arrives real rows replace them. | PASS |  |
| ST-02 | Empty library: friendly empty state on Suggested and All files | Flow H check 22 (Lists = Empty); page.md | Make the list and suggested endpoints return nothing. | Suggested and All files say "No files yet" with "Attach a file in a chat" and a New chat button. | PASS | /library: Library \| Suggested \| All files \| No files yet \| Attach a file in a chat \| New chat \|\| /library?tab=all: Library \| Suggested \| All files \| No files yet \| Attach a file in a chat \| New chat |
| ST-03 | Error: "Couldn't load your files" with Try again; Try again recovers | Flow H check 22 (Lists = Error) | Make the list request return HTTP 500, then restore it and press Try again. | Error state with a Try again button and no raw server text; after the backend recovers, Try again shows the files. | PASS |  |
| ST-04 | Backend answers with an unexpected shape: a clear error, not a crash or blank page | implementation "contract_error" | Return {"unexpected": true} from the list endpoint. | Error state with Try again ("Library returned something unexpected" or the generic list error); no white screen. | PASS | [console: [library] ZodError [ { "expected": "array", "code": "invalid_type", "path": [ "items" ], "me] |
| ST-05 | Trash states: empty text, and "Couldn't load Trash" with retry | Flow H check 22 (Trash) | Return an empty Trash, then a 500. | "Trash is empty" (and Empty Trash disabled); then "Couldn't load Trash" with a retry control. | PASS |  |
| ST-06 | Going offline mid-session shows an error or notice, not an endless spinner; back online recovers | implementation "offline pause and resume" (uploads) / general resilie… | Open All files, go offline, open Trash via the link, go online. | An error state or notice appears (not skeleton forever); after going online Try again loads. | FAIL | the whole page went blank (white screen, no message) when the search was typed while offline; URL chrome-error://chromewebdata/ [console: Failed to fetch RSC payload for http://localhost:3000/library?tab=all&q=return. Falling back to browser navigation. Type] |
| ST-07 | Expired session (401) from the Library API is handled (login redirect or message), not a blank page | robustness | Return 401 for the list endpoint. | User is sent to sign in or shown a clear message. | PASS | [console: [apiFetch] session expired (401)] |
| ST-08 | File page states: locked (403), gone (404) and server error (500) | Flow D check 4; flows.md section 2 | Return 403, 404 and 500 for GET /library/files/<id>. | 403: "You don't have access" + Request access; 404: "No longer available" without any file name; 500: an error with retry. | PASS | 403: ok ; 404: ok ; 500: ok |

### Performance

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| PF-01 | 5,000-row list is virtualised: few DOM rows, pages load on scroll, scrolling stays smooth | implementation "table keeps ~32 rows in the DOM, 50 rows per page" | Serve 5,000 synthetic rows (50 per page via cursor), scroll to the bottom of All files. | DOM has fewer than ~80 rows at any time; more pages are requested as you scroll; no long freezes. | PASS | peak DOM rows 31; 22 pages requested; 40 scroll steps in 4643 ms (dev build) |
| PF-02 | Timing: first rows on screen for All files and a file page (dev server, includes compile) | plan 07 perf budgets (informational) | Reload All files and a PDF file page 3 times; record time to first row / title. | Informational: report the median. Pass if under 6 s on a warm dev server. | PASS | median 5821 ms (4217, 5821, 5883) |

### Accessibility

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| A11-01 | Keyboard only: reach the first row with Tab and open it with Enter; focus is visible | Flow H check 24 | On All files press Tab repeatedly until a file link has focus; press Enter. | A file link receives focus within 40 Tab presses, shows a visible focus indicator, and Enter opens the file. | PARTIAL | reachable in 8 Tabs and Enter opens it, but no visible outline/box-shadow on the focused link |
| A11-02 | Dialog focus: focus moves into the Share dialog, stays inside on Tab, returns to the Share button on Escape | dialog rules; Radix dialog | Open Share from the file page with Enter; press Tab 12 times; press Escape. | Focus is always inside the dialog; after Escape focus is back on the Share button. | FAIL | focus after Escape is on: SouvenirNewAgentsSchedulesLibraryConnectorsSouvenir in SlackAddProjectsQA Test ProjectPinnedReply with exactly this text and nothing else: ExpExport Safety CheckQA Pin Target ContentRecent Chatssummarisesay hiSummarise this fileQuick Testsay hiReply with exactly this and nothing else: the formReply with exactly one word: pongsay hiOutput ONLY a mermai… |
| A11-03 | Every button and link in Library has an accessible name; one h1; table has a name | principles (06) / WCAG 4.1.2 | Scan All files, a file page and Trash. | No unnamed buttons/links; exactly one h1; table labelled. | PASS | [console: Fetch API cannot load https://souvenirai-storage.s3.amazonaws.com/library/auth0%7C69ceb69057da926f5e5ee6d2/991f1c37e9504] |
| A11-04 | Phone width (375 px): no horizontal scroll; list, file page and dialogs usable | flows.md section 5 H ("narrow window") | Set the viewport to 375x800 and open All files, a file page and the Share dialog. | No horizontal page scroll; primary controls reachable; dialog fits the screen. | FAIL | at 375 px the sidebar stays open and Library content gets only 45 px of the screen (page content starts at x=307). The app shell has no phone layout, so Library cannot be used at phone width. |

### Uploads

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| UP-01 | The same file sent twice is saved as a separate file (same name, different Created) | Flow A check 6; flows.md section 1 row 8; PRD "a duplicate is stored … | Upload identical bytes twice (same name), and once more under another name. | Three separate Library files (ids differ), each keeping the name it was sent with. | FAIL | 3 uploads of identical bytes produced 1 file(s); the later uploads (including the one named scratch-dup-renamed.txt) were folded into the first. PRD/prototype require separate files. |
| UP-02 | Same name, different content: two separate files | Flow A check 6 | Seeded data: two "Price list Q4.xlsx" with different content. | Two rows with two ids. | PASS |  |
| UP-03 | Server refuses unsupported types (.exe), zero-byte and over-limit sizes at upload start | Flow A check 7; flows.md section 1 row 6 | POST /library/uploads for virus.exe, an empty file and a 60 MB file (limit 50 MB). | 4xx with a failure code for each; no file is created. | PASS | statuses: .exe 415, empty 400, 60 MB 413 |
| UP-04 | A corrupt PDF ends as "failed" with a reason and never becomes a Library file | Flow A check 7 (failed uploads never become a file) | Upload bytes that are not a PDF under a .pdf name; poll status; list files. | Status phase "failed" with a failureReason; not in All files. | FAIL | a corrupt PDF was accepted as ready (no content validation); it is now listed: true |
| UP-05 | Cancelling an upload before completion leaves no file | flows.md section 0 "Uploading rows have Cancel" | Create an upload, DELETE it, then try to complete it. | Cancel succeeds (2xx); completing afterwards is refused; no file listed. | PASS | cancel 204, complete-after-cancel 404 |
| UP-06 | Upload status moves Uploading → Processing → Ready (observed phases) | Flow A check 2; page.md "Uploads: Uploading, Processing, Ready" | Upload a file and poll the status endpoint every 700 ms. | Phases observed include processing and finish as ready with a fileId. | PASS | phases: processing > ready |
| UP-07 | Content-Security-Policy allows the storage origin (needed for upload PUT, previews and downloads in the browser) | implementation status "CSP storage origin from env" | Read the connect-src/media-src directives of the app response. | connect-src includes https://souvenirai-storage.s3.amazonaws.com (or the configured storage origin). | FAIL | connect-src has no storage origin. NEXT_PUBLIC_LIBRARY_STORAGE_ORIGIN is unset in .env.local / .env.development.local |
| UP-08 | Upload from the browser (path used by chat Send) reaches storage and the file lands in Library | Flow A steps 1-3 | In a new chat attach a text file, type a message, press Send (chat stream mocked). | POST /library/uploads, PUT to storage succeeds, chip shows Uploading → Processing → Ready, file appears in All files (Source: Uploaded). | FAIL | file not saved to Library (19 -> 19 files); 4 storage requests blocked by CSP; chat showed: "chat-attach-1792068196869.txt: Upload paused. It will continue when you are back online. " [console: A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patche] |

### Chat integration

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| CH-01 | + menu in the chat has "Add files or photos" and "Add from Library" | Flow A check 15; page.md "Add from Library" | Open a new chat, press the + (Add attachment) button. | Menu lists Add photos & files and Add from Library. | NOT BUILT | Menu shows: Add files or photos, Web search, Use style, Add agent. The picker component exists (components/Library/picker) but is not passed to the chat composer. |
| CH-02 | Chat composer: file chip shows Uploading → Processing → Ready; Send waits until Ready | Flow A checks 2, 3 | Attach a file in chat; watch the chip. | Chip shows the upload state; Send disabled until every file is Ready. | PARTIAL | The composer shows a plain attachment card (name, type, size). Upload runs only at Send time (hooks/use-streaming-chat.ts uploadForSend), so no Uploading/Processing/Ready chip exists before sending, and Send is not held. See UP-08 for what happens on Send. |
| CH-03 | Auto-save modes (Always / Ask each time / Never) and the "Save 1 file to Library?" prompt | Flow A check 4; Flow G check 8 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | No auto-save setting, prompt or "Don't save files from this chat" item exists in the app; the /library/prefs endpoint returns 404 on the backend. |
| CH-04 | Citation chips open the file at the cited passage; Sources panel lists what was cited | Flow A checks 9, 10 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | SourcesPanel and LibraryCitationChip exist in code but are used nowhere outside components/Library (0 imports). Needs the SSE source events from the backend. |
| CH-05 | Delete chat offers "Also delete these files" and a notice with Undo | Flow F check 4, 10 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | DeleteChatFiles exists in code but is not used by the chat delete flow (0 imports). |
| CH-06 | AI-generated output card; generated chat outputs saved to Library with Source Generated | Flow H check 8; page.md | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | ChatOutputCard is not used by chat (0 imports); no endpoint produced a Generated file in the test data. |
| CH-07 | Search my Library in chats switch; chat answers "I couldn't find this in your files." | Flow A check 13; Flow G check 9 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | No setting and no Library-grounded chat answers in the live app. |

### Routines

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| RT-01 | Routines: attach Library files, Run output saved to Library, run history, unavailable-file warning | Flow B, Flow C | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | RoutineLibrarySections and RoutineChatCards are not used by the Schedules screens (0 imports). Schedules page has no Library controls. |

### Slack

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| SL-01 | Slack: cited answers, share/save/find commands, "save this to Library" | Flow D | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | No Library behaviour in the Slack integration of this front-end; Slack workspace connection not available to this test account. |

### Settings and Admin

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| SET-01 | Settings > Library: auto-save, "Search my Library", storage, leave workspace | Flow G; page.md Admin | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | /settings/library returns 404 (route not in the app). |
| SET-02 | Admin > Library: default auto-save, force-off, AI reference, file limits, storage, members + transfer question | Flow G checks 1-8 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | /settings/workspace-library returns 404. Only the read-only endpoints GET /library/limits and /library/storage exist (see SET-03). |
| SET-04 | Member removal asks the leaver the mandatory "Transfer your shared files?" question | Flow G check 6-7 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | No UI; also needs a second user. |
| AD-01 | Audit log and Inventory static Phase 2 pages | Flow G check 5 | Look for the feature in the live app and its routes. | As in the prototype. | NOT BUILT | Out of scope by owner decision 2026-10-14 (no nav entries or pages). |
| SET-03 | Limits and storage endpoints return sensible data (50 MB cap, allowed formats, breakdown) | Flow G check 1 (File size limit, File types, Storage rows) | GET /library/limits and /library/storage. | maxFileBytes, allowedFormats, extension map; usedBytes with breakdown that adds up. | PASS | max 52428800 B, used 98874 B (files listed: 98874 B) |

### Regression: other app areas

| ID | Case | Prototype source | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|---|
| REG-01 | Home / new chat loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-02 | Agents loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /agents; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-03 | Schedules loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /schedules; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-04 | Connectors loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /connectors; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-05 | Settings: Account loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/account; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-06 | Settings: Preferences is a hidden preview page (flag off): answers 404 and is not in the Settings nav | regression check requested by owner (not in prototype) | Open /settings/preferences and look for it in the Settings nav. Layout calls notFound() unless SETTINGS_PREVIEW_ENABLED is on. | HTTP 404, no nav link. (Expected by design while the preview flag is off.) | PARTIAL | Hidden by design (SETTINGS_PREVIEW_ENABLED is off). Not a regression. Small UX note: the 404 renders inside the Settings shell as "Something went wrong" instead of a not-found message. [console: Encountered a script tag while rendering React component. Scripts inside React components are never executed when render] |
| REG-07 | Settings: Security is a hidden preview page (flag off): answers 404 and is not in the Settings nav | regression check requested by owner (not in prototype) | Open /settings/security and look for it in the Settings nav. Layout calls notFound() unless SETTINGS_PREVIEW_ENABLED is on. | HTTP 404, no nav link. (Expected by design while the preview flag is off.) | PARTIAL | Hidden by design (SETTINGS_PREVIEW_ENABLED is off). Not a regression. Small UX note: the 404 renders inside the Settings shell as "Something went wrong" instead of a not-found message. [console: Encountered a script tag while rendering React component. Scripts inside React components are never executed when render] |
| REG-08 | Settings: Notifications is a hidden preview page (flag off): answers 404 and is not in the Settings nav | regression check requested by owner (not in prototype) | Open /settings/notifications and look for it in the Settings nav. Layout calls notFound() unless SETTINGS_PREVIEW_ENABLED is on. | HTTP 404, no nav link. (Expected by design while the preview flag is off.) | PARTIAL | Hidden by design (SETTINGS_PREVIEW_ENABLED is off). Not a regression. Small UX note: the 404 renders inside the Settings shell as "Something went wrong" instead of a not-found message. [console: Encountered a script tag while rendering React component. Scripts inside React components are never executed when render] |
| REG-09 | Settings: Usage loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/usage; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-10 | Settings: Plans & Billing loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/plans-and-billing; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-11 | Settings: AI loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/ai; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-12 | Settings: Help & Legal loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/help; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-13 | Settings: Workspace General loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/general; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-14 | Settings: Workspace Members loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/members; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-15 | Settings: Workspace Activity loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/activity; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-16 | Settings: Workspace Plans loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/plans; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-17 | Settings: Report a bug loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/report-bug; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-18 | Settings: Feature request loads without an error screen, page errors or failing API calls | regression check requested by owner (not in prototype) | Open /settings/feature-request; wait for content; read console and network. | Page renders its heading/content; no "Something went wrong"; no uncaught page errors; no 4xx/5xx from /api/backend. | PASS |  |
| REG-19 | Settings: Files (not in the settings nav) is a hidden preview page (flag off): answers 404 and is not in the Settings nav | regression check requested by owner (not in prototype) | Open /settings/files and look for it in the Settings nav. Layout calls notFound() unless SETTINGS_PREVIEW_ENABLED is on. | HTTP 404, no nav link. (Expected by design while the preview flag is off.) | PARTIAL | Hidden by design (SETTINGS_PREVIEW_ENABLED is off). Not a regression. Small UX note: the 404 renders inside the Settings shell as "Something went wrong" instead of a not-found message. [console: Encountered a script tag while rendering React component. Scripts inside React components are never executed when render] |
| REG-20 | Sidebar: collapse/expand, Library row, search button, project and chat rows still work | regression check | Collapse and expand the sidebar; open sidebar search; click New. | Sidebar toggles; search opens; New opens a fresh chat; Library row navigates. | PASS |  |
| REG-21 | Chat still renders a streamed reply (mocked stream) with no attachment | regression check (chat send path was changed by Library: use-streamin… | Send "hello" in a new chat with the stream mocked. | User message and the streamed reply "Got it." are shown; no upload is attempted. | PASS |  |
| REG-22 | Chat: attaching a file and sending works (file reaches the model flow) | regression check (chat attachments now use the Library upload) | Same as UP-08. | See UP-08. A regression if attachments that worked before now stall. | FAIL | after Send the attachment shows: "reg22-1792068372140.txt: Upload paused. It will continue when you are back online. " (attachment is not delivered) [console: Each child in a list should have a unique "key" prop.%s%s See https://react.dev/link/warning-keys for more information. ] |

## 7. Not tested, limits of this run

- **Second user.** Only one login exists. Everything a second person sees (Shared tab with an unread dot, viewer with Share/Rename/Delete turned off, locked file page, request access, leaving-member transfer question) could only be checked from the owner's side or by simulating the API answer (ST-08). Giving the test workspace a second signed-up member would unlock SH-08, FP-21, FP-22 and the Shared tab checks.
- **Generated files.** Nothing in the app can produce a Generated file yet (chat outputs and routine runs are not connected), so the sparkle, "Run of ...", Frequently used "Generated" row and the Source filter value Generated were checked only for absence and for the empty state.
- **Dev server timings.** PF-02 and all waits include Next dev compilation. Measure again on a production build (`npx next build --webpack`, then `next start`) before using the numbers against a budget.
- **Real chat replies.** The dev backend answered plain chat calls with a stream error earlier in the project, so chat replies were mocked in the chat cases (REG-21, REG-22, UP-08). Only the front-end behaviour was judged.
- **Not covered by automation:** screen reader announcement quality, colour contrast in dark mode, print, right-to-left text, very long file names in every view, real S3 CORS (blocked first by the CSP, see finding F1).
- **Data left behind.** All `scratch-*` test files were deleted forever. The 12 seeded sample files remain in the test Library (about 99 KB) so the cases can be re-run; delete them from Library (Delete, then Trash, Empty Trash) when they are no longer needed.

## 8. How to re-run

The seed files, the case definitions and the runner are Node scripts using `playwright-core` from `front-end/node_modules`. They were kept outside the repo on purpose (no shared tooling was added). To make this repeatable for the team, the next step is a Playwright suite in the repo (already listed under "Deliberately not built" in `09-implementation-status.md`); the case table above is written so each row can become one test.
