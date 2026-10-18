# [Backend] Library gaps found while testing the prototype checkpoints

| Field | Value |
|---|---|
| Type | Running list (one section per checkpoint that needs backend work) |
| Area | Backend `services/library`, chat send, `services/automations` (Flow B routines) |
| Source | Prototype checks in `library-prototype/surfaces/library/lib/data.ts` (Flow A to H), run live against the dev backend from `front-end` |
| Related tickets | `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md` (all of Flow A, including settings and citations) |
| Front-end contact | _fill in_ |

Each section: the check, what was seen live, why it is backend, what is needed, and how to verify.


> **Flow A sections moved (2026-10-19)** to `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md`, together with the settings and citations tickets. This file keeps Flow B and later.

---

## B. Routines: attach files on create, test run, attached files, run outputs, privacy (Flow B, all checks)

**Checks (prototype Flow B, "Set up a routine"):**

| # | Check | Live result (2026-10-18) |
|---|---|---|
| B1 | Before anything is created, a Routine details card asks "Attach the Return policy and Shipping rates?" with Attach both and Not now. | **Blocked.** No card, no attach offer |
| B2 | After Create routine, a Routine created card shows the name, schedule, delivery, attached files and "Test run: Done." All files with Source: Generated has one "Test run - product copy". | **Blocked.** Routine created, but no card, no test run, no file |
| B3 | The routine's pane lists Attached files and lets you add or remove one. | **Blocked.** Routines have no attached files |
| B4 | "All run outputs in Library" and the card's Run outputs button open All files with Source: Generated. | **Partial.** Fixed in the front end on the routine page; the card button waits on B2 |
| B5 | Routines lists Draft product copy. As Maya, it is not there. | **Fail.** Maya sees it under Organization |
| B6 | Run now saves a Run output named "Draft product copy - <date>" that lists the attached files, and adds a line to Run history. | **Partial.** Run history works; file name and file list wrong |
| B-d1 | Not now, then Create routine: card shows Attached files: None, and the pane says "No files attached." | **Blocked** by B1-B3 |
| B-d2 | Create routine is greyed out until Attach both or Not now is chosen. | **Blocked** by B1 (front end ready) |

**Seen live (admin account "You", member account "Maya"):**

- Asking a new chat for "a routine that drafts product copy for our new arrivals every Monday morning" (three runs): the agent asks its own questions in the generic question card ("Where are your new-arrival product details stored?", "Where should the generated copy go?"). The questions change from run to run, Library files are never mentioned, and picking Shopify goes straight to "Connect Shopify". No Routine details card.
- Asking it to just create "Draft product copy", Mondays 9am, Word document: routine `90fd1216-0797-4a59-9b12-0fff89d17c5a` is created (`cron 0 9 * * 1`, active), but `runs: []`, no new generated file in Library, and no Routine created card in the chat.
- `/schedules/<id>` shows What it does, Run history, Details and Run now. No Attached files; `GET /automations/{id}` has no file field.
- Run now: the run succeeded in ~21 s and Run history shows "Completed". Library gained **`files/Draft_product_copy_2026-10-18.docx`**, Source Generated, owner-only, `generatedFrom: {kind: "chat", label: "Draft product copy"}`.
- As Maya: not in Mine, but listed under **Organization** ("Everyone in your organization can see these. Copy one to run it as your own."), with name, summary, schedule and run stats. `GET /automations/organization` returns it.

**Why it is backend:**

1. **Routines have no attached files.** The `Automation` row (`services/automations/models.py` ~lines 26-90) has no file column or join table, `automation_manage` `create` takes no file ids (`services/automations/tool.py` ~lines 75-150), and `PATCH /automations/{id}` (`services/automations/router.py`) only pauses, resumes, renames or edits the summary. `DocumentUse.automation_id` (`services/document/models.py` ~line 98) records files a run *read*, not files *attached*. (B1, B3, B6, B-d1)
2. **Nothing pauses before creation.** Creation is one agent tool call. There is no structured proposal (name, schedule, delivery, candidate files) the chat could render as a card, no create endpoint for Create routine to call, and nothing tells the agent which Library files the chat used. (B1, B-d2)
3. **No test run and no "created" event.** `create` (`tool.py` ~lines 287-300) saves and returns `publicRow`; it never fires a run. The agent's own checks run in its sandbox and are not `AutomationRun`s. The tool result is hidden in chat, and no event carries the summary for the Routine created card. (B2)
4. **Run outputs don't know their routine and have bad names.** A run's file reaches Library through the routine's anchor chat (`services/document/workspace.py` `library()` ~lines 416-447), with `filename=file.name[:255]`, so the automation-folder path (`files/…`) leaks into the title. `generatedFrom` is always `kind="chat"` (`services/library/library.py` ~lines 264, 408). Nothing records the run or the files it used. (B2, B6)
5. **Routines are visible org-wide.** `GET /automations/organization` (`router.py` ~line 136) returns every other member's live automations to everyone in the org. (B5)

**Needed:**

1. **Attached files on a routine** (fixes 1): `Automation.attached_document_ids` or an `AutomationDocument` table; `attachedFiles: [{id, title, format, state}]` on `GET /automations/{id}` (`state` covers deleted / no access, so the page can say the next run skips it); owner-only add/remove (`PATCH` with `attachedFileIds`, or `POST`/`DELETE /automations/{id}/files/{fileId}`) within the per-message file limit; every run is given those files and writes `DocumentUse(kind="read", automation_id)` for each.
2. **Proposal before create** (fixes 2): when the agent is ready to create, emit a `routine_proposal` CUSTOM event `{proposalId, name, schedule, deliversTo, candidateFiles: [{id, title}]}`, built from the Library files this chat attached or cited, and stop. `candidateFiles: []` means the card asks nothing about files.
3. **Confirm, test run, created event** (fixes 2, 3): `POST /automations/proposals/{proposalId}/confirm {attach: boolean}` creates the routine with or without the files, fires one test run (`AutomationRun.kind = "test"`), and emits a `routine_created` event, also kept in message history so a reload shows it: `{automationId, name, schedule, deliversTo, attachedFiles, testRun: {status: "done"|"failed"|"running", fileId}}`.
4. **Run outputs** (fixes 4): Library title is the basename only (never `files/…`); a test run's file is "Test run - <short label>" and a normal run's is "<Routine name> - <run date>"; `generatedFrom: {kind: "run", routineId, routineTitle, runId, test}`; the file detail lists `usedFiles: [{id, title, state}]`, the attached files the run was given minus any it skipped.
5. **Privacy (product decision first)** (fixes 5): either routines are private and `/automations/organization` returns only routines their owner chose to share (`Automation.shared`, default false), or org-wide visibility stays and the prototype check changes. Either way, never expose attached file names to people who can't open those files.

**Front end (already built, waiting on the above):**

- `src/components/Library/routines/RoutineChatCards.tsx`: `RoutineClarifyCard` (Routine details: Attach both / Not now; Create routine disabled until answered; "No files attached" after Not now) and `RoutineCreatedCard` (Name, Schedule, Delivers to, Attached files or "None", "Test run: Done", Open routine, Run outputs). Covered by `RoutineChatCards.test.tsx` (5 passing). Rendered once events 2 and 3 exist.
- `src/components/Library/routines/RoutineLibrarySections.tsx`: `RoutineAttachedFiles` (list, Add files picker, remove, "No files attached."), unavailable-file note, run kinds. Goes into the routine page once 1 exists.
- **Done 2026-10-18 (B4):** the routine page (`src/components/Schedules/ScheduleDetailView.tsx`) has a Run outputs section with "All run outputs in Library", which opens `/library?tab=all&source=generated` (verified live).

**Verify (after 1-5):**

1. In a chat that used two Library files, ask for a weekly routine. Before anything is in Schedules, a Routine details card asks "Attach <file 1> and <file 2>?"; Create routine stays greyed until Attach both or Not now. (B1, B-d2)
2. Attach both → Create routine: the Routine created card shows name, schedule, delivery, both files, "Test run: Done". `GET /automations/{id}` has one `test` run; All files with Source: Generated has one "Test run - …" whose File info names the routine. Reload keeps the card. (B2)
3. The routine page lists both files; add one from Library and remove one, and both changes survive a reload. (B3)
4. The card's Run outputs and the page's "All run outputs in Library" both open All files with Source: Generated. (B4)
5. As Maya, the routine is in neither Mine nor Organization (if option "private" is chosen). (B5)
6. Run now: a new generated file "<Routine> - <date>" (no `files/`), File info lists the files this run used, Run history gains a line. (B6)
7. Repeat with Not now: the card says "Attached files: None" and the routine page says "No files attached." (B-d1)

---

## C. A routine run saves its output (Flow C)

Stand-ins for the prototype data: **Draft product copy** (`90fd1216-0797-4a59-9b12-0fff89d17c5a`, makes a .docx each run) for Weekly sales report; **Daily sales message** (`4983e23b-1cca-47de-ab76-81054e95f49a`, made in chat: replies with one text line, no file, no connector) for the prototype's message-only routine; **Always fails** (`328da2a0-a63a-4345-bd84-beb9a42bf923`, made in chat: its script only throws) in place of "Simulate a failed run". The admin account is "You" and the member account is "Maya". There is no third account, so Sam is not tested.

**Checks (prototype Flow C, "A routine run saves its output"):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| C1 | A new run output is a row in All files, newest first, with Source Generated and only your avatar under Access. Run now again adds another row; runs are never removed on their own. | **Pass.** Two runs added two rows at the top, owner-only, and the earlier run's file stayed. Two runs on the same day get the same name (see Needed 1) |
| C2 | A message-only run adds a line to run history only, and its pane says results stay in run history, not in Library. | **Partial.** The run adds one "Completed" line and no file, but the page still shows Run outputs and never says results stay in run history: the API can't tell a message-only routine from one that makes files (Needed 2) |
| C3 | A failed run appears in run history and creates no file. | **Pass.** "Failed" line in run history, no new file |
| C4 | A run output's … menu is the ordinary file menu (Open, Ask about this, Share, Download, Rename, Delete), no Keep, marked as generated. | **Pass** (front end only) |
| C5 | A deleted run output goes to Trash with days left, and Restore brings it back. | **Pass** (front end only) |
| C6 | As Maya, no run output shows in All files. File info says Private under Who has access. | **Pass.** Maya sees no run output. "Private" was missing from File info and is now fixed in the front end |
| C7 | After Run now, Slack #ops shows "<Routine> is ready."; a message-only routine posts its line there. | **Blocked (environment).** No Slack workspace is connected (`GET /slack/status` → `{"workspaces":[]}`). There is also no built-in "is ready" post (cause 3) |
| C8 | File info says which routine and run made it, links to the routine, and lists Files this run used. | **Blocked.** It says "Made by Souvenir in a chat, Draft product copy" and has no Files this run used (see B, Needed 4, and Needed 3 here) |
| C9 | Run outputs are ordinary rows in All files; "All run outputs in Library" and Suggested's See all open All files with a Source: Generated chip; removing it brings every file back. | **Pass** (front end only) |
| C-d1 | Pressing Run now twice quickly does not start two runs. | **Pass.** The backend already let only one run through. The front end let a second POST go out and re-enabled Run now during the run; that is now fixed. The duplicate POST still answers `started: true` (Needed 5) |
| C-d2 | A deleted attached file is skipped by the next run, and run history says Skipped 1 file. | **Blocked.** Routines have no attached files (see B, Needed 1); a run also can't report skipped files (Needed 6) |

**Seen live (admin account "You", member account "Maya"):**

