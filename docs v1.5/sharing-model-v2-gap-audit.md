# Sharing Model v2 — Gap Audit (FE + BE)

Audit date: 2026-09-03
Spec: `sharing-model-v2.html` (same directory)
Scope: read-only research on `front-end/` and `back-end/`. No backend changes were made or proposed as code — this is analysis only.

Legend: ✅ Fully supported · ⚠️ Partially supported · ❌ Not supported · 🔴 Conflicts with current model

---

## Entities & Roles

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| Admin/Member roles, no special Admin sharing power | ✅ | None — `src/lib/roles.ts` ladder already gives Admin no extra sharing power | None — `OrganizationRole` enum already matches |
| Last Admin can't leave workspace without promoting replacement | ⚠️ | Build the forced "promote a replacement" modal (no such UI exists — zero hits for `successor`/`last admin` in FE source) | Guard logic already exists (`organization.py` blocks removing/demoting the last admin) — but there's **no self-service "leave workspace" endpoint** for a plain Member, only admin-driven `removeMember` |

## Projects

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| 3 types: Personal / Workspace / Shared | ⚠️ | Model is binary today (`private`/`team`) — add a real "Shared" type, a 3-way sidebar (today it's Personal vs. "Team"), and a type picker in the creation flow (`app/(app)/projects/new/page.tsx` currently calls `createProject(name, description)` with no type/teamId argument — every project is created Private) | No `ProjectType` enum exists at all. `Project.visibility` column exists but the ACL code (`services/organizations/roles.py`) *deliberately excludes* the org-wide visibility arm for `Project` (unlike `Chatboard`/`PersonaRepo`, which get it), and there's no `PATCH /projects/{id}/visibility` endpoint — Workspace-type is schema-present but not functionally wired |
| Owner fixed at creation, never removable by others | ✅ | None | None — `Project.user_id` is never mutated anywhere in the codebase |
| Any collaborator can add/remove other collaborators (Shared) | 🔴 | `ProjectMembersPanel` exists and is wired into `project/[id]/page.tsx`, but its `canManage` prop is derived as **owner-only** (`project.canEdit` = strict `ownerUserId === currentUserId`) — needs opening to any collaborator once BE allows it | **Conflicts**: `Project.inviteOne`/`inviteMany`/`removeMember` (`services/projects/project.py`) all hard-require `requireOwned` — only the owner can add/remove today, the opposite of spec. Needs a real permission-model change |
| Collaborator self-serve "Leave project" | ❌ | No "Leave project" action exists anywhere in FE (`src/`) | No leave endpoint exists — a collaborator hitting the member-removal endpoint 404s (it's owner-only via `requireOwned`); needs a new self-removal path |
| Owner exit flow: name successor / archive / convert to Private, forced modal, no escape | ❌ | Nothing built — no modal, no successor picker, no archive/convert-to-private UI | Nothing built — no successor field, no transfer-ownership endpoint, no archive concept for `Project` (only has `deleted_at` via the `SoftDelete` mixin) |
| Deletion: owner-only, Personal instant, Workspace/Shared soft-delete + 30-day recovery, cascades to chats | ⚠️ / 🔴 | Instant delete + accurate cascade-delete confirmation copy already exist (`projects/page.tsx`); no trash/recovery view at all; delete permission needs tightening once BE changes | Soft-delete mixin + cascade-to-chats already work well (`Project.delete()` soft-deletes linked `ProjectChat`s and chats). **Conflicts**: an org Admin can currently delete a project they don't own (`Project.requireDelete` admin override) — must be removed to match spec. No 30-day purge job or restore endpoint exists anywhere |
| Offboarding: delete Personal projects, gate on unresolved Shared/Workspace ownership | ❌ | N/A (backend-driven) | Not supported — `Organization.removeMember` never touches `Project` rows at all; needs new logic tied to the (not-yet-built) successor flow |

## Chats

| Spec area | Possible? | Frontend changes needed | Backend changes needed |
|---|---|---|---|
| 3 states: Private / Shared / Archived | ⚠️ | Private + Shared exist via `ChatShare`; **Archived is explicitly stubbed** — `LeftSidebar.tsx` comment states "no archive endpoint yet," and the button fires a "coming soon" toast | Archived is genuinely absent — no `archived_at`/state column, no endpoint, no `grep -i archive` hits in `services/chat/`. Needs a new state + read-only enforcement |
| Shared chat: explicit list, creator-only manage | ✅ (mostly) | `ChatShareOverlay` already matches this well (creator-managed list, person/project recipient targets, revoke) | `create_chat_share`/`revoke_chat_share` already creator-gated — matches spec. But there's a **duplicate, spec-uncontemplated** org-wide `visibility="shared"` mechanism sitting alongside `ChatShare` (`PATCH /chats/{id}/visibility`) that should probably be retired or reconciled |
| Chat's project association fixed at creation, never movable | 🔴 | `MoveToProjectModal` is a live, wired-in feature (`LeftSidebar`, `ChatHistoryItem`, `app/(app)/chats/page.tsx`) — directly contradicts spec, would need removing/gating | **Conflicts**: two live endpoints let a chat attach to a project after creation — `POST /projects/{id}/chats/{chat_id}` (`Project.linkChat`) and `POST /chat-shares` with `project_id` — both would need blocking post-creation |
| Viewer sees read-only, hits "Continue" to fork private copy | ✅ / ⚠️ | Already built — the "Create a copy" button does exactly this (naming differs from spec's "Continue," cosmetic only) | Fork mechanics (`fork_shared_chat`) already match well, but forking is currently **blocked for `read_only`-mode shares** — an extra `editable`/`read_only` dimension the spec doesn't have; needs collapsing so every share can fork |
| Deletion: instant, no recovery, no successor gating | ✅ | `DeleteChatDialog` already matches (instant, permanent, no gating) | Already matches functionally (soft-delete under the hood, but behaves as instant/no-recovery since nothing restores it) |
| Offboarding: delete Private chats, keep Shared chats alive | ❌ | N/A (backend-driven) | Not supported — offboarding never touches `Chatboard` rows today |
| Not searchable workspace-wide | ✅ (by omission) | Couldn't confirm — global search's result-wiring (`GlobalSearchModal`'s data source) wasn't located in this pass; flagged for follow-up | No global chat-search feature exists at all, so nothing currently violates this — not a deliberately enforced rule, just an absence |

## Cross-cutting conflict: legacy Teams

Backend has **already fully dropped** the Teams layer — migration `f8a1c3e5b7d9_flatten_org_drop_teams.py` removes the team layer, with a comment noting shared-vs-private is now the only visibility split. So backend direction already agrees with dropping Teams (consistent with the `project_teams_ui` memory note flagging this conflict).

Frontend, however, still has live `TeamSwitcher` / `TeamSwitcherDropdown` / `TeamChip` components and a `teamId` field threaded through `projects-context.tsx` and the project scope filter (`personal|team`), even though the backend concept it once mapped to is gone. It's vestigial (silently returns `null` since there are no teams to show) but still load-bearing plumbing. Needs a decision: delete it outright, or repurpose its "named group + project list" shape for the new Shared-project membership list.

## Bottom line

- **Biggest single gap:** the owner-exit/successor flow — nothing exists on either side (no FE modal, no BE endpoint/state machine).
- **Second biggest:** the Shared-project membership permission model is backwards on the backend (owner-only today; spec wants any-collaborator) — a real BE change, not a FE-only tweak.
- **Most mature areas already:** chat sharing (`ChatShare`) and the Continue/fork flow.
- Backend was audited read-only per instruction — no backend code was modified.
