# Library: QA test cases from the prototype (Admin and Member)

**Date:** 2026-10-25 (end-to-end re-run the same day: share by asking now uses a toast, as the prototype does)
**Source of truth:** the clickable prototype in `library-prototype/surfaces/library`. That covers its components, `page.md`, `flows.md` and the flow checks in `lib/data.ts`.
**App under test:** `front-end` on `localhost:3000` against `devapi.getsouvenir.com`, backend `c03695a0`.
**Status sources:** `../../tickets/2026-10-20/LIBRARY_FLOWS_CHECKLIST.md` (live results up to 25 Oct) and `../../tickets/2026-10-25/LIBRARY_BACKEND_REMAINING_REQUIREMENTS.md` (what the backend still owes).

This file lists every Library behaviour the prototype shows, and covers all 130 checks of the flows checklist (Flows A–H, their edge cases and X1–X13): each one is named in the **Ref** column of at least one case. Each one is written as a test case, with what the **Admin** and the **Member** should each see, and whether it can be tested today.

---

## How to use

### Accounts

| Prototype person | Test account (`front-end/.env.local`) | Shows in the app as | Role |
|---|---|---|---|
| You | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | "test 01" / You | Workspace Admin, owner of most sample files |
| Maya | `MEMBER_EMAIL` / `MEMBER_PASSWORD` | "OS8 Test01" | Member |
| Sam | none | none | A second member. There is no third account, so a "Sam" step is run as the Member, or marked N/A where it needs two members at once |

Both accounts are in `test01-workspace`. The test accounts are disposable, so destructive steps are fine.

### Status legend

| Mark | Meaning | What to do |
|---|---|---|
| ✅ | Testable and passed live (latest run in the flows checklist) | Regression only |
| 🟢 | Testable now. The front end is built and the backend has shipped, but it hasn't been run since `c03695a0` | Run it |
| 🟡 | Testable in part. Some of it works, and the rest is blocked as noted | Run the testable part |
| ⛔ BE | Missing backend | Wait. See the backend ticket ref |
| ⛔ FE | The backend exists, but the front end isn't built | Front-end ticket |
| ⛔ ENV | Needs the environment: a Slack workspace, a feature flag, or a third account | Set up first |
| ⚪ | Prototype-only, Phase 2, or the citations ticket | Not tested |

**Columns:**
- **Admin** and **Member:** the expected result for each account. "Same" means identical to the Admin. "N/A" means the step doesn't apply to that role.
- **Ref:** the flows-checklist ID (A1, E7 …) or the backend requirement (R1.1 …) from `2026-10-25/LIBRARY_BACKEND_REMAINING_REQUIREMENTS.md`.

### Test data

- **Admin:**
  - 70+ files.
  - New 25 Oct files: `thumb-test-1025.png`, `supplier-call-1025.wav` (spoken), `broken-1025.pdf` (failed upload) and `return-policy-1025`, in the chat "Policy Summary".
  - Older: "Supplier contract - Acme", "Return policy 2026" equivalents (`qa-seed-return-policy`, `e2-supplier-contract-acme`), "Supplier call - Acme.wav" and `files/Draft_product_copy…` run outputs.
- **Member:** 13 files shared with them (12 unread). `thumb-test-1025` is locked for them, with a pending access request.
- Upload new files through a chat (Library has no upload). To make a spoken recording on Windows: PowerShell `System.Speech` → `SetOutputToWaveFile`.

---

## Summary

| # | Area | Cases | ✅ | 🟢 | 🟡 | ⛔ BE | ⛔ FE | ⛔ ENV | ⚪ |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Library header, tabs, storage | 8 | 7 | 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | Suggested | 9 | 6 | 2 | 1 | 0 | 0 | 0 | 0 |
| 3 | All files table | 9 | 8 | 0 | 0 | 1 | 0 | 0 | 0 |
| 4 | Filter and Sort | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | Search | 8 | 7 | 0 | 1 | 0 | 0 | 0 | 0 |
| 6 | Shared tab and unread | 8 | 6 | 1 | 0 | 0 | 0 | 0 | 1 |
| 7 | File menu and roles | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| 8 | File page and previews | 13 | 9 | 1 | 2 | 1 | 0 | 0 | 0 |
| 9 | File states | 9 | 8 | 0 | 0 | 0 | 0 | 0 | 1 |
| 10 | Share dialog and access | 11 | 10 | 0 | 0 | 0 | 0 | 0 | 1 |
| 11 | Delete and Trash | 14 | 10 | 3 | 0 | 1 | 0 | 0 | 0 |
| 12 | Chat composer and uploads | 15 | 14 | 0 | 1 | 0 | 0 | 0 | 0 |
| 13 | Add from Library picker | 6 | 6 | 0 | 0 | 0 | 0 | 0 | 0 |
| 14 | Auto-save and save choice | 8 | 7 | 0 | 0 | 0 | 0 | 1 | 0 |
| 15 | Chat answers, Sources, citations | 12 | 3 | 4 | 1 | 0 | 0 | 0 | 4 |
| 16 | Share and find by asking in chat | 7 | 4 | 1 | 1 | 0 | 0 | 0 | 1 |
| 17 | Delete chat | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| 18 | Routines and run outputs | 17 | 7 | 0 | 2 | 8 | 0 | 0 | 0 |
| 19 | Slack | 11 | 0 | 0 | 0 | 0 | 0 | 11 | 0 |
| 20 | Request access | 5 | 4 | 0 | 0 | 0 | 1 | 0 | 0 |
| 21 | Personal Library settings | 6 | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| 22 | Admin Library settings | 9 | 0 | 0 | 0 | 0 | 0 | 9 | 0 |
| 23 | Removing a member and leaving | 7 | 0 | 0 | 0 | 6 | 0 | 1 | 0 |
| 24 | Lists, accessibility, copy, layout | 10 | 10 | 0 | 0 | 0 | 0 | 0 | 0 |
| | **Total** | **223** | **147** | **13** | **9** | **17** | **1** | **28** | **8** |

