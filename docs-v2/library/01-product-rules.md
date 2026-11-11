# 01 Product rules (the contract every layer shares)

Derived from the prototype (`surfaces/library/lib/types.ts`, `lib/access.ts`, `flows.md`). Names below are the target production names; the prototype name is in brackets where it differs.

## 1. Domain model

| Concept | Meaning |
|---|---|
| **LibraryFile** | One stored file with one owner. Has a `format`, a `source`, a `phase` and a `life`. |
| **Grant** | A Viewer grant on one file to one person, or to the whole workspace. There is no Editor. |
| **Source** | `uploaded` (a person added it) or `generated` (Souvenir made it: chat output or routine run output). Drives the Source column and filter. |
| **Origin** (provenance) | Where it came from, shown on the File page: chat upload, chat output, routine run (with run id and test flag), Slack upload. Web vs Slack is on the File page, not a column. |
| **Phase** | `uploading`, `processing`, `ready`. |
| **Life** | `staged` (attached to an unsent message) [pending], `chat_only` (sent, not saved) , `active`, `trashed`. |
| **Format** | Stored as a finer `format` (`pdf`, `document` docx, `sheet` xlsx and csv, `slides` pptx, `text` txt, markdown and code files, `web` html, `email` eml and msg, `image`, `audio`) and shown through five UI filter groups: Images, Documents (document, slides, text, web, email), Spreadsheets, PDFs, Audio (CAP-18). |
| **Scope** | Derived, shown as a label on the File page: `private` (owner only), `shared` (named people, with their names), `workspace` (everyone). Never stored separately from grants (PRD Understanding, Scope). |
| **Principal** | A person (Admin or Member) or a routine/agent acting under its owner's identity. A routine can read only what its owner can read and write only its own run outputs (SHR-6, RTN-13). |
| **Provenance** | Written once at creation (chat and message, routine and run, Slack channel and message) and **never editable, by anyone including the owner** (CAP-23). Enforced in the service layer and with a DB guard (04 section 3.2). |
| **Usage** | Where a file is used: chats that cite or scope it, routines it is attached to. Powers "Used in" and the delete warning. |

Format mapping from today's accepted MIME types (`use-file-upload.ts`) to the PRD list (CAP-18: PDF, DOCX, XLSX, CSV, PPTX, TXT, Markdown, HTML, EML, MSG, audio MP3/WAV/M4A, common images, code files read as plain text): pdf = `application/pdf`; document = docx, doc, rtf, epub; slides = pptx, ppt; sheet = xlsx, xls, csv; text = txt, md, json, xml and code files (read as plain text); web = html; email = **eml, msg (new to the allow-list)**; image = png, jpeg, webp, svg, tiff, avif; audio = **new** (mp3, m4a, wav; webm only if recorded in-app). Audio is stored and playable; transcription is on demand (section 13). Zip is accepted by chat today but is "Other" in the PRD: not supported in Library, rejected as a Library save, and may still ride along as a chat-only attachment (OQ-15).

## 2. File states

Two axes. Every file has one value on each.

| Life | Who can open | Appears in |
|---|---|---|
| staged | uploader | the composer only |
| chat_only | uploader (and people in that chat) | that chat only |
| active | owner, plus grantees | Library, search, picker, citations |
| trashed | nobody (owner and Admin see it in Trash) | Trash screen |

Rules that hold everywhere:

