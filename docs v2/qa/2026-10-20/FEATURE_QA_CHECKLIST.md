# Souvenir front end: feature QA checklist and bug log

Scan run on 2026-10-19 → 2026-10-20 against `front-end` on `localhost:3000`, backend `devapi.getsouvenir.com`.
Accounts: `ADMIN_EMAIL` (test 01, workspace admin) and `MEMBER_EMAIL` (OS8 Test01, member), both in `test01-workspace`.

How to use this document:

- Each feature has three parts: **How it was tested**, a **checklist** (what passed, written as a manual step and its expected result) and a **bug table**.
- To retest by hand, walk the checklist top to bottom, tick each line, and then re-check every bug in the table.
- Bug IDs are stable (`SH-3`, `PR-1` …) so they can be referenced in tickets.
- Severity: **High** = data loss, security/permission hole or a core flow broken. **Medium** = a feature misbehaves, with a workaround. **Low** = polish, copy, consistency. **A11y** = accessibility.
- "Side": **FE** = fix in front end, **BE** = needs backend, **FE/BE** = unclear or both.

Out of scope (hidden behind flags that are off, or dead code), so not tested: Pins, Highlights, Settings preview pages (Preferences, Notifications, Security, Files), Library settings / Audit log / Inventory / Workspace library, Library request access, notification bell, `/dev/*`, `/browser-verify`, `/reasoning-verify`, `/compare` (unlinked model-comparison page).

---

## Contents

