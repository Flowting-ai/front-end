# 12 Library: test cases from the prototype surface

Written for: whoever runs the Library check in the real `front-end` app.

Source: the clickable prototype `library-prototype/surfaces/library` (latest commit `cd360b1`, "Generated sparkle and the Access column"): `page.md`, `flows.md`, `lib/data.ts` (seed data and the Flow A to H checklists), and the components `library.tsx`, `trash.tsx`, `file-view.tsx`, `file-menu.tsx`, `dialogs.tsx`. Labels, messages and values below are copied from that code, so a mismatch is a finding.

This list replaces nothing. `10-test-cases-and-results.md` is the 2026-10-15 run (157 cases) and was written against an earlier reading of the prototype. This one follows the prototype as it is now, so it adds checks for the Access column, the Generated sparkle, "Date shared", Recent card wording, "Frees up", the Trash banner and the Add from Library picker.

## How to use this list

- Sections 1 to 20 test one screen or control each. Sections 21 and 22 cover roles and file states. Section 23 is the prototype's own Flows A to H, end to end, and section 24 maps every prototype check to a case.
- Run it in the order of the sections. Fill the **Result** column with PASS, FAIL, PARTIAL (works, differs from the prototype), NOT BUILT, BLOCKED or N/A. Put the reason in **Notes**.
- **Steps** and **Expected** use the prototype's exact wording in quotes. Where the prototype uses sample data (Alex, Maya, Sam, canned answers), use the equivalent from the real account.
- A case marked **[2 users]** needs a second login. A case marked **[sim]** needs a simulated state (request interception for loading, error, empty, slow, offline).
- The prototype has no backend. These behaviours are real in the app and cannot be seen in the prototype, so they are listed as **app-only** checks at the end of each area: persistence after reload, permissions enforced by the server, large lists, and real file reading.

### Test data to have ready

Mirror the prototype's seed so every case has something to act on. Names matter, because several cases look for them.

| Need | Prototype sample | What to create in the app |
|---|---|---|
| PDFs | Return policy 2026 (1.2 MB, used 14 times), Return policy 2025, Supplier contract - Acme, Supplier contract - Nova, Autumn lookbook (8.4 MB), Brand guidelines | at least 4 PDFs, one over 8 MB |
| Two files with one name | Price list Q4 twice (Sheet, 88 KB, different Created times) | upload the same name twice with different content |
| Sheet and CSV | Price list Q4, Shipping rates (CSV, 12 KB) | one XLSX, one CSV |
| Document | Payment terms, Product copy draft - Autumn | one DOCX, one that is AI-generated in a chat |
| Image | Autumn window display (2.6 MB) | one PNG or JPG |
| Audio | Supplier call - Acme (4.2 MB, with transcript) | one WAV or MP3 |
| Generated files | Weekly sales report - `<run label>` (Sheet, 36 KB) from a routine; Product copy draft from a chat | one chat output and one routine run output, if routines exist |
| Shared files | Acme and Nova shared with Maya and Sam; one file shared with the whole workspace | at least 3 shares: one person, two people, whole workspace |
| In Trash | Return policy 2025 | delete one file before the Trash cases |
| Unread share | a file shared with the viewer and not yet opened | **[2 users]** |

Column guide for the app: **Name**, **Access**, **Source** (Uploaded or Generated), **Created**, **Type**. On Shared: **Name**, **Access**, **Date shared**, **Type**.

---

## 1. Navigation and header (NAV)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| NAV-01 | Entry point | Click Library in the sidebar | Opens `/library` on the **Suggested** tab, not All files | | |
| NAV-02 | Page title | Look at the header on each tab | Title reads "Library" on Suggested, All files and Shared | | |
| NAV-03 | Storage label | Look beside the title on Suggested, All files, Shared | A "`<amount>` used" label (prototype: "1.93 GB used") sits beside the title on every tab | | |
| NAV-04 | Storage label in search | Type in search | Title becomes "Search" and the storage label is still beside it | | |
| NAV-05 | Storage label in Lists states | Force loading, empty, error [sim] | The storage label stays on every state | | |
| NAV-06 | Tabs | Look at the tab row | Tabs read "Suggested", "All files", and "Shared" only when something is shared. No "Archived" and no "Trash" tab | | |
| NAV-07 | Tab semantics | Inspect the tab row | `role=tablist` named "Library"; each tab `role=tab` with `aria-selected` on the active one | | |
| NAV-08 | Shared tab hidden | Use an account with nothing shared with it | No Shared tab | | |
| NAV-09 | Shared tab appears | **[2 users]** Another user shares a file | Shared tab appears. If any shared file is unread, the tab shows an unread dot | | |
| NAV-10 | Shared tab dot clears | **[2 users]** Open every unread shared file | The dot on the tab goes away | | |
| NAV-11 | Header tools | Look at the right of the header on All files | Filter button, Sort button, a "Search Library" pill, then a ghost trash icon button, in that order | | |
| NAV-12 | Header tools on Suggested | Look at the right of the header on Suggested | Search pill and the trash icon only. No Filter and no Sort | | |
| NAV-13 | No Upload | Look all over Library | No Upload button, no uploads tray, no drop area | | |
| NAV-14 | Drag over Library | Drag a file from the desktop over the page | Nothing happens: no overlay, no upload | | |
| NAV-15 | Trash button | Hover the trash icon | Tooltip "Trash"; accessible name "Trash" | | |
| NAV-16 | Trash opens | Click it | Trash screen opens with the title "Library > Trash" | | |
| NAV-17 | Trash breadcrumb | On Trash click "Library" | Returns to Library on Suggested | | |
| NAV-18 | Trash header | Look at the Trash header | No tabs, no Filter, no Sort, no search box, no storage label. The "Trash" crumb is `aria-current=page` | | |
| NAV-19 | Direct URLs | Open `/library`, `/library/trash`, `/library/files/<id>` directly | Each renders the right screen without going through another one | | |
| NAV-20 | Back button | Open a file, then press the browser Back | Returns to the tab you came from | | |
| NAV-21 | Search clears on leaving | Search, then go to Chat, then return to Library | The search box is empty | | |
| NAV-22 | Search kept on file round trip | Search, open a result, close the file | Back on the same result list with the same query | | |
| NAV-23 | Unknown file id | Open `/library/files/does-not-exist` | "No longer available" with a "Back to Library" button | | |
| NAV-24 | Admin notice | **[2 users]** Admin changes a Library setting; a Member opens Library | Notice card "Your Admin changed Library settings" with up to 3 lines and a Dismiss button. Admins never see it | | |
| NAV-25 | Admin notice dismiss | Press Dismiss | The card is removed and does not return after reload | | |

## 2. Suggested tab (SUG)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| SUG-01 | Sections | Open Suggested with files | Section "Recent" first, then "Frequently used" and "Generated" only when they have files | | |
| SUG-02 | Recent count | Count Recent cards with more than 5 active files | Exactly 5 cards, the most recently active first | | |
| SUG-03 | Recent card content | Read one card | Title, the file icon in the middle, and one line of meta. Image files show a thumbnail instead of the icon | | |
| SUG-04 | Meta wording: Opened | Card for a file you opened | "Opened `<n>d ago>`" using short units: "today", "2d ago", "1w ago", "3mo ago" | | |
| SUG-05 | Meta wording: Modified | Card for a file you edited | "Modified `<ago>`" | | |
| SUG-06 | Meta wording: Created | Card for a file never opened | "Created `<ago>`" | | |
| SUG-07 | Meta wording: Shared | **[2 users]** Card for a file shared with you and unopened | "Shared `<ago>`" with the unread dot right after the title | | |
| SUG-08 | Short-time units | Files aged 0, 3, 8, 30, 65 days | "today", "3d ago", "1w ago", "1mo ago", "2mo ago" | | |
| SUG-09 | Unread dot | Card with unread dot | The dot sits right after the title and the card's accessible name ends ", unread" | | |
| SUG-10 | Open a card | Click, or focus and press Enter | Opens the File page | | |
| SUG-11 | Card menu | Click the "..." on a card (accessible name "More for `<file>`") | Menu opens; clicking inside does not open the file | | |
| SUG-12 | Truncated title tip | Hover a long title that is cut | A tooltip shows the full title. Short titles show none | | |
| SUG-13 | Recent "See all" | Click "See all" beside Recent (aria-label "See all files") | Goes to All files with all filters cleared | | |
| SUG-14 | Frequently used tiles | Look at Frequently used | At most 3 tiles. Only files opened more than once. Files already in Recent are skipped. Highest use count first | | |
| SUG-15 | Frequently used meta | Read a tile | "Opened `<n>` times" | | |
| SUG-16 | Tiles show no type | Look at a tile | No file type text on the tile (icon only) | | |
| SUG-17 | Frequently used has no See all | Look at its header | No "See all" button for Frequently used | | |
| SUG-18 | Generated tiles | Look at Generated | At most 3 tiles, newest first, meta "Run of `<run label>`" for routine outputs | | |
| SUG-19 | Generated See all | Click "See all" beside Generated | Goes to All files with Source: Generated ticked | | |
| SUG-20 | Empty rows hidden | Account with nothing Generated | The Generated section is not rendered at all | | |
| SUG-21 | Tile click and Enter | Click a tile; focus one and press Enter | Opens the File page | | |
| SUG-22 | Tile menu | Open "More" on a tile | Same menu as a row (see section 8) | | |
| SUG-23 | No files at all | New account | "No files yet" with "Attach a file in a chat" and a "New chat" button | | |
| SUG-24 | New chat button | Press "New chat" in that empty state | Opens a new chat | | |
| SUG-25 | Trash excluded | Delete a Recent file | It disappears from Recent, Frequently used and Generated | | |
| SUG-26 | Not Ready excluded | A file still Uploading or Processing | Not on Suggested | | |
| SUG-27 | Persistence | Open a file, return to Suggested | Its meta reads "Opened today" and it moves toward the front of Recent | | |