1. A file that is not `ready` is never in a Library list, search, the picker, a citation, or a routine attachment. It exists only in the composer.
2. A failed, password-protected, unsupported, or unsafe file **never becomes a file**. Nothing is persisted. A short message (no file name) says why and clears after 6 seconds. There is no Needs attention state, no Retry. The user uploads again.
3. A deleted or removed file reads "File deleted" in citations and "No longer available" at its link, and never reveals its title.
4. Moving to Trash keeps grants and routine attachments. Restore brings it back with them. There is no Archive.
5. A duplicate upload is a separate file with the same name. No suffix. `Created` tells them apart. No dedupe by hash in Phase 1 (the hash is still stored for Phase 2). **Two members uploading the same file each get their own copy**; no response, count or message may ever reveal that someone else holds the same content (PRD edge cases). Duplicate-rate metrics are computed per owner only.
6. **Ready is not "searchable by the AI".** Ready means scanned, read, previewed. A file joins the search index only when the message is sent. Until then it is private to the uploader: not in Library, search, retrieval or any share (PRD Understanding, Processing).
7. Removing a file before send deletes it immediately with everything made from it. An abandoned draft's files are deleted with the draft and after 24 h at the latest (proposed).
8. Only file-like content is saved automatically: documents, sheets, decks, images, code files. Plain text answers and pasted text are not (CAP-2). They are saved only when the person asks (Phase 2 snippet).
9. **Provenance is write-once.** Where a file came from is recorded at creation and cannot be changed by anyone (CAP-23).
10. Titles: an upload keeps its own file name. Souvenir names only files it creates, and tags those titles AI-generated until the owner renames them. Only the owner edits a title; long titles are cut on screen (ORG-6).

## 3. Permission matrix

| Action | Owner | Viewer (granted, directly or workspace) | Admin over a workspace-shared file | No access |
|---|---|---|---|---|
| Open, preview, Ask about this, Download | yes | yes | yes | Locked page with Request access |
| Rename, Share, Delete | yes | shown disabled, tooltip "Only the owner can change this" | yes (manage) | not shown |
| See Who has access | yes | yes (names only, no grant history) | yes | no |
| Open a **private** file | owner only. Admins cannot. | | | |
| Appears in Trash | files they deleted (and, for Admin, workspace files they deleted) | | | |

Rules:
- Access = owner, or a grant to the person, or a grant to the workspace. Trashed and non-active files grant nothing except to the owner.
- Admin power exists **only** over files shared with the whole workspace. It never exposes private files.
- Removed members have no access to anything.
- Authoritative check is on the server. The front end derives `caps` (open, rename, share, delete) from what the API returns (`access`, `adminCanManage`) and never from role alone.

## 4. Auto-save

Applies to files that arrive in a chat. Three modes: `always` (default), `ask`, `never`.

- Effective mode = `never` if the Admin forced it off, else the person's own choice if they made one, else the workspace default.
- Files stay out of Library until the message is **sent**. Then they are saved without a message (`always`), or the user is asked once per message (`ask`), or kept chat-only (`never`).
- A file saved from a chat has origin = that chat; the chat can be deleted with "Also delete these files".
- The PRD first-use explanation (CAP-10) was deliberately left out by the owner. Do not build it; track as open (OQ-10).
- **Precedence, strongest first (section 10 of the PRD):** the Admin's force-off, then the person's own choice, then the workspace default. Force-off message: "Your Admin has turned auto-save off". Files already in Library stay. A person's own choice is kept in their prefs and applies again if force-off is lifted.
- A settings change takes effect for **new activity straight away** and never rewrites existing files. Members see a short notice of what changed.
- Undo: "Saved to Library" offers Undo for 10 seconds (proposed). Undo cancels the save and the file stays attached to that message only; after that it is deleted like any file (Trash).
- If saving fails after send the message still sends; the system retries up to 3 times, then the file shows "Not in Library" with Save again.
- Auto-save never applies to a channel with external members in Slack (section 12).

## 5. Sharing