- Run now twice, waiting for each run to finish: runs `a1e5ac78…` and `6c4adb22…` both `succeeded`. `GET /library/files?tab=all&source=generated` and All files (Source: Generated) gained two rows at the top, newest first: both named **`files/Draft_product_copy_2026-10-19.docx`** (12:40 AM and 12:41 AM), Source Generated, only the owner under Access. The run from 2026-10-18 is still listed below them.
- Daily sales message, Run now: the run `succeeded` with `answer: "Sales today: 42 orders, $1,980."` and no new generated file. The page shows "Run outputs / All run outputs in Library" and one "Completed" line. The run rows in `GET /automations/{id}` have no `files` field, and the automation has no field for what kind of output it makes.
- Always fails, Run now: the run is `failed` with error "Something in its script failed. We've logged it — try again, and edit the script if it keeps failing." Run history shows "Failed" and no file was created. The routine page also shows Run outputs here.
- A run output (`cce0ec9f…`): the … menu shows exactly Open, Ask about this, Share, Download, Rename, Delete. Delete then Move to Trash removes it from All files; Trash lists it with "30 days"; Restore puts it back in All files (and the API).
- As Maya: `GET /library/files?tab=all` has no run outputs, and `GET /library/files/cce0ec9f…` returns `file_locked`.
- `GET /slack/status` returns `{"workspaces":[]}`.
- `GET /library/files/cce0ec9f…` returns `provenance: {kind: "chat", label: "Draft product copy", via: "web", chatId: "94bdd36e…"}`: no `routineId`, no `runLabel`, no `runInputs`.
- Suggested → Generated → See all, and the routine's "All run outputs in Library", both open `/library?tab=all&source=generated` with a "Generated" chip beside Filter. The only tabs are Suggested and All files. "Remove Generated" brings back Uploaded and Generated files.
- Daily sales message, Run now pressed twice quickly (before the fix): two `POST /automations/{id}/run` both returned `200 {"started": true}`, but only one run was created. After the first POST, Run now was enabled again and the page showed no "Running now".

**Why it is backend:**

1. **Same-day runs get identical names.** The run's script picks the file name (`Draft_product_copy_<date>.docx`), and Library copies it as-is (`services/document/workspace.py` `library()` ~lines 416-447, see B cause 4). Two runs on one day make two files with the same name that can't be told apart. (C1)
2. **Nothing says a routine is message-only.** `automationDict` (`services/automations/repository.py` ~line 212) returns no output kind, and `RunResponse` (`services/automations/schemas.py` ~line 192) leaves out `AutomationRun.files` (`models.py` ~line 128), so the page can't tell a message run from a file run. (C2)
3. **No "ready" notice after a run.** Delivery is whatever the routine's own script does with the owner's connectors (`models.py` `Automation` docstring). Nothing posts "<Routine> is ready." when a run saves a file. (C7)
4. **File detail has no routine origin.** `provenance` on `GET /library/files/{id}` is always `kind: "chat"` for run outputs, with no `routineId`, `runLabel` or `runInputs` (same root cause as B cause 4). The front end reads these exact fields. B, Needed 4 called them `generatedFrom`/`usedFiles`, which doesn't match. (C8)
5. **A duplicate Run now looks successful.** `POST /automations/{id}/run` (`router.py` ~lines 184-194) always returns `{"started": true}`. When a run is already going, `runner.py` (~lines 350-355) hits the `uq_automationrun_one_running` index and quietly skips, so the caller is never told. (C-d1)
6. **Runs can't report skipped files.** Beyond B cause 1 (no attached files), `AutomationRun` has nothing for the files a run left out, so run history can't say "Skipped 1 file". (C-d2)

**Needed:**

1. Extends B, Needed 4: when a routine already has a run output with the same "<Routine name> - <run date>" title, the next one gets " (2)", " (3)" and so on, as in the prototype (`lib/reducer.ts` `run-finish`). (C1)
2. On `GET /automations` and `GET /automations/{id}`, add `output: "file" | "message"`, set when the routine is created or edited (or worked out from the program). On each run, add `files: [{id, title}]` (the Library files it saved; empty for a message or failed run). (C2)
3. With B, Needed 4: send the run origin in the shape the front end already reads. That means `provenance: {kind: "routine", via: "routine", label: <routine name>, routineId, runLabel: <run date as run history shows it>, isTestRun}` and `runInputs: [{id, title, state}]` on `GET /library/files/{id}`, and `generatedFrom: {kind: "routine", label}` on list rows. (C8)
4. Optional, product call: when a routine is connected to Slack, post "<Routine> is ready." with a link once a run saves its output (C7). Without it, C7 depends on each script.
5. `POST /automations/{id}/run` returns `409 {"code": "already_running"}` when a run is in progress instead of `started: true`. (C-d1)
6. With B, Needed 1: each run records `skippedFileIds` (or `skippedCount`) and returns it in `runs[]`, so run history can say "Skipped 1 file". (C-d2)

**Front end already has:** All files lists run outputs newest first with Source and Access columns; the title shown is the backend's. The file … menu, Trash with days left and Restore work on run outputs. File info now says "Private" when only the owner has access (`src/components/Library/FileInfoCard.tsx`). For C2, `RoutineRunHistory` (`src/components/Library/routines/RoutineLibrarySections.tsx`) already has run kinds output/message/fail; the routine page will swap Run outputs for "Results stay in run history, not in Library." once `output` arrives. File info renders "Made by routine <link>, run of …" and "Files this run used" from `provenance`/`runInputs` (C8). Run now marks the routine running as soon as the POST succeeds, stays disabled until polling sees the run end, and shows "Running now" (`src/app/(app)/schedules/use-schedules.ts`, `SchedulesScreen.tsx`) (C-d1). `RoutineUnavailableNote` ("…The next run skips it.") is built but unused, waiting on B, Needed 1 (C-d2).

**How to verify:**

1. Run a file-making routine twice on the same day: All files (Source: Generated) shows "<Routine> - <date>" and "<Routine> - <date> (2)" at the top, owner-only, and earlier run outputs are still there. (C1)
2. `GET /automations/{id}` for a message-only routine returns `output: "message"`, and its runs have `files: []`. Its page says "Results stay in run history, not in Library." and has no Run outputs section. A file routine's newest run lists the file it saved. (C2)
3. With Slack connected and posting on (Needed 4), Run now on a file routine posts "<Routine> is ready." in its channel. (C7)
4. Open a new run output's File info: "Made by routine <name>, run of <date>" links to `/schedules/<id>`, and Files this run used lists the attached files. (C8)
5. Send `POST /automations/{id}/run` twice within a second: the second returns 409 `already_running`, and only one run is in history. (C-d1)
6. Attach two files to a routine, move one to Trash, and press Run now: the run output lists only the other file, and the run in `runs[]` reports one skipped file. (C-d2)

---

## D. Ask in Slack: Library answers, save from Slack, find, locked citations (Flow D, all checks)

Stand-ins for the prototype data: **Return policy 2026** is a real seeded file (`fed80a8c-1964-4c5d-a0d0-f1b2c0f6aeba`). **Acme contract** is **Supplier contract - Acme** (`8d081d29-5693-49c6-85e6-a12779d58dc5`, admin-only: `scope: "private"`, `ways: []`). The prototype's **Return policy 2025 in Trash** is the seeded "Return policy 2025" (`357c09f0…`), which is active here, so it was moved to Trash for the search test and restored right after. The chat **Autumn supplier plan** is Maya's own chat "Example.com Main Heading" (`ff3ebd82…`), whose history response was patched in the browser to carry a locked citation (see "Seen live"). There is no Sam: **Maya** (member) plays Sam. The admin account is "You".

**Slack is not connected, so no Slack message could be sent.** `GET /slack/status` returns `{"workspaces":[]}` for both the admin and Maya. Every check that needs a real Slack message is **Blocked (environment)**. For those, `back-end/services/slack`, `services/library`, `services/document` and the front end were read, and the table says whether the behaviour exists in code ("by code").

**Checks (prototype Flow D, "Ask in Slack"):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| D1 | The return window answer cites the Return policy, and the citation opens that File page. | **Blocked (environment)** for the Slack answer; **by code: not built** (causes 1, 3). The File-page half **passes** live: a chat citation chip opens `/library/files/<id>?cite=page%3A3`, the File page for Return policy 2026 |
| D2 | The Acme answer in the channel says it used only files everyone in the channel can open, and that one relevant file was left out, without naming it. | **Blocked (environment)**; **by code: not built** (causes 1, 4) |
| D3 | The same question as a direct message cites the Acme contract, because You can open it. | **Blocked (environment)**; **by code: not built** (causes 1, 3) |
| D4 | As Sam (Maya), "Locked file" opens a panel that says "You don't have access". Its Request access button changes to "Request sent". | **Partial.** Panel: **fixed in the front end, passes live** (the chip did nothing before). Request access: **backend** (cause 5): the endpoint does not exist. Button built behind a flag and verified with the POST mocked |
| D5 | The bot confirms where the attached file was saved, the file appears in Library, and its File page says it was uploaded in Slack. | **Blocked (environment)**; **by code: not built** (cause 2). The front end already says "Uploaded by You in Slack" (verified live with a patched response) |
| D6 | "Find the return policy" replies "Found 1 file." with a link to Return policy 2026 that opens its File page. The 2025 policy, which is in Trash, is not listed. In a channel, only files everyone can open are listed. | **Blocked (environment)**; **by code: not built** (causes 1, 4). Library search itself leaves Trash out (live pass) |
| D7 | A file saved from Slack stays private to the person who sent it: as anyone else, it is not in Library. | **Blocked (environment)**; **by code:** Slack saves nothing (cause 2). Library's owner-only default holds live: Maya gets `file_locked` for another person's file and it is not in her search |
| D-d1 | An attachment sent without "save this" is not saved, and the bot says how to save it. | **Blocked (environment)**; **by code:** never saved (nothing is), but the bot never says how to save (cause 2) |
| D-d2 | A question the bot does not know gets the prototype reply, not silence. | **Blocked (environment)**; **by code:** the bot is told not to stay silent (`services/slack/prompt.py:25`), so a question is answered, in the model's own words, not the prototype's fixed line. It cannot say "not in your files" because Slack has no Library search (cause 1) |

**Seen live (admin account "You", member account "Maya"):**

