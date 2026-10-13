# 05 Delivery plan, states, QA and open questions

## 1. Phases

The detailed build plan (shared prerequisites SP-1 to SP-10, work packages WP0 to WP8, budgets, CI, security rules) is `07-build-plan.md`; how each of the 56 design-system principles applies is `06-principles-application.md`; the audit of the plan is `08-plan-audit.md`. The table below stays the high-level view.

| Phase | Scope | Backend dependency | Front-end exit criteria |
|---|---|---|---|
| 0. Foundations | `components.json`, shadcn primitives restyled, Library tokens (category glyph colours, mint gradient), `lib/library/*` skeleton, flag, dev page `src/app/(app)/dev/library` | none | primitives render in light and dark, no shadcn default colours left |
| 1. Browse | `/library` tabs, table, Suggested, search, filter, sort, storage label, sidebar item | list, suggested, storage (step 1 of 04 section 10) | all list states, URL state, virtualisation, a11y pass |
| 2. File page and sharing | File page, previews, info, share, rename, delete, trash, request access, locked/gone | detail, preview, grants, trash | permission matrix tests green against the real API |
| 3. Composer | upload pipeline, attachment cards, Send hold, failure notice, picker, auto-save, citations, Sources panel | uploads, `libraryFileIds`, `ask_save`, citation locators | repro every flow A in the prototype checklist against staging |
| 4. Routines and Slack surfaces | attach from Library, run outputs, skipped notice; Slack results appear | automations output, Slack step | flows B, C, D |
| 5. Settings and Admin | personal settings, Admin settings, Members, transfer question, leave | prefs, org settings, removal | flows E, F, G, H |
| 6. Hardening | perf budget, a11y audit, analytics, error/empty copy review, flag ramp | all | section 5 gates below |

Phases 0 to 2 can proceed in parallel with backend step 1 using the mock adapter. Phase 3 is gated on the backend upload contract being agreed (this is the longest pole).

### 1b. PRD Phase 1 items the prototype did not build (production additions)

The prototype `flows.md` lists these as "not built, because they are not in the plan or need a backend". They are Phase 1 in the PRD, so production includes them. Where the owner's prototype decision conflicts, the item is marked and the decision is logged in the Open questions log at the end of this doc.

| Item | PRD id | Where specified | Placed in phase |
|---|---|---|---|
| Upload pause and resume on dropped connection | CAP-15/17 | 02 section 6, 04 section 4 | 3 (composer) |
| "Taking longer than usual" after 10 min, one automatic retry | CAP-15 | 02 section 6, 04 section 4 | 3 |
| Automatic save retries (3) and "Not in Library" | CAP-1 | 02 section 6, 04 section 4 | 3 |
| Undo on "Saved to Library" (10 s) | CAP-10 | 02 section 6 | 3 |
| Scan with no readable text: "not searchable", Retry OCR; partial reading | CAP-17 | 04 section 3.2 | 3, **conflicts with owner decision 9 (OQ-9)** |
| Slack: external-member channels fail closed; "still reading" reply; "couldn't reach Library" | SLK, FIND-19 | 04 section 6.8 | 4 |
| Slack: Save to Library on a message or file; attach/remove files on a routine; delete and restore by asking | SLK-2, SLK-5, SLK-7 | 04 section 6.8 | 4 |
| Citations show who added a file and when; freshness notes | FIND, section 11 | 02 section 8 | 6 (needs backend metadata; OQ-14) |
| Delete a routine with "Also delete its N run outputs" | RTN, edge cases | 02 section 5, 04 section 6.6 | 4 |
| Opt-in "Import to Library" of existing chat files and routine outputs | Launch readiness | 02 section 12, 04 section 9 | 6 |
| Per-workspace kill switches for auto-save, AI use of Library, sharing | Launch readiness | 04 section 9 | 6 |

## 2. Mock adapter (so the UI does not wait)