- Viewer only. One file at a time in the dialog.
- Targets: a person in the workspace, or the whole workspace.
- Ways in are listed as "Shared directly" and "Whole workspace". Removing a direct grant takes access away at once unless a workspace grant also exists.
- Sharing by chat or Slack command: `@Souvenir share <file> with <person>`; reply has Undo (stays until used, then "Undone"). Resolution rules for unclear files and people are in the prototype `flows.md` section 4 and are enforced **server side** so Slack and web behave identically.
- Newly shared files show an unread dot for the grantee until first open. Dot plus heavier name plus tooltip, never colour alone.
- A file shared into a Slack **channel** is named in the reply only if every member can open it.
- Request access: Phase 1 records a request and tells the requester "Request sent". The owner gets a notification. Approve/deny UI is Phase 2.
- Fixed error copy (SHR): adding someone outside the workspace: "Only workspace members can be added." (guests are Phase 3). A non-owner trying to share: "Only the owner can share this file." Save failure: "Couldn't share this file. Nothing changed."
- The share dialog says teammates can use the file in their chats and routines.
- **Removal propagation.** Removing someone ends browsing at once and AI access within 60 seconds. The removal dialog says answers already received stay in history but their citations lock.
- A share that is revoked while the other person has the file open: their next request re-checks authorisation and the page shows "No longer available".
- **A file shared directly and with the whole workspace** gives one Viewer access; Who has access lists both ways. Removing the direct grant leaves the workspace one.
- **Sharing kill switch:** when switched off for a workspace, new grants are refused ("Sharing is turned off for this workspace") and existing grants keep working (proposed, OQ-18).
- Slack: a share asked for in a channel is confirmed in a message only the owner sees (proposed) and never names a file the channel cannot all open. An unclear file or person gets "Which one?" with choices; nothing is shared until one is picked.

## 6. Trash

- Fixed 30 days (a product rule, not an Admin setting). `daysLeft` is computed server side.
- Delete shows a usage dialog: which chats cite the file and which routines use it. A routine with a trashed attachment skips it on the next run and says so in its pane.
- Delete forever and Empty Trash are irreversible and remove the S3 object, extracted text, embeddings, grants and usage rows.
- Trash lists what the person can delete forever, plus what they themselves deleted.
- The delete dialog shows **Usage** (chats, routines, shares) and the recovery window, and says answers already written are not rewritten (LIF-4, LIF-8).
- Clean-up windows after Delete forever or the end of the window: search entries and shares within 60 seconds, everything derived within 24 hours, storage including backups within 30 days (proposed, Legal to confirm). An audit entry (who, what, when, no content) stays; usage records are anonymised (LIF-6).
- Fixed copy: delete failure "Couldn't delete this file. Nothing changed."; restore after purge "This file was permanently deleted." (shown only to the person who owned it, from Trash or a stale tab; anyone else gets "No longer available" with no title and no hint the file existed, LIF-7); archive/rename failures use the same "Nothing changed." pattern.
- A link to a deleted file says "No longer available"; a citation to it says "File deleted".
- Deleting a **chat** keeps the files saved from it. The dialog states how many and offers "Also delete these files" (default off) (LIF).
- Deleting a **routine** keeps its run outputs unless the person ticks "Also delete its N run outputs" (N is shown).
- When a workspace closes, content is removed on the same published schedule (LIF-12).
- Moving content between workspaces is not supported: export and re-import only, stated in the product.

## 7. Citations and Sources

- A citation shows the **file name only**, never a path or owner. It opens the File page with the passage (page), row (sheet) or recording time (audio) highlighted.
- Locator types: `page`, `row`, `time`. A locked citation offers Request access, a deleted one reads "File deleted".
- The Sources panel in chat lists files the answer could use and marks the ones it cited. The user can switch individual sources off for a chat (`sourcesOff`).
- Library search by the AI is on only if the Admin switched AI reference on **and** the person's own switch is on. When the Admin turns it off the person sees "Your Admin has turned this off".
- **Verified before shown.** Each cited passage is checked to exist in the named file; an unverifiable citation is dropped and the answer shows without it (section 13).
- **Mid-chat changes.** A file deleted mid-chat reads "This file is no longer available" and leaves the Sources panel; earlier answers keep their text. Access removed mid-chat: the next message re-checks, the file leaves Sources and its old citations lock; other files keep working.
- **Not in the files.** "I couldn't find this in your files." A general answer may follow, clearly marked as not from the files.
- **Too many files in use.** "Too many files to read at once." The best matches are used and the answer says so.
- A citation to a file renamed after being cited shows the current name (citations store the file id).
- A citation to a recording points to a time in it when the transcription tool returns times (OQ-13).

## 8. Routines

