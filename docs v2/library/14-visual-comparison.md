# 14 Visual comparison: app against the prototype (2026-10-16)

Written for: the team that owns the Library and sharing screens.

Doc 13 recorded what the app does. This doc records what it **looks like** next to the prototype, for the same screens and the same logical checks. Images are in [visual/](visual/). In each comparison image the **prototype is on the left and the app on the right**, both at 1440×900.

## 1. How it was done, and what it cannot tell you

| Item | Value |
|---|---|
| Prototype | `library-prototype/surfaces/library` run locally on port 3100, with its own sample data (Alex, Maya, Sam) |
| App | `front-end` on port 3000 against the dev backend, signed in as the Admin and as the Member from `.env.local` |
| Pairing | Each screen was put in the same state in both: the same menu open, the same dialog, the same list mode (Loaded, Loading, Empty, Error). The prototype's "Viewing as" (You, Maya) maps to the Admin and the Member |
| Review | Each pair was looked at as a screenshot, then the details (header, cards, rows, avatars) were enlarged. It is a visual review by eye, not a pixel diff |
| Not comparable | The two have different data (names, dates, sizes, file counts) and the app has its own real sidebar, theme colours and fonts. Those differences are listed once (V13) and not repeated per screen |
| Limits | The prototype has no equivalent for chat, project and agent sharing, and Settings. Those app screens are shown for review, without a reference |

A word on **Match**: the structure, wording and behaviour agree. **Differences** lists what looks or reads differently. A difference is not automatically a bug: the prototype is the design intent, the app may have a reason, and the owner decides.

## 2. Screen by screen

| # | Screen | Image | Result |
|---|---|---|---|
| 01 | Suggested (Recent, Frequently used) | [01](visual/01-suggested.png), zoom [header](visual/z01-header.png) and [cards](visual/z01-cards.png) | **Differences**: V1, V3, V4, V15. Same sections and card content (name, icon, "Opened/Shared `<ago>`") |
| 02 | All files | [02](visual/02-allfiles.png), zoom [rows](visual/z02-rows.png) and [access](visual/z02-access.png) | **Differences**: V1, V2, V14, V15. Columns Name, Access, Source, Created, Type and the ⋯ menu match. Access avatars match in style (soft tints, "+N", building for the workspace) |
| 03 | Filter panel | [03](visual/03-filter.png) | **Match**: Source (Uploaded, Generated, Shared) and File type (Images, Documents, Spreadsheets, PDFs, Audio), each with an icon. The app panel is a little smaller with a divider between sections |
| 04 | Sort menu | [04](visual/04-sort.png) | **Differences**: V5 (no tick mark) |
| 05 | Row menu, owner | [05](visual/05-rowmenu-owner.png) | **Match**: Open, Ask about this, Share, Download, Rename, Delete (red) with the same icons and grouping |
| 06 | Filter chip and sorted heading | [06](visual/06-filter-chip-sorted.png) | **Match** for the "PDFs ×" chip beside the Filter button. The Filter button turns black in the app when on, grey in the prototype. The prototype also boxes the sorted heading; the app does not (V5) |
| 07 | Shared tab, other person | [07](visual/07-shared-member.png) | **Match**: Name, Access, Date shared, Type; bold name with the red unread dot; red dot on the Shared tab |
| 08 | Row menu, viewer | [08](visual/08-rowmenu-viewer.png) | **Match**: Share, Rename and Delete are shown but dimmed |
| 09 | File page, viewer | [09](visual/09-filepage-viewer.png) | **Differences**: V12. Same top bar, preview, File info card ("You: Viewer", owner and "You · Shared directly") and Ask dock |
| 10 | Locked page | [10](visual/10-locked.png) | **Differences**: V9 (icon, no button, no close) |
| 11 | Share dialog, empty | [11](visual/11-share-empty.png) | **Differences**: V8 |
| 12 | Share dialog, people suggestions | [12](visual/12-share-suggest.png) | **Differences**: V8 (no "Member" line under each person) |
| 13 | Share dialog, person picked | [13](visual/13-share-pending.png) | **Differences**: V8 (chip inside the box, not a row) |
| 14 | Share dialog after sharing + message | [14](visual/14-share-done.png) | **Differences**: V7, V8 ("Viewer" label next to the person) |
| 15 | Remove access confirmation | [15](visual/15-remove-confirm.png) | **Differences**: V6. Wording matches and the app adds "Souvenir stops using it in answers within 60 seconds." |
| 16 | Rename dialog | [16](visual/16-rename.png) | **Differences**: V10 |
| 17 | Delete dialog | [17](visual/17-delete-dialog.png) | **Differences**: V6, V11 |
| 18 | "Moved to Trash" message | [18](visual/18-trash-toast.png) | **Differences**: V7 |
| 19 | Trash screen | [19](visual/19-trash.png) | **Match**: "Library > Trash", grey banner with the 30-day sentence, "Frees up", Empty Trash, columns Name, Days left, Size, Deleted |
| 20 | Trash row menu | [20](visual/20-trash-menu.png) | **Match**: Restore, Delete forever (red) |
| 21 | Delete forever dialog | [21](visual/21-delete-forever.png) | **Differences**: V6 (same wording) |
| 22 | Empty Trash dialog | [22](visual/22-empty-trash.png) | **Differences**: V6 (same wording) |
| 23 | Trash after emptying | [23](visual/23-trash-empty.png) | Not comparable: in the app, confirming Empty Trash showed a red "Something went wrong on our end" message and the file stayed (the dev backend was timing out at that moment). The empty state itself is in 24 |
| 24 | Trash empty state | [24](visual/24-trash-emptystate.png) | **Match**: trash icon and "Trash is empty" |
| 25 | All files, loading | [25](visual/25-allfiles-loading.png) | **Match**: placeholder rows with matching columns |
| 26 | All files, empty | [26](visual/26-allfiles-empty.png) | **Match**: library icon, "No files yet", "Attach a file in a chat", New chat |
| 27 | All files, error | [27](visual/27-allfiles-error.png) | **Match** with one wording difference (V16) |
| 28 | Suggested, loading | [28](visual/28-suggested-loading.png) | **Match**: five card placeholders and two tile rows |
| 29 | Search with results | [29](visual/29-search.png) | **Differences**: V3. Title "Search", "In All files / All of Library", rows with a snippet line all match |
| 30 | Search, no match | [30](visual/30-search-nomatch.png) | **Match** ("No files match", "Try other words", Clear search); duplicate clear icon, see V3 |
| 31 | File page, owner | [31](visual/31-filepage-owner.png) | **Differences**: V6 (Delete button). Otherwise the same card: "You: Owner", owner and shared person, Manage access, Ask about this, Download |
| 32 | File page, in Trash | [32](visual/32-filepage-trash.png) | **Match**: "In Trash / 30 days left" with Restore; Share and Manage access hidden |

