# 13 Two-account test results (2026-10-16)

Written for: the team that owns the Library and sharing features.

Cases come from `12-prototype-test-cases.md` (Library) plus the other sharing features that need two people. This run used an **Admin** and a **Member** account in the same workspace (`test01-workspace`), against the real dev backend through the app at `http://localhost:3000`. Nothing in `back-end/` was changed and nothing was committed.

## 1. How it was run

| Item | Value |
|---|---|
| Accounts | ADMIN and MEMBER from `.env.local` (`ADMIN_EMAIL`, `MEMBER_EMAIL`). Both are in `test01-workspace`: the first has role `admin`, the second `member` (read from the workspace members list). Passwords are not repeated here |
| Method | Chromium driven by Playwright, one browser session per account. State was set up through the app's own API calls from the signed-in page (grants, uploads, trash). What a person sees was checked in the UI: tabs, rows, menus, dialogs, toasts, file pages. Server refusals were checked by calling the API as the wrong person |
| Test data | Fresh `mu-<number>-*` text files for every run (so unread state starts clean), a throw-away project and a throw-away agent. The 12 seeded files were only shared and un-shared, never changed. Everything was removed at the end |
| End state checked | Admin: 12 library files (none shared), Trash empty, 1 agent, 1 project. Member: 0 files, 0 chats, 0 projects, 0 agents, nothing shared with them |
| Scripts | In the session scratch folder, not the repo (they are gone with the session) |

**What PASS means here:** the behaviour and the wording matched. It is not a visual sign-off. The look of each screen was compared with the prototype afterwards, screen by screen, in [14-visual-comparison.md](14-visual-comparison.md), which found 18 visual differences (for example icons in boxes, pale destructive buttons, message position, the Share dialog layout).

Result words: PASS, FAIL (a real difference from the prototype or an app problem), NOT BUILT (the feature is not in the app), NOTE (works, worth knowing).

## 2. Library: roles and sharing

Case IDs are the ones in doc 12.

| Area | Cases | Result |
|---|---|---|
| Server refuses a person with no access (get, rename, delete, share, access list, download, opened, usage) | ROLE-12 | PASS, all eight calls refused with 403 |
| File unchanged after those attempts | ROLE-12b | PASS |
| Locked page: "You don't have access", "Ask the owner to share it", no title leaked | ROLE-02, FS-06 | PASS |
| Locked page has a **Request access** button | FP-33, FP-34 | **NOT BUILT** (see finding 1) |
| Each person only sees their own files; search does not find another person's private file | ROLE-18, ROLE-01 | PASS |
| Owner shares with a person; fresh share is unread for them, not for the owner | SHARE-09, ROLE-22, ROLE-22b | PASS |
| Shared tab appears once something is shared, with an Unread dot; dot clears after opening everything | NAV-09, NAV-09b, NAV-10 | PASS |
| Shared table: Name, Access, Date shared, Type; unread dot beside the name; date format | SHD-01, SHD-03, SHD-05, ALL-04 | PASS |
| Access avatars and tooltip: "Owner: test 01. Shared with You" (member) and "Owner: You. Shared with OS8 Test01" (owner) | ALL-12, ALL-12b, ALL-12c | PASS |
| A file shared with you also shows in All files | ALL-02b | PASS (one run read the page before it had loaded; the others listed it) |
| Viewer menu: Open, Ask about this, Download enabled; Share, Rename, Delete present and turned off | MENU-10, MENU-10b | PASS |
| Server refuses a viewer who renames, deletes or shares | ROLE-05, ROLE-06, ROLE-07 | PASS |
| Viewer File page: "You: Viewer", owner and "You · Shared directly" listed, "Uploaded by test 01"; Manage access and Share turned off | FP-21, FP-22, FP-12, ROLE-06 | PASS |
| The "Only the owner can change this" tooltip on the turned-off buttons | ROLE-05 | **not verified** (the tooltip text could not be read from the page) |
| Opening a file clears unread; closing a file opened from Shared returns to Shared | ROLE-22c, SHD-13 | PASS |
| Owner File info: "You: Owner" and the member as "Shared directly" | FP-21b | PASS |
| Removing access: gone from the member's Shared at once; link shows the locked page | SHARE-16, SHD-12, SHARE-16b | PASS |
| Direct plus workspace on one file: both listed, file listed once, "everyone" building avatar; remove one way and the other still works; remove the last and it is gone | E-C05, E-C05b, E-C05c, ALL-14, E-C11, SHARE-17, SHARE-18 | PASS |
| Delete a shared file: leaves the member's Shared at once; the member's link says "No longer available"; Restore brings the share back | TR-30, FS-05, FS-22 | PASS |
| Owner's Trash lists it with 30 days; the member's Trash does not | TR-13, TR-17b | PASS |
| Admin cannot open, rename or delete a member's private file | ROLE-14, ROLE-14b, ROLE-14c | PASS |
| Direct share to the Admin: plain viewer, cannot manage | ROLE-16, ROLE-16b | PASS |
| Workspace-shared by a member: Admin can manage; File info "You: Admin, can manage"; Admin can rename and delete | ROLE-13, ROLE-13b, ROLE-13c, ROLE-15 | PASS |
| That deleted file shows in the Admin's own Trash and can be restored by the Admin | ROLE-15c | **FAIL** (finding 4) |
| Sharing again after removing access is unread again | SHD-04b | NOTE (finding 5) |