- Attach only `ready`, `active` files the owner can open.
- A run writes its output as a `generated` Library file owned by the routine owner, private by default, named after the output with origin = routine run. Test runs look like any other run (named "Test run - ...", no badge).
- A message-only run and a failed run create no file.
- Run outputs are never removed automatically in Phase 1 (retention and Keep are out).
- When the routine owner leaves, the routine is paused and handed to the Admin with its run outputs (the PRD says paused until a new owner is named; see OQ-19).
- **Each run records the files it used**; run history names a file that was missing (deleted) or that the routine lost access to, and the run still goes ahead with the others (RTN-3).
- A routine keeps using the file attached to it when a newer copy is uploaded; the owner attaches the new copy in place of the old one.
- Output over the size limit: "Not saved: the file is over the size limit." The message is still delivered. A run that fails after writing part of its output creates no file.
- A routine can read only what its owner can read. Run outputs and other agent-made files are **not sources** for other routines or chats until a person attaches them (no self-contamination).
- Deleting a routine keeps its run outputs unless "Also delete its N run outputs" is ticked.

## 9. Member removal and leaving

1. Admin confirms "Remove <name>". The person leaving then sees one locked question: transfer their shared files or delete them. The removal completes when they answer.
2. Transfer yes: workspace-shared files and files shared by the Admin go to that Admin; the rest go to the first person each was shared with.
3. Transfer no: those files are deleted outright (not Trash).
4. Files never shared are deleted either way. Their chats and routines are removed with them (routines owned by them are handed to the Admin, see section 8). Their grants on other people's files are cleared.
5. Leaving yourself (Settings, Library) asks the same question, can be cancelled, and is blocked for the only Admin ("Name another Admin first").
6. The confirmation is mandatory: until the leaver answers, **nothing is deleted or transferred and the removal does not complete**. Nothing is ever left without an owner.
7. From the moment of removal the member's access and routine grants end immediately (GOV-7), even while the transfer question is unanswered; only the data movement waits.
8. A recipient leaving: their access ends; the files they shared are handed over or deleted as they chose; files they never shared are deleted.
9. A workspace always has an Admin: removing or demoting the last Admin is refused.

## 10. Limits and copy

- File size and types: Admin settings, sample 30 MB per file and today's MIME allow-list plus audio. Per-message cap stays 10 files (`FILE_CONSTRAINTS`). Server is authoritative, the client pre-validates for fast feedback.
- Error copy is fixed by the PRD and lives in one file, `src/lib/library/messages.ts` (05 section 4). The unsupported message does not list supported types.
- Storage label "X GB used" sits beside the Library title on every tab, in search and in loading/empty/error states. Cap and breakdown in Settings are sample figures until storage plans exist.

## 11. Interaction principles to carry over

Quiet page: a title, structured rows, at most one short line. Hints behind an info icon. Status is an icon or dot plus a word. Toasts are a few words with one action. One black action per surface. Red only for Delete. Generated files carry a soft-mint sparkle after the name, then the unread dot. Access column shows soft tinted avatars, owner first, a "+N" circle, or a lilac building circle for the whole workspace.

## 12. Settings, governance and launch controls (added from PRD sections 10 and 12)