## 3. The differences, numbered

Priority is a suggestion: **High** changes how a feature works or reads, **Medium** is a clear visual departure from the prototype, **Low** is polish.

| # | Difference | Seen on | Priority |
|---|---|---|---|
| V1 | **File icons sit in tinted rounded boxes.** The prototype uses a bare coloured icon and its rules say icons have no box. Also a different audio icon (waveform instead of headphones) and spreadsheet icon | 01, 02, 19, 31 | Medium |
| V2 | **No image thumbnail.** The prototype shows a small photo for image files. The app shows the generic icon. The test image here is 1×1 pixel, so this needs checking with a real photo | 02 | Low, verify |
| V3 | **Search box.** Placeholder reads "Search library" (prototype: "Search Library"). Once you type, **two clear icons** show (a blue × and a grey ×). The focus ring is pink in both but the box and pill shape differ | 01, 29, 30 | Medium (the double ×) |
| V4 | **Tabs** are a segmented control inside a grey track; the prototype has separate pills | 01 | Low |
| V5 | **Sort menu** shows the current choice with a highlighted row and **no tick mark**; the prototype ticks it. The sorted column heading has no highlight in the app | 04, 06 | Medium |
| V6 | **Destructive buttons are pale pink** (Remove, Move to Trash, Delete forever, Empty Trash). The prototype uses a solid red button. On the File page, Delete is a full-width pink filled button pinned to the bottom; the prototype has a small red text button under the actions | 15, 17, 21, 22, 31 | Medium |
| V7 | **Messages** appear as a white card at the bottom right; the prototype shows a dark pill at the top centre. In the Share dialog the app's message ("Shared with…", Undo) sits **under the dialog overlay**, so Undo cannot be clicked (logged in doc 13) | 14, 18 | High (Undo), Low (style) |
| V8 | **Share dialog.** Wider than the prototype. A private file shows a "Not shared yet" card instead of an "Only you" line. A picked person is a chip inside the input and the suggestion list overlays the dialog (the prototype lists the picked person as a row). Suggestions have no "Member" line under each name. A shared person shows a "Viewer" label next to the ×. Focus ring is not the accent colour | 11 to 14 | Medium |
| V9 | **Locked page** uses an info icon (the prototype a lock), has **no Request access button** and no close ×. Same title and sentence | 10 | High (the button, logged in doc 13) |
| V10 | **Rename dialog** is titled "Rename file", has a "Name" label and a helper line ("Currently “…”. The file type stays .txt."). The prototype is titled "Rename" with the field only | 16 | Low |
| V11 | **Delete dialog** first shows grey placeholder bars for the usage rows (chats, routines, shared with) and a pale button; the rows fill in after about a second. The prototype shows them at once | 17 | Low |
| V12 | On the viewer's File page, **Manage access and Share are not visibly dimmed** and Delete is bright pink, although they are turned off. The prototype dims all three | 09 | Medium |
| V13 | **Theme and typography.** The app's page background is a warm off-white (the prototype is white), list text is lighter in weight, avatars have a white ring, spacing and radii differ slightly. This is the app's own design system, listed once | all | Note |
| V14 | **Type names.** The app says "Text" and "Spreadsheet"; the prototype says "Document", "Sheet", "CSV" | 02 | Low |
| V15 | **File names show the extension** ("Return policy 2026.pdf"); the prototype shows the name only | 01, 02, 19 | Low |
| V16 | Error message has a full stop ("Couldn't load your files.") | 27 | Low |