The ✅ marks count the latest live result in the flows checklist. Where the latest result was before 25 Oct and `c03695a0` touched that path, the case is 🟢, not ✅.

---

## 1. Library header, tabs, storage

| ID | Test case | Admin (You) | Member (Maya) | Status | Ref |
|---|---|---|---|---|---|
| L1.1 | Open `/library` | Opens on **Suggested**. Title "Library" with "N MB of 20 GB used" beside it | Same, with their own usage | ✅ | H1 |
| L1.2 | Tabs | Suggested · All files · Shared (Shared shows once something is shared with you). No Archived tab | Same. Shared is there because 13 files are shared with them | ✅ | H2, X6 |
| L1.3 | Shared tab unread dot | Dot on the tab while any shared file is unread | Dot shown (12 unread) | ✅ | H2 (from `/library/summary` since 25 Oct) |
| L1.4 | Storage label everywhere | Shown on every tab, while searching and in every Lists state. Not on Trash | Same | ✅ | H1, X11 |
| L1.5 | Header tools on All files / Shared | Filter and Sort icon buttons first, then search, then the Trash icon button. No Upload button | Same | ✅ | H1, X10 |
| L1.6 | Header counts come from one call | One `GET /library/summary`, with no `tab=shared` list request | Same | ✅ | H2 |
| L1.7 | "Your Admin changed Library settings" notice | N/A (admin) | Notice listing what changed, after the Admin changes settings | 🟢 | G4. Needs `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` for the Admin side to make changes; the API can do it instead |
| L1.8 | No drop area | Dragging a file over Library does nothing | Same | ✅ | A12, H23, X13 |

## 2. Suggested

| ID | Test case | Admin (You) | Member (Maya) | Status | Ref |
|---|---|---|---|---|---|
| L2.1 | Recent row | Up to 5 cards, newest activity first | Same, with their own files and shared files | ✅ | H3 |
| L2.2 | Recent wording | "Opened / Modified / Created / Shared <short time>" | An unread shared file reads "Shared <time>" with the dot after the title | 🟢 | X8. Per-viewer lines shipped in `c03695a0`; retest that a file the Member opened doesn't read "Shared" because of someone else's share |
| L2.3 | Recent order | Ranked by what each card reports | Same | 🟢 | H3. Backend `touched` ranking changed in `c03695a0` |
| L2.4 | Frequently used | Up to 3 tiles, "Opened N times", never a file already in Recent, no See all | Same, with their data | ✅ | H4 (backend sends 3 since 25 Oct) |
| L2.5 | Generated row | Up to 3 run-output tiles reading "Run of <date>" | Row hidden (no runs) | 🟡 | H4. Works with a date. "Run of <routine>" needs R3.1 |
| L2.6 | Empty rows hidden | A row with no files is not drawn | Generated row hidden | ✅ | H4 |
| L2.7 | Card opens the file; … opens the menu only | Card opens the File page and Close returns to Suggested. … opens the menu without opening the file | Same | ✅ | H6 |
| L2.8 | Thumbnails on cards | Image and PDF cards show a thumbnail (files uploaded after 25 Oct) | Same, for shared files | ✅ | H-new3. Older files have none (R4.1) |
| L2.9 | See all | Recent → All files with nothing ticked. Generated → All files with Source: Generated | Same | ✅ | H5 |

## 3. All files table

| ID | Test case | Admin (You) | Member (Maya) | Status | Ref |
|---|---|---|---|---|---|
| L3.1 | Columns | Name, Access, Source, Created, Type, … | Same | ✅ | H7 |
| L3.2 | Access avatars | Owner first. Owner alone · two avatars · owner + "+2" · lilac building icon for the workspace | Same. A shared file's first avatar is the owner (You) | ✅ | H7 |
| L3.3 | Access tooltip | "Owner: You. Shared with X" / "Only you" | "Owner: test 01. Shared with You…" | ✅ | H7 |
| L3.4 | Source | Uploaded or Generated | Same | ✅ | H7 |
| L3.5 | Created | Date and time, newest first to start | Same | ✅ | H7 |
| L3.6 | Generated sparkle | Soft-mint sparkle after the name. Tooltip "Generated in <chat>" | Same | ✅ | X9 |
| L3.7 | Sparkle tooltip for routine outputs | "Generated by the <routine> routine" | Same, when shared | ⛔ BE | H8, R1.4/R3.1. Still "Generated in <chat>" |
| L3.8 | Same name twice | Two rows with different Created times | Same | ✅ | H-d3 |
| L3.9 | Thumbnail in the Name cell | New images and PDFs show a 20 KB thumbnail. A link that fails to load falls back to the type icon | Same | ✅ | H-new3 |