## 3. All files table (ALL)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ALL-01 | Columns | Open All files | Headings: Name, Access, Source, Created, Type, and an unlabelled actions column. Table has `role=table`, name "Files" | | |
| ALL-02 | Only active files | Compare with Trash | Files in Trash are not listed | | |
| ALL-03 | Name cell | Look at a row | File icon (no box around it) then the name. Click the name to open | | |
| ALL-04 | Unread dot position | **[2 users]** Row of an unread file | The dot sits beside the name (not at the far right) and the name is heavier. The dot has a label and a tooltip | | |
| ALL-05 | Generated sparkle | Row of a chat output or run output | A soft-mint gradient sparkle after the name, then the unread dot if any | | |
| ALL-06 | Uploaded has no sparkle | Row of an uploaded file | No sparkle | | |
| ALL-07 | Source values | Read the Source column | "Uploaded" or "Generated" only. Chat outputs and run outputs both read "Generated" | | |
| ALL-08 | Created format | Read Created | "Today, 3:42 PM", "Yesterday, 9:10 AM", otherwise "Oct 3, 9:10 AM" | | |
| ALL-09 | Created tooltip | Hover a Created cell | Title attribute carries the same date and time | | |
| ALL-10 | Type values | Read Type | PDF, Document, Sheet, CSV, Image, Audio | | |
| ALL-11 | Access: owner only | Row of a private file | One soft tinted avatar of the owner. Tooltip "Only you" | | |
| ALL-12 | Access: two people | File shared with one person | Two avatars, owner first. Tooltip "Owner: You. Shared with `<name>`" | | |
| ALL-13 | Access: three or more | File shared with two people | Owner avatar plus a "+2" circle. Tooltip "Owner: You. Shared with A and B" | | |
| ALL-14 | Access: workspace | File shared with the whole workspace | One lilac circle with a building icon. Tooltip "Owner: You. Shared with the whole workspace" | | |
| ALL-15 | Access order | Compare a file you own and one shared with you | The owner's avatar is always first, the same for every viewer | | |
| ALL-16 | Access photo | Owner with an uploaded photo | Photo fills the avatar. Without a photo, or if it fails to load, the initial shows | | |
| ALL-17 | Access accessibility | Inspect the cell | `role=img` with an `aria-label` equal to the tooltip | | |
| ALL-18 | Two files, one name | Open All files with the two Price list Q4 | Two rows, different Created times, nothing renames them | | |
| ALL-19 | Row menu | Click "More for `<file>`" | Menu opens, see section 8 | | |
| ALL-20 | Row menu closes | Press Escape; click elsewhere | The menu closes both ways | | |
| ALL-21 | Default order | Open All files | Newest Created first | | |
| ALL-22 | Row click target | Click the Access or Type cell | Does not open the file (only the name opens it) | | |
| ALL-23 | Empty | Account with no files | "No files yet", "Attach a file in a chat", "New chat" | | |
| ALL-24 | Long name | A 120-character file name | Truncates with an ellipsis, no layout break, full name in a tooltip | | |
| ALL-25 | Special characters | A name with `&`, `<`, quotes and emoji | Displayed as text, never interpreted as markup | | |
| ALL-26 | Type icons | One file of each format | Each format has its own icon (PDF has a PDF icon), no box | | |
| ALL-27 | Not Ready excluded | A file Uploading | Not in the table | | |

## 4. Sort (SORT)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| SORT-01 | Sortable headings | Look at All files headings | Only Name and Created are buttons, and both always show an arrow icon even when not sorted | | |
| SORT-02 | Access/Source/Type not sortable | Click those headings | Nothing happens | | |
| SORT-03 | Name first click | Click Name | A to Z, up arrow, `aria-sort=ascending` | | |
| SORT-04 | Name second click | Click Name again | Z to A, down arrow, `aria-sort=descending` | | |
| SORT-05 | Created first click | Click Created | Newest first (down arrow) | | |
| SORT-06 | Created second click | Click Created again | Oldest first (up arrow) | | |
| SORT-07 | Other heading resets | Sort by Name, then click Created | Created is active, Name shows the neutral arrow, `aria-sort=none` | | |
| SORT-08 | Sort button | Click the Sort button | Menu "Sort by" with Name, Created, then "Newest first" / "Oldest first" (for Created) or "A to Z" / "Z to A" (for Name) | | |
| SORT-09 | Sort menu ticks | Open it | The active key and direction are ticked | | |
| SORT-10 | Sort menu vs heading | Pick "Name" then "Z to A" in the menu | The Name heading shows the down arrow and the list is Z to A | | |
| SORT-11 | Locale sort | Names with accents and mixed case | Sorts like `localeCompare`: "apple" and "Banana" are in order regardless of case | | |
| SORT-12 | Shared sort keys | On Shared open the Sort menu | Name and "Date shared" (not Created) | | |
| SORT-13 | Shared untouched | Open Shared without choosing | Unread first, then newest shared first, and no ticks and no heading shows as sorted | | |
| SORT-14 | Name carries over | Sort Name on All files, switch to Shared | Name is still active on Shared | | |
| SORT-15 | Date key falls back | Pick "Date shared" on Shared, switch to All files | All files falls back to Created, newest first | | |
| SORT-16 | Sort in search | Search, then sort | Search results follow the chosen sort | | |
| SORT-17 | Sort survives reload | Sort, then reload | **app-only** Note whether it is remembered. The prototype does not say; record the behaviour | | |

## 5. Filter (FILT)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| FILT-01 | Button | Look at the Filter button | Icon button, accessible name "Filter", tooltip "Filter" | | |
| FILT-02 | Panel structure | Open it | Two sections only: **Source** (Uploaded, Generated, Shared) and **File type** (Images, Documents, Spreadsheets, PDFs, Audio) | | |
| FILT-03 | No other filters | Look for Made by, Show, Origin | Not present | | |
| FILT-04 | Nothing ticked | Open it fresh | No ticks, list shows everything | | |
| FILT-05 | Tick narrows | Tick Uploaded | Only uploaded files remain | | |
| FILT-06 | Source is OR | Tick Uploaded and Generated | All files with either source | | |
| FILT-07 | Type is OR | Tick PDFs and Images | PDFs and images | | |
| FILT-08 | Across sections AND | Tick Generated and Spreadsheets | Only generated spreadsheets | | |
| FILT-09 | Spreadsheets includes CSV | Tick Spreadsheets | Sheet and CSV files both show | | |
| FILT-10 | Documents | Tick Documents | Document-type files only (not PDFs) | | |
| FILT-11 | Shared source | Tick Shared on All files | Files you share out and files shared with you | | |
| FILT-12 | Chips | Tick one section value | A chip with the label and an X appears beside the Filter button | | |
| FILT-13 | Chip label for two | Tick Uploaded and Generated | One chip "Uploaded, Generated" | | |
| FILT-14 | Chip label for three | Tick three file types | One chip "3 picked" | | |
| FILT-15 | Max two chips | Tick a Source and a File type | Two chips at most (one per section) | | |
| FILT-16 | Chip remove | Click the X on a chip (name "Remove `<label>`") | Only that section is cleared | | |
| FILT-17 | Filter button state | With a tick | Button reads "Filter, on" and shows an active style | | |
| FILT-18 | Reset | With a tick, open the panel | "Reset" appears in the Source header; clicking clears both sections | | |
| FILT-19 | Reset hidden | With nothing ticked | No Reset link | | |
| FILT-20 | No match | Tick Audio when there is none | "No files match" with a "Reset filters" button | | |
| FILT-21 | Reset filters button | Press it | Everything is back | | |
| FILT-22 | Carries to Shared | Tick PDFs, go to Shared | Same tick and chip on Shared | | |
| FILT-23 | Ignored in search | Tick PDFs, then type a search | Results are not narrowed by the filter | | |
| FILT-24 | Back after search | Clear the search | The filter applies again | | |
| FILT-25 | Cleared by Recent See all | Click "See all" beside Recent | Filters are cleared | | |
| FILT-26 | Generated See all | Click "See all" beside Generated on Suggested | Source: Generated is the only tick | | |
| FILT-27 | Close | Press Escape; click outside | Panel closes | | |
| FILT-28 | Keyboard | Tab to Filter, Enter, arrow keys, Space | Options reachable and toggled by keyboard | | |
| FILT-29 | Filter with sort | Sort by Name then tick a type | Sort order holds inside the filtered list | | |
| FILT-30 | Filter survives reload | Tick, reload | **app-only** Record whether it is remembered | | |

## 6. Search (Q)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| Q-01 | Box | Look at the box | Pill with a search icon, placeholder "Search Library", accessible name "Search Library" | | |
| Q-02 | Typing switches mode | Type one letter | Title becomes "Search". Tabs, Filter and Sort disappear | | |
| Q-03 | Clear button | Type text | An X button "Clear search" appears; clicking it empties the box and restores the tab view | | |
| Q-04 | Scope chip | Search from All files | Two buttons "In All files" and "All of Library" in a group named "Search scope", one `aria-pressed` | | |
| Q-05 | Scope label from Suggested | Search from Suggested | The first chip reads "In All files" (Suggested counts as All files) | | |
| Q-06 | Scope label from Shared | Search from Shared | The first chip reads "In Shared" | | |
| Q-07 | In Shared hides your files | **[2 users]** On Shared with "In Shared" | Files you own are left out | | |
| Q-08 | All of Library | Switch to "All of Library" | Includes files you own and files shared with you | | |
| Q-09 | Match by name | Search "return" | Return policy 2025 and 2026 appear | | |
| Q-10 | Case insensitive | Search "RETURN" | Same result | | |
| Q-11 | Match by content (document) | Search for a phrase inside a PDF page | The file appears with a snippet line under the name | | |
| Q-12 | Match by content (sheet) | Search a cell value | The sheet appears with a snippet | | |
| Q-13 | Match by content (audio) | Search a word spoken in the recording | The audio file appears with a snippet from the transcript | | |
| Q-14 | Snippet shape | Look at a snippet | About 90 characters, "…" at the cut ends | | |
| Q-15 | Name-only match | Search a word only in the name | No snippet line | | |
| Q-16 | Excludes Trash | Search a Trashed file's name | Not listed | | |
| Q-17 | Excludes not Ready | Search a file still Processing | Not listed | | |
| Q-18 | No match | Search "zzzzz" | "No files match" with "Try other words" and a "Clear search" button | | |
| Q-19 | Clear search button | Press it | Returns to the tab you came from, search box empty | | |
| Q-20 | Searching state | Slow the search [sim] | Skeleton rows under the scope chip while searching | | |
| Q-21 | Search error | Force an error [sim] | "Search is unavailable right now", "You can still browse and attach files by hand", and a "Try again" button | | |
| Q-22 | Try again | Press it with the error cleared | Results return | | |
| Q-23 | Two same-name files | Search "Price list" | Both rows show, Created tells them apart | | |
| Q-24 | Open from result | Open a result then close | Back on the results with the query kept | | |
| Q-25 | Whitespace only | Type spaces | Treated as empty, no search mode | | |
| Q-26 | Regex characters | Search `(` `[` `.*` | No crash, treated as plain text | | |
| Q-27 | Long query | 500 characters | No crash or layout break | | |
| Q-28 | Debounce | **app-only** Type quickly | No flicker of old results, no request per keystroke storm | | |

## 7. Shared tab (SHD)

All cases here are **[2 users]** unless you have seeded shares through the API.

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| SHD-01 | Table | Open Shared | Headings: Name, Access, Date shared, Type. Table named "Shared with you" | | |
| SHD-02 | Same Access avatars | Compare with All files | Same avatars, same tooltips. The first avatar is the person who shared it | | |
| SHD-03 | Date shared | Read the column | Date and time in the Created format | | |
| SHD-04 | Default order | Open with unread and read files | Unread first, then newest shared | | |
| SHD-05 | Only others' files | Look for files you own | Only files other people shared with you appear | | |
| SHD-06 | Workspace-shared | A file shared with the whole workspace by someone else | Listed, Access shows the building circle | | |
| SHD-07 | Filter and Sort here | Use both | Same panel; sort keys are Name and "Date shared" | | |
| SHD-08 | Empty | Remove access to the last shared file | "Nothing shared with you yet". The Shared tab is gone once you leave | | |
| SHD-09 | No match | Filter to a type with none | "No files match", "Reset filters" | | |
| SHD-10 | Unread clears | Open an unread shared file | The dot clears in the table and on the tab | | |
| SHD-11 | Row menu as viewer | Open a row menu | Open, Ask about this, Download enabled. Share, Rename, Delete turned off with tooltip "Only the owner can change this" | | |
| SHD-12 | Access removed live | Owner removes you | The file leaves Shared within one refresh. Opening its link shows the locked page | | |
| SHD-13 | Back from file | Open from Shared, close | Returns to Shared (not All files) | | |
| SHD-14 | Back for own file | Open your own file from Shared search "All of Library", close | Returns to All files | | |

