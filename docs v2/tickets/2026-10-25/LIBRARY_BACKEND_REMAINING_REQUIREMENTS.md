# [Backend] Library: remaining requirements after `c03695a0`

**Date:** 2026-10-25
**Checked against:** `back-end` `origin/Development` head `c03695a0` (deployed to devapi).
**Tested:** live on 25 Oct with the ADMIN and MEMBER test accounts.
**Front end:** everything that `c03695a0` shipped is built, and none of it is waiting on the backend.

**Sources:**
- Full request and response shapes: `../2026-10-19/LIBRARY_ALL_FLOWS_BACKEND_TICKET.md`.
- Per-check status: `../2026-10-20/LIBRARY_FLOWS_CHECKLIST.md`.
- Front-end status: `../2026-10-24/LIBRARY_OPEN_BACKEND_DEPENDENCIES.md`.

Requirements are in priority order. Each has acceptance criteria that can be checked against devapi.

---

## R1. Routines and Library (BE-07): not started

`c03695a0` doesn't touch `services/automations`. The front end for all of this is already built (`RoutineCreatedCard`, the attached-files section, "Made by routine…", "Files this run used", "Running now").

| # | Requirement | Acceptance criteria | Checks |
|---|---|---|---|
| R1.1 | Attached files on a routine | `GET /automations/{id}` returns `attachedFiles: [{id, title, format, state: open \| deleted \| locked}]`. `PATCH` can add or remove files. A trashed file comes back as `deleted`, and the next run skips it. | B3, C-d2, F-d1 |
| R1.2 | Routine proposal before creating | When asked for a routine, chat emits a `routine_proposal` event (name, schedule, delivery, suggested files) and does **not** create it. A confirm endpoint creates it, with the chosen files or none. | B1, B-d1, B-d2 |
| R1.3 | Test run after creating | Creating a routine starts one test run and emits `routine_created` with the run id. The run reports its status until it finishes. The output is marked `isTestRun`. | B2 |
| R1.4 | Run output naming and provenance | The output title is "<Routine> - <date>": no `files/` prefix, and unique per run. `provenance: {kind: "routine", routineId, runLabel, isTestRun}`, `generatedFrom: {kind: "routine", label}`, and `runInputs` lists the files the run used. | B6, C1, C8, H4, H8 |
| R1.5 | What a run produced | Each run has `output: "file" \| "message"`. An instruction routine (`kind: "model"`) saves its result as a file when it makes one. | B6, C2 |
| R1.6 | No double runs | A second `POST …/run` while a run is in progress answers `409 already_running`. Today both calls answer `200`. | C-d1 |
| R1.7 | Slack "is ready" | After a run, post "<Routine> is ready." to the routine's Slack channel, depending on product decision 2. | C7 |
| R1.8 | Routine sharing state | `GET /automations/{id}` returns `shared`. | B5 |

## R2. Removing a member or leaving (BE-11): built differently from the requirement

`services/library/handoff.py` runs straight away. The people a member shared files with get copies of those files, then everything the member owns is deleted. **The requirement is a question the leaving person must answer first.**

| # | Requirement | Acceptance criteria | Checks |
|---|---|---|---|
| R2.1 | Pending removal | Removing a member (or a member choosing Leave) creates a pending state instead of acting at once. The Members list shows "Waiting for their answer". | G6 |
| R2.2 | The question and the answer | The leaving person is asked "Transfer your shared files to other members?" and answers through an endpoint. **Yes:** each shared file goes to its recipients, as now. **No:** the shared files are deleted. A file they never shared is deleted either way. | G7 |
| R2.3 | No answer | What happens if the person never answers (decision 4). | G6 |
| R2.4 | Leave for the last Admin | The last Admin is refused Leave with a reason the front end can show ("Name another Admin first"). | G-d2 |
| R2.5 | Removed person's shares | After removal, the person is gone from every file's Who has access. Verify this live. | G-d1 |

**Product decision needed first:** does the automatic hand-off replace the question? If it does, R2.1 to R2.3 are dropped. The front end then needs only a Leave confirmation that explains the hand-off, and `NEXT_PUBLIC_ENABLE_LIBRARY_SETTINGS` can be turned on.