## 4. Filter and Sort

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L4.1 | Filter panel | Two sections: Source (Uploaded, Generated, Shared) and File type (Images, Documents, Spreadsheets, PDFs, Audio), each with an icon and a tick | Same | ✅ | H11 |
| L4.2 | Two ticks in one section widen the list, one in each section narrows it | Uploaded + Generated = all files. Generated + Documents = the intersection | Same | ✅ | H13 |
| L4.3 | Chips | Up to 2 chips beside Filter; "3 picked" for 3 or more. X clears one section. Reset clears all | Same | ✅ | H14 |
| L4.4 | No match | "No files match" with Reset filters | Ticking Generated shows this (no runs) | ✅ | H15 |
| L4.5 | Sortable headings | Only Name and Created (Name and Date shared on Shared), with an arrow always shown; click reverses | Same | ✅ | H9 |
| L4.6 | Sort button | Name A–Z / Z–A, Created Newest / Oldest. The tick matches the heading. Nothing ticked on Shared until chosen | Same | ✅ | H10 |
| L4.7 | Ticks carry over between All files and Shared | Chips follow. Ignored while searching | Same | ✅ | H-d1 |
| L4.8 | Sort fallback | Date shared on All files falls back to Created | Same | ✅ | H-d2 |
| L4.10 | Counts per filter | Each filter's row count matches the API total for that filter (the account's data differs from the prototype's 15 files, so 15 is not a target) | Same, with their data | ✅ | H12 |
| L4.9 | Paging | Scroll past 50 files: no repeats or gaps. Cursor is opaque | Same | ✅ | H-new2 |

## 5. Search

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L5.1 | Typing turns the page into Search | Title "Search"; no tabs, Filter or Sort; storage label and Trash stay | Same | ✅ | H18, H-new1 |
| L5.2 | Results show a snippet | Rows with the matched text | Same | ✅ | H18 |
| L5.3 | Words inside files | "net 30" finds Supplier contract - Acme | Finds shared files that contain it | ✅ | H18 |
| L5.4 | Words inside recordings | "review prices" finds `supplier-call-1025` | Finds a shared recording | 🟡 | H18. New recordings only; older ones need R4.2 |
| L5.5 | Scope chip | On All files: "In All files" / "All of Library". On Shared: "In Shared" leaves out your own files | Same | ✅ | H19 |
| L5.6 | No match / unavailable | "No files match · Try other words · Clear search" / "Search is unavailable right now" | Same | ✅ | H19, H22 |
| L5.7 | Trash never in results | Trashed files never appear | Same | ✅ | F2, H18 |
| L5.8 | Search persistence | Stays after opening and closing a result. Clears when you leave Library | Same | ✅ | X7, H-d4 |

## 6. Shared tab and unread

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L6.1 | Layout | Flat list: Name, Access, Date shared, Type. Unread first, then newest | Same, with 13 rows | ✅ | E4, H20 |
| L6.2 | Owner's own shares aren't listed | Files You shared out are not on Your Shared tab | N/A | ✅ | E4 |
| L6.3 | Unread dot | N/A unless something is shared with the Admin | Dot right after the name, bold title, "Unread" label | ✅ | E3, X5 |
| L6.4 | Unread clears on open | — | Open the file → dot gone | ✅ | E-d2 |
| L6.5 | Re-share makes it unread again | Admin removes and re-adds the Member | Dot comes back | 🟢 | E-d2. Shipped in `c03695a0` (BE-12 R7) |
| L6.6 | Direct + workspace listed once | — | File listed once. File info "You: Viewer" with both ways | ✅ | E5 |
| L6.7 | Remove direct, workspace remains | "OS8 Test01 can still open it through the workspace." | File stays, shown as Whole workspace | ✅ | E11 |
| L6.8 | Citation of a removed file locks | Warns that answers stay but citations lock | Citation reads "Locked file" | ⚪ | E6, citations ticket |

## 7. File menu and roles

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L7.1 | … menu items | Open · Ask about this · Share · Download · Rename · Delete | Same items | ✅ | H16, C4 |
| L7.2 | Owner-only actions for a Viewer | All enabled on own files | Share, Rename and Delete turned off with "Only the owner can change this" | ✅ | E3, H17, X2 |
| L7.3 | Server enforces owner-only | — | `PATCH`, `POST grants` and `DELETE` answer `403 only_owner` | ✅ | E3 |
| L7.4 | Admin over a workspace share | On a file the Member shared with the workspace: Rename, Share and Delete work. File info "You: Admin, can manage" | N/A | ✅ | E10 |
| L7.5 | Admin can't open someone's private file | Locked page | N/A | ✅ | X2 |
| L7.6 | Ask about this | Opens a new chat with the file attached | Same, on a shared file | ✅ | H16 |