## 8. Row and card menu (MENU)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| MENU-01 | Items and order | Open the menu on an owned Ready file | Open, Ask about this, Share, Download, a separator, Rename, a separator, Delete (red, last) | | |
| MENU-02 | Icons | Look at the menu | Each item has an icon | | |
| MENU-03 | Open | Click Open | Opens the File page | | |
| MENU-04 | Ask about this | Click it | Opens a new chat with the file attached and no text | | |
| MENU-05 | Ask about this disabled | A file that is not Ready or not active | The item is disabled | | |
| MENU-06 | Share | Click Share | Share dialog opens for that file | | |
| MENU-07 | Download | Click Download | The file downloads, and a message "Downloading `<name>`" shows | | |
| MENU-08 | Rename | Click Rename | Rename dialog opens | | |
| MENU-09 | Delete | Click Delete | "Move `<name>` to Trash?" dialog | | |
| MENU-10 | Viewer: turned off | A file shared with you | Share, Rename, Delete disabled, tooltip "Only the owner can change this", not hidden | | |
| MENU-11 | Admin over workspace files | **[2 users]** Admin, file shared with the whole workspace by someone else | Share, Rename and Delete are enabled for the Admin | | |
| MENU-12 | Admin, private file | **[2 users]** Admin looks for another member's private file | Not listed, cannot be opened | | |
| MENU-13 | Menu closes after action | Click any item | Menu closes | | |
| MENU-14 | One menu at a time | Open one menu, then another | The first closes | | |
| MENU-15 | Menu position | Open on the last row and on a narrow window | Menu stays inside the viewport | | |
| MENU-16 | Keyboard | Tab to More, Enter, arrows, Escape | Reachable, Escape returns focus to the trigger | | |
| MENU-17 | Aria | Inspect | Trigger has `aria-expanded`; menu has `role=menu` | | |

## 9. File page (FP)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| FP-01 | Layout | Open a file | Top bar, preview, the Ask dock at the bottom, the File info card on the right (open by default) | | |
| FP-02 | Top bar | Look at it | Left: title pill (icon, name, chevron). Right: Download, Share, File info, Close | | |
| FP-03 | Title pill menu | Click the title pill | Header "`<name>` / Library", then the file menu without "Open" | | |
| FP-04 | Close | Click the X | Returns to the tab you came from (Suggested, All files, Shared or search) | | |
| FP-05 | Close from Shared own file | Described in SHD-14 | Falls back to All files | | |
| FP-06 | Download button | Click | "Downloading `<name>`" message and the file downloads | | |
| FP-07 | File info toggle | Click File info | The card hides; the button shows the panel icon state through `aria-pressed`; click again to show | | |
| FP-08 | Share button hidden in Trash | Open a file that is in Trash | No Share button | | |
| FP-09 | Viewer: Share off | A shared-in file | Share has `aria-disabled` and tooltip "Only the owner can change this" | | |
| FP-10 | Info card title | Read it | "File info", the name with a pencil, and a path | | |
| FP-11 | Path label | Open from All files, from Shared, from Trash | "Library / All files", "Library / Shared", "Library / Trash" | | |
| FP-12 | Origin: upload | Open an uploaded file | "Uploaded by You" (or "by `<name>`"), plus ", `<chat title>`" as a link when it came from a chat, and " in Slack" for Slack | | |
| FP-13 | Origin: chat output | Open a chat-generated file | "Made by Souvenir in a chat, `<chat title>`" and an "AI-generated" badge | | |
| FP-14 | Origin: run | Open a routine output | "Made by routine `<routine>`, run of `<label>`" or "..., test run" | | |
| FP-15 | Origin links | Click the chat or routine link | Goes to that chat or routine | | |
| FP-16 | Details rows | Read them | Type ("PDF · .pdf"), Owner ("You" or a name), Created (date and time), Size | | |
| FP-17 | Files this run used | Open a routine output | Section "Files this run used", each source clickable. Deleted source reads "A deleted file"; unopenable reads "A file you can't open", both disabled | | |
| FP-18 | Used in | Open a used file | "Used in" with "`<n>` chats, `<n>` routines" (singular "1 chat", "1 routine"), each a link | | |
| FP-19 | Used in: none | Open an unused file | "Not used yet" | | |
| FP-20 | Used in hides others' chats | **[2 users]** | Only chats you can open are listed | | |
| FP-21 | Who has access | Read it | "You: Owner" (or "Viewer", or "Admin, can manage") and a row per person: owner first with "Owner" | | |
| FP-22 | Grant reasons | A file shared directly and one to the workspace | "Shared directly" for a person, "Whole workspace" for the workspace row | | |
| FP-23 | Private | File shared with nobody | "Private" | | |
| FP-24 | Manage access | Click it as owner | Share dialog opens. Viewers see it disabled with the tooltip | | |
| FP-25 | Side actions | Look at the bottom of the card | "Ask about this", "Download", "Delete" (red text). Delete is hidden once in Trash | | |
| FP-26 | Ask about this | Click | New chat with the file attached | | |
| FP-27 | Ask dock | Type a question, press Enter or the send arrow | Opens a chat with the file attached and the question sent | | |
| FP-28 | Ask dock empty | No text | Send is disabled | | |
| FP-29 | Ask dock plus | Click the plus (name "Ask about this file in a new chat") | New chat with the file, no text | | |
| FP-30 | Ask dock gating | File in Trash, or Uploading | The Ask dock is not shown | | |
| FP-31 | Rename from the card | Click the pencil | Rename dialog. Viewers: disabled with the tooltip | | |
| FP-32 | Opening clears unread | **[2 users]** Open an unread file | The unread dot clears everywhere | | |
| FP-33 | Locked page | **[2 users]** Open a file you have no access to | "You don't have access", "Ask the owner to share it", a "Request access" button. The file's title is not shown | | |
| FP-34 | Request access | Press it | Button becomes "Request sent" with a check, and a message "Request sent". It stays disabled after a reload | | |
| FP-35 | No longer available | Open the link of a deleted-forever file | "No longer available" with "Back to Library", and no title | | |
| FP-36 | Pending file link | A file attached to an unsent message | "No longer available" for the link | | |
| FP-37 | Trash banner | Open a file that is in Trash | A banner "In Trash" and "`<n>` days left" ("1 day left" singular) | | |
| FP-38 | Restore in banner | As the owner press Restore | File returns to active and the banner goes. Non-owners do not see Restore | | |
| FP-39 | Uploading banner | A file still Uploading | Banner "Uploading" with a progress bar; the preview shows the name, "Uploading" and placeholder lines | | |
| FP-40 | Processing banner | A file still Processing | Banner "Processing" with a spinner; preview shows "Processing" | | |
| FP-41 | Info card in Trash | In Trash | Path "Library / Trash", no Delete, Manage access hidden | | |
| FP-42 | Keyboard | Tab through the page | Order is top bar, preview, card, dock; focus is visible | | |
| FP-43 | Deep link refresh | Reload on a File page | The same file opens | | |
| FP-44 | Citation focus | **app-only** Open a file through a citation | Passage, row, or recording time is highlighted and scrolled into view with a "Cited passage", "Cited row" or "Cited" label | | |

## 10. File previews (PRV)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| PRV-01 | Heading | Open any file | Title as heading, and a sub line "`<Type>` · .`<ext>`" | | |
| PRV-02 | PDF | Open a PDF | Readable pages, each section labelled "Page 1", "Page 2" | | |
| PRV-03 | Document | Open a DOCX or Markdown | Text is readable | | |
| PRV-04 | Spreadsheet | Open an XLSX | A table with a header row and rows | | |
| PRV-05 | CSV | Open the CSV | Table with header and rows; a very large CSV does not freeze the tab | | |
| PRV-06 | Row number column | A sheet whose first column is "Row" | Row numbers are styled apart | | |
| PRV-07 | Image | Open an image | The image in a frame with a caption | | |
| PRV-08 | Audio | Open the recording | A player: Play/Pause button (name toggles "Play"/"Pause"), a track, and the length | | |
| PRV-09 | Transcript | Look under the player | Lines with a time (`0:05`) and the text | | |
| PRV-10 | Audio play | Press Play | Audio plays; the button flips to Pause | | |
| PRV-11 | Preview fails | Break the file URL [sim] | A clear message in the preview, the page and info card still work | | |
| PRV-12 | Scroll | A long document | Preview scrolls; info card and dock stay in place | | |
| PRV-13 | Narrow window | Open at 800 px and 390 px | Info card does not cover the preview, or collapses | | |

## 11. Share dialog (SHARE)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| SHARE-01 | Opens | Share a file you own | Dialog titled "Share `<file name>`" | | |
| SHARE-02 | One file | Try to share several at once | Not possible; Share works on one file at a time | | |
| SHARE-03 | Add field | Look at the field | Placeholder "Add people or the whole workspace" | | |
| SHARE-04 | Suggestions | Focus the field | Lists people and "Whole workspace" with the line "Everyone in Souvenir" | | |
| SHARE-05 | Filter people | Type part of a name | The list narrows | | |
| SHARE-06 | Already has access | Look for people who can already open it | They are not offered again, or are marked | | |
| SHARE-07 | Pending chips | Pick two people | Chips appear in "People to add", each with a remove button "Don't add `<name>`" | | |
| SHARE-08 | Remove a chip | Press it | The person is not added | | |
| SHARE-09 | Confirm | Press the share button | Message "Shared with `<names>`" with an Undo action | | |
| SHARE-10 | Viewer only | Look for roles | Every share is Viewer. No Editor or Ask-only choice | | |
| SHARE-11 | Info line | Read the line | "Teammates can use shared files in their chats and routines." | | |
| SHARE-12 | Who has access list | Read | Heading "Who has access", you with "Owner", then each person with "Viewer" or the workspace | | |
| SHARE-13 | Empty list | A private file | "Only you" | | |
| SHARE-14 | Remove access | Press the remove button on a person (tooltip "Remove access") | Confirmation "Remove `<name>`?" | | |
| SHARE-15 | Remove text | Read it | "`<name>` loses the file now. Answers already received stay in their history." For the workspace: "People with access only through the workspace lose the file now..." | | |
| SHARE-16 | Remove confirmed | Confirm | Message "`<name>` removed" ("Workspace removed"); the Access avatars update at once | | |
| SHARE-17 | Direct plus workspace | Share to Sam directly and to the workspace, then remove the workspace | Sam keeps access through the direct share | | |
| SHARE-18 | Direct removal only | Share to Sam directly only, remove Sam | Sam has no access | | |
| SHARE-19 | Undo | Press Undo on the share message | "Sharing undone"; the people lose access | | |
| SHARE-20 | Undo lifetime | Wait | **app-only** Record how long Undo stays | | |
| SHARE-21 | Share with workspace | Add "Whole workspace" | Access column shows the building circle | | |
| SHARE-22 | Cancel | Close without sharing | No change | | |
| SHARE-23 | Viewer cannot open | **[2 users]** Open Share as a viewer | Not possible (disabled with the tooltip) | | |
| SHARE-24 | Server permissions | **app-only** Call the share API as a viewer | The server refuses it | | |
| SHARE-25 | Dialog behaviour | Escape, Tab, focus return | Escape closes it, focus is trapped in the dialog, and returns to the trigger | | |