- `lib/library/api.ts` exports an interface `LibraryApi`; `api.real.ts` calls the endpoints, `mock/api.mock.ts` serves fixtures derived from the prototype's `lib/data.ts` (people Maya, Sam; Acme and Nova contracts; run outputs; the failing sample files; an audio file). Selected by `NEXT_PUBLIC_LIBRARY_MOCK=1`.
- The mock implements the same state machine delays (uploading 1.5 s, processing 3 s) and failure samples so the composer pipeline is testable without a backend.
- Fixtures are shared with vitest and the dev page. They contain **no real names or data**.
- The mock is deleted when the real contract is verified end to end (tracked in the phase 6 checklist), not left to rot.

## 2b. Success metrics to instrument (PRD Phase 1 section 1)

Targets are proposals to calibrate in beta. Front-end events use the existing `library` feature with enum properties only (no free text, no names); server-side metrics come from the backend.

| Goal | Metric | Source |
|---|---|---|
| Findability | median time from opening Library to opening or attaching a file (< 10 s) | FE: `open_tab` to `open_file` / `pick_from_library` timestamps (client-side timing, sent as a bucket) |
| Reuse | share of active workspaces with a file attached to a routine (40 % in 90 days) | BE |
| Fewer re-uploads | duplicate-upload rate per owner (30 % below baseline) | BE, from `content_sha256` per owner |
| Routine outputs | share of runs whose output is opened within 7 days | BE from `opened` |
| Trusted grounding | share of answers using files with an openable citation (> 95 %) | BE + FE `citation_opened` |
| Safe sharing | cases of unintended visibility: zero, release blocker | BE permission tests and red team |
| Deletion trust | search 60 s, derived 24 h, storage 30 d, 100 % of files | BE purge monitor |
| Clutter guard | share of users turning auto-save off; outputs kept per routine | FE `autosave_changed` (enum old, new), BE |

Guardrails: retrieval p95, ingestion failure rate by `reason`, storage cost per workspace, permission-check errors. Add FE enum actions `autosave_changed`, `citation_opened`, `import_started` to the `library` feature (document in `mixpanel-setup-notion.txt` first).

## 3. State coverage table (every surface, all states must be built and reviewed)

| Surface | Loading | Empty | Error | Special |
|---|---|---|---|---|
| Suggested | card + tile skeletons | whole page: "Nothing here yet. Files from your chats appear here." | inline row error + Retry | rows hidden individually when empty |
| All files / Shared | 8-row skeleton | All: same as Suggested empty; Shared tab hidden when empty | Retry | filtered-empty: "No files match" with Clear filters |
| Search | inline spinner in pill | "No files found" with search icon | "Search is unavailable" + Retry | scope chip changes the label |
| Trash | skeleton | "Trash is empty. Items moved to Trash will be deleted forever after 30 days." | Retry | banner with freed size |
| File page | sheet skeleton | n/a | inline | uploading, processing, trashed, locked, gone, viewer-disabled actions |
| Share dialog | member typeahead loading | "No one to add" | inline | already has access, workspace row |
| Picker | rows skeleton | "No files yet" | Retry | search no results |
| Composer attachment | progress | n/a | message above composer, 6 s, no file name | Send disabled until Ready; paused (offline) and slow (>10 min) notices; "Couldn't save to Library. Trying again." then Save again; Not in Library badge; Undo toast 10 s |
| Citations and answers | "Reading your files" indicator | "I couldn't find this in your files." (general answer marked as not from files) | "I couldn't reach Library just now." (Slack) / search unavailable (web) | dropped unverifiable citations, locked chip + Request access, "File deleted", "This file is no longer available" in Sources, Too many files notice |
| Routine pane | skeleton | "No files attached" | per-run failure line | skipped or lost-access file notes per run, output over size limit "Not saved: the file is over the size limit." |
| Import to Library | counts skeleton | "Nothing to import" | per-batch error + resume | opt-in only, progress, resumable |
| Settings / Admin | field skeletons | n/a | per-control rollback + toast | force-off disables personal control; AI reference locked message |
| Members | skeleton | n/a | Retry | only-Admin cannot be removed; leaver's locked question |

Copy for every row lives in `messages.ts`; product reviews that single file.