## 8. File page and previews

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L8.1 | Header | Name menu, Download, Share, File info toggle, Close | Same. Share is off for a Viewer | ✅ | QA §6 |
| L8.2 | Document / PDF / Office preview | Pages render | Same | ✅ | — |
| L8.3 | Sheet preview | Sheet tabs and rows, in pages of 100 rows | Same | ✅ | — |
| L8.4 | Image preview | Image shown | Same | ✅ | — |
| L8.5 | Audio preview with transcript | Player plus timed lines (`0:00 …`, `0:06 …`). Clicking a line seeks. The playing line is marked | Same, on a shared recording | ✅ | A11 (new recordings) |
| L8.6 | Transcript pending / failed | "Transcribing. The transcript shows here when it's ready." The page checks every 15 s. "This recording couldn't be transcribed." on failure | Same | 🟡 | A11. FE built. Older recordings sit in pending until R4.2 |
| L8.7 | File info rows | Type, Owner, Created, Size, Used in, Who has access, Private / ways, Manage access, Ask about this, Download, Delete | Same, with Viewer controls turned off | ✅ | QA §6 |
| L8.8 | Provenance (uploaded) | "Uploaded by You", with a link to the chat | "Uploaded by test 01"; the chat link only shows if they can open the chat | ✅ | A5 |
| L8.9 | Provenance (chat output) | "Made by Souvenir in <chat>" with an AI-generated tag | Same, when shared | ✅ | — |
| L8.10 | Provenance (routine run) | "Made by routine <link>, run of <date>" and "Files this run used" | Same, when shared | ⛔ BE | C8, R1.4 |
| L8.11 | Provenance (Slack) | "Uploaded by … in Slack" | Same | 🟡 | D5. Backend sends `via: slack`, but it needs Slack connected to test |
| L8.12 | Used in | "Used in N chats, N routines"; others' uses are counted, never named | Same | ✅ | F1 |
| L8.13 | Who has access | Owner and each grant with how it was shared ("Shared directly", "Whole workspace · Everyone in Souvenir") | Names only | 🟢 | E2. Retest after the 25 Oct backend |

## 9. File states (File page)

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L9.1 | Uploading | "Uploading" banner, ghost lines, no Download or Ask | N/A | ✅ | X3 |
| L9.2 | Processing | "Preparing Library previews and search. You can already use the original file in chat or download it." | Same, when shared | ✅ | X3 |
| L9.3 | Library processing failed | Failure banner with Retry (owner) | Banner, no Retry | ✅ | X3 |
| L9.4 | Refused upload | Alert with the reason (e.g. "This file couldn't be read."), no preview, Download or Ask | N/A | ✅ | X3 (`failureReason` since 25 Oct) |
| L9.5 | In Trash (owner) | "In Trash · N days left · Restore" | N/A | ✅ | F-page |
| L9.6 | Locked | "You don't have access · Ask the owner to share it · Request access". No title, owner or preview | Same on an Admin file they saw in a chat and lost | ✅ | D4, X2 |
| L9.7 | Gone | "No longer available · Back to Library", never the name | Same for a file never linked to them (`404`) | ✅ | F9 |
| L9.8 | Ready | Normal page | Same | ✅ | X3 |
| L9.9 | "File state" switch | Prototype-only control | — | ⚪ | Prototype bar |

## 10. Share dialog and access

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L10.1 | Open Share | "Share <file>", "Add people or the whole workspace", "Teammates can use shared files in their chats and routines." | Turned off (not the owner) | ✅ | E1 |
| L10.2 | Add a person | Toast "Shared with OS8 Test01 · Undo". Row "Shared directly · Viewer" | File appears in Shared, unread | ✅ | E1, E3 |
| L10.3 | Undo in the toast | Grant removed, "Sharing undone" | File gone from Shared | ✅ | E1 |
| L10.4 | Add the whole workspace | Lilac building avatar. "Whole workspace · Everyone in Souvenir · Viewer" | Sees it through the workspace | ✅ | E1, E2 |
| L10.5 | People who already have access aren't offered | Owner and existing grantees left out. API `409 already_has_access` | — | ✅ | E-d1 |
| L10.6 | Remove a person | Confirm: "<name> loses the file now. Answers already received stay…" + "Souvenir stops using it in answers within 60 seconds." | File leaves Shared and the page locks | ✅ | E6/E11 |
| L10.7 | Remove the person, workspace stays | "…can still open it through the workspace." | Keeps access | ✅ | E11 |
| L10.8 | Only Viewer role | No Editor choice | — | ✅ | flows §1 #16 |
| L10.9 | Copy link | "Link copied" | Same | ✅ | QA §6 |
| L10.10 | Retried share doesn't double up | One grant per click (`Idempotency-Key`) | — | ✅ | C-02 |
| L10.11 | Removed access reaches AI within 60 s | — | Asking about the file stops using it | ⚪ | Not demonstrated in the prototype; needs a timed test |