### Share, Rename, Delete and Trash dialogs (owner, through the UI)

| Cases | Result |
|---|---|
| Share dialog: shows "Share" and the file name, the line "Teammates can use shared files in their chats and routines.", placeholder "Add people or the whole workspace", people and "Whole workspace" ("Everyone in Souvenir") suggested, typing narrows the list, a picked person shows as a chip, no Editor or other role control | PASS (SHARE-01, 03, 04, 05, 07, 10, 11). The dialog's title and file name are two lines, not "Share `<name>`" |
| A private file shows "Not shared yet. Add people or the whole workspace above." instead of "Only you" | PASS with different wording (SHARE-13) |
| Sharing shows "Shared with OS8 Test01" with Undo | PASS (SHARE-09). The message appears about 2 to 4 seconds after the click here |
| **Undo** on that message while the Share dialog is open | **FAIL** (finding 3) |
| Who has access lists "You · Owner" and "OS8 Test01 · Shared directly · Viewer"; remove button; "Remove OS8 Test01?" explains "loses the file now… citations to it lock… within 60 seconds"; message "OS8 Test01 removed" | PASS (SHARE-12, 14, 15, 16) |
| Rename: "Rename file", "Currently “name”. The file type stays .txt."; empty name gives "Enter a name"; 300 characters gives "Use 255 characters or fewer"; "Renamed" message; new name shows | PASS (REN-01, 02, 04, 08) |
| Delete: "Move `<name>` to Trash?", usage rows (0 chats, 0 routines, Shared with OS8 Test01), "Recoverable for 30 days. Answers already written stay as they are.", Cancel changes nothing, message "`<name>` moved to Trash" with Restore | PASS (TR-01, 02, 04, 06, 08) |
| Trash: banner "Restore files you've deleted. Files are deleted forever after 30 days.", "Frees up 27 B", columns Name, Days left, Size, Deleted, "30 days"; row menu is only Restore and Delete forever | PASS (TR-10, 11, 13, 14, 18) |
| "Delete `<name>` forever?" with "This frees up 27 B and can't be undone."; Empty Trash asks "Delete 1 file forever?"; Cancel keeps the file; confirming empties Trash with "1 file deleted forever"; old link reads gone | PASS (TR-21, 25, 26, 23) |
| Restore shows "Restored `<name>`" | PASS (TR-19; the message appeared about 4 seconds after the click) |

### Settings and Admin pages: Admin against Member

| Check | Admin | Member |
|---|---|---|
| Settings menu | Personal (Account, Usage), **Workspace (Admin, General, Members, Plans & Billing, Usage)**, Help | Personal (Account, Usage) and Help only. **No Workspace section** |
| Members, General, Activity, Analytics | open | "Only workspace admins can see this page. Ask an admin in your workspace if you need a change here." with Back to chat |
| Plans & Billing | opens | redirects to Usage |
| Library settings, Library audit log, Library inventory, Workspace library (`/settings/library`, `/settings/library-audit`, `/settings/library-inventory`, `/settings/workspace-library`) | 404 | 404 |