## 12. Rename (REN)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| REN-01 | Opens | Menu, then Rename | Dialog titled "Rename" with a field named "Name" holding the current name | | |
| REN-02 | Save | Change the name, press Save | Message "Renamed"; the new name shows in tables, cards, file page, picker | | |
| REN-03 | Enter key | Press Enter in the field | Saves | | |
| REN-04 | Empty name | Clear the field | Save is blocked | | |
| REN-05 | Whitespace | Only spaces | Blocked or trimmed | | |
| REN-06 | Same name as another | Rename to an existing name | Allowed; duplicates are normal | | |
| REN-07 | Extension | Rename without or with another extension | Record what happens to the extension | | |
| REN-08 | Long name | 300 characters | Handled by the limit, with a clear message | | |
| REN-09 | Cancel | Press Cancel | No change | | |
| REN-10 | Viewer | **[2 users]** | Not possible | | |
| REN-11 | Persistence | Reload | **app-only** The new name stays | | |

## 13. Delete and Trash (TR)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| TR-01 | Delete dialog title | Menu, then Delete | "Move `<file name>` to Trash?" | | |
| TR-02 | Usage rows | Delete a used and shared file | Three rows: chats ("1 chat" / "`<n>` chats" with names, "+`<n>`" past two), routines (same), and "Shared with" (names or "No one") | | |
| TR-03 | Unused file | Delete a file nobody uses | "0 chats" with "None", "0 routines" with "None", "Shared with" "No one" | | |
| TR-04 | Dialog line | Read it | "Recoverable for 30 days. Answers already written stay as they are." | | |
| TR-05 | Buttons | Look | Cancel, and a red "Move to Trash". Red is used only for delete actions | | |
| TR-06 | Confirm | Press it | The file leaves every list. Message "`<name>` moved to Trash" with a "Restore" action | | |
| TR-07 | Undo from message | Press Restore in the message | The file returns to where it was | | |
| TR-08 | Cancel | Press Cancel | No change | | |
| TR-09 | Delete from the file page | Use the card's Delete | Same dialog, then back to the list | | |
| TR-10 | Trash banner | Open Trash | Grey banner: "Restore files you've deleted. Files are deleted forever after 30 days." | | |
| TR-11 | Frees up | Open Trash with files | Plain text "Frees up `<size>`" beside Empty Trash (sum of sizes: KB, MB or GB with the right decimals) | | |
| TR-12 | Frees up hidden | Empty Trash | No "Frees up" text | | |
| TR-13 | Columns | Look at the table | Name, Days left, Size, Deleted, and an actions column. Named "Trash" | | |
| TR-14 | Days left | Read | "30 days" for a fresh delete, "1 day" singular | | |
| TR-15 | Deleted column | Read | Date and time of deletion | | |
| TR-16 | Order | Delete two files | Most recently deleted first | | |
| TR-17 | Deleted by another | **[2 users]** Admin deletes a workspace file owned by someone else | The Admin sees a sub line "Deleted by You" in their Trash and the owner sees "Deleted by `<name>`" | | |
| TR-18 | Row menu | Open "More" in Trash | Only "Restore" and "Delete forever" (red) | | |
| TR-19 | Restore | Press Restore | The file leaves Trash. Message "Restored `<name>`". It returns with its shares and routine attachments | | |
| TR-20 | Restore many | Restore two in a row | Message "Restored 2 files" or one each, as built | | |
| TR-21 | Delete forever dialog | Press Delete forever | "Delete `<name>` forever?" with "This frees up `<size>` and can't be undone." and a red "Delete forever" | | |
| TR-22 | Delete forever confirm | Confirm | Row goes. Message "`<name>` deleted forever" | | |
| TR-23 | Link after forever | Open the old link | "No longer available" | | |
| TR-24 | Empty Trash button | Look at it | Outline button "Empty Trash", disabled when Trash is empty or loading | | |
| TR-25 | Empty Trash dialog | Press it | "Delete `<n>` files forever?" ("1 file" singular), "This frees up `<size>` and can't be undone.", and a red "Empty Trash" | | |
| TR-26 | Empty Trash confirm | Confirm | Trash is empty. Message "`<n>` files deleted forever" | | |
| TR-27 | Trash empty state | Open it empty | "Trash is empty" with a trash icon | | |
| TR-28 | Trash loading | Force loading [sim] | Skeleton rows; Empty Trash disabled | | |
| TR-29 | Trash error | Force error [sim] | "Couldn't load your files" with "Try again" | | |
| TR-30 | Trash with a shared file | **[2 users]** Delete a file shared with Maya | Maya's Library and Shared drop it at once; its citations read "File deleted" | | |
| TR-31 | Delete a used file | Delete a file a routine uses | The routine warns before its next run | | |
| TR-32 | Search excludes Trash | Search a trashed name | Not found | | |
| TR-33 | Picker excludes Trash | Open Add from Library | Not listed | | |
| TR-34 | 30-day expiry | **app-only** A file past 30 days | It is removed on its own, and Days left counts down | | |
| TR-35 | Delete chat | Delete a chat with saved files | Dialog "Delete `<chat>`?" with a checkbox "Also delete these files", or the line "No saved files." | | |
| TR-36 | Delete chat, keep files | Delete the chat, leave the box unticked | Files stay in Library | | |
| TR-37 | Delete chat, also files | Tick it | Files go to Trash; "Chat restored" undo brings the chat back | | |
| TR-38 | Server permissions | **app-only** Delete someone else's private file by API | Refused | | |

## 14. Add from Library picker (PICK)

Opened from the chat "+" menu ("Add from Library") and from a routine ("Attach").

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| PICK-01 | Menu entry | Open "+" in a chat | Entries "Add photos & files" and "Add from Library", as wide as the composer, below it on a new chat and above it in a chat | | |
| PICK-02 | Dialog | Choose Add from Library | Dialog "Add from Library" with a search box "Search Library", a layout toggle, a Filter button, a list | | |
| PICK-03 | List rows | Look | Icon, name, and a line with the Created time. Duplicates read "Uploaded `<date>`" | | |
| PICK-04 | Order | Look | Most recently used first | | |
| PICK-05 | Contents | Compare with All files | Active, Ready files you can open. No Trash, no Uploading | | |
| PICK-06 | Search | Type | Matches file names only (not content) | | |
| PICK-07 | Clear | Press the X | Search empties | | |
| PICK-08 | Filter | Open it | "File type" with PDFs, Documents, Sheets, Images, Audio, Run outputs; one choice at a time | | |
| PICK-09 | Filter dot | Choose one | A dot on the button and "Filter, on"; "Clear" in the panel resets it | | |
| PICK-10 | Run outputs | Choose Run outputs | Only routine outputs | | |
| PICK-11 | Grid toggle | Press "Grid view" | Cards; the button becomes "List view" | | |
| PICK-12 | Pick | Click two rows | Check marks; footer reads "2 selected" | | |
| PICK-13 | Unpick | Click one again | Mark clears; count falls | | |
| PICK-14 | Multi-select aria | Inspect | List is `role=listbox` with `aria-multiselectable`, rows `role=option` with `aria-selected` | | |
| PICK-15 | Add button | Look | Disabled with no pick. Reads "Add to chat" for a chat and "Attach" for a routine | | |
| PICK-16 | Add to chat | Confirm | The files appear as attachments in the composer showing only the name and type | | |
| PICK-17 | Already added | Reopen with a file already attached | Its row reads "Added", shows a check and cannot be picked | | |
| PICK-18 | Attach to routine | From a routine | Message "Attached to `<routine>`" | | |
| PICK-19 | Cancel | Press Cancel or Escape | Closes, nothing attached | | |
| PICK-20 | No match | Search nonsense | "No files found" | | |
| PICK-21 | Loading, error, empty | Force each [sim] | Skeleton rows; "Couldn't load your files"; "No files found" | | |
| PICK-22 | Not Ready attach | Try to attach a Processing file | Not offered | | |

## 15. List states (ST)

All [sim].

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ST-01 | Suggested loading | Slow the files request | Card placeholders: one row of 5 cards, plus a row of 3 tiles for each tile section that will exist. `aria-busy` and label "Loading files" | | |
| ST-02 | All files loading | Same | Row placeholders in a table | | |
| ST-03 | Shared loading | Same | Row placeholders | | |
| ST-04 | Error | Fail the request | "Couldn't load your files" with "Try again" on Suggested, All files and Shared | | |
| ST-05 | Try again | Press it after fixing the request | The list loads | | |
| ST-06 | Empty states | Return an empty list | Suggested and All files: "No files yet", "Attach a file in a chat", "New chat". Shared: "Nothing shared with you yet". Trash: "Trash is empty" | | |
| ST-07 | Empty clears leftovers | Empty list | No tab count and no unread dot remain | | |
| ST-08 | 401 | Session expired | Redirect to login, no raw error | | |
| ST-09 | 403 | Forbidden | A clear message, no crash | | |
| ST-10 | 404 on a file | File missing | "No longer available" | | |
| ST-11 | 500 | Server error | Same as ST-04 | | |
| ST-12 | Offline | Go offline | Error state, and recovers when online and retried | | |
| ST-13 | Route errors | Throw in a Library route | The route error boundary shows, and the rest of the app still works | | |
| ST-14 | Route loading | Navigate between Library routes | Route loading screens match the page shape | | |

## 16. Responsive (RESP)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| RESP-01 | 1440 px | Open All files | All five columns and the actions column | | |
| RESP-02 | Narrowing | Narrow the window gradually | The Source column hides first, then Access. Shared hides Type | | |
| RESP-03 | Header tools | Narrow | The Filter, Sort, search and Trash row wraps without overlap | | |
| RESP-04 | 390 px | Open every tab | No horizontal page scroll, 16 px side gutter, buttons stay tappable | | |
| RESP-05 | Menus on phone | Open a row menu | Fully on screen | | |
| RESP-06 | Dialogs on phone | Open each dialog | Fits; footer buttons visible without scrolling the page | | |
| RESP-07 | File page on phone | Open a file | Preview readable; info card reachable | | |
| RESP-08 | Suggested on phone | Open | Cards and tiles reflow | | |
| RESP-09 | Zoom | 200% browser zoom | Still usable | | |

## 17. Accessibility (A11)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| A11-01 | Keyboard reach | Tab through every tab | Every card, tile, row name, menu button, filter, sort, tab is reachable, in a sensible order | | |
| A11-02 | Enter opens | Focus a card or tile | Enter opens it | | |
| A11-03 | Escape | Open Filter, Sort, a row menu, a dialog | Escape closes each | | |
| A11-04 | Focus ring | Tab around | A visible focus style on all controls | | |
| A11-05 | Not by colour alone | Look at unread, Generated, Trash, errors | Each shows an icon or a word as well as colour (unread dot has a label and a heavier name; Generated has the sparkle) | | |
| A11-06 | Icon buttons named | Inspect | Filter, Sort, Trash, More, Close, Download, File info, Clear search all have accessible names | | |
| A11-07 | Sort announcements | Screen reader | Headings announce ascending, descending or none | | |
| A11-08 | Tab roles | Screen reader | Tablist and tabs announce correctly | | |
| A11-09 | Dialog focus | Open and close a dialog | Focus moves in, is trapped, and returns | | |
| A11-10 | Toast live region | Trigger a message | It is announced and has one action | | |
| A11-11 | Contrast | Check text and avatars (soft tints) | At least 4.5:1 for text, 3:1 for icons | | |
| A11-12 | Reduced motion | Enable it | Spinners and scroll-to-cite do not animate heavily | | |
| A11-13 | Dark theme | Switch the theme | Every Library screen, the sparkle, avatars and chips are legible | | |