## 11. Delete and Trash

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L11.1 | Delete dialog | "Move <file> to Trash?" with chats, routines, shares and "Recoverable for 30 days. Answers already written stay as they are." | Delete is off on a file they don't own | ✅ | F1 |
| L11.2 | After delete | Toast "moved to Trash · Restore". Gone from lists, search and the picker | Shared file disappears; opening it shows "No longer available" | ✅ | F2 |
| L11.3 | Trash screen | "Library > Trash", no tabs, search or storage label. Grey banner with Empty Trash and "Frees up N". Columns Name, Days left, Size, Deleted | Their own Trash only (empty) | ✅ | F8, F6, H21 |
| L11.4 | Restore | Back in All files with its shares | Back in their Shared | ✅ | F3 |
| L11.5 | Delete forever | "Delete X forever? This frees up N and can't be undone." | — | ✅ | F7 |
| L11.6 | Empty Trash | "Delete N files forever?" Cancel keeps all; confirm empties | — | ✅ | F8 |
| L11.7 | Trash is private | Admin's trashed file is not in the Member's Trash | Empty Trash | ✅ | F6 |
| L11.8 | Admin deleting a workspace-shared file | "Deleted by <admin>". Only the owner can restore | Owner sees it in their Trash | ✅ | — |
| L11.9 | Trash paging | Trash honours `limit` and uses a keyset cursor | Same | 🟢 | H21 |
| L11.10 | Trashed file never used in answers | Ask about it → "I couldn't find this in your files." | Same for a shared file | 🟢 | F11, BE-05 R6 shipped |
| L11.11 | Deleted chip in chat history | "File deleted", never the name | Same | ✅ | F-d2 |
| L11.12 | Trash days count down | "29 days" the next day | — | 🟢 | QA bug LB-5 (showed "30 days" on 20 Oct); recheck |
| L11.14 | No Archive | Delete is the only way to remove a file: no Archive in a menu or on the File page, no Archived tab | Same | ✅ | F5 |
| L11.13 | Routine warns about a trashed attached file | "Next run skips it" | — | ⛔ BE | F-d1, R1.1 |

## 12. Chat composer and uploads

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L12.1 | + menu | "Add photos & files", "Add from Library" | Same | 🟡 | A15. Width and placement differ from the prototype (product decision) |
| L12.2 | Upload progress | Chip "Uploading… N%", then "Processing…" | Same | ✅ | A2 |
| L12.3 | Send waits | Send off until every file is ready | Same | ✅ | A2 |
| L12.4 | Staged file stays private | Not in All files, the picker or search until sent | Same | ✅ | A3 |
| L12.5 | X removes a staged file | Nothing left behind | Same | ✅ | A3, A-Depth3 |
| L12.6 | Saved after send, no message | Row in All files, Source Uploaded, owner only | Same | ✅ | A1, A5 |
| L12.7 | Duplicate is two files | Same name, two Created times | Same | ✅ | A6 |
| L12.8 | Unsafe file | "Blocked: this file looks unsafe." No chip, nothing saved, clears after 6 s | Same | ✅ | A7 |
| L12.9 | Unsupported type | "This file type isn't supported." | Same | ✅ | A7 |
| L12.10 | Password-protected | "This file is password-protected, so it can't be added." | Same | ✅ | A7 |
| L12.11 | Unreadable | "This file couldn't be read." | Same | ✅ | A7 |
| L12.12 | Failed upload has no Retry | One message only; upload again to retry | Same | ✅ | A-Depth1 |
| L12.13 | Too many files / not ready | "A message can include up to 10 files." / "This file isn't ready yet." | Same | ✅ | A-new2 |
| L12.15 | Unsupported send fields | Sending with web search, a style, a system prompt or a temperature still works; the front end drops what the backend refuses | Same | ✅ | A-new1 |
| L12.14 | Repeated send refused | The same send retried answers `409 already_sent`, with no second answer | Same | ✅ | C-02 (25 Oct) |

## 13. Add from Library picker

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L13.1 | Open | Search, type filter, list/grid toggle, multi-select, "N selected" | Same, including shared files | ✅ | A8 |
| L13.2 | Rows | Name, date and time | Same | ✅ | A8 |
| L13.3 | Only ready, active files | Staged, processing and trashed files left out | Same | ✅ | A3, F2 |
| L13.4 | No match | "Try other words" | Same | ✅ | F2 |
| L13.5 | Loading / empty / error | Each has a designed state | Same | ✅ | flows §1 #19 |
| L13.6 | Attach and send | Sent message carries the files; Sources lists them | Same | ✅ | A10 |

## 14. Auto-save and save choice

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L14.1 | Default Always | Saved, no prompt | Same | ✅ | A1 |
| L14.2 | Ask each time | "Save 1 file to Library?" with Save focused. Don't save → "Not saved. It stays in this chat." | Same | ✅ | A4, G8 |
| L14.3 | Never | No prompt. "Not saved. Auto-save is Never." | Same | ✅ | A4 |
| L14.4 | "Don't save files from this chat" | Chat … menu toggle; a file sent there → "Not saved. This chat doesn't save files." Survives a reload | Same | ✅ | A14 |
| L14.5 | Admin force-off | N/A | "Never", turned off, "Your Admin has turned auto-save off"; a sent file stays chat-only | ✅ | G2 |
| L14.6 | Workspace default shown | N/A | "Using your workspace's default · Ask each time" | ✅ | G8 |
| L14.7 | Server overrides the browser | A file kept out by the server shows "Not saved. It stays in this chat." | Same | ✅ | A4 |
| L14.8 | Changing it in Settings, Library | Settings page | Settings page | ⛔ ENV | A1. Needs `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` |