- `GET /slack/status` → `{"workspaces":[]}` for both accounts.
- **Locked file page.** `GET /library/files/8d081d29…` as Maya → `403 {"code":"file_locked","message":"You don't have access to this file."}`. The File page shows "You don't have access / Ask the owner to share it", no title, no button.
- **Locked citation chip.** The backend sends no `library_citations` yet (see `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md`, A9), so no real chat can hold one. To see the chip, Maya's chat history response was patched in the browser: output `… [[L1]]` and `library_citations: [{id: "L1", fileId: "8d081d29…", state: "locked"}]`. **Before the fix:** "Locked file" showed and clicking it did nothing (the chip had no click handler wired and the file panel was never mounted anywhere). **After:** it opens a panel beside the chat: "Locked file / You don't have access / Ask the owner to share it".
- **Request access.** `POST /library/files/8d081d29…/access-requests` as Maya → `404 {"detail":"Not Found"}`. With the flag on against the real backend, the button stays "Request access" and an error toast shows. With the POST mocked to 204, the panel button becomes "Request sent" (disabled), and after a reload the File page for the same file also reads "Request sent".
- **Open citation chip (D1, File-page half).** History patched with an open citation for Return policy 2026 (page 3): the chip is a link to `/library/files/fed80a8c…?cite=page%3A3`; clicking it opens that File page.
- **Search leaves Trash out (D6, Library half).** `GET /library/files?tab=all&q=return policy` listed Return policy 2025. After moving it to Trash (`DELETE /library/files/{id}` → `daysLeft: 30`) it was gone from the results and listed under `GET /library/trash`; after `POST /library/trash/{id}/restore` (204) it was back. The search also matches file text, so it returns more than the name matches (several earlier test files).
- **Private to the owner (D7, Library half).** As Maya: `GET /library/files/fed80a8c…` → `file_locked`; `GET /library/files?tab=all&q=return` does not list Return policy 2026. (Maya's Shared tab now holds files other test flows shared with her; Return policy 2026 is not among them.)
- **"in Slack" wording (D5, front-end half).** `GET /library/files/{id}` returns `provenance: {"kind":"upload","label":"","via":"web","canOpenChat":false}`. With that response patched to `kind: "slack", via: "slack"`, File info reads "Uploaded by You in Slack".

**Why it is backend:**

1. **Slack never looks at Library.** `services/slack` imports nothing from `services/library`. A Slack turn builds its files in `turn.py` (~lines 664-675): the thread's uploads plus the channel's project knowledge, with `priorAttachments=[]`. So "What is our return window?" in Slack can't use Return policy 2026, and nothing says "not in your files". A turn also runs as the linked member (`models.py` ~line 65, `turn.py` ~line 223), in a channel too: the answer uses the asker's own access, never "files everyone in the channel can open", and nothing says a file was left out. This is the same missing automatic retrieval as A13, plus a channel rule. (D1, D2, D3, D6, D-d2)
2. **Slack attachments are never saved to Library, and Library can't record Slack.** `Workspace.addUploads` (`services/document/workspace.py` ~lines 135-170) only stores the object in S3. The code that makes the `Document` row, `persistMany` (~line 383), is called only from web chat (`services/chat/service.py` ~line 689) and the sandbox (`services/sandbox/session.py` ~line 818), never from a Slack turn, and nothing reads "save this to Library" or tells the sender how. `Document` has only `origin_chat_id` (`services/document/models.py` ~line 31), no Slack channel, message or `via`. Library always answers `via="web"` and kind `chat` or `upload` (`services/library/library.py` ~lines 408-410), although the schema allows `"slack"` (`services/library/schemas.py` ~lines 75-77). (D5, D7, D-d1)
3. **No Library citations in Slack.** Slack answers cite only tool results as `[[1]](url)` (`services/slack/prompts.yaml` ~lines 739-745). Nothing builds a link to a Library file, and the web citation event (A9) is not used by Slack. (D1, D3)
4. **No find (or share) by asking.** The Slack agent has no Library tool. `services/library/router.py` (~lines 34-176) has list/search, detail and grants, but nothing the bot calls, and nothing applies the channel rule or leaves Trash out for a bot reply. Sharing by asking is Flow E. (D6)
5. **No access-request endpoint.** `services/library/router.py` has no `access-requests` route. `04-backend-requirements.md` ~line 178 lists `POST /library/files/{id}/access-requests`, and section 6.9 lists a `library.access_requested` notification. Neither exists. (D4)
6. **No "everyone in this channel" rule anywhere.** Slack knows the channel's members, Library knows grants, and no code relates them. In a Slack Connect channel, `extShared` (`services/slack/router.py` ~lines 883-890) only picks which bot team answers; Library is never told. (D2, D6, D7)

**Needed:**

1. **Library in Slack turns** (extends A, A13; fixes 1, 6): search the asker's Library in a Slack turn, with one resolver for who may see what. In a **DM**: files the asker can open. In a **channel**: only files every member of that channel can open (granted to the whole workspace), checked when the answer is made, and none in a Slack Connect channel (fail closed, `04-backend-requirements.md` section 6.8b). When files were left out, end the answer with "I used only files everyone in this channel can open. N relevant file(s) was/were left out." without naming them. Never use Trash.
2. **Cite Library files in Slack** (fixes 3): after the sentence, link the file by name to `<web app>/library/files/{id}?cite=page:N`, for files the audience can open only.
3. **Save from Slack** (fixes 2): an attachment plus "save this to Library" makes a `Document` through the same path as web (owner: the linked sender, private, `source=uploaded`), records the channel and message, and replies "Saved to Library as <name>." with a link. `GET /library/files/{id}` then returns `provenance: {kind: "slack", via: "slack", ...}`. Without the phrase nothing is saved, and the reply says "Got it. Say “save this to Library” and I'll keep it." Unreadable, locked or unsafe files follow A7.
4. **Find** (fixes 4): "find <words>" replies "Found 1 file." / "Found N files." with a link each, or "I couldn't find “<words>” in files you can open." In a DM it lists the asker's open files; in a channel only workspace-granted ones; never Trash. At most five.
5. **Request access** (fixes 5): `POST /library/files/{id}/access-requests` → 204 for someone who can't open the file (idempotent per person and file; `409 already_has_access` if they can; `404` if the file doesn't exist), and a `library.access_requested` notification to the owner. Optional: return `requested: true` in the `file_locked` error body so "Request sent" survives another device (the front end keeps a local copy now).

**Front end (already built):**

- A citation chip for an open file is a link to its File page with the passage (A9). File info reads "Uploaded by <name> in Slack" whenever `provenance.kind` or `via` is `"slack"` (`src/components/Library/FileInfoCard.tsx`, checked live with a patched response), so D5 needs no front-end change.
- **Done 2026-10-19 (D4):** a "Locked file" chip now opens the locked panel beside the chat (`src/lib/library/chat-file-panel.ts`, `src/components/Library/chat/ChatFilePanelSlot.tsx` mounted in `ChatInterface.tsx`, opened from `library-citations.tsx`). The panel and the File page share `LockedState` and show "You don't have access / Ask the owner to share it", never the title.
- **Request access, restored behind a flag (D4):** commit 579f2b94 removed it ("surfaces the backend does not have"). It is back as `libraryApi.requestAccess` (`POST /library/files/{id}/access-requests`), `useRequestAccess` and a button in `LockedState` (`src/components/Library/FileStates.tsx`), remembered per person and file, hidden until `NEXT_PUBLIC_ENABLE_LIBRARY_REQUEST_ACCESS=true` (`src/lib/feature-flags.ts`). Tests: `FileStates.test.tsx`, `chat-file-panel.test.ts`. Turn the flag on when Needed 5 ships.
- Library already keeps a file private to its owner by default; once Needed 3 saves through the same table, D7 holds without more front-end work.

**How to verify (after 1-5, with Slack connected):**

1. In a DM with Souvenir, ask "What is our return window?": the answer links Return policy 2026; the link opens its File page. (D1)
2. In #ops, with a member who can't open the Acme contract, ask "What are the Acme payment terms?": the answer says it used only files everyone in the channel can open and that one file was left out, without a name. The same question by DM links the Acme contract. (D2, D3)
3. Attach a file and send "save this to Library": the bot says where it saved it, the file is in the sender's All files, and its File info reads "Uploaded by You in Slack". (D5)
4. As another member: the file is not in All files or search, and `GET /library/files/{id}` returns `file_locked`. (D7)
5. Attach a file and send no "save this": nothing new in Library, and the bot says how to save it. (D-d1)
6. "find the return policy": "Found 1 file." with a link that opens its File page. A file in Trash is not listed. In #ops only workspace-granted files are listed. (D6)
7. Ask something the files don't cover: the bot answers (no silence) and says it couldn't find it in your files. (D-d2)
8. As Maya, open a chat whose answer cites a file she can't open: the "Locked file" chip opens "You don't have access", Request access changes to "Request sent", the owner gets a notification, and a reload keeps "Request sent". (D4)

---

## E. Share files: by the dialog (works) and by asking in chat or Slack (Flow E, all checks)

Stand-ins for the prototype data. The prototype's files are not in the test accounts, so test files were sent in chats: **e1-brand-guidelines** (Brand guidelines, `5cc38f7e-d291-4227-b825-691898df25a1`), **e2-supplier-contract-acme** and **e3-supplier-contract-nova** (two files that both match "supplier contract", `6b746694…`, `8cc066fe…`), **e4-weekly-sales-report** (`6f17f2a3…`), all admin-owned, and **e5-payment-terms** (Maya-owned, `4379f6dc…`). The admin account is "You". The member account is Maya, but the app names it **"OS8 Test01"**, so chat commands used that name ("Lena" is the made-up person who is not in Souvenir). There is no Sam: Maya played Sam wherever one viewer was needed, and nothing needed a third person.

**Slack is not connected** (`GET /slack/status` → `{"workspaces":[]}`), so E9 is **Blocked (environment)**. `back-end/services/slack` was read: it has no share command and no channel check at all (causes 1 and 4).

**Checks (prototype Flow E, "Share files"):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| E1 | The share dialog adds people or the whole workspace, and says teammates can use the files in their chats and routines. | **Pass** (front end only). The field offers OS8 Test01 and "Whole workspace / Everyone in Souvenir"; the dialog says "Teammates can use shared files in their chats and routines."; Share gives a "Shared with OS8 Test01" toast with Undo |
| E2 | "Who has access" lists each way a file is shared, for example "Shared directly". | **Pass.** Owner, then "OS8 Test01 / Shared directly / Viewer", then "Whole workspace / Everyone in Souvenir / Viewer" |
| E3 | As the other person the file appears in Shared with an unread dot. Share, Rename and Delete are off with "Only the owner can change this". | **Pass** as Maya (Sam not tested). Dot on the row and on the Shared tab, on the Suggested card too. Share, Rename, Delete (and Manage access) are disabled in the … menu, in File info and on the File page, each with the tooltip |
| E4 | Shared is one flat list: Name, Access, Date shared, Type; unread and newest first; same Filter and Sort; dot right after the name; File info says how it was shared. | **Pass.** Columns, order (unread files first, then newest), Filter, Sort (Name, Date shared, Newest/Oldest first) and the dot all as specified. File info says "Shared directly" / "Whole workspace" |
| E5 | With one person added directly and the whole workspace added, Who has access lists both. As that person, Shared lists the file once, and File info reads "You: Viewer" and both ways. | **Pass.** `GET /library/files?tab=shared` returns the file once; File info: "You: Viewer", owner, "You / Shared directly", "Whole workspace / Everyone in Souvenir" |
| E6 | Removing the person warns that answers already received stay in their history, but citations lock. As them the file is gone from Shared and its citation reads "Locked file". | **Partial.** Warning **passes** ("OS8 Test01 loses the file now. Answers already received stay in their history, but citations to it lock."). The file is gone from Maya's Shared tab and `GET /library/files/{id}` → `403 file_locked`. The "Locked file" citation **cannot be produced**: no chat has a real citation (cause 5) |
| E7 | Asking Souvenir to share a file shares it as Viewer, confirms it with an Undo, and Undo removes the access. | **Fail (backend).** "@Souvenir share the e4 weekly sales report with OS8 Test01" → "I found e4-weekly-sales-report.txt in the Quick Test chat. Sharing requires using the Souvenir web interface; approve browser access and I can share that chat with OS8 Test01." Nothing was shared, no confirmation, no Undo |
| E8 | A file you do not own, a name that matches several files, or a person not in Souvenir gets a reply and nothing is shared. | **Fail (backend).** None of the three got a prototype reply. Maya's file: a question card "Should I use the browser to share it with OS8 Test01?". "share the supplier contract with OS8 Test01" (matches e2 and e3 and more): "Sharing isn't available through an API; it requires the Souvenir web interface… Approve browser access and I'll locate the supplier contract and share it". "…with Lena": offers to share e4 with Lena if browser access is approved. Nothing was shared |
| E9 | In the Slack channel, the confirmation does not name a file the channel members cannot all open. | **Blocked (environment)**, and **by code: not built** (causes 1, 4): Slack has no share command, so no confirmation exists to be channel-safe |
| E10 | As You (Admin), a file Maya shared with the whole workspace can be renamed, shared and deleted, and File info reads "You: Admin, can manage". | **Pass.** File info: "You: Admin, can manage". Rename saved, the Share dialog opened with Who has access, Delete moved it to Trash ("Only the owner can restore it"). Maya then saw it in her Trash and restored it; renamed back |
| E11 | Removing a person from a file that also has the whole workspace says they can still open it through the workspace. As them, the file stays in Shared and reads "Whole workspace". | **Pass.** The dialog adds "OS8 Test01 can still open it through the workspace." As Maya the file stays in Shared, and File info lists "Whole workspace / Everyone in Souvenir" |
| E-d1 | In a chat "share Brand guidelines with <person>" replies "<Person> can already open it." In the dialog, people who already have access are not offered. | **Partial.** Dialog **passes** (only "Whole workspace" was offered once OS8 Test01 had the file). Chat **fails (backend)**, same answer as E7 |
| E-d2 | The unread dot clears once the file is opened. | **Pass.** Dot on the Shared row; after opening the file and going Back, no dot and `unread: false`. One edge is backend: see cause 6 |