## R3. Routine origin on lists (BE-12 R5)

| # | Requirement | Acceptance criteria | Checks |
|---|---|---|---|
| R3.1 | Routine origin on Generated rows | Rows made by a routine send `generatedFrom: {kind: "routine", label: "<Routine>"}`. Today every row says `kind: "chat"`. This depends on R1.4. | H4, H8 |

## R4. Gaps found in the 25 Oct live test

| # | Requirement | What we saw | Acceptance criteria |
|---|---|---|---|
| R4.1 | Fill in thumbnails for existing files | Only files uploaded after 25 Oct have `thumbnailUrl`. Every older image and PDF has none. | A one-off job makes thumbnails for existing images and PDFs. |
| R4.2 | Fill in transcripts for existing recordings | Older recordings returned `transcriptStatus: "pending"` with no lines, and only became ready later. | A one-off job transcribes every existing recording. `pending` never lasts longer than processing does. |
| R4.3 | Find uses the find tool | In web chat, "find the return policy" answered from the file's contents instead of calling `find_library_files` ("Found 1 file." with links). | A find request calls the tool and replies with links. Check in Slack too (D6). |
| R4.4 | Share-refusal wording | "share the Weekly sales report with Lena" (not a member) replied "Who should I share it with? Try OS8 Test01." | Name the problem: "Lena isn't in your workspace." Nothing is shared, as now. |
| R4.5 | Refused uploads on list rows | List rows have no upload `phase` or `failureReason`, so a row's … menu can't hide Ask about this for a refused upload. | Add `phase` and `failureReason` to `FileRow`, or leave refused files out of lists. |

## R5. API conventions

| # | Requirement | Acceptance criteria |
|---|---|---|
| R5.1 | C-01: `kind` and `retryable` | Every error body carries `kind` (validation, auth, not_found, conflict, rate_limit, server) and `retryable`. Today they have `code`, `message`, `requestId` and `fieldErrors` only. |
| R5.2 | C-05: `ETag` | Library GETs send an `ETag` and answer `If-None-Match` with `304`. `Cache-Control: private, no-store` is already there. |
| R5.3 | C-02: Idempotency on the remaining POSTs | Accept `Idempotency-Key` on routine confirm (R1.2) and on the removal answer (R2.2), as on uploads, grants, access requests and chat send. |
| R5.4 | C-07 | Rate limits on Library routes, a malware scan on uploads, and EXIF/GPS stripping on images. |
| R5.5 | C-08 | Accept and return a `traceparent`. |
| R5.6 | C-09 | `openapi.yaml` documents every `/library` route and its error codes. Today only `200` and `422` are listed. |

## R6. Environment

| # | Requirement | Checks |
|---|---|---|
| R6.1 | Connect a Slack test workspace to `test01-workspace`. The code for Library in Slack (BE-10) is in `c03695a0` but can't be tested until then. | D1–D3, D5–D7, D-d1, D-d2, C7, E9 |

## Product decisions still open

| # | Decision | Blocks |
|---|---|---|
| 1 | Are routines private, or visible to the whole org? | R1.8 |
| 2 | Should a routine post "<Routine> is ready." to Slack on its own? | R1.7 |
| 3 | How long can a deleted chat be restored? (30 days is proposed) | Chat restore window |
| 4 | Does the automatic hand-off replace the removal question? If not, what happens when the person never answers? | R2 |
| 5 | Is there a workspace storage limit this phase? | Admin storage |
| 8 | Is the Generated row only routine outputs, or every generated file? | R3.1 |

## Already shipped and verified (for reference, no work needed)

BE-04 chat search and switches · BE-05 trashed files kept out, `savedFiles`, `deleteFiles` and restore · BE-06 transcripts · BE-08 share by asking · BE-09 request access · BE-12 R6, R7, R9, R10, R11 · BE-02 R9 · C-02 on uploads, grants, access requests and chat send · C-05 `Cache-Control`.