## 15. Chat answers, Sources, citations

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L15.1 | Library answers with nothing attached | "What are the payment terms in the supplier call recording?" answers from Library | Answers from their own and shared files only | 🟢 | A13 (seen working live as Admin; run the full case) |
| L15.2 | Nothing found | "I couldn't find this in your files." | Same | 🟢 | A13, G9 |
| L15.3 | Search my Library switched off | Composer note; answers only from attached files | Same | 🟢 | A13, G3. Turn it off via `PATCH /library/prefs` until settings ship |
| L15.4 | Admin turned AI reference off | N/A | "Your Admin has turned off Library search. Attaching files still works." The answer doesn't search Library | 🟢 | G3, G9 |
| L15.5 | Sources panel | "Sources · N" lists the attached and cited files | Same | ✅ | A10 |
| L15.6 | Switch a source off | Stored on the chat. A fresh tab keeps it. Answers leave it out | Same | ✅ | A10 |
| L15.7 | Answer notes switched-off sources | "1 source switched off." | Same | 🟡 | A-Depth2. The backend prompt asks for it; check the wording |
| L15.8 | Recording: transcribing step | "Transcribing — <file>" step, then an answer | Same | ✅ | A11 |
| L15.9 | Citation chip opens the passage | Chip after the sentence opens the file with the passage highlighted | Same | ⚪ | A9, citations ticket |
| L15.10 | Audio citation "Supplier call - Acme, 0:42" | Opens the recording at the time | Same | ⚪ | A11, citations ticket |
| L15.11 | Locked citation | — | "Locked file" chip → locked panel with Request access | ⚪ | D4 panel passes; the citation event is the citations ticket |
| L15.12 | Deleted citation | "File deleted", never the name | Same | ⚪ | F-d2, citations ticket |

## 16. Share and find by asking in chat

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L16.1 | "share <file> with <person>" | The answer confirms it, and a toast "Shared with OS8 Test01 · Undo" shows (as the prototype and the Share dialog do). No card under the answer, no browser offer | Shared file appears, unread | ✅ | E7 |
| L16.2 | Undo in the toast | "Sharing undone"; access removed | File gone | ✅ | E7 |
| L16.3 | After a reload | Only the answer text stays; there is no Undo after the toast is gone (as in the prototype). Remove access in the Share dialog instead | — | ✅ | E7 |
| L16.4 | Refusals | Someone else's file → "OS8 Test01 can already open it." / "I can only share files you own."; an unknown person → "Who should I share it with? Try …"; several matches → "Which one: …?" | Same rules for their own files | ✅ | E8, E-d1. The unknown-person reply doesn't name the problem (R4.4) |
| L16.5 | Several files match | "Which one: A, B, C?" | Same | 🟢 | E8. Not run yet |
| L16.6 | "find <words>" | "Found N files." with links to each File page | Same, only files they can open | 🟡 | D6. In web chat the agent answered from the file instead (R4.3) |
| L16.7 | Share via Slack names the file only when allowed | See L19.8 | — | ⚪ | See section 19 |

## 17. Delete chat

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L17.1 | Dialog lists the saved files | "Delete <chat>?", "1 saved file stays in Library." with the file, "Also delete these files" unticked | Same, for their chats | ✅ | F4 |
| L17.2 | Keep files | "Chat deleted. 1 file stays in Library. · Undo" → Undo brings the chat back | Same | ✅ | F10 |
| L17.3 | Also delete files | One request with `deleteFiles`; "Chat deleted. 1 file in Trash. · Undo" | Same | ✅ | F10 |
| L17.4 | Undo after also deleting | Chat and file both back (`active`) | Same | ✅ | F10 |
| L17.5 | Chat with no saved files | "No saved files." | Same | ✅ | F4 |

## 18. Routines and run outputs

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L18.1 | Routine details card | "Attach the Return policy and Shipping rates?" with Attach both / Not now. Create routine stays off until one is chosen | — | ⛔ BE | B1, B-d2, R1.2 |
| L18.2 | Routine created card | Name, schedule, delivery, attached files, "Test run: Done", Open routine, Run outputs | — | ⛔ BE | B2, R1.3 |
| L18.3 | Not now | "Attached files: None"; pane "No files attached." | — | ⛔ BE | B-d1, R1.1 |
| L18.4 | Attached files on the pane | Listed, add and remove | — | ⛔ BE | B3, R1.1 |
| L18.5 | "All run outputs in Library" | Opens All files with Source: Generated | — | ✅ | B4 |
| L18.6 | Routine privacy | N/A | Not in the Member's list until shared | ✅ | B5 |
| L18.7 | Run now saves "<Routine> - <date>" | Unique title, no `files/` prefix | — | ⛔ BE | B6, C1, R1.4 |
| L18.8 | Output is a row | Newest first, Generated, owner only, never removed on its own | Not visible | 🟡 | C1. Row is right; the title is wrong |
| L18.9 | Message-only run | History line only; pane "Results stay in run history, not in Library." | — | ⛔ BE | C2, R1.5 |
| L18.10 | Failed run | "Failed" in history, no file | — | ✅ | C3 |
| L18.11 | Run output menu | Ordinary file menu, no Keep | — | ✅ | C4 |
| L18.12 | Delete and restore a run output | Trash with days left, then Restore | — | ✅ | C5 |
| L18.13 | Run output is private | — | Not in their list; `403` if opened | ✅ | C6 |
| L18.14 | File info names the routine | "Made by routine …" + "Files this run used" | — | ⛔ BE | C8, R1.4 |
| L18.15 | Run now twice | One run. "Running now" badge shows. Server `409 already_running` | — | 🟡 | C-d1. FE guard works; server `409` is R1.6 |
| L18.17 | No Routine outputs tab | Run outputs are ordinary rows; "All run outputs in Library" and See all on Generated open All files with a Source: Generated chip; removing the chip shows every file | Same chip behaviour | ✅ | C9 |
| L18.16 | Trashed attached file skipped | Pane "Next run skips it". History "Skipped 1 file" | — | ⛔ BE | C-d2, R1.1 |