So the **role gate on workspace pages works**. The **Library-specific Admin features do not exist** in this app (finding 2).

## 3. Other sharing features

### Chat sharing (owner to person, read-only, optional copy)

| Check | Result |
|---|---|
| A member cannot read the admin's private chat (404) or share a chat they do not own (403) | PASS |
| Sharing with someone outside the workspace is refused ("Recipient is not in any of your organizations"); sharing with yourself is refused ("Cannot share a chat with yourself") | PASS |
| Owner shares; sharing the same chat with the same person again gives 409; the owner's list shows one share | PASS |
| The recipient cannot revoke the owner's share (403) | PASS |
| **Chats, then the "All chats" dropdown, then "Shared with me"** lists "summarise · Shared by test 01 · Read-only · Open" | PASS |
| The shared chat page shows the title, "Shared chat · Read only", no message box, and a **Make a copy** button | PASS |
| That page does not say who shared it (the list does) | NOTE (finding 7) |
| Make a copy creates the member's own chat; doing it twice returns the same copy; the owner's original is unchanged; the owner cannot see the copy | PASS |
| Revoke: the share leaves the member's list at once, the old link no longer loads the chat (404) and the page ends on "The requested resource was not found. Please ask the user to share it again" with Go back | PASS (the message appeared after 10 to 20 seconds in this environment) |
| The member's copy survives the revoke | PASS |

### Project sharing (visibility Personal, Shared, Workspace; invite and remove)

| Check | Result |
|---|---|
| An uninvited member cannot open a "shared" project (404) and it is not in their list | PASS |
| Owner invites the member: they can open it; it is in their Projects page ("1 Shared Project"), their sidebar and the project page ("Created by test 01 · Shared Project") | PASS |
| Inviting again does not duplicate; inviting someone outside the workspace gives "User not found" | PASS |
| The member cannot delete the project, change its visibility (both 404) or remove the owner (400) | PASS |
| A member can change the project's title | NOTE (finding 8) |
| Owner removes the member: access ends at once, and a reload shows "Project not found · It may have been deleted, or it isn't shared with you." with Back to Projects | PASS |
| Visibility Workspace opens it to the member without an invite; Personal closes it again; deleting it removes it for everyone | PASS |
| Whether an invited **member can invite other people** | **not tested**: with only two accounts the only person left to invite is the owner, who already has access |

### Agent sharing (email and link shares)

| Check | Result |
|---|---|
| The member does not see the admin's agents; cannot create a share for an agent they do not own; starts with nothing received | PASS |
| Sharing an agent that was never published is refused ("Persona repo has no published version") | PASS (the message is clear) |
| Owner shares a published agent by email with a credit limit of 5 and a 7-day expiry | PASS |
| The recipient can preview the share before accepting. The preview includes the agent's **prompt**, model and temperature | NOTE (finding 9) |
| The recipient cannot revoke the owner's share (404); their "sent" list is empty | PASS |
| Accepting adds the agent to the member's Agents page ("Use in chat"); accepting the same share twice does not add a second copy | PASS |
| The accepted agent is labelled "by You", not by the person who shared it | NOTE (finding 10) |
| An email share written for another address cannot be accepted by the member (403 "This persona share was sent to a different email address") | PASS |
| A link share can be accepted by any workspace member; each share becomes its own copy | PASS |
| Owner sees the recipient and the credit limit; after the owner revokes, the shares are inactive for the member and cannot be accepted again (404) | PASS |
| Before it is accepted, an email share does not appear in the recipient's "received" list | NOTE (finding 10) |

## 4. Findings

Numbered for the people fixing them. None of these needed a backend change to find; findings marked **backend** would need one.