**Seen live (admin account "You", member account Maya = "OS8 Test01"):**

- Dialog flow as You: Share on e1, field → OS8 Test01 → Share → `POST /library/files/{id}/grants {who}` → "Shared with OS8 Test01" + Undo; reopening the dialog no longer offered OS8 Test01 (E-d1) and offered only "Whole workspace"; adding it gave a "Shared with everyone" toast and `entries: [owner, user/direct, workspace]` from `GET /library/files/{id}/access`.
- As Maya: the Shared tab appeared (it shows only once something is shared; its loading is slow, ~10 s), with a red dot. The row is `e1-brand-guidelines.txt • [avatars] Today, 2:11 AM Text`. Opening it cleared the dot (`POST …/opened`).
- Removing OS8 Test01 from e2 (Remove → confirm): the dialog also shows "Souvenir stops using it in answers within 60 seconds." (a line the prototype does not have; it comes from `docs v2/library/01-product-rules.md` line 88 and is kept). Maya's list lost the file; her File page shows "You don't have access / Ask the owner to share it".
- Chat share commands: each ran in a new chat as You and took 8–35 s; the agent searched files and said it needs browser access to share *a chat*. Afterwards `GET /library/files/{e4}/access` was `[owner]` only: nothing was shared.
- Admin over a workspace share (E10): all six … menu items enabled. After Delete, You's Trash did not list the file (`GET /library/trash` returned no e5), only Maya's did (cause 7).
- Cleaned up afterwards: the workspace share on e1, the direct share on e3 and the workspace share on e5 were removed (e2's was removed in E6). `GET /library/files/{id}/access` is `[owner]` for e1–e5, and neither account's Shared tab lists an e-file. The e1–e5 files and the chats were left in place.

**Why it is backend:**

1. **No chat or Slack command shares a file.** Library sharing exists only as `POST` and `DELETE /library/files/{id}/grants` (`services/library/router.py` ~lines 111-118, `library.py` `share`/`unshare` ~lines 565-599); nothing outside `services/library` calls `Library.share`. The chat agent is only pointed at a "product/souvenir" skill for sharing (`services/llm/agent.py` ~lines 53-60), so it replies that sharing needs the web interface and offers to drive a browser, even for a person who is not in Souvenir. `services/slack` imports nothing from `services/library` (same as D, cause 4). (E7, E8, E9, E-d1)
2. **Nothing resolves "share <file> with <person>" the prototype's way.** There is no lookup of the asker's own files by name, no rule for "more than one match" (the prototype picks the newest when it is the same name or the same routine, otherwise asks "Which one: …?"), no check that the asker owns it, and no member lookup by name. The raw material exists: `share` already refuses with `not_a_member` and `already_has_access` (`library.py` ~lines 570-586) and `manage` with `only_owner` (~line 164), but no code turns those into the replies. (E7, E8, E-d1)
3. **No confirmation to render, no Undo.** Nothing is sent to the chat to say what was shared and with which grant. `share` returns the new `AccessList` (each entry has a `grantId`), which is enough for an Undo, but no event carries it. (E7)
4. **No "everyone in this channel can open it" rule** (same as D, cause 6). Slack knows the channel's members and Library knows grants, and no code relates them, so nothing decides whether a confirmation may name the file. (E9)
5. **No Library citations at all** (A9), so no real answer can hold a citation, and nothing re-resolves a citation to `locked` after a grant is removed. (E6)
6. **Sharing again after the person opened the file does not mark it unread.** `unread` is `not owned and bool(mine) and view is None` (`library.py` ~line 257) and `unshare` leaves the person's `DocumentView` behind. Sharing e1 directly again with Maya, who had opened it, gave `unread: false`. The prototype marks it unread on every new share. (E3, E-d2)
7. **An Admin's Trash does not list what they deleted over a workspace share** (seen in E10; the check itself belongs to Flow F). `trash()` (`library.py` ~lines 379-390) lists only `owned()` files, so the Admin who trashed Maya's file cannot see it, while the prototype's `inTrashOf` also lists files the person trashed themselves.

**Needed:**

1. **A "share a Library file" action for the chat agent and the Slack bot** (fixes 1, 2): given the asker's words, find the file among files the asker can open and the person among workspace members, then call `Library.share` as the asker. Reply with the prototype's fixed texts: no such person → "Who should I share it with? Try <member names>."; the asker themself → "You already have it."; no file named → "Which file? Name it, like “the Weekly sales report”."; none found → "I couldn't find a file called “<name>” that you can open."; several → "Which one: <up to 3 names>?"; not the owner → "I can only share files you own."; already has it → "<Person> can already open it."; done → "Shared <file> with <Person> as Viewer." Several files with one name, or all from one routine, pick the newest. Nothing is shared in any reply except the last. (E7, E8, E-d1)
2. **A confirmation event** (fixes 3): when it shares, send a `library_shared` CUSTOM event `{messageId, fileId, grantId, label}`, also kept in message history, so the chat can show an Undo that calls `DELETE /library/files/{id}/grants/{grantId}` and then "Sharing undone". (E7)
3. **Channel-safe wording in Slack** (extends D, Needed 1; fixes 4): in a DM or the web chat the confirmation names the file; in a channel it names the file only when everyone in the channel can open it (the file is shared with the whole workspace, and the channel is not a Slack Connect one), otherwise "Done. Shared with <Person>." (E9)
4. **Mark a share unread again** (fixes 6): when a grant is added for someone who already opened the file, clear their `DocumentView.opened_at` (or keep a `shared_seen_at` older than the grant) so `unread` is true again; removing the grant should not leave the file unread for them. (E3, E-d2)
5. **Trash for the person who trashed a file** (fixes 7, shared with Flow F): list `trashed_by == me` files in `GET /library/trash`, with Restore left to the owner. (E10)
6. Library citations and the `locked` state on revoke are A9's work; no extra change here. (E6)

**Front end already has:** the whole dialog side (`src/components/Library/dialogs/ShareDialog.tsx`: people and Whole workspace, staged chips, the teammates line, Who has access with "Shared directly" and "Whole workspace", the remove confirm with the "answers stay, citations lock" and "can still open it through the workspace" lines, Undo on the toast, people who already have access not offered). The Shared tab, unread dot and its clearing on open (`FileTable.tsx`, `markOpened`), the "Only the owner can change this" tooltips (`src/lib/library/access.ts`, `file.ts` `caps`), the Admin "can manage" rules and "You: Viewer / Admin, can manage" in File info (`FileInfoCard.tsx`), the locked File page, and the "Locked file" chip (D4). **Not built, waiting on Needed 1 and 2:** the chat confirmation with Undo. It was never built here (not in git history, not removed by 579f2b94); it can be added as soon as the event exists. No front-end change was needed for the checks that pass.

**How to verify (after 1-5; steps 6-7 need Slack connected):**

1. As You, share a file with Maya in the dialog and as Maya open Shared: dot, row, Share/Rename/Delete off with the tooltip; open the file and the dot clears; share it with Maya again and the dot is back. (E1-E4, E-d2, Needed 4)
2. Add the whole workspace too: Who has access lists both, Maya's Shared lists the file once, File info reads "You: Viewer" and both ways. Remove Maya: the dialog says she can still open it through the workspace and the file stays in her Shared. (E5, E11)
3. In a chat, "@Souvenir share the Weekly sales report with Maya": "Shared Weekly sales report with Maya as Viewer." with Undo; Maya's Shared lists it; Undo removes it (`GET …/access` back to `[owner]`). (E7)
4. In new chats: "share Payment terms with Sam" (a file you don't own) → "I can only share files you own."; "share the supplier contract with Maya" (two files) → "Which one: …?"; "share the Weekly sales report with Lena" → "Who should I share it with? Try …". `GET …/access` is unchanged for all three. (E8)
5. After step 3, "share Weekly sales report with Maya" again → "Maya can already open it." (E-d1)
6. In #ops, "@Souvenir share the Weekly sales report with Sam": the reply does not name the file unless it is shared with the whole workspace. (E9)
7. Remove Maya from a file she got an answer about: the chat's citation for it reads "Locked file". (E6, with A9)
8. As You, trash a workspace-shared file of Maya's: it is listed in your Trash (Restore only for Maya) and in hers. (E10, Needed 5)

---

## F. Delete and restore: Trash, Delete forever, Empty Trash, deleting a chat, links and answers (Flow F, all checks)

Stand-ins for the prototype data (test files sent in chats; admin account "You", member account "Maya"; Sam is not tested, Maya takes his place): **f1-return-policy** (Return policy 2026: used in 3 chats, shared with Maya), **f2-return-policy-2025** (Return policy 2025: private), **f3-weekly-report** (Weekly sales report - 11 Aug: Delete forever), **f4-brand-guidelines** (Brand guidelines: Empty Trash), **f5/f6** (files of the chat deleted in F4), **f7/f8** (files for the AI-answer check, F11). The prototype chat "Autumn product copy" has no equivalent; chats made for this flow stood in for it. A chat for deleting was made for this flow; the existing leftovers were not touched.

**Checks (prototype Flow F, "Delete and restore"):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| F1 | The delete dialog lists chats, routines and shares, the 30-day window, and says answers already written stay. | **Pass.** "Move f1-… to Trash?", "3 chats: Return Window Policy, Item Return Period +1", "0 routines: None", "Shared with OS8 Test01", "Recoverable for 30 days. Answers already written stay as they are." The routines row can only ever read 0 (see B, Needed 1) |
| F2 | The deleted file goes to Trash with days left, leaves search and the Add from Library picker at once, and leaves Maya's Shared. | **Partial.** Trash shows "30 days"; the file is gone from All files, search (`q=`), the picker and Maya's Shared; Maya's `GET /library/files/{id}` is `404 file_gone`. But the chat it was sent in still shows its name and a working link to its contents (cause 1), and the backend still lets its owner attach it to a new chat (cause 2) |
| F3 | Restore brings the file back with its shares. | **Pass.** From the Trash row menu: back in All files, `access` still lists Maya, Maya's Shared lists it again, "Used in" still lists the 3 chats |
| F4 | Deleting a chat with saved files asks whether to also delete the files; by default they stay. | **Partial.** Live, the chat menu still opens the old "Delete chat? … permanently deleted. This can't be undone." with no file question. Built and verified with the missing backend fields simulated (causes 3, 4): "2 saved files stay in Library.", the two files, "Also delete these files" unticked |
| F5 | Delete is the only way to remove a file: no Archive in any file menu, on the File page, or as a tab. | **Pass** (front end only). Row menu: Open, Ask about this, Share, Download, Rename, Delete. File page: Share, Manage access, Ask about this, Download, Delete. Tabs: Suggested, All files, Shared |
| F6 | Return policy 2025 starts in Trash with days left, private to You: Maya's Trash is empty. Not in All files, search or the picker; Restore brings it back. | **Pass.** f2 trashed: "30 days"; not in All files, search or the picker; Maya's `GET /library/trash` is empty and her Trash page reads "Trash is empty" with Empty Trash greyed; Restore puts it back in All files |
| F7 | Delete forever asks for a confirmation, and the file is then gone from Trash. | **Pass.** "Delete f3-… forever? This frees up 81 B and can't be undone."; Cancel kept it; confirming removed the row ("… deleted forever"), the banner total dropped from 376 B to 342 B and `GET /library/files/{id}` is `404 file_gone` |
| F8 | The Trash screen: icon button, "Library > Trash", no storage label, banner with Empty Trash and "Frees up", columns Name / Days left / Size / Deleted, row menu Restore and Delete forever; Empty Trash asks first, Cancel leaves everything, confirming empties Trash. | **Pass.** Every part matched ("Frees up 376 B" = the five rows). "Delete 5 files forever? This frees up 342 B and can't be undone." Cancel left all 5. Confirming ("4 files deleted forever") emptied Trash (`items: []`, "Trash is empty", button greyed, no "Frees up") only once Trash held nothing but f-files: another chat's file had been in it, so the first attempt stopped at Cancel |
| F9 | A link to a deleted file says "No longer available" and never shows the file name. | **Partial.** Fixed in the front end: the File page now reads "No longer available" (no name, tab title "File") for Maya and for the owner, from a link or typed address; only a Trash row opens it. The chat's sent-file chip is built to say "File deleted" but needs the history to name the file (cause 3) |
| F10 | After a chat is deleted, the notice says how many files stay in Library (or went to Trash), and Undo brings the chat back. | **Partial.** Notice text verified (with F4's simulated fields): "Chat deleted. 1 file stays in Library." and, with the box ticked, "Chat deleted. 1 file in Trash." (the file is in Trash with 30 days). There is no Undo: the backend deletes the chat for good (cause 5) |
| F11 | While the file is in Trash, asking "What is our return window?" in a chat no longer cites it and answers "I couldn't find this in your files." | **Blocked.** Chats do not search Library or cite files at all (cause 6, A9, A13). With the file active the answer was the agent's own "I couldn't find the Quokka access code." and with it in Trash the same, so nothing leaked, but the wording is not the prototype's |
| F-d1 | The Weekly sales report routine says the file is unavailable and the next run skips it. | **Blocked.** Routines have no attached files (see B, Needed 1; `GET /automations/{id}` has no file field and the page has no Attached files section). `RoutineUnavailableNote` is built and waits |
| F-d2 | The citation in the Return window chat reads "File deleted", never the file name. | **Blocked.** No answer carries a Library citation (see A, Part 2 BE-4/BE-5). Chat A's answer "The return window is 30 days from delivery." has no chip. The sent-file chip rule (F9) is the closest thing and is built |

**Seen live (admin account "You", member account "Maya"):**

- Delete from the All files row menu → dialog (F1) → Move to Trash: the toast reads "<name> moved to Trash" with Restore; the dev backend takes several seconds, so the dialog shows its spinner meanwhile. Trash lists the file with "30 days", the size and "Today, <time>".
- While f1 was in Trash: `GET /library/files?tab=all&q=…` and the Add from Library picker (initial list and a search) leave it out; `GET /library/files/{id}` as the owner returns `life: "trashed", daysLeft: 30` with the shares intact; as Maya it is `404 file_gone` and her Shared tab dropped it. Restore brought back the same `access` entries and Maya's Shared row.
- `GET /chats/{chat}/messages` for a chat where f1 was sent still returns the attachment with a fresh signed `file_link`; fetching that link returned `200` and the file's text, with the file in Trash. The chat's chip kept the file name.
- `POST /chats/create` with `libraryFileIds: ["<id of a file in Trash>"]` as its owner returned `200` and created a chat (the aborted test chat was deleted again).
- Asking "What is the Zephyrine warranty code?" in a new chat with no attachment, with the file in Trash, was answered from the earlier chat's own text (the agent searches past chats), not from the file. A file that was never echoed in a chat (the Quokka code) was not found with the file active (control) or in Trash: "I couldn't find the Quokka access code." The chat page showed no citation either way.
- `GET /library/files/{id}` for files saved by a chat returns `provenance: {kind: "upload", label: "", via: "web", canOpenChat: false}`: no `chatId`. `file_attachments` in `GET /chats/{id}/messages` has `file_name, file_link, mime_type, file_size, origin` and no `document_id`.
- `DELETE /chats` removed chat E for good (`GET …/messages` is `404`); its two files stayed `active`. Deleting with the box ticked left the file `trashed` with `daysLeft: 30`.
- Maya's Trash (`/library/trash` and the page) stayed empty for both files the admin trashed, one of them shared with her.

**Why it is backend:**

1. **A chat keeps handing out a trashed file's contents.** `get_chat_messages` (`services/chat/repository.py` ~lines 135-147) returns each attachment's `s3_key`, and the schema (`services/chat/schemas.py` ~lines 56-63) turns it into a fresh signed link on every read with no check of `Document.trashed_at`. (F2, F9)
2. **An owner can attach a file that is in Trash.** `Library.attachable` (`services/library/library.py` ~lines 494-500) calls `open` (~lines 151-159), which lets the owner open their own trashed file; `chat/router.py` (~lines 170, 254) and `persona/router.py` (~lines 383, 452) pass the result straight to the turn. The picker hides it, the API does not. (F2, F11)
3. **History does not say which Library file an attachment is, and forgets it on Delete forever.** The `json_build_object` above has no `document_id` (A, Part 3 A10), and `remove_document` (`services/document/indexing.py` ~line 297) sets `MessageFileAttachment.document_id` to NULL, so even once A10 sends the id, a file deleted forever leaves an attachment with a name, a dead link and nothing saying "deleted". (F4, F9, F10)
4. **Saved files are not tied to their chat.** Uploads carry no origin chat (A, Part 3 A5): `Document.origin_chat_id` (`services/document/models.py` ~line 31) is never set for a chat upload and `provenance.chatId` is empty. Without it the dialog cannot tell "saved from this chat" from "only picked from Library", and offering to delete a file on a guess is not safe. (F4, F10)
5. **Deleting a chat cannot be undone.** `DELETE /chats` (`services/chat/router.py` ~lines 308-314) → `delete_chat` (`services/chat/service.py` ~lines 963-969) → `hard_delete_chat` (`services/chat/repository.py` ~line 543) removes the chat, its messages and attachment rows. `soft_delete_chat` (~line 523) exists, but no route uses it and nothing restores. (F10)
6. **Chats do not search the person's Library, so there is nothing to cite or to filter.** Retrieval is `search_knowledge` over a project's documents only (`services/document/knowledge.py` ~lines 37-60, which does drop trashed ones, but only for projects), and no event carries Library citations (A, Part 2; A13). (F11, F-d2)
7. **Routines have no attached files** (see B, cause 1), so the delete dialog's routines row is always empty and a run cannot skip a trashed file. (F1, F-d1)

**Needed:**

1. **No link for a trashed file** (fixes 1): when an attachment's document is in Trash (or gone), `GET /chats/{id}/messages` returns no `file_link` for it, and the file's contents are never served by a signed link minted after the delete. (F2, F9)
2. **`attachable` refuses a trashed file** (fixes 2): `404 file_gone` for anyone, the owner included, on every chat and persona send. (F2, F11)
3. **Say what each attachment is, and keep saying it** (fixes 3): add `document_id` to `file_attachments` (A10) and keep it after Delete forever (a `file_deleted_at` on the attachment row instead of NULLing the id), or return `libraryState: "open" | "deleted" | "locked"` resolved for the reader (a file in Trash reads `deleted`, as the prototype's chip does). The front end already reads `document_id`. (F4, F9, F10)
4. **Origin chat on upload** (fixes 4): A, Part 3 A5. Until then a chat's saved files can only be listed through `provenance.chatId`; an `originChatId` filter on `GET /library/files` (or `savedFiles: [{id, title, generated}]` on the chat) would let the Delete chat dialog read them in one call. (F4, F10)
5. **Soft-delete a chat and restore it** (fixes 5): `DELETE /chats` uses `soft_delete_chat`; a new `POST /chats/{id}/restore` brings back the messages, attachments and file links within the Undo window (the prototype keeps it for the session; 30 days like Trash is simplest); a later purge removes it for good. The delete response may carry `{savedFiles: n}` so the notice needs no extra read. (F10)
6. **When Library search and citations land** (fixes 6): leave out documents with `trashed_at` set, and resolve a citation of a trashed file to `state: "deleted"` (A, Part 2 BE-5); when nothing matches, the answer reads "I couldn't find this in your files." (A13). (F11, F-d2)
7. **Routine attached files with a state** (fixes 7): see B, Needed 1 (`state` covers trashed and deleted); the run reports skipped files (see C, Needed 6). (F1, F-d1)
8. **Trash for the person who deleted a file they do not own:** see E, Needed 5. Nothing more here.

**Front end already has (done 2026-10-19 unless noted):**

- Delete dialog, Trash screen (banner, "Frees up", columns, row menu), Delete forever and Empty Trash confirms with counts, Restore with shares, the "In Trash" banner on a file opened from Trash: built earlier, verified live (F1, F3, F5-F8).
- **F9:** `src/components/Library/FileScreen.tsx` shows "No longer available" for a trashed file unless it was opened from a Trash row (`?from=trash`, set in `TrashScreen.tsx`). So a chat chip, a citation or a shared address never shows the name, even to the owner; the tab title and "Opened …" toast no longer name it either.
- **F9, with cause 3:** `src/components/Library/chat/SentLibraryAttachment.tsx`, used by `src/components/chat/ChatMessage.tsx`: when an attachment carries `libraryFileId` (read from `document_id`), a deleted file reads "File deleted" (links to the "No longer available" page, never to its contents) and a locked one "Locked file". Verified by adding `document_id` to the history in the browser; inert until the backend sends it.
- **F4, F10, with causes 3-5:** `src/components/layout/AppDialogs.tsx` (`DeleteChatHost`) opens the prototype's dialog (`DeleteChatWithFilesDialog`: saved files, "Also delete these files" off by default, red Delete, a loading state) with the files read by `src/components/Library/chat/useChatSavedFiles.ts` (the chat's attachments that this chat created and the viewer may delete). While history cannot name them, it falls back to the old confirm and a plain "Chat deleted". With the box ticked it deletes the chat first, then moves the files to Trash, and never touches files if the chat is still there. Notices: "Chat deleted.", "Chat deleted. N file(s) stay(s) in Library.", "Chat deleted. N file(s) in Trash." No Undo until cause 5. Covered by `useChatSavedFiles.test.ts` (6 passing) and the existing `sources.test.ts` notice test.
- `RoutineUnavailableNote` ("…The next run skips it.") is built and unused, waiting on B, Needed 1.

**How to verify (after 1-7):**

1. Send a file in a chat, move it to Trash, reload the chat: the chip reads "File deleted"; `GET /chats/{id}/messages` has no `file_link` for it; Restore and the chip shows the name again. (F2, F9; Needed 1, 3)
2. `POST /chats/create` with `libraryFileIds` of a file in Trash returns `404 file_gone`, and the picker still does not list it. (F2; Needed 2)
3. Send a file in a new chat, delete the chat: "Delete <chat>? 1 saved file stays in Library." with the file and "Also delete these files" unticked. Delete → "Chat deleted. 1 file stays in Library." and the file is in All files. Repeat with the box ticked → "Chat deleted. 1 file in Trash." and Trash lists it with 30 days. A file only picked from Library in that chat is not listed. (F4, F10; Needed 3, 4)
4. Press Undo in the notice (also after "Chat deleted. 1 file in Trash."): the chat is back with its messages and sent-file chips; the file is back too if it had gone to Trash. (F10; Needed 5)
5. Delete forever a file that a chat used: the chat's chip reads "File deleted", not the name or a dead link. (F9; Needed 3)
6. In a new chat with nothing attached, ask a question only a file in Trash answers: no citation and "I couldn't find this in your files."; restore the file and ask again: the answer cites it. With a citation already in the Return window chat, trash the file: the chip reads "File deleted", never the name. (F11, F-d2; Needed 6)
7. Attach a file to a routine, move it to Trash: the routine page says it is unavailable and the next run skips it; after Run now the run reports "Skipped 1 file". (F1, F-d1; Needed 7)

---

## G. Admin sets the switches: Library settings, notice, Members, removal and Leave (Flow G, all checks)

Stand-ins: admin "You" = test01@email.com, member "Maya" = "OS8 Test01" (the app's own name). There is no Sam, so "Sam keeps access" and "goes to You and Sam" cannot be shown. **Payment terms** and **Return policy 2026** do not exist here; test files were **g2-return-note** ("Return window is 45 days", Maya's) and **g8-payment-terms** (Maya's), both sent in a chat as Maya.

**How it was tested.** `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` was off in `.env.local` (the settings pages 404 and the sidebar hides them); it was turned on for this flow and the dev server restarted. The backend has no `/library/prefs` or `/library/org-settings` (live: both `404 {"detail":"Not Found"}` for You and for Maya, 2026-10-19), so in the test browser **both endpoints were answered by a local stand-in that follows the contract in `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md` Part 1 §2** (versioned org settings, computed `effectiveAutoSave`/`forcedOff`/`aiReferenceAllowed`, `settingsChanges`, 403 for a member on org-settings). Everything else was the real app and real backend: `GET /library/storage`, chat send, Library lists, Members. Nothing was removed and nothing was transferred: Remove and Leave were opened and cancelled, and G6, G7, G-d1 and G-d2 were checked by reading code. **Switch values:** the real backend has no switches (404), so none changed there. The stand-in started at Auto-save default Always, Force auto-save off off, AI reference on; it was set to Ask each time, then Force on and AI reference off, and set back and confirmed (reload) at the end.

**Checks (prototype Flow G, "Admin sets the switches"; numbered in the order of `checks`):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| G1 | Admin page lists Auto-save default, Force auto-save off, AI reference, File size limit, File types and Storage with a bar and Files, Images, Audio rows. | **Partial.** Page passes against the stand-in: every row is there, Storage is the real figure (`52.6 MB used`, bar, Files 38.5 MB · 44 files, Images 12.9 MB · 15, Audio 1.2 MB · 2). It reads "of 20 GB" only when the API gives a limit (`limitBytes: null` today). Fixed: File size limit read "52 MB" for the backend's 50 MiB. With the real backend the card says "Couldn't load your files" (cause 1) |
| G2 | Force auto-save off on: Maya's "Save files from chats" shows Never, turned off, "Your Admin has turned auto-save off"; a file she sends stays in the chat and is not saved. | **Partial.** Settings row passes (Never, disabled, the line). Send passes in the front end (toast "Your Admin has turned auto-save off", `saveToLibrary=false` on `POST /api/chat`, no dialog). **Fails in the backend:** both g2-return-note and g8-payment-terms are in Maya's All files (`GET /library/files?tab=all&q=…`) (cause 2) |
| G3 | AI reference off: Maya's "Search my Library in chats" is off and turned off with "Your Admin turned this off"; chats show "Your Admin has turned off Library search. Attaching files still works."; browsing, search and Add from Library still work. | **Partial.** Switch off and disabled with the line (wording fixed to the prototype's). The chat note was missing and is built (new-chat page and open chat). Browse, All files (23 rows), search "return" and Add from Library all worked. The switch changes nothing server-side (cause 3) |
| G4 | As Maya the Admin pages are gone, and a short notice explains that defaults changed. | **Partial.** Admin pages: **pass** (no WORKSPACE group in her sidebar; `/settings/workspace-library` and `/settings/members` show "Only workspace admins can see this page"). Notice: it was missing from the Library page (the app showed a different one inside Settings) and is restored: "Your Admin changed Library settings" with up to three lines, Dismiss, gone after reload. Needs `settingsChanges` from the backend (cause 1) |
| G5 | Audit log and inventory appear as static pages marked "Phase 2". | **Pass** (front end only, behind the same flag). Were not built; now "Audit log" and "Inventory" are in the Admin's sidebar with a Phase 2 badge and each opens its page ("Who opened, shared or deleted each file." / "Storage by member and type."). Maya gets "Only workspace admins can see this page" |
| G6 | Removing a member makes the leaving person answer one mandatory question, "Transfer your shared files to other members?", and the removal cannot finish until they do. | **Blocked (backend).** Live: Members → Remove shows an inline "Cancel / Confirm remove" with no question; Cancel sent nothing. In code, Confirm sends `DELETE /organizations/{id}/members/{memberId}` and the backend removes the person at once (causes 4, 5) |
| G7 | On Yes, Maya's shared file goes to You and Sam keeps access; on No it is deleted; a file she never shared is deleted either way. | **Blocked (backend)**, by reading code: there is no Yes/No and no transfer. Offboarding never touches Library files (cause 5). Not run |
| G8 | Before Force auto-save off, Maya's setting shows the Auto-save default; with Ask each time, sending a file asks "Save 1 file to Library?". | **Partial.** Row shows "Ask each time" with "Using your workspace's default". Send asks "Save 1 file to Library?" with Save focused; Don't save gives "Not saved. It stays in this chat." and `saveToLibrary=false`. The file was saved anyway (cause 2; see A4) |
| G9 | With AI reference off, "What is our return window?" in a new chat answers "I couldn't find this in your files."; it answers normally once the file is added to the chat. | **Partial.** With g2-return-note added from Library: "Your return window is 45 days." (pass). With nothing added: the agent searched on its own and said "Which store or policy document should I check? I don't have your return policy in this chat." (cause 3, A13) |
| G-d1 | After Maya is removed she shows as Removed in Viewing as and cannot be selected, and no longer appears in Who has access on any file. | **Blocked (backend)**, by reading code. "Viewing as" is a prototype-only switch (no equivalent). Who has access would keep listing her (cause 5). Not run |
| G-d2 | As Maya, Settings → Library → Leave opens the same question and Cancel closes it. As You, Leave is dimmed with "Name another Admin first". | **Blocked (backend and product).** There is no Leave anywhere in the UI: Settings → Library has none, and the only Leave button (Settings → General) is switched off (`SHOW_DANGER_ZONE = false`, `general/_components/GeneralParts.tsx:16`). Opened nothing, so nothing to cancel. The backend has a leave route without the question (cause 6) |

**Seen live (admin account "You", member account Maya):**

- `GET /library/prefs` and `GET /library/org-settings` → `404` for both accounts. `GET /library/storage` → `200 {"usedBytes":52620839,"limitBytes":null,…}` (You) and `12403438` (Maya). `GET /organizations` → one workspace, `myRole: "admin"` / `"member"`.
- With the stand-in: Auto-save default → Ask each time (`PATCH org-settings {"defaultAutoSave":"ask"}`, `If-Match: 1`), then Force auto-save off on (the default select turns disabled) and AI reference off. Maya's Settings → Library then read "Save files from chats: Your Admin has turned auto-save off, Never (disabled)" and "Search my Library in chats: Your Admin turned this off (off, disabled)". Her Library page showed the notice with the three lines "Auto-save default is now Ask each time.", "Your Admin has turned auto-save off.", "Souvenir no longer searches Library in answers."
- Maya sent g8-payment-terms with Ask each time: dialog "Save 1 file to Library?", Save focused; Don't save → toast and `saveToLibrary` `false` in the multipart body. With Force on, g2-return-note: no dialog, toast "Your Admin has turned auto-save off", `saveToLibrary` `false`. `GET /library/files?tab=all&q=g8-payment` and `q=g2-return` as Maya both list the file (owner "OS8 Test01").
- Members as You: two rows (You, OS8 Test01), each with Remove. Remove on OS8 Test01 swaps the button for "Cancel" and "Confirm remove"; Cancel returned to "Remove". No `DELETE` request was sent.
- Maya, new chat, nothing attached, "What is our return window?": the activity showed "Searching for context / Running tool — return window returns refund policy", then "Which store or policy document should I check? I don't have your return policy in this chat." With g2-return-note added from Library, the same question: "Your return window is 45 days."
- The dev server restarted itself ("approaching the used memory threshold") during testing; a file attached right then stalled at "Uploading… 0%". It uploaded normally on a later try, so that is not a backend finding.

**Why it is backend:**

1. **No prefs or workspace-settings endpoints**, so nothing can be saved, read or enforced and no "what changed" lines exist. Fully specified in `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md` Part 1 §2 (including `settingsChanges`). (G1, G2, G3, G4, G8)
2. **Send ignores `saveToLibrary` and Admin force-off**: A4 and A14, same cause as Part 1 §3.1. (G2, G8)
3. **AI reference is not enforced and chats have no "couldn't find this in your files" answer**: Part 1 §3.2 and A13. Live, the agent searched anyway. (G3, G9)
4. **Removal is one step with no question.** `DELETE /organizations/{id}/members/{member_id}` (`services/organizations/router.py` ~lines 444-451) takes no body and calls `Organization.removeMember` (`organization.py` ~lines 314-338), which calls `offboardFromOrganization` (`offboarding.py` ~lines 61-78). Nothing is pending and nothing waits for the leaving person: the only checks are "billing admin" and "last admin". (G6)
5. **Offboarding ignores Library.** `clearPersonalAssets` (`offboarding.py` ~lines 46-58) removes the person's private chats and projects, project memberships and chat shares; `repository.remove_member` (`organizations/repository.py` ~lines 310-326) removes the member row and unshares connectors. Nothing reads `Document.user_id` (`services/document/models.py` ~line 19), so the person's files stay owned by someone who is gone; there is no transfer, no delete of never-shared files, and the `DocumentShare` rows to or from them (`models.py` ~lines 58-70) stay, so `accessList` (`services/library/library.py` ~lines 502-511) keeps listing them under Who has access. (G6, G7, G-d1)
6. **Leave has no question either.** `POST /organizations/{id}/leave` (`router.py` ~lines 454-462) takes only `successorAdminUserId` (`schemas.py` ~lines 131-137) and runs the same offboarding (`organization.py` ~lines 340-367). (G-d2)

**Needed:**

1. **A pending removal** (fixes 4): an Admin's Remove records `{memberId, requestedBy, requestedAt}` and does not remove yet. `GET /organizations/{id}/members` returns `removal: {by, at} | null` so the row can read "Waiting for their answer". Let the Admin cancel it. (G6)
2. **The leaving person's question** (fixes 4): `GET /library/my-removal` → `{pending, by: Person}` for the signed-in person (the app opens a locked dialog "<Admin> is removing you" on the next load), and `POST /library/my-removal/answer {transfer: boolean}`, the only way to finish the removal. Product decision: what if they never sign in again (time limit, or Admin can force)? (G6)
3. **Hand-off rules on both removal and leave** (fixes 5, 6), as in the prototype's `remove-member` (`lib/reducer.ts` ~lines 1012-1055): **Yes** → files shared with the whole workspace, and files shared with the removing Admin, go to that Admin; any other shared file goes to the first person it was shared with (earliest grant), who keeps access; **No** → those files are deleted; files never shared are deleted either way (the same path as Delete forever, `services/document/indexing.py` `remove_document` ~line 297). Routine run outputs of routines the Admin takes over go to the Admin. Do it in one transaction with the member removal. (G7)
4. **The person disappears from Library** (fixes 5): drop their `DocumentShare` grants and `DocumentView` rows, so they are gone from Who has access on every file (the share picker already reads the workspace's member list, so it drops them on its own). (G-d1)
5. **Leave carries the answer** (fixes 6): `POST /organizations/{id}/leave` accepts `transferSharedFiles: boolean`, required when the person owns a Library file. The last Admin still has to name a successor first (already enforced), so Leave is dimmed with "Name another Admin first". (G-d2)
6. Everything in A, Part 1 and A4, A13, A14 (G1-G4, G8, G9). Nothing new here.

**What the front end already has:** Admin page, personal page, `settingsChangeLines`/`unseenChanges` and the Dismiss rule (`src/lib/library/settings-notice.ts`), all behind `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` (Part 1 §5). **Done 2026-10-19:** the "Your Admin changed Library settings" notice is back on the Library page (`LibraryHeader.tsx`, `SettingsChangedNotice`; the different notice inside Settings → Library was removed); the composer note "Your Admin has turned off Library search. Attaching files still works." (`src/components/Library/chat/LibrarySearchOffNote.tsx` + test, on the new-chat page and in an open chat); "Your Admin turned this off" wording; File size limit counts in MiB like its saved toast; **Audit log** and **Inventory** static Phase 2 pages and sidebar entries (`PhaseTwoPage.tsx`, `(org)/audit-log`, `(org)/inventory`). **Not built, waiting on Needed 1-5:** the leaving person's question, "Waiting for their answer" on Members, Leave in Settings → Library. A version of the question dialog (`MyRemovalPrompt.tsx`), `lib/library/members.ts` and the Members rows existed against the old sample data and were removed by `579f2b94` (see `git show 579f2b94^:src/components/Library/settings/MyRemovalPrompt.tsx`); rebuild from them once the endpoints exist. Today Members uses the app's own inline "Cancel / Confirm remove", which stays until Needed 1 exists, and Leave stays hidden until its answer can be sent.

**How to verify (after 1-5, with the flag on):**

1. As You, set Auto-save default to Ask each time, Force auto-save off on and AI reference off; reload and confirm the three values. (G1)
2. As Maya, Settings → Library: "Never, turned off" with "Your Admin has turned auto-save off" and "Search my Library in chats" off and turned off with "Your Admin turned this off". Send a file in a chat: toast "Your Admin has turned auto-save off", and the file is not in `GET /library/files?tab=all`. (G2)
3. As Maya, open a chat: the note "Your Admin has turned off Library search. Attaching files still works." Browse, search and Add from Library work. In a new chat "What is our return window?" answers "I couldn't find this in your files."; add the file from Library and ask again: it answers normally. (G3, G9)
4. As Maya, Library shows "Your Admin changed Library settings" with the changed lines; Dismiss and reload: gone. The Workspace group and its pages are not reachable. (G4)
5. As You, the sidebar lists Audit log and Inventory with Phase 2, each a static page. (G5)
6. Before Force is on, Auto-save default Ask each time: Maya's setting reads "Using your workspace's default" and a send asks "Save 1 file to Library?". (G8)
7. As You, Members → Remove Maya → confirm: Maya's row reads "Waiting for their answer" and she is still a member. As Maya, a locked dialog asks "Transfer your shared files to other members?"; Confirm stays off until she picks. (G6)
8. Choose Yes: a file she shared with You goes to You, a file shared only with one other person goes to them with their access kept, a file she never shared is deleted; she is no longer a member, and she is in no file's Who has access. Repeat with No on another account: all of those are deleted. (G7, G-d1)
9. As Maya (before removal) Settings → Library → Leave shows the same question, Cancel closes it. As the only Admin, Leave is dimmed with "Name another Admin first". (G-d2)

---

## H. Browse and find in Library: Shared, Source: Shared, search, Suggested (Flow H, all checks)

Stand-ins for the prototype data: the real accounts hold their own files (admin "You": 61 files, 18 Generated; Maya: 31 files), so counts were compared against `GET /library/files` for each filter instead of the prototype's 15/4/11/8. Test files sent through the Library upload endpoint: **h1-terms-net30** (text "net 30", shared with the workspace), **h2-nova-notes** (shared with Maya), **h3-price-list** twice with different text a minute apart, **h4-trash-test**, and Maya's **h5-maya-brief** (shared with You) plus her generated lighthouse image shared with You. Maya takes Sam's place everywhere; **no third person exists**, so the "+2" avatar, "As Sam" and two-person Access rows with three people were not tested live. The prototype's numbering has 25 checks: the narrow-window one is H25, not H24.

**Checks (prototype Flow H, "Browse and find in Library"):**

| # | Check | Live result (2026-10-19) |
|---|---|---|
| H1 | Header: Library / Search, "N used" on every tab and state but Trash, Filter and Sort then search then Trash, no Upload | **Pass.** Placeholder now reads "Search Library" as in the prototype |
| H2 | Suggested and All files always; Shared once something is shared with you, with an unread dot; no Archived | **Partial.** Tabs and dot are right for You and Maya. The tab also appeared for a person who had only shared files out (cause 1); the front end now asks for files shared with the person. Sam not tested |
| H3 | Recent: five cards, most recent first, "Opened / Modified / Shared + short time", unread dot right after the title | **Partial.** Five cards and wording right. The dot sat in the card's corner; now after the title (front end). Order can disagree with the line shown (cause 5) |
| H4 | Frequently used: up to three, "Opened N times", never repeats Recent. Generated: up to three run outputs "Run of <date>", only for You | **Partial.** Frequently used right. Generated shows chat-made files too (Maya sees three images) and no "Run of" line (cause 4) |
| H5 | See all on Recent opens All files with nothing ticked; on Generated, Source: Generated; Frequently used has none | **Pass.** `?tab=all` with no chips; `?tab=all&source=generated` with a "Generated" chip; removing it brings back all 61 |
| H6 | A card or tile opens its file and Close returns to Suggested; the … opens the menu without opening; cut-off names show on hover | **Pass.** Enter also opens; names carry a `title` |
| H7 | All files columns and Access avatars with tooltips; Created newest first | **Pass.** Owner first ("Owner: OS8 Test01. Shared with You"), building avatar and "…the whole workspace", "Only you". "+2" not testable (no third person) |
| H8 | Generated sparkle after the name with a where-from tooltip; unread dot follows it | **Partial.** Sparkle then dot, in All files and search. Hover and Tab never showed the tooltip (the row's stretched link covered it): fixed in the front end. Wording for a routine's file needs the routine origin (cause 4) |
| H9 | Only Name and Created sort; arrows always; direction on the sorted one | **Pass.** `aria-sort` and arrows follow each click; Access, Source, Type are plain labels |
| H10 | Sort button lists the same choices, current one ticked; Shared ticks nothing at first | **Pass after a fix.** The current choice was tinted but had no tick; now ticked. Shared shows no tick |
| H11 | Filter panel: Source and File type, icon and tick on each option; nothing ticked = all | **Pass after a fix.** Ticks added |
| H12 | Counts per filter match the data | **Partial.** UI equals API in every case (You: 61, Generated 18, Uploaded 43, Audio 2, Images 16, Documents 33, PDFs 7, Spreadsheets 3; Maya: 31, 9, 22, 10 images, 18 documents, 2 sheets, 0 audio). But Source: Shared means "shared with me" only, not "a file you shared or one shared with you" as in the prototype (cause 2) |
| H13 | Two options in one section widen; one in each narrows | **Pass.** Uploaded + Generated = 61 (all); Generated + Documents = 3 |
| H14 | A chip per section, "3 picked", two at most, X clears a section, Reset clears all | **Pass** |
| H15 | "No files match" with Reset filters; Reset brings the table back | **Pass.** Maya: Generated + Documents has no match; Reset filters returned her list |
| H16 | … menu: Open, Ask about this, Share, Download, Rename, Delete | **Pass.** Download really downloads (prototype only shows a message); Ask about this opened a new chat with the file attached; Library in the sidebar came back |
| H17 | A non-owner sees Share, Rename, Delete off with "Only the owner can change this" | **Pass** (Maya on h2-nova-notes, owned by You; also on Suggested cards) |
| H18 | Search turns the page into Search; snippets; finds words inside files; "net 30" finds the contract and the recording; Trash never appears | **Partial.** Page, snippets, "zzz" state and Trash exclusion right; words inside text, PDF and sheet files are found. "net 30" returns 15 files because any one word matches (cause 3), and the recording is never found (cause 4b) |
| H19 | On Shared, "In Shared" leaves out files you own; "All of Library"; both lists match from Suggested and All files | **Fail (backend).** "In Shared" returned e3-supplier-contract-nova and h2-nova-notes, files You own (cause 1). "All of Library" and "No files match / Try other words / Clear search" are right |
| H20 | Shared columns Name, Access, Date shared, Type; unread first, then newest | **Partial.** Columns, spacing and unread-first right; the list also holds files You own and shared out (cause 1) |
| H21 | Trash: "Library > Trash", no tabs, Filter, Sort or search; banner with "Frees up"; columns; Restore and Delete forever; Library in the title goes back | **Pass.** "Frees up 342 B" = the five rows; Restore worked; a trashed file never showed in search |
| H22 | Loading, Empty and Error on every list and on search | **Pass.** Done with `page.route` on each call (see "Seen live"); Try again recovers on all five |
| H23 | No upload, no drop area; Sample files turned off outside a chat | **Pass.** No upload control or file input on any Library page; a dropped file is ignored and makes no `/uploads` request. "Sample files" is a prototype-only tool bar item: it was never in the front end (checked `git log -S`), so nothing to compare |
| H24 | Escape and click outside close the menus; every card, tile, row name and button reachable by Tab; Enter opens | **Pass.** Filter closes by Esc and by click, returns focus to its button; Sort and row menus close both ways |
| H25 | Narrower window: Source hides first, then Access (Shared hides Type); the tool row wraps | **Fail, fixed.** The tools wrapped correctly, but at 800 px and below (the sidebar stays open) the Name column shrank to nothing and the date drew over the Name heading. Now Type, then the date, give way and Name stays |
| H-d1 | Filter ticks carry between All files and Shared; ignored while searching; apply again after | **Pass** |
| H-d2 | Date shared falls back to Created; Name carries over | **Pass** (`sort=shared&dir=asc` → All files shows Created, newest first; `sort=name` kept) |
| H-d3 | Two files with the same name show as two rows with different Created times, in All files, search and Add from Library | **Pass.** h3-price-list at 2:15 AM and 2:16 AM in all three |
| H-d4 | Opening a file from Shared or a search result and closing returns there | **Pass** (`?tab=shared`, and `?tab=all&q=nova` with the box still reading "nova") |

**Seen live (admin account "You", member account "Maya"):**

- `GET /library/files?tab=shared` as You returned 8 rows: 4 files You own and shared out (h1, h2, e1, f1…) and files shared with You (h5, Maya's lighthouse image). As Maya the same: her own h5-maya-brief is in her Shared. With only "shared with me" in mind, `?tab=all&source=shared` returned 2 for You and 3 for Maya.
- Search "net 30" as You: 15 rows, including `a2-states-…` ("…is 30 days"), Catalog export ("Item 30") and Return policy 2026, and no audio. "nova": 4 rows, all with Nova in the text or name.
- Suggested for Maya: Recent 5, Frequently used 6 (the front end shows 3), Generated 3: lighthouse and two "cat" images made in her chats. `lastActivityKind` is `"shared"` for files shared with her.
- `GET /library/files/suggested` Recent for You lists a file "Opened today" below files "Created today", ordered by a use the row does not show.
- Audio: `GET /library/files/{id}/preview` for the two recordings returns only `{kind: "audio", url}`.
- Loading, Empty, Error with the call held 9 s, answered `{items: []}` and answered `500`: Suggested, All files, Shared, Trash and a search all showed skeletons, "No files yet / Attach a file in a chat / New chat" (Shared: "Nothing shared with you yet", Trash: "Trash is empty", search: "No files match"), and "Couldn't load your files / Try again" (search: "Search is unavailable right now"). Try again reloaded each one.

**Why it's backend:**

1. **The Shared tab lists files you own and shared out.** `services/library/library.py` ~lines 312-314: `tab == "shared"` is `or_(and_(~owned, sharedWithMe), and_(owned, anyShare))`. The prototype's Shared is only what others shared with you, and "In Shared" search leaves out files you own. (H2, H19, H20, H-d4)
2. **Source: Shared has the opposite meaning.** `library.py` ~lines 317-321 maps `source=shared` to `and_(~owned, sharedWithMe)` (only shared with me). In the prototype (`lib/access.ts` `isShared`) it is a file others can open: one you shared or one shared with you. The two meanings are swapped between the tab and the filter. (H12, H13)
3. **Search matches any one word.** `library.py` ~lines 324-327 uses `anyWord(q)` (`services/document/indexing.py` ~lines 303-306, `&` replaced by `|`), written for chat retrieval, so "net 30" matches every file that has "net" or "30". Results come in the chosen sort order, not best match first. (H18, H19)
4. **Generated rows know nothing about routines, and the Generated row is not only run outputs.** `generatedFrom` is always `kind: "chat"` (`library.py` ~line 264, see B cause 4 and C cause 4), so tiles cannot read "Run of <date>" and the sparkle cannot say "Generated by the … routine". `suggested()` (`library.py` ~lines 371-374) fills Generated from every `source == "generated"` file, chat outputs included; the prototype row is routine run outputs only. (H4, H8) **4b.** Audio is never indexed for search: nothing transcribes it in Library (`services/library/preview.py` returns no lines, see Flow A, A11), so a recording cannot match "net 30". (H18)
5. **Recent is ordered by a time the card does not show.** `suggested()` (`library.py` ~lines 363-369) ranks by `greatest(last_activity_at, opened_at, usedAt)` where `usedAt` is the latest chat or routine use, while `row()` (~lines 234-236) reports only `last_activity_at` or the open time. A file used in a chat today can sit first under "Created 3d ago". Frequently used ranks by opens plus uses but its line says "Opened N times" (opens only). (H3, H4)

**Needed:**

1. `tab=shared` returns only files shared with the caller (drop the `owned & anyShare` branch). The same change makes `unreadFirst` and the Shared dot mean what the prototype says. (fixes 1: H2, H19, H20)
2. `source=shared` returns files the caller shared or that were shared with them: `or_(and_(~owned, sharedWithMe), and_(owned, anyShare))` (fixes 2: H12, H13). Needed 1 and 2 are one move of that clause from the tab to the filter.
3. Library search ANDs the words (or tries the phrase first, then falls back), ranks phrase matches first, and keeps `anyWord` for chat retrieval only (fixes 3: H18). "net 30" should list Supplier contract - Acme and the recording, not every file with a 30.
4. Send the routine origin (B, Needed 4; C, Needed 3) and decide whether Suggested's Generated row is only routine outputs (prototype) or every generated file; the front end shows whatever the list sends. (fixes 4: H4, H8)
5. Index recordings' transcripts so search finds them (with Flow A, A11). (fixes 4b: H18)
6. Return the time and kind the order used: `lastActivityAt`/`lastActivityKind` = the latest of change, open and use (kind `opened` for a use), and `openCount` plus a `useCount`, or rank Frequently used by opens only. (fixes 5: H3, H4)

**Front end already has (done 2026-10-19):**

- `src/lib/library/queries.ts` (`useHasShared`): the Shared tab and its unread dot read `tab=all&source=shared`, so they appear only when something is shared with the person (H2). The list itself still waits on Needed 1.
- `src/components/Library/SuggestedView.tsx`: the unread dot sits right after a Recent card's title (H3).
- `src/components/Library/SortMenu.tsx`, `FilterPanel.tsx`: the chosen option carries a tick (H10, H11).
- `src/components/Library/FileMarks.tsx`: the sparkle and the unread dot sit above a row's stretched link, so hover shows "Generated in …" and "Unread"; the sparkle takes Tab focus (H8).
- `src/components/Library/FileTable/FileTable.module.css`, `FileTable.tsx`, `FormatGlyph.tsx`: below ~480 px of list width Type (and Shared's Access) hide, then the date at ~300 px, the list takes a 16 px side margin under 900 px, and the file icon no longer shrinks, so Name always stays (H25). Rows of a file still being prepared carry a "Processing" badge (a status in a word, not colour only).
- `LibrarySearch.tsx`: placeholder and label "Search Library" (H1).
- Unchanged and verified: filters, chips, Reset, sort headings, search state, Trash screen and the Loading / Empty / Error states (H5-H7, H9, H12-H17, H21-H24, H-d1 to H-d4).

**How to verify (after 1-6):**

1. As a person who only shared files out, open Library: no Shared tab. Have someone share a file with them: the tab appears with a dot until they open it. (H2; Needed 1)
2. On Shared, search a word that is in a file You own and shared out and in one shared with You: "In Shared" lists only the second; "All of Library" lists both. (H19; Needed 1)
3. All files, Source: Shared lists files You shared and files shared with You (check against the Shared counts); with Shared and Uploaded ticked the list is the union. (H12, H13; Needed 2)
4. Search "net 30": Supplier contract - Acme and the Supplier call - Acme recording come first, and a file that only has "30 days" does not appear. (H18; Needed 3, 5)
5. Run a routine: Suggested's Generated tile reads "Run of <date>", and the sparkle in All files says "Generated by the <routine> routine". (H4, H8; Needed 4)
6. Use a file in a chat today and open it from nowhere: its Recent card reads "Opened today" (or the kind the order used) and ranks by that time. (H3; Needed 6)

---

## X. Checks that apply to every flow ("All flows 1 to 13")

Run live 2026-10-19 as the admin ("You") and Maya (member). Only one result needs the backend; the rest are front end and are done.

| # | Check | Live result |
|---|---|---|
| X1 | Only File, Trash, Upload, Output; never Item, Shelf, Folder, Collection | **Pass.** No banned word on Suggested, All files, Shared, Trash, File page, Filter, row menu, Share / Rename / Move to Trash / Empty Trash dialogs. The only "Item" on screen is a chat title in the sidebar. An unused string "Items moved to Trash…" (`messages.ts`) was removed |
| X2 | Owners manage, Viewers open but not change, no access sees the locked page; only the Admin sees Admin pages | **Pass.** Maya on a file shared with her: "You: Viewer", Share, Rename, Delete and Manage access disabled, row menu has Share, Rename, Delete disabled. Locked page seen (Flow D). `/settings/workspace-library` as Maya: "Only workspace admins can see this page", and no Workspace section in her settings sidebar |
| X3 | Every state in the file state switch has a designed look | **Partial (backend for Uploading).** Ready, In Trash (opened from Trash: "In Trash / 30 days left / Restore"), Locked and Processing ("Preparing Library previews and search…", plus the failed line) all have a look. A deleted file opened by link reads "No longer available" on purpose. **Uploading cannot be shown:** Library never returns a file that is still uploading (`FileDetail.phase` is always `"ready"`, no staged rows, see `2026-10-19/LIBRARY_FLOW_A_BACKEND_TICKET.md` A2, A3). The Uploading banner exists in `FileStates.tsx` but nothing can feed it |
| X4 | Lists have loading, empty and error states | **Pass.** With the API held, emptied and failed: skeletons, "No files yet / Attach a file in a chat / New chat", "Trash is empty", "Couldn't load your files. / Try again" on Suggested, All files and Trash; Shared hides itself when empty |
| X5 | Status shows a word or icon, not only colour | **Pass.** The unread dot is labelled "Unread", the sparkle "Generated in …", Access avatars "Owner: …. Shared with …", Trash shows "N days left", File page says "In Trash" |
| X6 | Tabs Suggested, All files, Shared (Shared only once something is shared); Trash button at the right of the header; run outputs are ordinary files in All files | **Pass.** Shared hidden when the shared list is empty and shown otherwise; Trash button at the right edge of the header; run outputs are rows with Source Generated |
| X7 | Search clears on leaving Library, stays when a result is opened and closed; the state switch resets | **Pass** for search (`?q=return` survives open and Close; gone after Chat and back). **No state switch exists in the real app**, so the second sentence does not apply |
| X8 | Recent cards "Opened/Modified/Created/Shared" + short time; unread "Shared 1d ago" with the dot after the title; Frequently used "Opened 6 times" | **Pass.** Cards read "Opened today", "Modified today", "Created today", "Shared today" with the dot right after the title; "Opened 12 times". Older ages use the same `agoShort` as the prototype ("2d ago", "1w ago"), covered by unit tests; all test files are from today |
| X9 | Generated file: mint sparkle after the name; Access column; unread dot beside the name | **Pass** (sparkle then dot, in All files and Shared) |
| X10 | Filter and Sort icon buttons; only Name and Created sort with arrows always shown; Filter has Source and File type; chips two at most; Reset clears | **Pass.** Sort menu: Name, Created, Newest first, Oldest first. Three ticks give two chips ("Uploaded, Generated", "PDFs"); Reset clears them |
| X11 | "N used" beside the Library title on every tab | **Pass** on Suggested, All files and Shared (Trash is a screen with no storage figure) |
| X12 | File icons have no box; switches show no On or Off word | **Fixed.** Icons sat in tinted rounded boxes in lists, tiles and the file page; the box is gone (`FormatGlyph.tsx`), the tint stays on the icon. No On/Off word on any switch (checked in code; the Sources panel and settings use the shared `Switch`) |
| X13 | No Upload button and no drop area in Library | **Pass.** No upload control or file input on any Library screen; dropping a file on All files shows nothing |

**Backend needed:** only for X3. A file that is still uploading or being checked must be listed (or returned by `GET /library/files/{id}`) with `phase: "uploading" | "processing"`, owner-only, so the File page can show its Uploading and Processing banner. This is the same staged state as Flow A, A3; no new work beyond it.

**Front end done:** `FormatGlyph.tsx` (no icon box); `messages.ts` (unused "Items" string removed). Seen again in Flow D: the locked citation panel and Request access flag.

**How to verify:** open All files, Suggested and a File page and check the icons have no tinted square. Upload a large file in a chat and open it in Library while it uploads: it shows an Uploading banner with progress, then Processing, then ready (X3).