## 19. Slack (needs a connected Slack workspace)

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L19.1 | Answer in #ops cites the file | Return window answer cites Return policy, and the citation opens it | Same | ⛔ ENV | D1 |
| L19.2 | Channel uses only files everyone can open | "Only files everyone can open", plus how many were left out, unnamed | Same | ⛔ ENV | D2 |
| L19.3 | DM uses the asker's files | Acme answer cites the contract | Cites only what they can open | ⛔ ENV | D3 |
| L19.4 | Save when asked | "save this to Library" → link to the saved file; File page "Uploaded … in Slack" | Same | ⛔ ENV | D5 |
| L19.5 | Not saved unless asked | Bot explains how to save | Same | ⛔ ENV | D-d1 |
| L19.6 | find | "Found 1 file." with a link; Trash left out; channel lists workspace files only | Same | ⛔ ENV | D6 |
| L19.7 | Unknown question | "I couldn't find this in your files." | Same | ⛔ ENV | D-d2 |
| L19.8 | Share in a channel | Confirmation doesn't name a file the channel can't all open; Undo reads "Undone" | — | ⛔ ENV | E9 |
| L19.9 | Saved file is private | — | Not in the Member's Library | ⛔ ENV | D7 |
| L19.10 | Routine "is ready" post | "<Routine> is ready." in #ops | — | ⛔ ENV | C7, also R1.7 |
| L19.11 | Slack Connect channel | No Library files used | — | ⛔ ENV | BE-10 |

## 20. Request access

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L20.1 | Locked page has Request access | N/A | Button shows (on by default since 25 Oct) | ✅ | D4 |
| L20.2 | Send a request | N/A | "Request sent", button off | ✅ | D4 |
| L20.3 | Already asked | N/A | "Request sent" on load (`details.requested`) | ✅ | D4 |
| L20.4 | The owner sees the request | `GET /library/access-requests` lists it (API only) | N/A | ✅ | D4 |
| L20.5 | The owner's request inbox in the app | A place to see and grant requests | N/A | ⛔ FE | Needs a design (Phase 2 in the PRD) |

## 21. Personal Library settings (Settings → Library)

All of this needs `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS=true`. The backend endpoints exist (`/library/prefs`).

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L21.1 | Page rows | "Save files from chats" (Always / Ask each time / Never), "Search my Library in chats", Storage | Same | ⛔ ENV | G-flow |
| L21.2 | Change auto-save | Saved; next send follows it | Same | ⛔ ENV | A1, A4 |
| L21.3 | Admin force-off shown | N/A | "Never", off, "Your Admin has turned auto-save off" | ⛔ ENV | G2 |
| L21.4 | AI reference off shown | N/A | Switch off and disabled, "Your Admin turned this off" | ⛔ ENV | G3 |
| L21.5 | Data-use line | Placeholder wording until legal approves | Same | ⛔ ENV | page.md |
| L21.6 | Leave Souvenir | Admin: dimmed, "Name another Admin first" | Opens the leave question (section 23) | ⛔ ENV | G-d2 |

## 22. Admin Library settings (Settings → Workspace → Library)

Also needs the flag. The backend has `/library/org-settings`.

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L22.1 | Page rows | Auto-save default, Force auto-save off, AI reference, File size limit, File types, Storage | "Only workspace admins can see this page" | ⛔ ENV | G1, G4 |
| L22.2 | Storage | "N of 20 GB used" with a bar and Files / Images / Audio rows | N/A | ⛔ ENV | G1. Also R5: usage is the caller's own files, not the workspace's |
| L22.3 | Auto-save default | Ask each time → Member's row shows it and sending asks | Sees the default | ⛔ ENV | G8 |
| L22.4 | Force auto-save off | Turn on | Row "Never", sent files stay in the chat | ⛔ ENV | G2 |
| L22.5 | AI reference off | Turn off | Composer note; answers don't search Library | ⛔ ENV | G3, G9 |
| L22.6 | Version conflict | Two tabs editing → the second save is refused with a reload prompt (`If-Match`) | N/A | ⛔ ENV | — |
| L22.7 | Change notice | — | Library notice lists what changed, newest first | ⛔ ENV | G4 |
| L22.8 | Audit log, Inventory | Static pages marked "Phase 2" | Not visible | ⛔ ENV | G5 |
| L22.9 | Admin pages hidden from members | N/A | No Workspace / Admin section in Settings | ⛔ ENV | G4 |