## 4. Copy and content rules

- No paragraphs in lists, banners or dialogs. One short line max. Hints behind info icons.
- Fixed upload messages come from the PRD (the unsupported message does not list types). Never include the file name in failures.
- Toast: what happened in a few words, one action ("Moved to Trash" + Undo; "Shared with Maya" + Undo; "Saved to Library" + View).
- Disabled controls explain why in a tooltip ("Only the owner can change this").
- All strings are English constants now; structure them as keys so localisation is possible later.

## 5. Quality gates (release criteria for the flag ramp)

1. **Types and lint**: `tsc --noEmit`, `npm run lint`, zero new warnings in `src/**/library*`.
2. **Unit tests** (vitest): all pure logic in 02 section 11; coverage on `lib/library/*` >= 90 % lines.
3. **Component tests** (vitest with `// @vitest-environment jsdom`, `@testing-library/react`, `vitest-axe`, MSW; **these are not installed today and the current vitest config is node-only**, so add them in shared prerequisite SP-3 first; existing node tests are unaffected): row menu permissions, filter chips, sort headers `aria-sort`, upload state machine UI, dialog focus trap and Escape, Send hold.
4. **End-to-end flows** (Playwright with `@axe-core/playwright`; `@playwright/test` is not a devDependency yet, shared prerequisite SP-4; reuse the repo's live-chat login recipe) mirroring prototype flows A to H: A capture and reuse, B routine setup, C routine run output, D Slack, E share, F delete and restore, G admin and removal, H storage and limits. Each flow includes its sad paths (failed upload, Send early, file removed before send, source switched off, locked citation).
5. **Permissions suite against the real API**: matrix of owner, viewer-direct, viewer-workspace, Admin-over-share, Admin-private, removed member, no access across list, detail, preview, download, names, citation, picker.
6. **Accessibility**: axe clean on all routes in light and dark; keyboard-only run of flow A and E; screen reader pass on the table, menus, dialogs, upload status; 4.5:1 contrast; no information by colour alone (unread, generated, status, source).
7. **Performance**: `/library` is dynamic and cannot be budgeted by the existing `pages` check (it fails "not prerendered"); add `scripts/perf-library.mjs` and a `dynamicRoutes` block to `perf-budget.json` (07 section 9, shared prerequisite SP-6), keep `npm run perf:bundle:check` for the shared path; `pdfjs-dist` and chart libs must not be in the list route chunk; list route LCP < 2.0 s on mid-tier laptop with 200 rows; scrolling 5,000 virtualised rows holds 60 fps; no layout shift when the storage label or Shared tab appears (reserve space).
8. **Security review** (use `/security-review`): untrusted file names rendered as text, sanitised previews, no presigned URL persisted beyond TTL, no file content in analytics or logs.
9. **Analytics**: events fire once per action, no free text, registered in `mixpanel-setup-notion.txt` first.
10. **Dark mode and reduced motion** verified.
12. **Release gates from the PRD** (backend-owned, the front end verifies them in e2e): permission leakage zero (red team across roles, revocations, routines, Slack channels), prompt injection zero unconfirmed side effects, citation accuracy >= 98 %, honest abstention >= 90 %, deletion propagation 100 % within 60 s / 24 h / 30 d, retrieval recall@10 no regression.
13. **Edge-case register**: every EC id in `01-product-rules.md` section 14 is covered by a unit, component or e2e test, or has a written exception.
14. **Rollout**: flag `LIBRARY_ENABLED` (front end) + server flag; internal org first, then opted-in orgs, then default. Kill switch hides sidebar item and falls back to legacy multipart attach without data loss.

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Backend upload staging not ready | blocks composer phase | mock adapter; keep legacy multipart path behind the flag; agree contract early (04 section 4) |
| Access predicate omitted in one query | data leak | single `resolve()` / SQL predicate helper, lint-style test, permissions suite in CI |
| Retrieval returns chunks of files the asker cannot open | leak via AI answer | predicate at query time; test with a fixture of two users |
| Audio transcription cost and latency | slow Processing, spend | cap duration, show progress states, per-org limit, can ship Phase 1 without audio (flag the format off) |
| Two upload paths drift (multipart vs staged) | inconsistent behaviour | one client hook, one server promotion function, delete multipart for Library users after ramp |
| Prototype/PRD conflicts re-surface | rework | decisions recorded in `flows.md` section 0, linked from README; change requests go through the owner |
| Settings > Files overlap | user confusion | replace with redirect to `settings/library` |
| Member-removal transaction partial failure | orphaned or lost files | single transaction, S3 deletes via outbox, audit log, idempotent retry |
| Large lists on slow networks | jank | keyset pagination, fixed row height, virtualisation, skeletons |
| Permission leak through retrieval, snippets, suggestions or Slack channels (PRD: severe) | release blocker | one policy service, fresh authorisation before content reaches the model, channel check, zero-leak gate |
| Prompt injection from reviews, supplier emails, invoices, scraped pages (severe) | agent acts on poisoned text | content is data; confirmations naming the source file; injection suite as launch gate |
| Agents learning from their own outputs (high) | stale or wrong sources | generated files excluded from automatic retrieval until a person attaches them |
| Deletion does not fully delete (severe) | trust, legal | lineage on derived data, deletion ledger, purge monitoring, honest dialog copy |
| Clutter from auto-save erodes trust (high) | opt-outs | file-like outputs only, filters, visible opt-out, watch opt-out rate |
| Uploads restart when the user navigates | lost work | upload provider above the route group, resumable uploads |
| Promotion failure after send loses a file | file not in Library | idempotent promotion, 3 retries, Save again, Not in Library badge |
| Settings race between two Admins | surprise state | versioned settings, If-Match, Changed-by notice |

## 7. Definition of done for the feature

All Phase 1 scope in README works against the real API with the flag on; every state in section 3 exists; every edge case in `01-product-rules.md` section 14 (EC-01 to EC-42) has a test or a recorded exception; quality gates in section 5 pass; docs updated (`docs/api/library-endpoints-usage.md`, `SSE_EVENTS v2.md` for `ask_save`, `files_truncated`, `sourceEvents`, `groundedness`, analytics setup, `perf-budget.json`); mock adapter removed; the legacy `settings/files` page redirected; the prototype remains the visual reference and is not shipped.

## 8. Open questions log (master list)

Answer these later; nothing here blocks starting Phases 0 to 2. Each item says what the docs currently assume, so work proceeds on the default until a decision changes it. Owners in brackets. IDs are referenced from the other four docs.

| ID | Question | Current assumption | Blocks |
|---|---|---|---|
| OQ-1 | Does Trash count toward "used" storage, and do we show a cap in Phase 1 (PRD: no cap, no limit shown; prototype: "of 20 GB" sample)? (product) | used = active + chat-only + trashed; no cap in the API (`limitBytes: null`); the sample only behind the mock | Settings storage block |
| OQ-2 | Individuals without an organization: is Library enabled, or Org-only? (product) | `organization_id` nullable, Library on; workspace sharing and Admin pages hidden | schema nullability, routes |
| OQ-3 | Transcription provider, per-org cost control, can audio ship after everything else? (product, backend) | audio format behind its own flag | audio phase |
| OQ-4 | Malware scanning service and what "unsafe" covers. (backend, security) | managed scanner before `ready` | upload phase |
| OQ-5 | Replace `Settings > Files` with `settings/library` and redirect? (product, front end) | replace and redirect | settings phase |
| OQ-6 | Do chart outputs (`origin=chart`) become Library files? (product) | yes, as images | generated files |
| OQ-7 | Import to Library (opt-in, one time, PRD Launch readiness): confirm it is in Phase 1 and what it covers (chat files, delivered routine outputs). (product, backend) | built in Phase 6 as opt-in only | hardening phase |
| OQ-8 | Files in a shared chat (`ChatShare`): stay private, citations render locked for non-owners? (product) | yes | citations |
| OQ-9 | PRD stores a scan with no readable text as "not searchable" with Retry OCR, and flags partial reading; the owner decided a file that cannot be read is rejected and there is no Needs attention state. Which wins? (owner) | owner decision stands: reject unreadable files; `searchable` and `partially_read` columns exist but stay unused until decided | processing |
| OQ-10 | First-use auto-save notice (PRD CAP-10 requires it, owner left it out). (owner, legal) | not built | composer |
| OQ-11 | Request-access approve and deny UI timing (PRD: Phase 2). (product) | Phase 1 records and notifies only | sharing |
| OQ-12 | Legal wording for the data-use line, and the purge windows (60 s search, 24 h derived data, 30 d storage including backups). (legal) | placeholder copy; windows as in the PRD | Settings, purge SLOs |
| OQ-13 | Audio: transcribe at Processing (prototype shows the step and a transcript on the File page) or on use by the AI (PRD, Send never held)? Is the transcript kept? (product, backend) | on-demand transcription with a stored transcript; File page shows it once it exists | audio, File page |
| OQ-14 | Freshness notes and "added by" on citations (needs Approved status, Phase 2). Ship only the `addedBy`, `addedAt` fields now? (product) | fields yes, notes later | citations |
| OQ-15 | Zip and other unsupported types: reject entirely, or allow as chat-only attachments as today? (product) | chat-only allowed, never saved | upload |
| OQ-16 | Numbers to confirm: 24 h unsent draft purge, 10 s Undo, 10 min "taking longer", 3 automatic save retries. (product, backend) | PRD proposals | composer |
| OQ-17 | Limits: file size by plan, max files in use per chat, per routine and per share, search timeout and page size, wait before an unfinished run is failed. (product, backend) | server-configured; the UI shows the server message | limits endpoint |
| OQ-18 | When the sharing kill switch is off, do existing grants keep working? (product, security) | yes; new grants are refused | kill switches |
| OQ-19 | Routine owner removed: hand to the Admin with outputs (prototype) or pause until a new owner is named (PRD)? (owner) | prototype | routines |
| OQ-20 | Leaver never answers the transfer question: wait forever, or expire to a default after N days? (product, legal) | wait; access already ended; Admin can cancel | removal |
| OQ-21 | Failure messages: the PRD names the file, the owner removed the file name. Confirm the owner choice for all messages. (owner) | no file names | upload copy |
| OQ-22 | "See all" for Frequently used and the third supplier contract sample (owner prototype items). (owner) | not built; two samples | prototype only |
| OQ-23 | Office document preview: extracted-text preview now, rendered preview later? (backend, product) | extracted text | File page |
| OQ-24 | Name search: trigram vs full-text, language handling. (backend) | trigram on title plus vector on content | search |
| OQ-25 | Slack web-only exceptions (previews, list views, Admin settings, Delete forever) and the owner-only (ephemeral) share confirmation in channels, both marked PROPOSED in the PRD. (product) | as proposed | Slack |
| OQ-26 | Resumable upload protocol: S3 multipart with presigned parts (assumed) or tus? Part size, concurrency, per-part retry and re-presign contract. (backend) | S3 multipart, 8 MB parts, 3 concurrent | WP4 |
| OQ-27 | Batch upload status endpoint `GET /library/uploads?ids=` (needed to stay under the 100 req/min client limiter). (backend) | required | WP4 |
| OQ-28 | Thumbnail renditions: `thumbnailUrl` field on list rows (small, private-cacheable), plus a cache policy (`Cache-Control: private`, `ETag`). (backend) | required; otherwise type icons only | WP1 |
| OQ-29 | Set `deploymentId` to avoid chunk mismatch with many lazy viewer chunks and long-lived tabs? (front end, infra) | evaluate in WP8 | WP8 |
| OQ-30 | Adopt Sentry (none installed): needed for boundary reporting; until then `lib/observability` is a console shim. (front end, infra) | shim | SP-2, WP8 |
| OQ-31 | Where do Playwright and the perf script run in CI (preview deployment, seeded account, hosting)? (infra) | GitHub Actions against a preview | SP-4, SP-5, SP-6 |