| # | Finding | Where | Severity |
|---|---|---|---|
| 1 | **No "Request access" on the locked page.** The prototype has a Request access button that becomes "Request sent". The app's locked page has the title and "Ask the owner to share it" only. The string `requestAccess` exists in `lib/library/messages.ts` and nothing shows it | `components/Library/FileStates.tsx` | Medium (FP-33, FP-34) |
| 2 | **No Library admin features.** There is no Library settings page (auto-save default, force auto-save off, AI reference, file size and type limits, storage), no Admin notice for members, and no Library audit log or inventory page (all 404). Every ROLE-25 to ROLE-33 case and the Admin half of Flow G cannot be run | `app/(app)/settings` | Needs a decision: not built, or out of this phase |
| 3 | **Undo is unreachable after sharing.** The Share dialog stays open after Share, and its overlay covers the "Shared with OS8 Test01 · Undo" message, so the Undo button cannot be clicked until the dialog is closed, and the message may be gone by then | Share dialog and toast layering | Medium (SHARE-19) |
| 4 | **An Admin's Trash does not list a member's file the Admin deleted.** The prototype lists it ("what they deleted themselves"). Here only the owner's Trash shows it (with `trashedBy`), and the Admin cannot restore it (restore returns 404) | Library trash list (**backend**) | Low to medium (ROLE-15c) |
| 5 | **Re-sharing a file after removing someone's access is not marked unread** for them, although a first share is. Probably because they had already opened it | Library shares (**backend**) | Low (SHD-04b) |
| 6 | **Dialog and message timing.** In this dev environment the "Shared with…" and "Restored…" messages appeared 2 to 4 seconds after the click, and a page for a removed chat link took 10 to 20 seconds to show its message. The app shell also stayed on the "Souvenir" splash for more than 25 seconds once. Not reproducible on demand, and the dev server restarted several times during the run, so treat as environment noise unless it repeats in production | all | Low, watch |
| 7 | The read-only shared chat page does not say who shared it. The "Shared with me" list does ("Shared by test 01") | `app/(app)/chat-shares/[shareId]/page.tsx` | Low |
| 8 | A project member (not the owner) can change the project's title. Delete, visibility and removing the owner are blocked. Check that this is intended | projects | Note |
| 9 | The agent share preview returns the agent's `prompt`, `model_id` and `temperature` to the recipient before they accept. If prompts are meant to stay private to the owner this exposes them | `/persona-shares/{id}` (**backend**) | Needs a decision |
| 10 | An accepted shared agent is labelled "by You" instead of the sharer, and an email share is invisible to the recipient until they open its link ("received" is empty before accepting) | agents | Low |
| 11 | The backend accepts a 300-character file name through the API (it stores 251). The app's Rename dialog blocks it ("Use 255 characters or fewer"), so only direct API callers can do it | Library rename (**backend**) | Low |

Behaviours that match the prototype and are worth keeping: the 403 on every route for a person with no access; the Viewer menu showing Share, Rename and Delete turned off instead of hiding them; one Shared list row even when a file is shared both directly and with the workspace; Remove access explaining that answers already received stay and citations lock; Trash with the 30-day wording and the "Frees up" size.

## 5. Not covered

| Not run | Why |
|---|---|
| Removing a member and the leaver's "transfer your shared files?" question (ROLE-34 to ROLE-39, Flow G step 4), and a member leaving | Destructive. It needs a throw-away third account, because it deletes or transfers files and removes the account from the workspace |
| A Member inviting other people to a project | Needs a third person (see section 3) |
| Library settings, force-off, AI reference, limits, the Admin notice | Not built (finding 2) |
| Slack flows (Flow D and the Slack parts of E and C) | Slack is not connected to this workspace |
| Routines (Flows B and C) and chat citations to Library files | Routines and live chat replies were not in scope for this run; chat replies from the dev backend were failing earlier in the project |
| The sender-side share dialogs for chats, projects and agents (Share chat modal, Project share modal, Agent share modal) | Those shares were set up through the API; only the recipient's screens were driven. The Library share dialog was driven through the UI |
| Organisation invites by email | Needs a mailbox and creates real accounts |
| Phone-width and keyboard checks for the new screens | Covered in doc 12 for Library; not repeated for sharing |

## 6. Where this leaves doc 12

Doc 12 has 608 cases. This run executed about 100 checks that map to them (the roles, Shared tab, viewer, sharing, delete and Trash cases above) plus about 55 checks for chat, project and agent sharing, which doc 12 does not cover. It found the 11 items in section 4 and showed that the Library Admin settings (ROLE-25 to ROLE-33, G-C01 to G-C05) are **not built**. Doc 12 cases that are not mentioned in this file were not run in this pass, including the single-user screens (sort, filter, search, previews, accessibility, responsive), which need no second account.