## 23. Removing a member and leaving

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L23.1 | Remove asks the leaving person | Members → Remove Maya → confirm → "Waiting for their answer" | Locked question "Transfer your shared files to other members?" | ⛔ BE | G6, R2.1, R2.2 |
| L23.2 | Yes, transfer | Payment terms becomes yours; Sam keeps access | Removed | ⛔ BE | G7, R2.2 |
| L23.3 | No, delete them | Payment terms deleted; never-shared files deleted either way | Removed | ⛔ BE | G7, R2.2 |
| L23.4 | Removed person | "Removed" and can't be picked; gone from every Who has access | — | ⛔ BE | G-d1, R2.5. The backend hand-off deletes their files; verify the shares |
| L23.5 | Leave | — | Settings → Leave → same question, Cancel closes it | ⛔ BE | G-d2, R2.1 |
| L23.6 | Last Admin can't leave | Leave dimmed, "Name another Admin first" | N/A | ⛔ BE | G-d2, R2.4 |
| L23.7 | What the backend does today | Remove Maya → each person she shared with gets a copy, then her files are deleted. No question | — | ⛔ ENV | Product decision (ticket R2). Destructive: run only on a throwaway member |

## 24. Lists, accessibility, copy, layout

| ID | Test case | Admin | Member | Status | Ref |
|---|---|---|---|---|---|
| L24.1 | Loading | Card placeholders on Suggested, row placeholders elsewhere | Same | ✅ | H22, X4 |
| L24.2 | Empty | "No files yet · Attach a file in a chat · New chat"; "Nothing shared with you yet"; "Trash is empty" | Same | ✅ | H22 |
| L24.3 | Error | "Couldn't load your files · Try again"; search: "Search is unavailable right now" | Same | ✅ | H22 |
| L24.4 | Keyboard | Esc and an outside click close menus. Tab reaches every card, row and button. Enter opens | Same | ✅ | H24 |
| L24.5 | Status never by colour alone | Dot plus bold name plus an "Unread" label; banners have words | Same | ✅ | X5 |
| L24.6 | Words | File, Trash, Upload, Output. Never Item, Shelf, Folder, Collection | Same | ✅ | X1 |
| L24.7 | Icons and switches | No box around file icons; switches show no On/Off word | Same | ✅ | X12 |
| L24.8 | Narrow window | Source then Access hide (Shared hides Type); tools wrap; the sidebar drops to a rail below 768 px | Same | ✅ | H25 |
| L24.9 | Roles summary | Owner manages, Viewer opens, no access sees the locked page, Admin pages are Admin-only | Same | ✅ | X2 |
| L24.10 | Private caching | Library JSON answers `Cache-Control: private, no-store` | Same | ✅ | C-05 |

---

## What can't be tested yet, grouped by cause

### Backend missing

See `../../tickets/2026-10-25/LIBRARY_BACKEND_REMAINING_REQUIREMENTS.md`.

| Cause | Cases |
|---|---|
| Routines (R1) | L18.1–L18.4, L18.7, L18.9, L18.14, L18.16, L11.13, L8.10, L3.7 |
| Removal question (R2) | L23.1–L23.6 |
| Routine origin on lists (R3.1) | L2.5 (in part), L3.7 |
| Backfill of thumbnails and transcripts (R4.1, R4.2) | L2.8 and L3.9 on older files, L5.4, L8.6 |
| Find tool not used in web chat (R4.3) | L16.6 |

### Front end missing

| Cause | Cases |
|---|---|
| The owner's access-request inbox (needs design) | L20.5 |
| A row's … menu offers Ask about this on a refused upload (the row has no `phase`) | Minor; part of L9.4 |

### Environment

| Cause | Cases |
|---|---|
| No Slack workspace connected | L19.1–L19.11, L8.11 |
| `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` is off | L14.8, L21.x, L22.x |
| No third account ("Sam") | Two-viewer steps of L6.6, L23.2 |

### Out of scope

| Item | Cases |
|---|---|
| Citations ticket | L6.8, L15.9–L15.12 |
| Prototype-only controls (File state switch, Lists switch, Viewing as, Sample files bar, Checklist) | L9.9 |
| 60-second AI revocation timing | L10.11 |
| Phase 2 per the PRD: tags, bulk actions (except Empty Trash), versions, folders, Editor role, an access-request inbox, run-output retention | — |

---

## Ready-to-run queue (🟢)

Run these first. Each needs only the two test accounts:

1. **L1.7:** change org settings by API, then check the Member's notice.
2. **L2.2, L2.3:** Recent wording and order, per viewer.
3. **L6.5:** re-share makes a file unread again.
4. **L8.13:** Who has access after the 25 Oct backend.
5. **L11.9:** Trash paging (needs more than 50 trashed files) or `limit`.
6. **L11.10:** trash a file, then ask about it.
7. **L15.1–L15.4:** Library answers, "I couldn't find this in your files.", and both switches (use `PATCH /library/prefs` and `/library/org-settings`).
8. **L16.5:** share by asking with an ambiguous name.
9. **L11.12:** Trash days left count down (bug LB-5).