## 18. Messages and wording (COPY)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| COPY-01 | Vocabulary | Read all Library text | Uses File, Trash, Upload, Output, Run output, Routines. Never Item, Shelf, Folder, Collection or Schedules | | |
| COPY-02 | One black action | Look at each screen and dialog | One primary black action; red only for Delete | | |
| COPY-03 | Message size | Trigger messages | A few words and at most one action | | |
| COPY-04 | No paragraphs | Look at lists, banners, dialogs | A title, rows and at most one short line. Hints sit behind an info icon | | |
| COPY-05 | Switches | Look at any switch | No On or Off word beside it | | |
| COPY-06 | Message list | Trigger each | "Shared with `<names>`", "Sharing undone", "`<name>` removed", "Renamed", "`<name>` moved to Trash", "Restored `<name>`", "`<name>` deleted forever", "`<n>` files deleted forever", "Downloading `<name>`", "Request sent", "Attached to `<routine>`" | | |
| COPY-07 | Plural forms | Cases with 1 and 2 | "1 file" and "2 files", "1 day" and "5 days", "1 chat" and "2 chats" | | |
| COPY-08 | Message cap | Trigger four messages quickly | At most 3 show at once | | |

## 19. Edges across Library (EDGE)

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| EDGE-01 | Two same-name files stay separate | Upload the same name twice | Two files, same name, Created tells them apart. Neither replaces the other | | |
| EDGE-02 | Identical content twice | Upload the exact same file twice | Two files (the PRD says separate), record if the backend merges them | | |
| EDGE-03 | Reload keeps place | Reload on each tab | The same tab and file | | |
| EDGE-04 | Two tabs | Delete a file in one tab, act on it in the other | A clear "No longer available" instead of a crash | | |
| EDGE-05 | Rapid actions | Double-click Move to Trash | One delete only | | |
| EDGE-06 | Rapid share | Double-click the share button | One share only | | |
| EDGE-07 | Large library | **app-only** 1,000+ files | Lists stay responsive, scrolling smooth | | |
| EDGE-08 | Huge file | **app-only** 100 MB file | Handled per the size limit, with a clear message if over | | |
| EDGE-09 | Zero-byte | **app-only** Upload an empty file | Rejected with a short message, no file saved | | |
| EDGE-10 | Rejected uploads | **app-only** Password-protected, unsupported, unsafe | A short message with no file name, nothing in Library | | |
| EDGE-11 | Unicode names | Names in Arabic, Tamil, Chinese | Render and sort without breakage | | |
| EDGE-12 | Time zone | **app-only** Change the browser time zone | Created times follow it | | |
| EDGE-13 | Session end | Expire the session on a File page | Goes to login and returns to the file after | | |
| EDGE-14 | Removed member's files | **[2 users]** Admin removes a member | Files go or transfer per the leaver's answer; they vanish from lists, Shared and the picker | | |
| EDGE-15 | Storage figure | Compare "used" with the sum of file sizes | **app-only** The figure follows uploads and deletes | | |

## 20. Library from other surfaces (X)

These cross the Library boundary but change what Library shows.

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| X-01 | Chat send saves | Attach a file in chat, wait until Ready, send | The file is in All files, Source Uploaded, Created now, provenance links to that chat. No message is shown | | |
| X-02 | Send held | Attach a file still Uploading | Send is off until every file is Ready | | |
| X-03 | Not in Library before send | Attach a file, do not send | Not in All files, search or the picker | | |
| X-04 | Remove before send | Remove the chip | File is gone, never in Library | | |
| X-05 | Auto-save: Always | Setting Always | Files save without asking | | |
| X-06 | Auto-save: Ask each time | Setting Ask | Dialog "Save 1 file to Library?" (or "Save `<n>` files to Library?") before saving | | |
| X-07 | Auto-save: Never | Setting Never | Nothing saves and a message says so | | |
| X-08 | Force-off | **[2 users]** Admin forces off | Members see "Your Admin has turned this off" and nothing saves | | |
| X-09 | Chat output | A chat creates a document | Shows in All files with the sparkle, Source Generated, "AI-generated" badge on its file page | | |
| X-10 | Routine run output | Run a routine | A "Run of `<label>`" file in All files, Source Generated. Message-only and failed runs add no file | | |
| X-11 | Citation open | Open a chat citation | Opens the File page with the passage highlighted. Locked citation offers Request access | | |
| X-12 | Deleted citation | Cite then delete the file | Citation reads "File deleted" and shows no title | | |
| X-13 | Ask about this | From Library | New chat with the file attached, as in MENU-04 | | |
| X-14 | AI reference switch | **[2 users]** Admin turns AI reference off | "Search my Library" is off in settings; attaching by hand still works | | |

---

## 21. Roles: Admin, Member, owner, viewer, no access (ROLE)

The prototype has three people in "Viewing as": **You** (Alex, the Admin), **Maya** and **Sam** (Members). In the app this needs an Admin login and at least one Member login, so every case here is **[2 users]**. Use the same files for each person so the rows can be compared.

### 21.1 What each person can do with one file

The prototype's rule table (`flows.md` section 3), one row at a time. Run each row as the owner, as a viewer (shared directly or through the workspace), and as someone with no access.

| ID | Action | Owner | Viewer | No access | Result | Notes |
|---|---|---|---|---|---|---|
| ROLE-01 | See it in All files, search, picker | listed | listed (and in Shared) | not listed anywhere, no name leaks | | |
| ROLE-02 | Open the File page | opens | opens | "You don't have access", "Ask the owner to share it", Request access | | |
| ROLE-03 | Ask about this | enabled | enabled | not reachable | | |
| ROLE-04 | Download | enabled | enabled | not reachable | | |
| ROLE-05 | Rename (menu, title pill, pencil in File info) | enabled | turned off, "Only the owner can change this" | hidden | | |
| ROLE-06 | Share and Manage access | enabled | turned off, same tooltip | hidden | | |
| ROLE-07 | Delete (menu and File info) | enabled | turned off, same tooltip | hidden | | |
| ROLE-08 | Who has access | full list | names only, same list | not shown | | |
| ROLE-09 | "You:" line in File info | "You: Owner" | "You: Viewer" | n/a | | |
| ROLE-10 | Restore in the File page Trash banner | Restore shown | n/a (file leaves their lists) | n/a | | |
| ROLE-11 | Trash screen | lists the file | not listed | not listed | | |
| ROLE-12 | Server check | **app-only**: call the rename, share and delete APIs as a viewer and with no access | | refused (403 or 404), nothing changes | | |

### 21.2 Admin over workspace-shared files

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ROLE-13 | Admin can manage a workspace file | As a Member, share a file with the whole workspace. As the Admin, open it | Rename, Share and Delete enabled. File info reads "You: Admin, can manage" | | |
| ROLE-14 | Admin cannot open private files | As a Member, keep a file private. As the Admin, search for it and open its link | Not listed; the link shows the locked page | | |
| ROLE-15 | Admin deletes a Member's workspace file | As the Admin delete it, then open Trash as both | The Admin's Trash lists it (they deleted it). The owner's Trash lists it with "Deleted by `<Admin name>`" | | |
| ROLE-16 | Admin with a direct share only | A Member shares a file with the Admin directly, not the workspace | The Admin is a plain viewer: Rename, Share, Delete turned off | | |

### 21.3 The same screens as each person

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ROLE-17 | Tabs per person | Open Library as the Admin and as each Member | Everyone sees Suggested and All files. Shared shows only for people with something shared with them | | |
| ROLE-18 | Each sees own files | Compare All files | Each list holds that person's own files plus files shared with them, nothing else | | |
| ROLE-19 | Generated row per person | Suggested as a Member with no runs | No Generated section | | |
| ROLE-20 | Run outputs are private | The Admin runs a routine; a Member opens All files with Source: Generated | Not listed for the Member. Its File info for the Admin reads "Private" | | |
| ROLE-21 | Access column is the same for everyone | Open one shared file's row as owner and as viewer | Same avatars, same order, same tooltip, e.g. "Owner: Maya. Shared with You and Sam" | | |
| ROLE-22 | Unread per person | Share a file with a Member | Unread dot for that Member only, never for the owner | | |
| ROLE-23 | Admin pages hidden | As a Member open Settings | No Library settings, Audit log or Inventory under Workspace. Their URLs refuse a Member | | |
| ROLE-24 | Admin notice for Members only | The Admin changes a Library setting | Members see "Your Admin changed Library settings" in Library; the Admin does not | | |

### 21.4 Admin settings that change Library

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| ROLE-25 | Admin page rows | As the Admin open Settings, Library settings | Saving files (Auto-save default; Force auto-save off, "Files stay in their chat"), Souvenir (AI reference, "Search Library in answers"), Files (File size limit, File types), Storage. An "Admin" badge and the tip "These apply to everyone. Members see a short notice when you change them." | | |
| ROLE-26 | Storage row | Read it | "`<used>` of `<total>` used" with a bar and rows for Files, Images and Audio | | |
| ROLE-27 | Auto-save default | Set it to Ask each time | A Member who never chose their own setting sees "Ask each time" in Settings, Library, and sending a file asks "Save 1 file to Library?" | | |
| ROLE-28 | Member's own choice wins | The Member sets Always, then the Admin changes the default | The Member keeps Always | | |
| ROLE-29 | Force auto-save off | Turn it on | Auto-save default is turned off. Members' "Save files from chats" shows Never, turned off, with "Your Admin has turned auto-save off". A sent file stays in the chat, not in Library | | |
| ROLE-30 | AI reference off | Turn it off | Members' "Search my Library in chats" is off and turned off with "Your Admin turned this off". Chats show "Your Admin has turned off Library search. Attaching files still works." Browsing, search and Add from Library still work | | |
| ROLE-31 | AI reference off, asking | Ask "What is our return window?" with nothing attached | "I couldn't find this in your files." Attach the file and ask again: a normal answer | | |
| ROLE-32 | File size and type limits | Change them, then upload over the limit and a blocked type | A short message, nothing saved | | |
| ROLE-33 | Phase 2 pages | Open Audit log and Inventory | Static pages with a "Phase 2" badge | | |
| ROLE-34 | Remove a member | Members, Remove on a Member, confirm | Their row reads "Waiting for their answer"; message "Waiting for `<name>` to answer" | | |
| ROLE-35 | The leaver's question | Log in as that Member | A locked dialog "`<Admin> is removing you`" with "Transfer your shared files to other members?", "Yes, transfer", "No, delete them", and "Files you never shared are deleted either way." It cannot be closed | | |
| ROLE-36 | Yes, transfer | Choose it and confirm | Workspace shares and shares with the Admin go to the Admin; other shared files go to the first person they were shared with; unshared files are deleted. Message "`<name>` removed. `<n>` files transferred." | | |
| ROLE-37 | No, delete them | Repeat with another Member and No | Their shared files are deleted outright (not to Trash). The message says how many | | |
| ROLE-38 | After removal | Look at every file | The person is gone from Who has access, the Access column and the share list, and cannot use the workspace | | |
| ROLE-39 | Their routines | The removed person owned a routine | It is paused and handed to the Admin with its run outputs | | |
| ROLE-40 | Leave on your own | As a Member: Settings, Library, Leave Souvenir | The same question appears; Cancel closes it | | |
| ROLE-41 | The only Admin cannot leave | As the only Admin | Leave is turned off with "Name another Admin first" and does nothing | | |

