# Library: production scope (docs v2)

Status: draft for review, revision 2 (2026-10-13: PRD edge cases and logic changes merged in; every changed or new rule is tagged with its PRD id, e.g. CAP-10, FIND-22, LIF-6). Owner: front-end.

Inputs: the prototype above, plus the PRD "Library for Souvenir (draft)", tabs **Understanding** and **Phase 1: Library core** (requirement ids CAP, ORG, FIND, RTN, SHR, LIF, GOV, SLK). Precedence when they disagree: (1) a decision the owner recorded in prototype `flows.md` section 0, (2) the PRD, (3) the Build plan. The places where we follow the prototype over the PRD are listed in `01-product-rules.md` section 15 so nothing is lost silently.
Source of truth for behaviour: the clickable prototype (`library-prototype`, branch `library`, folder `surfaces/library`, files `page.md` and `flows.md`) which itself is aligned to the Phase 1 PRD ("Phase 1 Library core.pdf") and the Build plan. Where the prototype and the PRD disagree, `flows.md` section 0 records the decision. This doc set does **not** reopen those decisions; it turns them into front-end and backend work.

## What Library is

One page of every file a person uploaded or Souvenir generated (chat outputs, routine run outputs), so they can find it, open it, share it, and reuse it in a chat or routine. Files enter only through chats, routines and Slack. Library itself has no Upload button.

## Document map

| Doc | Read it for |
|---|---|
| [01-product-rules.md](01-product-rules.md) | Domain model, file states, permission matrix, auto-save, trash, sharing, citations, member removal. The rules every layer must agree on. |
| [02-frontend-logic.md](02-frontend-logic.md) | Routes, data layer (React Query keys, mutations, optimistic rules), upload pipeline in the composer, derived state, search, filters, sort, a11y, analytics, error handling. |
| [03-components.md](03-components.md) | Every component to build, on shadcn primitives restyled with our tokens, what to reuse from `src/components`, file layout, states each must cover. |
| [04-backend-requirements.md](04-backend-requirements.md) | Schema (tables, enums, indexes, migration), services, endpoints, wiring with chat / automations / Slack / org members, jobs, limits, security. Written for the backend team. We do not change the backend from this repo. |
| [05-delivery-plan-and-qa.md](05-delivery-plan-and-qa.md) | Phasing, what the front end can ship against mocks, test matrix, performance budget, rollout flags, the master open-questions log (section 8). |
| [06-principles-application.md](06-principles-application.md) | All 56 design-system principles (6 folders) applied to Library: verdict, concrete decision, checklist item each, CSP and platform changes, rendering table. |
| [07-build-plan.md](07-build-plan.md) | The production build plan: architecture and import rules, shared prerequisites, state ownership, data layer, upload subsystem, viewers, security rules, performance budgets, CI and tests, observability, work packages WP0 to WP8, code standards, rollout. |
| [08-plan-audit.md](08-plan-audit.md) | Audit of the plan against the 56 principles (60 % before fixes, 90 % after), what was wrong and corrected, remaining risks, plan to 100 %. |
| [09-implementation-status.md](09-implementation-status.md) | What is built, how to run it on the mock, how it was verified (tests, type-check, a real browser run), what is deliberately not built and why, backend assumptions. |

## Scope

In (Phase 1, matches prototype):
- Library page: Suggested, All files, Shared (only when non-empty), Trash screen, search with scope chip, Filter (Source, File type), Sort (Name, Created / Date shared), storage label.
- File page: preview (document, sheet, image, audio with transcript), provenance, Used in, Who has access, Ask about this, Rename, Share, Download, Delete, locked and gone states, citation highlight.
- Sharing: Viewer only; direct people or the whole workspace; revoke; request access.
- Trash: 30 day fixed window, restore with shares, delete forever, Empty Trash.
- Composer integration: attach (Uploading, Processing, Ready), Send held until Ready, picker ("Add from Library"), auto-save modes, citations and the Sources panel.
- Routines: attach Library files, run outputs saved as Generated files.
- Slack: save, find, share by command with Undo, cited answers under the asker's access.
- Settings: personal (auto-save, AI reference switch, storage, leave workspace), Admin (default auto-save, force off, AI reference, file limits, storage, Members with transfer question).

Added from the PRD Phase 1 spec (the prototype did not build these; see 05 section 1b): resumable uploads with pause notice, 10-minute slow-processing notice, save retries with Save again and Not in Library, Undo after save, Slack external-member fail-closed rules and parity actions, routine run inputs and missing-file notes, delete routine with its outputs, opt-in Import to Library, per-workspace kill switches, concurrent-Admin settings notices, verified citations and AI safety rules, 60 s / 24 h / 30 d deletion propagation.

Out (Phase 2, do not build, do not leave dead UI): tags, folders, favourites, bulk selection except Empty Trash, grid view, versions and Replace, Editor role, AI summaries, Audit log and Inventory pages (static placeholders only), Retry OCR, run-output retention, storage plans and billing.

## Headline decisions this doc set makes (flag if you disagree)

1. **Staged uploads become a first-class backend object.** Today files are posted as multipart on the chat stream request. The prototype needs Uploading, Processing, Ready *before* send. So a new `LibraryFile` row is created at upload time with `life = staged`, and chat send references file ids. See 04 section 4.
2. **One file table, not one per surface.** `LibraryFile` becomes the identity; `MessageFileAttachment`, `ProjectDocument` and automation `files/` keep working and gain a nullable link to it. No big-bang migration of old data (04 section 9).
3. **Frontend ships behind `LIBRARY_ENABLED`** in `src/lib/feature-flags.ts`, with a typed mock adapter so UI work does not block on the backend (05 section 2).
4. **shadcn is introduced as a primitives layer, not a rewrite.** `ui/button.tsx` already sets the precedent: shadcn shape, our tokens, legacy components kept where they exist. Library does not fork existing Avatar, Badge, Checkbox, Switch, Tooltip, Skeleton, Chip (03 section 1).
5. **Processing is not indexing.** Ready means scanned, read and previewed; a file joins the search index only when the message is sent, and until then it is private to the uploader (PRD, Processing). See 01 section 2 and 04 section 4.
6. **Access changes propagate on a clock:** browsing at once, AI within 60 seconds; deletion clears search in 60 s, derived data in 24 h, storage in 30 days. See 04 section 6.1b.
7. **Agent-made files are not automatic sources** until a person attaches them (no self-contamination), and actions that follow from reading a file need confirmation naming the file. See 01 section 13.
8. **Edge cases have stable ids** (EC-01 to EC-42) in 01 section 14 so QA, design and engineering reference the same list.
9. **Where it lives in the app:** nav item in the flat sidebar, routes under `src/app/(app)/library`, personal settings at `settings/library`, Admin at `settings/workspace-library` (the repo moved workspace pages from /org to /settings).

## Open questions

Logged at the end of `05-delivery-plan-and-qa.md` section 8 (OQ-1 to OQ-31, with the assumption each doc currently works to). To be answered later; none blocks Phases 0 to 2.