1. [Summary](#summary)
2. [Environment notes](#environment-notes)
3. [App shell, sidebar and global search](#1-app-shell-sidebar-and-global-search)
4. [Chat](#2-chat)
5. [Projects](#3-projects)
6. [Agents and Super Links](#4-agents-and-super-links)
7. [Schedules](#5-schedules)
8. [Library](#6-library)
9. [Connectors](#7-connectors)
10. [Souvenir in Slack](#8-souvenir-in-slack)
11. [Settings](#9-settings)
12. [Member role and permissions](#10-member-role-and-permissions)
13. [Links, invites, error and redirect pages](#11-links-invites-error-and-redirect-pages)
14. [Cross-cutting accessibility](#12-cross-cutting-accessibility)

---

## Summary

| Feature | Checks passed | Bugs (High / Med / Low / A11y) |
|---|---|---|
| App shell, sidebar, search | 30 | 0 / 2 / 3 / 2 |
| Chat | 30 | 0 / 3 / 2 / 0 |
| Projects | 28 | 3 / 2 / 2 / 2 |
| Agents and Super Links | 34 | 1 / 4 / 3 / 0 |
| Schedules | 30 | 0 / 3 / 5 / 4 |
| Library | 34 | 1 / 2 / 3 / 2 |
| Connectors | 14 | 0 / 0 / 3 / 1 |
| Souvenir in Slack | 6 | 0 / 0 / 0 / 0 |
| Settings | 40 | 1 / 4 / 3 / 1 |
| Member role | 9 | 1 / 1 / 1 / 0 |
| Links, invites, errors | 12 | 0 / 3 / 2 / 0 |

**Fix these first:**

1. **RL-1**: a member can turn workspace AI models off on `/settings/ai`.
2. **ST-1**: the only admin can remove themselves from the workspace.
3. **AG-1**: a Super Link opened by someone without an account goes to the login page.
4. **PR-1 / PR-2**: project files and project instructions don't reach the AI in project chats.
5. **PR-3**: deleting a *personal* project is permanent with no warning, while workspace projects go to Trash.
6. **LB-1**: an uploaded file can sit in "processing" for 40+ minutes. Until it finishes it isn't listed, can't be searched and has no preview.
7. **MS-1**: the Terms, Privacy and Cookie links all return 404.

---

## Environment notes

These caused noise during the scan. Rule them out before filing anything as a bug.

- The dev backend sometimes stops responding for about 10 s (`upstream_unreachable`, 502 on `/chats/*/messages`, `/persona`, `/automations`). Retry before filing.
- `next dev` restarts itself when it nears its memory limit ("approaching the used memory threshold"). That cuts off open streams ("Connection dropped mid-stream", "This model is unresponsive right now") and reloads pages mid-flow. It happened about 8 times. A production build ran for part of the scan, then a second `next dev` on :3000 (started outside this session) took over.
- `GET /api/backend/connectors/slack` returns **404 on every page** when Slack isn't connected, so the console shows a red error on every load. That's harmless but noisy. Return 200 with `{connected:false}`, or stop logging it. (FE/BE, Low)
- `ChunkLoadError … ERR_CONTENT_LENGTH_MISMATCH` on a first dev compile is dev-only.
- During the scan the original **QA Test Project** (personal) and **QA Test Agent** were deleted by test scripts. All other test items were named `QA-SCAN …` and were cleaned up. One pinned chat's title now ends in "Exp QA" (originally "…Exp").

---

## 1. App shell, sidebar and global search

**How it was tested:** Playwright as admin on `/chat`. Clicked every sidebar row and header icon, opened each section and menu, reloaded to check persistence, drove global search with the mouse and the keyboard (Ctrl+K, arrows, Enter, Esc), used the chat-row "…" menu (renamed and restored a chat), and checked keyboard focus with Tab.

### Checklist

- [ ] Sidebar rows **New, Agents, Schedules, Library, Connectors, Souvenir in Slack** each open their page (`/chat`, `/agents`, `/schedules`, `/library`, `/connectors`, `/souvenir-slack`).
- [ ] **Collapse sidebar** shrinks it to an icon rail (about 48 px). Each icon shows a tooltip. **Expand sidebar** brings back the full 294 px.
- [ ] Collapsed state survives a page reload.
- [ ] **Projects / Pinned / Recent Chats** chevrons collapse and expand their section, and the state survives a reload.
- [ ] Projects header: **New Project** opens `/projects/new`, **All Projects** opens `/projects`, and hovering a project shows **New chat in …** and **Open …**.
- [ ] Recent Chats header: **New chat** opens `/chat`, **All chats** opens `/chats`.
- [ ] With no projects, the Projects section shows "No projects yet".
- [ ] The **Search** icon opens global search with a RECENT list and the hint row "↑ ↓ navigate · ↵ open · Esc close".
- [ ] Typing ("Quick") shows tabs **All / Chats / Agent Chats / Projects / Agents / Pins / Pages**, a result count ("13 results") and "+N more".
- [ ] A nonsense query shows `No results for "…"` and "Try a different word or check your spelling".
- [ ] ArrowDown then Enter opens the highlighted chat and closes search.
- [ ] **Ctrl+K** opens search and **Esc** closes it.
- [ ] Chat row "…" menu shows **Share · Rename · Pin/Unpin · Move to project · Archive · Don't save files from this chat · Delete**.
- [ ] **Rename**: the inline input is prefilled. Enter saves and the new name survives a reload. Esc cancels with the toast "Rename cancelled".
- [ ] Renaming to blank keeps the old title.
- [ ] **Share** opens "Share chat" with tabs **Share / Active shares**, the member list and Cancel / Share. Esc and a backdrop click both close it.
- [ ] **Move to project** opens "Moving 1 chat" with an explanation, the project list, and Cancel / Move to project.
- [ ] **Delete** opens `Delete "<title>"?` with Cancel / Delete. Cancel keeps the chat.
- [ ] Clicking the profile row opens **Usage · Upgrade Plan · Settings (Ctrl ,) · Workspace settings · Help & Legal · Report a bug · Log out**.
- [ ] **Upgrade Plan** opens `/settings/plans-and-billing`, **Settings** opens `/settings/account`, **Workspace settings** opens `/settings/general`, and **Help & Legal** opens `/settings/help`.
- [ ] **Report a bug** opens a modal with Work email (prefilled), Full name (prefilled), What went wrong, Severity Low/Medium/High, and Submit bug.
- [ ] The chat page shows the right-hand **Context** and **Agents** icons.
- [ ] Every sidebar row, header icon and the profile row can be reached with Tab and shows a focus ring.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| SH-1 | Med | FE | Profile menu **Usage** doesn't navigate | Profile row → Usage | Opens `/settings/usage` | Stays on `/chat` (handler wired at `LeftSidebar.tsx:2653` but has no effect) |
| SH-2 | Med | FE | **Ctrl+,** shortcut is shown but does nothing | Press Ctrl+, anywhere | Opens Settings | Nothing. No key handler exists in `src/` |
| SH-3 | Low | FE | Flag-hidden settings URLs show the crash screen instead of a 404 | Open `/settings/preferences` (also notifications, security, files, library, audit-log, inventory, workspace-library) | Branded "not found" page | "Something went wrong · This page ran into an unexpected error · Reload page", plus console "Encountered a script tag while rendering React component" |
| SH-4 | Low | FE | Blank rename gives no feedback | Rename a chat to spaces → Enter | Inline error, or the field keeps focus | Silently keeps the old name |
| SH-5 | Low | FE | Share chat member row is a `<button>` containing the Checkbox `<button>` | Open Share chat, check the console | Valid markup | "In HTML, <button> cannot be a descendant of <button>" hydration error (`ChatShareOverlay.tsx:210`) |
| SH-6 | A11y | FE | Selected nav row has no `aria-current` | Inspect the active row | `aria-current="page"` | Only `data-sidebar-selected` (`FlatSidebarRow`) |
| SH-7 | A11y | FE | "Souvenir in Slack" row is a button with an "Add" button inside | Inspect the Slack row | One control, or siblings | Nested interactive elements |

---

## 2. Chat

**How it was tested:** Playwright as admin on `/chat`. Exercised the empty and typed composer states, every Add-menu item and submenu, a real `.txt` upload and removal, the model menu and thinking-effort slider (keyboard), the project and app pickers, both side panels and @mentions. Sent real messages to the dev backend, then tested stop, queueing, copy/edit/regenerate, reload restore and the header Share.

### Checklist

- [ ] Empty composer shows only the mic button. Typing swaps it for **Send message**.
- [ ] Shift+Enter adds a new line. Enter sends.
- [ ] Spaces-only + Enter doesn't send.
- [ ] **Add attachment** menu shows **Add files or photos · Add from Library · Web search (switch) · Use style ▸ · Add agent ▸**.
- [ ] **Add from Library** opens a picker with filters (All, Images, Documents, Spreadsheets, PDFs, Audio, Run outputs) and "Nothing is attached until you confirm". Esc closes it.
- [ ] **Add files or photos**: a .txt shows as a chip ("1 file attached", type, size). **Remove <file>** removes it.
- [ ] Upload progress shows "Uploading… N%" then "Processing…" (see LB-2 for the send block).
- [ ] Model button (**Advanced**) opens **Auto Routing** (Souvenir Pro / Standard), **Models** (Select a Model) and **Thinking** with an effort slider.
- [ ] The effort slider moves with the arrow keys (Off → Low → Medium → High).
- [ ] **Work in a project** opens "Add this chat to a project" with No project, the editable projects (or "No editable projects yet") and Create project.
- [ ] **Connect an app** opens a search box, the popular apps (Gmail, Outlook, Google Calendar, Notion, Drive), **View all** (→ `/connectors`) and **Connect your own API** (→ `/connectors?add=api`).
- [ ] **Context** panel has **Overview / Browser** tabs, empty copy, and a Close (×) button.
- [ ] **Agents** panel has a **My Agents** filter, search, **Create new agent**, **Create New** and **Manage Agents**.
- [ ] Typing **@** opens the agent mention list ("No agents match" when empty).
- [ ] Sending a message changes the URL to `/chat?id=…` and adds the chat to the top of Recent Chats. The title is generated within a few seconds.
- [ ] The reply streams in a "Assistant response" bubble with the model label. Reasoning collapses into "Thought for Ns". Tool steps show as "Ran N actions".
- [ ] Hovering the user message shows **Edit message / Copy message**. Hovering the reply shows **Copy / Regenerate**.
- [ ] **Edit message** shows an inline editor with Cancel / Save.
- [ ] **Stop generation** stops the stream and shows "Generation stopped".
- [ ] While a reply streams, a typed message shows the **Queue message** button. Enter adds it to a "Queued messages" tray, and it sends automatically when the stream ends.
- [ ] Reloading the chat restores every message.
- [ ] Header **Share** opens the Share chat dialog.
- [ ] An "Ideas for you" card starts a chat right away.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| CH-1 | Med | FE | Finished tool step still says "Running tool" | Ask something that uses a tool | Past tense ("Ran tool / Read file") once done | Green check next to "Running tool — /memories/…" |
| CH-2 | Med | FE | In-chat **Agents** panel says "No agents yet" when the user has a draft agent | Have one draft agent → open the Agents panel | Lists the agent, or explains that drafts are hidden | "No agents yet · Create an agent to use it in this chat" |
| CH-3 | Med | FE/BE | First message of a new chat sometimes ends "Generation interrupted. Please retry." and the title stays "New chat" | Send "Reply with just the word PONG." in a fresh chat | Reply + generated title | Interrupted. Seen once and may be backend flakiness, so recheck |
| CH-4 | Low | FE | Idea button label ≠ prompt sent | Click "Summarize my return and shipping policy" | Sends that text, or fills the composer for editing | Sends straight away "Give me my customer return window and standard shipping time in one concise sentence." |
| CH-5 | Low | FE | Animation warning in the console | Open the composer menus | No warnings | "Invalid keyframe value for property filter: blur(-0.08px)" |

---

## 3. Projects

**How it was tested:** Playwright as admin. Created throwaway `QA-SCAN` projects (personal, then switched to workspace) and tested validation, tags, edit, system instructions, file upload, chatting with a codeword in the uploaded file and a rule in the instructions, then delete. Checked delete and restore through the API (`GET /projects?deleted=recoverable`, `POST /projects/{id}/restore`).

### Checklist

- [ ] `/projects` shows counts (Personal / Workspace / Shared), the **New Project** button, a scope dropdown (**Personal**), **Search projects**, the view menu and the sort menu.
- [ ] Empty state reads "No personal projects yet. Create your first one to get started." with **New Project**.
- [ ] View menu: **Grid** "Show projects as cards" / **List** "Show projects in a compact list". List view shows the rows.
- [ ] Sort menu: **Recent · A to Z · Z to A · Most active**, each with a description.
- [ ] Search narrows the list. A miss shows `No projects matching "…"`. **Close search** resets it.
- [ ] `/projects/new`: **Create project** is disabled for an empty name and for a name of only spaces.
- [ ] Tags: Enter adds a chip, a duplicate isn't added again, and × removes a chip.
- [ ] Create goes to `/project/<id>` showing the name, "Personal Project" and the goal text. The project appears in the sidebar with "No chats yet".
- [ ] **Project options** menu shows **Edit · Delete**.
- [ ] Edit modal has Name\*, Who can see this (Personal "Just you" / Workspace "Everyone in the workspace" / Shared "You choose who to invite"), Description\* and Tags. **Save changes** updates the heading.
- [ ] Switching to **Workspace** shows the visibility in the header and adds **Members**, **Sharing**, and the **Your chats / Workspace chats** tabs (with an info tip).
- [ ] **Instructions & Files** panel opens and closes (×). It says instructions are included in every chat.
- [ ] **Add instructions** opens "System Instructions" with a `0 / 2000` counter and a hard 2000-character cap, plus Cancel / Clear / Save instructions.
- [ ] Cancel discards changes and Esc closes the modal.
- [ ] Save shows "System instructions saved", and the text survives a reload.
- [ ] Files: **Upload file** opens the file picker. The panel then shows "1 file · 54 B of 100 MB used" and the file row with **Remove <file>**, and both survive a reload.
- [ ] Sending from the project page opens `/project/<id>/chat/<chatId>`. The chat is listed on the project page and under the project in the sidebar.
- [ ] Project chat row menu (**Chat options**) shows **Rename · Delete**.
- [ ] **Delete** opens "Delete project? WARNING "<name>" contains N chats … cannot be undone", then returns to `/projects`.
- [ ] A deleted **workspace** project shows up in `GET /projects?deleted=recoverable`.
- [ ] An unknown project id shows "Project not found · It may have been deleted, or it isn't shared with you · Back to Projects".

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| PR-1 | **High** | BE (FE check) | Project files aren't available to the AI | Upload a .txt with a codeword to project Files → ask "What is the codeword in the project files?" | Answers from the file | Twice: "I can't find any project files attached to this chat". Browser also gets **403** on `HEAD` of the file's S3 presigned URL |
| PR-2 | **High** | BE (FE check) | Project system instructions aren't applied | Save "Always end every answer with the word BANANA" → chat in the project | Reply ends with BANANA | Instruction ignored |
| PR-3 | **High** | FE/BE | Deleting a personal project is permanent, but the dialog is identical to the recoverable workspace one | Delete a Personal project | Same Trash behaviour as workspace projects, or a dialog that clearly says "permanently" and lists what's lost | Gone for good. `/restore` returns 404 and it isn't in the trash list (this is how the seeded "QA Test Project" was lost) |
| PR-4 | Med | FE | No pending state during delete (4–9 s) | Confirm delete | Busy button or spinner | The modal closes and the old project page stays until the redirect |
| PR-5 | Med | FE | Unsupported file type rejected silently | Upload `x.exe` in project Files | Toast "This file type isn't supported" | Nothing happens |
| PR-6 | Low | FE | Visibility change saves with no toast | Edit → Workspace → Save changes | Toast | None |
| PR-7 | Low | FE | Stat cards look like tabs but aren't clickable | Click "0 Workspace Projects" | Switches scope, or doesn't look clickable | Nothing. Only the "Personal" dropdown switches scope |
| PR-8 | A11y | FE | Project name input has no accessible name | `/projects/new`, inspect the name input | Label or `aria-label` | "Name your project" is visual only. The input has no placeholder or label |
| PR-9 | A11y | FE | System Instructions modal isn't a dialog | Open Add instructions | `role="dialog"` + `aria-modal` | Neither |

---

## 4. Agents and Super Links

**How it was tested:** Playwright as admin. Went through list sort, filter and search, the templates gallery, then created an agent from a purpose through both paths: with the clarifying questions, and the direct path to review. On the review form tried each field, then finished, opened the details drawer, used the agent in chat and on its own chat page, opened the edit page, created a Super Link, opened that link in a fresh logged-out browser, and deleted the agent.

### Checklist

- [ ] `/agents` tabs **My Agents | Super Links**, with **New agent**, **Search agent**, **Sort by: Activity**, **Filter**.
- [ ] Sort: **Activity · A to Z · Z to A**.
- [ ] Filter: Status (Live / Draft / Paused), Super Link (Has active link / No link), Model.
- [ ] Search hit narrows the list. A miss shows `No agents matching "…"`.
- [ ] Empty state: "No agents yet · Agents are your custom AI configurations … · Create your first agent".
- [ ] Card shows the avatar, name, "by You", description, **Use in chat**, and a "…" menu.
- [ ] `/agents/templates`: **Start blank** plus Souvenir templates (Customer Support, Research …). **Use template** opens `/agents/new?template=…` with the purpose prefilled (e.g. 85/300).
- [ ] `/agents/new`: **Continue** is disabled when empty and enabled with text. The counter `N/300` updates. Over 300, Continue is disabled again.
- [ ] Suggestion chips (Drafts weekly reports, Summarises support tickets, Answers policy questions, Reviews contracts and flags risks) fill the purpose.
- [ ] Continue sometimes shows "A couple of quick questions": a `1/3` counter, Previous/Next question, Dismiss, radio answers, "Something else on your mind", Skip and Send.
- [ ] Review form "New agent — review & edit" has Avatar (Change avatar), Name and handle, **Suggest another name** (changes the name), Model ("Choose a model", Recommended/Standard groups, note that starter-tier models can't run agents), Description `66/120`, Instructions with Enhance / Generate new / Rewrite from the purpose, a Creativity slider (keyboard, "0.30 · Precise"), and a Live preview card.
- [ ] **Finish Agent Creation** creates the agent and it appears in the list.
- [ ] Card → **Agent details** drawer: Avatar, Change avatar, Name, handle, Model, Description, **Fine-tune**, Close.
- [ ] **Use in chat** opens `/chat` with the agent chip (Remove) in the composer.
- [ ] `/agents/<id>/chat` shows the agent header and "Message <agent>…". The reply streams and the URL gets `?chatId=`.
- [ ] `/agents/<id>/edit` shows Back, **Save changes**, "Edit agent" and the same fields.
- [ ] Share agent: the **Super Link** section, **Create link** → toast "Share link created". The link appears with **Copy**, `0 / 12,500 credits used`, **Turn off**, and **Invite by email / Send invite**.
- [ ] Super Links tab: KPIs (Credits this month, Conversations, Active links, Est. cost, Most active agent), a credit chart (7d / 30d / 90d, date range), **My Superlinks / Shared Superlinks** tables, and **Generate link** (agent picker, or "No agents yet — create one first").
- [ ] Delete agent: "Delete agent? “X” will be permanently deleted …", then the toast `"X" deleted`.
- [ ] Unknown agent chat shows "Agent unavailable". Unknown edit page shows "Agent not found · Back to agents".

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| AG-1 | **High** | FE | A Super Link needs a login, although the UI says no account is needed | Create a link → open `localhost:3000/share/<id>` in a logged-out browser | Guest chat with the agent | Redirects to the Auth0 login ("Welcome to Souvenir · Log in"). `/share/[id]` is behind the auth gate in `src/proxy.ts`. The dialog copy says "without a Souvenir account" |
| AG-2 | Med | FE | Finish Agent Creation gives no confirmation and invites a duplicate | Finish on the review form | Toast + redirect to the agent / published page | Stays on the form, no toast. The handle changes to `@…-2`, so clicking again would create a second agent |
| AG-3 | Med | FE | A new Super Link says "Created 5h ago" | Create a link → look at the table | "Just now" | "Created 5h ago" (UTC timestamp read as local time) |
| AG-4 | Med | FE | Super Link count ≠ rows, and no empty state | Super Links tab | "My Superlinks · N" matches the rows. Empty table shows a message | Header "· 4" with 2 rows. After deleting the agent: headers only, no message (the revoked row also vanished) |
| AG-5 | Med | FE | `/agents/published` opened directly fakes success | Visit `/agents/published` | Redirect, or a not-found state | "“Your Agent” is now live …" with a placeholder name. Its button "Back to Library" actually goes to Agents |
| AG-6 | Low | FE/BE | Generated instructions keep the old name | Review form → Suggest another name | Instructions use the new name | Still "You are Qa-scan Agent" after the rename to "Qa-scan Assistant" |
| AG-7 | Low | FE | Auto-name breaks acronyms | Purpose starting "QA-SCAN agent …" | "QA-SCAN Agent" | "Qa-scan Agent" |
| AG-8 | Low | FE | Text typed before the page finishes loading is wiped | Type into Agent purpose right after load | Text kept | Cleared and Continue stays disabled. Retype after the page settles |
| AG-9 | Low | FE | Wrong message for a deleted or unknown agent | Open `/agents/<bad id>/chat` | "Agent not found" | "This agent isn't available to you. Ask the owner to share it with you via a personal link." |

---

## 5. Schedules

**How it was tested:** Playwright as admin. Covered the list (Mine / Organization, search), the New schedule modal (every field, both frequencies, time picker, timezone search, validation), creating a schedule through Start task → chat → send, the detail page (toggle, Run now, history, outputs, linked chat, edit) and delete. Confirmed state through `GET /automations`.

### Checklist

- [ ] `/schedules` shows "Schedules · Automated tasks that run on your behalf", the **search** icon, **New schedule**, and tabs **Mine | Organization**.
- [ ] Each card shows the created date, an Active/Paused badge, name, summary, cadence ("Every Monday at 9:00 AM (Asia/Kolkata)"), run count, and a success chip (green 100% / red 0%).
- [ ] Search with no match shows `No schedules match "zzzz".`
- [ ] Organization tab shows "Everyone in your organization can see these. Copy one to run it as your own." and an empty state with **Create schedule**.
- [ ] New schedule modal is a real dialog: Name, Set instructions, Frequency **Daily / Weekly**, Time, Timezone, Cancel, **Start task**.
- [ ] Weekly adds **Day** (Monday by default, menu of weekdays).
- [ ] Time picker: Hour, Min and AM/PM columns plus **Confirm time** ("9:00 AM").
- [ ] Timezone list is searchable after clicking its search box ("London" → Europe/London).
- [ ] **Start task** stays disabled until name, instructions and time are all set.
- [ ] Start task opens `/chat?fromSchedule=new-…` with the composer prefilled: name, instructions, "Frequency: Weekly • Monday 21:30 (Europe/London)" and the timezone.
- [ ] Sending runs "Creating Automation" and the schedule appears in the list.
- [ ] Detail page: back to **Schedules**, **Edit schedule**, **Delete schedule**, **Run now**, the title, status/run/success chips, cadence, Last/Next run, What it does, Run outputs (link "All run outputs in Library" → `/library?tab=all&source=generated`), Run history, and Details (Status switch, Frequency, Created, Linked chat **Open chat** → `/chat?id=…`).
- [ ] **Run now** adds history "1 · Completed · Today · time". Expanding the row shows the output ("TICK").
- [ ] **Edit schedule** opens a prefilled modal ("Changes are applied via Task …").
- [ ] Delete: `Delete "X"? This will permanently remove the schedule and all its run history.` → toast "Schedule deleted" and back to `/schedules` (backend status `removed`).
- [ ] Unknown id shows "Schedule not found · It may have been deleted, or it belongs to someone outside your organization · Back to Schedules".

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| SC-1 | Med | FE | Esc in the Timezone list closes the whole New schedule modal | Fill name + instructions → open Timezone → Esc | Only the dropdown closes | The modal closes and the typed text is lost |
| SC-2 | Med | FE | Timezone search box isn't focused when the list opens | Open Timezone → type "London" | Filters | Nothing until you click the search box |
| SC-3 | Med | FE/BE | Pause/resume gives no feedback and a reload shows the old state | Detail → toggle Status → reload | Toast. The reload shows the new state | No toast. The reload showed "Active" again, and "Paused" only appeared later |
| SC-4 | Low | FE | Run now gives no feedback, and runs while Paused | Paused schedule → Run now | Toast "Run started". Decide whether a Paused schedule should run | No toast. It runs |
| SC-5 | Low | FE | Timezone name differs between the picker and the cards | Compare | Same IANA name | Picker "Asia/Calcutta", cards "Asia/Kolkata" |
| SC-6 | Low | FE | Next run shown in local time with no timezone label | Schedule in Europe/London viewed from IST | "Next run Today · 2:00 AM IST" | "Today · 2:00 AM" next to "9:30 PM (Europe/London)" |
| SC-7 | Low | FE | "Start task" wording | Click Start task | Label matches the action ("Review in chat") | Only prefills the chat. The user must still press Send |
| SC-8 | Low | FE | Organization tab hides New schedule and search, and its CTA contradicts its subtitle | Organization tab | Consistent actions | Subtitle says "Copy one". The empty state offers "Create schedule" |
| SC-9 | A11y | FE | `/schedules` has no `<main>` landmark | Inspect | `<main>` | None |
| SC-10 | A11y | FE | Delete confirm isn't a dialog | Delete schedule | `role="dialog"` | Plain div. It also shares the name "Delete schedule" with the header icon |
| SC-11 | A11y | FE | Time picker semantics | Inspect | Button named "Time". Hours/minutes are options | Name read twice: "Time Time". Hour/Min items have no `option` role |
| SC-12 | A11y | FE | Name field focus ring is red/pink | Open New schedule | Neutral focus ring | Looks like an error state |

Seen once on the dev server and not reproduced: Radix "Slot failed to slot onto its children", caught by ErrorBoundary on `/schedules`.

---

## 6. Library

**How it was tested:** Playwright as admin with a `QA-SCAN` .txt sent in a chat (the Library has no upload button by design). Covered Suggested / All files / Shared, filters, sort, search, row menus, the file page (viewer, info, rename, download, share with the member, manage access, ask about it), Trash (move, restore, delete forever) and bad-id pages. Checked upload state through `GET /library/uploads` and `/library/files/{id}`.

### Checklist

- [ ] `/library` shows "Library", "52.7 MB of 21.47 GB used", **Search Library**, the **Trash** link, and tabs **Suggested | All files | Shared**.
- [ ] Suggested has **Recent** (See all → `?tab=all`, "Opened 1d ago") and **Frequently used** ("Opened 85 times").
- [ ] Row "More actions for <file>": **Open · Ask about this · Share · Download · Rename · Delete**.
- [ ] All files table: Name (sortable), Access (owner/shared avatars, "Owner: You. Shared with X"), Source (Uploaded/Generated), Created (sortable), Type, Actions.
- [ ] **Filter**: Source (Uploaded / Generated / Shared), File type (Images / Documents / Spreadsheets / PDFs / Audio).
- [ ] **Sort**: Name / Created, Newest first / Oldest first.
- [ ] Search shows scope chips "In All files | All of Library". A miss shows "No files match · Try other words · Clear search".
- [ ] Shared tab has a "Date shared" column.
- [ ] A file sent in a chat is saved to the Library (once processing finishes, see LB-1).
- [ ] File page: name menu (Ask about this · Share · Download · Rename · Delete), Download, Share, File info toggle, Close.
- [ ] While processing, a notice reads "Preparing Library previews and search. You can already use the original file in chat or download it."
- [ ] File info panel: Type, Owner, Created, Size, Used in ("Not used yet"), Who has access, Private, **Manage access**, **Ask about this**, **Download**, **Delete**.
- [ ] **Ask about this file** composer starts a chat that answers from the file (found the codeword VERMILION). **Ask about this** opens `/chat?libraryFileId=…`.
- [ ] Rename dialog: "Currently “X”. The file type stays .txt. Slashes are saved as dashes." → toast "Renamed". Download then gives the new name.
- [ ] Share dialog "Share <file>": the **Add people or the whole workspace** box, Who has access, **Copy link**, **Done**. Esc closes it.
- [ ] Sharing with the member gives the toast "Shared with OS8 Test01 · Undo". Access shows "Shared directly" and Manage access shows "Viewer".
- [ ] Delete opens "Move X to Trash?" with an impact summary (0 chats / 0 routines / Shared with no one / "Recoverable for 30 days. Answers already written stay as they are.") → toast "X moved to Trash · Restore".
- [ ] `/library/trash`: "Restore files you've deleted. Files are deleted forever after 30 days.", "Frees up N", **Empty Trash**, columns Name / Days left / Size / Deleted. Row menu: **Restore · Delete forever**.
- [ ] Restore gives the toast "Restored X" and the file page works again.
- [ ] Delete forever: "Delete X forever? This frees up 54 B and can't be undone." → toast "X deleted forever".
- [ ] A trashed or unknown file id shows "No longer available · Back to Library".

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| LB-1 | **High** | BE (FE fallback) | A tiny upload stays "processing" for 40+ min and is invisible until then | Send a 54-byte .txt in chat → open Library | Listed in All files and searchable by name within seconds. Preview renders | `processingPhase: "queued"` for 40+ min. Not in All files, name search returns nothing, preview is a grey box (`GET …/preview` 409). Reachable only by URL |
| LB-2 | Med | FE | Composer blocks sending while an attachment is "Processing…" and silently drops Enter | Attach a file → type → Enter during "Processing…" (20 s+) | Send queues, or the button explains why it's waiting | Send is disabled and Enter does nothing. People will think it sent |
| LB-3 | Med | FE | Rename Save is enabled for a blank name | Rename → clear the field | Save disabled | Enabled |
| LB-4 | Low | FE | Trash is slow and lags | Open Trash / restore an item | Rows within a few seconds. Restored row disappears | 10–25 s with only the header shown. The restored row stays until a refetch |
| LB-5 | Low | FE | Days left doesn't count down | Item deleted yesterday | "29 days" | "30 days" |
| LB-6 | Low | FE | A trashed file's URL offers no way back | Open a trashed file's link | "In Trash · Restore" | "No longer available" |
| LB-7 | A11y | FE | Delete forever and Empty Trash confirms aren't dialogs | Open them | `role="dialog"` | Plain divs. Console also warns "Missing Description or aria-describedby for DialogContent" |
| LB-8 | A11y | FE | Row actions only appear on hover | Keyboard through the table | Reachable by keyboard | The "More actions" button is hover-revealed |

Seen once: a nonsense search briefly showed "50 results, best matches first" (stale default list) before settling on "No files match".

---

## 7. Connectors

**How it was tested:** Playwright as admin and as member. Clicked through tabs, search, categories, sort and cards. Opened Connect (stopped before the third-party OAuth) and Add custom API (validation only, nothing saved). Checked the `?add=api` deep link.

### Checklist

- [ ] `/connectors`: "Connectors · Tools your workspace can use across chat", **Add custom API**, tabs **Discover / All / Connected / Not connected**, **Search connectors**, **All categories**, **Sort connectors**.
- [ ] Discover shows category rows (Marketing, AI, Productivity, Business Management …), each with **View all**.
- [ ] Search "slack" shows matches (Albus, Bot for Slack …). A miss shows "No connectors found."
- [ ] All categories menu lists every category. Choosing Productivity filters the grid.
- [ ] Sort: **Name A–Z / Name Z–A**.
- [ ] Not connected tab lists the catalogue. Connected shows the empty state when nothing is connected.
- [ ] **Connect <app>** opens "Connect <app> · Choose access before authorizing" with Account name (optional), Who can use it (**Shared** / **Private**), Cancel and **Continue to <app>**.
- [ ] **Add custom API** dialog: Name, Base URL ("Every request must start with this URL"), Authentication (Bearer token), API token, Documentation URL (optional), Cancel, **Add API** (disabled until valid).
- [ ] A bad Base URL shows "Use a full https:// URL." and Add API stays disabled.
- [ ] `/connectors?add=api` opens the dialog directly.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| CN-1 | Low | FE | Clicking a connector card does nothing | Click a card body | Opens details, or doesn't look clickable | Nothing. Only the Connect button works |
| CN-2 | Low | FE | Generic empty state on Connected | Connected tab with nothing connected | "No apps connected yet" + a hint | "No connectors found." |
| CN-3 | Low | FE | Tab clicks during first load are ignored | Click "All" while the skeletons show | Tab switches when the data arrives | Stays on Discover |
| CN-4 | A11y | FE | Two nested `<main>` landmarks | Inspect `/connectors` | One `<main>` | `main > main` |

---

## 8. Souvenir in Slack

**How it was tested:** Playwright as admin and member. Opened the consent dialog and stopped before Slack OAuth (no Slack workspace is available to connect).

### Checklist

- [ ] Sidebar shows **Souvenir in Slack · Add** for admins only. Add and the row both open `/souvenir-slack`.
- [ ] Page: "Slack · Configure how Souvenir shows up in Slack …", "Bring Souvenir into Slack", three benefit cards, **Connect Slack workspace**, and "Slack will ask you to approve access before anything is connected."
- [ ] Connect opens "Connect Souvenir to Slack" with the permission list, privacy note, Cancel and **Accept and Connect**.
- [ ] A member doesn't see the sidebar row. `/souvenir-slack` shows them "Only workspace admins can see this page · Back to chat".
- [ ] `/slack/link` without a token shows "Couldn't link Slack · This page expects a connect link from Slack … · Go to Souvenir".
- [ ] Not tested (needs a real Slack workspace): channel mapping, connected state, disconnect.

No bugs found.

---

## 9. Settings

**How it was tested:** Playwright as admin on every visible settings page. Every edit was reverted. Nothing was submitted to external services: no bug or feature submissions, no plan cancellation (stopped at the confirm), no invites sent.

### Checklist

**Shell**
- [ ] Settings nav: Back, theme switch (Light/Dark/System), PERSONAL (Account, Usage), WORKSPACE (Admin badge: General, Members, Plans & Billing, Usage), HELP & SUPPORT (Help & Legal, Report a bug, Feature request), Log out, and the profile footer.

**Account**
- [ ] Profile fields are read-only until **Edit profile**. Email stays read-only. Cancel restores the values (toast "Changes discarded").
- [ ] Save changes gives the toast "Account details updated", and the new first name survives a reload.
- [ ] **Appearance** Light / Dark / System applies at once (toast "Theme set to Dark mode") and survives a reload.

**Usage (personal)**
- [ ] "Where your credits went" donut, the by-source list (Slack / Automations / Chat with credits and %), Credit balance with a progress bar, Remaining, Most used, and **View plans & billing** (→ `/settings/plans-and-billing`).

**General**
- [ ] Workspace card is read-only until **Edit workspace**. Workspace ID stays read-only. Cancel works.
- [ ] Organization-level AI instructions: starter chips add text (each chip only once), a `0 / 3,000` counter and hard cap, **Save instructions** → toast "Instructions saved" and survives a reload, **Clear** → toast "Instructions cleared".

**Members**
- [ ] Stat cards (Total members, Admins, Pending invites), **Roles & Permissions** dialog (Admin / Member descriptions, View in detail).
- [ ] Search finds a member. A miss shows "No members match your search".
- [ ] Role menu: **Admin** "Full access, including billing" / **Member** "Access through assigned projects only".
- [ ] **Remove** shows an inline **Cancel / Confirm remove**.
- [ ] **Invite members** dialog: "Invite to test01-workspace", Email chips, Role, Cancel, **Send invite**. Esc closes it.

**Plans & Billing**
- [ ] Plan card ("Core Plan · $125/mo", Active, next billing date), **Cancel plan** → "Cancel subscription? … stays active until Nov 16, 2026" with **Keep plan / Yes, cancel**.
- [ ] **Upgrade Plan** opens `/org/change-plan`: Monthly / Yearly (Save 25%, $93.75/mo), Core (Current plan), Pro (Enterprise, Get in touch), **Back to billing**.
- [ ] Credits remaining + **View usage** (→ `/settings/analytics`).
- [ ] **Manage on Stripe** opens the Stripe billing portal in a new tab.
- [ ] Invoice history: **Export all** downloads the invoice PDF. **View** per row.

**Usage (workspace / analytics)**
- [ ] Credits used this cycle, Remaining, Active members (each with a tooltip), the Top users table with share bars, and the footnote explaining that background-work totals differ.
- [ ] **Export CSV** downloads `member-usage.csv`. **View all members** opens `/settings/members`.

**AI & Models**
- [ ] Search, tabs **All / Enabled / Disabled**, providers (OpenAI 6/6, xAI 1/1, Souvenir 2/2) with plan/context/vision badges.
- [ ] A model switch off gives the toast "Grok 4.7 disabled" and survives a reload. Switching it back on works.

**Activity Log**
- [ ] Search activity, an **All actions** filter (Invite accepted / Invite sent / Organization updated / Plan granted / Settings updated), and the table When / Actor / Action / Target.
- [ ] A miss shows "No activity matches your filters". The footer reads "Retains 90 days of history · showing N of N entries".

**Help & Legal, Report a bug, Feature request**
- [ ] **Community Slack** opens `souvenircommunity.slack.com` in a new tab. The **Report a bug** and **Request a feature** cards open their pages. Help Center and Contact Support show "Coming soon" (disabled). Version line "Souvenir v1.5 © 2026".
- [ ] Report a bug page: What went wrong (required), Steps to reproduce (optional), Severity (Low / Medium / High with descriptions). Submit is disabled until text is entered.
- [ ] Feature request page: the text box, "Which part of Souvenir?" chips (Chat, Agents, Library, Schedules, Connectors, Slack, Projects, Billing, Other) and "How important is it?". Submit is disabled when empty.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| ST-1 | **High** | FE/BE | The only admin can remove themselves | Members → Remove on your own row ("You", the only admin) | Disabled with "A workspace needs at least one admin" | Inline "Confirm remove" is offered (not confirmed in this test) |
| ST-2 | Med | FE/BE | Response style doesn't save | Account → Response style → Direct | Saves ("Saves as soon as you pick one") | Toast "Failed to save style — please try again". Not kept after a reload |
| ST-3 | Med | FE | Sidebar name doesn't update after a profile change | Change first name → Save → reload | Sidebar profile row shows the new name | Still shows the old name |
| ST-4 | Med | FE | Invite field accepts invalid and duplicate emails | Invite members → type "not-an-email" Enter, then an existing member's email | Inline error. No chip | Both become chips with no error |
| ST-5 | Med | FE | Save enabled with an empty name | Edit profile → clear First name. Edit workspace → clear Workspace name | Save disabled + "Required" | Save enabled |
| ST-6 | Low | FE | AI page count ignores search and tab | Search "zzz", or open the Disabled tab | "0 models" / an empty state | Still "9 models available" |
| ST-7 | Low | FE | Odd "NONE · 9 enabled" label | AI & Models header | Clear wording (routing preference?) | "NONE · 9 enabled" |
| ST-8 | Low | FE | Many settings toasts on one edit | Edit profile → Cancel | One toast | "Editing profile" + "Changes discarded" |
| ST-9 | A11y | FE | Settings pages have no `<main>` landmark. Cancel subscription and Remove confirms aren't dialogs | Inspect | Landmark + `role="dialog"` | Missing |

---

## 10. Member role and permissions

**How it was tested:** Logged in as `MEMBER_EMAIL`. Visited every admin route directly, compared the sidebar and menus with the admin's, and tried changing an AI model (reverted straight away and confirmed as admin).

### Checklist

- [ ] Member sidebar has New, Agents, Schedules, Library, Connectors, Projects (only **All Projects** in the header) and Recent Chats. No Slack row.
- [ ] Member profile menu: **Usage · Settings (Ctrl ,) · Help & Legal · Report a bug · Log out** (no Upgrade Plan or Workspace settings).
- [ ] Member settings nav: PERSONAL (Account, Usage) and HELP & SUPPORT only.
- [ ] `/settings/general`, `/members`, `/analytics` and `/activity` show "Only workspace admins can see this page · Back to chat".
- [ ] `/settings/billing/change-plan` redirects the member to `/settings/usage`.
- [ ] `/settings/usage` shows the member's own credits only.
- [ ] `/souvenir-slack` is blocked for members (see section 8).
- [ ] Library, Agents, Projects and Schedules load for the member. Files shared by the admin show on the member's Shared tab.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| RL-1 | **High** | FE + BE | Members can turn workspace AI models on and off | As member open `/settings/ai` → flip "Enable Grok 4.7" | Admin-only page (like General), and the backend rejects the change | Page loads with working switches. Toast "Grok 4.7 disabled", which affects the whole workspace |
| RL-2 | Med | FE | Member Plans & Billing loads forever | As member open `/settings/plans-and-billing` | "Only workspace admins …" or a redirect | Skeleton stays after 12 s+ |
| RL-3 | Low | FE | Members see **Add custom API** on Connectors | As member open `/connectors` | Hidden or explained if admin-only | Enabled (confirm the intended permission) |

---

## 11. Links, invites, error and redirect pages

**How it was tested:** Playwright as admin with made-up ids, plus the onboarding routes as an already-onboarded user.

### Checklist

- [ ] `/chats` has the "Chats" heading, **Move to project**, **New chat**, an **All chats** filter, **Open search** and the chat list with relative times.
- [ ] `/welcome` and every `/onboarding/*` route redirect an onboarded user to `/chat`.
- [ ] `/chat-shares/<bad>` shows "The requested resource was not found … · Go back".
- [ ] `/share/<bad>` shows "🔗 Link not found · This share link doesn't exist or has already been used · Go home".
- [ ] `/team-invite/<bad>` goes to `/onboarding/team/<id>` with "Invite not found … · Close".
- [ ] `/chat?id=<bad>` shows "Couldn't load this conversation. The requested resource was not found. · Retry".
- [ ] `/settings` redirects to `/settings/account`. `/settings/billing` and `/settings/plans` redirect to `/settings/plans-and-billing`.

### Bugs

| ID | Sev | Side | Bug | Steps | Expected | Actual |
|---|---|---|---|---|---|---|
| MS-1 | Med | FE/content | All legal links are dead | Help & Legal → Terms / Privacy / Cookie | Policy pages | `getsouvenir.com/legal/terms`, `/privacy` and `/cookies` all return **404** |
| MS-2 | Med | FE | Report-a-bug modal (sidebar) allows an empty submit | Profile → Report a bug | Submit disabled until "What went wrong?" has text | Enabled when empty (the settings page version is correct) |
| MS-3 | Med | FE | Fake invite page for an unknown id | Open `/org-invite/<random uuid>` | "Invite not found" | "You're on the list! You've been invited to join a workspace … Sign up" |
| MS-4 | Low | FE | `/template/<bad id>` hangs | Open it | "Template not found" quickly | Page didn't finish within 30 s (console `template_view_failed: timeout`) |
| MS-5 | Low | FE | Unbranded 404 | Open `/this-does-not-exist` | App-styled not-found page | Default Next.js "404 · This page could not be found." |

---

## 12. Cross-cutting accessibility

Accessibility findings that apply to many screens (also listed in their feature tables):

- **Landmarks:** no `<main>` on Settings or Schedules, and a nested `<main>` on Connectors.
- **Custom modals without dialog semantics:** System Instructions (project), schedule Delete, Trash Delete forever and Empty Trash, Cancel subscription. The Members remove confirm is inline rather than a dialog.
- **Inputs labelled only visually:** project name, plus "Search timezone" uses an overlay placeholder.
- **Nested interactive controls:** Share chat member rows, the sidebar Slack row.
- **Hover-only actions:** Library Trash rows, sidebar chat-row "…" buttons.