- Which setting wins: saving files = force-off, then the person, then the workspace default. AI searching Library = Admin AI-reference switch **and** the person's Search my Library must both be on; a file attached by hand is always used.
- AI reference off: takes effect for everyone within 60 seconds; browsing, search and manual attach keep working; the personal switch shows disabled with "Your Admin has turned this off".
- Changing a setting: effective for new activity straight away; people's own choices are kept unless force-off overrides; members see a short notice saying what changed.
- Two Admins change the same setting: the later change wins and the other Admin sees "Changed by Priya just now". A setting that fails to save: "Couldn't save this setting. Nothing changed." and the previous value stays.
- Admins see usage and settings, never the content of another member's private files (GOV-7).
- The last Admin cannot be removed or leave: "Name another Admin first".
- Data-use statement in Library settings (not used to train models; encrypted in transit and at rest; each workspace's search index separate). Wording is Legal's (OQ-12).
- Kill switches, per workspace and instant: auto-save, AI use of Library, sharing. Rollback of any phase hides its UI and AI retrieval without deleting stored files.
- Existing content: past chat files and routine outputs already delivered are offered a **one-time, opt-in Import to Library**. Nothing is imported automatically.
- First-use auto-save notice is required by the PRD and omitted by the owner (OQ-10).

## 13. AI behaviour contract the UI depends on (PRD section 11)

| Rule | UI consequence |
|---|---|
| Grounded answers: claims from Library are cited; if the files do not have the answer the AI says so | "I couldn't find this in your files."; general answer marked as not from files |
| Verified citations: unverifiable ones are dropped before display | UI never shows an unverified chip; chip text is the file's current name |
| Content is data, not commands | approval cards for side effects name the file that prompted them |
| Permission fidelity: the AI acts with the requester's permissions; in a Slack channel only what every member can open | locked chips reveal no title or snippet |
| No self-contamination: agent-made files are not sources until attached | generated files appear in Library and picker but are not auto-retrieved |
| AI never edits an uploaded file in place; changes become a new file (RTN-13) | no in-place edit UI; new file appears as Generated |
| Freshness and contribution transparency | later (OQ-14); API carries `addedBy`, `addedAt` |
| Output saving: only file-like outputs auto-save | no "saved" toast for plain text answers |
| Audio: stored and playable; transcribed when the AI uses the recording; cannot transcribe -> "I couldn't transcribe this recording." and the message stays | File page shows transcript only once it exists (OQ-13) |

Release gates the front end must not undermine: citation accuracy >= 98 %, honest abstention >= 90 %, zero permission leaks, zero unconfirmed side effects in the injection suite, 100 % deletion propagation within the windows.

## 14. Edge-case register

IDs are stable so QA, design and engineering can refer to them. "FE" = front-end doc section, "BE" = backend doc section.

| ID | Edge case | Required behaviour | Where |
|---|---|---|---|
| EC-01 | Same file uploaded by two members | separate copies; nothing reveals the other | 01 s2, FE 6, BE 7 |
| EC-02 | Same person uploads the same file twice | two separate files, same name, Created tells apart | 01 s2 |
| EC-03 | File shared directly and with the whole workspace | one Viewer access; Who has access lists both ways; removing one keeps the other | 01 s5 |
| EC-04 | Slack channel with external members | no save, no Library use, says why, fails closed | BE 6.8b |
| EC-05 | Channel membership changes between question and answer | checked at request time | BE 6.8b |
| EC-06 | Routine owner removed | routine paused; outputs follow the transfer rule | 01 s8, BE 6.6b |
| EC-07 | Routine deleted | outputs stay unless "Also delete its N run outputs" ticked | 01 s6, BE 6.6b |
| EC-08 | Run fails after writing part of its output | no file created; failure in run history | BE 6.6b |
| EC-09 | File renamed after being cited | citations store id, show current name | FE 8b |
| EC-10 | Scan with no readable text | stored, "not searchable", Retry OCR (if OQ-9 says ship) | BE 3.2 |
| EC-11 | Search over a very large Library | answer states how many files searched, suggests filters | FE 8b |
| EC-12 | Share revoked while the other person has the file open | next request re-checks; "No longer available" | FE 8b |
| EC-13 | Moving content between workspaces | unsupported; export and re-import | 01 s6 |
| EC-14 | Audio that cannot be transcribed | stored and playable; AI says it could not transcribe | 01 s13 |
| EC-15 | Connection drops during upload | "Upload paused..."; resumes; never Ready while partial | FE 6 |
| EC-16 | Processing takes over 10 minutes | notice, one automatic retry, Send stays off | FE 6, BE 4 |
| EC-17 | Saving to Library fails after send | message sends; retries x3; "Not in Library" + Save again | FE 6, BE 4 |
| EC-18 | File removed before send | deleted at once with derived data | FE 6, BE 4 |
| EC-19 | Draft abandoned | staged files purged with the draft, 24 h max | BE 4 |
| EC-20 | File deleted mid-chat | "This file is no longer available"; leaves Sources | FE 8b |
| EC-21 | Access removed mid-chat | next message re-checks; old citations lock | FE 8b |
| EC-22 | Cited passage cannot be verified | citation dropped before display | BE 6.2b |
| EC-23 | Too many files in use | best matches used; says so | FE 8b |
| EC-24 | Admin changes AI switch during a chat | next message stops automatic search; inline note | FE 8b |
| EC-25 | Two Admins change one setting | later wins; "Changed by Priya just now" | FE 9, BE 3.10b |
| EC-26 | Force-off conflicts with a person's choice | force-off wins; message shown | 01 s4 |
| EC-27 | Last Admin removed | refused: "Name another Admin first" | 01 s9 |
| EC-28 | Leaver has not answered the transfer question | access ends now; data untouched; removal waits | 01 s9, BE 6.7 |
| EC-29 | Restore after the window ended | "This file was permanently deleted." (owner only) | 01 s6 |
| EC-30 | Opens a deleted file's link | "No longer available", no title | 01 s6 |
| EC-31 | Derived-data clean-up fails | retried until success; team alerted; nothing shown | BE 6.1b |
| EC-32 | Delete forever by mistake | confirmation first; no undo after | 01 s6 |
| EC-33 | Output file over the size limit | "Not saved..."; message still delivered | 01 s8 |
| EC-34 | Owner loses access to a file a routine uses | routine loses it too; run history says so | 01 s8 |
| EC-35 | Attached routine file deleted | run proceeds without it; history names it | 01 s8 |
| EC-36 | Slack file cannot be fetched | bot says so; nothing saved | BE 6.8b |
| EC-37 | Slack file still processing | bot says it is still reading | BE 6.8b |
| EC-38 | Library unreachable from Slack | "I couldn't reach Library just now." | BE 6.8b |
| EC-39 | Workspace switched in the UI mid-flow | keys change; requests aborted; no cross-workspace rows | FE 4 |
| EC-40 | Poisoned file asks the AI to act | confirmation naming the file; never auto-executed | 01 s13 |
| EC-41 | Provenance edit attempted | impossible (write-once) | BE 3.10b |
| EC-42 | Duplicate-rate metric vs privacy | per-owner hash only; never cross-user | BE 7 |

## 15. Where this doc follows the prototype over the PRD (owner decisions, `flows.md` section 0)

So reviewers see every divergence in one place. None are re-opened here.

| PRD says | Prototype / owner decided | Effect on this doc set |
|---|---|---|
| Archive and Archived view | no Archive; Delete -> Trash | no archive endpoints or UI |
| Trash window 7 to 90 days (Admin) | fixed 30 days | no Trash setting |
| Run output retention (keep last 30) and Keep | left out | not built; schema stays compatible |
| Origin (Web/Slack) and Made by columns | Source (Uploaded/Generated) and Access columns | list columns follow the prototype |
| Upload button, drop area, uploads tray in Library | none; files come through chat and Slack | composer-only upload |
| Needs attention state, Retry or Delete | failed uploads are a message only | conflicts with PRD "Retry OCR / not searchable": OQ-9 |
| Failure messages name the file | messages never name the file | follow the prototype (OQ-21) |
| Unsupported message lists the supported types | list dropped | follow the prototype |
| Shared with me grouped by who shared | flat list, Access avatar shows the sharer | follow the prototype |
| Role-aware Trash tab | Trash always a header button | follow the prototype |
| Storage cap not shown | "X of 20 GB" sample in Settings | OQ-1 |
| First-use auto-save explanation | omitted | OQ-10 |
| Transcribe on use (Send never held) | prototype shows an audio transcribing step and a transcript on the File page | OQ-13 |

## 16. Open questions (log)

This doc's items: OQ-1, OQ-9, OQ-10, OQ-12, OQ-13, OQ-14, OQ-15, OQ-16, OQ-17, OQ-18, OQ-19, OQ-20, OQ-21. The master log with owners is at the end of `05-delivery-plan-and-qa.md`.