Things that could **not** be compared: the Generated sparkle and the "Frequently used / Generated" tiles (no generated files exist), and the Uploading and Processing banners (the app cannot hold a file in those states for long). Check them once a routine output or a slow upload exists.

## 4. The logical checks, and what was seen

Every area in doc 13 was also looked at on screen. Where the screen shows the same result as the check, it says so.

| Logical result (doc 13) | Seen on screen | Screens |
|---|---|---|
| Server refuses access; locked page without the title | Locked page shows the title and sentence, no file name | 10 |
| Shared tab appears with an unread dot; dot clears | Red dot on the tab and after the file name; bold name | 07 |
| Shared columns and Date shared | Name, Access, Date shared, Type | 07 |
| Access avatars and tooltips | Owner first, two avatars, workspace building avatar; tooltip text checked in doc 13 | 02, 07 |
| Viewer menu: Share, Rename, Delete turned off | Dimmed items, not hidden | 08 |
| Viewer File page: "You: Viewer", owner and "Shared directly", Manage access off | Shown, but the turned-off buttons are not dimmed (V12) | 09 |
| Owner File page: "You: Owner" and the shared person | Shown | 31 |
| Direct plus workspace sharing | List shows one row; access list shows both (checked in doc 13) | 02, 07 |
| Share dialog wording and flow | Wording matches; layout and the picked-person pattern differ (V8) | 11 to 14 |
| Remove access confirmation | Same wording, plus one extra line | 15 |
| Rename (empty name, length limit) | Messages ("Enter a name", "Use 255 characters or fewer") were seen in doc 13; dialog layout differs (V10) | 16 |
| Delete dialog with usage and 30 days | Same content (V11 for the loading bars) | 17 |
| "Moved to Trash" with Restore | Same wording, different position and style (V7) | 18 |
| Trash screen, menu, dialogs, empty state | Match, apart from the button colour (V6) | 19 to 24 |
| Loading, empty and error states | Match | 25 to 28 |
| Search with snippet, scope chips, no match | Match, plus the double × (V3) | 29, 30 |
| File in Trash banner | Match | 32 |
| Admin against Member in Settings | The member's menu has Personal and Help only; the admin's has a Workspace section; the gated page reads "Only workspace admins can see this page / Ask an admin in your workspace if you need a change here. / Back to chat" | [o11](visual/o11-member-gated.png) for the gated page. The two Settings menus are described in words only: their screenshots show the account holders' email addresses, so they are not kept in the repo |

### Sharing features without a prototype (app only)

| Screen | What it shows | Image |
|---|---|---|
| Chats, "Shared with me" view | A card: chat title, "Shared by test 01", a pink "Read-only" badge, an Open button. It sits behind the "All chats" dropdown, not on the default view | [o1](visual/o1-chats-dropdown.png), [o2](visual/o2-chats-shared-with-me.png) |
| Shared chat page | Back, title, "Shared chat · Read only", a black "Make a copy" button, the messages; **no message box and no name for who shared it** (doc 13 finding 7) | [o3](visual/o3-shared-chat-page.png) |
| Member's Projects page and project page | The project is listed; the page says "Created by test 01 · Shared Project" and shows a share button and a ⋮ menu to the member | [o5](visual/o5-member-projects.png), [o6](visual/o6-member-project-page.png) |
| Owner's project page | Members, Sharing and Project options in the right-hand rail | [o7](visual/o7-owner-project-page.png) |
| Project after the member is removed | "Project not found / It may have been deleted, or it isn't shared with you. / Back to Projects", **with a red message "Failed to load project chats — The requested resource was not found" on top** | [o8](visual/o8-member-project-removed.png) |

Two more items from these screens (added to the numbered list in doc 13's findings):

| # | Item | Priority |
|---|---|---|
| V17 | The removed-member project page shows a red error message about project chats on top of the correct "Project not found" page | Low |
| V18 | The project page shows the member a share button. Whether a member (not the owner) can use it was not tested | Check |

## 5. What still needs checking

- **Agent sharing screens** (share dialog, accept page, Agents page with a shared agent) were driven through the API only; their UI was not captured.
- **Sender-side chat and project share dialogs** were not opened. I tried to open the owner's chat to find its share control, but the click on the chat title did not open the chat (the screenshot shows the Chats list), so where chat sharing starts in the UI was not located. The project page has Members and Sharing in its right-hand rail; that dialog was not opened either.
- **Narrow windows, dark theme and keyboard focus** were not compared. The prototype's rules for them are in doc 12 (RESP and A11 sections).
- **Image thumbnails and Generated files** (V2 and the sparkle) need real data.
- **An Empty Trash request failed once** ("Something went wrong on our end") while the dev backend was timing out. The same action succeeded on other runs; check it again on a stable backend before calling it a bug.