## 22. File state (FS)

The prototype's top bar has a "File state" switch: **As saved, Uploading, Processing, Ready, In Trash, Locked**. In the app these states come from real files, so produce each one as the Setup column says, then check every place a file can appear.

Phases: Uploading, Processing, Ready. Life: Active, Trash, Pending (attached to an unsent message), Chat only (sent, not saved).

### 22.1 Each state on the File page

| ID | State | Setup in the app | Expected on the File page | Result | Notes |
|---|---|---|---|---|---|
| FS-01 | Ready (active) | any saved file | Preview, File info, Ask dock, Share and Download in the top bar. No banner | | |
| FS-02 | Uploading | open the file id while it uploads [sim: hold the upload] | Banner "Uploading" with a progress bar. Preview shows the name, "Uploading" and placeholder lines. No Ask dock; Ask about this turned off | | |
| FS-03 | Processing | hold the processing step [sim] | Banner "Processing" with a spinner, preview "Processing", no Ask dock, Ask about this turned off | | |
| FS-04 | In Trash, owner | delete it, open its link as the owner | Banner "In Trash", "`<n>` days left", Restore. No Share, Delete or Manage access; path "Library / Trash"; no Ask dock | | |
| FS-05 | In Trash, someone else | open the same link as a former viewer | "No longer available" with "Back to Library", no title | | |
| FS-06 | Locked | open a file you have no access to | "You don't have access", "Ask the owner to share it", Request access, then "Request sent". No title | | |
| FS-07 | Gone | Delete forever, or a made-up id | "No longer available", no title | | |
| FS-08 | Pending | attach a file in a chat, don't send, open its id | "No longer available" | | |
| FS-09 | Chat only | send a file with auto-save Never (or "Don't save files from this chat"), open its id as the sender, then as someone else | Sender: it opens. Anyone else: "No longer available" | | |
| FS-10 | Next file | after viewing a file in one state, open another file | The second file shows its own state (the prototype resets its switch to "As saved") | | |

### 22.2 Each state across Library

| ID | Place | Uploading or Processing | Ready (active) | In Trash | Pending | Chat only | No access | Result | Notes |
|---|---|---|---|---|---|---|---|---|---|
| FS-11 | Suggested | hidden | shown | hidden | hidden | hidden | hidden | | |
| FS-12 | All files | hidden | shown | hidden | hidden | hidden | hidden | | |
| FS-13 | Shared (viewer) | hidden | shown | hidden | n/a | n/a | hidden | | |
| FS-14 | Search | hidden | shown | hidden | hidden | hidden | hidden | | |
| FS-15 | Add from Library | hidden | shown | hidden | hidden | hidden | hidden | | |
| FS-16 | Routine attach | not attachable | attachable | next run skips it, pane says so | n/a | n/a | n/a | | |
| FS-17 | Citations | never cited | cited, opens the passage | "File deleted", no title | n/a | not cited for others | "Locked file", opens the locked panel | | |
| FS-18 | Trash screen | n/a | n/a | listed with Days left (owner) | n/a | n/a | n/a | | |
| FS-19 | Composer chip | shows the phase | (sent) | n/a | shown until sent | n/a | n/a | | |
| FS-20 | Storage line | **app-only**: record whether Trash and Pending files count toward "used" | | | | | | | |

### 22.3 Changing state

| ID | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| FS-21 | Processing to Ready | Watch a sent file finish | It appears in All files without a reload | | |
| FS-22 | Trash keeps shares | Share, delete, restore | The same people have access after Restore | | |
| FS-23 | Deleted while a viewer has it open | The owner deletes it while the viewer is on its File page | On the next action or refresh: "No longer available" | | |
| FS-24 | Trash to gone | Delete forever | Every link reads "No longer available" | | |
| FS-25 | Pending to gone | Remove the chip before sending | Nothing in Library; the id reads "No longer available" | | |
| FS-26 | Rejected upload | Password-protected, unsupported or unsafe file | Never becomes a file. A short message with no file name above the composer, cleared after 6 seconds | | |

## 23. Flows A to H (FLOW)

These are the prototype's own test flows (`lib/data.ts`, `flows`). Run each one from its start state, follow the steps, then mark every check. IDs are the flow letter, then C for a check or D for a depth check, in the prototype's order (A-C01 is Flow A, check 1). **Also see** points to the single cases above that test the same thing in detail.

Sample names come from the prototype; use the matching file from the test data table.

### Flow A. Capture and reuse

Start: a new chat, auto-save on its default (Always).

1. Add a file with "Add photos & files" in the + menu. Also try failing files (password-protected PDF, .exe, an unsupported type).
2. Watch the chip show Uploading, then Processing. Try to send while it is Processing.
3. Send once it has finished. No message appears. Open All files and find the saved file.
4. In a new chat, open Add from Library, pick Return policy 2026 and the file you sent, and ask "What is our return window?"
5. Click the citation.
6. Add the audio file from Library and ask anything about it.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| A-C01 | Files from chats save to Library by default (Always) with no prompt. Changing it is in Settings, Library | X-05 | | |
| A-C02 | The chip shows Uploading, then Processing, and Send stays off until every attached file has finished | X-02 | | |
| A-C03 | Until the message is sent, the file is not in All files, the picker or search, and removing it with its X deletes it | X-03, X-04, FS-08 | | |
| A-C04 | With Ask each time, sending asks "Save 1 file to Library?" with Save as the default. With Never, nothing is saved | X-06, X-07 | | |
| A-C05 | The new row shows only your avatar under Access, Source Uploaded and the Created date; provenance reads "Uploaded by You" with a link to the chat | X-01, ALL-11, FP-12 | | |
| A-C06 | Sending the same file again saves a separate file with the same name; Created tells them apart | EDGE-01, EDGE-02 | | |
| A-C07 | A failed, password-protected, unsupported or unsafe upload never becomes a file: no chip, no row, nothing saved. Only a short message with no file name, at once, above the composer, cleared after 6 seconds | FS-26, EDGE-10 | | |
| A-C08 | Add from Library has search, a file type filter, a list and grid toggle, and multi-select. Each file shows its date and time; "N selected" shows the count | PICK-02 to 12 | | |
| A-C09 | The answer has a citation chip that opens the file with the cited passage highlighted | X-11, FP-44 | | |
| A-C10 | The Sources panel marks the file as cited and lets you switch a source off for the rest of the chat | — | | |
| A-C11 | With a recording attached, a transcribing step shows, then an answer whose citation opens the recording at the cited time | PRV-08, PRV-09 | | |
| A-C12 | Files come in through a chat. Library has no Upload button, no Uploads tray, no drop area. (The prototype's "Sample files" top-bar item is prototype-only: N/A) | NAV-13, NAV-14 | | |
| A-C13 | Turn off "Search my Library in chats". Ask "What is our return window?" with nothing attached: "I couldn't find this in your files." Attach the policy and ask again: the answer | ROLE-31 | | |
| A-C14 | More, "Don't save files from this chat": a file sent there is not saved and shows "Not saved. This chat doesn't save files." | FS-09 | | |
| A-C15 | The + menu has Add photos & files and Add from Library, as wide as the composer, below it on a new chat and above it in a chat. A .exe is blocked, a .zip-like type is not supported, the rest upload. Opening the menu clears any upload message | PICK-01 | | |
| A-D01 | A failed upload has no Retry or Delete, only a message. Uploading it again gives the same message | FS-26 | | |
| A-D02 | Switch off Return policy 2026 in Sources and ask "What is our return window?" again: "I couldn't find this in your files." and "1 source switched off." Switch it on, ask again: the answer | — | | |
| A-D03 | Removing a file with its X while Uploading or Processing leaves nothing: no chip, nothing in Library | FS-25 | | |

Afterwards: the new file is in All files, Source Uploaded, Created today, provenance linking to the chat.

### Flow B. Set up a routine

Start: a new chat.

1. Ask for a routine that drafts product copy every Monday.
2. On the Routine details card press Attach both, then Create routine.
3. On the Routine created card press Open routine. It opens in a pane on the right.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| B-C01 | Before anything is created, a Routine details card asks "Attach the Return policy and Shipping rates?" with Attach both and Not now | — | | |
| B-C02 | After Create routine, the Routine created card shows the name, schedule, delivery, attached files and "Test run: Done." All files with Source: Generated has one "Test run - product copy" | X-10 | | |
| B-C03 | The pane lists Attached files and lets you add or remove one | PICK-18 | | |
| B-C04 | "All run outputs in Library" in the pane and Run outputs on the card both open All files with Source: Generated ticked | SUG-19, FILT-26 | | |
| B-C05 | Routines lists the new routine. As another Member it is not there | ROLE-20 | | |
| B-C06 | Run now saves a run output "`<routine> - <date>`" listing the attached files, and adds a line to Run history | X-10, FP-17 | | |
| B-D01 | Ask again, press Not now, then Create routine: "Attached files: None", and the pane says "No files attached." | — | | |
| B-D02 | Create routine is greyed out until you choose Attach both or Not now | — | | |

Afterwards: one run output "Test run - product copy" in All files (Source Generated).

### Flow C. A routine run saves its output

Start: All files with Source: Generated ticked.

1. Open Routines, open the report routine, press Run now.
2. Open a message-only routine, press Run now.
3. Make a run fail (the prototype has "Simulate a failed run"; in the app use a routine that fails for real, or mark BLOCKED).
4. In All files find the new run output at the top. … menu, Delete, confirm.
5. Open Trash; on that run output, … menu, Restore. It is back in All files.
6. Log in as a Member and look at All files.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| C-C01 | A new run output is a row in All files, newest first, Source Generated, only your avatar under Access. Run now again adds another row. Runs are never removed on their own | ALL-05, ALL-07 | | |
| C-C02 | A message-only run adds a line to run history only; its pane says results stay in run history, not in Library | X-10 | | |
| C-C03 | A failed run is in run history and creates no file | X-10 | | |
| C-C04 | A run output's … menu is the ordinary file menu (Open, Ask about this, Share, Download, Rename, Delete), no Keep, and it has the Generated sparkle | MENU-01, ALL-05 | | |
| C-C05 | A deleted run output goes to Trash with days left; Restore brings it back | TR-06, TR-19 | | |
| C-C06 | Other Members see no run output in All files. Its File info says Private under Who has access | ROLE-20, FP-23 | | |
| C-C07 | After Run now, Slack (#ops) shows "`<routine>` is ready."; the message-only routine posts its line there. BLOCKED without Slack | — | | |
| C-C08 | File info says which routine and run made it, links to the routine, and lists Files this run used | FP-14, FP-17 | | |
| C-C09 | Run outputs are ordinary rows; no Routine outputs tab. "All run outputs in Library" and See all on Generated open All files with a Source: Generated chip; removing the chip brings every file back | SUG-19, FILT-16 | | |
| C-D01 | Pressing Run now twice quickly does not start two runs | EDGE-05 | | |
| C-D02 | Delete an attached file, open the routine: its pane says the next run skips it. After Run now the output lists only the others and history says "Skipped 1 file" | FS-16, TR-31 | | |

Afterwards: every run stays in All files, the restored one is back, the failed run left no file.

### Flow D. Ask in Slack

Start: a Slack channel the bot is in. **BLOCKED** unless the workspace is connected to Slack; if so, mark every row BLOCKED with that reason.

1. Ask "What is our return window?"
2. Ask "What are the Acme payment terms?"
3. Ask the Acme question again as a direct message.
4. Click the policy citation. Then, as a Member without access, open a chat that cites a file they can't open and click "Locked file".
5. Attach a file and send "save this to Library".
6. Ask "find the return policy".

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| D-C01 | The answer cites the Return policy and the citation opens its File page | X-11 | | |
| D-C02 | The Acme answer in a channel says it used only files everyone in the channel can open, and that one relevant file was left out, without naming it | — | | |
| D-C03 | As a direct message it cites the Acme contract, because you can open it | — | | |
| D-C04 | Without access, "Locked file" opens "You don't have access", and Request access becomes "Request sent" | FS-06, FP-34 | | |
| D-C05 | The bot confirms where the file was saved; it is in Library and its File page says "Uploaded by You in Slack" | FP-12 | | |
| D-C06 | "find the return policy" replies "Found 1 file." with a link to its File page. A file in Trash is not listed. In a channel only files everyone can open are listed | FS-14 | | |
| D-C07 | A file saved from Slack is private to the sender: nobody else sees it in Library | ROLE-18 | | |
| D-D01 | An attachment sent without "save this" is not saved, and the bot says how to save it | — | | |
| D-D02 | A question the bot can't answer gets a reply, not silence | — | | |

### Flow E. Share files

Start: the Admin on All files. **[2 users]**, ideally three.

1. Open Brand guidelines, choose Share.
2. Share it with two Members.
3. Log in as each Member; look at Shared and the file.
4. As the owner, add the whole workspace to Brand guidelines.
5. Remove one Member from Supplier contract - Acme, then look at it as that Member, including a chat that cited it.
6. In a chat type "@Souvenir share the Weekly sales report with `<Member>`".
7. In Slack type the same share for the other Member (BLOCKED without Slack).
8. As a Member, add the whole workspace to a file they own; open it as the Admin.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| E-C01 | The share dialog adds people or the whole workspace and says "Teammates can use shared files in their chats and routines." | SHARE-03, SHARE-04, SHARE-11 | | |
| E-C02 | "Who has access" lists each way a file is shared, e.g. "Shared directly" | FP-22, SHARE-12 | | |
| E-C03 | As each Member, the file is in Shared with an unread dot; Share, Rename, Delete turned off, each "Only the owner can change this" | SHD-11, ROLE-05 to 07 | | |
| E-C04 | Shared is one flat list (Name, Access, Date shared, Type), unread then newest, same Filter and Sort; unread dot right after the name; File info says how it was shared | SHD-01 to 07 | | |
| E-C05 | With a Member added directly and the workspace added, Who has access lists both. As that Member, Shared lists it once, and File info reads "You: Viewer" with both ways | FP-21, FP-22 | | |
| E-C06 | Removing a Member warns that answers they already received stay in their history but citations lock. As that Member, the file is gone from Shared and the citation reads "Locked file" | SHARE-15, SHD-12, FS-17 | | |
| E-C07 | Asking Souvenir to share shares as Viewer, confirms with Undo, and Undo removes access | SHARE-19 | | |
| E-C08 | A file you don't own, a name matching several files, or an unknown person gets a reply and nothing is shared. In a chat try "share Payment terms with Sam" (a file you don't own: "I can only share files you own."), "share the supplier contract with Maya" (several match: "Which one: …?") and "share the Weekly sales report with Lena" (unknown person: "Who should I share it with? …"). Use your own file and people names | — | | |
| E-C09 | In a Slack channel the confirmation doesn't name a file the channel can't all open. BLOCKED without Slack | — | | |
| E-C10 | As the Admin, a file a Member shared with the whole workspace can be renamed, shared, deleted; File info reads "You: Admin, can manage" | ROLE-13 | | |
| E-C11 | Removing a Member from a file that also has the workspace says they can still open it through the workspace; as that Member it stays in Shared and reads "Whole workspace" | SHARE-17 | | |
| E-D01 | "share Brand guidelines with Maya" (your Member) after step 2 replies "Maya can already open it."; the Share dialog doesn't offer people who already have access | SHARE-06 | | |
| E-D02 | The unread dot clears once the file is opened | SHD-10, FP-32 | | |

Afterwards: removing a Member who had only a direct share takes access away at once.

### Flow F. Delete and restore

Start: the owner on All files. Return policy 2026 is used by chats and a routine and shared with a Member; Return policy 2025 is already in Trash.

1. Open Return policy 2026, choose Delete.
2. Confirm. While it is in Trash: search "return", open Add from Library, ask "What is our return window?" in a new chat, open the routine that uses it and a chat that cited it. As the Member, look at Shared.
3. Open Trash and restore it from its … menu.
4. Open a chat with saved files: More, Delete chat, read, confirm, then Undo.
5. Open Trash as the owner and as the Member. Restore Return policy 2025 and find it in All files.
6. In Trash press Empty Trash, read it, Cancel. Delete forever one file, confirm, then open its old link.
7. Delete another file, open Trash, Empty Trash, confirm.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| F-C01 | The delete dialog lists where the file is used (chats, routines, shares) and the 30-day recovery window, and says answers already written are not rewritten | TR-01 to 05 | | |
| F-C02 | The file moves to Trash with days left; it leaves search and the picker at once, and the Member's Shared | TR-30, TR-32, TR-33 | | |
| F-C03 | Restore brings it back with its shares | TR-19, FS-22 | | |
| F-C04 | Deleting a chat with saved files asks whether to also delete them; by default they stay | TR-35, TR-36 | | |
| F-C05 | Delete is the only way to remove a file: no Archive in any menu or on the File page, no Archived tab | NAV-06, MENU-01 | | |
| F-C06 | A file already in Trash and private to the owner: the Member's Trash is empty; not in All files, search or picker; Restore brings it back | TR-19, FS-11 to 15 | | |
| F-C07 | Delete forever asks first; the file is then gone from Trash | TR-21, TR-22 | | |
| F-C08 | Trash: icon button top right, "Library > Trash", no storage label, grey banner with Empty Trash and "Frees up `<size>`" (follows deletes and restores, hidden when empty), columns Name, Days left, Size, Deleted, … with Restore and Delete forever. Empty Trash asks "Delete N files forever?" with "This frees up", Cancel keeps all, confirm removes all | NAV-15 to 18, TR-10 to 26 | | |
| F-C09 | A deleted file's link says "No longer available" and never shows its name | TR-23, FS-07 | | |
| F-C10 | After deleting a chat, the notice says how many files stay in Library (or went to Trash); Undo brings the chat back | TR-37 | | |
| F-C11 | While the file is in Trash, "What is our return window?" no longer cites it: "I couldn't find this in your files." | FS-17 | | |
| F-D01 | While it is in Trash, the routine says it is unavailable and the next run skips it | FS-16, TR-31 | | |
| F-D02 | While it is in Trash, its citation reads "File deleted", never the name | X-12, FS-17 | | |

Afterwards: after delete and restore, the file has its shares and routine attachment back.

### Flow G. Admin sets the switches

Start: the Admin in Settings, Library settings. **[2 users]**. Step 4 removes a Member: use throw-away Member accounts.

1. Read every row.
2. Set Auto-save default to Ask each time. Turn on Force auto-save off; turn off AI reference.
3. Log in as a Member: the Admin pages are gone. Open Settings, Library for the turned-off rows, then Library for the notice.
4. As the Admin: Members, Remove on the Member, confirm. As the Member: Yes, transfer, Confirm. Repeat with another Member for No, delete them.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| G-C01 | The Admin page lists Auto-save default, Force auto-save off, AI reference, File size limit, File types, Storage ("`<used>` of `<total>` used", a bar, Files, Images, Audio rows) | ROLE-25, ROLE-26 | | |
| G-C02 | With Force auto-save off on, the Member's "Save files from chats" shows Never, turned off, "Your Admin has turned auto-save off"; a sent file stays in the chat | ROLE-29, X-08 | | |
| G-C03 | With AI reference off, "Search my Library in chats" is off and turned off, "Your Admin turned this off"; chats show "Your Admin has turned off Library search. Attaching files still works."; browsing, search, Add from Library still work | ROLE-30, X-14 | | |
| G-C04 | As the Member the Admin pages are hidden and a short notice says defaults changed | ROLE-23, ROLE-24, NAV-24 | | |
| G-C05 | Audit log and Inventory are static pages marked "Phase 2" | ROLE-33 | | |
| G-C06 | Removing a member makes the leaver answer one mandatory question, "Transfer your shared files to other members?"; the removal can't finish until they do | ROLE-34, ROLE-35 | | |
| G-C07 | On Yes, the leaver's file shared with the Admin and another Member goes to the Admin and the other keeps access. On No it is deleted. An unshared file is deleted either way | ROLE-36, ROLE-37 | | |
| G-C08 | Before Force auto-save off, the Member's "Save files from chats" shows the Auto-save default; with Ask each time, sending asks "Save 1 file to Library?" | ROLE-27 | | |
| G-C09 | With AI reference off, "What is our return window?" answers "I couldn't find this in your files."; normal once the file is added to the chat | ROLE-31 | | |
| G-D01 | After removal the person shows as Removed in Members and is gone from Who has access on every file | ROLE-38 | | |
| G-D02 | As a Member, Settings, Library, Leave shows the same question and Cancel closes it. As the only Admin, Leave is turned off with "Name another Admin first" | ROLE-40, ROLE-41 | | |

Afterwards: the removed Member's shared file is the Admin's on Yes, gone on No.

### Flow H. Browse and find in Library

Start: the Admin on Suggested.

1. Read the header: title, storage label, search, Trash button, tabs.
2. On Suggested read Recent, Frequently used, Generated. Hover a card, open its …, press Escape. Open a card, close the file.
3. See all on Recent. Back on Suggested, See all on Generated, then remove its chip.
4. On All files click the Name and Created headings, then make the same choices with the Sort button.
5. Filter: tick Documents, then Generated, untick both, tick Uploaded and Audio. Remove a chip, then Reset.
6. Open the … menu on a PDF; look at every item. Download, then Ask about this, then come back. Don't confirm Delete.
7. Search "return", a phrase inside a file, a word in a name, and "zzz". Open a result, close it, clear the search. On Shared, search and switch between In Shared and All of Library.
8. Look at Filter and Sort on Shared. Open Trash and restore a file.
9. Log in as Members and open every tab. As a Member tick Generated.
10. Simulate Loading, Empty and Error on Suggested, All files, Shared and Trash, and Error on a search [sim]. Set it back.
11. Look for an Upload button. Drag a file over Library.
12. Narrow the window, then widen it.

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| H-C01 | The header reads Library (Search while searching) with the storage label beside the title on every tab, while searching and in every list state, not on Trash. On All files and Shared: Filter, Sort, search, Trash icon. No Upload | NAV-02 to 05, NAV-11, NAV-12 | | |
| H-C02 | Suggested and All files always show; Shared once something is shared, with an unread dot while any is unread; no Archived tab; the same rule for every person | NAV-06 to 10, ROLE-17 | | |
| H-C03 | Recent shows five cards, most recent first, each "Opened", "Modified" or "Shared" plus a short time ("Opened 2d ago"); an unopened share has the unread dot after its title | SUG-02 to 09 | | |
| H-C04 | Frequently used: up to three, "Opened N times", never repeats Recent. Generated: up to three run outputs, "Run of `<date>`", only for people with runs | SUG-14 to 20, ROLE-19 | | |
| H-C05 | See all on Recent opens All files with nothing ticked; on Generated, with Source: Generated. Frequently used has no See all | SUG-13, SUG-17, SUG-19 | | |
| H-C06 | A card or tile opens its file and closing returns to Suggested; … opens the menu without opening the file; cut-off names show in full on hover | SUG-10 to 12, SUG-21, SUG-22 | | |
| H-C07 | All files: Name, Access, Source, Created, Type, a … menu. Access avatars: owner alone, two avatars, owner plus "+2", or a building for the workspace; tooltip "Owner: X. Shared with Y and Z" or "Only you"; the same for every viewer. Source Uploaded or Generated. Created date and time, newest first | ALL-01 to 21 | | |
| H-C08 | Every Generated file has a soft-mint sparkle after its name; hovering or focusing it says where it came from ("Generated in `<chat>`", "Generated by the `<routine>` routine"); the unread dot follows it; no Shared chip | ALL-04, ALL-05 | | |
| H-C09 | Only Name and Created sort (Name and Date shared on Shared); they always show an arrow, the sorted one its direction; clicking again reverses; Access, Source, Type are plain labels | SORT-01 to 07 | | |
| H-C10 | Sort button: Name and Created (Name and Date shared on Shared), Newest first / Oldest first, A to Z / Z to A; the current choice is ticked and matches the heading; on Shared nothing is ticked until you choose | SORT-08 to 13 | | |
| H-C11 | Filter: Source (Uploaded, Generated, Shared) and File type (Images, Documents, Spreadsheets, PDFs, Audio), each with an icon and a tick; nothing ticked shows everything | FILT-01 to 04 | | |
| H-C12 | The count for each filter matches the data. (Prototype: 15 files; Generated 4, Uploaded 11, Shared 8, Audio 1, Images 1, Documents 2, PDFs 5, Spreadsheets 6.) In the app, write down the real counts and check each filter against them | FILT-05 to 11 | | |
| H-C13 | Two options in one section widen the list; one in each section narrows it (Generated plus Documents shows only the generated document) | FILT-06 to 08 | | |
| H-C14 | A section with ticks shows as a removable chip with the names or "3 picked", two chips at most; the chip's X clears that section; Reset clears everything | FILT-12 to 19 | | |
| H-C15 | Nothing matching: "No files match" with Reset filters. As a Member with no generated files, ticking Generated shows it | FILT-20, FILT-21 | | |
| H-C16 | The … menu: Open, Ask about this, Share, Download, Rename, Delete. Download downloads; Ask about this opens a new chat with the file attached | MENU-01 to 09 | | |
| H-C17 | As a viewer, Share, Rename and Delete are turned off, each "Only the owner can change this" | MENU-10, ROLE-05 to 07 | | |
| H-C18 | Typing makes the page Search: no tabs, Filter or Sort; the storage label and Trash stay. Rows have a snippet; words inside files match (a phrase in a contract finds the contract and the recording); Trash never appears | Q-02, Q-11 to 16 | | |
| H-C19 | On Shared, search offers In Shared (leaves out your files) and All of Library; from Suggested and All files both give the same list. No match: "No files match", "Try other words"; Clear search returns to the tab | Q-04 to 08, Q-18, Q-19 | | |
| H-C20 | Shared: Name, Access, Date shared, Type, same Filter and Sort, same even column spacing as All files, unread then newest | SHD-01 to 04 | | |
| H-C21 | Trash: "Library > Trash", no tabs, Filter, Sort or search; grey block with Empty Trash and the size it frees; Name, Days left, Size, Deleted; … with Restore and Delete forever; Library in the title returns to Suggested | NAV-16 to 18, TR-10 to 18 | | |
| H-C22 | Loading: card placeholders on Suggested, rows elsewhere. Empty: "No files yet", "Attach a file in a chat", New chat (Suggested, All files); "Nothing shared with you yet"; "Trash is empty". Error: "Couldn't load your files" with Try again; in search "Search is unavailable right now" | ST-01 to 06, Q-21 | | |
| H-C23 | No upload in Library: no Upload button, tray or drop area; a dragged file does nothing. (Sample files item: prototype-only, N/A) | NAV-13, NAV-14 | | |
| H-C24 | Escape and a click outside close Filter, Sort and … menus. Every card, tile, row name and button is reachable with Tab; Enter opens a card or tile | A11-01 to 03 | | |
| H-C25 | Narrowing hides Source first, then Access (Shared hides Type); the Filter, Sort, search and Trash row wraps without overlap | RESP-02, RESP-03 | | |
| H-D01 | Filter ticks carry between All files and Shared with their chips, are ignored while searching, and apply again once the search is cleared | FILT-22 to 24 | | |
| H-D02 | A sort only one tab has falls back to newest first on the other; Name carries over | SORT-14, SORT-15 | | |
| H-D03 | Two files with the same name show as two rows with different Created times in All files, search and Add from Library | ALL-18, Q-23, PICK-03 | | |
| H-D04 | Opening a file from Shared or a search result and closing it returns to that tab or result list | SHD-13, Q-24, NAV-22 | | |

### Checks that apply to every flow

| ID | Check | Also see | Result | Notes |
|---|---|---|---|---|
| EV-01 | Screens use File, Trash, Upload and Output exactly, never Item, Shelf, Folder or Collection | COPY-01 | | |
| EV-02 | Owners manage a file, viewers open but can't change it, no access sees the locked page; only the Admin sees Admin pages | ROLE-01 to 12, ROLE-23 | | |
| EV-03 | Every file state has a designed look | FS-01 to 10 | | |
| EV-04 | Lists have loading, empty and error states | ST-01 to 14 | | |
| EV-05 | Every status (file state, unread dot) shows a word or icon, not only colour | A11-05 | | |
| EV-06 | Library has Suggested, All files, and Shared once something is shared; Trash is a screen from the header button; run outputs are ordinary files with Source Generated | NAV-06, NAV-16, C-C09 | | |
| EV-07 | A search clears when you leave Library and stays when you open a result and close it | NAV-21, NAV-22 | | |
| EV-08 | Recent cards read Opened, Modified, Created or Shared with a short time; an unopened share reads "Shared 1d ago" with the unread dot after the title; Frequently used reads "Opened N times" | SUG-04 to 09, SUG-15 | | |
| EV-09 | In All files a Generated file has the sparkle and Access shows who can open each file; the unread dot is beside the name, not at the far right | ALL-04, ALL-05, ALL-11 to 17 | | |
| EV-10 | Filter and Sort are icon buttons beside the search on All files and Shared; only Name and Created sort, with arrows that always show; Filter has Source and File type | SORT-01, FILT-02 | | |
| EV-11 | The storage label sits beside the Library title on every tab, not at the foot of the list | NAV-03 | | |
| EV-12 | File icons have no box around them in lists and tiles; switches show no On or Off word | ALL-03, COPY-05 | | |
| EV-13 | Files come in through a chat or Slack; Library has no Upload button and no drop area | NAV-13, NAV-14 | | |

### What the prototype says it does not show

Real in the app, so worth checking even though the prototype can't show them.

| ID | Check | Result | Notes |
|---|---|---|---|
| ND-01 | Removing access reaches AI answers within 60 seconds | | |
| ND-02 | Real file reading, transcription and AI answers; search matches real content | | |
| ND-03 | Downloads give the real file; Trash days left count down (TR-34); run outputs are kept as the product says | | |
| ND-04 | Transfer rules for files shared with the whole workspace, or with one member only | | |
| ND-05 | Storage figures follow uploads and deletes (EDGE-15) | | |

## 24. Coverage matrix

Every check in the prototype's checklist and where this document covers it.

| Prototype flow | Checks | Depth | Covered by | Needs Slack or a prototype-only control |
|---|---|---|---|---|
| A. Capture and reuse | 15 | 3 | A-C01 to 15, A-D01 to 03 | "Sample files" part of A-C12: N/A |
| B. Set up a routine | 6 | 2 | B-C01 to 06, B-D01 to 02 | none |
| C. A routine run saves its output | 9 | 2 | C-C01 to 09, C-D01 to 02 | C-C07 needs Slack; "Simulate a failed run" needs a real failure |
| D. Ask in Slack | 7 | 2 | D-C01 to 07, D-D01 to 02 | the whole flow needs Slack |
| E. Share files | 11 | 2 | E-C01 to 11, E-D01 to 02 | E-C09 and step 7 need Slack |
| F. Delete and restore | 11 | 2 | F-C01 to 11, F-D01 to 02 | none |
| G. Admin sets the switches | 9 | 2 | G-C01 to 09, G-D01 to 02 | none ("Viewing as" becomes a second login) |
| H. Browse and find in Library | 25 | 4 | H-C01 to 25, H-D01 to 04 | "Sample files" part of H-C23: N/A; the Lists switch in H-C22 becomes [sim] |
| Every flow | 13 | — | EV-01 to 13 | none |
| **Total** | **106** | **19** | **125 cases** | |
| Not demonstrated (6 notes) | — | — | ND-01 to 05 | — |

All 125 prototype checks have a case. The ones that need Slack or a prototype-only control are marked, so the person running them records BLOCKED or N/A instead of skipping them.

Prototype controls and what to use in the app:

| Prototype control | In the app |
|---|---|
| Viewing as (You, Maya, Sam) | separate logins: one Admin and two Members |
| File state switch | produce the real state (section 22.1, Setup column) |
| Lists switch (Loaded, Loading, Empty, Error) | request interception [sim] |
| Flows (start a flow with its data) | seed the test data table, then follow the steps |
| Sample files | upload real files in a chat |
| Slack window | the real Slack workspace, or BLOCKED |
| Simulate a failed run | a routine that fails for real, or BLOCKED |
| Reset | delete the test files, or use a fresh account |

## What this list does not cover

Chat, routines, Slack and Admin settings are covered only where they change Library: section 20, the Admin settings in section 21.4, and the flows in section 23. The prototype lists these as not built and they are not tested here: Retry OCR, partial reading, paused uploads, the "taking longer than usual" notice, Slack Save on a message, access requests inbox, and citation freshness notes.

## Counts

| Section | Cases |
|---|---|
| NAV | 25 |
| SUG | 27 |
| ALL | 27 |
| SORT | 17 |
| FILT | 30 |
| Q | 28 |
| SHD | 14 |
| MENU | 17 |
| FP | 44 |
| PRV | 13 |
| SHARE | 25 |
| REN | 11 |
| TR | 38 |
| PICK | 22 |
| ST | 14 |
| RESP | 9 |
| A11 | 13 |
| COPY | 8 |
| EDGE | 15 |
| X | 14 |
| ROLE | 41 |
| FS | 26 |
| Flows A to H (A-C, A-D … H-D) | 112 |
| EV (every flow) | 13 |
| ND (not demonstrated) | 5 |
| **Total** | **608** |

## Known prototype gaps to expect

- Several prototype rules are decisions the owner made over the PRD (see section 0 of the prototype's `flows.md`): Trash is a header screen and not a tab, no Archive, no Upload in Library, Source and Access columns, Filter with two sections, Run outputs are plain rows. A real-app difference from the PRD here is not a bug.
- Open in the prototype and probably in the app: "See all" for Frequently used, the third supplier contract file, and the auto-save first-use explanation (CAP-10).
- The 2026-10-15 run found the storage origin missing from the CSP (F1) and backend de-duplication (F2). Re-check PRV-02, PRV-03, PRV-08, FP-26, X-01 and EDGE-02 first.
